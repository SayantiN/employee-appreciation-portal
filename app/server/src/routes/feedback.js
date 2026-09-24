import { Router } from 'express';
import { db, getSettingInt } from '../db.js';
import { audit } from '../lib/audit.js';
import { prettyPeriod } from '../lib/cycles.js';
import { requireAuth, requireAdmin, requireAdminOrAuditor } from '../middleware/auth.js';

/**
 * SPEC 6.7 — Feedback for Me.
 *
 * R-6.7.1 — anonymous. No voter column is ever selected into this payload:
 *           no name, email, department, or time finer than the date.
 * R-6.7.2 — a cycle's feedback is revealed only when it has closed AND the
 *           nominee received at least min_feedback_reveal_count votes in it.
 * R-6.7.3 — open cycles are excluded in SQL, not filtered afterwards.
 * R-6.7.4 — a reported card disappears for the reporter immediately.
 */
export const router = Router();
router.use(requireAuth);

const CLOSED = `('Closed','Tallied','TieNeedsDecision','Published')`;

router.get('/mine', (req, res) => {
  const me = req.user.id;
  const threshold = getSettingInt('min_feedback_reveal_count') || 3;

  // Per closed cycle: how many votes I received, and whether that clears the bar.
  const cycles = db.prepare(
    `SELECT c.id, c.award_type, c.period_label, COUNT(*) AS n
       FROM votes v JOIN voting_cycles c ON c.id = v.cycle_id
      WHERE v.nominee_id = ? AND v.status = 'Submitted' AND c.status IN ${CLOSED}
      GROUP BY c.id ORDER BY c.period_label DESC`
  ).all(me);

  const revealed = cycles.filter((c) => c.n >= threshold).map((c) => c.id);
  const withheld = cycles.filter((c) => c.n < threshold).map((c) => ({
    award_type: c.award_type, pretty_period: prettyPeriod(c),
  }));

  const cards = revealed.length
    ? db.prepare(
        `SELECT v.id, v.rating, v.reason_text AS reason, v.comparison_text AS comparison,
                v.suggestion_text AS suggestion, date(v.submitted_at) AS date,
                c.id AS cycle_id, c.award_type, c.period_label
           FROM votes v JOIN voting_cycles c ON c.id = v.cycle_id
          WHERE v.nominee_id = @me AND v.status = 'Submitted'
            AND c.id IN (${revealed.map((_, i) => `@c${i}`).join(',')})
            AND NOT EXISTS (SELECT 1 FROM feedback_reports f WHERE f.vote_id = v.id AND f.reporter_id = @me)
          ORDER BY c.period_label DESC, v.submitted_at DESC`
      ).all({ me, ...Object.fromEntries(revealed.map((id, i) => [`c${i}`, id])) })
    : [];

  const shaped = cards.map((c) => ({ ...c, pretty_period: prettyPeriod(c) }));
  const ratings = shaped.map((c) => c.rating).filter((r) => r != null);
  const distribution = Array.from({ length: 10 }, (_, i) => ratings.filter((r) => r === i + 1).length);

  const wins = db.prepare(
    `SELECT COUNT(*) n FROM winners WHERE employee_id = ? AND status = 'Published'`
  ).get(me).n;

  res.json({
    threshold,
    summary: {
      // The headline totals count every closed-cycle vote, revealed or not —
      // a count exposes nobody. The words stay behind the threshold.
      totalVotes: cycles.reduce((a, c) => a + c.n, 0),
      latestCycleVotes: cycles[0]?.n ?? 0,
      latestCycle: cycles[0] ? prettyPeriod(cycles[0]) : null,
      average: ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
      best: ratings.length ? Math.max(...ratings) : null,
      cyclesNominated: cycles.length,
      wins,
    },
    distribution,
    withheld,
    cycles: cycles.filter((c) => revealed.includes(c.id))
      .map((c) => ({ id: c.id, award_type: c.award_type, pretty_period: prettyPeriod(c) })),
    cards: shaped,
  });
});

router.post('/:voteId/report', (req, res) => {
  const vote = db.prepare('SELECT id, nominee_id FROM votes WHERE id = ?').get(req.params.voteId);
  // Only the nominee can report feedback about themselves.
  if (!vote || vote.nominee_id !== req.user.id) return res.status(404).json({ error: 'not_found' });
  const reason = String(req.body?.reason || '').slice(0, 500);
  db.prepare(
    `INSERT OR IGNORE INTO feedback_reports (vote_id, reporter_id, reason) VALUES (?,?,?)`
  ).run(vote.id, req.user.id, reason);
  db.prepare('UPDATE votes SET flagged = 1, flag_reason = ? WHERE id = ?').run(reason || 'Reported by nominee', vote.id);

  const notify = db.prepare('INSERT INTO notifications (recipient_id, type, title, body, link_url) VALUES (?,?,?,?,?)');
  for (const { id } of db.prepare(`SELECT id FROM employees WHERE role='Admin' AND status='Active'`).all()) {
    notify.run(id, 'content_flagged', 'Feedback reported for review', 'A nominee reported a feedback card.', '/admin/analytics');
  }
  audit(req, 'feedback.reported', { entityType: 'vote', entityId: vote.id });
  res.json({ ok: true });
});

/** Moderation queue for Admin/Auditor. Reporter identity is not needed to act. */
router.get('/reports', requireAdminOrAuditor, (_req, res) => {
  const rows = db.prepare(
    `SELECT f.id, f.reason, f.status, f.created_at, v.id AS vote_id, v.reason_text, v.comparison_text,
            v.suggestion_text, v.rating, c.award_type, c.period_label
       FROM feedback_reports f JOIN votes v ON v.id = f.vote_id JOIN voting_cycles c ON c.id = v.cycle_id
      ORDER BY CASE f.status WHEN 'Open' THEN 0 ELSE 1 END, f.created_at DESC`
  ).all();
  res.json({ reports: rows.map((r) => ({ ...r, pretty_period: prettyPeriod(r) })) });
});

router.post('/reports/:id', requireAdmin, (req, res) => {
  const status = req.body?.status === 'Upheld' ? 'Upheld' : 'Dismissed';
  const f = db.prepare('SELECT * FROM feedback_reports WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  db.prepare('UPDATE feedback_reports SET status = ? WHERE id = ?').run(status, f.id);
  // Upheld: the vote leaves the tally-independent feedback feed for good,
  // but the frozen tally is never silently rewritten.
  if (status === 'Upheld') db.prepare(`UPDATE votes SET status='RemovedByAdmin' WHERE id=?`).run(f.vote_id);
  else db.prepare('UPDATE votes SET flagged = 0 WHERE id = ?').run(f.vote_id);
  audit(req, status === 'Upheld' ? 'vote.removed_by_admin' : 'feedback.report_dismissed',
    { entityType: 'vote', entityId: f.vote_id, before: { status: f.status }, after: { status } });
  res.json({ ok: true });
});
