import { Router } from 'express';
import { db, getSetting } from '../db.js';
import { audit } from '../lib/audit.js';
import { applyGrid, facet } from '../lib/grid.js';
import { hashPassword, randomToken } from '../lib/password.js';
import { requireAuth, requireAdmin, requireAdminOrAuditor } from '../middleware/auth.js';

export const router = Router();
router.use(requireAuth);

/** Admin directory (SPEC 6.18). Auditors may read; only Admin may write. */
router.get('/', requireAdminOrAuditor, (req, res) => {
  const base = `
    SELECT e.id, e.employee_code, e.full_name, e.work_email, e.designation,
           e.department, e.location, e.date_of_joining, e.role, e.status, e.last_login_at,
           (SELECT COUNT(*) FROM winners w WHERE w.employee_id = e.id AND w.status='Published') AS awards
      FROM employees e`;

  const columns = {
    employee_code: 'e.employee_code',
    full_name: 'e.full_name',
    work_email: 'e.work_email',
    designation: 'e.designation',
    department: 'e.department',
    location: 'e.location',
    role: 'e.role',
    status: 'e.status',
  };

  const result = applyGrid({
    base, columns, query: req.query,
    defaultSort: { column: 'full_name', dir: 'asc' },
  });
  result.facets = {
    department: facet(base, {}, 'e.department'),
    role: facet(base, {}, 'e.role'),
    status: facet(base, {}, 'e.status'),
  };
  res.json(result);
});

router.post('/', requireAdmin, (req, res) => {
  const { employeeCode, fullName, workEmail, designation, department, location, dateOfJoining, role } = req.body || {};
  if (!employeeCode || !fullName || !workEmail) {
    return res.status(400).json({ error: 'validation', message: 'Employee code, name and work email are required.' });
  }
  const temp = randomToken(6);
  try {
    const info = db.prepare(
      `INSERT INTO employees
         (employee_code, full_name, work_email, password_hash, designation, department,
          location, date_of_joining, role, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,?,1)`
    ).run(
      employeeCode, fullName, String(workEmail).toLowerCase(), hashPassword(temp),
      designation || '', department || '', location || '', dateOfJoining || null,
      ['Employee', 'Admin', 'Auditor'].includes(role) ? role : 'Employee'
    );
    audit(req, 'employee.created', { entityType: 'employee', entityId: info.lastInsertRowid,
      after: { employeeCode, fullName, workEmail, role } });
    // The temporary password is returned once, to the admin who created the account.
    res.json({ id: info.lastInsertRowid, temporaryPassword: temp });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'duplicate', message: 'That employee code or work email is already in use.' });
    }
    throw e;
  }
});

router.patch('/:id', requireAdmin, (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'not_found' });

  // R-6.18.1 — work email is the login identity and is not editable here.
  const fields = ['full_name', 'designation', 'department', 'location', 'date_of_joining'];
  const updates = {};
  for (const f of fields) {
    const camel = f.replace(/_(\w)/g, (_, c) => c.toUpperCase());
    if (req.body?.[camel] !== undefined) updates[f] = req.body[camel];
  }
  if (!Object.keys(updates).length) return res.json({ ok: true });

  db.prepare(
    `UPDATE employees SET ${Object.keys(updates).map((k) => `${k}=@${k}`).join(', ')},
            updated_at=datetime('now') WHERE id=@id`
  ).run({ ...updates, id: emp.id });

  audit(req, 'employee.updated', { entityType: 'employee', entityId: emp.id,
    before: pick(emp, Object.keys(updates)), after: updates });
  res.json({ ok: true });
});

/** R-6.18.2 — deactivate, never delete. */
router.post('/:id/status', requireAdmin, (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'not_found' });
  const status = req.body?.status === 'Active' ? 'Active' : 'Inactive';

  if (status === 'Inactive' && emp.role === 'Admin' && lastActiveAdmin(emp.id)) {
    // R-6.18.4 — never leave the system without an administrator.
    return res.status(409).json({ error: 'last_admin', message: 'This is the only active Admin. Promote someone else first.' });
  }

  db.prepare(`UPDATE employees SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, emp.id);
  if (status === 'Inactive') {
    db.prepare(`UPDATE sessions SET revoked_at=datetime('now') WHERE employee_id=? AND revoked_at IS NULL`).run(emp.id);
  }
  audit(req, status === 'Active' ? 'employee.reactivated' : 'employee.deactivated',
    { entityType: 'employee', entityId: emp.id, before: { status: emp.status }, after: { status } });
  res.json({ ok: true });
});

router.post('/:id/role', requireAdmin, (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'not_found' });

  // R-6.18.5 — an admin cannot change their own role.
  if (emp.id === req.user.id) {
    return res.status(409).json({ error: 'self_role', message: 'You cannot change your own role.' });
  }
  const role = ['Employee', 'Admin', 'Auditor'].includes(req.body?.role) ? req.body.role : null;
  if (!role) return res.status(400).json({ error: 'bad_role' });

  if (emp.role === 'Admin' && role !== 'Admin' && lastActiveAdmin(emp.id)) {
    return res.status(409).json({ error: 'last_admin', message: 'This is the only active Admin.' });
  }

  db.prepare(`UPDATE employees SET role=?, updated_at=datetime('now') WHERE id=?`).run(role, emp.id);
  audit(req, 'employee.role_changed', { entityType: 'employee', entityId: emp.id,
    before: { role: emp.role }, after: { role } });
  res.json({ ok: true });
});

/**
 * Bulk import from CSV (SPEC 6.18). Body: { csv, dryRun }.
 * Header row: employee_code,full_name,work_email,designation,department,location,date_of_joining,role
 * A dry run validates every row and writes nothing; a real run is all-or-nothing.
 */
router.post('/import', requireAdmin, (req, res) => {
  const rows = parseCsv(String(req.body?.csv || ''));
  const dryRun = req.body?.dryRun !== false;
  if (rows.length < 2) return res.status(400).json({ error: 'validation', message: 'The file needs a header row and at least one employee.' });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const need = ['employee_code', 'full_name', 'work_email'];
  const missing = need.filter((n) => !header.includes(n));
  if (missing.length) return res.status(400).json({ error: 'validation', message: `Missing columns: ${missing.join(', ')}` });

  const domains = String(getSetting('allowed_email_domains') || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const seenCodes = new Set(), seenEmails = new Set();
  const report = rows.slice(1).filter((r) => r.some((c) => c.trim())).map((cells, i) => {
    const rec = Object.fromEntries(header.map((h, j) => [h, (cells[j] || '').trim()]));
    const errors = [];
    if (!rec.employee_code) errors.push('employee_code is empty');
    if (!rec.full_name) errors.push('full_name is empty');
    const email = rec.work_email.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('work_email is not an email address');
    else if (domains.length && !domains.includes(email.split('@')[1])) errors.push(`email domain must be ${domains.join(' or ')}`);
    if (rec.role && !['Employee', 'Admin', 'Auditor'].includes(rec.role)) errors.push('role must be Employee, Admin or Auditor');
    if (rec.date_of_joining && !/^\d{4}-\d{2}-\d{2}$/.test(rec.date_of_joining)) errors.push('date_of_joining must be YYYY-MM-DD');
    if (seenCodes.has(rec.employee_code)) errors.push('duplicate employee_code in file');
    if (seenEmails.has(email)) errors.push('duplicate work_email in file');
    seenCodes.add(rec.employee_code); seenEmails.add(email);
    if (db.prepare('SELECT 1 FROM employees WHERE employee_code = ? OR work_email = ?').get(rec.employee_code, email)) {
      errors.push('employee_code or work_email already exists');
    }
    return { line: i + 2, ...rec, work_email: email, errors };
  });

  const bad = report.filter((r) => r.errors.length);
  if (dryRun || bad.length) {
    return res.json({ dryRun: true, total: report.length, valid: report.length - bad.length, errors: bad });
  }

  const insert = db.prepare(
    `INSERT INTO employees (employee_code, full_name, work_email, password_hash, designation, department,
                            location, date_of_joining, role, must_change_password)
     VALUES (?,?,?,?,?,?,?,?,?,1)`
  );
  const created = [];
  db.transaction(() => {
    for (const r of report) {
      const temp = randomToken(6);
      insert.run(r.employee_code, r.full_name, r.work_email, hashPassword(temp), r.designation || '',
        r.department || '', r.location || '', r.date_of_joining || null, r.role || 'Employee');
      created.push({ employee_code: r.employee_code, work_email: r.work_email, temporaryPassword: temp });
    }
  })();
  audit(req, 'employee.bulk_imported', { entityType: 'employee', after: { count: created.length } });
  res.json({ dryRun: false, created });
});

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.replace(/^﻿/, '')));
}

/** Nominee picker source for the vote screens. Excludes the caller (BR-2). */
router.get('/selectable', (req, res) => {
  const rows = db.prepare(
    `SELECT id, employee_code, full_name, designation, department
       FROM employees WHERE status='Active' AND id <> ? ORDER BY full_name`
  ).all(req.user.id);
  res.json({ employees: rows });
});

function lastActiveAdmin(excludeId) {
  const n = db.prepare(
    `SELECT COUNT(*) n FROM employees WHERE role='Admin' AND status='Active' AND id <> ?`
  ).get(excludeId).n;
  return n === 0;
}

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
