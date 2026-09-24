# Employee Appreciation Portal — Wireframe & Design Logic

**One page. Every screen. Why each one is laid out the way it is.**

**Version:** 1.1 · **Date:** 2026-09-22 · **Source of truth:** [SPEC.md](SPEC.md) v1.2
**Theme:** quiet base, muted accent system (§2)

---

## Contents

| § | Section |
|---|---|
| 1 | How to read this document |
| 2 | **Design system — quiet base, muted accents** |
| 3 | Layout skeleton & navigation |
| 4 | The data grid — built once, used nine times |
| 5 | **Screen-by-screen wireframes + design logic** (6.1 → 6.21) |
| 6 | States every screen must define |
| 7 | Responsive rules |
| 8 | Build order |

---

## 1. How to read this document

Wireframes are drawn in monospace boxes. They show **structure, hierarchy and priority** — not final pixels, not final copy.

```
┌──────────┐   a panel or card          ▓▓▓▓   a blocked / hidden region
│  ▁▁▁▁    │   a line of text           ●      a person (photo/avatar)
│  [ Btn ] │   a button                 ▸      expandable row
└──────────┘   ↕ ↑ ↓  sortable column   ⚑      filter available
```

Each screen has a **Design logic** block. That is the part worth arguing with — it says *why* the layout is what it is, and which spec rule forced it. Rule IDs like `R-6.4.2` point back to SPEC.md.

---

## 2. Design system — quiet base, muted accents

The base is restrained so the product reads as a serious HR system. Colour is then spent **deliberately and semantically**: every hue means one thing, everywhere. All six accents are **desaturated and share a similar depth**, so none shouts over the content or over each other — and none is used as a large wash.

### 2.1 Palette

| Role | Hex | Used for |
|---|---|---|
| **Blue 600** — primary | `#42678F` | Primary actions, active nav, focus rings, the brand |
| **Blue 50** — primary tint | `#EDF2F7` | Selected rows, active nav background |
| **Plum 600** — award | `#6F6193` | Winners, Hall of Fame, showcase, anything celebratory |
| **Sage 600** — live | `#4E7C62` | An open cycle, "submitted", healthy participation, success |
| **Bronze 500** — attention | `#8A6729` | Deadlines, countdowns, stale tutorials, soft warnings |
| **Clay 600** — blocked | `#9E574F` | Errors, validation, locked, withheld-by-rule |
| **Teal 600** — learning | `#3F7880` | Tutorials, help, onboarding |
| **Slate 900** — ink | `#1D2730` | Body text, headings |
| **Slate 500** — muted | `#6B7783` | Secondary text, labels |
| **Slate 200** — line | `#E2E6E9` | Borders, dividers |
| **Slate 50** — ground | `#F7F8F8` | Page background; cards sit on white |

**Contrast.** Every accent clears 4.5:1 on white as small text — blue 5.8, plum 5.5, sage 4.8, bronze 5.1, clay 5.4, teal 5.0 — so there is **one hex per role**, used for fills, borders, icons and text alike. The earlier brighter set needed a second darker value per hue just to label anything; dropping the saturation removed that whole category of mistake.

### 2.2 The rule that makes it work

> **One hue, one meaning, product-wide.** Sage always means "live or good". Bronze always means "time is running out". Clay always means "you cannot". Plum always means "an award".

A user who learns that on the Dashboard can read the Winners Report without being taught it again. The moment sage is used decoratively, the system stops carrying information and becomes noise.

### 2.3 Where colour is *not* allowed at all

- **Not on the voting form.** The form is a writing surface. Colour there competes with the person's own thinking. The only colour is the rating fill and validation.
- **Not behind body text.** No tinted card backgrounds under paragraphs.
- **Not as the only signal.** Every status carries a word or icon as well as a hue — colour-blind users and greyscale printouts must still work (`A-8`).

### 2.4 Type & spacing

- **Display / UI:** one geometric-humanist sans (e.g. Inter Tight, Plus Jakarta, IBM Plex Sans). **Numerals: tabular** — vote counts and ratings sit in columns.
- **Scale:** 11 · 12 · 14 · 16 · 20 · 24 · 32 · 44. Body 16px on mobile minimum (`RR-4`).
- **Spacing:** 4px base grid. Card padding 16/20/24. Page gutters 16 / 24 / 32 (mobile / tablet / desktop).
- **Radius:** 8px cards, 6px controls, 999px pills. **Shadow:** one soft elevation for overlays only — no shadows on static cards.

---

## 3. Layout skeleton & navigation

### 3.1 Desktop ≥ 1280

```
┌───────────────┬──────────────────────────────────────────────────────────┐
│               │  Page title                          [search] [🔔] [ ● ] │
│  SIDEBAR      ├──────────────────────────────────────────────────────────┤
│  240px        │                                                          │
│  ▸Dashboard   │   CONTENT                                                │
│   Vote        │   max-width 1280, centred above 1536                     │
│   My Activity │                                                          │
│   Results     │                                                          │
│   Reports     │                                                          │
│   Winners     │                                                          │
│   Notifics.   │                                                          │
│   Help&Train  │                                                          │
│  ─────────    │                                                          │
│   ADMIN       │                                                          │
│  ─────────    │                                                          │
│   ● Profile   │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

### 3.2 The complete menu

```
Dashboard
Vote            → Employee of the Month · Employee of the Year
My Activity     → My Votes · Feedback for Me
Results         → Current Cycle Status · Past Results & Leaderboard
Reports         → Winners Report
Winners         → Hall of Fame · Work Showcase
Notifications
Help & Training → How It Works · Video Tutorials
[ADMIN]         → Voting Cycles · Publish Winners · Employee Directory ·
                  Tutorial Library · Analytics & Exports · Audit Log · Settings
Account         → My Profile · Change Password · Logout
```

### 3.3 Four widths

| Width | Pattern |
|---|---|
| ≥ 1280 | Sidebar expanded, labels visible |
| 1024–1279 | Sidebar collapsed to a 64px icon rail; expands on hover **over** content, without reflowing it |
| 768–1023 | Hamburger → off-canvas drawer with a dimmed overlay |
| ≤ 767 | Bottom tab bar: **Dashboard · Vote · Feedback · Winners · More**. Everything else, Administration included, lives behind More |

```
MOBILE ≤767                     TABLET 768–1023
┌─────────────────┐             ┌──────────────────────────┐
│ Dashboard    ● │              │ ☰  Dashboard        🔔 ● │
├─────────────────┤             ├────────┬─────────────────┤
│                 │             │ DRAWER │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│   content       │             │ 280px  │▒▒ dimmed ▒▒▒▒▒▒│
│                 │             │        │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
├─────────────────┤             └────────┴─────────────────┘
│ ▪   ▪   ▪  ▪  ▪ │
│Dash Vote Fb Win …│
└─────────────────┘
```

**Design logic**

- **The mobile four are chosen by frequency, not by org chart.** Dashboard and Vote are the monthly task; Feedback is the reward that brings people back; Winners is the social pull. Reports and Admin are deliberate destinations — burying them behind More costs a power user one tap and saves every other user four wrong ones.
- **Active state is never colour alone** — blue text **plus** a blue left bar **plus** semibold (`R-5.1`).
- **Administration is hidden, not greyed.** A disabled menu item advertises a capability and invites probing; and the route is refused server-side regardless (`NF-3`).
- The icon rail expands *over* content rather than pushing it, so a laptop user's reading position never jumps.

---

## 4. The data grid — built once, used nine times

Nine screens are grids. They get **one component**, not nine implementations.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [🔍 search this grid……]      [Columns] [Group by] [Export]          │
├─────────────────────────────────────────────────────────────────────┤
│ FILTERS  (Dept: Engineering ×) (Year: 2026 ×) (Votes ≥10 ×) Clear all│
├──────────┬─────────┬──────────────┬──────────┬────────┬─────────────┤
│ PERIOD ↓¹│ AWARD ↕ │ WINNER ↕     │ DEPT ↕ ⚑ │VOTES ↑²│ ANNOUNCED ↕ │
├──────────┼─────────┼──────────────┼──────────┼────────┼─────────────┤
│ Sep 2026 │ Month   │ ● ▁▁▁▁▁▁▁▁   │ ▁▁▁▁▁    │   24   │ 03 Oct 2026 │
│ Aug 2026 │ Month   │ ● ▁▁▁▁▁▁▁▁▁▁ │ ▁▁▁▁     │   19   │ 02 Sep 2026 │
│ Jul 2026 │ Month   │ ● ▁▁▁▁▁▁     │ ▁▁▁▁▁▁   │   17   │ 04 Aug 2026 │
├──────────┴─────────┴──────────────┴──────────┴────────┴─────────────┤
│ Showing 1–25 of 41            [25 ▾]  [‹ Prev]  [Next ›]            │
└─────────────────────────────────────────────────────────────────────┘
        ↓ below 768px
┌──────────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ [Sort] [Filter ③] 🔍 │   │ ═══ Sort by ═══  │   │ Filters        × │
├──────────────────────┤   │ ◉ Period         │   │ Award type       │
│ SEP 2026     [Month] │   │ ○ Winner         │   │ ☑ Month ☐ Year   │
│ ● ▁▁▁▁▁▁▁▁▁▁▁▁       │   │ ○ Department     │   │ Date range       │
│ 24 votes · 9.1 avg ›│   │ ○ Votes          │   │ [ from ]–[ to ]  │
├──────────────────────┤   │ [Newest][Oldest] │   │ Department       │
│ AUG 2026     [Month] │   └──────────────────┘   │ ☑ Eng ☐ Design   │
│ ● ▁▁▁▁▁▁▁▁▁          │                          ├──────────────────┤
│ 19 votes · 8.8 avg ›│                          │ [Apply] [Reset]  │
└──────────────────────┘                          └──────────────────┘
```

**Design logic**

- **Every column sorts; every column filters**, with the control matched to the data type — text contains, enum multi-select with counts, number range, date range with presets, person search, boolean (`DG-1`, `DG-2`).
- **AND across columns, OR within one.** Stated in the UI, not left to be discovered.
- **Filter chips are non-negotiable.** The commonest support ticket in any grid product is "rows are missing" from a filter the user forgot. Chips with individual ✕ make the cause visible (`DG-6`).
- **Mobile keeps everything.** Cards replace the table, but Sort and Filter sheets expose every capability the desktop has. Dropping filters on small screens is the standard shortcut and this spec closes it (`DG-15`, `AC-13`).
- **Server-side above 200 rows.** Fetching everything and filtering in the browser breaks at scale and ships data the user may not be entitled to (`DG-9`).
- **Sort/filter column names are allow-listed.** A grid is a query builder pointed at your database — treat its input as hostile (`NF-9`).
- **Restricted columns are excluded server-side**, never hidden with CSS. A hidden column whose data is in the payload is a leak, not a permission (`DG-17`).

---

## 5. Screens

### 5.1 · Login — `6.1`

```
┌────────────────────────┬────────────────────────────────────────┐
│ ████ INDIGO PANEL ████ │                                        │
│                        │   Sign in                              │
│  ▣                     │   Use your work email address.         │
│                        │                                        │
│  Employee              │   ╭──────────────────────────────╮     │
│  Appreciation          │   │ ⚠ Email or password is wrong │ROSE │
│  Portal                │   ╰──────────────────────────────╯     │
│                        │                                        │
│  ▁▁▁▁▁▁▁▁▁▁▁▁          │   Work email                           │
│  ▁▁▁▁▁▁▁▁              │   [                              ]     │
│                        │   Password                             │
│                        │   [                        ] Show      │
│  ──────────────        │                                        │
│  Internal use only     │   ☐ Remember me      Forgot password?  │
│                        │   [        Sign In        ] ← INDIGO   │
└────────────────────────┴────────────────────────────────────────┘
  MOBILE: panel drops away entirely, form goes full-bleed, 16px gutters
```

**Design logic**

- **The brand panel is the one large colour field in the product.** Login is the only screen with nothing to read, so it can carry a saturated blue block without competing with content. Everywhere else, blue appears in ≤ 5% of the viewport.
- The form is capped at **420px** even on a 1920px monitor. A 900px-wide email field looks broken and scans badly.
- **One generic failure message** — never "no such user". The form must not confirm whether an address is registered (`R-6.1.3`).
- **Lockout is stated with its duration**, not an unexplained refusal: 5 failures per account per 15 minutes (`R-6.1.4`).
- On mobile the fields are **16px** — anything smaller makes iOS zoom the viewport on focus, which feels like a bug (`RR-4`).
- Success returns the user to the **deep link they asked for**, not blindly to the Dashboard.

---

### 5.2 · Dashboard — `6.3`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ████ INDIGO BANNER ██████████████████████████████████████████████████████│
│  Good morning, Ganesh                                                    │
│  Voting for September 2026 closes in 3 days — you haven't voted yet.     │
│                                              [   Vote Now   ]            │
└──────────────────────────────────────────────────────────────────────────┘
┌───────────────┬───────────────┬───────────────┬────────────────────────┐
│ CURRENT CYCLE │ YOUR STATUS   │ PARTICIPATION │ YOU RECEIVED           │
│ September 2026│ Not submitted │     68%       │      7                 │
│ ●sage Open ·  │ draft saved   │ 82 of 120     │ votes · 8.9 avg        │
│ closes 3d 4h ⚠│               │ ▓▓▓▓▓▓▓░░░    │                        │
└───────────────┴───────────────┴───────────────┴────────────────────────┘
┌─────────────────────────────────────┬────────────────────────────────┐
│ ┌─────────────┐ ┌─────────────┐     │ ╭──── GETTING STARTED ───────╮ │
│ │◆ EoM AUGUST │ │◆ EoY 2025   │     │ │  ◔ 3 of 12                 │ │
│ │ ● ▁▁▁▁▁▁    │ │ ● ▁▁▁▁▁▁    │plum│ │  Next: Voting for EoM 3min │ │
│ │ View work → │ │ View work → │     │ │  [ Start the 5-min tour ]  │ │
│ └─────────────┘ └─────────────┘     │ ╰────────────────────────────╯ │
│ ┌─────────────────────────────────┐ │ ┌────────────────────────────┐ │
│ │ YOUR APPRECIATION · 6 MONTHS    │ │ │ RECENT FEEDBACK            │ │
│ │  ▁  ▃  ▂  ▅  ▄  █←blue        │ │ │ ● A colleague       9/10   │ │
│ │ Apr May Jun Jul Aug Sep         │ │ │ ▁▁▁▁▁▁▁▁▁▁▁▁               │ │
│ └─────────────────────────────────┘ │ │ ▓▓ Sep feedback appears ▓▓ │ │
│ ┌─────────────────────────────────┐ │ │ ▓▓ once that cycle closes▓▓│ │
│ │ HALL OF FAME  ● ● ● ● ● ●  →    │ │ └────────────────────────────┘ │
│ └─────────────────────────────────┘ │ ┌ ANNOUNCEMENTS ─────────────┐ │
└─────────────────────────────────────┴─┴────────────────────────────┴─┘
```

**Design logic**

- **One call to action, not a menu of them.** The banner states the single most urgent thing with its deadline and one button. After voting it changes to "Your vote is in — editable until 30 Sep, 6:00 PM." A dashboard that offers six equal options gets none of them done.
- **The banner is the only blue field** on this screen; the four tiles stay white with coloured *values*. Colouring all four would flatten the hierarchy the banner just established.
- **Participation is a count, never a standing.** While a cycle is open no per-nominee number may reach an employee — not in the UI, and not in any API response their role can call (`R-6.3.1`, `BR-5`). This is the rule most likely to be broken by a well-meaning "show top 3" addition.
- **Bronze on the countdown, sage on "Open"** — the two facts a voter acts on, separated by hue.
- **The hatched feedback block is deliberate.** Rather than hiding withheld content, the Dashboard shows that something exists and says when it will appear. Silence reads as a bug; an explained absence reads as a rule.
- **Getting Started disappears permanently** once the onboarding playlist is done. Persistent onboarding becomes furniture people stop seeing.
- Mobile: tiles go to a 2×2 compact grid, the chart drops to 3 months with a table fallback (`RR-14`).

---

### 5.3 · Vote — Employee of the Month — `6.4`

```
┌────────────────────────────────────────────────┬───────────────────────┐
│ September 2026                                 │ YOUR VOTE SO FAR      │
│ Open · closes 30 Sep, 6:00 PM IST   [3d 4h]⚠  │ Nominee     Chosen    │
├────────────────────────────────────────────────┤ Reason      Done      │
│ 1 · Who are you voting for?                    │ Comparison  Too short │
│ ┌────────────────────────────────────────────┐ │ Suggestion  Empty     │
│ │ ●  ▁▁▁▁▁▁▁▁▁▁▁▁              Change        │ │ Rating      9 / 10    │
│ └────────────────────────────────────────────┘ │ ───────────────────── │
│ ▓▓ Your own name is not in this list ▓▓        │ BEFORE YOU SUBMIT     │
│                                                │ Your name is never    │
│ 2 · Reason for voting                          │ shown to the person   │
│ What did they actually do this month?          │ you vote for.         │
│ ┌────────────────────────────────────────────┐ │                       │
│ │                                            │ │ Admins can see who    │
│ └──────────────────────────── 142/1000 ──────┘ │ voted, for audit only.│
│                                                │                       │
│ 3 · Why better than others this month          │ You can change or     │
│ ┌────────────────────────────────────────────┐ │ withdraw until close. │
│ │                                            │ │                       │
│ └───────── ⚠ at least 30 characters ─────────┘ │ Results stay hidden   │
│                                                │ until then.           │
│ 4 · One suggestion for them                    │ ───────────────────── │
│ ┌────────────────────────────────────────────┐ │ ▷ How voting works    │
│ └──────────────────────────── 0/500 ─────────┘ │   3 min               │
│                                                │                       │
│ 5 · Rating out of 10                           │                       │
│  [−]  ●────────────────────────○──  [+]   9    │                       │
│        1  2  3  4  5  6  7  8  9  10           │                       │
│                                                │                       │
│ ☐ 6 · I confirm this is my honest assessment.  │                       │
│ [ Submit Vote ]  [ Save Draft ]   saved 11m ago│                       │
└────────────────────────────────────────────────┴───────────────────────┘

MOBILE — nominee picker is a FULL-SCREEN SHEET, not a dropdown
┌──────────────────────┐   ┌──────────────────────┐
│ Choose a colleague × │   │ September 2026       │
│ [🔍 Search by name ] │   │ closes in 3d 4h      │
├──────────────────────┤   ├──────────────────────┤
│ ● ▁▁▁▁▁▁▁▁      ◉   │   │ Nominee  ● ▁▁▁▁▁▁    │
│ ● ▁▁▁▁▁▁            │   │ Reason  [          ] │
│ ● ▁▁▁▁▁▁▁▁▁         │   │ Why better [       ] │
│ ● ▁▁▁▁▁▁            │   │ Suggestion [       ] │
├──────────────────────┤   │ Rating [−]══○══[+] 9│
│ [     Select     ]   │   ├──────────────────────┤
└──────────────────────┘   │ [   Submit Vote   ]  │ ← sticky
                           └──────────────────────┘
```

**Design logic**

- **The form is the product.** Everything competing for attention has been moved to the right rail, and the rail carries no colour. A person writing an honest appraisal of a colleague should not be visually hurried.
- **Numbered steps 1–6.** Six required inputs is a lot; numbering converts an intimidating wall into a countable task and makes "what's left" answerable at a glance.
- **Helper text sits above each field, not in the placeholder.** Placeholders vanish the moment you type — exactly when you need the prompt. This also keeps labels programmatically associated (`A-3`).
- **Live summary rail, not a progress bar.** It names which field is incomplete and why ("Comparison — too short"), so the user never hunts. A percentage tells you nothing actionable.
- **The self-vote exclusion is shown, not silent.** A user who looks for their own name and cannot find it will assume a bug; one line removes the doubt. Enforced three times over regardless — absent from the list, rejected by the server, forbidden by a DB constraint (`R-6.4.2`, `IR-1`).
- **The anonymity disclosure is on the form itself**, at the moment of decision — including the admin caveat. Burying it in Help would make the promise misleading (`R-4.1`).
- **The rating is a slider with −/+ steppers and a large numeral.** Sliders are unusable precisely on touch; the steppers make 44px targets available without abandoning the at-a-glance scale (`RR-3`).
- **The countdown is decoration.** The server clock decides whether a submission is accepted, and if the window shuts mid-session the typed text is preserved and the user is told plainly (`R-6.4.1`, `R-6.4.9`).
- **Draft ≠ vote.** Autosaves every 20s, stays private, never counts, and is discarded as non-participation if never submitted (`R-6.4.6`).

---

### 5.4 · Vote — Employee of the Year — `6.5`

```
┌──────────────────────────────────────────────────────────────┐
│ 2026 · Employee of the Year              [ YEAR AWARD ]plum│
│ Opens 1 Dec 9:00 AM · closes 31 Dec 6:00 PM IST              │
├──────────────────────────────────────────────────────────────┤
│ ℹ Candidate pool is a setting: any active employee (default) │
│   or only this year's twelve monthly winners.       OQ-3     │
│                                                              │
│ 1 · Nominee          [ ● Search all active employees…      ] │
│ 2 · Reason                                       30–1000     │
│ ╔══════════════════════════════════════════════════════════╗ │
│ ║ 3 · Why they are the best of the ENTIRE year             ║ │
│ ║ Evidence across the whole year, not one good month.      ║ │
│ ║ [                                                      ] ║ │
│ ║                            minimum 50 characters         ║ │
│ ╚══════════════════════════════════════════════════════════╝ │
│ 4 · One suggestion                                20–500     │
│ 5 · Rating  [−]══════════════════○ [+]  10                   │
│ ┌ 6 · Standout contribution of the year — optional ────────┐ │
│ │ Feeds the citation on their Hall of Fame card if they win│ │
│ └──────────────────────────────────────────── 0/800 ───────┘ │
│ ☐ 7 · I confirm this is my honest assessment.                │
└──────────────────────────────────────────────────────────────┘
```

**Design logic**

- **Field 3 is boxed and given a higher minimum — 50 characters against 30.** A year-level claim should cost more to make than a month-level one. The heavier border is the only structural difference from the month form, and it is the difference that matters.
- **Dashed border on field 6 marks it optional** without adding the word "optional" four times. Optional fields inside a required form are a common source of abandonment.
- **Field 6 earns its place** by feeding the winner's Hall of Fame citation — voters write better copy than admins do afterwards, because they were there.
- **Month and year votes are independent records.** If both cycles are open the Dashboard shows two separate calls to action rather than one ambiguous "Vote" (`6.5`).

---

### 5.5 · My Votes — `6.6`

```
┌───────────────────────────────────────────────────────────────────────┐
│ [🔍 search by nominee…]  [Award ▾] [Year ▾] [Status ▾] [Columns]      │
├──────────┬───────┬──────────────┬────────┬────────────┬───────────────┤
│ CYCLE ↕  │AWARD ↕│ NOMINEE ↕    │RATING ↕│ STATUS ↕   │ SUBMITTED ↓   │
├──────────┼───────┼──────────────┼────────┼────────────┼───────────────┤
│ Sep 2026 │ Month │ ● ▁▁▁▁▁▁     │   9    │ ●Submitted │ 27 Sep   Edit │
│ Aug 2026 │ Month │ ● ▁▁▁▁▁▁▁▁   │   8    │  Locked    │ 26 Aug   View │
│ 2025     │ Year  │ ● ▁▁▁▁▁▁▁    │   9    │  Locked    │ 18 Dec   View │
│ Jun 2026 │ Month │ ● ▁▁▁▁▁      │   —    │ ○Withdrawn │    —     View │
└──────────┴───────┴──────────────┴────────┴────────────┴───────────────┘
 ▸ expand → all three written answers + your own edit history
```

**Design logic**

- **Status is the column that does the work**, so it carries the colour: sage Submitted, slate Locked, muted Withdrawn. Everything else stays neutral.
- **Locked rows disable Edit with the reason visible** — "Voting closed 31 Aug" — rather than removing the button. A missing control reads as a bug; a disabled one with a reason reads as a rule (`R-6.6.2`).
- **Only your own votes, ever.** This screen has no filter, view or export that could surface another person's vote (`R-6.6.1`).
- Mobile becomes cards with the nominee as the headline and rating as a chip — never a squeezed table (`RR-6`).

---

### 5.6 · Feedback for Me — `6.7`

```
┌────────────────────┬──────────────────────────────────────────────────┐
│ ALL TIME           │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│  31      8.7       │ ▓ September 2026 — not yet visible              ▓ │
│  votes   average   │ ▓ Feedback appears once the cycle closes AND at ▓ │
│  10      7         │ ▓ least 3 colleagues have voted. You have 2.    ▓ │
│  best    cycles    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ◆ EoM March 2026   │                                                  │
│ ─────────────────  │ ┌───────────────────┐ ┌───────────────────┐      │
│ RATING SPREAD      │ │ ● A colleague 9/10│ │ ● A colleague10/10│      │
│  ▁▁▁▂▃▄▆█▇         │ │ August · Month    │ │ August · Month    │      │
│  1       10        │ │ REASON            │ │ REASON            │      │
│ ─────────────────  │ │ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁    │ │ ▁▁▁▁▁▁▁▁▁▁▁       │      │
│ FILTER             │ │ WHY BETTER        │ │ WHY BETTER        │      │
│ [Cycle      All ▾] │ │ ▁▁▁▁▁▁▁▁▁▁        │ │ ▁▁▁▁▁▁▁▁▁▁▁▁▁     │      │
│ [Award      All ▾] │ │ ┃AMBER────────────│ │ ┃AMBER────────────│      │
│ [Rating    1–10 ▾] │ │ ┃ SUGGESTION      │ │ ┃ SUGGESTION      │      │
│ [Sort    Newest ▾] │ │ ┃ ▁▁▁▁▁▁▁▁▁       │ │ ┃ ▁▁▁▁▁▁▁         │      │
│                    │ │ 26 Aug     Report │ │ 24 Aug     Report │      │
│ [Download PDF]     │ └───────────────────┘ └───────────────────┘      │
└────────────────────┴──────────────────────────────────────────────────┘
```

**Design logic**

- **The suggestion is visually separated from the praise** — bronze left bar, tinted ground. Praise is pleasant and gets read; the suggestion is the part that makes someone better and is the part people skim past. Structure fixes that; asking nicely does not.
- **"A colleague" with a generic avatar**, never an initial, never a department. On a small team a department label identifies a person as surely as a name does (`R-6.7.1`).
- **The threshold block is the most important element on the screen.** Feedback appears only once the cycle has **closed** *and* the nominee has at least **3** votes in it. A single anonymous vote on a four-person team is not anonymous — the nominee can deduce the author from the fact that it exists. Without this rule the anonymity promise is decoration (`R-6.7.2`).
- **And it is not merely a UI rule.** The API response backing this page carries no voter identifier in any form (`NF-10`, `AC-4`).
- **Summary stats lead with volume and average, not rank.** This page is about a person's own growth, not their standing against colleagues.
- **Report is quiet but present** on every card — visible enough to use, subdued enough not to suggest that abuse is expected (`R-6.7.4`).

---

### 5.7 · Results & Leaderboard — `6.8`

```
WHILE OPEN — EMPLOYEE                    WHILE OPEN — ADMIN / AUDITOR
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ [Month ▾] [September 2026 ▾] │        │ ███ CONFIDENTIAL — PRE-CLOSE │
├──────────────────────────────┤        ├──────────────────────────────┤
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│        │ #  NOMINEE      VOTES↓  AVG  │
│▓  Results are hidden until  ▓│        │ 1  ● ▁▁▁▁▁▁      24    9.1   │
│▓  voting closes on 30 Sep   ▓│        │ 2  ● ▁▁▁▁▁▁▁▁    19    8.8   │
│▓                            ▓│        │ 3  ● ▁▁▁▁▁       14    9.3   │
│▓  Nobody can see who is     ▓│        │ 4  ● ▁▁▁▁▁▁▁     11    8.2   │
│▓  leading. This is          ▓│        ├──────────────────────────────┤
│▓  deliberate.               ▓│        │ Excluded from every employee │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│        │ API response, not just hidden│
│ PARTICIPATION  68%  82/120   │        └──────────────────────────────┘
│ ▓▓▓▓▓▓▓░░░                   │
└──────────────────────────────┘

AFTER CLOSE — PUBLISHED
┌──────────────────────────────────────────────────────────────────────┐
│ ████ VIOLET WINNER BANNER ███████████████████████████████████████████│
│  ●    EMPLOYEE OF THE MONTH · AUGUST 2026            19  votes       │
│ ●●●   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁                                8.8 avg        │
│       ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁                 [ View their work ]    │
└──────────────────────────────────────────────────────────────────────┘
│ RANK↑ │ EMPLOYEE      │ DEPARTMENT │ VOTES↕ │ AVG↕  │ SCORE↕ │
│  ①    │ ● ▁▁▁▁▁▁▁▁▁   │ ▁▁▁▁▁      │  19    │ 8.8   │ 167.2  │
│  ②    │ ● ▁▁▁▁▁▁▁     │ ▁▁▁▁       │  17    │ 9.0   │ 153.0  │
│  ③    │ ● ▁▁▁▁▁▁▁▁▁▁  │ ▁▁▁▁▁▁     │  12    │ 8.4   │ 100.8  │
```

**Design logic**

- **The same cycle renders two completely different screens by role.** Drawing them side by side is the point: the hidden-results rule is a *product behaviour*, not a permission checkbox, and it must be visible in the design review.
- **The hidden state explains itself.** "Results are hidden" alone invites workaround requests; naming the reason — visible standings change how people vote — pre-empts them.
- **Plum is reserved for the winner banner.** The first time a user sees plum at full strength is the moment an award is announced, which is exactly the association the palette is buying.
- **The pre-close admin view is watermarked.** Anyone who screenshots it should be unable to pass it off as a result.
- **The tie-break ladder is published, not internal**: votes → average rating → count of 9s and 10s → earliest first vote → admin decision in writing into the audit log. Ties will happen in a 120-person company, and a rule announced afterwards always looks invented (`R-6.8.2`).
- **Frozen at close.** The tally is snapshotted the moment the window shuts; later corrections cannot silently rewrite a published result (`R-6.8.4`, `BR-9`).
- **An admin override never rewrites the leaderboard.** The computed order stands, and the override is recorded as a decision (`R-6.17.1`).

---

### 5.8 · Winners Report — `6.9`

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Month-wise][Year-wise][Date-wise][All Awards]  [Group: Year][Export▾]  │
├─────────────────────────────────────────────────────────────────────────┤
│ ╔═══════════════════════════════════╗                                   │
│ ║ Dates read from:                  ║  [01 Jan 2026]–[31 Dec 2026]      │
│ ║ [Announcement date][Award period] ║  (This year)(Last year)(Last 12m) │
│ ╚═══════════════════════════════════╝                                   │
│ FILTERS (Year 2026 ×) (Award: Month ×) (Dept: Eng, Design ×) Clear all   │
├───────────┬───────────┬───────────┬───────────┬──────────┬──────────────┤
│ AWARDS  9 │ WINNERS 8 │ REPEAT  1 │ TOP DEPT  │ AVG 17.4 │ PART.  71%   │
├───────────┴───────────┴───────────┴───────────┴──────────┴──────────────┤
│ ▾ 2026 · 9 awards                                                       │
│ YEAR↕│MON↓│AWD↕│ WINNER ↕     │DEPT↕│VOTES↕│AVG↕│ANNOUNCED↕│DECISION*↕ │
│ 2026 │Sep │Mon │ ● ▁▁▁▁▁▁▁    │▁▁▁▁ │  24  │9.1 │03 Oct 26 │ Auto      │
│ 2026 │Aug │Mon │ ● ▁▁▁▁▁▁▁▁▁  │▁▁▁  │  19  │8.8 │02 Sep 26 │ Auto      │
│ 2026 │Jul │Mon │ ● ▁▁▁▁▁▁     │▁▁▁▁ │  17  │9.0 │04 Aug 26 │ Override  │
│ 2026 │Apr │Mon │ ⚠ No award — cycle closed with no valid votes          │
│ 2026 │May │Mon │ ● ▁▁▁▁▁▁▁    │▁▁▁▁ │  21  │9.2 │03 Jun 26 │ Tie resolv│
│ 2025 │ —  │YEAR│ ● ▁▁▁▁▁▁▁▁   │▁▁▁  │  58  │9.4 │05 Jan 26 │ Auto      │
└─────────────────────────────────────────────────────────────────────────┘
                                                * admin-only columns
```

**Design logic**

- **Four views over one grid, not four screens.** Month-wise, Year-wise, Date-wise and All Awards differ only in default grouping, sort and visible columns. Building them as separate pages would triple the maintenance and guarantee they drift apart.
- **The date-basis toggle is the single most important control on this screen, so it is boxed and placed above the filters.** The September winner was announced on 3 October. Filter October by *announcement date* and they appear; by *award period* and they do not. Both readings are legitimate for different questions — "what did we announce in Q4" versus "who won in Q3" — so the report refuses to guess, labels the active basis on screen, and writes it into every export header (`R-6.9.3`, `AC-11`).
- **A month with no award gets a row that says so** in bronze, rather than being omitted. An absent month must look absent; silent omission reads as a data-loss bug and cannot be distinguished from one (`R-6.9.5`).
- **The summary strip recalculates with the filters.** Numbers that ignore the active filter are worse than no numbers.
- **Admin-only columns are shaded** so an admin sharing their screen knows what a colleague cannot see — and they are excluded server-side for everyone else (`DG-17`).
- **Figures are read from frozen records, never recomputed.** Two people running this report on different days must see identical history (`R-6.9.2`).
- **Leavers keep their rows, badged Inactive.** Awards are permanent; a resignation does not retract one (`R-6.9.4`, `BR-13`).
- **Export mirrors the view exactly** — same rows, order, and visible columns — with a header recording filters, date basis, user and timestamp (`R-6.9.6`, `AC-14`).

---

### 5.9 · Hall of Fame — `6.10`

```
┌─────────────────────────────────────────────────────────────┐
│ [Year All ▾] [Award All ▾] [Department ▾]      [Grid][Time] │
├──────────────┬──────────────┬──────────────┬────────────────┤
│╔════════════╗│┌────────────┐│┌────────────┐│┌──────────────┐│
│║    ●●●     ║││     ●●     │││     ●●     │││      ●●      ││
│║ [YEAR 2025]║││ [SEP 2026] │││ [AUG 2026] │││  [JUL 2026]  ││
│║ ▁▁▁▁▁▁▁▁   ║││ ▁▁▁▁▁▁▁▁   │││ ▁▁▁▁▁▁     │││  ▁▁▁▁▁▁▁▁    ││
│║ ▁▁▁▁▁      ║││ ▁▁▁▁▁      │││ ▁▁▁▁▁▁▁    │││  ▁▁▁▁▁       ││
│║ 58 votes   ║││ 24 votes   │││ 19 votes   │││  17 votes    ││
│╚════════════╝│└────────────┘│└────────────┘│└──────────────┘│
│  plum, 2px │              │              │                │
└──────────────┴──────────────┴──────────────┴────────────────┘
       4 cols ≥1280 · 3 at 1024 · 2 at 768 · 1 on mobile
```

**Design logic**

- **This screen is celebration, not reporting** — and it is deliberately separate from the Winners Report, which answers the same question in a form you can filter and export. One screen doing both jobs does neither well (`§5.1`).
- **Employee of the Year gets a heavier plum frame.** Rank by visual weight, not by sort order, because this page is browsed rather than read.
- **Photos are large and first.** A grid of names is a directory; a grid of faces is a wall of honour.
- Inactive winners stay, badged. Removing a leaver from the Hall of Fame would rewrite history and is explicitly forbidden (`R-6.18.3`).

---

### 5.10 · Work Showcase — `6.11`

```
┌────────────────────────────────────────────────┬──────────────────┐
│ ███ VIOLET HEADER ████████████████████████████│ ON THIS PAGE     │
│  ●  EMPLOYEE OF THE MONTH · AUGUST 2026       │ ┃Citation        │
│ ●●● ▁▁▁▁▁▁▁▁▁▁       [‹ Prev]  [Next ›]       │  Impact          │
├────────────────────────────────────────────────┤  Write-up        │
│ ┃ CITATION                                     │  Demo video      │
│ ┃ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁              │  Gallery         │
│ ┌──────────┬──────────┬──────────┐             │  Documents       │
│ │   42%    │    3     │    0     │             │  What colleagues │
│ │ faster   │ teams    │incidents │             │  said            │
│ └──────────┴──────────┴──────────┘             │ ──────────────── │
│ WRITE-UP  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁              │ ● A colleague    │
│ ┌─────────────────────┬───────────────┐        │ ▁▁▁▁▁▁▁▁▁▁       │
│ │  ▶  VIDEO      [CC] │ ▣ ▣           │        │ ● A colleague    │
│ │                     │ ▣ +4          │        │ ▁▁▁▁▁▁▁          │
│ └─────────────────────┴───────────────┘        │                  │
│ [📄 PDF 2.1MB] [📄 Slides 5.4MB] [🔗 Repo]     │ Signed URLs only │
└────────────────────────────────────────────────┴──────────────────┘
```

**Design logic**

- **Impact metrics come before the write-up.** Most viewers will read three numbers and leave. Putting the evidence above the prose respects that and still rewards the reader who continues.
- **Blocks are composed by an admin**, not a fixed template — rich text, gallery, video, documents, links, metrics, quotes — because the shape of good work varies and a rigid template produces padded entries.
- **Publishing is blocked until every image has alt text.** Accessibility enforced at creation, not audited afterwards. Retrofitting alt text to a year of showcases never happens (`R-6.11.5`).
- **Captioned video, and a transcript.** A person watching without sound in an open-plan office is the normal case, not the exception.
- **Files are served only to signed-in users through short-lived signed URLs**, never from a guessable path (`R-6.11.4`).
- Mobile: gallery becomes a swipe carousel, documents become download cards rather than inline previews, metrics go 2-up.

---

### 5.11 · Video Tutorials — `6.14`

```
LIBRARY                                  PLAYER
┌───────────────────────────────┐  ┌──────────────────────────────────┐
│ ███ SKY ██████████████████████│  │ Voting for Employee of the Month │
│ ◔ New here? Start the 5-min   │  │ ┌──────────────────┬───────────┐ │
│   tour · 3 of 12  [Continue]  │  │ │                  │TRANSCRIPT │ │
├───────────────────────────────┤  │ │       ▶          │0:00 ▁▁▁▁▁ │ │
│ [🔍 search titles + transcripts]  │ │  "Pick the       │0:26 ▁▁▁▁▁ │ │
│                               │  │ │   colleague…"    │1:18 ▁▁▁▁▁◄│ │
│ GETTING STARTED               │  │ │  ═══════●═══ CC  │1:52 ▁▁▁▁▁ │ │
│ ▣ Welcome            ✓ 1:40   │  │ └──────────────────┴───────────┘ │
│ ▣ Signing in         ✓ 2:05   │  │ ℹ Narration in this video is     │
│ ▣ The Dashboard   ▓▓░ 2:48    │  │   AI-generated.   [Resume 1:24]  │
│ VOTING                        │  └──────────────────────────────────┘
│ ▣ Vote for EoM       ← next   │  ADMIN — TUTORIAL LIBRARY
│ ▣ Vote for EoY         2:10   │  ┌──────────────────────────────────┐
│ ▣ Edit / withdraw      1:35   │  │ TITLE        STATUS      DONE    │
│ YOUR FEEDBACK                 │  │ ▁▁▁▁▁▁▁▁     ●Live       94%     │
│ ▣ How anonymity works         │  │ ▁▁▁▁▁▁       ●Live       89%     │
│   [ REQUIRED ]        2:14    │  │ ▁▁▁▁▁▁▁      ⚠Stale      61%     │
└───────────────────────────────┘  │ ▁▁▁▁▁         Draft       —      │
                                   └──────────────────────────────────┘
```

**Design logic**

- **The onboarding playlist is a single banner with a progress ring, not a checklist.** A new joiner should see one button, not twelve. The ring shows progress without demanding a decision.
- **The anonymity video is marked REQUIRED** and is the only one that is. The anonymity model has a subtlety — nominees cannot see voters, admins can — and relying on people to read a Help page is not disclosure (`R-4.1`).
- **The transcript sits beside the video, searchable, click-to-seek.** Most people looking for "how do I withdraw my vote" want one sentence, not a 3-minute video. The transcript turns a linear medium into a searchable one.
- **Captions are generated from the narration script, never by transcribing the generated audio.** You already have the exact text; running speech-to-text over your own synthetic speech manufactures errors you did not need (`R-6.14.2`).
- **The script is the source of truth and is version-controlled with the video.** When a feature changes you edit the script and *regenerate* the audio. That is the entire economic argument for a synthetic voice; a pipeline that loses it has bought nothing over hiring a narrator (`R-6.14.1`).
- **The AI narration is disclosed plainly** on the player and the library card (`R-6.14.5`).
- **No real employee data in any recording.** All footage uses a documented demo seed dataset with fictitious people. A tutorial is watched by everyone, forever — filming a real voting screen would publish real names, real votes and real private feedback into a permanent internal artefact, and would quietly break the anonymity model the rest of the product defends (`R-6.14.6`, `AC-17`).
- **Videos go stale on purpose.** Each is stamped with the app version it was recorded against; when a covered screen changes it is badged for viewers and queued for re-recording. An unmaintained tutorial library is worse than none, because it teaches the wrong thing confidently (`R-6.14.7`).
- **Watch data never leaves onboarding.** It drives resume-playback and the progress ring, and is explicitly barred from appraisal or any ranking report. Left unfenced, "who completed their training" becomes a performance metric in somebody's review (`R-6.14.11`, `BR-16`).
- Completion registers at **90%**, not 100% — nobody sits through the outro.

---

### 5.12 · Notifications · Help · Profile — `6.12` `6.13` `6.15`

```
NOTIFICATIONS                     HOW IT WORKS              MY PROFILE
┌────────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
│ Notifications  [4 new] │  │ ┃ROSE──────────────  │  │ ●●  ▁▁▁▁▁▁▁▁     │
│ ● You won EoM          │  │ ┃ WHO CAN SEE YOUR   │  │ ●●  ▁▁▁▁▁        │
│   August 2026          │  │ ┃ VOTE               │  │ Display name [ ] │
│ ● New feedback avail.  │  │ ┃                    │  │ Designation  [ ] │
│ ● Voting for Sep open  │  │ ┃ The person you vote│  │ Department ·HR ro│
│ ● 3 days left, not     │  │ ┃ for sees your      │  │ ──────────────── │
│   voted                │  │ ┃ reason and rating  │  │ EMAIL ALERTS     │
│ ○ Showcase published   │  │ ┃ but NEVER your name│  │ ▣ Cycle opened 🔒│
│ ○ Your vote submitted  │  │ ┃                    │  │ ▣ Reminders      │
└────────────────────────┘  │ ┃ Administrators CAN │  │ ▢ New tutorial   │
                            │ ┃ see who voted for  │  │ ▣ Winner pub.  🔒│
                            │ ┃ whom, for audit.   │  │ Theme [L][D][Sys]│
                            │ ┃──────────────────  │  │ ◆ EoM March 2026 │
                            └──────────────────────┘  └──────────────────┘
```

**Design logic**

- **No notification may leak standings.** "You received a vote" is withheld until the cycle closes — an innocuous-looking message that would otherwise let an attentive person infer the leaderboard from the timing and frequency of their own alerts (`R-6.12.1`).
- **Security and award emails cannot be muted;** everything else can. Silencing "voting is open" would let someone opt out of the programme by accident (`R-6.12.2`).
- **The anonymity disclosure on Help is given the clay treatment** — the only place clay is used for something that is not an error. This is the product's honesty test, and it is stated in two short paragraphs rather than a policy wall.
- **Locked notification toggles show a lock icon**, not a hidden row, so the user can see the full set and understand which are mandatory.

---

### 5.13 · Admin — Voting Cycles & Publish Winners — `6.16` `6.17`

```
CYCLES                                       LIFECYCLE
┌──────────────────────────────────────┐    Draft → Open → Closed →
│[+ Create][Type▾][Status▾][Year▾]     │    Tallied → Published
│ TYPE │PERIOD  │OPENS↓   │STATUS      │    branches: Tie·Cancelled·
│ Month│Oct 2026│01 Oct 09│ Draft      │    Reopened·Unpublished
│ Year │2026    │01 Dec 09│ Draft      │
│ Month│Sep 2026│01 Sep 09│ ●OPEN sage │    PUBLISH WINNERS
│ Month│Aug 2026│01 Aug 09│ ●Published │    ┌──────────────────────────┐
│ Month│Jul 2026│01 Jul 09│ ⚠Tie—decide│    │①Tally ②Citation ③Quotes │
│ Month│May 2026│01 May 09│  Cancelled │    │④Showcase ⑤Preview [Pub] │
└──────────────────────────────────────┘    ├──────────────────────────┤
 actions: Edit·Open now·Close now·Extend·   │ COMPUTED WINNER [FROZEN] │
          Cancel·Recompute tally            │ ● ▁▁▁▁▁  19 votes  8.8   │
                                            │              [Override]  │
                                            │ CITATION  required 50–1000│
                                            │ [                      ] │
                                            │ ⚠ Cannot publish: citation│
                                            │   empty, 2 images lack alt│
                                            └──────────────────────────┘
```

**Design logic**

- **Status colour carries the whole table.** Sage Open, plum Published, bronze Tie, muted Draft and Cancelled. An admin scanning twelve cycles needs to find the one demanding action in under a second.
- **A five-step publish flow, not one long form.** Publishing a winner is a considered, infrequent act with an irreversible social consequence. Steps create natural review points; a single scroll invites a premature Publish click.
- **The computed winner is labelled FROZEN.** Publishing must never look like it recalculates anything (`R-6.8.4`).
- **Override is available but expensive** — it demands a typed justification, is written to the audit log, is visible to Auditors, and surfaces in the Winners Report's Decision column. Easy to do, impossible to do quietly (`R-6.17.1`).
- **The blocked-publish message names every missing item at once**, rather than failing one at a time.
- **Reopening a closed cycle requires a typed reason, notifies everyone, and invalidates the frozen tally.** It is drawn as an exception path, not a button of equal weight (`R-6.16.4`).
- **A cycle cannot open with fewer than 3 active employees** — anonymity would be arithmetically impossible (`R-6.16.5`).

---

### 5.14 · Admin — Employee Directory & Settings — `6.18` `6.21`

```
┌───────────────────────────────────────────────┬──────────────────────┐
│ ℹ This screen depends on OQ-2. Drawn as admin-│ SYSTEM SETTINGS      │
│   managed with CSV import. If employee data   │ Timezone  Asia/Kolkata│
│   comes from an HR system, these controls go  │ Domains   isgesolut… │
│   read-only and a sync panel replaces them.   │ Votes/cycle        1 │
├───────────────────────────────────────────────┤ Self-vote  🔒LOCKED  │
│ [+ Add][Import CSV][Export] [🔍][Dept▾][Role▾]│ Edit til close 🔒ON  │
│  │CODE  │NAME      │EMAIL    │ROLE  │STATUS   │ Results  🔒AFTER     │
│ ●│E-0293│▁▁▁▁▁▁▁▁  │▁▁▁▁▁▁▁  │Employ│●Active  │ Reveal count       3 │
│ ●│E-0655│▁▁▁▁▁▁▁▁▁ │▁▁▁▁▁▁▁▁ │ADMIN │●Active  │ EoY pool         all │
│ ●│E-1042│▁▁▁▁▁▁▁▁  │▁▁▁▁▁▁▁  │Audit │●Active  │ Cooldown           0 │
│ ●│E-0177│▁▁▁▁▁▁    │▁▁▁▁▁▁   │Employ│ Inactive│ Report visibility all│
└───────────────────────────────────────────────┤ Date basis announced │
 CSV DRY RUN: 120 read · 114 new · 4 updated ·  │ Audit retention   3y │
              ⚠ 2 rejected  [Download errors]   └──────────────────────┘
```

**Design logic**

- **The OQ-2 banner is drawn into the wireframe on purpose.** This screen is the largest unresolved fork in the project and the drawing should not pretend otherwise.
- **CSV import is a dry run first, always.** It reports what will be created, updated and rejected before writing anything. A half-imported directory during go-live week is a very bad afternoon.
- **Locked settings show a lock, not a hidden row.** An admin should see that self-voting exists as a concept and that it is deliberately disabled — hiding it invites the same question every six months.
- **No hard deletes anywhere.** Employees deactivate; their votes, feedback and awards survive intact and correctly attributed (`R-6.18.2`, `BR-11`).
- **Work email is immutable after creation** — it is the login identity. Correcting a typo is an explicit, audit-logged action, not an inline edit (`R-6.18.1`).
- **The system blocks removing the last active Admin, and an admin cannot change their own role.** Both prevent an unrecoverable lockout (`R-6.18.4`, `R-6.18.5`).

---

### 5.15 · Admin — Analytics & Audit Log — `6.19` `6.20`

```
ANALYTICS                                AUDIT LOG
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│[Participation][Nominee][Heatmap│  │[Actor▾][Action▾][Entity▾][Dates▾]  │
│ [Rating][Winners][Engagement]  │  │ TIMESTAMP↓ │ACTOR │ACTION          │
├────────────────────────────────┤  │ 02 Sep 11:04│▁▁▁▁ │⚠Winner pub —   │
│ 68%      71%      38      18   │  │             │Admin │ OVERRIDE       │
│ Sep     12-cyc  non-vote nomin │  │ 01 Sep 18:00│system│Cycle closed,   │
├────────────────────────────────┤  │             │      │tally frozen    │
│ PARTICIPATION · 12 CYCLES      │  │ 31 Aug 17:42│▁▁▁▁  │Vote edited v3  │
│ ▃▄▄▄▅▆▅▆▆▄▆▅ ←blue, Sep bronze│  │ 30 Aug 09:12│▁▁▁▁  │Emp deactivated │
├──────────────┬─────────────────┤  │ 29 Aug 14:33│▁▁▁▁  │Setting changed │
│ HEATMAP      │ RATING SPREAD   │  │ 28 Aug 11:07│▁▁▁▁  │Export w/ voter │
│    E D O F S │  ▁▁▂▃▄▆█▇       │  ├────────────────────────────────────┤
│ E █▓░░░      │ OUTLIER VOTERS  │  │ ▸ Computed  ● ▁▁▁▁   17 votes      │
│ D ▓█░░░      │ ▁▁▁ always 10   │  │   Published ● ▁▁▁▁▁  15 votes      │
│ O ░░█▓░      │ ▁▁▁ always 10   │  │   Reason    ▁▁▁▁▁▁▁▁▁▁▁▁▁▁         │
│ F ░░▓█░      │ ▁▁▁ never >6    │  └────────────────────────────────────┘
│ S ░░░▓█      │                 │
└──────────────┴─────────────────┘
```

**Design logic**

- **Analytics answers "is this programme healthy?"; the Winners Report answers "who won and when?".** Keeping them apart is why neither is a compromise. A single "Reports" screen would serve HR badly on both counts.
- **The heatmap's diagonal is the finding.** A dark diagonal means people mostly appreciate their own team — which is a fact about the organisation, not a bug in the tool, but one that a recognition programme's owner should know.
- **Outlier voters are surfaced without being punished.** Always-10 raters dilute the signal; naming them lets HR coach, not sanction.
- **The audit log's override row expands to show computed versus published side by side**, with the typed justification. This is the single most scrutinised record in the system and it should take one click, not a query (`AC-9`).
- **Append-only, no role can edit or delete**, three-year retention (`R-6.20.1`, `R-6.20.2`).
- **Exports containing voter identity are watermarked** so a forwarded spreadsheet carries its own warning (`R-6.19.2`).

---

## 6. States every screen must define

```
LOADING              EMPTY — NO DATA      EMPTY — FILTERED     ERROR
┌──────────────┐    ┌──────────────┐     ┌──────────────┐    ┌──────────────┐
│ ▒▒▒▒▒▒▒▒▒▒▒▒ │    │      ▣       │     │      ▣       │    │   ▣ clay     │
│ ▒▒▒▒  ▒▒▒▒   │    │ No cycle is  │     │ No rows match│    │ Couldn't load│
│ ▒▒▒▒▒▒▒▒     │    │ open now     │     │ your filters │    │ Data is safe │
│ ▒▒▒▒▒▒▒▒▒▒▒  │    │ Next: 1 Oct  │     │ 3 active →41 │    │ [Try again]  │
│ ▒▒▒▒▒▒       │    │[Past results]│     │[Clear filter]│    │ ref 9f3c-21ab│
└──────────────┘    └──────────────┘     └──────────────┘    └──────────────┘

OFFLINE                    403                      SESSION EXPIRED
┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐
│⚠ You are offline.│      │       ▣          │     │ Your session has │
│ Your vote is NOT │      │ You don't have   │     │ ended            │
│ submitted. Text  │      │ access to this   │     │ Your draft vote  │
│ saved on device. │      │ page             │     │ is saved         │
│ [Retry]          │      │ [Back to Dash]   │     │ [ Sign in ]      │
└──────────────────┘      └──────────────────┘     └──────────────────┘
```

**Design logic**

- **"Nothing matched your filter" and "there is no data" are different screens.** The first is a dead end the user can escape; the second is not. Collapsing them sends people hunting for a filter they never set (`DG-13`).
- **Skeletons, not spinners.** The shape of what is arriving is itself information, and it prevents the layout jump that a spinner guarantees.
- **Offline never loses written text.** Losing a carefully written vote to a dropped connection is the fastest way to ensure someone never votes again.
- **Errors carry a reference code, never a stack trace.** Support can act on `9f3c-21ab`; the user should not see a database message.
- **403 is a real page, not a redirect.** Silently bouncing someone to the Dashboard makes them think the link was broken and try again.
- Every state must hold at **320px with no horizontal page scroll** (`RR-2`, `AC-7`).

---

## 7. Responsive rules

| Rule | |
|---|---|
| `RR-2` | **No horizontal page scroll from 320px up.** A wide grid may scroll inside its own container; the page never moves |
| `RR-3` | Touch targets ≥ 44×44px, ≥ 8px apart |
| `RR-4` | Body text ≥ 16px on mobile — prevents iOS zoom-on-focus |
| `RR-6` | **Tables become cards below 768px**, keeping full sort and filter |
| `RR-8` | Modals become full-screen sheets below 768px; long forms get a sticky primary action |
| `RR-9` | Safe-area insets respected on notched devices |
| `RR-11` | Usable at 200% browser zoom |
| `RR-12` | Light and dark themes, following OS preference with a manual override |
| `RR-14` | Charts simplify below 768px and always expose a table fallback |

**Release gate:** iPhone SE 375 · iPhone 15 393 · Pro Max 430 · Pixel 412 · Galaxy 360 · iPad 768 · iPad Pro 1024 · Laptop 1366 · Desktop 1920 — portrait and landscape, on current Chrome, Safari, Edge, Firefox.

---

## 8. Build order

| Phase | Build | Why here |
|---|---|---|
| **P0** | Data model · auth · app shell & navigation · **the grid component** · settings | The grid must exist before any screen that uses it |
| **P1** | Cycles admin · Vote EoM · Vote EoY · My Votes · scheduler | Votes can be collected |
| **P2** | Tally engine · tie-break · Results · Feedback for Me + threshold · notifications | A cycle completes end to end |
| **P3** | Publish Winners · Hall of Fame · Work Showcase · Dashboard enrichment | The emotional payoff ships |
| **P4** | **Winners Report** · Analytics · Audit Log · Tutorial platform | HR record-keeping and governance |
| **P5** | Accessibility audit · device matrix · performance · security review · **tutorial recording** | Production |

**Two sequencing warnings.**

1. **Build the grid in P0, not P4.** Retrofitting per-column filter and sort onto nine independently-built screens is the most expensive avoidable mistake in this project.
2. **Record the videos last, but write the scripts early.** Footage cannot be captured until the UI is frozen — anything shot sooner gets reshot. Scripts are cheap to revise; video is not. And budget the demo seed dataset as a real deliverable, because every recording depends on it existing and staying stable.

---

## 9. Still open

| | Question | Drawn here as |
|---|---|---|
| **OQ-1** | Votes per employee per cycle | One |
| **OQ-2** | Employee data: managed here, or synced from HR? | Admin-managed with CSV import |
| **OQ-3** | Year award candidate pool | All active employees |
| **OQ-4** | Can a winner win again immediately? | Yes, no cooldown |
| **OQ-5** | Per-department or company-wide award? | Company-wide |
| **OQ-6** | Showcase visibility | Internal, authenticated only |
| **OQ-7** | Winners Report visibility | All employees |

---

*Wireframe v1.1 · muted palette · drawn from SPEC.md v1.2 · 2026-09-22*
