import { useCallback, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import { DataGrid } from '../components/DataGrid.jsx';
import {
  Avatar, Button, Callout, Card, Field, SectionLabel, StatusPill, TextArea, TextInput, statusTone,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * SPEC 6.18 — admin-managed directory (the OQ-2 default). Deactivate, never
 * delete; work email is fixed once created; nobody changes their own role.
 */
export function AdminEmployees() {
  const { user, isAdmin } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [facets, setFacets] = useState({});
  const [panel, setPanel] = useState(null);     // null | 'add' | 'import' | employee row
  const [banner, setBanner] = useState(null);

  const fetcher = useCallback(async (state) => {
    const out = await api.employees(state);
    setFacets(out.facets || {});
    return out;
  }, [nonce]);
  const refresh = () => setNonce((n) => n + 1);

  async function act(fn, ok) {
    setBanner(null);
    try { await fn(); setBanner({ tone: 'sage', text: ok }); refresh(); }
    catch (e) { setBanner({ tone: 'clay', text: e instanceof ApiError ? e.message : 'That did not work.' }); }
  }

  const opts = (k) => (facets[k] || []).map((f) => ({ value: f.value, label: f.value, count: f.count }));

  const columns = [
    { key: 'full_name', label: 'Name', filter: 'text',
      render: (r) => <span className="row" style={{ gap: 8 }}><Avatar name={r.full_name} size={24} /><strong>{r.full_name}</strong></span> },
    { key: 'employee_code', label: 'Code', width: 90, filter: 'text' },
    { key: 'work_email', label: 'Work email', width: 220, filter: 'text', hideOnCard: true },
    { key: 'designation', label: 'Designation', width: 160, filter: 'text' },
    { key: 'department', label: 'Department', width: 120, filter: 'enum', options: opts('department') },
    { key: 'role', label: 'Role', width: 100, filter: 'enum', options: opts('role'),
      render: (r) => <StatusPill tone={r.role === 'Employee' ? 'neutral' : 'blue'}>{r.role}</StatusPill> },
    { key: 'status', label: 'Status', width: 100, filter: 'enum', options: opts('status'),
      render: (r) => <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill> },
    { key: 'awards', label: 'Awards', width: 80, numeric: true, sortable: false },
    { key: 'actions', label: '', width: 90, sortable: false,
      render: (r) => isAdmin && <Button size="sm" onClick={(e) => { e.stopPropagation(); setPanel(r); }}>Manage</Button> },
  ];

  return (
    <div className="page fade-in">
      <div className="page__head">
        <p className="page__lede">
          Employees are never deleted — deactivating keeps their votes, feedback and awards intact and
          removes them from nominee lists. There must always be at least one active Admin.
        </p>
        <span className="spacer" />
        {isAdmin && <>
          <Button onClick={() => setPanel(panel === 'import' ? null : 'import')}>Import CSV</Button>
          <Button variant="primary" onClick={() => setPanel(panel === 'add' ? null : 'add')}>Add employee</Button>
        </>}
      </div>

      {banner && <Callout tone={banner.tone}>{banner.text}</Callout>}
      {panel === 'add' && <EmployeeForm onDone={(msg) => { setPanel(null); setBanner({ tone: 'sage', text: msg }); refresh(); }} />}
      {panel === 'import' && <ImportPanel onDone={refresh} />}
      {panel && typeof panel === 'object' && (
        <ManagePanel emp={panel} self={panel.id === user.id} act={act}
                     onClose={() => setPanel(null)}
                     onSaved={(msg) => { setPanel(null); setBanner({ tone: 'sage', text: msg }); refresh(); }} />
      )}

      <DataGrid gridKey="employees" columns={columns} fetcher={fetcher}
                defaultSort={{ column: 'full_name', dir: 'asc' }}
                onRowClick={isAdmin ? (r) => setPanel(r) : undefined}
                emptyTitle="No employees yet" emptyBody="Add people one at a time, or import a CSV file." />
    </div>
  );
}

function EmployeeForm({ onDone, emp }) {
  const [f, setF] = useState({
    employeeCode: emp?.employee_code || '', fullName: emp?.full_name || '', workEmail: emp?.work_email || '',
    designation: emp?.designation || '', department: emp?.department || '', location: emp?.location || '',
    dateOfJoining: emp?.date_of_joining || '', role: emp?.role || 'Employee',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (emp) {
        const { employeeCode, workEmail, role, ...editable } = f;
        await api.updateEmployee(emp.id, editable);
        onDone(`${f.fullName} updated.`);
      } else {
        const r = await api.createEmployee(f);
        // Shown once, to the admin who created the account.
        onDone(`${f.fullName} added. Temporary password: ${r.temporaryPassword} — they must change it at first sign-in.`);
      }
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <form className="stack" onSubmit={submit}>
        {!emp && <SectionLabel>New employee</SectionLabel>}
        {error && <Callout tone="clay">{error}</Callout>}
        <div className="cols cols--2">
          <Field label="Employee code" required>{({ id }) => <TextInput id={id} value={f.employeeCode} onChange={set('employeeCode')} disabled={!!emp} required />}</Field>
          <Field label="Full name" required>{({ id }) => <TextInput id={id} value={f.fullName} onChange={set('fullName')} required />}</Field>
          <Field label="Work email" required help={emp ? 'The login identity — fixed once created.' : undefined}>
            {({ id }) => <TextInput id={id} type="email" value={f.workEmail} onChange={set('workEmail')} disabled={!!emp} required />}
          </Field>
          <Field label="Designation">{({ id }) => <TextInput id={id} value={f.designation} onChange={set('designation')} />}</Field>
          <Field label="Department">{({ id }) => <TextInput id={id} value={f.department} onChange={set('department')} />}</Field>
          <Field label="Location">{({ id }) => <TextInput id={id} value={f.location} onChange={set('location')} />}</Field>
          <Field label="Date of joining">{({ id }) => <TextInput id={id} type="date" value={f.dateOfJoining || ''} onChange={set('dateOfJoining')} />}</Field>
          {!emp && (
            <Field label="Role">{({ id }) => (
              <select id={id} className="input" value={f.role} onChange={set('role')}>
                <option>Employee</option><option>Admin</option><option>Auditor</option>
              </select>
            )}</Field>
          )}
        </div>
        <div className="row"><Button type="submit" variant="primary" disabled={busy}>{emp ? 'Save changes' : 'Add employee'}</Button></div>
      </form>
    </Card>
  );
}

function ManagePanel({ emp, self, act, onClose, onSaved }) {
  const [role, setRole] = useState(emp.role);
  return (
    <Card accent="blue">
      <div className="row">
        <Avatar name={emp.full_name} size={34} />
        <div style={{ flex: 1 }}>
          <strong>{emp.full_name}</strong>
          <div className="page__lede">{emp.work_email}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="row" style={{ margin: '12px 0' }}>
        <label className="row" style={{ gap: 6 }}>Role
          <select className="input" style={{ width: 'auto' }} value={role} disabled={self} onChange={(e) => setRole(e.target.value)}>
            <option>Employee</option><option>Admin</option><option>Auditor</option>
          </select>
        </label>
        <Button size="sm" disabled={self || role === emp.role}
                onClick={() => act(() => api.setEmployeeRole(emp.id, role), `${emp.full_name} is now ${role}.`)}>Change role</Button>
        {self && <span className="page__lede">You cannot change your own role.</span>}
        <span className="spacer" />
        {emp.status === 'Active'
          ? <Button size="sm" variant="danger" onClick={() => window.confirm(`Deactivate ${emp.full_name}? They are signed out at once and can no longer be nominated. Their history stays.`)
              && act(() => api.setEmployeeStatus(emp.id, 'Inactive'), `${emp.full_name} deactivated.`)}>Deactivate</Button>
          : <Button size="sm" onClick={() => act(() => api.setEmployeeStatus(emp.id, 'Active'), `${emp.full_name} reactivated.`)}>Reactivate</Button>}
      </div>
      <EmployeeForm emp={emp} onDone={onSaved} />
    </Card>
  );
}

const TEMPLATE = 'employee_code,full_name,work_email,designation,department,location,date_of_joining,role\nE-2001,Jane Example,jane.example@isgesolutions.com,Analyst,Finance,Mumbai,2026-10-01,Employee\n';

function ImportPanel({ onDone }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun) {
    setBusy(true); setError(null);
    try {
      const r = await api.importEmployees(csv, dryRun);
      setResult(r);
      if (!r.dryRun) onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  }

  function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => { setCsv(t); setResult(null); });
  }

  return (
    <Card>
      <div className="stack">
        <SectionLabel>Bulk import</SectionLabel>
        <p className="page__lede">
          Check first: the dry run validates every row and writes nothing. The real import is all-or-nothing —
          if any row has an error, no one is added.{' '}
          <a className="page__editlink" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="employee-import-template.csv">Download the template</a>
        </p>
        <input type="file" accept=".csv,text/csv" onChange={loadFile} aria-label="Choose a CSV file" />
        <TextArea rows={5} value={csv} onChange={(e) => { setCsv(e.target.value); setResult(null); }}
                  placeholder="…or paste CSV here" aria-label="CSV content" />
        {error && <Callout tone="clay">{error}</Callout>}
        {result?.dryRun && (
          <Callout tone={result.errors.length ? 'bronze' : 'sage'} title="Dry run">
            {result.valid} of {result.total} rows are valid.
            {result.errors.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {result.errors.map((r) => <li key={r.line}>Line {r.line} ({r.employee_code || 'no code'}): {r.errors.join('; ')}</li>)}
              </ul>
            )}
          </Callout>
        )}
        {result && !result.dryRun && (
          <Callout tone="sage" title={`${result.created.length} employees added`}>
            Temporary passwords — shown once, share them securely:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {result.created.map((c) => <li key={c.work_email}><code>{c.work_email}</code> — <code>{c.temporaryPassword}</code></li>)}
            </ul>
          </Callout>
        )}
        <div className="row">
          <Button disabled={busy || !csv.trim()} onClick={() => run(true)}>Check (dry run)</Button>
          <Button variant="primary" disabled={busy || !result?.dryRun || result.errors.length > 0} onClick={() => run(false)}>Import</Button>
        </div>
      </div>
    </Card>
  );
}
