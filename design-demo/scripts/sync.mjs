/**
 * Refreshes the demo from the real application, so the design never drifts.
 *
 *   npm run sync
 *
 * 1. Copies ../app/web/src            → src/              (every screen, style and component)
 * 2. Copies the API from ../app/server → src/demo-server/  (routes, rules, schema, seed)
 * 3. Lays overrides/ on top — the only files that differ from the live app:
 *      api/transport.js   requests go to the in-browser API instead of fetch()
 *      router.js          HashRouter, because GitHub Pages cannot rewrite paths
 *      main.jsx           boots the in-browser database before rendering
 *      demo/              the floating "Design demo" panel
 *      demo-server/       SQLite in the browser (sql.js), an express-like router,
 *                         demo password handling and the request dispatcher
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const app = path.resolve(root, '..', 'app');
const src = path.join(root, 'src');

const copy = (from, to) => fs.cpSync(from, to, { recursive: true, force: true });

fs.rmSync(src, { recursive: true, force: true });
copy(path.join(app, 'web', 'src'), src);

const server = path.join(app, 'server', 'src');
const target = path.join(src, 'demo-server');
for (const part of ['routes', 'lib', 'middleware', 'schema.sql']) copy(path.join(server, part), path.join(target, part));

// The seed runs as a CLI in the live app; here it is a function called once.
const seed = fs.readFileSync(path.join(server, 'seed', 'run.js'), 'utf8');
const cut = seed.indexOf('\nmigrate();\nif (mode');
if (cut < 0) throw new Error('seed/run.js changed shape — update scripts/sync.mjs');
fs.mkdirSync(path.join(target, 'seed'), { recursive: true });
fs.writeFileSync(
  path.join(target, 'seed', 'run.js'),
  seed.slice(0, cut).replace("const mode = process.argv[2] || 'demo';", '') + '\nexport { seedDemo };\n'
);

copy(path.join(root, 'overrides'), src);
console.log('Synced from ../app. Run `npm run build` to refresh publish/index.html.');
