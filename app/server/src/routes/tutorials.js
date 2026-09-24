import { Router } from 'express';
import { db, getSetting, getSettingInt } from '../db.js';
import { audit } from '../lib/audit.js';
import { applyGrid } from '../lib/grid.js';
import { transcriptFrom } from '../lib/tutorials.js';
import { requireAuth, requireAdmin, requireAdminOrAuditor } from '../middleware/auth.js';

/** SPEC 6.14 — Video Tutorials, and 6.14.7 — the admin library. */
export const router = Router();
router.use(requireAuth);

const CATEGORIES = ['Getting Started', 'Voting', 'Your Feedback', 'Winners & Showcase', 'Reports', 'Administration'];
const isPrivileged = (req) => ['Admin', 'Auditor'].includes(req.user.role);

/**
 * R-6.14.8 — admin tutorials are excluded in SQL for everyone else, not
 * dropped from the list afterwards.
 */
function visibleWhere(req) {
  return isPrivileged(req) ? `t.status IN ('Published','Stale')` : `t.status IN ('Published','Stale') AND t.audience = 'All'`;
}

router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT t.id, t.title, t.category, t.description, t.duration_seconds, t.status, t.in_onboarding,
            t.sort_order, t.video_url IS NOT NULL AS has_video, t.audience,
            COALESCE(p.percent, 0) AS percent, COALESCE(p.completed, 0) AS completed
       FROM tutorials t
       LEFT JOIN tutorial_progress p ON p.tutorial_id = t.id AND p.employee_id = ?
      WHERE ${visibleWhere(req)}
      ORDER BY t.sort_order`
  ).all(req.user.id);

  const onboarding = rows.filter((r) => r.in_onboarding);
  res.json({
    enabled: getSetting('tutorials_enabled') !== 'false',
    disclosure: getSetting('tutorial_ai_disclosure_text'),
    categories: CATEGORIES.filter((c) => rows.some((r) => r.category === c)),
    tutorials: rows.map((r) => ({ ...r, has_video: !!r.has_video })),
    onboarding: {
      total: onboarding.length,
      done: onboarding.filter((r) => r.completed).length,
      nextId: onboarding.find((r) => !r.completed)?.id ?? null,
    },
  });
});

router.get('/:id(\\d+)', (req, res) => {
  const t = db.prepare(`SELECT t.* FROM tutorials t WHERE t.id = ? AND ${visibleWhere(req)}`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });

  const siblings = db.prepare(
    `SELECT t.id FROM tutorials t WHERE t.category = ? AND ${visibleWhere(req)} ORDER BY t.sort_order`
  ).all(t.category).map((r) => r.id);
  const i = siblings.indexOf(t.id);
  const progress = db.prepare('SELECT percent, completed FROM tutorial_progress WHERE tutorial_id = ? AND employee_id = ?')
    .get(t.id, req.user.id);

  res.json({
    tutorial: { ...t, script: undefined },
    transcript: transcriptFrom(t.script, t.duration_seconds),
    disclosure: getSetting('tutorial_ai_disclosure_text'),
    progress: progress || { percent: 0, completed: 0 },
    prevId: i > 0 ? siblings[i - 1] : null,
    nextId: i < siblings.length - 1 ? siblings[i + 1] : null,
  });
});

/** R-6.14.6 — completion is recorded at the threshold, not at 100%. */
router.post('/:id(\\d+)/progress', (req, res) => {
  const t = db.prepare(`SELECT t.id FROM tutorials t WHERE t.id = ? AND ${visibleWhere(req)}`).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  const percent = Math.max(0, Math.min(100, parseInt(req.body?.percent, 10) || 0));
  const done = percent >= (getSettingInt('tutorial_completion_threshold_pct') || 90) ? 1 : 0;
  db.prepare(
    `INSERT INTO tutorial_progress (tutorial_id, employee_id, percent, completed) VALUES (?,?,?,?)
     ON CONFLICT(tutorial_id, employee_id) DO UPDATE SET
       percent = MAX(tutorial_progress.percent, excluded.percent),
       completed = MAX(tutorial_progress.completed, excluded.completed),
       updated_at = datetime('now')`
  ).run(t.id, req.user.id, percent, done);
  res.json({ ok: true, completed: !!done });
});

/* ----------------------------------------------------- 6.14.7 admin grid */

router.get('/admin', requireAdminOrAuditor, (req, res) => {
  const active = db.prepare(`SELECT COUNT(*) n FROM employees WHERE status='Active'`).get().n || 1;
  const out = applyGrid({
    base: `SELECT t.id, t.title, t.category, t.duration_seconds, t.status, t.audience, t.in_onboarding,
                  t.sort_order, t.applies_to_app_version, t.updated_at, t.video_url,
                  LENGTH(t.script) AS script_len,
                  (SELECT COUNT(*) FROM tutorial_progress p WHERE p.tutorial_id = t.id AND p.completed = 1) AS completions
             FROM tutorials t`,
    columns: {
      title: 't.title', category: 't.category', status: 't.status', audience: 't.audience',
      duration_seconds: 't.duration_seconds', applies_to_app_version: 't.applies_to_app_version',
      updated_at: 't.updated_at', sort_order: 't.sort_order',
    },
    query: { ...req.query, sort: req.query.sort || 'category:asc,sort_order:asc' },
    defaultSort: { column: 'sort_order', dir: 'asc' },
  });
  out.rows = out.rows.map((r) => ({ ...r, completion_pct: Math.round((r.completions / active) * 100) }));
  res.json(out);
});

router.get('/admin/:id(\\d+)', requireAdminOrAuditor, (req, res) => {
  const t = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  res.json({ tutorial: t, categories: CATEGORIES });
});

router.post('/admin', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim() || !CATEGORIES.includes(b.category)) {
    return res.status(400).json({ error: 'validation', message: 'A title and a category are required.' });
  }
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),0) m FROM tutorials').get().m;
  const info = db.prepare(
    `INSERT INTO tutorials (title, category, audience, status, sort_order) VALUES (?,?,?, 'Draft', ?)`
  ).run(String(b.title).trim(), b.category, b.category === 'Administration' ? 'Admin' : 'All', max + 1);
  audit(req, 'tutorial.created', { entityType: 'tutorial', entityId: info.lastInsertRowid });
  res.json({ id: info.lastInsertRowid });
});

router.patch('/admin/:id(\\d+)', requireAdmin, (req, res) => {
  const t = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const next = {
    title: b.title !== undefined ? String(b.title).trim() : t.title,
    category: CATEGORIES.includes(b.category) ? b.category : t.category,
    description: b.description !== undefined ? String(b.description).slice(0, 300) : t.description,
    duration_seconds: b.durationSeconds !== undefined ? Math.max(0, parseInt(b.durationSeconds, 10) || 0) : t.duration_seconds,
    script: b.script !== undefined ? String(b.script).replace(/<[^>]*>/g, '') : t.script,
    video_url: b.videoUrl !== undefined ? (String(b.videoUrl).trim() || null) : t.video_url,
    audience: ['All', 'Admin'].includes(b.audience) ? b.audience : t.audience,
    status: ['Draft', 'Published', 'Stale', 'Archived'].includes(b.status) ? b.status : t.status,
    in_onboarding: b.inOnboarding !== undefined ? (b.inOnboarding ? 1 : 0) : t.in_onboarding,
    applies_to_app_version: b.appliesToAppVersion !== undefined ? String(b.appliesToAppVersion) : t.applies_to_app_version,
    related_path: b.relatedPath !== undefined ? (String(b.relatedPath).trim() || null) : t.related_path,
  };
  // Publishing gate (6.14.7, 6.14.5): captions and transcript come from the
  // script, so a script and a duration are the minimum to publish.
  if (next.status === 'Published' && t.status !== 'Published') {
    const missing = [];
    if (next.script.trim().length < 40) missing.push('a narration script');
    if (!next.duration_seconds) missing.push('a duration');
    if (missing.length) {
      return res.status(409).json({ error: 'not_ready', message: `Publishing needs ${missing.join(' and ')}.` });
    }
  }
  if (next.video_url && !/^(https?:\/\/|\/)/i.test(next.video_url)) {
    return res.status(400).json({ error: 'validation', message: 'The video address must be a link or a path on this server.' });
  }
  db.prepare(
    `UPDATE tutorials SET title=@title, category=@category, description=@description,
            duration_seconds=@duration_seconds, script=@script, video_url=@video_url, audience=@audience,
            status=@status, in_onboarding=@in_onboarding, applies_to_app_version=@applies_to_app_version,
            related_path=@related_path, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...next, id: t.id });
  audit(req, 'tutorial.updated', { entityType: 'tutorial', entityId: t.id,
    before: { status: t.status }, after: { status: next.status } });
  res.json({ ok: true });
});
