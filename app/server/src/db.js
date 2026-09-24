import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '..', 'data');
const dbPath = process.env.DB_PATH || path.join(dataDir, 'portal.sqlite');

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  db.exec(sql);
  seedDefaultSettings();
}

/**
 * SPEC 6.21 — every setting has a declared default. Changing
 * max_votes_per_voter_per_cycle or min_feedback_reveal_count affects only
 * cycles opened afterwards; the tally reads the value stored on the cycle.
 */
export const DEFAULT_SETTINGS = {
  company_timezone: 'Asia/Kolkata',
  allowed_email_domains: 'isgesolutions.com',
  max_votes_per_voter_per_cycle: '1',      // OQ-1
  allow_self_vote: 'false',                // locked off, BR-2
  allow_edit_until_close: 'true',          // locked on, BR-4
  results_visibility: 'after_close',       // locked, BR-5
  min_feedback_reveal_count: '3',          // R-6.7.2
  eoy_candidate_pool: 'all',               // OQ-3
  winner_cooldown_months: '0',             // OQ-4
  winners_report_visibility: 'all_employees',        // OQ-7
  winners_report_default_date_basis: 'announced_on', // R-6.9.3
  winner_can_edit_showcase: 'false',
  auto_open_close_cycles: 'true',
  reminder_days_before_close: '3,1',
  default_page_size: '25',
  tutorials_enabled: 'true',
  tutorial_ai_disclosure_text: 'Narration in this video is AI-generated.',
  onboarding_playlist_required: 'false',
  tutorial_completion_threshold_pct: '90',
  audit_retention_years: '3',
  min_active_employees_to_open: '3',       // R-6.16.5
};

function seedDefaultSettings() {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value, value_type) VALUES (?, ?, ?)'
  );
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const type = /^(true|false)$/.test(value)
        ? 'boolean'
        : /^\d+$/.test(value)
          ? 'number'
          : 'string';
      insert.run(key, value, type);
    }
  });
  tx();
}

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export function getSettingInt(key) {
  return parseInt(getSetting(key), 10);
}

export function getSettingBool(key) {
  return getSetting(key) === 'true';
}

export function setSetting(key, value, actorId) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`
  ).run(key, String(value), actorId ?? null);
}

export { dbPath };
