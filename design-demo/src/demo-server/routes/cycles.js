import { Router } from 'express';
import { db } from '../db.js';
import { audit } from '../lib/audit.js';
import { applyGrid } from '../lib/grid.js';
import { canOpen, closeCycle, computeTally, isVotable, nowIso, prettyPeriod } from '../lib/cycles.js';
import { requireAuth, requireAdmin, requireAdminOrAuditor } from '../middleware/auth.js';

export const router = Router();
router.use(requireAuth);

/** Admin grid of every cycle (SPEC 6.16). */
router.get('/', requireAdminOrAuditor, (req, res) => {
  const base = `
    SELECT c.id, c.award_type, c.period_label, c.opens_at, c.closes_at, c.status,
           (SELECT COUNT(*) FROM votes v WHERE v.cycle_id = c.id AND v.status='Submitted') AS votes_cast,
           (SELECT COUNT(*) FROM employees e WHERE e.status='Active')                      AS eligible,
           (SELECT w.employee_id FROM winners w WHERE w.cycle_id = c.id AND w.status='Published' LIMIT 1) AS winner_id,
           (SELECT e2.full_name FROM winners w JOIN employees e2 ON e2.id = w.employee_id
             WHERE w.cycle_id = c.id AND w.status='Published' LIMIT 1) AS winner_name
      FROM voting_cycles c`;

  const result = applyGrid({
    base,
    columns: {
      award_type: 'c.award_type',
      period_label: 'c.period_label',
      opens_at: 'c.opens_at',
      closes_at: 'c.closes_at',
      status: 'c.status',
    },
    defaultSort: { column: 'opens_at', dir: 'desc' },
    query: req.query,
  });

  result.rows = result.rows.map((r) => ({
    ...r,
    pretty_period: prettyPeriod(r),
    participation: r.eligible ? Math.round((r.votes_cast / r.eligible) * 100) : 0,
  }));
  res.json(result);
});

/** What an employee may see about the live cycles — participation only. */
router.get('/current', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM voting_cycles WHERE status IN ('Draft','Open') ORDER BY closes_at`
  ).all();

  res.json({
    cycles: rows.map((c) => {
      const votesCast = db.prepare(
        `SELECT COUNT(*) n FROM votes WHERE cycle_id=? AND status='Submitted'`
      ).get(c.id).n;
      const eligible = db.prepare(`SELECT COUNT(*) n FROM employees WHERE status='Active'`).get().n;
      const mine = db.prepare('SELECT status FROM votes WHERE cycle_id=? AND voter_id=?')
        .get(c.id, req.user.id);
      return {
        id: c.id,
        award_type: c.award_type,
        period_label: c.period_label,
        pretty_period: prettyPeriod(c),
        opens_at: c.opens_at,
        closes_at: c.closes_at,
        status: c.status,
        votable: isVotable(c),
        // R-6.3.1 / BR-5 — aggregate participation only. No per-nominee figure
        // is computed here, so none can leak through this endpoint.
        participation: eligible ? Math.round((votesCast / eligible) * 100) : 0,
        votes_cast: votesCast,
        eligible,
        my_status: mine?.status ?? null,
      };
    }),
  });
});

/** Past Results (SPEC 6.8) — every cycle whose window has shut. */
router.get('/closed', (_req, res) => {
  const rows = db.prepare(
    `SELECT id, award_type, period_label, status, closes_at FROM voting_cycles
      WHERE status IN ('Closed','Tallied','TieNeedsDecision','Published')
      ORDER BY period_label DESC, award_type DESC`
  ).all();
  res.json({ cycles: rows.map((c) => ({ ...c, pretty_period: prettyPeriod(c) })) });
});

router.post('/', requireAdmin, (req, res) => {
  const { awardType, periodLabel, opensAt, closesAt } = req.body || {};
  if (!['Month', 'Year'].includes(awardType)) return res.status(400).json({ error: 'bad_award_type' });
  if (!periodLabel || !opensAt || !closesAt) return res.status(400).json({ error: 'missing_fields' });
  if (new Date(closesAt) <= new Date(opensAt)) {
    return res.status(400).json({ error: 'validation', message: 'The close time must be after the open time.' });
  }

  try {
    const info = db.prepare(
      `INSERT INTO voting_cycles (award_type, period_label, opens_at, closes_at, status, created_by)
       VALUES (?,?,?,?,'Draft',?)`
    ).run(awardType, periodLabel, new Date(opensAt).toISOString(), new Date(closesAt).toISOString(), req.user.id);
    audit(req, 'cycle.created', { entityType: 'cycle', entityId: info.lastInsertRowid,
      after: { awardType, periodLabel, opensAt, closesAt } });
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      // R-6.16.1 — one cycle per award type and period.
      return res.status(409).json({
        error: 'duplicate',
        message: `A ${awardType} cycle already exists for ${periodLabel}.`,
      });
    }
    throw e;
  }
});

router.post('/:id/open', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  if (cycle.status !== 'Draft') return res.status(409).json({ error: 'bad_state' });

  const gate = canOpen();                       // R-6.16.5
  if (!gate.ok) return res.status(409).json({ error: 'too_few_employees', message: gate.reason });

  db.prepare(`UPDATE voting_cycles SET status='Open', updated_at=? WHERE id=?`).run(nowIso(), cycle.id);
  audit(req, 'cycle.opened.manual', { entityType: 'cycle', entityId: cycle.id, before: { status: cycle.status } });
  res.json({ ok: true });
});

router.post('/:id/close', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  if (cycle.status !== 'Open') return res.status(409).json({ error: 'bad_state' });

  const updated = closeCycle(cycle.id, req.user.id);
  audit(req, 'cycle.closed.manual', { entityType: 'cycle', entityId: cycle.id });
  res.json({ ok: true, status: updated.status });
});

router.post('/:id/extend', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  const closesAt = new Date(req.body?.closesAt);
  if (Number.isNaN(closesAt.getTime()) || closesAt <= new Date(cycle.opens_at)) {
    return res.status(400).json({ error: 'validation', message: 'Give a close time after the open time.' });
  }
  db.prepare(`UPDATE voting_cycles SET closes_at=?, updated_at=? WHERE id=?`)
    .run(closesAt.toISOString(), nowIso(), cycle.id);
  audit(req, 'cycle.extended', { entityType: 'cycle', entityId: cycle.id,
    before: { closes_at: cycle.closes_at }, after: { closes_at: closesAt.toISOString() } });
  res.json({ ok: true });
});

router.post('/:id/cancel', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  if (!['Draft', 'Open'].includes(cycle.status)) return res.status(409).json({ error: 'bad_state' });
  db.prepare(`UPDATE voting_cycles SET status='Cancelled', updated_at=? WHERE id=?`).run(nowIso(), cycle.id);
  audit(req, 'cycle.cancelled', { entityType: 'cycle', entityId: cycle.id, before: { status: cycle.status } });
  res.json({ ok: true });
});

/**
 * R-6.16.4 — reopening is an exception path: it demands a typed reason,
 * is audit-logged, and invalidates the frozen tally.
 */
router.post('/:id/reopen', requireAdmin, (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 15) {
    return res.status(400).json({ error: 'validation', message: 'Give a reason of at least 15 characters. It is recorded in the audit log.' });
  }
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM cycle_results WHERE cycle_id = ?').run(cycle.id);
    db.prepare(
      `UPDATE voting_cycles SET status='Open', closed_at=NULL, closed_by=NULL,
              reopen_reason=?, updated_at=? WHERE id=?`
    ).run(reason, nowIso(), cycle.id);
  });
  tx();

  audit(req, 'cycle.reopened', { entityType: 'cycle', entityId: cycle.id,
    before: { status: cycle.status }, after: { status: 'Open', reason } });
  res.json({ ok: true });
});

router.post('/:id/recompute', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  const out = computeTally(cycle.id);
  audit(req, 'cycle.tally_recomputed', { entityType: 'cycle', entityId: cycle.id });
  res.json({ ok: true, tie: out.tie, noAward: out.noAward });
});

/** The frozen leaderboard. Employees see it only once the cycle has closed. */
router.get('/:id/results', (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });

  const isPrivileged = ['Admin', 'Auditor'].includes(req.user.role);
  const closed = !['Draft', 'Open'].includes(cycle.status);

  if (!closed && !isPrivileged) {
    // BR-5 / AC-2 — no per-nominee number is even selected for this role.
    const votesCast = db.prepare(
      `SELECT COUNT(*) n FROM votes WHERE cycle_id=? AND status='Submitted'`
    ).get(cycle.id).n;
    const eligible = db.prepare(`SELECT COUNT(*) n FROM employees WHERE status='Active'`).get().n;
    return res.json({
      cycle: { ...cycle, pretty_period: prettyPeriod(cycle) },
      hidden: true,
      message: `Results are hidden until voting closes on ${new Date(cycle.closes_at).toLocaleDateString()}.`,
      participation: eligible ? Math.round((votesCast / eligible) * 100) : 0,
      votes_cast: votesCast,
      eligible,
      leaderboard: [],
    });
  }

  // After close, read the frozen snapshot — two people running this on
  // different days must see identical history (R-6.8.4).
  // Before close, an Admin or Auditor gets a tally computed on the fly. It is
  // deliberately NOT written to cycle_results: nothing is frozen until the
  // window actually shuts.
  const leaderboard = closed
    ? db.prepare(
        `SELECT r.rank, r.vote_count, r.average_rating, r.high_rating_count, r.is_winner,
                e.id AS employee_id, e.full_name, e.department, e.designation
           FROM cycle_results r JOIN employees e ON e.id = r.nominee_id
          WHERE r.cycle_id = ? ORDER BY r.rank, e.full_name`
      ).all(cycle.id)
    : db.prepare(
        `SELECT COUNT(*)                                     AS vote_count,
                ROUND(AVG(v.rating), 2)                      AS average_rating,
                SUM(CASE WHEN v.rating >= 9 THEN 1 ELSE 0 END) AS high_rating_count,
                0                                            AS is_winner,
                e.id AS employee_id, e.full_name, e.department, e.designation
           FROM votes v JOIN employees e ON e.id = v.nominee_id
          WHERE v.cycle_id = ? AND v.status = 'Submitted'
          GROUP BY e.id
          ORDER BY vote_count DESC, average_rating DESC, high_rating_count DESC, e.full_name`
      ).all(cycle.id).map((r, i) => ({ ...r, rank: i + 1 }));

  res.json({
    cycle: { ...cycle, pretty_period: prettyPeriod(cycle) },
    hidden: false,
    preClose: !closed && isPrivileged,       // watermark CONFIDENTIAL — PRE-CLOSE
    leaderboard: leaderboard.map((r) => ({ ...r, score: +(r.vote_count * r.average_rating).toFixed(1) })),
    noAward: closed && leaderboard.length === 0,
  });
});
