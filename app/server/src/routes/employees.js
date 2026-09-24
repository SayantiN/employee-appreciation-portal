import { Router } from 'express';
import { db } from '../db.js';
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
