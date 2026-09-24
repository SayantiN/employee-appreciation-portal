import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { hashPassword, verifyPassword, passwordPolicyErrors, randomToken, sha256 } from '../lib/password.js';
import { audit, ipOf } from '../lib/audit.js';
import {
  SESSION_COOKIE, createSession, revokeSession, revokeAllSessions,
  cookieOptions, requireAuth,
} from '../middleware/auth.js';

export const router = Router();

const ACCOUNT_WINDOW_MIN = 15, ACCOUNT_MAX = 5;   // R-6.1.4
const IP_WINDOW_MIN = 15, IP_MAX = 20;
const LOCK_MINUTES = 15;

function recentAttempts(column, value, minutes) {
  return db.prepare(
    `SELECT COUNT(*) n FROM login_attempts
      WHERE ${column} = ? AND succeeded = 0
        AND occurred_at > datetime('now', ?)`
  ).get(value, `-${minutes} minutes`).n;
}

function domainAllowed(email) {
  const allowed = String(getSetting('allowed_email_domains') || '')
    .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return true;
  const domain = String(email).split('@')[1]?.toLowerCase();
  return !!domain && allowed.includes(domain);
}

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const remember = !!req.body?.remember;
  const ip = ipOf(req);

  const record = (ok) => db.prepare(
    'INSERT INTO login_attempts (email, ip, succeeded) VALUES (?,?,?)'
  ).run(email || null, ip, ok ? 1 : 0);

  // R-6.1.3 — one generic message for every failure path below.
  const generic = () => res.status(401).json({
    error: 'invalid_credentials',
    message: 'Email or password is incorrect.',
  });

  if (!email || !password) return generic();

  if (recentAttempts('ip', ip, IP_WINDOW_MIN) >= IP_MAX) {
    record(false);
    return res.status(429).json({ error: 'rate_limited', message: 'Too many attempts. Try again shortly.' });
  }

  // R-6.1.1 — domain is checked before the credential check.
  if (!domainAllowed(email)) { record(false); return generic(); }

  const user = db.prepare('SELECT * FROM employees WHERE work_email = ?').get(email);
  if (!user) { record(false); return generic(); }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    record(false);
    return res.status(423).json({
      error: 'account_locked',
      message: 'Too many attempts. Your account is locked for 15 minutes. We have emailed you.',
    });
  }

  if (!verifyPassword(password, user.password_hash)) {
    record(false);
    const fails = recentAttempts('email', email, ACCOUNT_WINDOW_MIN);
    if (fails >= ACCOUNT_MAX) {
      const until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      db.prepare('UPDATE employees SET locked_until = ?, failed_login_count = ? WHERE id = ?')
        .run(until, fails, user.id);
      audit(req, 'auth.account_locked', { entityType: 'employee', entityId: user.id });
      return res.status(423).json({
        error: 'account_locked',
        message: 'Too many attempts. Your account is locked for 15 minutes. We have emailed you.',
      });
    }
    audit(req, 'auth.login_failed', { entityType: 'employee', entityId: user.id });
    return generic();
  }

  // R-6.1.5 — deactivated accounts cannot sign in, and are told why.
  if (user.status !== 'Active') {
    record(false);
    return res.status(403).json({ error: 'inactive', message: 'Your account is inactive. Contact HR.' });
  }

  record(true);
  db.prepare(
    `UPDATE employees SET failed_login_count = 0, locked_until = NULL,
            last_login_at = datetime('now') WHERE id = ?`
  ).run(user.id);

  const session = createSession(user.id, { remember, req });
  res.cookie(SESSION_COOKIE, session.id, cookieOptions(session.expires));
  audit({ ...req, user: { id: user.id, role: user.role } }, 'auth.login', {
    entityType: 'employee', entityId: user.id,
  });

  res.json({
    user: publicUser(user),
    mustChangePassword: !!user.must_change_password,   // R-6.1.6
  });
});

router.post('/logout', (req, res) => {
  if (req.sessionId) {
    revokeSession(req.sessionId);
    audit(req, 'auth.logout');
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.user.id);

  if (!verifyPassword(current, row.password_hash)) {
    return res.status(400).json({ error: 'wrong_password', message: 'Your current password is incorrect.' });
  }
  const errors = passwordPolicyErrors(next, { fullName: row.full_name, email: row.work_email });
  if (errors.length) return res.status(400).json({ error: 'policy', errors });

  db.prepare(
    `UPDATE employees SET password_hash = ?, must_change_password = 0, updated_at = datetime('now')
      WHERE id = ?`
  ).run(hashPassword(next), row.id);

  audit(req, 'auth.password_changed', { entityType: 'employee', entityId: row.id });
  revokeAllSessions(row.id);                       // signs out other devices
  const session = createSession(row.id, { req });  // keep this one alive
  res.cookie(SESSION_COOKIE, session.id, cookieOptions(session.expires));
  res.json({ ok: true });
});

/**
 * R-6.2 — the response never reveals whether an account exists.
 * With no mail transport wired up, the token is logged server-side so the
 * flow is testable; swap consoleDeliver() for your SMTP client.
 */
router.post('/forgot-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = email ? db.prepare('SELECT * FROM employees WHERE work_email = ?').get(email) : null;

  if (user && user.status === 'Active') {
    const token = randomToken(32);
    db.prepare(
      `INSERT INTO password_reset_tokens (employee_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '+30 minutes'))`
    ).run(user.id, sha256(token));
    db.prepare(
      `UPDATE password_reset_tokens SET used_at = datetime('now')
        WHERE employee_id = ? AND used_at IS NULL AND token_hash <> ?`
    ).run(user.id, sha256(token));
    audit(req, 'auth.reset_requested', { entityType: 'employee', entityId: user.id });
    consoleDeliver(user.work_email, token);
  }

  res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.' });
});

router.post('/reset-password', (req, res) => {
  const token = String(req.body?.token || '');
  const next = String(req.body?.newPassword || '');
  const row = db.prepare(
    `SELECT t.*, e.full_name, e.work_email FROM password_reset_tokens t
       JOIN employees e ON e.id = t.employee_id
      WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > datetime('now')`
  ).get(sha256(token));

  if (!row) {
    return res.status(400).json({ error: 'invalid_token', message: 'That link has expired or was already used.' });
  }
  const errors = passwordPolicyErrors(next, { fullName: row.full_name, email: row.work_email });
  if (errors.length) return res.status(400).json({ error: 'policy', errors });

  db.prepare(
    `UPDATE employees SET password_hash = ?, must_change_password = 0,
            locked_until = NULL, failed_login_count = 0, updated_at = datetime('now')
      WHERE id = ?`
  ).run(hashPassword(next), row.employee_id);
  db.prepare('UPDATE password_reset_tokens SET used_at = datetime(\'now\') WHERE id = ?').run(row.id);

  revokeAllSessions(row.employee_id);   // R-6.2 — every session invalidated
  audit(req, 'auth.password_reset', { entityType: 'employee', entityId: row.employee_id });
  res.json({ ok: true });
});

function consoleDeliver(email, token) {
  // eslint-disable-next-line no-console
  console.log(`\n[password reset] ${email}\n  /reset-password?token=${token}\n  valid 30 minutes\n`);
}

function publicUser(u) {
  return {
    id: u.id, employee_code: u.employee_code, full_name: u.full_name,
    work_email: u.work_email, designation: u.designation, department: u.department,
    role: u.role, status: u.status,
  };
}
