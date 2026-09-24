import { db, getSettingInt } from '../db.js';
import { auditSystem } from './audit.js';

export const nowIso = () => new Date().toISOString();

/**
 * BR-10 — the server clock decides. The client countdown is cosmetic.
 * A cycle is votable only when its stored status is Open AND now falls
 * inside the window (R-6.4.1, IR-2).
 */
export function isVotable(cycle, at = new Date()) {
  if (!cycle || cycle.status !== 'Open') return false;
  const t = at.toISOString();
  return t >= cycle.opens_at && t < cycle.closes_at;
}

export function windowState(cycle, at = new Date()) {
  const t = at.toISOString();
  if (cycle.status === 'Cancelled') return 'cancelled';
  if (cycle.status === 'Draft') return t < cycle.opens_at ? 'not_open_yet' : 'draft';
  if (cycle.status === 'Open') return t < cycle.closes_at ? 'open' : 'closing';
  return 'closed';
}

/** Scheduler. R-6.16.2 — idempotent and safe to re-run (NF-20). */
export function runScheduler() {
  const t = nowIso();
  let opened = 0, closed = 0;

  const toOpen = db.prepare(
    `SELECT * FROM voting_cycles WHERE status='Draft' AND opens_at <= ? AND closes_at > ?`
  ).all(t, t);
  for (const c of toOpen) {
    if (!canOpen().ok) continue;
    db.prepare(`UPDATE voting_cycles SET status='Open', updated_at=? WHERE id=?`).run(t, c.id);
    auditSystem('cycle.opened.scheduled', { entityType: 'cycle', entityId: c.id });
    opened++;
  }

  const toClose = db.prepare(
    `SELECT * FROM voting_cycles WHERE status='Open' AND closes_at <= ?`
  ).all(t);
  for (const c of toClose) {
    closeCycle(c.id, null);
    closed++;
  }

  return { opened, closed };
}

/** R-6.16.5 — anonymity is arithmetically impossible below three active employees. */
export function canOpen() {
  const min = getSettingInt('min_active_employees_to_open') || 3;
  const n = db.prepare(`SELECT COUNT(*) n FROM employees WHERE status='Active'`).get().n;
  return n >= min
    ? { ok: true, activeEmployees: n }
    : { ok: false, activeEmployees: n, reason: `A cycle needs at least ${min} active employees. There are ${n}.` };
}

/**
 * Close a cycle and freeze its tally.
 * R-6.8.3 — only Submitted votes count.
 * R-6.8.4 / IR-4 — results are written once and become the historical record.
 */
export function closeCycle(cycleId, actorId) {
  const t = nowIso();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE voting_cycles SET status='Closed', closed_at=?, closed_by=?, updated_at=? WHERE id=?`
    ).run(t, actorId ?? null, t, cycleId);
    computeTally(cycleId);
  });
  tx();
  auditSystem('cycle.closed', { entityType: 'cycle', entityId: cycleId });
  return db.prepare('SELECT * FROM voting_cycles WHERE id=?').get(cycleId);
}

/**
 * The tally. R-6.8.1 ranking by vote count; R-6.8.2 tie-breaks in order:
 *   1 vote count  2 average rating  3 count of 9s and 10s  4 earliest first vote
 * Anything still level leaves the cycle TieNeedsDecision — the system does not
 * invent a winner, and an admin must decide in writing (audit-logged).
 */
export function computeTally(cycleId) {
  const rows = db.prepare(
    `SELECT nominee_id,
            COUNT(*)                                   AS vote_count,
            ROUND(AVG(rating), 2)                      AS average_rating,
            SUM(CASE WHEN rating >= 9 THEN 1 ELSE 0 END) AS high_rating_count,
            MIN(submitted_at)                          AS first_vote_at
       FROM votes
      WHERE cycle_id = ? AND status = 'Submitted'
      GROUP BY nominee_id`
  ).all(cycleId);

  db.prepare('DELETE FROM cycle_results WHERE cycle_id = ?').run(cycleId);

  if (rows.length === 0) {
    // R-6.9.5 — a cycle that closed with no valid votes is a visible absence,
    // not a missing row. Status stays Closed with no winner.
    db.prepare(`UPDATE voting_cycles SET status='Tallied', updated_at=? WHERE id=?`)
      .run(nowIso(), cycleId);
    return { results: [], winners: [], tie: false, noAward: true };
  }

  rows.sort(compareNominees);

  const insert = db.prepare(
    `INSERT INTO cycle_results
       (cycle_id, nominee_id, vote_count, average_rating, high_rating_count, first_vote_at, rank, is_winner)
     VALUES (?,?,?,?,?,?,?,?)`
  );

  // Everyone level with the leader on all four criteria is a co-leader.
  const leaders = rows.filter((r) => compareNominees(r, rows[0]) === 0);
  const tie = leaders.length > 1;

  let rank = 0, prev = null;
  rows.forEach((r, i) => {
    if (prev === null || compareNominees(r, prev) !== 0) rank = i + 1;
    prev = r;
    insert.run(
      cycleId, r.nominee_id, r.vote_count, r.average_rating ?? 0,
      r.high_rating_count, r.first_vote_at, rank, rank === 1 ? 1 : 0
    );
  });

  db.prepare(`UPDATE voting_cycles SET status=?, updated_at=? WHERE id=?`)
    .run(tie ? 'TieNeedsDecision' : 'Tallied', nowIso(), cycleId);

  return { results: rows, winners: leaders, tie, noAward: false };
}

function compareNominees(a, b) {
  if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
  if ((b.average_rating ?? 0) !== (a.average_rating ?? 0)) return (b.average_rating ?? 0) - (a.average_rating ?? 0);
  if (b.high_rating_count !== a.high_rating_count) return b.high_rating_count - a.high_rating_count;
  const at = a.first_vote_at || '9999', bt = b.first_vote_at || '9999';
  if (at !== bt) return at < bt ? -1 : 1;
  return 0;
}

export function periodLabel(awardType, date = new Date()) {
  const y = date.getUTCFullYear();
  if (awardType === 'Year') return String(y);
  return `${y}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function prettyPeriod(cycle) {
  if (cycle.award_type === 'Year') return cycle.period_label;
  const [y, m] = cycle.period_label.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[m - 1]} ${y}`;
}
