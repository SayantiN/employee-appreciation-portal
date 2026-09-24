import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, exportUrl } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import { DataGrid } from '../components/DataGrid.jsx';
import {
  Bars, Button, Callout, Card, EmptyState, Field, Segmented, SectionLabel, Skeleton, Stat, StatusPill,
  TextArea, TextInput, statusTone,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/* ======================================================= 6.19 Analytics */

export function AdminAnalytics() {
  const { isAdmin } = useAuth();
  const [award, setAward] = useState('');
  const [data, setData] = useState(null);
  const [reports, setReports] = useState(null);

  useEffect(() => { setData(null); api.analytics(award).then(setData); }, [award]);
  const loadReports = () => api.feedbackReports().then((o) => setReports(o.reports));
  useEffect(() => { loadReports(); }, []);

  if (!data) return <div className="page"><Skeleton h={240} r={10} /><Skeleton h={240} r={10} /></div>;

  const depts = [...new Set([...data.heat.map((h) => h.from_dept), ...data.heat.map((h) => h.to_dept)])].sort();
  const heatMax = Math.max(1, ...data.heat.map((h) => h.n));
  const cell = (a, b) => data.heat.find((h) => h.from_dept === a && h.to_dept === b)?.n || 0;
  const avgPart = data.participation.length
    ? Math.round(data.participation.reduce((s, p) => s + p.pct, 0) / data.participation.length) : 0;

  return (
    <div className="page fade-in">
      <div className="toolbar-row">
        <p className="page__lede" style={{ flex: 1 }}>
          How people take part. For who won what, use the <Link className="page__editlink" to="/reports/winners">Winners Report</Link>{' '}
          and <Link className="page__editlink" to="/reports/award-stats">Award Statistics</Link>.
        </p>
        <Segmented label="Award" value={award} onChange={setAward}
                   options={[{ value: '', label: 'Both' }, { value: 'Month', label: 'Month' }, { value: 'Year', label: 'Year' }]} />
        <Button size="sm" onClick={() => { window.location.href = '/api/admin/analytics/participation.csv'; }}>Export participation</Button>
      </div>

      <div className="tiles">
        <Card><Stat label="Average participation" value={`${avgPart}%`} sub={`last ${data.participation.length} cycles`} /></Card>
        <Card><Stat label="Average answer length" value={data.quality.avg_len ? `${data.quality.avg_len} chars` : '—'} sub="all three fields combined" /></Card>
        <Card><Stat label="Flagged feedback" value={data.quality.flagged || 0} sub={`of ${data.quality.total} votes`}
                    tone={data.quality.flagged ? 'clay' : undefined} /></Card>
        <Card><Stat label="Not yet voted" value={data.openCycle ? data.nonVoters.length : '—'}
                    sub={data.openCycle ? `${data.openCycle.award_type} · ${data.openCycle.pretty_period}` : 'no cycle open'} /></Card>
      </div>

      <div className="cols cols--2">
        <Card>
          <SectionLabel>Participation by cycle</SectionLabel>
          {data.participation.length === 0 ? <p className="page__lede">No cycles yet.</p> : (
            <Bars tone="sage" max={100} format={(v) => `${v}%`}
                  items={data.participation.map((p) => ({ label: `${p.award_type === 'Year' ? 'Y ' : ''}${p.pretty_period}`, value: p.pct }))} />
          )}
          <p className="page__lede" style={{ marginTop: 8, fontSize: 11 }}>Measured against today's active headcount.</p>
        </Card>
        <Card>
          <SectionLabel>Ratings given</SectionLabel>
          <Bars tone="blue" items={data.distribution.map((n, i) => ({ label: String(i + 1), value: n }))} />
        </Card>
      </div>

      <Card>
        <SectionLabel>By department</SectionLabel>
        <div className="grid__scroller" style={{ display: 'block' }}>
          <table className="grid__table">
            <thead><tr><th>Department</th><th className="is-numeric">Headcount</th><th className="is-numeric">Ever voted</th>
              <th className="is-numeric">Votes cast</th><th className="is-numeric">Avg rating received</th><th className="is-numeric">Awards</th></tr></thead>
            <tbody>
              {data.departments.map((d) => (
                <tr key={d.department}>
                  <td><strong>{d.department || '—'}</strong></td>
                  <td className="is-numeric">{d.headcount}</td>
                  <td className="is-numeric">{d.ever_voted} ({Math.round((d.ever_voted / d.headcount) * 100)}%)</td>
                  <td className="is-numeric">{d.votes_cast}</td>
                  <td className="is-numeric">{d.avg_rating_received ?? '—'}</td>
                  <td className="is-numeric">{d.awards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {depts.length > 0 && (
        <Card>
          <SectionLabel>Who appreciates whom — department to department</SectionLabel>
          <div className="grid__scroller" style={{ display: 'block' }}>
            <table className="grid__table heat">
              <thead><tr><th>From ↓ / To →</th>{depts.map((d) => <th key={d} className="is-numeric">{d}</th>)}</tr></thead>
              <tbody>
                {depts.map((a) => (
                  <tr key={a}>
                    <td><strong>{a}</strong></td>
                    {depts.map((b) => {
                      const n = cell(a, b);
                      return <td key={b} className="is-numeric" style={{ background: n ? `color-mix(in srgb, var(--c-blue) ${Math.round((n / heatMax) * 55)}%, transparent)` : undefined }}>{n || ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="page__lede" style={{ marginTop: 8, fontSize: 11 }}>A heavy diagonal means teams mostly appreciate themselves — a silo signal.</p>
        </Card>
      )}

      <div className="cols cols--2">
        <Card>
          <SectionLabel>Not yet voted {data.openCycle && `— ${data.openCycle.pretty_period}`}</SectionLabel>
          {!data.openCycle ? <p className="page__lede">No cycle is open.</p>
            : data.nonVoters.length === 0 ? <p className="page__lede">Everyone has voted.</p> : (
              <ul className="plain-list">
                {data.nonVoters.map((n) => <li key={n.employee_code}><strong>{n.full_name}</strong> <span className="page__lede">· {n.department}</span></li>)}
              </ul>
            )}
        </Card>
        <Card>
          <SectionLabel>Reported feedback</SectionLabel>
          {!reports ? <Skeleton h={80} /> : reports.length === 0 ? <p className="page__lede">Nothing has been reported.</p> : (
            <div className="stack">
              {reports.map((r) => (
                <div key={r.id} className="sc-block">
                  <div className="row">
                    <StatusPill tone={r.status === 'Open' ? 'bronze' : 'neutral'}>{r.status}</StatusPill>
                    <span className="page__lede">{r.award_type} · {r.pretty_period} · rating {r.rating}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12 }}>{r.reason_text}</p>
                  {r.reason && <p className="page__lede" style={{ fontSize: 11 }}>Reported because: {r.reason}</p>}
                  {isAdmin && r.status === 'Open' && (
                    <div className="row">
                      <Button size="sm" variant="danger" onClick={() => api.resolveFeedbackReport(r.id, 'Upheld').then(loadReports)}>Remove vote</Button>
                      <Button size="sm" onClick={() => api.resolveFeedbackReport(r.id, 'Dismissed').then(loadReports)}>Dismiss</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ========================================================== 6.20 Audit */

export function AdminAudit() {
  const [selected, setSelected] = useState(null);
  const [facets, setFacets] = useState({});
  const last = useRef({});
  const fetcher = useCallback(async (state) => {
    last.current = state;
    const out = await api.auditLog(state);
    setFacets(out.facets || {});
    return out;
  }, []);
  const opts = (k) => (facets[k] || []).map((f) => ({ value: f.value, label: f.value, count: f.count }));

  const columns = [
    { key: 'occurred_at', label: 'Time (UTC)', width: 170, filter: 'date', render: (r) => r.occurred_at.replace('T', ' ').slice(0, 19) },
    { key: 'actor_name', label: 'Actor', width: 170, filter: 'text' },
    { key: 'actor_role', label: 'Role', width: 90, filter: 'enum', options: opts('actor_role') },
    { key: 'action', label: 'Action', filter: 'text', render: (r) => <code className="code">{r.action}</code> },
    { key: 'entity_type', label: 'Entity', width: 110, filter: 'enum', options: opts('entity_type') },
    { key: 'entity_id', label: 'ID', width: 70, filter: 'text' },
    { key: 'ip_address', label: 'IP', width: 120, filter: 'text', hideOnCard: true },
  ];

  return (
    <div className="page fade-in">
      <div className="toolbar-row">
        <p className="page__lede" style={{ flex: 1 }}>
          Every change, append-only. Nothing here can be edited or deleted by anyone, through any screen.
        </p>
        <Button size="sm" variant="primary" onClick={() => { window.location.href = exportUrl('/admin/audit.csv', last.current); }}>Export CSV</Button>
      </div>
      <DataGrid gridKey="audit_log" columns={columns} fetcher={fetcher}
                defaultSort={{ column: 'occurred_at', dir: 'desc' }}
                onRowClick={setSelected} emptyTitle="The audit log is empty" />
      {selected && (
        <Card accent="blue">
          <div className="row">
            <SectionLabel>{selected.action} · {selected.occurred_at}</SectionLabel>
            <span className="spacer" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </div>
          <dl className="detail-list">
            <div><dt>Actor</dt><dd>{selected.actor_name} ({selected.actor_role || '—'})</dd></div>
            <div><dt>Entity</dt><dd>{selected.entity_type || '—'} {selected.entity_id || ''}</dd></div>
            <div><dt>IP · agent</dt><dd>{selected.ip_address || '—'} · {selected.user_agent || '—'}</dd></div>
          </dl>
          <div className="cols cols--2" style={{ marginTop: 8 }}>
            <div><SectionLabel>Before</SectionLabel><pre className="json">{pretty(selected.before_json)}</pre></div>
            <div><SectionLabel>After</SectionLabel><pre className="json">{pretty(selected.after_json)}</pre></div>
          </div>
        </Card>
      )}
    </div>
  );
}

function pretty(json) {
  if (!json) return '—';
  try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
}

/* ======================================================= 6.21 Settings */

const GROUPS = [
  ['Voting', ['max_votes_per_voter_per_cycle', 'eoy_candidate_pool', 'winner_cooldown_months', 'allow_self_vote', 'allow_edit_until_close', 'results_visibility', 'min_active_employees_to_open']],
  ['Anonymity & feedback', ['min_feedback_reveal_count']],
  ['Schedule & reminders', ['company_timezone', 'auto_open_close_cycles', 'reminder_days_before_close']],
  ['Reports', ['winners_report_visibility', 'winners_report_default_date_basis', 'default_page_size']],
  ['Showcase', ['winner_can_edit_showcase']],
  ['Tutorials', ['tutorials_enabled', 'tutorial_ai_disclosure_text', 'onboarding_playlist_required', 'tutorial_completion_threshold_pct']],
  ['Access & retention', ['allowed_email_domains', 'audit_retention_years']],
];

export function AdminSettings() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState(null);
  const load = () => api.settings().then((o) => setRows(o.settings));
  useEffect(() => { load(); }, []);

  if (!rows) return <div className="page"><Skeleton h={300} r={10} /></div>;
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const grouped = new Set(GROUPS.flatMap(([, ks]) => ks));
  const other = rows.filter((r) => !grouped.has(r.key)).map((r) => r.key);

  return (
    <div className="page fade-in">
      <p className="page__lede">
        Every change is audit-logged with its old and new value. Changes to votes-per-cycle or the feedback
        threshold apply to cycles opened afterwards, never to one already open or closed.
      </p>
      {[...GROUPS, ...(other.length ? [['Other', other]] : [])].map(([title, keys]) => (
        <Card key={title}>
          <SectionLabel>{title}</SectionLabel>
          <div className="settings">
            {keys.filter((k) => byKey[k]).map((k) => <SettingRow key={k} s={byKey[k]} canEdit={isAdmin} onSaved={load} />)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SettingRow({ s, canEdit, onSaved }) {
  const [value, setValue] = useState(s.value);
  const [msg, setMsg] = useState(null);
  const dirty = value !== s.value;

  async function save() {
    setMsg(null);
    try { await api.saveSetting(s.key, value); setMsg({ ok: true, text: 'Saved' }); onSaved(); }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Could not save.' }); }
  }

  const disabled = !canEdit || s.locked;
  return (
    <div className="settings__row">
      <div className="settings__name">
        <code className="code">{s.key}</code>
        <span className="page__lede" style={{ fontSize: 11 }}>
          default {s.default ?? '—'}{s.updated_by ? ` · changed by ${s.updated_by}` : ''}
        </span>
      </div>
      <div className="settings__control">
        {s.value_type === 'boolean' ? (
          <select className="input" value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)}>
            <option value="true">true</option><option value="false">false</option>
          </select>
        ) : s.options ? (
          <select className="input" value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)}>
            {s.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <TextInput value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)} />
        )}
        {s.locked ? <StatusPill title="Approved policy decision (SPEC §18)">Locked</StatusPill>
          : canEdit && <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={save}>Save</Button>}
      </div>
      {msg && <span className={msg.ok ? 'settings__ok' : 'settings__err'}>{msg.text}</span>}
    </div>
  );
}

/* ============================================== 6.14.7 Tutorial Library */

export function AdminTutorials() {
  const { isAdmin } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [editing, setEditing] = useState(null);
  const fetcher = useCallback((state) => api.adminTutorials(state), [nonce]);
  const refresh = () => setNonce((n) => n + 1);

  async function add() {
    const title = window.prompt('Title of the new tutorial');
    if (!title) return;
    const r = await api.createTutorial({ title, category: 'Getting Started' });
    refresh(); setEditing(r.id);
  }

  const columns = [
    { key: 'sort_order', label: '#', width: 50, numeric: true },
    { key: 'title', label: 'Title', filter: 'text', render: (r) => <strong>{r.title}</strong> },
    { key: 'category', label: 'Category', width: 150, filter: 'enum',
      options: ['Getting Started', 'Voting', 'Your Feedback', 'Winners & Showcase', 'Reports', 'Administration'].map((v) => ({ value: v, label: v })) },
    { key: 'duration_seconds', label: 'Length', width: 80, numeric: true,
      render: (r) => `${Math.floor(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, '0')}` },
    { key: 'status', label: 'Status', width: 100, filter: 'enum',
      options: ['Draft', 'Published', 'Stale', 'Archived'].map((v) => ({ value: v, label: v })),
      render: (r) => <StatusPill tone={r.status === 'Stale' ? 'clay' : statusTone(r.status)}>{r.status}</StatusPill> },
    { key: 'audience', label: 'Visible to', width: 100, filter: 'enum',
      options: [{ value: 'All', label: 'All' }, { value: 'Admin', label: 'Admin' }] },
    { key: 'video', label: 'Video', width: 90, sortable: false, render: (r) => (r.video_url ? 'Attached' : <span style={{ color: 'var(--c-faint)' }}>Not yet</span>) },
    { key: 'completion_pct', label: 'Completed', width: 100, numeric: true, sortable: false, render: (r) => `${r.completion_pct}%` },
  ];

  return (
    <div className="page fade-in">
      <div className="page__head">
        <p className="page__lede">
          The narration script is the source of truth: captions and the transcript are generated from it. Edit
          the script when a screen changes, and mark the video Stale until it is re-recorded.
        </p>
        <span className="spacer" />
        {isAdmin && <Button variant="primary" onClick={add}>Add tutorial</Button>}
      </div>
      {editing && <TutorialEditor id={editing} canEdit={isAdmin} onClose={() => setEditing(null)} onSaved={refresh} />}
      <DataGrid gridKey="tutorials" columns={columns} fetcher={fetcher}
                defaultSort={{ column: 'sort_order', dir: 'asc' }}
                onRowClick={(r) => setEditing(r.id)} emptyTitle="No tutorials yet" />
    </div>
  );
}

function TutorialEditor({ id, canEdit, onClose, onSaved }) {
  const [t, setT] = useState(null);
  const [cats, setCats] = useState([]);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api.adminTutorial(id).then((o) => { setT(o.tutorial); setCats(o.categories); }); }, [id]);
  if (!t) return <Skeleton h={200} r={10} />;
  const set = (k) => (e) => setT((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value }));

  async function save(e) {
    e.preventDefault(); setMsg(null);
    try {
      await api.updateTutorial(id, {
        title: t.title, category: t.category, description: t.description, durationSeconds: t.duration_seconds,
        script: t.script, videoUrl: t.video_url || '', audience: t.audience, status: t.status,
        inOnboarding: !!t.in_onboarding, appliesToAppVersion: t.applies_to_app_version, relatedPath: t.related_path || '',
      });
      setMsg({ tone: 'sage', text: 'Saved.' }); onSaved();
    } catch (err) { setMsg({ tone: 'clay', text: err instanceof ApiError ? err.message : 'Could not save.' }); }
  }

  return (
    <Card accent="teal">
      <form className="stack" onSubmit={save}>
        <div className="row"><SectionLabel tone="teal">Edit tutorial</SectionLabel><span className="spacer" />
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button></div>
        {msg && <Callout tone={msg.tone}>{msg.text}</Callout>}
        <fieldset disabled={!canEdit} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="cols cols--2">
            <Field label="Title">{({ id: fid }) => <TextInput id={fid} value={t.title} onChange={set('title')} />}</Field>
            <Field label="Category">{({ id: fid }) => (
              <select id={fid} className="input" value={t.category} onChange={set('category')}>{cats.map((c) => <option key={c}>{c}</option>)}</select>)}</Field>
            <Field label="Status">{({ id: fid }) => (
              <select id={fid} className="input" value={t.status} onChange={set('status')}>
                {['Draft', 'Published', 'Stale', 'Archived'].map((s) => <option key={s}>{s}</option>)}</select>)}</Field>
            <Field label="Visible to">{({ id: fid }) => (
              <select id={fid} className="input" value={t.audience} onChange={set('audience')}>
                <option value="All">Everyone</option><option value="Admin">Admins only</option></select>)}</Field>
            <Field label="Duration (seconds)">{({ id: fid }) => <TextInput id={fid} type="number" min="0" value={t.duration_seconds} onChange={set('duration_seconds')} />}</Field>
            <Field label="Applies to app version">{({ id: fid }) => <TextInput id={fid} value={t.applies_to_app_version} onChange={set('applies_to_app_version')} />}</Field>
            <Field label="Video file address" help="A path on this server or an approved internal host. Leave empty until recorded.">
              {({ id: fid }) => <TextInput id={fid} value={t.video_url || ''} onChange={set('video_url')} />}</Field>
            <Field label="Screen it explains" help="e.g. /vote/month">{({ id: fid }) => <TextInput id={fid} value={t.related_path || ''} onChange={set('related_path')} />}</Field>
          </div>
          <Field label="One-line description">{({ id: fid }) => <TextInput id={fid} value={t.description} onChange={set('description')} />}</Field>
          <Field label="Narration script" help="The source of truth. Captions and the transcript are generated from this text, sentence by sentence.">
            {({ id: fid }) => <TextArea id={fid} rows={6} value={t.script} onChange={set('script')} />}</Field>
          <label className="checkline"><input type="checkbox" checked={!!t.in_onboarding} onChange={set('in_onboarding')} /> Part of the new-joiner tour</label>
        </fieldset>
        {canEdit && <div className="row"><Button type="submit" variant="primary">Save</Button></div>}
      </form>
    </Card>
  );
}
