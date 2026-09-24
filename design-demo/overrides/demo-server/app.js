/**
 * Design demo — the live server's index.js, running in the browser.
 *
 * The same routers are mounted at the same paths, behind the same loadUser
 * and CSRF middleware. A request from the UI is dispatched here instead of
 * over the network, and the database is kept in IndexedDB between visits, so
 * a client can vote, publish a winner, refresh, and see it still there.
 */
import { db, openDatabase, exportDatabase, migrate } from './db.js';
import { loadUser, requireCsrfHeader, SESSION_COOKIE } from './middleware/auth.js';
import { runScheduler } from './lib/cycles.js';
import { seedBaselineTutorials } from './lib/tutorials.js';
import { seedDemo } from './seed/run.js';

import { router as authRouter } from './routes/auth.js';
import { router as cyclesRouter } from './routes/cycles.js';
import { router as votesRouter } from './routes/votes.js';
import { router as employeesRouter } from './routes/employees.js';
import { router as dashboardRouter } from './routes/dashboard.js';
import { router as winnersRouter } from './routes/winners.js';
import { router as publishRouter } from './routes/publish.js';
import { router as feedbackRouter } from './routes/feedback.js';
import { router as adminRouter } from './routes/admin.js';
import { router as tutorialsRouter } from './routes/tutorials.js';

const MOUNTS = [
  ['/auth', authRouter], ['/cycles', cyclesRouter], ['/votes', votesRouter],
  ['/employees', employeesRouter], ['/dashboard', dashboardRouter], ['/winners', winnersRouter],
  ['/publish', publishRouter], ['/feedback', feedbackRouter], ['/admin', adminRouter],
  ['/tutorials', tutorialsRouter],
];

// Bump when the schema or seed changes, so returning visitors get fresh data.
const DATA_VERSION = 'eap-demo-v1';
const COOKIE_KEY = 'eap-demo-cookie';

/* ------------------------------------------------------------- boot */

export async function bootDemo() {
  const saved = await idb('get', DATA_VERSION).catch(() => null);
  await openDatabase(saved || undefined);
  if (!saved) {
    migrate();
    seedDemo();
    await persist();
  } else {
    migrate();   // idempotent: CREATE IF NOT EXISTS + INSERT OR IGNORE
  }
  seedBaselineTutorials();
  runScheduler();
}

/** Wipes the demo back to the seeded sample data. */
export async function resetDemo() {
  await idb('delete', DATA_VERSION).catch(() => {});
  try { localStorage.removeItem(COOKIE_KEY); } catch { /* private mode */ }
}

async function persist() {
  if (!db.dirty) return;
  db.dirty = false;
  await idb('put', DATA_VERSION, exportDatabase()).catch(() => {});
}

/* --------------------------------------------------------- dispatch */

/**
 * Handles one API call. `url` is what the UI would have fetched, e.g.
 * "/api/winners/stats?page=1". Resolves to { status, headers, text }.
 */
export async function dispatch(method, url, body) {
  const u = new URL(url, 'http://demo.local');
  const path = u.pathname.replace(/^\/api/, '') || '/';
  const query = Object.fromEntries(u.searchParams.entries());

  const cookies = readCookies();
  const req = {
    method, path, query, params: {}, cookies,
    body: body ? JSON.parse(JSON.stringify(body)) : {},
    headers: { 'user-agent': navigator.userAgent, 'x-requested-with': 'eap-web' },
    ip: '127.0.0.1', socket: {},
    get(h) { return this.headers[String(h).toLowerCase()]; },
  };
  const res = makeResponse(cookies);

  try {
    runScheduler();   // the live server runs this every minute
    loadUser(req, res, () => {});
    requireCsrfHeader(req, res, () => {});
    if (!res.finished) {
      const mount = MOUNTS.find(([p]) => path === p || path.startsWith(`${p}/`));
      const handled = mount && mount[1].handle(req, res, path.slice(mount[0].length) || '/');
      if (!handled && !res.finished) res.status(404).json({ error: 'not_found' });
    }
  } catch (err) {
    console.error('[demo api]', err);
    res.status(500).json({ error: 'server_error' });
  }

  writeCookies(res.cookieJar);
  await persist();
  // A breath of latency, so loading states show as they would for real.
  await new Promise((r) => setTimeout(r, 90));
  return { status: res.statusCode, headers: res.headers, text: res.body };
}

function makeResponse(cookies) {
  return {
    statusCode: 200, headers: {}, body: '', finished: false, cookieJar: { ...cookies },
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    json(obj) { this.setHeader('content-type', 'application/json'); return this.send(JSON.stringify(obj)); },
    send(text) { this.body = String(text ?? ''); this.finished = true; return this; },
    cookie(name, value) { this.cookieJar[name] = value; return this; },
    clearCookie(name) { delete this.cookieJar[name]; return this; },
  };
}

function readCookies() {
  try { return JSON.parse(localStorage.getItem(COOKIE_KEY) || '{}'); } catch { return {}; }
}
function writeCookies(jar) {
  try {
    if (jar[SESSION_COOKIE]) localStorage.setItem(COOKIE_KEY, JSON.stringify(jar));
    else localStorage.removeItem(COOKIE_KEY);
  } catch { /* private mode: the session lasts until the tab closes */ }
}

/* --------------------------------------------------------- IndexedDB */

function idb(op, key, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('eap-design-demo', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', op === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('kv');
      const r = op === 'get' ? store.get(key) : op === 'put' ? store.put(value, key) : store.delete(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    };
  });
}
