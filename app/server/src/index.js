import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { migrate, dbPath } from './db.js';
import { loadUser, requireCsrfHeader } from './middleware/auth.js';
import { runScheduler } from './lib/cycles.js';

import { router as authRouter } from './routes/auth.js';
import { router as cyclesRouter } from './routes/cycles.js';
import { router as votesRouter } from './routes/votes.js';
import { router as employeesRouter } from './routes/employees.js';
import { router as dashboardRouter } from './routes/dashboard.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);

migrate();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(loadUser);

// NF-1 / NF-4 — conservative headers. HSTS is added by the TLS terminator in
// production; everything else is set here so it cannot be forgotten.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'"
  );
  next();
});

app.use('/api', requireCsrfHeader);
app.use('/api/auth', authRouter);
app.use('/api/cycles', cyclesRouter);
app.use('/api/votes', votesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, db: path.basename(dbPath) }));

// Serve the built front end when it exists (npm run build).
const webDist = path.resolve(here, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  // NF-18 — structured, and never leaking internals to the client.
  console.error('[error]', err);
  res.status(500).json({ error: 'server_error', ref: Math.random().toString(16).slice(2, 10) });
});

// R-6.16.2 / NF-20 — idempotent, safe to run repeatedly.
runScheduler();
setInterval(() => {
  try { runScheduler(); } catch (e) { console.error('[scheduler]', e); }
}, 60_000).unref();

app.listen(PORT, () => {
  console.log(`\n  Employee Appreciation Portal — API`);
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log(`  database: ${dbPath}\n`);
});
