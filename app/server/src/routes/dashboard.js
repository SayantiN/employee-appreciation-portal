import { Router } from 'express';
import { db } from '../db.js';
import { isVotable, prettyPeriod } from '../lib/cycles.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const me = req.user.id;
  const eligible = db.prepare(`SELECT COUNT(*) n FROM employees WHERE status='Active'`).get().n;

  // ---- open cycles and my status in each --------------------------------
  const openCycles = db.prepare(
    `SELECT * FROM voting_cycles WHERE status IN ('Draft','Open') ORDER BY closes_at`
  ).all().map((c) => {
    const votesCast = db.prepare(
      `SELECT COUNT(*) n FROM votes WHERE cycle_id=? AND status='Submitted'`
    ).get(c.id).n;
    const mine = db.prepare('SELECT status FROM votes WHERE cycle_id=? AND voter_id=?').get(c.id, me);
    return {
      id: c.id,
      award_type: c.award_type,
      pretty_period: prettyPeriod(c),
      opens_at: c.opens_at,
      closes_at: c.closes_at,
      votable: isVotable(c),
      my_status: mine?.status ?? null,
      // BR-5 — participation is a count. No standings are exposed here.
      participation: eligible ? Math.round((votesCast / eligible) * 100) : 0,
      votes_cast: votesCast,
      eligible,
    };
  });

  // ---- the reigning winners ----------------------------------------------
  const reigning = ['Month', 'Year'].map((awardType) => db.prepare(
    `SELECT w.citation, w.final_vote_count, w.final_average_rating, w.published_at,
            c.award_type, c.period_label,
            e.id AS employee_id, e.full_name, e.designation, e.department
       FROM winners w
       JOIN voting_cycles c ON c.id = w.cycle_id
       JOIN employees e     ON e.id = w.employee_id
      WHERE w.status='Published' AND c.award_type = ?
      ORDER BY w.published_at DESC LIMIT 1`
  ).get(awardType)).filter(Boolean).map((w) => ({ ...w, pretty_period: prettyPeriod(w) }));

  // ---- appreciation I have received --------------------------------------
  // Only from cycles that have closed (R-6.7.3) — an open cycle's votes are
  // never counted into anything an employee can see.
  const received = db.prepare(
    `SELECT COUNT(*) n, ROUND(AVG(v.rating),1) avg
       FROM votes v JOIN voting_cycles c ON c.id = v.cycle_id
      WHERE v.nominee_id = ? AND v.status='Submitted'
        AND c.status NOT IN ('Draft','Open')`
  ).get(me);

  const trend = db.prepare(
    `SELECT c.period_label, COUNT(*) n, ROUND(AVG(v.rating),1) avg
       FROM votes v JOIN voting_cycles c ON c.id = v.cycle_id
      WHERE v.nominee_id = ? AND v.status='Submitted'
        AND c.award_type='Month' AND c.status NOT IN ('Draft','Open')
      GROUP BY c.period_label ORDER BY c.period_label DESC LIMIT 6`
  ).all(me).reverse();

  const hallOfFame = db.prepare(
    `SELECT e.id AS employee_id, e.full_name, e.department, c.award_type, c.period_label
       FROM winners w JOIN voting_cycles c ON c.id = w.cycle_id
       JOIN employees e ON e.id = w.employee_id
      WHERE w.status='Published' ORDER BY w.published_at DESC LIMIT 6`
  ).all().map((w) => ({ ...w, pretty_period: prettyPeriod(w) }));

  const announcements = db.prepare(
    `SELECT title, body FROM announcements WHERE is_active = 1 ORDER BY id DESC LIMIT 3`
  ).all();

  const unread = db.prepare(
    'SELECT COUNT(*) n FROM notifications WHERE recipient_id = ? AND is_read = 0'
  ).get(me).n;

  const payload = {
    openCycles,
    reigning,
    received: { count: received.n || 0, average: received.avg || null },
    trend,
    hallOfFame,
    announcements,
    unread,
  };

  // R-6.3.2 — admins get one extra block; employees never receive these keys.
  if (req.user.role === 'Admin' || req.user.role === 'Auditor') {
    payload.adminSnapshot = {
      votesToday: db.prepare(
        `SELECT COUNT(*) n FROM votes WHERE status='Submitted' AND date(submitted_at)=date('now')`
      ).get().n,
      cyclesNeedingAction: db.prepare(
        `SELECT COUNT(*) n FROM voting_cycles WHERE status IN ('Tallied','TieNeedsDecision')`
      ).get().n,
      pendingPublication: db.prepare(
        `SELECT COUNT(*) n FROM voting_cycles c
          WHERE c.status='Tallied'
            AND NOT EXISTS (SELECT 1 FROM winners w WHERE w.cycle_id=c.id AND w.status='Published')`
      ).get().n,
      flagged: db.prepare('SELECT COUNT(*) n FROM votes WHERE flagged = 1').get().n,
    };
  }

  res.json(payload);
});
