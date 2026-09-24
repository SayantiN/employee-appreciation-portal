import { Router } from 'express';
import { db } from '../db.js';
import { audit } from '../lib/audit.js';
import { nowIso, prettyPeriod } from '../lib/cycles.js';
import { requireAuth, requireAdmin, requireAdminOrAuditor } from '../middleware/auth.js';

/**
 * SPEC 6.17 — turn a closed tally into a celebrated winner, and 6.11 — the
 * showcase that goes with it. Auditors may read everything here; only an
 * Admin may publish, unpublish or edit.
 */
export const router = Router();
router.use(requireAuth);

const CITATION_MIN = 50, CITATION_MAX = 1000;   // R-6.17.2

router.get('/cycles', requireAdminOrAuditor, (_req, res) => {
  const rows = db.prepare(
    `SELECT c.id, c.award_type, c.period_label, c.status, c.closes_at,
            (SELECT COUNT(*) FROM cycle_results r WHERE r.cycle_id = c.id) AS nominees,
            (SELECT COUNT(*) FROM votes v WHERE v.cycle_id = c.id AND v.status='Submitted') AS votes_cast,
            (SELECT GROUP_CONCAT(e.full_name, ', ') FROM winners w JOIN employees e ON e.id = w.employee_id
              WHERE w.cycle_id = c.id AND w.status='Published') AS winner_names
       FROM voting_cycles c
      WHERE c.status IN ('Closed','Tallied','TieNeedsDecision','Published')
      ORDER BY CASE c.status WHEN 'TieNeedsDecision' THEN 0 WHEN 'Tallied' THEN 1 WHEN 'Closed' THEN 1 ELSE 2 END,
               c.closes_at DESC`
  ).all();
  res.json({ cycles: rows.map((c) => ({ ...c, pretty_period: prettyPeriod(c) })) });
});

router.get('/cycles/:id', requireAdminOrAuditor, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });

  const leaderboard = db.prepare(
    `SELECT r.rank, r.vote_count, r.average_rating, r.high_rating_count, r.is_winner,
            e.id AS employee_id, e.full_name, e.department, e.designation
       FROM cycle_results r JOIN employees e ON e.id = r.nominee_id
      WHERE r.cycle_id = ? ORDER BY r.rank, e.full_name`
  ).all(cycle.id);

  const winners = db.prepare(
    `SELECT w.id, w.employee_id, w.citation, w.status, w.is_override, w.override_justification,
            w.is_co_winner, w.published_at, e.full_name, s.status AS showcase_status
       FROM winners w JOIN employees e ON e.id = w.employee_id
       LEFT JOIN showcases s ON s.winner_id = w.id
      WHERE w.cycle_id = ? ORDER BY w.id DESC`
  ).all(cycle.id);

  res.json({ cycle: { ...cycle, pretty_period: prettyPeriod(cycle) }, leaderboard, winners });
});

/**
 * Publish. Body: { employeeIds: [id…], citation, justification }.
 * R-6.17.1 — the computed winner is the default. Choosing anyone else, or
 * resolving a tie (one winner or joint winners), needs a typed justification.
 * The leaderboard itself is never rewritten.
 */
router.post('/cycles/:id', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  if (!['Closed', 'Tallied', 'TieNeedsDecision'].includes(cycle.status)) {
    return res.status(409).json({ error: 'bad_state', message: 'Only a closed, unpublished cycle can be published.' });
  }

  const ids = [...new Set((req.body?.employeeIds || []).map(Number).filter(Boolean))];
  const citation = String(req.body?.citation || '').replace(/<[^>]*>/g, '').trim();
  const justification = String(req.body?.justification || '').trim();

  const errors = {};
  if (!ids.length) errors.winner = 'Choose the winner.';
  if (citation.length < CITATION_MIN) errors.citation = `The citation needs at least ${CITATION_MIN} characters.`;
  else if (citation.length > CITATION_MAX) errors.citation = `Keep the citation under ${CITATION_MAX} characters.`;

  const leaders = db.prepare('SELECT nominee_id FROM cycle_results WHERE cycle_id = ? AND rank = 1')
    .all(cycle.id).map((r) => r.nominee_id);
  const tie = leaders.length > 1;
  const isComputed = !tie && ids.length === 1 && ids[0] === leaders[0];
  const needsJustification = !isComputed;
  if (needsJustification && justification.length < 15) {
    errors.justification = tie
      ? 'This cycle is a tie. Record how it was resolved (at least 15 characters) — it goes to the audit log.'
      : 'Choosing someone other than the computed winner needs a justification of at least 15 characters.';
  }
  if (ids.length > 1 && !ids.every((id) => leaders.includes(id))) {
    errors.winner = 'Joint winners must all be level at rank 1.';
  }
  for (const id of ids) {
    const e = db.prepare('SELECT status FROM employees WHERE id = ?').get(id);
    if (!e) errors.winner = 'That employee does not exist.';
  }
  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation', errors });

  const t = nowIso();
  const tx = db.transaction(() => {
    for (const id of ids) {
      const r = db.prepare('SELECT vote_count, average_rating FROM cycle_results WHERE cycle_id = ? AND nominee_id = ?')
        .get(cycle.id, id) || { vote_count: 0, average_rating: 0 };
      db.prepare(
        `INSERT INTO winners (cycle_id, employee_id, citation, final_vote_count, final_average_rating,
                              is_override, override_justification, is_co_winner, published_at, published_by, status)
         VALUES (?,?,?,?,?,?,?,?,?,?, 'Published')`
      ).run(cycle.id, id, citation, r.vote_count, r.average_rating, needsJustification ? 1 : 0,
        needsJustification ? justification : null, ids.length > 1 ? 1 : 0, t, req.user.id);
    }
    db.prepare(`UPDATE voting_cycles SET status='Published', updated_at=? WHERE id=?`).run(t, cycle.id);

    // R-6.17.4 — winners are told, and so is everyone else.
    const period = prettyPeriod(cycle);
    const names = ids.map((id) => db.prepare('SELECT full_name FROM employees WHERE id=?').get(id).full_name).join(' and ');
    const notify = db.prepare('INSERT INTO notifications (recipient_id, type, title, body, link_url) VALUES (?,?,?,?,?)');
    for (const { id } of db.prepare(`SELECT id FROM employees WHERE status='Active'`).all()) {
      if (ids.includes(id)) notify.run(id, 'you_won', `You are Employee of the ${cycle.award_type}`, `${period}. Congratulations.`, '/winners');
      else notify.run(id, 'winner_published', `Employee of the ${cycle.award_type} — ${period}`, names, '/winners');
    }
  });
  tx();

  audit(req, needsJustification ? 'winner.published.override' : 'winner.published', {
    entityType: 'cycle', entityId: cycle.id,
    after: { employeeIds: ids, tie, justification: needsJustification ? justification : undefined },
  });
  res.json({ ok: true });
});

/** R-6.17.5 — an exception path: reason required, audit-logged, notified. */
router.post('/cycles/:id/unpublish', requireAdmin, (req, res) => {
  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'not_found' });
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 15) {
    return res.status(400).json({ error: 'validation', message: 'Give a reason of at least 15 characters. It is recorded in the audit log.' });
  }
  if (cycle.status !== 'Published') return res.status(409).json({ error: 'bad_state' });

  const leaders = db.prepare('SELECT COUNT(*) n FROM cycle_results WHERE cycle_id = ? AND rank = 1').get(cycle.id).n;
  const tx = db.transaction(() => {
    db.prepare(`UPDATE winners SET status='Unpublished' WHERE cycle_id=? AND status='Published'`).run(cycle.id);
    db.prepare(`UPDATE voting_cycles SET status=?, updated_at=? WHERE id=?`)
      .run(leaders > 1 ? 'TieNeedsDecision' : 'Tallied', nowIso(), cycle.id);
    const notify = db.prepare('INSERT INTO notifications (recipient_id, type, title, body) VALUES (?,?,?,?)');
    for (const { id } of db.prepare(`SELECT id FROM employees WHERE status='Active'`).all()) {
      notify.run(id, 'winner_unpublished', `Result withdrawn — ${prettyPeriod(cycle)}`, 'HR has withdrawn this result for review.');
    }
  });
  tx();
  audit(req, 'winner.unpublished', { entityType: 'cycle', entityId: cycle.id, after: { reason } });
  res.json({ ok: true });
});

/* -------------------------------------------------------------- showcase */

const BLOCK_TYPES = ['text', 'metric', 'link'];

/**
 * Body: { blocks: [{type:'text', heading, body} | {type:'metric', label, value}
 *                  | {type:'link', label, url}], status: 'Draft'|'Published' }
 * R-6.11.1 — admin only, attached to a published winner record.
 */
router.put('/showcase/:winnerId', requireAdmin, (req, res) => {
  const w = db.prepare('SELECT * FROM winners WHERE id = ?').get(req.params.winnerId);
  if (!w || w.status !== 'Published') {
    return res.status(409).json({ error: 'bad_state', message: 'A showcase attaches to a published winner.' });
  }
  const status = req.body?.status === 'Published' ? 'Published' : 'Draft';
  const strip = (s, max) => String(s ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);

  const errors = [];
  const blocks = (Array.isArray(req.body?.blocks) ? req.body.blocks : []).slice(0, 40)
    .filter((b) => BLOCK_TYPES.includes(b?.type))
    .map((b, i) => {
      if (b.type === 'text') return { type: 'text', heading: strip(b.heading, 120), body: strip(b.body, 4000) };
      if (b.type === 'metric') return { type: 'metric', label: strip(b.label, 80), value: strip(b.value, 40) };
      const url = strip(b.url, 500);
      // Links to internal systems only make sense as http(s); nothing else is rendered.
      if (!/^https?:\/\//i.test(url)) errors.push(`Link ${i + 1} must start with http:// or https://`);
      return { type: 'link', label: strip(b.label, 120) || url, url };
    });
  if (status === 'Published' && !blocks.length) errors.push('Add at least one block before publishing.');
  if (errors.length) return res.status(400).json({ error: 'validation', message: errors.join(' ') });

  const before = db.prepare('SELECT status FROM showcases WHERE winner_id = ?').get(w.id);
  db.prepare(
    `INSERT INTO showcases (winner_id, status, body_json, published_at, updated_by, updated_at)
     VALUES (@wid, @status, @body, CASE WHEN @status='Published' THEN datetime('now') END, @by, datetime('now'))
     ON CONFLICT(winner_id) DO UPDATE SET status=excluded.status, body_json=excluded.body_json,
       published_at=CASE WHEN excluded.status='Published' THEN COALESCE(showcases.published_at, datetime('now')) END,
       updated_by=excluded.updated_by, updated_at=excluded.updated_at`
  ).run({ wid: w.id, status, body: JSON.stringify(blocks), by: req.user.id });

  audit(req, status === 'Published' && before?.status !== 'Published' ? 'showcase.published' : 'showcase.edited', {
    entityType: 'showcase', entityId: w.id, before: before || null, after: { status, blocks: blocks.length },
  });
  res.json({ ok: true, status });
});
