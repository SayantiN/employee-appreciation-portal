# Employee Appreciation Portal — application

React (Vite) + SCSS front end, Express + SQLite API.
Built to [`../docs/SPEC.md`](../docs/SPEC.md) v1.2 and [`../docs/wireframe.html`](../docs/wireframe.html) v2.1.

---

## Run it

```bash
cd employee-appreciation-portal/app
npm install
npm run seed:demo
npm run dev
```

Then open **http://localhost:5173**. The API runs on :4000 and Vite proxies `/api` to it, so the
session cookie behaves in development exactly as it will in production.

**Demo accounts** — the password is the same for all three:

| Email | Role | What it shows |
|---|---|---|
| `ganesh@isgesolutions.com` | Admin | Everything, including the pre-close tally and cycle controls |
| `priya.nair@isgesolutions.com` | Auditor | Read-only: sees the tally, changes nothing |
| `aisha.khan@isgesolutions.com` | Employee | The ordinary experience — results hidden until close |

Password: `Portal#2026`

The seed leaves the current month **open with the admin account not yet voted**, one past cycle
deliberately **tied**, and one month that **closed with no votes at all**, so both edge cases are
visible without setting them up by hand.

### Other commands

| Command | Does |
|---|---|
| `npm run seed:demo` | ~30 fictitious employees, 7 cycles, votes, published winners |
| `npm run seed:minimal` | One admin, empty directory — the real starting point |
| `npm run reset` | Empties every table |
| `npm run build` | Builds the front end; the API then serves it from `/` |
| `npm start` | Production mode, single process on :4000 |

The database is a file at `server/data/portal.sqlite`. Delete it to start completely fresh.

---

## What is built

Every screen in SPEC §5 is now built, plus one addition — **Award Statistics**.

| Screen | Spec | Notes |
|---|---|---|
| Login, forgot password, reset | 6.1, 6.2 | |
| Dashboard | 6.3 | |
| Vote — Employee of the Month / Year | 6.4, 6.5 | |
| My Votes | 6.6 | |
| Feedback for Me | 6.7 | Reveal threshold, report-as-abusive, print to PDF |
| Current Cycle Status · Past Results | 6.8 | Past Results deep-links with `?cycle=<id>` |
| Winners Report | 6.9 | Month / Year / Date-wise / All views, two date bases, CSV export, print |
| **Award Statistics** | 6.9A (new) | Per employee: EoM and EoY wins and nominations, drill-down, CSV export |
| Hall of Fame · Winner Showcase | 6.10, 6.11 | Showcase blocks: write-up, impact figure, link |
| **Community Showcase** | 6.11A (new) | Any employee shares work; author-only editing, admin can hide with a reason |
| How It Works · Video Tutorials | 6.13, 6.14 | 15 baseline tutorials seeded as scripts; transcript until videos are recorded |
| Admin — Voting Cycles | 6.16 | |
| Admin — Publish Winners | 6.17 | Override and tie resolution need a justification; unpublish |
| Admin — Employee Directory | 6.18 | Add, edit, role, deactivate, CSV import with dry run |
| Admin — Tutorial Library | 6.14.7 | |
| Admin — Analytics & Exports | 6.19 | Participation, ratings, department heatmap, non-voters, moderation queue |
| Admin — Audit Log · System Settings | 6.20, 6.21 | |

**Award Statistics counting rule:** a *nomination* is one cycle in which the person received at least
one submitted vote, counted only once that cycle has closed; a *win* is a published winner (joint
winners each count one). Open cycles never contribute, so the report cannot leak live standings.

**Not built yet:** Notifications centre and My Profile screens (notifications are already written to
the database on publish), file uploads for showcases and tutorial videos (need storage and virus
scanning), .xlsx/PDF exports (CSV opens in Excel; pages have a print stylesheet), grid column
show/hide (DG-8), and Hall of Fame photos.

The **audit log, tally engine, scheduler and full schema are already complete** — later phases add
screens over data that is already being recorded correctly.

---

## Rules that are enforced, not just drawn

| Rule | Where it lives |
|---|---|
| **No self-voting** (BR-2) | Absent from the nominee list · rejected in `routes/votes.js` · `CHECK (voter_id <> nominee_id)` in the schema |
| **One vote per cycle** (BR-3) | `UNIQUE (cycle_id, voter_id)`; a second attempt edits the first |
| **Editable until close** (BR-4) | `isVotable()` checks the server clock; every edit writes a `vote_versions` row |
| **Results hidden until close** (BR-5) | `/cycles/:id/results` does not *select* per-nominee figures for an employee — they are absent from the payload, not hidden in the UI |
| **Server clock decides** (BR-10) | The countdown is cosmetic; `isVotable()` is re-checked on every write |
| **No hard deletes** (BR-11) | Employees deactivate; votes withdraw; nothing is removed |
| **Everything audited** (BR-12) | `lib/audit.js` — append-only, with no update or delete path anywhere |
| **Tally frozen at close** (R-6.8.4) | `cycle_results` is written once by `closeCycle()` and read thereafter |
| **Tie-break ladder** (R-6.8.2) | `compareNominees()` — votes, average, 9s and 10s, earliest vote, then a human |
| **Grid filters allow-listed** (NF-9) | `lib/grid.js` matches every incoming column name against the caller's list; values are always bound parameters |
| **Three active employees minimum** (R-6.16.5) | `canOpen()` blocks the open |
| **Last admin protected** (R-6.18.4) | `lastActiveAdmin()` blocks the change |

---

## Layout

```
app/
  server/
    src/
      schema.sql          every integrity rule from SPEC §7.1
      db.js               connection, migration, settings with defaults
      index.js            express app, security headers, scheduler
      lib/
        password.js       scrypt hashing + the §6.2 policy
        audit.js          append-only writer
        cycles.js         window logic, scheduler, tally, tie-breaks
        grid.js           server half of the Data Grid Standard
      middleware/auth.js  sessions, roles, CSRF header
      routes/             auth · cycles · votes · employees · dashboard
      seed/run.js         demo and minimal datasets
  web/
    src/
      styles/_tokens.scss every design value, once
      styles/_mixins.scss breakpoints, focus ring, tap targets
      components/         ui.jsx · DataGrid.jsx · AppShell.jsx
      screens/            Login · Dashboard · VoteForm · MyVotes · Results · AdminCycles
      api/client.js       the only place that talks to the API
      state/auth.jsx      session context and the theme switch
```

### Design tokens

`web/src/styles/_tokens.scss` holds **every** colour, size, radius, duration and breakpoint. No
component hard-codes a value. Each token is emitted as a CSS custom property as well, so light and
dark switch at runtime without a rebuild.

The palette is the muted set from wireframe v2.1 — blue `#42678F`, plum `#6F6193`, sage `#4E7C62`,
bronze `#8A6729`, clay `#9E574F`, teal `#3F7880`. Each clears 4.5:1 on white as small text, so
there is one value per role rather than a separate darker variant for labels.

---

## Notes and caveats

- **Password reset emails are not sent.** There is no SMTP transport wired up; the reset link is
  printed to the API console so the flow is testable end to end. Replace `consoleDeliver()` in
  `routes/auth.js` with your mail client.
- **`better-sqlite3` is a native module.** It ships prebuilt binaries for current Node on Windows,
  so `npm install` normally just works. If it tries to compile and fails, install the Visual Studio
  build tools, or tell me and I will swap the driver for a pure-JS one.
- **Two open questions still shape this code.** `OQ-1` (votes per cycle) is a setting defaulting to
  one; `OQ-2` (whether employee data is managed here or synced from HR) is why the Employee
  Directory is API-only so far — the screen differs completely depending on the answer.
- Seed data is entirely fictitious and deterministic, which is what R-6.14.6 requires for the
  tutorial recordings in a later phase.
