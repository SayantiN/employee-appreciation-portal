# Employee Appreciation Portal — Functional Specification

**Version:** 1.2
**Status:** Draft for approval
**Date:** 2026-09-22
**Owner:** ganesh@isgesolutions.com
**Scope of this document:** Requirements only. Technology-agnostic — no framework, language, or database product is prescribed. Any stack that satisfies Section 14 (Non-Functional Requirements) is acceptable.

---

## 1. Purpose & Product Summary

An internal web portal where employees nominate and vote for **Employee of the Month** and **Employee of the Year**, give written appreciation and constructive suggestions, and where winners and their work are celebrated publicly inside the company.

The portal has five jobs:

1. **Collect** structured appreciation — a vote is not just a name, it carries a reason, a comparison rationale, a suggestion, and a rating.
2. **Decide** winners fairly — votes are tallied automatically and kept hidden until the voting window closes, so nobody can bandwagon.
3. **Celebrate** — winners get a Hall of Fame entry and a Work Showcase page where their actual work is demonstrated.
4. **Report** — a searchable, filterable record of every award, date-wise and month-wise, exportable for HR records and appraisals.
5. **Teach** — a library of short, AI-narrated video tutorials so a new joiner can learn the whole portal unaided on day one.

### 1.1 Success criteria

| Metric | Target |
|---|---|
| Employee participation per monthly cycle | ≥ 70% of active employees |
| Votes containing all four qualitative fields | 100% (enforced by validation) |
| Time from cycle close to winner published | ≤ 2 business days |
| Usable on a phone without horizontal scrolling | 100% of screens |

---

## 2. Open Questions (must be answered before build)

These are unresolved. Each has a **stated default** used throughout this document so the spec is complete and buildable — but confirm or change them.

| # | Question | Default assumed in this spec |
|---|---|---|
| **OQ-1** | How many votes may one employee cast per cycle? | **One vote per voter per cycle**, enforced. Exposed as a system setting (`max_votes_per_voter_per_cycle`, default `1`) so it can be raised to 2–3 nominations later without a code change. |
| **OQ-2** | Where does employee master data come from — created inside this app by an admin, or imported/synced from an existing HR system? | **Admin-managed inside the app**, with CSV bulk import. If an HRMS exists, this becomes a scheduled sync and the admin screens go read-only. This is the biggest architectural fork — answer it first. |
| **OQ-3** | For **Employee of the Year**, can anyone be nominated, or only that year's 12 monthly winners? | **Anyone active** may be nominated (matches your wording "select employee from the list of employees added in the db"). Setting `eoy_candidate_pool` = `all` \| `monthly_winners_only`. |
| **OQ-4** | Can a previous month's winner win again immediately? | **Yes, allowed.** Setting `winner_cooldown_months`, default `0`. Set to `1` or `3` to force rotation. |
| **OQ-5** | Separate voting pools per department/location, or one company-wide award? | **One company-wide award.** Department is captured and reported on, but does not partition voting. |
| **OQ-6** | Who may view the Work Showcase — all employees only, or is any part shareable externally? | **Internal, authenticated users only.** No public or anonymous access anywhere in the product. |
| **OQ-7** | Is the Winners Report (6.9) open to all employees, or restricted to Admin/HR? | **All authenticated employees**, read-only, published winners only. Setting `winners_report_visibility` = `all_employees` \| `admin_only`. |

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Cycle** | A single award period. Either a *Month* cycle (e.g. Sep 2026) or a *Year* cycle (e.g. 2026). |
| **Voting window** | The open/close timestamps within a cycle during which votes may be cast or edited. |
| **Voter** | The employee casting a vote. |
| **Nominee** | The employee being voted for. |
| **Feedback** | The reason + rationale + suggestion + rating attached to a vote, shown to the nominee anonymously. |
| **Tally** | The computed ranking of nominees for a cycle. |
| **Showcase** | The published page demonstrating a winner's work. |
| **Grid** | Any tabular data surface in the application. All grids obey Section 11. |
| **Onboarding playlist** | The ordered set of tutorials a new joiner is guided through on first login (6.14.1). |
| **Demo seed dataset** | Fictitious employees, votes, and feedback used for all tutorial recordings, so no real data is filmed (R-6.14.6). |

---

## 4. Roles & Permissions

Three roles. A user has exactly one role; Admin implicitly holds all Employee permissions.

| Capability | Employee | Admin / HR | Auditor (read-only) |
|---|:--:|:--:|:--:|
| Log in, manage own profile & password | ✔ | ✔ | ✔ |
| View Dashboard | ✔ | ✔ | ✔ |
| Cast / edit / withdraw own vote | ✔ | ✔ | ✖ |
| View own cast votes | ✔ | ✔ | ✖ |
| View feedback received about self (anonymised) | ✔ | ✔ | ✖ |
| View results after cycle closes | ✔ | ✔ | ✔ |
| View live tally **before** cycle closes | ✖ | ✔ | ✔ |
| View Hall of Fame & Work Showcase | ✔ | ✔ | ✔ |
| View Winners Report | ✔ (OQ-7) | ✔ | ✔ |
| Export Winners Report | ✔ (OQ-7) | ✔ | ✔ |
| Watch employee video tutorials | ✔ | ✔ | ✔ |
| Watch admin video tutorials | ✖ | ✔ | ✔ |
| Manage the tutorial library | ✖ | ✔ | ✖ |
| View tutorial completion report | ✖ | ✔ | ✔ |
| Open / close / configure voting cycles | ✖ | ✔ | ✖ |
| Publish winner & upload Work Showcase | ✖ | ✔ | ✖ |
| Manage employee directory & roles | ✖ | ✔ | ✖ |
| View analytics & participation reports | ✖ | ✔ | ✔ |
| View audit log (incl. voter identity) | ✖ | ✔ | ✔ |
| Change system settings | ✖ | ✔ | ✖ |

**Rule R-4.1:** Admins can see who voted for whom (for audit and fraud handling). This must be disclosed to all employees on the Help page and at first login — otherwise "anonymous" is a misleading promise.

---

## 5. Navigation & Menu Structure

The complete menu. Items marked 🔒 are role-gated and hidden (not merely disabled) for users without permission.

```
Employee Appreciation Portal
│
├── Dashboard
│
├── Vote
│   ├── Employee of the Month
│   └── Employee of the Year
│
├── My Activity
│   ├── My Votes            (what I submitted)
│   └── Feedback for Me     (what others said about me, anonymised)
│
├── Results
│   ├── Current Cycle Status     (open cycles: participation only, no standings)
│   └── Past Results & Leaderboard
│
├── Reports
│   └── Winners Report           (date-wise & month-wise, Month + Year awards)   ◀ 6.9
│
├── Winners
│   ├── Hall of Fame        (all past winners, month & year)
│   └── Work Showcase       (winner's work demo)
│
├── Notifications
│
├── Help & Training
│   ├── How It Works             (written guide)                          ◀ 6.13
│   └── Video Tutorials          (AI-narrated, captioned walkthroughs)    ◀ 6.14
│
├── 🔒 Administration
│   ├── Voting Cycles           (create, open, close, schedule)
│   ├── Publish Winners         (declare + upload work demo)
│   ├── Employee Directory      (see OQ-2)
│   ├── Tutorial Library        (upload, script, narration, publish)
│   ├── Analytics & Exports     (participation, ratings, engagement)
│   ├── Audit Log
│   └── System Settings
│
└── Account
    ├── My Profile
    ├── Change Password
    └── Logout
```

### 5.1 Three winner-related screens — how they differ

They look similar and will be confused unless kept distinct:

| Screen | Question it answers | Form |
|---|---|---|
| **Past Results & Leaderboard** (6.8) | "For *this one cycle*, how did everyone rank?" | Single-cycle leaderboard with vote counts |
| **Winners Report** (6.9) | "*Across time*, who won what and when?" | Multi-period grid, filterable and exportable |
| **Hall of Fame** (6.10) | "Who are our winners?" — celebration | Visual card grid with photos |

### 5.2 Navigation behaviour by screen size

| Breakpoint | Navigation pattern |
|---|---|
| Desktop ≥ 1280px | Persistent left sidebar, expanded, with section labels. Collapsible to an icon rail. |
| Laptop 1024–1279px | Left sidebar collapsed to an icon rail by default; expands on hover/click. |
| Tablet 768–1023px | Off-canvas drawer opened by a hamburger in the top bar. Overlay dims content. |
| Mobile ≤ 767px | Bottom tab bar with the 4 primary destinations — **Dashboard, Vote, Feedback for Me, Winners** — plus a "More" tab opening a full-screen sheet containing everything else, including Reports and Admin. |

**Rule R-5.1:** The active menu item must be indicated by more than colour alone (e.g. colour + left bar + weight).

---

## 6. Screen Specifications

Each screen lists purpose, content, rules, states, and responsive behaviour.

### 6.1 Login

**Purpose:** Authenticate an employee by work email + password.

**Content**
- Company logo and product name
- Email field (`type=email`, `autocomplete=username`)
- Password field (`type=password`, `autocomplete=current-password`, show/hide toggle)
- "Remember me on this device" checkbox
- Primary button: **Sign In**
- Link: **Forgot password?**
- Footer: support contact, app version

**Rules**
- R-6.1.1: The email domain must match an allowed company domain list (system setting). Reject others before the credential check.
- R-6.1.2: Passwords stored only as salted hashes using a modern adaptive algorithm. Never stored or logged in plain text, never emailed.
- R-6.1.3: Generic failure message — *"Email or password is incorrect."* Never reveal whether the email exists.
- R-6.1.4: Rate limiting — 5 failed attempts per account per 15 minutes locks the account for 15 minutes and emails the owner; 20 failed attempts per IP per 15 minutes throttles the IP.
- R-6.1.5: Deactivated employees cannot log in — *"Your account is inactive. Contact HR."*
- R-6.1.6: First login forces a password change if the account was created with a temporary password.
- R-6.1.7: Session lifetime — 8 hours absolute, 60 minutes idle, whichever comes first. "Remember me" extends absolute life to 30 days on that device only.

**States:** default · validating · invalid credentials · account locked · account inactive · network error · success (redirect to Dashboard, or to the originally requested deep link).

**Responsive:** Desktop — two panels, brand/illustration left, form right, form max-width 420px. Tablet — single centred card, max-width 480px. Mobile — full-bleed with 16px gutters, smaller logo, full-width fields, 44px minimum tap targets, and no viewport jump when the keyboard opens.

---

### 6.2 Forgot Password / Reset

- **Step 1:** enter email → always show *"If that email is registered, a reset link has been sent."* (no account enumeration).
- **Step 2:** emailed single-use token link, valid **30 minutes**, invalidated on use or when a newer request is made.
- **Step 3:** new password + confirm, with a live strength meter and the policy displayed.
- **Password policy:** minimum 10 characters; at least three of {uppercase, lowercase, digit, symbol}; must not contain the user's name or email local-part; must not match the last 3 passwords; must not appear in a common-password blocklist.
- On success: invalidate all existing sessions for that user, then redirect to Login with a success banner.

---

### 6.3 Dashboard

**Purpose:** In one screen, tell the employee *what is happening now, what they must do, and how the company is celebrating.*

**Content blocks, in priority order**

1. **Greeting + call to action** — "Good morning, Ganesh." plus the single most urgent action: *"Voting for September 2026 closes in 3 days — you haven't voted yet."* with a **Vote Now** button. If already voted: *"Your vote is in. You can edit it until 30 Sep, 6:00 PM."*

2. **KPI tiles** (4)

   | Tile | Value |
   |---|---|
   | Current cycle | "September 2026 · Open · closes in 3d 4h" |
   | Your voting status | "Submitted" / "Not submitted" / "Draft saved" |
   | Company participation | "68% · 82 of 120 employees voted" — count only, **never** standings while open |
   | Appreciation you received | "7 votes this month" + average rating |

3. **Reigning winners** — cards for the latest Employee of the Month and Employee of the Year: photo, name, department, one-line citation, link to the Work Showcase.

4. **Feedback for me — recent** — the last 3 anonymised suggestions, truncated, linking to the full page.

5. **My appreciation trend** — small chart of votes received and average rating over the last 6 months.

6. **Hall of Fame strip** — horizontally scrollable row of the last 6 winners.

7. **Announcements** — admin-posted notices (cycle opening, results published, ceremony date).

8. **Getting started** — shown only until the onboarding playlist is complete: a progress ring, the next tutorial to watch, and a **Start the 5-minute tour** button (6.14). Dismissible, and permanently hidden once finished.

**Rules**
- R-6.3.1: While any cycle is **open**, the Dashboard must not expose per-nominee counts, ranks, or leaders to Employees. Aggregate participation only.
- R-6.3.2: Admins additionally see an **Admin Snapshot** row: votes cast today, cycles needing action, pending winner publication, flagged content.
- R-6.3.3: Every tile has a defined empty state (e.g. "No cycle is open right now. The next one opens 1 Oct.").

**Responsive:** Desktop — 4 tiles in a row, then a 2-column grid. Tablet — 2×2 tiles, single-column content below. Mobile — tiles in a compact 2-column grid (or a snap-scroll carousel), everything else full-width and stacked; the chart drops to a simplified 3-month view.

---

### 6.4 Vote — Employee of the Month

**Purpose:** Submit one structured vote for the current month cycle.

**Header:** cycle name, countdown to close, current submission status.

**Form fields**

| # | Field | Type | Required | Validation |
|---|---|---|---|---|
| 1 | **Nominee** | Searchable single-select of active employees, showing photo, name, designation, department | ✔ | Must be an active employee; **must not be the voter** (R-6.4.2); must satisfy cooldown (OQ-4) |
| 2 | **Reason for voting** | Multiline text | ✔ | 30–1000 chars. Helper: *"What did they actually do this month? Be specific — name the project, the save, the help."* |
| 3 | **Why better than others this month** | Multiline text | ✔ | 30–1000 chars. Helper: *"What set them apart from everyone else?"* |
| 4 | **One suggestion for them** | Multiline text | ✔ | 20–500 chars. Helper: *"One thing that would make them even stronger. Keep it kind and actionable."* |
| 5 | **Rating out of 10** | Slider 1–10, integer, discrete stops, numeric display | ✔ | 1 ≤ n ≤ 10 |
| 6 | **Confirmation** | Checkbox: *"I confirm this is my honest assessment."* | ✔ | Must be checked to submit |

**Actions:** `Save Draft` · `Submit Vote` · after submission `Edit Vote` · `Withdraw Vote`

**Rules**
- R-6.4.1: Submission is allowed only while the cycle status is `Open` and the **server** clock is inside the window. Client countdowns are cosmetic.
- R-6.4.2: **No self-voting.** The voter is excluded from the nominee list and the rule is re-checked server-side on submit.
- R-6.4.3: **One vote per voter per cycle** (OQ-1 default). A second attempt edits the existing vote rather than creating a new record.
- R-6.4.4: **Editable until the window closes.** Every edit writes a new version to the audit trail; the nominee always sees only the latest version.
- R-6.4.5: **Withdraw** sets the vote to `Withdrawn`, removes it from the tally and from the nominee's Feedback page. Possible only while the window is open.
- R-6.4.6: Drafts autosave every 20 seconds and on blur. A draft is private and is **not** counted. A draft left unsubmitted when the window closes is discarded and counts as non-participation.
- R-6.4.7: Text fields are sanitised against script injection — plain text only, no HTML.
- R-6.4.8: Profanity/abuse screening flags content for admin review rather than silently rejecting it; the vote still counts unless an admin removes it. Show the voter a soft warning before submit.
- R-6.4.9: If the window closes mid-session, submitting gives a clear error with the form content preserved — nothing is lost.

**States:** window not yet open · open & not started · draft in progress · submitted (read-only summary with Edit/Withdraw) · window closed & submitted (read-only, edit disabled with reason) · window closed & not submitted (missed) · nominee blocked by cooldown, if enabled.

**Responsive:** Desktop — two columns: form left (max 720px), live "your vote so far" summary and guidance right. Tablet — single column, guidance collapsed into an accordion above the form. Mobile — single column full-width; the nominee picker opens a **full-screen search sheet** with a sticky search box and an avatar list (never a cramped native dropdown); the rating slider gets large touch targets plus −/+ steppers; the submit button is sticky to the bottom of the viewport above the tab bar; character counters sit directly beneath each field.

---

### 6.5 Vote — Employee of the Year

Structurally identical to 6.4, with these differences:

- The cycle is the **year** (e.g. 2026); the window typically opens in December.
- Field 3 reads **"Why they are the best of the entire year"** and asks for evidence across the year, minimum **50** characters — a year-level claim deserves more than a line.
- Candidate pool per **OQ-3** (default: all active employees; alternative: that year's monthly winners only).
- Optional field 7: **Standout contribution / highlight of the year** (multiline, 0–800 chars) — feeds the Hall of Fame citation.
- A month-cycle vote and a year-cycle vote are independent records; voting in one does not affect the other.
- If a month cycle and the year cycle are open simultaneously, the Dashboard shows **two** distinct calls to action and the Vote menu carries a badge per item.

---

### 6.6 My Votes

**Purpose:** Let a voter see and manage everything they have submitted.

**Grid columns:** Cycle · Award Type · Nominee · Rating Given · Status (Draft / Submitted / Withdrawn / Locked) · Submitted On · Last Edited On. All columns filterable and sortable per **Section 11**. Default sort: Submitted On descending. Expanding a row reveals the full text of all three written answers.

**Actions per row:** View · Edit (only while that cycle's window is open) · Withdraw (only while open) · View own edit history.

**Rules**
- R-6.6.1: A voter sees only their own votes here — never anyone else's.
- R-6.6.2: Once the window closes, the row becomes permanently read-only.

**Responsive:** Desktop — full grid. Tablet — reduced columns (cycle, nominee, rating, status), the rest inside the expanded row. Mobile — **card list, not a table** (RR-6), with sort and filter sheets per DG-15.

---

### 6.7 Feedback for Me

**Purpose:** Show an employee the appreciation and suggestions others gave them — the heart of the product.

**Content**
- Summary header: total votes received (this cycle / all time), average rating, best-ever rating, number of cycles nominated in, and whether they have ever won.
- Rating distribution: small bar chart across 1–10.
- A feed of feedback cards, newest first. Each shows cycle and award type, the rating given, **Reason**, **Why better than others**, **Suggestion** (visually distinguished — this is the growth part), and the date.
- **The voter's identity is never shown** (R-6.7.1) — cards are labelled "A colleague".
- Filters: cycle, award type, rating range. Sort by newest or highest rating.
- Personal export: "Download my feedback (PDF)".

**Rules**
- R-6.7.1: **Anonymous to the nominee.** No name, email, avatar, department, or timestamp finer than the date. Department alone can identify a person on a small team, so it is not shown.
- R-6.7.2: **Suppression threshold** — feedback becomes visible to the nominee only once the cycle has closed **and** that nominee received at least **3** votes in that cycle (setting `min_feedback_reveal_count`, default 3). Below the threshold: *"Feedback will appear once more colleagues have voted."* Without this, a single vote on a small team is trivially de-anonymised. **This rule is what makes the anonymity promise real.**
- R-6.7.3: Feedback for an open cycle is never shown, even above the threshold — revealing it mid-window leaks standings.
- R-6.7.4: An employee may report a card as abusive; it is hidden from them immediately and queued for admin review.

**Responsive:** Desktop — two card columns with a sticky summary/filter rail. Tablet — single column, filters in a collapsible bar. Mobile — single-column cards, long text clamped to 4 lines with "Read more", filters in a bottom sheet.

---

### 6.8 Results & Leaderboard

**Purpose:** Publish the outcome of a single closed cycle.

**Content**
- Cycle selector (award type + period).
- **If the cycle is open:** Employees see only *"Results are hidden until voting closes on <date>."* plus participation %. Admins and Auditors see the live tally, clearly watermarked **CONFIDENTIAL — PRE-CLOSE**.
- **If closed:** winner banner (photo, name, department, citation, final score, link to Work Showcase), then the full leaderboard grid — Rank · Employee · Department · Votes Received · Average Rating · Composite Score. Filterable and sortable per **Section 11**; default sort Rank ascending.
- Cycle stats: total votes cast, participation %, department-wise participation.

**Rules**
- R-6.8.1: **Ranking** is by vote count, descending.
- R-6.8.2: **Tie-break order:** (1) higher average rating; (2) higher count of 9–10 ratings; (3) earliest first-vote timestamp; (4) still tied → the cycle is marked `Tie — Needs Decision` and an admin selects the winner with a mandatory written justification recorded in the audit log. **Co-winners are permitted** if the admin chooses that.
- R-6.8.3: Withdrawn, draft, and admin-removed votes are excluded from all tallies.
- R-6.8.4: The tally is computed and **frozen as a snapshot** at the moment the cycle closes. Later data corrections never silently alter a published result; a correction requires an explicit re-publish that is audit-logged and re-notified.

**Responsive:** Desktop — winner banner plus full grid. Tablet — banner stacked above a reduced grid. Mobile — winner card, then ranked cards (large rank number, avatar, name, votes, rating), with the top three visually emphasised.

---

### 6.9 Reports — Winners Report

**Purpose:** A single place that answers "who won, and when" across the entire history of the programme — **date-wise and month-wise**, covering both Employee of the Month and Employee of the Year. This is the HR record: filterable, sortable, exportable, usable in appraisal discussions and annual reviews.

#### 6.9.1 Views

The report offers four views, selected by a segmented control. All four are the same grid with different default grouping, sorting, and columns.

| View | One row = | Default sort |
|---|---|---|
| **Month-wise** | One Month award cycle | Period descending (newest first) |
| **Year-wise** | One Year award cycle | Year descending |
| **Date-wise** | One award announcement within a chosen date range, chronological | Announcement date descending |
| **All Awards** | Both types combined, with an Award Type column | Period descending |

#### 6.9.2 Columns

Every column is filterable and sortable per **Section 11**.

| Column | Type | Notes |
|---|---|---|
| Award Type | Enum (Month / Year) | Multi-select filter. Hidden in the Month-wise and Year-wise views |
| Year | Number | Range or multi-select filter |
| Month | Enum (Jan–Dec) | Multi-select filter. Empty for Year awards |
| Period Label | Text | "Sep 2026" / "2026" |
| Cycle Start Date | Date | Window opened |
| Cycle End Date | Date | Window closed |
| **Winner Name** | Person | Searchable multi-select filter; shows avatar + name |
| Employee Code | Text | |
| Designation | Text | |
| Department | Enum | Multi-select filter |
| Location | Enum | Multi-select filter |
| Votes Received | Number | Range filter |
| Average Rating | Number (1–10, 1 decimal) | Range filter |
| Participation % | Number | Cycle-level participation |
| Announced On | Date | `published_at` — the date the winner went live |
| Announced By | Person | Admin who published. **Admin/Auditor only** (DG-17) |
| Decision | Enum (Auto / Admin Override / Tie Resolved) | **Admin/Auditor only**; surfaces overrides for audit |
| Co-winner | Boolean | Flags a tie that produced joint winners |
| Showcase | Link / Status | "View" if published, "Not added" otherwise |
| Citation | Text | Truncated in-grid, full text on row expand |

#### 6.9.3 Controls

- **Date range picker** driving the Date-wise view, with presets: This Month · Last Month · This Quarter · This Year · Last Year · Last 12 Months · Custom.
- **Group by:** None · Year · Department · Award Type. Groups are collapsible and show a per-group count.
- **Summary strip** above the grid, recalculating with the active filters: total awards in range · distinct winners · repeat winners · most-awarded department · average votes per award.
- **Export:** Excel (.xlsx) and PDF, plus a print stylesheet.
- **Row expand:** full citation, the three highlighted anonymised quotes if any, and a link to that cycle's leaderboard (6.8).

#### 6.9.4 Rules

- R-6.9.1: Employees see **published winners only**. Admins and Auditors additionally see Draft and Unpublished rows, clearly badged. Visibility of the whole report follows `winners_report_visibility` (OQ-7).
- R-6.9.2: The report reads the **frozen** `Winner` and `CycleResult` records. It never recomputes a tally — two people running the report on different days must see identical historical numbers.
- R-6.9.3: **Date-wise filtering has two distinct bases**, chosen by an explicit toggle: filter by **Announcement Date** (`published_at`, the default) or by **Award Period** (the cycle the award belongs to). These differ — a September winner may be announced in October — and conflating them produces wrong HR records. The active basis must be labelled on screen and carried into the export header.
- R-6.9.4: Deactivated employees remain in historical rows with their name intact and an "Inactive" badge (consistent with R-6.18.3). Awards are never retroactively removed.
- R-6.9.5: Cycles that closed with no valid votes appear as a row with "No award" rather than being silently omitted — an absent month must be visibly absent.
- R-6.9.6: Exports respect the active view, filters, sort order, grouping, and column visibility. The export header records: generated-by, generated-at, the filters applied, the date basis (R-6.9.3), and the row count.
- R-6.9.7: An export containing the Announced By or Decision columns is watermarked *"Confidential — contains administrative decision data"*.
- R-6.9.8: Empty result → *"No awards were announced between <from> and <to>."* with a Clear Filters action, distinct from the no-data-at-all state.

#### 6.9.5 Responsive

- **Desktop:** full grid, sticky header row, sticky first column (Period), horizontal scroll *within the grid container only* — never the page (RR-2).
- **Tablet:** reduced default columns — Period · Award Type · Winner · Department · Votes. The rest reachable via the column-visibility control or row expand.
- **Mobile:** card list. Each card shows the period as its header, then winner avatar, name, designation, department, votes, and average rating, with a chevron to expand for the remaining fields. Sort and filter remain **fully available** through the sticky toolbar sheets described in DG-15 — no capability is dropped on mobile. The date range picker opens as a full-screen sheet with the presets as large tap targets.

---

### 6.10 Winners — Hall of Fame

**Purpose:** A permanent, browsable, visual record of everyone who has won. Celebration, not reporting — for the tabular record see 6.9.

**Content:** Grid of winner cards — photo, name, designation, department, award badge (Month / Year), period, citation, vote count. Filters: year, award type, department. Search by name. Optional timeline view grouped by year. Employee of the Year entries get special emphasis.

**Responsive:** Desktop 4 columns · Laptop 3 · Tablet 2 · Mobile 1, with lazy loading and skeleton placeholders.

---

### 6.11 Winners — Work Showcase

**Purpose:** Demonstrate *what the winner actually did* — the reason they won, made visible.

**Content per showcase**
- Winner header: photo, name, designation, department, award and period.
- **Citation** — the admin-written summary of why they won.
- **Work demo body**, composed from ordered blocks:
  - Rich text write-up (headings, paragraphs, lists, links)
  - Image gallery with captions and lightbox
  - Embedded video (uploaded file, or an allow-listed internal/approved host — no arbitrary third-party embeds)
  - Document attachments (PDF/PPT/DOCX) with inline PDF preview and download
  - Links to internal systems (repository, ticket, dashboard, demo environment)
  - Key metric / impact tiles (e.g. "Cut processing time 42%")
- **Appreciation highlights** — 3–5 anonymised quotes from that cycle's winning votes, subject to the same anonymity and threshold rules as 6.7, and only where the admin selected them.
- Previous / next winner navigation.

**Rules**
- R-6.11.1: Only an Admin can create or edit a showcase. It attaches to a published winner record.
- R-6.11.2: A showcase is `Draft` or `Published`; Draft is visible to Admins only.
- R-6.11.3: Upload limits — images ≤ 5 MB each (jpg, png, webp); video ≤ 200 MB (mp4, webm); documents ≤ 20 MB (pdf, docx, pptx, xlsx); max 20 files per showcase. Server-side MIME sniffing, not extension trust. Files are virus-scanned before becoming visible.
- R-6.11.4: Uploaded files are served only to authenticated users via time-limited signed URLs, never from a publicly guessable path.
- R-6.11.5: Every image requires alt text before publishing; video requires a title, and captions where available.
- R-6.11.6: A winner may be given edit rights to their own showcase draft (setting `winner_can_edit_showcase`, default `false`); publishing always remains with the Admin.

**Responsive:** Desktop — content column max 820px with a sticky section-navigation rail. Tablet — single column, rail becomes a top pill bar. Mobile — single column; the gallery becomes a swipeable carousel; video is responsive 16:9; documents render as download cards instead of inline previews; metric tiles go 2-up.

---

### 6.12 Notifications

In-app notification centre with an unread badge, plus email for the events marked below.

| Event | Recipient | In-app | Email |
|---|---|:--:|:--:|
| Voting cycle opened | All active employees | ✔ | ✔ |
| Reminder — 3 days left, not yet voted | Non-voters | ✔ | ✔ |
| Reminder — 24 hours left, not yet voted | Non-voters | ✔ | ✔ |
| Your vote was submitted / edited / withdrawn | Voter | ✔ | ✖ |
| Voting closed | All | ✔ | ✖ |
| Winner published | All | ✔ | ✔ |
| **You won** | Winner | ✔ | ✔ |
| New feedback available about you (post-close, threshold met) | Nominee | ✔ | ✔ |
| Work Showcase published | All | ✔ | ✖ |
| Account locked / password changed | Account owner | ✖ | ✔ |
| Content flagged for review | Admins | ✔ | ✔ |
| Scheduled export ready for download | Requester | ✔ | ✖ |
| Welcome — start your video tutorials | New joiner, at first login | ✔ | ✔ |
| Onboarding playlist still unfinished after 7 days | Employee | ✔ | ✖ |
| New tutorial published | All (role-filtered) | ✔ | ✖ |
| A tutorial you manage is now stale | Admins | ✔ | ✖ |

**Rules**
- R-6.12.1: Notifications must never leak standings. The safe default is to withhold "you received a vote" notifications until the cycle closes.
- R-6.12.2: Users can mute non-essential email in Profile. Cycle-open, winner-published, and security emails cannot be muted.
- R-6.12.3: All emails must render correctly on mobile mail clients and degrade to plain text.

---

### 6.13 Help & Training — How It Works

Static, admin-editable content: the awards explained, the voting rules, the anonymity policy **including the disclosure that admins can see voter identity for audit (R-4.1)**, the tally and tie-break method, the schedule, an FAQ, and a support contact. Linked from Login, Dashboard, and both Vote screens.

---

### 6.14 Help & Training — Video Tutorials

**Purpose:** Let a new joiner learn the entire portal on their own, on day one, without HR running a session for every new hire. A library of short, AI-narrated tutorial videos with captions and searchable transcripts.

#### 6.14.1 Library

Videos are grouped into categories, shown as cards with thumbnail, title, duration, a one-line description, and a watched / in-progress / not-started badge.

| Category | Audience |
|---|---|
| Getting Started | Everyone — the onboarding playlist |
| Voting | Everyone |
| Your Feedback | Everyone |
| Winners & Showcase | Everyone |
| Reports | Everyone |
| 🔒 Administration | Admin / HR only |

**"New here? Start the 5-minute tour"** — a guided onboarding playlist that plays in sequence, surfaced on the Dashboard and at first login, and dismissible once completed. A progress ring shows how much of it the user has finished.

#### 6.14.2 Baseline video list

The launch library. Durations are targets — a tutorial nobody finishes teaches nothing.

| # | Title | Target length | Audience |
|---|---|---|---|
| 1 | Welcome — what this portal is for | 1–2 min | All |
| 2 | Signing in and setting your password | 2 min | All |
| 3 | Finding your way around the Dashboard | 2–3 min | All |
| 4 | Voting for Employee of the Month | 3–4 min | All |
| 5 | Voting for Employee of the Year | 2 min | All |
| 6 | Editing or withdrawing your vote | 1–2 min | All |
| 7 | Reading the feedback you received | 3 min | All |
| 8 | **How anonymity works — and what admins can see** | 2 min | All |
| 9 | How the winner is decided | 3 min | All |
| 10 | Hall of Fame and the Work Showcase | 2 min | All |
| 11 | Using the Winners Report — filter, sort, export | 3 min | All |
| 12 | Using the portal on your phone | 2 min | All |
| 13 | 🔒 Managing voting cycles | 5 min | Admin |
| 14 | 🔒 Publishing a winner and building a showcase | 6 min | Admin |
| 15 | 🔒 Analytics, exports and the audit log | 4 min | Admin |

Video 8 is not optional. The anonymity model has a subtlety — nominees cannot see voters, but admins can (R-4.1) — and a portal that quietly relies on people reading a Help page has not actually disclosed it.

#### 6.14.3 Player

- Video with **AI-generated voiceover narration**
- **Captions / subtitles**, on by default, toggleable
- **Chapter markers** for videos over 3 minutes, jumpable from a chapter list
- **Searchable transcript panel** beside the video; clicking a line seeks the video to that point
- Playback speed 0.75× / 1× / 1.25× / 1.5× / 2×
- **Resume from last position**, per user, across devices
- Next / previous within the category or playlist
- Full screen, volume, keyboard shortcuts
- Download transcript as PDF
- Related links: jump straight to the screen the video explains

#### 6.14.4 Production rules for AI narration

These exist because AI voiceover only pays off if the pipeline is set up to exploit it.

- **R-6.14.1 · The script is the source of truth.** Every video stores its narration script, version-controlled alongside the video record. When a feature changes, the script is edited and the audio **regenerated** — never re-recorded by hand. This is the entire reason to use a synthetic voice; a pipeline that loses it has bought nothing.
- **R-6.14.2 · Captions are generated from the script, not from the audio.** Transcribing your own generated speech back into text introduces errors you did not need to have. Caption timing is aligned to the synthesis output; caption *text* comes from the script verbatim.
- **R-6.14.3 · One voice, everywhere.** A single voice profile, locale, and speaking rate across the whole library (setting `tutorial_ai_voice_profile`). A library that changes voice between videos sounds broken.
- **R-6.14.4 · Pronunciation lexicon.** Maintain a term list so the synthesiser says company, product, and feature names correctly — "ISG eSolutions", "Amadeus", "nominee", and any initialisms. Wrong pronunciation of the company's own name in the first ten seconds of the welcome video undermines the whole thing.
- **R-6.14.5 · Disclose the synthetic voice.** Every video carries a visible, unobtrusive notice that narration is AI-generated (setting `tutorial_ai_disclosure_text`), shown on the player and in the library card. State it plainly rather than letting people work it out.
- **R-6.14.6 · No real employee data in any recording.** All screen footage is captured against a **seeded demo dataset with fictitious employees, votes, and feedback**. A tutorial is watched by everyone, forever — recording a real voting screen would publish real names, real votes, and real private feedback into a permanent internal artefact. Demo data is generated by a documented, repeatable seed script so footage can be re-captured identically later.
- **R-6.14.7 · Videos are versioned and go stale.** Each carries `applies_to_app_version`. When a screen it covers changes, the video is flagged **Stale**, shown to viewers with a "May be out of date" badge, and queued for the admin to re-record. An unmaintained tutorial library is worse than none, because it teaches people the wrong thing confidently.
- **R-6.14.8 · Same access controls as everything else.** Authenticated users only, served via time-limited signed URLs (R-6.11.4), never publicly embeddable. Admin tutorials are excluded server-side for non-admins (DG-17), not merely hidden from the list.
- **R-6.14.9 · Format and size.** mp4 or webm, 1080p maximum, ≤ 200 MB per video, with a poster image. Provide a lower-bitrate variant, or adaptive streaming, for mobile.
- **R-6.14.10 · Localisation-ready.** Script, audio, and captions are stored per locale. v1 ships English only; adding a language must not require re-shooting the video, only regenerating narration and captions from the translated script (NF-22).

#### 6.14.5 Accessibility

- Captions are **mandatory** on every published video (WCAG 1.2.2) — a video cannot be published without them.
- A full text transcript is **mandatory** (WCAG 1.2.3), and is the fallback when video will not load or the user is on a metered connection.
- No information is conveyed by narration alone; anything spoken that matters is also visible on screen or in the transcript.
- The player is fully keyboard operable with visible focus.
- Nothing autoplays with sound. Respect `prefers-reduced-motion` (RR-13).

#### 6.14.6 Progress tracking

Per user, per video: first viewed, last position, percent watched, completed. Used for the resume feature, the onboarding progress ring, and an admin completion report (which employees have finished the onboarding playlist). Completion is recorded at 90% watched, not at 100% — nobody sits through the outro.

**Rule R-6.14.11:** Progress data is for support and onboarding follow-up only. It must never feed into voting, appraisal, or any report that ranks employees. Watch-time is not a performance metric and must not become one.

#### 6.14.7 🔒 Admin — Tutorial Library management

Reached from Administration. Grid of all tutorials — Title · Category · Duration · Status (Draft/Published/Stale/Archived) · Applies To Version · Visible To Roles · Completion % · Updated — filterable and sortable per Section 11; default sort Category then sort order.

**Actions:** Add video (upload file + poster) · Attach or edit the narration script · Generate narration and captions · Reorder within a category · Set role visibility · Add to / remove from the onboarding playlist · Publish / Unpublish · Mark Stale · Archive · View completion report.

Publishing is blocked until the video has a script, captions, a transcript, a poster image, and a duration.

#### 6.14.8 Responsive

- **Desktop:** two-pane player — video left (max 960px), transcript and chapter list right. Library in a 3–4 column card grid.
- **Tablet:** video full width, transcript collapsed into a tab beneath it. Library 2 columns.
- **Mobile:** video pinned at the top in 16:9, transcript and chapters as tabs below, library single-column. Controls meet the 44px target (RR-3). Show a **data-usage notice on cellular** with an option to read the transcript instead of streaming. In landscape, the video goes full-bleed with controls overlaid.

---

### 6.15 My Profile

View and edit own display name, designation, department (read-only if HR-sourced), photo, contact details, notification preferences, theme (light/dark/system), and language. Change password requires the current password and invalidates other sessions. Shows the user's own award history and lifetime appreciation stats. Photo upload ≤ 2 MB with a square crop tool (jpg, png, webp).

---

### 6.16 🔒 Admin — Voting Cycles

**Purpose:** Control when voting happens.

**Grid columns:** Award Type · Period · Opens At · Closes At · Status · Votes Cast · Participation % · Winner — all filterable and sortable per Section 11; default sort Opens At descending.

**Actions:** Create cycle · Edit (only before open) · Open now · Close now · Extend window · Cancel cycle · Recompute tally.

**Cycle lifecycle**

```
Draft ──open──▶ Open ──close (scheduled or manual)──▶ Closed
  │               │                                     │
  │               └──extend──▶ Open (new close time)     ├─tally frozen─▶ Tallied
  └──cancel──▶ Cancelled                                 │
                                                         ├──publish──▶ Published (winner live)
                                                         └──tie──▶ Tie — Needs Decision ──resolve──▶ Published
```

**Rules**
- R-6.16.1: Only **one** cycle may exist per (type, period). No two Month cycles for September 2026.
- R-6.16.2: Cycles open and close automatically at their scheduled timestamps via a scheduled job. Manual open/close is an override and is audit-logged.
- R-6.16.3: All timestamps are stored in UTC and displayed in the configured company timezone (default **Asia/Kolkata**). Window boundaries shown to users must be unambiguous and carry the timezone label.
- R-6.16.4: Closing is irreversible except through an explicit **Reopen** action, which requires a typed reason, is audit-logged, notifies all employees, and invalidates any frozen tally.
- R-6.16.5: A cycle cannot open if the directory holds fewer than 3 active employees — anonymity would be impossible.
- R-6.16.6: Default schedule — Month cycle opens on the 1st at 09:00 and closes on the last day at 18:00; Year cycle opens 1 Dec 09:00 and closes 31 Dec 18:00. Both overridable per cycle.

---

### 6.17 🔒 Admin — Publish Winners & Work Demo

**Purpose:** Turn a closed tally into a celebrated winner.

**Flow:** Select a closed cycle → review the frozen tally → the system pre-selects the computed winner (or shows the tie state) → admin writes the **citation** → optionally selects anonymised quotes to feature → builds the **Work Showcase** (6.11 blocks) → Preview → **Publish**.

**Rules**
- R-6.17.1: The winner defaults to the computed top-ranked nominee. An admin **override is allowed but requires a typed justification**, is recorded in the audit log, is visible to Auditors, and appears in the Winners Report Decision column (6.9.2). The leaderboard stays as computed — an override never rewrites vote data.
- R-6.17.2: The citation is mandatory, 50–1000 characters.
- R-6.17.3: A winner may be published without a showcase; the showcase can follow later. The Winners menu and the Winners Report show "Not added" in the interim.
- R-6.17.4: Publishing triggers winner notifications, releases feedback visibility for that cycle per R-6.7.2, and makes the row appear in the Winners Report.
- R-6.17.5: Unpublishing is possible but audit-logged and notified — an exception path, not routine. An unpublished winner disappears from Employee views of the Winners Report and stays visible, badged, to Admin/Auditor.

---

### 6.18 🔒 Admin — Employee Directory

*(Scope depends on **OQ-2**. Specified here as admin-managed; if HRMS-sourced, these screens become read-only plus a sync status panel.)*

**Grid columns:** Photo · Employee Code · Full Name · Work Email · Designation · Department · Location · Date of Joining · Role · Status · Last Login · Awards Won — all filterable and sortable per Section 11; default sort Full Name ascending.

**Actions:** Add employee · Edit · Deactivate / Reactivate · Change role · Send password reset · **Bulk import from CSV** (downloadable template, dry-run validation pass, per-row error report) · Export.

**Rules**
- R-6.18.1: Work email is unique and immutable after creation — it is the login identity. Correcting a typo requires an explicit, audit-logged email-change action.
- R-6.18.2: Employees are **never hard-deleted** — deactivate only. Their historical votes, feedback, and wins remain intact and correctly attributed.
- R-6.18.3: A deactivated employee cannot log in, cannot be nominated in new cycles, and disappears from nominee pickers — but remains visible in past results, the Hall of Fame, and the Winners Report.
- R-6.18.4: There must always be at least one active Admin; the system blocks removing the last one.
- R-6.18.5: An admin cannot change their own role — prevents accidental lockout and self-escalation.

---

### 6.19 🔒 Admin — Analytics & Exports

Participation and behaviour analysis. Distinct from the Winners Report (6.9), which is the award record.

| Report | Contents |
|---|---|
| **Participation** | Per cycle: voters vs eligible, %, trend over the last 12 cycles, department and location breakdown, list of non-voters |
| **Nominee summary** | Per cycle: every nominee with vote count, average rating, rating spread |
| **Appreciation heatmap** | Who appreciates whom; department → department matrix (surfaces silos and reciprocal-voting patterns) |
| **Rating analysis** | Distribution, average by department, outlier voters (always-10 or always-low raters) |
| **Winner history** | Summary roll-up: repeat winners, department distribution, gaps — drill-through opens the Winners Report (6.9) |
| **Engagement** | Logins, feedback pages viewed, showcase views |
| **Feedback quality** | Average answer length, share of flagged content |

**Rules**
- R-6.19.1: Every report is filterable by date range, award type, department, and location, and exportable to **Excel (.xlsx)** and **PDF**. All tabular output obeys Section 11.
- R-6.19.2: Reports must not expose individual voter→nominee mapping in Employee-facing contexts. Admin/Auditor exports may include it and must be watermarked *"Confidential — contains voter identity"*.
- R-6.19.3: Exports are generated server-side; large exports run as background jobs and are delivered by notification with a signed download link valid for 24 hours.

---

### 6.20 🔒 Admin — Audit Log

Immutable, append-only. Every entry records: timestamp (UTC), actor, actor role, IP, user agent, action, target entity, and before/after values.

**Grid columns:** Timestamp · Actor · Actor Role · Action · Entity Type · Entity · IP Address — all filterable and sortable per Section 11; default sort Timestamp descending.

**Logged actions (minimum):** login success/failure, lockout, password reset/change, role change, employee created/edited/deactivated, cycle created/opened/closed/extended/reopened/cancelled, vote submitted/edited/withdrawn/removed-by-admin, tally recomputed, winner published/overridden/unpublished, showcase published/edited, settings changed, report exported.

**Rules**
- R-6.20.1: Audit entries can never be edited or deleted through the application, by any role.
- R-6.20.2: Retention ≥ 3 years (setting `audit_retention_years`).
- R-6.20.3: Filterable by actor, action type, date range, and entity; exportable.

---

### 6.21 🔒 Admin — System Settings

| Setting | Default | Notes |
|---|---|---|
| `company_timezone` | Asia/Kolkata | All window boundaries |
| `allowed_email_domains` | isgesolutions.com | Login gate |
| `max_votes_per_voter_per_cycle` | 1 | OQ-1 |
| `allow_self_vote` | false | Locked off per approved policy |
| `allow_edit_until_close` | true | Locked on per approved policy |
| `results_visibility` | after_close | Locked per approved policy |
| `min_feedback_reveal_count` | 3 | Anonymity protection, R-6.7.2 |
| `eoy_candidate_pool` | all | OQ-3 |
| `winner_cooldown_months` | 0 | OQ-4 |
| `winners_report_visibility` | all_employees | OQ-7 |
| `winners_report_default_date_basis` | announced_on | R-6.9.3 |
| `winner_can_edit_showcase` | false | R-6.11.6 |
| `auto_open_close_cycles` | true | Scheduler |
| `reminder_days_before_close` | 3, 1 | Notification cadence |
| `default_page_size` | 25 | Grids, DG-10 |
| `tutorials_enabled` | true | Master switch for 6.14 |
| `tutorial_ai_voice_profile` | (one profile) | R-6.14.3 — single voice across the library |
| `tutorial_ai_disclosure_text` | "Narration in this video is AI-generated." | R-6.14.5 |
| `tutorial_pronunciation_lexicon` | company & product terms | R-6.14.4 |
| `onboarding_playlist_required` | false | If true, new joiners are prompted until complete |
| `tutorial_completion_threshold_pct` | 90 | R-6.14.6 |
| `tutorial_default_locale` | en | R-6.14.10 |
| Field min/max lengths | per 6.4 | Validation |
| `audit_retention_years` | 3 | R-6.20.2 |
| Branding | logo, primary colour, app name | |

Every settings change is audit-logged with before/after values. Changes to `max_votes_per_voter_per_cycle` or `min_feedback_reveal_count` apply only to cycles opened afterwards — never retroactively to an open or closed cycle.

---

## 7. Logical Data Model

Entities and their meaningful attributes. Relationships are stated; physical types, indexes, and keys are left to implementation.

**Employee** — id · employee_code · full_name · work_email (unique) · password_hash · designation · department · location · date_of_joining · photo_url · role (Employee|Admin|Auditor) · status (Active|Inactive) · must_change_password · failed_login_count · locked_until · last_login_at · notification_prefs · created_at · updated_at

**VotingCycle** — id · award_type (Month|Year) · period_label ("2026-09" / "2026") · opens_at · closes_at · status (Draft|Open|Closed|Tallied|TieNeedsDecision|Published|Cancelled) · created_by · closed_at · closed_by · reopen_reason · created_at · updated_at
*Unique on (award_type, period_label).*

**Vote** — id · cycle_id → VotingCycle · voter_id → Employee · nominee_id → Employee · reason_text · comparison_text · suggestion_text · rating (1–10) · status (Draft|Submitted|Withdrawn|RemovedByAdmin) · submitted_at · last_edited_at · edit_count · flagged · flag_reason · created_at · updated_at
*Unique on (cycle_id, voter_id) while `max_votes_per_voter_per_cycle = 1`. Constraint: voter_id ≠ nominee_id.*

**VoteVersion** — id · vote_id → Vote · version_no · snapshot of all answer fields and rating · changed_at · changed_by
*Append-only; supports R-6.4.4 and the audit trail.*

**CycleResult** — id · cycle_id → VotingCycle · nominee_id → Employee · vote_count · average_rating · high_rating_count · rank · is_winner · computed_at
*The frozen snapshot from R-6.8.4.*

**Winner** — id · cycle_id → VotingCycle · employee_id → Employee · citation · final_vote_count · final_average_rating · is_override · override_justification · is_co_winner · published_at · published_by · status (Draft|Published|Unpublished)
*Primary source for the Winners Report (6.9). `published_at` is the announcement date used by R-6.9.3.*

**Showcase** — id · winner_id → Winner · title · summary · status (Draft|Published) · published_at · created_by · updated_at

**ShowcaseBlock** — id · showcase_id → Showcase · sort_order · block_type (RichText|Image|Video|Document|Link|Metric|Quote) · content · media_id → MediaAsset · alt_text · caption

**MediaAsset** — id · owner_type · owner_id · file_name · mime_type · size_bytes · storage_key · checksum · scan_status (Pending|Clean|Infected) · uploaded_by · uploaded_at

**Notification** — id · recipient_id → Employee · type · title · body · link_url · is_read · read_at · created_at

**Announcement** — id · title · body · starts_at · ends_at · created_by · is_active

**TutorialVideo** — id · title · slug · description · category · sort_order · duration_seconds · media_id → MediaAsset · poster_media_id → MediaAsset · locale · script_text · script_version · narration_voice_profile · narration_generated_at · captions_vtt · transcript_text · chapters · applies_to_app_version · status (Draft|Published|Stale|Archived) · visible_to_roles · in_onboarding_playlist · published_at · created_by · updated_at
*The script, captions, and transcript are stored with the record so narration can be regenerated without re-recording (R-6.14.1). One row per locale per tutorial (R-6.14.10).*

**TutorialProgress** — id · employee_id → Employee · tutorial_id → TutorialVideo · first_viewed_at · last_position_seconds · percent_watched · completed_at · view_count
*Backs resume-playback and the onboarding progress ring. Restricted use per R-6.14.11.*

**AuditLog** — id · occurred_at · actor_id · actor_role · ip_address · user_agent · action · entity_type · entity_id · before_json · after_json
*Append-only.*

**GridPreference** — id · employee_id → Employee · grid_key · visible_columns · column_order · page_size · default_sort · updated_at
*Backs DG-8; one row per user per grid.*

**Setting** — key · value · value_type · updated_by · updated_at

**Session / RefreshToken** — id · employee_id · issued_at · expires_at · device_label · ip · revoked_at

**PasswordResetToken** — id · employee_id · token_hash · expires_at · used_at

### 7.1 Integrity rules

- IR-1: `Vote.voter_id ≠ Vote.nominee_id` — enforced at the database level, not only in the UI.
- IR-2: Votes may be inserted or updated only when the parent cycle is `Open` and the current time is inside the window — enforced server-side.
- IR-3: Employees are never deleted; only their status changes.
- IR-4: `CycleResult` rows are written once at close and are immutable unless an explicit recompute occurs, which is audit-logged and replaces the whole set.
- IR-5: A cycle has at most one `Published` winner, except in an admin-declared co-winner tie (R-6.8.2), where multiple are permitted and flagged via `is_co_winner`.
- IR-6: Columns used as grid filters or sorts must be indexed — in particular `Winner.published_at`, `VotingCycle.period_label`, `VotingCycle.closes_at`, `Employee.department`, and `AuditLog.occurred_at`. Unindexed sortable columns will not meet NF-12.

---

## 8. Core Business Rules (consolidated)

| ID | Rule |
|---|---|
| BR-1 | Only active employees may log in, vote, or be nominated in an open cycle. |
| BR-2 | An employee cannot vote for themselves (UI + server + database constraint). |
| BR-3 | One vote per voter per cycle (configurable, default 1). |
| BR-4 | Votes may be edited or withdrawn freely until the window closes; every change is versioned. |
| BR-5 | Results, standings, and per-nominee counts are hidden from Employees until the cycle closes. |
| BR-6 | The nominee never learns who voted for them; admins can, and this is disclosed. |
| BR-7 | Feedback is revealed to a nominee only after close **and** at or above the minimum-count threshold. |
| BR-8 | Winner = highest vote count; ties broken by average rating, then count of 9–10 ratings, then earliest first vote, then admin decision with written justification. |
| BR-9 | The tally is frozen at close; changing a published result requires an explicit, logged, notified re-publish. |
| BR-10 | All rule enforcement is server-side and clock-authoritative; the browser is never trusted. |
| BR-11 | No destructive deletes anywhere — deactivate, withdraw, or unpublish instead. |
| BR-12 | Every state-changing action by any role is written to the audit log. |
| BR-13 | Award history is permanent: a published award is never removed from the record, only unpublished with an audit trail. |
| BR-14 | Every grid in the application supports per-column filtering and sorting, on every screen size (Section 11). |
| BR-15 | Every tutorial video ships with captions and a transcript, discloses its AI narration, and contains no real employee data. |
| BR-16 | Tutorial watch data is never used for evaluation, ranking, or any employee-facing report. |

---

## 9. Validation Summary

| Field | Rule | Message |
|---|---|---|
| Email | Required, valid format, allowed domain | "Enter your work email address." |
| Password (login) | Required | "Enter your password." |
| Password (set) | Policy in 6.2 | Name the specific unmet rule, not a generic failure |
| Nominee | Required, active, not self, not on cooldown | "Choose a colleague. You can't vote for yourself." |
| Reason | 30–1000 chars | "Tell us a bit more — at least 30 characters." |
| Comparison | 30–1000 (Month) / 50–1000 (Year) | "Explain what set them apart." |
| Suggestion | 20–500 chars | "Share one suggestion — at least 20 characters." |
| Rating | Integer 1–10 | "Pick a rating from 1 to 10." |
| Citation | 50–1000 chars | "A citation is required before publishing." |
| Uploads | Type, size, count per R-6.11.3 | Name the actual limit that was exceeded |
| Report date range | From ≤ To; range ≤ 10 years | "The start date must be before the end date." |

**Rule R-9.1:** Validate on blur, not on every keystroke. Show errors inline beneath the field; on submit, focus and scroll to the first error; announce errors to screen readers through a live region.

---

## 10. Empty, Loading & Error States

Every list, tile, and page must define all four. Minimum set:

- **Loading** — skeleton placeholders matching the final layout, never a bare full-page spinner.
- **Empty** — an explanatory sentence plus the action that resolves it ("No cycle is open. The next opens 1 Oct." / "No feedback yet — it appears after the cycle closes.").
- **Empty after filtering** — distinct from empty data: "No rows match your filters" plus a Clear Filters action (DG-13).
- **Error** — plain-language cause and a Retry action; never a raw stack trace or bare error code.
- **Offline / request failed** — a banner, with unsaved vote content preserved locally and resubmittable.
- **403** — "You don't have access to this page." with a link back to the Dashboard.
- **404** — friendly page with navigation back.
- **Session expired** — a modal prompting re-login that returns the user to where they were, preserving draft input.

---

## 11. Data Grid Standard

**This section is binding on every tabular surface in the application.** It exists so that filtering and sorting are built once as a shared component rather than reinvented, inconsistently, per screen.

### 11.1 Grids in scope

| Grid | Key | Default sort |
|---|---|---|
| My Votes (6.6) | `my_votes` | Submitted On ↓ |
| Results Leaderboard (6.8) | `leaderboard` | Rank ↑ |
| **Winners Report (6.9)** | `winners_report` | Period ↓ |
| Hall of Fame (6.10, grid view) | `hall_of_fame` | Period ↓ |
| Notifications (6.12) | `notifications` | Created ↓ |
| Admin — Voting Cycles (6.16) | `cycles` | Opens At ↓ |
| Admin — Employee Directory (6.18) | `employees` | Full Name ↑ |
| Admin — Tutorial Library (6.14.7) | `tutorials` | Category, then sort order ↑ |
| Admin — Analytics tables (6.19) | `analytics_*` | Per report |
| Admin — Audit Log (6.20) | `audit_log` | Timestamp ↓ |

Any grid added later inherits this section by default.

### 11.2 Requirements

- **DG-1 · Sorting on every column.** Tri-state per column: ascending → descending → none. Activated by clicking the header or pressing Enter/Space when focused. A visible direction indicator and `aria-sort` are mandatory.
- **DG-2 · Filtering on every column**, with the control matched to the data type:

  | Data type | Filter control |
  |---|---|
  | Text | Contains / starts with / equals, case-insensitive |
  | Enum or status | Multi-select checkbox list of the distinct values, with counts |
  | Number or rating | Range (min–max) or operator (=, >, <, between) |
  | Date | Date range picker with presets (This Month, Last Month, This Year, Last Year, Custom) |
  | Person | Searchable multi-select showing avatar and name |
  | Boolean | Yes / No / Any |

- **DG-3 · Filter combination.** Filters on different columns combine with **AND**; multiple selections within one column combine with **OR**. The behaviour must be stated in the UI, not left to be guessed.
- **DG-4 · Multi-column sort.** Shift-click adds a secondary (then tertiary) sort, with the precedence number shown in each header. Single-column sort is the mandatory minimum; multi-sort is strongly recommended for the Winners Report and Audit Log.
- **DG-5 · Global search.** A single search box above each grid that searches the grid's key text columns simultaneously, in addition to per-column filters.
- **DG-6 · Active filter chips.** A chip bar above the grid shows every applied filter as a removable chip, plus **Clear all**. A user must never be confused about why rows are missing.
- **DG-7 · Shareable state.** Filter, sort, grouping, and page state persist in the URL query string, so a view survives refresh and back-navigation and can be shared by link. **Encode employee identifiers as ids or employee codes, never names or email addresses** — personal data must not appear in URLs (NF-9).
- **DG-8 · Column control.** Users can show/hide columns and reorder them by drag. The choice persists per user per grid (`GridPreference`), with a **Reset to default** action.
- **DG-9 · Server-side processing.** For any grid that can exceed 200 rows, filtering, sorting, and pagination execute on the server. Never fetch the full dataset and filter in the browser — it breaks at scale and leaks data the user may not be entitled to see.
- **DG-10 · Pagination.** Page sizes 25 / 50 / 100 (default from `default_page_size`), with "Showing X–Y of Z". Card views on mobile may use virtualised infinite scroll instead, but must still display the total count.
- **DG-11 · Exports follow the view.** Excel and PDF exports honour the active filters, sort order, grouping, and visible columns, and record the applied filters in the export header.
- **DG-12 · Responsiveness of the interaction.** Filter input is debounced 300ms. While loading, the grid shows a loading overlay on the existing rows rather than blanking to empty — no content flash.
- **DG-13 · Empty-after-filter state** is distinct from empty-data state and always offers Clear Filters.
- **DG-14 · Accessibility.** Real table semantics (or correct ARIA grid roles); sortable headers are buttons; `aria-sort` reflects state; filter popovers trap focus and close on Esc; the result count after filtering is announced in a live region; the whole grid is keyboard-navigable without a mouse.
- **DG-15 · Mobile parity.** Below 768px a grid renders as a card list (RR-6). Sorting and filtering are **not reduced** — a sticky toolbar provides:
  - **Sort** — opens a bottom sheet listing every sortable column as a radio group plus an ascending/descending toggle.
  - **Filter** — opens a full-screen sheet containing every column filter, grouped and collapsible, with an applied-count badge on the button and **Apply** / **Reset** actions pinned to the bottom.
  - **Search** — the global search box, collapsible into an icon.

  Any capability available on desktop must be reachable on a 320px phone.
- **DG-16 · Explicit defaults.** Every grid declares its default sort and default visible columns (see 11.1). "Whatever the database returns" is not a default.
- **DG-17 · Role-aware columns.** Columns carrying restricted data — voter identity, Announced By, Decision — are excluded **server-side** for roles that may not see them. Hiding a column with CSS while the data ships in the API response is a data leak, not a permission.

---

## 12. Responsive Design Requirements

Responsiveness is a hard acceptance criterion, not a nice-to-have.

### 12.1 Breakpoints

| Name | Range | Representative devices |
|---|---|---|
| XS | 320–374px | iPhone SE, small Android |
| SM | 375–429px | iPhone 13/14/15, Pixel |
| MD | 430–767px | iPhone Pro Max, large Android, small tablets portrait |
| LG | 768–1023px | iPad, iPad Mini, tablets |
| XL | 1024–1279px | iPad Pro landscape, small laptops |
| 2XL | 1280–1535px | Standard desktop |
| 3XL | ≥ 1536px | Large/wide monitors — content max-width capped and centred |

### 12.2 Mandatory rules

- RR-1: **Mobile-first.** Base styles target XS; larger breakpoints add, never subtract.
- RR-2: **No horizontal scrolling of the page at any width from 320px upward**, on any screen. A wide grid may scroll horizontally *within its own container*, never by moving the page.
- RR-3: Minimum touch target **44×44px**, with at least 8px between adjacent targets.
- RR-4: Body text ≥ 16px on mobile (prevents iOS input zoom); never below 12px anywhere.
- RR-5: Side gutters ≥ 16px mobile, 24px tablet, 32px desktop.
- RR-6: **Tables become cards below 768px**, retaining full sort and filter capability per DG-15. No pinch-to-read tables.
- RR-7: Images are fluid and declare intrinsic aspect ratios to avoid layout shift.
- RR-8: Modals become **full-screen sheets** below 768px; long forms get a sticky primary action.
- RR-9: Respect safe-area insets on notched devices, top and bottom.
- RR-10: Support portrait and landscape; landscape on a phone must not hide the primary action.
- RR-11: Text reflows without loss of function at 200% browser zoom.
- RR-12: Support light and dark themes, following the OS preference by default with a manual override.
- RR-13: Honour `prefers-reduced-motion` — disable non-essential animation.
- RR-14: Charts switch to a simplified rendering below 768px and must expose a table fallback of the same data.

### 12.3 Device test matrix (release gate)

iPhone SE (375×667) · iPhone 15 (393×852) · iPhone 15 Pro Max (430×932) · Pixel 8 (412×915) · Galaxy S (360×800) · iPad Mini (768×1024) · iPad Pro (1024×1366) · Laptop (1366×768) · Desktop (1920×1080) — each in portrait and landscape where applicable, on current Chrome, Safari, Edge, and Firefox.

---

## 13. Accessibility (WCAG 2.1 AA)

- A-1: Full keyboard operability; a visible focus indicator on every interactive element; logical tab order; a skip-to-content link.
- A-2: Text contrast ≥ 4.5:1; large text and UI components ≥ 3:1 — in both themes.
- A-3: Every input has a programmatically associated label. Placeholders are never used as labels.
- A-4: All images carry alt text; decorative images are marked as such.
- A-5: Correct semantic landmarks and heading hierarchy; one `h1` per page.
- A-6: Dynamic changes (validation errors, toasts, filtered row counts) announced via ARIA live regions.
- A-7: Modals and filter popovers trap focus, restore it to the trigger on close, and close on Esc.
- A-8: Information is never conveyed by colour alone — ratings, statuses, ranks, and sort direction carry text or icons too.
- A-9: All video supports captions with a transcript available. Mandatory and publish-blocking for tutorials (6.14.5); required for Showcase video wherever the source allows.

---

## 14. Non-Functional Requirements

**Security**
- NF-1: HTTPS only, HSTS enabled.
- NF-2: Passwords hashed with a modern adaptive algorithm and a per-user salt.
- NF-3: Authorisation enforced server-side on **every** request — never inferred from a hidden menu item or a hidden column.
- NF-4: Protection against the OWASP Top 10: parameterised queries, output encoding, CSRF protection on state-changing requests, a strict Content-Security-Policy, and secure/HttpOnly/SameSite cookies or equivalent token handling.
- NF-5: File uploads — MIME sniffing, size limits, virus scanning, storage outside the web root, and service through short-lived signed URLs.
- NF-6: Rate limiting on login, password reset, and vote submission endpoints.
- NF-7: No secrets in source control; configuration supplied by environment.
- NF-8: Dependency vulnerability scanning in CI.
- NF-9: Sort and filter parameters arriving from the client are **allow-listed against known column names**, never interpolated into a query. A grid is a query builder pointed at your database — treat it as hostile input.

**Privacy**
- NF-10: Voter identity is personal data — restricted to Admin/Auditor, disclosed on the Help page, and absent from every Employee-facing API response. Verify the payload, not just the UI.
- NF-11: Anonymity is protected by the reveal threshold (R-6.7.2), not by UI omission alone.
- NF-12: Personal data (names, emails) never appears in URL query strings, including shareable grid-state links (DG-7).

**Performance**
- NF-13: First Contentful Paint ≤ 1.5s and Largest Contentful Paint ≤ 2.5s on a mid-range phone over 4G.
- NF-14: API responses ≤ 500ms at p95 under expected load, including filtered and sorted grid queries. Requires the indexes in IR-6.
- NF-15: Lists are paginated (default 25) or virtualised; no unbounded fetches.
- NF-16: Sized for 2,000 employees and 5 years of history without redesign.

**Reliability & operations**
- NF-17: Daily automated backups; restore procedure tested quarterly.
- NF-18: Structured application logging with correlation IDs; no personal data or secrets in logs.
- NF-19: Health-check endpoint and uptime monitoring.
- NF-20: Scheduled jobs (cycle open/close, reminders) must be idempotent and safe to re-run.

**Compatibility**
- NF-21: Latest two versions of Chrome, Edge, Firefox, and Safari (desktop and iOS). No Internet Explorer.

**Localisation-readiness**
- NF-22: All user-facing strings externalised; dates, times, and numbers formatted per locale; layout tolerant of roughly 30% string expansion.

---

## 15. Acceptance Criteria (samples — the pattern for all features)

**AC-1 · Self-voting is impossible**
Given I am a logged-in employee and a Month cycle is open, when I open the nominee list, then my own name does not appear; and when a crafted request submits my own id as nominee, then the server rejects it with a validation error and no vote is created.

**AC-2 · Results stay hidden while open**
Given a cycle is Open, when I view Results as an Employee, then I see only the participation percentage and a closing date, and no API response available to my role contains any per-nominee vote count.

**AC-3 · Editing works until close, and not after**
Given I submitted a vote and the window is open, when I change the rating and the suggestion and save, then the vote reflects the new values, `edit_count` increments, a new VoteVersion row exists, and the nominee (post-close) sees only the latest version. Given the window has closed, when I open my vote, then Edit and Withdraw are disabled with the reason shown.

**AC-4 · Anonymity holds**
Given I received 4 votes in a closed cycle, when I open Feedback for Me, then each card shows the rating and the three texts with no voter name, email, avatar, department, or precise timestamp; and the API response backing the page contains no voter identifier in any form.

**AC-5 · Anonymity threshold**
Given I received 2 votes in a closed cycle and the threshold is 3, when I open Feedback for Me, then no feedback content is shown and the threshold message is displayed.

**AC-6 · Tie handling**
Given two nominees finish with equal vote counts, equal average ratings, equal counts of 9–10 ratings, and equal first-vote timestamps, when the cycle closes, then its status becomes `Tie — Needs Decision`, no winner is auto-published, and admins are notified.

**AC-7 · Mobile layout**
Given any screen in the application, when rendered at 320px width, then no horizontal page scrollbar appears, no text is clipped, every primary action is reachable, and every tappable control is at least 44×44px.

**AC-8 · Automatic close**
Given a cycle whose `closes_at` has passed, when the scheduler runs, then the cycle is Closed, the tally is computed and frozen, no further votes are accepted, and admins are notified that a winner is ready to publish.

**AC-9 · Audit completeness**
Given an admin overrides the computed winner, when the override is saved, then an audit entry records the actor, timestamp, computed winner, chosen winner, and typed justification, and that entry cannot be edited or deleted through the application.

**AC-10 · Winners Report, month-wise**
Given awards exist for Jan–Sep 2026, when I open the Winners Report in Month-wise view and filter Year = 2026, then I see exactly nine rows, one per month, each showing the month, winner name, department, votes received, and announcement date, sorted newest first.

**AC-11 · Winners Report, date-wise with an explicit basis**
Given the September 2026 winner was announced on 3 October 2026, when I filter the Date-wise view to 1–31 October 2026 with the basis set to **Announcement Date**, then that winner appears; and when I switch the basis to **Award Period**, then that winner does not appear and the September range returns them instead — with the active basis labelled on screen and written into any export.

**AC-12 · Every grid filters and sorts**
Given any grid in the application, when I click a column header, then the rows sort by that column and the indicator and `aria-sort` update; and when I open that column's filter and apply a value, then only matching rows remain, a removable chip appears in the filter bar, the result count is announced to screen readers, and the filtered state is reflected in the URL.

**AC-13 · Grid parity on mobile**
Given the Winners Report at 375px width, when I tap Filter, then a full-screen sheet offers every column filter available on desktop; and when I tap Sort, then every sortable column is offered with a direction toggle; and the applied filters produce the same rows as the identical desktop query.

**AC-14 · Export mirrors the view**
Given I have filtered the Winners Report to Department = Engineering, sorted by Votes Received descending, and hidden the Citation column, when I export to Excel, then the file contains exactly those rows in that order without the Citation column, and its header records the filters applied, the date basis, the generating user, and the timestamp.

**AC-15 · A tutorial cannot ship without captions and a transcript**
Given an admin has uploaded a tutorial video with no captions, when they attempt to publish it, then publishing is blocked with a message naming the missing items; and given a published tutorial, when I open it, then captions are on by default, the transcript is searchable, and clicking a transcript line seeks the video to that moment.

**AC-16 · Resume across devices**
Given I watched 2:30 of a 5-minute tutorial on my laptop and closed it, when I open the same tutorial on my phone, then playback offers to resume at 2:30; and given I reach 90% of its length, then it is marked complete and the onboarding progress ring updates.

**AC-17 · No real data appears in any tutorial**
Given any published tutorial video, when it is reviewed frame by frame, then no real employee name, email, photo, vote text, rating, or feedback appears — every person and record shown comes from the documented demo seed dataset.

**AC-18 · Stale tutorials are flagged, not silently wrong**
Given a tutorial recorded against app version 1.4 and the screen it covers has changed in version 1.6, when the version is marked as superseded, then the tutorial shows a "May be out of date" badge to every viewer, appears in the admin stale queue, and the admins are notified.

**AC-19 · Admin tutorials are not merely hidden**
Given I am an Employee, when I request the tutorial library, then the API response contains no admin-category tutorial in any form — not returned and hidden, but absent — and a direct request for an admin tutorial's id returns 403.

---

## 16. Out of Scope (v1)

Peer-to-peer kudos / points / redeemable rewards · team or project awards · manager approval workflows · social feeds, comments, likes · Slack or Teams integration · SSO (SAML/OAuth) · native mobile apps · multi-tenant / multi-company · public external sharing of showcases · AI-generated citations or feedback summarisation · self-nomination · scheduled emailed reports · employee-uploaded videos · live training webinars · interactive in-app product tours (tooltip walkthroughs) · tutorial narration in languages other than English.

Several of these — SSO, Slack notifications, kudos, scheduled reports, additional narration languages — are strong v2 candidates. The data model above does not block them; `TutorialVideo` is already keyed by locale.

---

## 17. Suggested Delivery Phases

| Phase | Contents | Outcome |
|---|---|---|
| **P0 — Foundation** | Data model, auth (login, reset, sessions, roles), employee directory, app shell and responsive navigation, **shared data-grid component (Section 11)**, settings | Users can log in and move around; every later grid reuses one component |
| **P1 — Voting core** | Cycles admin, Vote EoM, Vote EoY, My Votes, validation, open/close scheduler | Votes can be collected |
| **P2 — Results & feedback** | Tally engine, tie-break, Results & Leaderboard, Feedback for Me with threshold, notifications | A cycle completes end to end |
| **P3 — Celebration** | Publish Winners, Hall of Fame, Work Showcase with media, Dashboard enrichment | The product delivers its emotional payoff |
| **P4 — Reporting & governance** | **Winners Report (6.9)**, Analytics & Exports, audit log UI, abuse flagging and moderation, **Tutorial Library platform (6.14)** | Ready for org-wide rollout and HR record-keeping |
| **P5 — Hardening & training content** | Accessibility audit, device matrix testing, performance tuning, security review, UAT, **tutorial recording and narration** | Production release with a complete tutorial library |

**Two sequencing notes:**

1. **Build the grid component in P0, not P4.** Retrofitting per-column filter and sort onto nine screens that were each built their own way is the single most expensive mistake available in this project.

2. **Build the tutorial *platform* in P4, but record the *videos* last.** Footage cannot be captured until the UI is frozen — anything recorded earlier will be re-recorded. Script writing can begin in P4 in parallel (scripts are cheap to revise; video is not), and narration is generated from those scripts once the screens are final in P5. Budget the demo seed dataset (R-6.14.6) as a real deliverable, not an afterthought — every video depends on it existing and being stable.

---

## 18. Approved Policy Decisions (baseline — locked unless changed here)

| Decision | Choice |
|---|---|
| Delivery | Technology-agnostic requirements; stack chosen separately |
| Winner determination | Automatic tally, hidden until the voting window closes |
| Anonymity | Anonymous to the nominee; visible to Admin/Auditor for audit, disclosed to all |
| Self-voting | Not allowed |
| Vote editing | Allowed until the window closes |
| Votes per cycle | One per voter per cycle *(default — pending OQ-1)* |
| Admin capabilities | Open/close voting windows · Publish winners & work demo · Analytics & audit *(employee directory management included by necessity — pending OQ-2)* |
| Winners reporting | Dedicated Winners Report menu, date-wise and month-wise, for Month and Year awards, exportable |
| Grids | Every grid supports per-column filtering and sorting, at every screen size |
| Training | Dedicated Video Tutorials menu with AI-narrated, captioned walkthroughs and a new-joiner onboarding playlist |

---

## 19. Change Log

| Version | Date | Change | Author |
|---|---|---|---|
| 1.0 | 2026-09-21 | Initial baseline specification | Drafted for ganesh@isgesolutions.com |
| 1.2 | 2026-09-22 | Added Video Tutorials (6.14) — AI-narrated, captioned tutorial library with onboarding playlist, transcripts, resume playback, progress tracking, and admin Tutorial Library management (6.14.7); added production rules R-6.14.1–11 covering script-as-source-of-truth, caption generation, voice consistency, AI disclosure, and the no-real-data requirement; added `TutorialVideo` and `TutorialProgress` entities, BR-15/16, AC-15–19, tutorial settings, notification events, and Dashboard onboarding block; grouped Help and Video Tutorials under a Help & Training menu; shifted sections 6.14–6.20 to 6.15–6.21 | Drafted for ganesh@isgesolutions.com |
| 1.1 | 2026-09-22 | Added Winners Report (6.9) with month-wise, year-wise, date-wise and combined views; added Section 11 Data Grid Standard (per-column filter and sort on every grid, with mobile parity); renumbered subsequent sections; added OQ-7, BR-13/14, IR-6, NF-9/12, AC-10–14, `GridPreference` entity, and grid columns to existing screens; renamed admin "Reports & Analytics" to "Analytics & Exports" to distinguish it from the new Reports menu | Drafted for ganesh@isgesolutions.com |
