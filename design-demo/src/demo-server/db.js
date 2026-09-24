/**
 * Design demo — the live app's db.js, re-pointed at SQLite compiled to
 * WebAssembly (sql.js). It exposes the small slice of the better-sqlite3 API
 * the routes use — prepare().all/get/run, transaction, exec, pragma — so the
 * route files are copied from the real server unchanged.
 */
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import schemaSql from './schema.sql?raw';

export const dbPath = 'browser (sql.js)';

/* ------------------------------------------------ better-sqlite3 facade */

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array);
const toSql = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Statement {
  constructor(conn, sql) {
    this.conn = conn;
    // Positional '?' become named '@__pN', so positional and named
    // parameters can be mixed in one call, exactly as better-sqlite3 allows.
    let n = 0;
    this.sql = sql.replace(/\?/g, () => `@__p${n++}`);
  }

  bindings(args) {
    const out = {};
    let i = 0;
    for (const a of args) {
      if (isPlain(a)) for (const [k, v] of Object.entries(a)) out[`@${k}`] = toSql(v);
      else out[`@__p${i++}`] = toSql(a);
    }
    return out;
  }

  rows(args) {
    const stmt = this.conn.raw.prepare(this.sql);
    try {
      stmt.bind(this.bindings(args));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  all(...args) { return this.rows(args); }
  get(...args) { return this.rows(args)[0]; }

  run(...args) {
    const stmt = this.conn.raw.prepare(this.sql);
    try {
      stmt.bind(this.bindings(args));
      stmt.step();
    } finally {
      stmt.free();
    }
    this.conn.dirty = true;
    const changes = this.conn.raw.getRowsModified();
    const id = this.conn.raw.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
    return { changes, lastInsertRowid: id };
  }
}

class Connection {
  constructor(raw) { this.raw = raw; this.depth = 0; this.dirty = false; }
  prepare(sql) { return new Statement(this, sql); }
  exec(sql) { this.raw.exec(sql); this.dirty = true; return this; }
  pragma(text) { try { this.raw.exec(`PRAGMA ${text}`); } catch { /* not applicable in memory */ } }
  transaction(fn) {
    return (...args) => {
      const sp = `sp${this.depth}`;
      this.raw.exec(this.depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      this.depth++;
      try {
        const out = fn(...args);
        this.depth--;
        this.raw.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        this.dirty = true;
        return out;
      } catch (e) {
        this.depth--;
        this.raw.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}`);
        throw e;
      }
    };
  }
}

/** Live binding — assigned by openDatabase() before any route runs. */
export let db = null;

export async function openDatabase(bytes) {
  // In the single-file build the engine is inlined as a data: URL. Decoding
  // it here avoids a fetch, which browsers refuse on file:// pages.
  const SQL = await initSqlJs(wasmUrl.startsWith('data:')
    ? { wasmBinary: Uint8Array.from(atob(wasmUrl.slice(wasmUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0)) }
    : { locateFile: () => wasmUrl });
  db = new Connection(bytes ? new SQL.Database(bytes) : new SQL.Database());
  db.pragma('foreign_keys = ON');
  return db;
}

export function exportDatabase() {
  return db.raw.export();
}

/* ------------------------------------ unchanged from the live db.js below */

export function migrate() {
  db.exec(schemaSql.replace(/PRAGMA journal_mode = WAL;/, ''));
  seedDefaultSettings();
}

export const DEFAULT_SETTINGS = {
  company_timezone: 'Asia/Kolkata',
  allowed_email_domains: 'isgesolutions.com',
  max_votes_per_voter_per_cycle: '1',
  allow_self_vote: 'false',
  allow_edit_until_close: 'true',
  results_visibility: 'after_close',
  min_feedback_reveal_count: '3',
  eoy_candidate_pool: 'all',
  winner_cooldown_months: '0',
  winners_report_visibility: 'all_employees',
  winners_report_default_date_basis: 'announced_on',
  winner_can_edit_showcase: 'false',
  auto_open_close_cycles: 'true',
  reminder_days_before_close: '3,1',
  default_page_size: '25',
  tutorials_enabled: 'true',
  tutorial_ai_disclosure_text: 'Narration in this video is AI-generated.',
  onboarding_playlist_required: 'false',
  tutorial_completion_threshold_pct: '90',
  audit_retention_years: '3',
  min_active_employees_to_open: '3',
};

function seedDefaultSettings() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value, value_type) VALUES (?, ?, ?)');
  db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const type = /^(true|false)$/.test(value) ? 'boolean' : /^\d+$/.test(value) ? 'number' : 'string';
      insert.run(key, value, type);
    }
  })();
}

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}
export function getSettingInt(key) { return parseInt(getSetting(key), 10); }
export function getSettingBool(key) { return getSetting(key) === 'true'; }

export function setSetting(key, value, actorId) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`
  ).run(key, String(value), actorId ?? null);
}
