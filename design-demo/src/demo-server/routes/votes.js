import { Router } from 'express';
import { db, getSettingBool } from '../db.js';
import { audit } from '../lib/audit.js';
import { isVotable, nowIso, prettyPeriod } from '../lib/cycles.js';
import { requireAuth } from '../middleware/auth.js';
import { applyGrid } from '../lib/grid.js';

export const router = Router();
router.use(requireAuth);

const LIMITS = {
  reason:     { min: 30, max: 1000, label: 'Reason for voting' },
  comparison: { min: 30, max: 1000, label: 'Why better than others' },
  suggestion: { min: 20, max: 500,  label: 'One suggestion' },
};
const YEAR_COMPARISON_MIN = 50;   // SPEC 6.5 — a year-level claim costs more

/** GET /api/votes/current?awardType=Month — the ballot for the live cycle. */
router.get('/current', (req, res) => {
  const awardType = req.query.awardType === 'Year' ? 'Year' : 'Month';
  // The ballot is for the cycle whose window contains now. Only if none is
  // live do we fall back to the next one due to open — ordering by opens_at
  // alone would hand back a future draft while voting is in progress.
  const cycle = db.prepare(
    `SELECT * FROM voting_cycles
      WHERE award_type = ? AND status IN ('Draft','Open')
      ORDER BY
        CASE WHEN status = 'Open'
              AND datetime('now') >= datetime(opens_at)
              AND datetime('now') <  datetime(closes_at) THEN 0 ELSE 1 END,
        opens_at ASC
      LIMIT 1`
  ).get(awardType);

  if (!cycle) return res.json({ cycle: null, vote: null, nominees: [], votable: false });

  const vote = db.prepare(
    'SELECT * FROM votes WHERE cycle_id = ? AND voter_id = ?'
  ).get(cycle.id, req.user.id);

  res.json({
    cycle: decorate(cycle),
    votable: isVotable(cycle),
    vote: vote ? shapeVote(vote) : null,
    nominees: nomineesFor(cycle, req.user.id),
  });
});

/** BR-2 — the voter is absent from their own nominee list. */
function nomineesFor(cycle, voterId) {
  return db.prepare(
    `SELECT id, employee_code, full_name, designation, department
       FROM employees
      WHERE status = 'Active' AND id <> ?
      ORDER BY full_name`
  ).all(voterId);
}

/** POST /api/votes — save a draft or submit. One record per voter per cycle. */
router.post('/', (req, res) => {
  const { cycleId, nomineeId, reason, comparison, suggestion, rating, confirm, action } = req.body || {};
  const submitting = action === 'submit';

  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(cycleId);
  if (!cycle) return res.status(404).json({ error: 'cycle_not_found' });

  // R-6.4.1 / IR-2 — the server clock decides, not the client countdown.
  if (!isVotable(cycle)) {
    return res.status(409).json({
      error: 'window_closed',
      message: 'Voting closed while you were writing. Your text is saved below — nothing was lost.',
    });
  }

  const errors = {};
  const nominee = nomineeId
    ? db.prepare('SELECT * FROM employees WHERE id = ?').get(nomineeId)
    : null;

  if (!nominee || nominee.status !== 'Active') {
    errors.nominee = 'Choose a colleague from the list.';
  } else if (nominee.id === req.user.id && !getSettingBool('allow_self_vote')) {
    // BR-2, second of three gates: UI, server, database constraint.
    errors.nominee = "Choose a colleague. You can't vote for yourself.";
  }

  if (submitting) {
    const compMin = cycle.award_type === 'Year' ? YEAR_COMPARISON_MIN : LIMITS.comparison.min;
    check(errors, 'reason', reason, LIMITS.reason.min, LIMITS.reason.max, 'Tell us a bit more');
    check(errors, 'comparison', comparison, compMin, LIMITS.comparison.max, 'Explain what set them apart');
    check(errors, 'suggestion', suggestion, LIMITS.suggestion.min, LIMITS.suggestion.max, 'Share one suggestion');
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 10) errors.rating = 'Pick a rating from 1 to 10.';
    if (!confirm) errors.confirm = 'Please confirm this is your honest assessment.';
  }

  if (Object.keys(errors).length) return res.status(400).json({ error: 'validation', errors });

  const existing = db.prepare(
    'SELECT * FROM votes WHERE cycle_id = ? AND voter_id = ?'
  ).get(cycle.id, req.user.id);

  const payload = {
    nominee_id: nominee.id,
    reason_text: clean(reason),
    comparison_text: clean(comparison),
    suggestion_text: clean(suggestion),
    rating: rating == null || rating === '' ? null : Number(rating),
    status: submitting ? 'Submitted' : 'Draft',
  };

  const t = nowIso();
  let voteId;

  const tx = db.transaction(() => {
    if (existing) {
      // R-6.4.3 — a second attempt edits the existing record, never adds one.
      const isEdit = existing.status === 'Submitted';
      db.prepare(
        `UPDATE votes SET nominee_id=?, reason_text=?, comparison_text=?, suggestion_text=?,
                rating=?, status=?, submitted_at=COALESCE(submitted_at, ?),
                last_edited_at=?, edit_count=edit_count + ?, updated_at=?
          WHERE id=?`
      ).run(
        payload.nominee_id, payload.reason_text, payload.comparison_text, payload.suggestion_text,
        payload.rating, payload.status, submitting ? t : null, t, isEdit ? 1 : 0, t, existing.id
      );
      voteId = existing.id;
    } else {
      const info = db.prepare(
        `INSERT INTO votes (cycle_id, voter_id, nominee_id, reason_text, comparison_text,
                            suggestion_text, rating, status, submitted_at, last_edited_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(
        cycle.id, req.user.id, payload.nominee_id, payload.reason_text, payload.comparison_text,
        payload.suggestion_text, payload.rating, payload.status, submitting ? t : null, t
      );
      voteId = info.lastInsertRowid;
    }
    if (submitting) writeVersion(voteId, req.user.id);   // R-6.4.4
  });

  try {
    tx();
  } catch (e) {
    if (String(e.message).includes('CHECK constraint failed')) {
      return res.status(400).json({ error: 'validation', errors: { nominee: "You can't vote for yourself." } });
    }
    throw e;
  }

  audit(req, submitting ? (existing?.status === 'Submitted' ? 'vote.edited' : 'vote.submitted') : 'vote.draft_saved', {
    entityType: 'vote', entityId: voteId,
  });

  const saved = db.prepare('SELECT * FROM votes WHERE id = ?').get(voteId);
  res.json({ vote: shapeVote(saved), votable: isVotable(cycle) });
});

/** R-6.4.5 — withdraw removes the vote from the tally and from the nominee's feed. */
router.post('/:id/withdraw', (req, res) => {
  const vote = db.prepare('SELECT * FROM votes WHERE id = ?').get(req.params.id);
  if (!vote || vote.voter_id !== req.user.id) return res.status(404).json({ error: 'not_found' });

  const cycle = db.prepare('SELECT * FROM voting_cycles WHERE id = ?').get(vote.cycle_id);
  if (!isVotable(cycle)) {
    return res.status(409).json({ error: 'window_closed', message: 'Voting has closed. This vote is locked.' });
  }

  db.prepare(`UPDATE votes SET status='Withdrawn', last_edited_at=?, updated_at=? WHERE id=?`)
    .run(nowIso(), nowIso(), vote.id);
  writeVersion(vote.id, req.user.id);
  audit(req, 'vote.withdrawn', { entityType: 'vote', entityId: vote.id, before: { status: vote.status } });
  res.json({ ok: true });
});

/**
 * GET /api/votes/mine — R-6.6.1: your own votes, never anyone else's.
 * The voter filter is applied before the grid layer, so no filter or sort
 * parameter can widen it.
 */
router.get('/mine', (req, res) => {
  const base = `
    SELECT v.id, v.rating, v.status, v.submitted_at, v.last_edited_at, v.edit_count,
           v.reason_text, v.comparison_text, v.suggestion_text,
           c.award_type, c.period_label, c.closes_at, c.status AS cycle_status,
           n.full_name AS nominee_name, n.department AS nominee_department, n.id AS nominee_id
      FROM votes v
      JOIN voting_cycles c ON c.id = v.cycle_id
      JOIN employees n     ON n.id = v.nominee_id
     WHERE v.voter_id = @self`;

  const result = applyGrid({
    base,
    params: { self: req.user.id },
    columns: {
      period_label: 'c.period_label',
      award_type: 'c.award_type',
      nominee_name: 'n.full_name',
      nominee_department: 'n.department',
      rating: 'v.rating',
      status: 'v.status',
      submitted_at: 'v.submitted_at',
    },
    defaultSort: { column: 'submitted_at', dir: 'desc' },
    query: req.query,
  });

  const now = new Date();
  result.rows = result.rows.map((r) => ({
    ...r,
    editable: r.cycle_status === 'Open' && new Date(r.closes_at) > now,   // R-6.6.2
    locked_reason: r.cycle_status === 'Open' ? null
      : `Voting closed ${new Date(r.closes_at).toLocaleDateString()}. This vote is locked.`,
  }));
  res.json(result);
});

router.get('/:id/versions', (req, res) => {
  const vote = db.prepare('SELECT * FROM votes WHERE id = ?').get(req.params.id);
  if (!vote || vote.voter_id !== req.user.id) return res.status(404).json({ error: 'not_found' });
  const rows = db.prepare(
    'SELECT version_no, rating, status, changed_at FROM vote_versions WHERE vote_id = ? ORDER BY version_no'
  ).all(vote.id);
  res.json({ versions: rows });
});

// ------------------------------------------------------------------ helpers

function check(errors, key, value, min, max, prefix) {
  const v = String(value ?? '').trim();
  if (v.length < min) errors[key] = `${prefix} — at least ${min} characters.`;
  else if (v.length > max) errors[key] = `Keep this under ${max} characters.`;
}

/** R-6.4.7 — plain text only; no markup reaches storage. */
function clean(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').trim();
}

function writeVersion(voteId, actorId) {
  const v = db.prepare('SELECT * FROM votes WHERE id = ?').get(voteId);
  const next = (db.prepare('SELECT MAX(version_no) m FROM vote_versions WHERE vote_id = ?')
    .get(voteId).m || 0) + 1;
  db.prepare(
    `INSERT INTO vote_versions
       (vote_id, version_no, nominee_id, reason_text, comparison_text, suggestion_text, rating, status, changed_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(voteId, next, v.nominee_id, v.reason_text, v.comparison_text, v.suggestion_text, v.rating, v.status, actorId);
}

function shapeVote(v) {
  return {
    id: v.id, cycle_id: v.cycle_id, nominee_id: v.nominee_id,
    reason: v.reason_text, comparison: v.comparison_text, suggestion: v.suggestion_text,
    rating: v.rating, status: v.status,
    submitted_at: v.submitted_at, last_edited_at: v.last_edited_at, edit_count: v.edit_count,
  };
}

function decorate(c) {
  return { ...c, pretty_period: prettyPeriod(c), votable: isVotable(c) };
}
