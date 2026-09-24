# Employee Appreciation Portal — Design Demo

A **static, click-through copy** of the portal for showing clients. Same screens, same design, same
workflow as the real application in `../app`, with **no server, no API and no database to host**.
Everything runs in the visitor's browser on fictitious sample data.

**The whole demo is one file: `publish/index.html`.** Double-click it to open it in a browser, or
upload that one file to GitHub for a shareable link. Nothing else in this folder needs to be
uploaded — `node_modules`, `src` and the rest are only used to rebuild that file.

---

## Get a shareable link with GitHub Pages (free, no domain needed)

GitHub gives every account a free address: `https://<your-account>.github.io/<repo-name>/`.
No git commands are needed — it can all be done on the GitHub website.

1. Sign in at **github.com** and click **New repository** (the **+** at the top right).
2. Name it, for example `appreciation-portal-demo`. Choose **Public** (GitHub Pages on a private
   repository needs a paid plan). Click **Create repository**.
3. On the new repository's page, click **uploading an existing file**, drag in
   **`publish/index.html`** — only that file — and click **Commit changes**.
4. Open **Settings → Pages**. Under **Build and deployment** set **Source: Deploy from a branch**,
   **Branch: `main`**, folder **`/ (root)`**, and click **Save**.
5. Wait a minute and refresh that page. The link appears at the top —
   `https://<your-account>.github.io/appreciation-portal-demo/` — share it.

To update the demo later, upload the new `index.html` over the old one (step 3 again). The link
stays the same. Any screen can be linked directly, e.g.
`https://<your-account>.github.io/appreciation-portal-demo/#/reports/award-stats`.

---

## What the client sees

- The full portal, starting at the sign-in screen.
- A **"Design demo"** button in the bottom-right corner that:
  - signs in as **Admin**, **Auditor** or **Employee** in one click, to show each role's view;
  - **resets** all sample data back to the start.
- Or sign in by hand with any demo account and the password `Portal#2026`:
  `ganesh@isgesolutions.com` (Admin), `priya.nair@isgesolutions.com` (Auditor),
  `aisha.khan@isgesolutions.com` (Employee).

Everything works, not just the look: voting, editing a vote, publishing a winner, resolving a tie,
building a showcase, filters, sorting, CSV exports, the audit log. Changes are kept in that browser,
so a refresh does not lose them. Nothing is sent anywhere, and each visitor has their own private copy.

---

## Rebuilding after the real app changes

```bash
npm install        # first time only
npm run sync       # copies the latest screens and rules from ../app
npm run build      # rebuilds publish/index.html
```

Then upload the new `publish/index.html` to GitHub. `npm run dev` runs the demo locally with live reload.

---

## How it works (for developers)

`npm run sync` copies `../app/web/src` and the server's routes, rules, schema and seed into `src/`,
then lays `overrides/` on top. Those overrides are the only differences from the live app:

| File | What it replaces |
|---|---|
| `api/transport.js` | `fetch()` → the in-browser API |
| `router.js` | `BrowserRouter` → `HashRouter` (static hosting can't rewrite paths) |
| `main.jsx` | boots the database before the first render |
| `demo/` | the floating "Design demo" panel |
| `demo-server/db.js` | `better-sqlite3` → SQLite compiled to WebAssembly (`sql.js`) |
| `demo-server/express.js` | a small router with the same surface as Express's |
| `demo-server/app.js` | the live `index.js`: same routers, same middleware, plus saving in the browser |
| `demo-server/lib/password.js` | scrypt → a plain demo check (sample accounts only) |

`vite.config.js` then folds the build — script, styles and the SQLite engine — into the single
`publish/index.html`.

Because the real route files run unchanged, the demo cannot drift from the real rules: anonymity
thresholds, hidden results, tie-breaks and role checks all behave identically.

Do not edit files in `src/` directly — they are overwritten by the next sync. Change `../app`, or
`overrides/` for demo-only behaviour.
