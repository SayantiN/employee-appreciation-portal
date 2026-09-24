import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { audit } from '../lib/audit.js';
import { applyGrid } from '../lib/grid.js';
import { prettyPeriod } from '../lib/cycles.js';
import { toCsv, sendCsv, describeFilters } from '../lib/csv.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();
router.use(requireAuth);

const CLOSED = `('Closed','Tallied','TieNeedsDecision','Published')`;
const isPrivileged = (req) => ['Admin', 'Auditor'].includes(req.user.role);

/** OQ-7 — the whole report can be restricted to Admin/HR by a setting. */
function reportVisible(req, res, next) {
  if (getSetting('winners_report_visibility') === 'admin_only' && !isPrivileged(req)) {
    return res.status(403).json({ error: 'forbidden', message: 'Reports are limited to HR.' });
  }
  next();
}

/** Distinct departments, for the enum filter popovers (DG-2). */
function departments() {
  return db.prepare("SELECT DISTINCT department FROM employees WHERE department <> '' ORDER BY department").all().map((r) => r.department);
}

/* ======================================================= 6.10 Hall of Fame */

router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT w.id AS winner_id, w.citation, w.final_vote_count, w.final_average_rating, w.is_co_winner,
            w.published_at, c.id AS cycle_id, c.award_type, c.period_label,
            e.id AS employee_id, e.full_name, e.designation, e.department, e.status AS emp_status,
            s.status AS showcase_status
       FROM winners w
       JOIN voting_cycles c ON c.id = w.cycle_id
       JOIN employees e     ON e.id = w.employee_id
       LEFT JOIN showcases s ON s.winner_id = w.id
      WHERE w.status = 'Published'
      ORDER BY c.period_label DESC, c.award_type DESC, e.full_name`
  ).all();

  res.json({
    winners: rows.map((r) => ({
      ...r,
      pretty_period: prettyPeriod(r),
      // A draft showcase is an admin's working copy; nobody else learns it exists.
      has_showcase: r.showcase_status === 'Published' || (isPrivileged(req) && !!r.showcase_status),
      showcase_status: isPrivileged(req) ? r.showcase_status : r.showcase_status === 'Published' ? 'Published' : null,
    })),
  });
});

/* ===================================================== 6.11 Work Showcase */

router.get('/showcase/:winnerId', (req, res) => {
  const w = db.prepare(
    `SELECT w.id AS winner_id, w.citation, w.final_vote_count, w.final_average_rating, w.status,
            c.id AS cycle_id, c.award_type, c.period_label, e.full_name, e.designation, e.department,
            s.status AS showcase_status, s.body_json, s.published_at AS showcase_published_at
       FROM winners w
       JOIN voting_cycles c ON c.id = w.cycle_id
       JOIN employees e     ON e.id = w.employee_id
       LEFT JOIN showcases s ON s.winner_id = w.id
      WHERE w.id = ?`
  ).get(req.params.winnerId);

  const priv = isPrivileged(req);
  if (!w || (w.status !== 'Published' && !priv)) return res.status(404).json({ error: 'not_found' });

  // R-6.11.2 — a draft showcase is visible to admins only.
  const showBody = w.showcase_status === 'Published' || (priv && w.showcase_status);

  // Previous / next among published winners, newest first.
  const order = db.prepare(
    `SELECT w.id FROM winners w JOIN voting_cycles c ON c.id = w.cycle_id
      WHERE w.status='Published' ORDER BY c.period_label DESC, c.award_type DESC, w.id`
  ).all().map((r) => r.id);
  const i = order.indexOf(w.winner_id);

  res.json({
    winner: { ...w, body_json: undefined, pretty_period: prettyPeriod(w) },
    showcase: showBody ? { status: w.showcase_status, blocks: JSON.parse(w.body_json || '[]') } : null,
    prevId: i > 0 ? order[i - 1] : null,
    nextId: i > -1 && i < order.length - 1 ? order[i + 1] : null,
  });
});

/* ===================================================== 6.9 Winners Report */

/**
 * One row per award, plus one per closed cycle that produced no award
 * (R-6.9.5), plus — for Admin/Auditor only — cycles still awaiting
 * publication and unpublished winners (R-6.9.1). Everything is read from the
 * frozen winners and cycle_results records; nothing is recomputed (R-6.9.2).
 */
function reportBase() {
  const participation = `(SELECT ROUND(100.0 * COUNT(*) / MAX((SELECT COUNT(*) FROM employees WHERE status='Active'), 1))
                            FROM votes v WHERE v.cycle_id = c.id AND v.status='Submitted')`;
  const periodCols = `c.id AS cycle_id, c.award_type, CAST(substr(c.period_label,1,4) AS INTEGER) AS year,
                      CASE WHEN c.award_type='Month' THEN CAST(substr(c.period_label,6,2) AS INTEGER) END AS month,
                      c.period_label, c.opens_at, c.closes_at, ${participation} AS participation`;
  const noPerson = `NULL AS employee_id, NULL AS full_name, NULL AS employee_code, NULL AS designation,
                    NULL AS department, NULL AS location, NULL AS emp_status, NULL AS votes, NULL AS avg_rating,
                    NULL AS published_at, NULL AS published_by_name, NULL AS decision, 0 AS is_co_winner,
                    NULL AS showcase_status, NULL AS winner_id, '' AS citation`;

  return `
    SELECT * FROM (
      SELECT 'W' || w.id AS row_key, CASE w.status WHEN 'Published' THEN 'Award' ELSE w.status END AS row_kind,
             ${periodCols},
             e.id AS employee_id, e.full_name, e.employee_code, e.designation, e.department, e.location,
             e.status AS emp_status, w.final_vote_count AS votes, w.final_average_rating AS avg_rating,
             w.published_at, pub.full_name AS published_by_name,
             CASE WHEN w.is_override = 0 THEN 'Auto'
                  WHEN EXISTS (SELECT 1 FROM cycle_results cr WHERE cr.cycle_id = c.id
                                AND cr.nominee_id = w.employee_id AND cr.rank = 1) THEN 'Tie Resolved'
                  ELSE 'Admin Override' END AS decision,
             w.is_co_winner, s.status AS showcase_status, w.id AS winner_id, w.citation,
             COALESCE(w.published_at, c.closed_at, c.closes_at) AS announced_basis
        FROM winners w
        JOIN voting_cycles c   ON c.id = w.cycle_id
        JOIN employees e       ON e.id = w.employee_id
        LEFT JOIN employees pub ON pub.id = w.published_by
        LEFT JOIN showcases s   ON s.winner_id = w.id
       WHERE (w.status = 'Published' OR @priv = 1)

      UNION ALL
      SELECT 'N' || c.id, 'NoAward', ${periodCols}, ${noPerson}, COALESCE(c.closed_at, c.closes_at)
        FROM voting_cycles c
       WHERE c.status IN ${CLOSED}
         AND NOT EXISTS (SELECT 1 FROM cycle_results r WHERE r.cycle_id = c.id)

      UNION ALL
      SELECT 'P' || c.id, 'Pending', ${periodCols}, ${noPerson}, COALESCE(c.closed_at, c.closes_at)
        FROM voting_cycles c
       WHERE @priv = 1 AND c.status IN ('Closed','Tallied','TieNeedsDecision')
         AND EXISTS (SELECT 1 FROM cycle_results r WHERE r.cycle_id = c.id)
         AND NOT EXISTS (SELECT 1 FROM winners w WHERE w.cycle_id = c.id AND w.status = 'Published')
    ) r
    WHERE (@awardType IS NULL OR r.award_type = @awardType)
      AND (@from IS NULL OR date(CASE @basis WHEN 'period' THEN r.opens_at ELSE r.announced_basis END) >= @from)
      AND (@to   IS NULL OR date(CASE @basis WHEN 'period' THEN r.opens_at ELSE r.announced_basis END) <= @to)`;
}

const REPORT_COLUMNS = {
  award_type: 'r.award_type', year: 'r.year', month: 'r.month', period_label: 'r.period_label',
  opens_at: 'r.opens_at', closes_at: 'r.closes_at', full_name: 'r.full_name',
  employee_code: 'r.employee_code', designation: 'r.designation', department: 'r.department',
  location: 'r.location', votes: 'r.votes', avg_rating: 'r.avg_rating',
  participation: 'r.participation', published_at: 'r.published_at', showcase_status: 'r.showcase_status',
  citation: 'r.citation', row_kind: 'r.row_kind',
};
// DG-17 — only these roles may filter, sort or receive the restricted columns.
const RESTRICTED_COLUMNS = { published_by_name: 'r.published_by_name', decision: 'r.decision' };

function reportQuery(req, overrides = {}) {
  const priv = isPrivileged(req);
  const view = ['month', 'year', 'date', 'all'].includes(req.query.view) ? req.query.view : 'month';
  const requested = req.query.basis || getSetting('winners_report_default_date_basis');
  const basis = requested === 'period' ? 'period' : 'announced';
  const params = {
    priv: priv ? 1 : 0,
    awardType: view === 'month' ? 'Month' : view === 'year' ? 'Year' : null,
    basis,
    from: /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null,
    to: /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null,
  };
  const defaultSort = view === 'date'
    ? { column: 'published_at', dir: 'desc' }
    : { column: 'period_label', dir: 'desc' };

  const out = applyGrid({
    base: reportBase(),
    params,
    columns: priv ? { ...REPORT_COLUMNS, ...RESTRICTED_COLUMNS } : REPORT_COLUMNS,
    defaultSort,
    query: { ...req.query, ...overrides },
    maxPageSize: overrides.pageSize || 200,
  });

  out.rows = out.rows.map((r) => shapeReportRow(r, priv));
  return { out, view, basis, params, priv };
}

function shapeReportRow(r, priv) {
  const row = { ...r, pretty_period: prettyPeriod(r) };
  delete row.announced_basis;
  if (!priv) { delete row.published_by_name; delete row.decision; }   // DG-17: absent, not hidden
  return row;
}

router.get('/report', reportVisible, (req, res) => {
  const { out, view, basis, params } = reportQuery(req);

  // The summary strip recalculates over the whole filtered set, not the page.
  const all = reportQuery(req, { page: 1, pageSize: 100000 }).out.rows;
  const awards = all.filter((r) => r.row_kind === 'Award');
  const perPerson = {}, perDept = {};
  for (const a of awards) {
    perPerson[a.employee_id] = (perPerson[a.employee_id] || 0) + 1;
    perDept[a.department] = (perDept[a.department] || 0) + 1;
  }
  const topDept = Object.entries(perDept).sort((a, b) => b[1] - a[1])[0];

  res.json({
    ...out,
    view, basis, from: params.from, to: params.to,
    departments: departments(),
    summary: {
      totalAwards: awards.length,
      distinctWinners: Object.keys(perPerson).length,
      repeatWinners: Object.values(perPerson).filter((n) => n > 1).length,
      topDepartment: topDept ? `${topDept[0]} (${topDept[1]})` : '—',
      avgVotes: awards.length ? +(awards.reduce((s, a) => s + (a.votes || 0), 0) / awards.length).toFixed(1) : 0,
      noAwardCycles: all.filter((r) => r.row_kind === 'NoAward').length,
    },
  });
});

router.get('/report.csv', reportVisible, (req, res) => {
  const { out, view, basis, params, priv } = reportQuery(req, { page: 1, pageSize: 100000 });
  const columns = [
    { label: 'Award Type', key: 'award_type' },
    { label: 'Period', key: 'pretty_period' },
    { label: 'Cycle Start', value: (r) => r.opens_at?.slice(0, 10) },
    { label: 'Cycle End', value: (r) => r.closes_at?.slice(0, 10) },
    { label: 'Winner', value: (r) => r.row_kind === 'NoAward' ? 'No award' : r.row_kind === 'Pending' ? 'Awaiting publication' : r.full_name },
    { label: 'Employee Code', key: 'employee_code' },
    { label: 'Designation', key: 'designation' },
    { label: 'Department', key: 'department' },
    { label: 'Location', key: 'location' },
    { label: 'Employee Status', key: 'emp_status' },
    { label: 'Votes Received', key: 'votes' },
    { label: 'Average Rating', key: 'avg_rating' },
    { label: 'Participation %', key: 'participation' },
    { label: 'Announced On', value: (r) => r.published_at?.slice(0, 10) },
    ...(priv ? [{ label: 'Announced By', key: 'published_by_name' }, { label: 'Decision', key: 'decision' }] : []),
    { label: 'Co-winner', value: (r) => (r.is_co_winner ? 'Yes' : '') },
    { label: 'Showcase', value: (r) => (r.showcase_status === 'Published' ? 'Published' : r.row_kind === 'Award' ? 'Not added' : '') },
    { label: 'Record Status', key: 'row_kind' },
    { label: 'Citation', key: 'citation' },
  ];
  const meta = [
    ['Employee Appreciation Portal — Winners Report', ''],
    ...(priv ? [['CONFIDENTIAL', 'Contains administrative decision data']] : []),   // R-6.9.7
    ['Generated by', `${req.user.full_name} (${req.user.role})`],
    ['Generated at (UTC)', new Date().toISOString()],
    ['View', view],
    ['Date basis', basis === 'period' ? 'Award period' : 'Announcement date'],   // R-6.9.3
    ['Date range', `${params.from || 'start'} to ${params.to || 'today'}`],
    ['Filters', describeFilters(req.query)],
    ['Rows', out.rows.length],
  ];
  audit(req, 'report.exported', { entityType: 'report', entityId: 'winners_report', after: { view, rows: out.rows.length } });
  sendCsv(res, `winners-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv({ columns, rows: out.rows, meta }));
});

/* ============================================ 6.9A Award Statistics report */

/**
 * Per employee: how many times they won Employee of the Month and of the
 * Year, and how many cycles of each they were nominated in.
 *
 * A nomination is counted when the employee received at least one submitted
 * vote in a cycle that has CLOSED. Open cycles are excluded entirely — a
 * running nomination count would leak standings (BR-5). Wins count published
 * winners only; unpublished or pending decisions are not wins yet.
 */
function statsBase() {
  const yearCond = `(@year IS NULL OR substr(c.period_label,1,4) = @year)`;
  const wins = (type) => `(SELECT COUNT(*) FROM winners w JOIN voting_cycles c ON c.id = w.cycle_id
                            WHERE w.employee_id = e.id AND w.status='Published'
                              AND c.award_type='${type}' AND ${yearCond})`;
  const noms = (type) => `(SELECT COUNT(DISTINCT v.cycle_id) FROM votes v JOIN voting_cycles c ON c.id = v.cycle_id
                            WHERE v.nominee_id = e.id AND v.status='Submitted' AND c.status IN ${CLOSED}
                              AND c.award_type='${type}' AND ${yearCond})`;
  return `
    SELECT * FROM (
      SELECT e.id, e.employee_code, e.full_name, e.designation, e.department, e.location,
             e.status AS emp_status,
             ${wins('Month')} AS eom_wins,
             ${wins('Year')}  AS eoy_wins,
             ${noms('Month')} AS eom_nominations,
             ${noms('Year')}  AS eoy_nominations,
             (SELECT COUNT(*) FROM votes v JOIN voting_cycles c ON c.id = v.cycle_id
               WHERE v.nominee_id = e.id AND v.status='Submitted' AND c.status IN ${CLOSED}
                 AND ${yearCond}) AS votes_received,
             (SELECT MAX(c.period_label) FROM winners w JOIN voting_cycles c ON c.id = w.cycle_id
               WHERE w.employee_id = e.id AND w.status='Published' AND ${yearCond}) AS last_won
        FROM employees e
    ) s
    WHERE (@all = 1 OR s.eom_wins + s.eoy_wins + s.eom_nominations + s.eoy_nominations > 0)`;
}

const STATS_COLUMNS = {
  employee_code: 's.employee_code', full_name: 's.full_name', designation: 's.designation',
  department: 's.department', location: 's.location', emp_status: 's.emp_status',
  eom_wins: 's.eom_wins', eoy_wins: 's.eoy_wins',
  eom_nominations: 's.eom_nominations', eoy_nominations: 's.eoy_nominations',
  total_wins: '(s.eom_wins + s.eoy_wins)', total_nominations: '(s.eom_nominations + s.eoy_nominations)',
  votes_received: 's.votes_received', last_won: 's.last_won',
};

function statsQuery(req, overrides = {}) {
  const params = {
    year: /^\d{4}$/.test(req.query.year || '') ? req.query.year : null,
    all: req.query.all === '1' ? 1 : 0,
  };
  const out = applyGrid({
    base: statsBase(),
    params,
    columns: STATS_COLUMNS,
    defaultSort: { column: 'total_wins', dir: 'desc' },
    query: {
      ...req.query,
      // Most wins first, then most nominations — the natural reading order.
      sort: req.query.sort || 'total_wins:desc,total_nominations:desc,full_name:asc',
      ...overrides,
    },
    maxPageSize: overrides.pageSize || 200,
  });
  out.rows = out.rows.map((r) => ({
    ...r,
    total_wins: r.eom_wins + r.eoy_wins,
    total_nominations: r.eom_nominations + r.eoy_nominations,
  }));
  return { out, params };
}

router.get('/stats', reportVisible, (req, res) => {
  const { out, params } = statsQuery(req);
  const all = statsQuery(req, { page: 1, pageSize: 100000 }).out.rows;
  const sum = (k) => all.reduce((a, r) => a + r[k], 0);

  const years = db.prepare(
    `SELECT DISTINCT substr(period_label,1,4) y FROM voting_cycles WHERE status IN ${CLOSED} ORDER BY y DESC`
  ).all().map((r) => r.y);

  res.json({
    ...out,
    year: params.year,
    years,
    departments: departments(),
    summary: {
      people: all.length,
      eomWins: sum('eom_wins'),
      eoyWins: sum('eoy_wins'),
      eomNominations: sum('eom_nominations'),
      eoyNominations: sum('eoy_nominations'),
      multiWinners: all.filter((r) => r.total_wins > 1).length,
      closedMonthCycles: db.prepare(
        `SELECT COUNT(*) n FROM voting_cycles c WHERE award_type='Month' AND status IN ${CLOSED}
           AND (@year IS NULL OR substr(c.period_label,1,4) = @year)`
      ).get({ year: params.year }).n,
      closedYearCycles: db.prepare(
        `SELECT COUNT(*) n FROM voting_cycles c WHERE award_type='Year' AND status IN ${CLOSED}
           AND (@year IS NULL OR substr(c.period_label,1,4) = @year)`
      ).get({ year: params.year }).n,
    },
  });
});

/** Row expand — every closed cycle this person was nominated in or won. */
router.get('/stats/:employeeId', reportVisible, (req, res) => {
  const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : null;
  const rows = db.prepare(
    `SELECT c.id AS cycle_id, c.award_type, c.period_label,
            (SELECT COUNT(*) FROM votes v WHERE v.cycle_id = c.id AND v.nominee_id = @emp
               AND v.status='Submitted') AS votes,
            (SELECT r.rank FROM cycle_results r WHERE r.cycle_id = c.id AND r.nominee_id = @emp) AS rank,
            EXISTS (SELECT 1 FROM winners w WHERE w.cycle_id = c.id AND w.employee_id = @emp
                      AND w.status='Published') AS won
       FROM voting_cycles c
      WHERE c.status IN ${CLOSED}
        AND (@year IS NULL OR substr(c.period_label,1,4) = @year)
        AND (EXISTS (SELECT 1 FROM votes v WHERE v.cycle_id = c.id AND v.nominee_id = @emp AND v.status='Submitted')
          OR EXISTS (SELECT 1 FROM winners w WHERE w.cycle_id = c.id AND w.employee_id = @emp AND w.status='Published'))
      ORDER BY c.period_label DESC, c.award_type`
  ).all({ emp: Number(req.params.employeeId), year });
  res.json({ history: rows.map((r) => ({ ...r, won: !!r.won, pretty_period: prettyPeriod(r) })) });
});

router.get('/stats.csv', reportVisible, (req, res) => {
  const { out, params } = statsQuery(req, { page: 1, pageSize: 100000 });
  const columns = [
    { label: 'Employee Code', key: 'employee_code' },
    { label: 'Employee', key: 'full_name' },
    { label: 'Designation', key: 'designation' },
    { label: 'Department', key: 'department' },
    { label: 'Location', key: 'location' },
    { label: 'Status', key: 'emp_status' },
    { label: 'Employee of the Month — wins', key: 'eom_wins' },
    { label: 'Employee of the Year — wins', key: 'eoy_wins' },
    { label: 'Employee of the Month — nominations', key: 'eom_nominations' },
    { label: 'Employee of the Year — nominations', key: 'eoy_nominations' },
    { label: 'Total wins', key: 'total_wins' },
    { label: 'Total nominations', key: 'total_nominations' },
    { label: 'Votes received', key: 'votes_received' },
    { label: 'Last won', key: 'last_won' },
  ];
  const meta = [
    ['Employee Appreciation Portal — Award Statistics', ''],
    ['Generated by', `${req.user.full_name} (${req.user.role})`],
    ['Generated at (UTC)', new Date().toISOString()],
    ['Year', params.year || 'All years'],
    ['Includes employees never nominated', params.all ? 'Yes' : 'No'],
    ['Counting rule', 'Nomination = at least one submitted vote in a closed cycle. Win = published winner.'],
    ['Filters', describeFilters(req.query)],
    ['Rows', out.rows.length],
  ];
  audit(req, 'report.exported', { entityType: 'report', entityId: 'award_statistics', after: { rows: out.rows.length } });
  sendCsv(res, `award-statistics-${new Date().toISOString().slice(0, 10)}.csv`, toCsv({ columns, rows: out.rows, meta }));
});
