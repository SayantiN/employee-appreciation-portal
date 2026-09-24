import { db } from '../db.js';
import { randomToken } from '../lib/password.js';
import { ipOf } from '../lib/audit.js';

export const SESSION_COOKIE = 'eap_session';

const IDLE_MINUTES = 60;          // R-6.1.7
const ABSOLUTE_HOURS = 8;
const REMEMBER_DAYS = 30;

export function createSession(employeeId, { remember = false, req } = {}) {
  const id = randomToken(32);
  const expires = new Date(
    Date.now() + (remember ? REMEMBER_DAYS * 864e5 : ABSOLUTE_HOURS * 36e5)
  ).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, employee_id, expires_at, device_label, ip) VALUES (?,?,?,?,?)`
  ).run(id, employeeId, expires, (req?.get?.('user-agent') || '').slice(0, 120), ipOf(req));
  return { id, expires };
}

export function revokeSession(id) {
  db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?`).run(id);
}

/** Invalidate every session for a user — used after a password change (R-6.2). */
export function revokeAllSessions(employeeId) {
  db.prepare(`UPDATE sessions SET revoked_at = datetime('now')
              WHERE employee_id = ? AND revoked_at IS NULL`).run(employeeId);
}

export function cookieOptions(expiresIso) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresIso),
  };
}

/** Attaches req.user when a live session exists. Never throws. */
export function loadUser(req, _res, next) {
  req.user = null;
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return next();

  const row = db.prepare(
    `SELECT s.id AS sid, s.expires_at, s.last_seen_at, e.*
       FROM sessions s JOIN employees e ON e.id = s.employee_id
      WHERE s.id = ? AND s.revoked_at IS NULL`
  ).get(sid);
  if (!row) return next();

  const now = Date.now();
  const expired = new Date(row.expires_at).getTime() < now;
  const idle = now - new Date(row.last_seen_at + 'Z').getTime() > IDLE_MINUTES * 60000;
  if (expired || idle) {
    revokeSession(sid);
    return next();
  }
  if (row.status !== 'Active') {          // R-6.18.3 deactivated cannot act
    revokeSession(sid);
    return next();
  }

  db.prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`).run(sid);
  req.sessionId = sid;
  req.user = {
    id: row.id,
    employee_code: row.employee_code,
    full_name: row.full_name,
    work_email: row.work_email,
    designation: row.designation,
    department: row.department,
    role: row.role,
    status: row.status,
    must_change_password: !!row.must_change_password,
  };
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

/**
 * NF-3 — authorisation is checked on every request, server side. A hidden
 * menu item is not a permission, and neither is a hidden column (DG-17).
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', message: "You don't have access to this page." });
    }
    next();
  };
}

export const requireAdmin = requireRole('Admin');
export const requireAdminOrAuditor = requireRole('Admin', 'Auditor');

/**
 * NF-4 — CSRF. Cookies are SameSite=Lax, and every state-changing request
 * must additionally carry a header a cross-site form cannot set.
 */
export function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'eap-web') {
    return res.status(403).json({ error: 'csrf', message: 'Missing request header.' });
  }
  next();
}
