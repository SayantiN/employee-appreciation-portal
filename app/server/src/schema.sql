-- Employee Appreciation Portal — schema
-- Implements SPEC.md §7 (logical data model) and §7.1 (integrity rules).
-- Integrity rules are enforced here, in the database, not only in the UI.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- employees
CREATE TABLE IF NOT EXISTS employees (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code        TEXT    NOT NULL UNIQUE,
  full_name            TEXT    NOT NULL,
  work_email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,  -- R-6.18.1 immutable login identity
  password_hash        TEXT    NOT NULL,                        -- scrypt, per-user salt (NF-2)
  designation          TEXT    NOT NULL DEFAULT '',
  department           TEXT    NOT NULL DEFAULT '',
  location             TEXT    NOT NULL DEFAULT '',
  date_of_joining      TEXT,
  photo_url            TEXT,
  role                 TEXT    NOT NULL DEFAULT 'Employee'
                               CHECK (role IN ('Employee','Admin','Auditor')),
  status               TEXT    NOT NULL DEFAULT 'Active'
                               CHECK (status IN ('Active','Inactive')),   -- R-6.18.2 never deleted
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_login_count   INTEGER NOT NULL DEFAULT 0,
  locked_until         TEXT,
  last_login_at        TEXT,
  notification_prefs   TEXT    NOT NULL DEFAULT '{}',
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_employees_dept   ON employees(department);   -- IR-6
CREATE INDEX IF NOT EXISTS ix_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS ix_employees_name   ON employees(full_name);

-- ------------------------------------------------------------ voting cycles
CREATE TABLE IF NOT EXISTS voting_cycles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  award_type    TEXT NOT NULL CHECK (award_type IN ('Month','Year')),
  period_label  TEXT NOT NULL,                       -- '2026-09' or '2026'
  opens_at      TEXT NOT NULL,                       -- UTC ISO-8601 (R-6.16.3)
  closes_at     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Draft'
                CHECK (status IN ('Draft','Open','Closed','Tallied','TieNeedsDecision','Published','Cancelled')),
  created_by    INTEGER REFERENCES employees(id),
  closed_at     TEXT,
  closed_by     INTEGER REFERENCES employees(id),
  reopen_reason TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (closes_at > opens_at),
  UNIQUE (award_type, period_label)                  -- R-6.16.1 one cycle per type+period
);
CREATE INDEX IF NOT EXISTS ix_cycles_period ON voting_cycles(period_label);  -- IR-6
CREATE INDEX IF NOT EXISTS ix_cycles_closes ON voting_cycles(closes_at);
CREATE INDEX IF NOT EXISTS ix_cycles_status ON voting_cycles(status);

-- -------------------------------------------------------------------- votes
CREATE TABLE IF NOT EXISTS votes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id        INTEGER NOT NULL REFERENCES voting_cycles(id),
  voter_id        INTEGER NOT NULL REFERENCES employees(id),
  nominee_id      INTEGER NOT NULL REFERENCES employees(id),
  reason_text     TEXT    NOT NULL DEFAULT '',
  comparison_text TEXT    NOT NULL DEFAULT '',
  suggestion_text TEXT    NOT NULL DEFAULT '',
  rating          INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10)),
  status          TEXT    NOT NULL DEFAULT 'Draft'
                  CHECK (status IN ('Draft','Submitted','Withdrawn','RemovedByAdmin')),
  submitted_at    TEXT,
  last_edited_at  TEXT,
  edit_count      INTEGER NOT NULL DEFAULT 0,
  flagged         INTEGER NOT NULL DEFAULT 0,
  flag_reason     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (voter_id <> nominee_id),                    -- IR-1 no self-voting, at the database
  UNIQUE (cycle_id, voter_id)                        -- BR-3 one vote per voter per cycle
);
CREATE INDEX IF NOT EXISTS ix_votes_cycle   ON votes(cycle_id);
CREATE INDEX IF NOT EXISTS ix_votes_nominee ON votes(nominee_id);
CREATE INDEX IF NOT EXISTS ix_votes_status  ON votes(status);

-- Append-only version history. R-6.4.4 — every edit writes a new row.
CREATE TABLE IF NOT EXISTS vote_versions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id         INTEGER NOT NULL REFERENCES votes(id),
  version_no      INTEGER NOT NULL,
  nominee_id      INTEGER NOT NULL REFERENCES employees(id),
  reason_text     TEXT    NOT NULL DEFAULT '',
  comparison_text TEXT    NOT NULL DEFAULT '',
  suggestion_text TEXT    NOT NULL DEFAULT '',
  rating          INTEGER,
  status          TEXT    NOT NULL,
  changed_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  changed_by      INTEGER NOT NULL REFERENCES employees(id),
  UNIQUE (vote_id, version_no)
);

-- ------------------------------------------------------------ frozen tally
-- R-6.8.4 / IR-4 — written once at close, immutable unless explicitly recomputed.
CREATE TABLE IF NOT EXISTS cycle_results (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id          INTEGER NOT NULL REFERENCES voting_cycles(id),
  nominee_id        INTEGER NOT NULL REFERENCES employees(id),
  vote_count        INTEGER NOT NULL,
  average_rating    REAL    NOT NULL,
  high_rating_count INTEGER NOT NULL,                -- ratings of 9 or 10 (tie-break 3)
  first_vote_at     TEXT,                            -- tie-break 4
  rank              INTEGER NOT NULL,
  is_winner         INTEGER NOT NULL DEFAULT 0,
  computed_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cycle_id, nominee_id)
);

CREATE TABLE IF NOT EXISTS winners (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id               INTEGER NOT NULL REFERENCES voting_cycles(id),
  employee_id            INTEGER NOT NULL REFERENCES employees(id),
  citation               TEXT    NOT NULL DEFAULT '',
  final_vote_count       INTEGER NOT NULL DEFAULT 0,
  final_average_rating   REAL    NOT NULL DEFAULT 0,
  is_override            INTEGER NOT NULL DEFAULT 0,
  override_justification TEXT,
  is_co_winner           INTEGER NOT NULL DEFAULT 0,  -- IR-5
  published_at           TEXT,
  published_by           INTEGER REFERENCES employees(id),
  status                 TEXT    NOT NULL DEFAULT 'Draft'
                         CHECK (status IN ('Draft','Published','Unpublished'))
);
CREATE INDEX IF NOT EXISTS ix_winners_published ON winners(published_at);  -- IR-6
CREATE INDEX IF NOT EXISTS ix_winners_cycle     ON winners(cycle_id);

-- ------------------------------------------------------------------ sundry
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES employees(id),
  type         TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL DEFAULT '',
  link_url     TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  read_at      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_notif_recipient ON notifications(recipient_id, is_read);

CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  starts_at  TEXT,
  ends_at    TEXT,
  created_by INTEGER REFERENCES employees(id),
  is_active  INTEGER NOT NULL DEFAULT 1
);

-- Append-only. R-6.20.1 — the application offers no UPDATE or DELETE path.
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor_id    INTEGER REFERENCES employees(id),
  actor_role  TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT
);
CREATE INDEX IF NOT EXISTS ix_audit_time   ON audit_log(occurred_at);  -- IR-6
CREATE INDEX IF NOT EXISTS ix_audit_actor  ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS ix_audit_action ON audit_log(action);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  updated_by INTEGER REFERENCES employees(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grid_preferences (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id     INTEGER NOT NULL REFERENCES employees(id),
  grid_key        TEXT    NOT NULL,
  visible_columns TEXT,
  column_order    TEXT,
  page_size       INTEGER,
  default_sort    TEXT,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, grid_key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,               -- random 32 bytes, hex
  employee_id  INTEGER NOT NULL REFERENCES employees(id),
  issued_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,                  -- R-6.1.7 absolute lifetime
  device_label TEXT,
  ip           TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_employee ON sessions(employee_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  token_hash  TEXT    NOT NULL,
  expires_at  TEXT    NOT NULL,                -- 30 minutes (R-6.2)
  used_at     TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT,
  ip          TEXT,
  succeeded   INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_attempts_ip   ON login_attempts(ip, occurred_at);
CREATE INDEX IF NOT EXISTS ix_attempts_mail ON login_attempts(email, occurred_at);

-- ------------------------------------------------------ feedback moderation
-- R-6.7.4 — a nominee may report a card as abusive. It is hidden from them at
-- once and queued for admin review; the vote itself is not altered.
CREATE TABLE IF NOT EXISTS feedback_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id      INTEGER NOT NULL REFERENCES votes(id),
  reporter_id  INTEGER NOT NULL REFERENCES employees(id),
  reason       TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Upheld','Dismissed')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vote_id, reporter_id)
);

-- ------------------------------------------------------------ showcases
-- SPEC 6.11 — one showcase per published winner record. The body is an
-- ordered list of blocks (text, metric, link), stored as JSON.
CREATE TABLE IF NOT EXISTS showcases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  winner_id    INTEGER NOT NULL UNIQUE REFERENCES winners(id),
  status       TEXT    NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  body_json    TEXT    NOT NULL DEFAULT '[]',
  published_at TEXT,
  updated_by   INTEGER REFERENCES employees(id),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------ tutorials
-- SPEC 6.14. The script is the source of truth (R-6.14.1); captions and the
-- transcript are derived from it, never from the audio (R-6.14.2).
CREATE TABLE IF NOT EXISTS tutorials (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  title                  TEXT    NOT NULL,
  category               TEXT    NOT NULL,
  description            TEXT    NOT NULL DEFAULT '',
  duration_seconds       INTEGER NOT NULL DEFAULT 0,
  script                 TEXT    NOT NULL DEFAULT '',
  video_url              TEXT,
  audience               TEXT    NOT NULL DEFAULT 'All' CHECK (audience IN ('All','Admin')),
  status                 TEXT    NOT NULL DEFAULT 'Draft'
                                 CHECK (status IN ('Draft','Published','Stale','Archived')),
  in_onboarding          INTEGER NOT NULL DEFAULT 0,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  applies_to_app_version TEXT    NOT NULL DEFAULT '0.1',
  related_path           TEXT,
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- R-6.14.11 — support and onboarding only. Never joined into any ranking.
CREATE TABLE IF NOT EXISTS tutorial_progress (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tutorial_id  INTEGER NOT NULL REFERENCES tutorials(id),
  employee_id  INTEGER NOT NULL REFERENCES employees(id),
  percent      INTEGER NOT NULL DEFAULT 0,
  completed    INTEGER NOT NULL DEFAULT 0,
  first_viewed TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tutorial_id, employee_id)
);
