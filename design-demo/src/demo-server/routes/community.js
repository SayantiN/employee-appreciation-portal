import { Router } from 'express';
import { db } from '../db.js';
import { audit } from '../lib/audit.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

/**
 * SPEC 6.11A — Community Showcase. Any employee can share work that others
 * could learn from. The winner showcase (6.11) stays admin-curated; this is
 * the open counterpart.
 *
 * R-6.11A.1 — only the author creates or edits a post.
 * R-6.11A.2 — Draft is visible to its author only; Published to everyone.
 * R-6.11A.3 — an admin can hide a post with a reason (audit-logged) but can
 *             never edit someone else's words.
 * R-6.11A.4 — posts have no bearing on voting or awards.
 */
export const router = Router();
router.use(requireAuth);

const isPrivileged = (req) => ['Admin', 'Auditor'].includes(req.user.role);
const BLOCK_TYPES = ['text', 'metric', 'link'];
const LIMITS = { title: [5, 120], summary: [20, 400] };

const SELECT = `
  SELECT p.id, p.title, p.summary, p.body_json, p.status, p.hidden_reason, p.published_at,
         p.created_at, p.updated_at, p.author_id,
         e.full_name AS author_name, e.designation AS author_designation,
         e.department AS author_department, e.status AS author_status
    FROM work_posts p JOIN employees e ON e.id = p.author_id`;

function shape(p, req, withBody = false) {
  const blocks = JSON.parse(p.body_json || '[]');
  const out = {
    ...p,
    body_json: undefined,
    is_mine: p.author_id === req.user.id,
    block_count: blocks.length,
    metrics: blocks.filter((b) => b.type === 'metric').slice(0, 2),
  };
  if (withBody) out.blocks = blocks;
  return out;
}

/** Who may see a post: everyone if published; the author always; admins/auditors for moderation. */
function canSee(p, req) {
  return p.status === 'Published' || p.author_id === req.user.id || isPrivileged(req);
}

router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const dept = String(req.query.department || '').trim();
  const mine = req.query.mine === '1';
  const rows = db.prepare(
    `${SELECT}
      WHERE (p.status = 'Published' OR p.author_id = @me OR (@priv = 1 AND p.status = 'Hidden'))
        AND (@mine = 0 OR p.author_id = @me)
        AND (@q = '' OR p.title LIKE @like OR p.summary LIKE @like OR e.full_name LIKE @like)
        AND (@dept = '' OR e.department = @dept)
      ORDER BY CASE WHEN p.status = 'Published' THEN 1 ELSE 0 END,
               COALESCE(p.published_at, p.updated_at) DESC`
  ).all({ me: req.user.id, priv: isPrivileged(req) ? 1 : 0, mine: mine ? 1 : 0, q, like: `%${q}%`, dept });

  const departments = db.prepare(
    `SELECT DISTINCT e.department FROM work_posts p JOIN employees e ON e.id = p.author_id
      WHERE p.status = 'Published' AND e.department <> '' ORDER BY e.department`
  ).all().map((r) => r.department);

  res.json({ posts: rows.map((p) => shape(p, req)), departments });
});

router.get('/:id(\\d+)', (req, res) => {
  const p = db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!p || !canSee(p, req)) return res.status(404).json({ error: 'not_found' });
  res.json({ post: shape(p, req, true) });
});

router.post('/', (req, res) => {
  const v = validate(req.body);
  if (v.error) return res.status(400).json(v.error);
  const t = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO work_posts (author_id, title, summary, body_json, status, published_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(req.user.id, v.title, v.summary, JSON.stringify(v.blocks), v.status, v.status === 'Published' ? t : null, t);
  audit(req, v.status === 'Published' ? 'community.published' : 'community.draft_saved',
    { entityType: 'work_post', entityId: info.lastInsertRowid });
  res.json({ id: info.lastInsertRowid, status: v.status });
});

router.put('/:id(\\d+)', (req, res) => {
  const p = db.prepare('SELECT * FROM work_posts WHERE id = ?').get(req.params.id);
  if (!p || p.author_id !== req.user.id) return res.status(404).json({ error: 'not_found' });   // R-6.11A.1
  if (p.status === 'Hidden') {
    return res.status(409).json({ error: 'hidden', message: 'HR has hidden this post. Contact HR to have it restored.' });
  }
  const v = validate(req.body);
  if (v.error) return res.status(400).json(v.error);
  const t = new Date().toISOString();
  db.prepare(
    `UPDATE work_posts SET title=?, summary=?, body_json=?, status=?,
            published_at = CASE WHEN ? = 'Published' THEN COALESCE(published_at, ?) ELSE NULL END,
            updated_at=? WHERE id=?`
  ).run(v.title, v.summary, JSON.stringify(v.blocks), v.status, v.status, t, t, p.id);
  audit(req, v.status === 'Published' && p.status !== 'Published' ? 'community.published' : 'community.edited',
    { entityType: 'work_post', entityId: p.id, before: { status: p.status }, after: { status: v.status } });
  res.json({ ok: true, status: v.status });
});

/** R-6.11A.3 — moderation is hiding with a reason, never editing. */
router.post('/:id(\\d+)/hide', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM work_posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 10) {
    return res.status(400).json({ error: 'validation', message: 'Give a reason of at least 10 characters. The author sees it, and it is audit-logged.' });
  }
  db.prepare(`UPDATE work_posts SET status='Hidden', hidden_reason=?, updated_at=datetime('now') WHERE id=?`).run(reason, p.id);
  db.prepare('INSERT INTO notifications (recipient_id, type, title, body, link_url) VALUES (?,?,?,?,?)')
    .run(p.author_id, 'community_hidden', 'Your showcase post was hidden', reason, `/showcase/community/${p.id}`);
  audit(req, 'community.hidden', { entityType: 'work_post', entityId: p.id, before: { status: p.status }, after: { reason } });
  res.json({ ok: true });
});

router.post('/:id(\\d+)/restore', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM work_posts WHERE id = ?').get(req.params.id);
  if (!p || p.status !== 'Hidden') return res.status(404).json({ error: 'not_found' });
  db.prepare(`UPDATE work_posts SET status='Published', hidden_reason=NULL,
                published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now') WHERE id=?`).run(p.id);
  audit(req, 'community.restored', { entityType: 'work_post', entityId: p.id });
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- helpers */

function validate(body = {}) {
  const strip = (s, max) => String(s ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
  const title = strip(body.title, 200);
  const summary = strip(body.summary, 1000);
  const status = body.status === 'Published' ? 'Published' : 'Draft';
  const errors = {};
  if (title.length < LIMITS.title[0]) errors.title = `Give it a title of at least ${LIMITS.title[0]} characters.`;
  else if (title.length > LIMITS.title[1]) errors.title = `Keep the title under ${LIMITS.title[1]} characters.`;
  if (status === 'Published') {
    if (summary.length < LIMITS.summary[0]) errors.summary = `Say what it is and why it helps — at least ${LIMITS.summary[0]} characters.`;
    else if (summary.length > LIMITS.summary[1]) errors.summary = `Keep the summary under ${LIMITS.summary[1]} characters.`;
  }

  const blocks = (Array.isArray(body.blocks) ? body.blocks : []).slice(0, 40)
    .filter((b) => BLOCK_TYPES.includes(b?.type))
    .map((b) => {
      if (b.type === 'text') return { type: 'text', heading: strip(b.heading, 120), body: strip(b.body, 4000) };
      if (b.type === 'metric') return { type: 'metric', label: strip(b.label, 80), value: strip(b.value, 40) };
      const url = strip(b.url, 500);
      return { type: 'link', label: strip(b.label, 120) || url, url };
    });
  if (blocks.some((b) => b.type === 'link' && !/^https?:\/\//i.test(b.url))) {
    errors.blocks = 'Every link must start with http:// or https://';
  }
  if (status === 'Published' && !blocks.length) errors.blocks = 'Add at least one block — a write-up, an impact figure or a link — before publishing.';

  return Object.keys(errors).length ? { error: { error: 'validation', errors } } : { title, summary, blocks, status };
}
