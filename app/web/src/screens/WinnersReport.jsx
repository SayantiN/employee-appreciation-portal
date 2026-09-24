import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, exportUrl } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import { DataGrid } from '../components/DataGrid.jsx';
import {
  Avatar, Button, Callout, Card, Segmented, SectionLabel, Skeleton, Stat, StatusPill, TextInput,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

const VIEWS = [
  { value: 'month', label: 'Month-wise' },
  { value: 'year', label: 'Year-wise' },
  { value: 'date', label: 'Date-wise' },
  { value: 'all', label: 'All awards' },
];

/**
 * SPEC 6.9 — who won what, and when. Four views of one grid; the server
 * decides which rows and columns each role receives (R-6.9.1, DG-17).
 */
export function WinnersReport() {
  const { isPrivileged } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = params.get('wr.view') || 'month';
  const basis = params.get('wr.basis') || 'announced';
  const from = params.get('wr.from') || '';
  const to = params.get('wr.to') || '';
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const last = useRef({});

  const setExtra = (next) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v) p.set(`wr.${k}`, v); else p.delete(`wr.${k}`); }
    p.delete('winners_report.page');
    // Each view has its own default sort; a sort chosen in another view would mislead.
    if ('view' in next) p.delete('winners_report.sort');
    setParams(p, { replace: true });
    setSelected(null);
  };

  const extra = { view, basis, from: view === 'date' ? from : '', to: view === 'date' ? to : '' };

  const fetcher = useCallback(async (state) => {
    last.current = state;
    const out = await api.winnersReport(state, extra);
    setMeta(out);
    return out;
  }, [view, basis, from, to]);

  const departments = (meta?.departments || []).map((d) => ({ value: d, label: d }));
  const s = meta?.summary;

  const columns = [
    { key: 'period_label', label: 'Period', width: 130, filter: 'text',
      render: (r) => <strong>{r.pretty_period}</strong> },
    ...(view === 'all' || view === 'date' ? [{
      key: 'award_type', label: 'Award', width: 90, filter: 'enum',
      options: [{ value: 'Month', label: 'Month' }, { value: 'Year', label: 'Year' }],
      render: (r) => <StatusPill tone={r.award_type === 'Year' ? 'bronze' : 'plum'}>{r.award_type}</StatusPill>,
    }] : []),
    { key: 'full_name', label: 'Winner', filter: 'text', render: (r) => <WinnerCell r={r} /> },
    { key: 'department', label: 'Department', width: 130, filter: 'enum', options: departments },
    { key: 'designation', label: 'Designation', width: 150, filter: 'text', hideOnCard: true },
    { key: 'votes', label: 'Votes', width: 80, numeric: true, filter: 'number', render: (r) => r.votes ?? '—' },
    { key: 'avg_rating', label: 'Avg', width: 70, numeric: true, filter: 'number',
      render: (r) => (r.avg_rating == null ? '—' : Number(r.avg_rating).toFixed(1)) },
    { key: 'participation', label: 'Part.', width: 70, numeric: true, filter: 'number', hideOnCard: true,
      render: (r) => `${r.participation ?? 0}%` },
    { key: 'published_at', label: 'Announced', width: 110, filter: 'date',
      render: (r) => (r.published_at ? new Date(r.published_at.replace(' ', 'T') + (r.published_at.includes('Z') ? '' : 'Z')).toLocaleDateString() : '—') },
    ...(isPrivileged ? [
      { key: 'published_by_name', label: 'Announced by', width: 140, filter: 'text', restricted: true, hideOnCard: true,
        render: (r) => r.published_by_name || '—' },
      { key: 'decision', label: 'Decision', width: 120, filter: 'enum', restricted: true,
        options: ['Auto', 'Admin Override', 'Tie Resolved'].map((v) => ({ value: v, label: v })),
        render: (r) => r.decision
          ? <StatusPill tone={r.decision === 'Auto' ? 'neutral' : 'bronze'}>{r.decision}</StatusPill> : '—' },
    ] : []),
    { key: 'showcase_status', label: 'Showcase', width: 100, sortable: false,
      render: (r) => r.row_kind !== 'Award' ? '' : r.showcase_status === 'Published'
        ? <Link className="page__editlink" to={`/winners/showcase/${r.winner_id}`} onClick={(e) => e.stopPropagation()}>View</Link>
        : <span style={{ color: 'var(--c-faint)' }}>Not added</span> },
  ];

  const rangeText = `${from || 'the beginning'} to ${to || 'today'}`;

  return (
    <div className="page fade-in print-page">
      <div className="page__head">
        <p className="page__lede">
          Every Employee of the Month and Employee of the Year award, from the frozen record. Months
          that produced no award are listed rather than skipped, so a gap is never mistaken for missing data.
        </p>
      </div>

      <div className="toolbar-row no-print">
        <Segmented label="Report view" value={view} options={VIEWS} onChange={(v) => setExtra({ view: v })} />
        <span className="spacer" />
        <Button size="sm" onClick={() => window.print()}>Print</Button>
        <Button size="sm" variant="primary"
                onClick={() => { window.location.href = exportUrl('/winners/report.csv', last.current, extra); }}>
          Export to Excel (CSV)
        </Button>
      </div>

      {view === 'date' && (
        <Card className="no-print">
          <div className="stack">
            <div className="row">
              <span className="section-label" style={{ margin: 0 }}>Filter dates by</span>
              {/* R-6.9.3 — two bases, an explicit toggle, always labelled. */}
              <Segmented label="Date basis" value={basis}
                         options={[{ value: 'announced', label: 'Announcement date' }, { value: 'period', label: 'Award period' }]}
                         onChange={(v) => setExtra({ basis: v })} />
            </div>
            <div className="row">
              {presets().map((p) => (
                <Button key={p.label} size="sm" variant={from === p.from && to === p.to ? 'primary' : 'secondary'}
                        onClick={() => setExtra({ from: p.from, to: p.to })}>{p.label}</Button>
              ))}
            </div>
            <div className="row">
              <label className="row" style={{ gap: 6 }}>From
                <TextInput type="date" value={from} style={{ width: 'auto' }} onChange={(e) => setExtra({ from: e.target.value })} />
              </label>
              <label className="row" style={{ gap: 6 }}>To
                <TextInput type="date" value={to} style={{ width: 'auto' }} onChange={(e) => setExtra({ to: e.target.value })} />
              </label>
              {(from || to) && <Button size="sm" variant="ghost" onClick={() => setExtra({ from: '', to: '' })}>Clear dates</Button>}
            </div>
          </div>
        </Card>
      )}

      <div className="print-only print-head">
        Winners Report · {VIEWS.find((v) => v.value === view).label}
        {view === 'date' && ` · ${basis === 'period' ? 'by award period' : 'by announcement date'} · ${rangeText}`}
        {' '}· generated {new Date().toLocaleString()}
        {isPrivileged && <div><strong>Confidential — contains administrative decision data</strong></div>}
      </div>

      {view === 'date' && (
        <div className="basis-label">
          Showing awards by <strong>{basis === 'period' ? 'award period' : 'announcement date'}</strong>, {rangeText}.
          {basis === 'announced' && ' A September winner announced in October falls in October here.'}
        </div>
      )}

      {!s ? <div className="tiles">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={80} r={10} />)}</div> : (
        <div className="tiles tiles--5">
          <Card><Stat label="Awards" value={s.totalAwards} sub={s.noAwardCycles ? `${s.noAwardCycles} cycle(s) with no award` : undefined} /></Card>
          <Card><Stat label="Distinct winners" value={s.distinctWinners} /></Card>
          <Card><Stat label="Repeat winners" value={s.repeatWinners} /></Card>
          <Card><Stat label="Most-awarded dept" value={s.topDepartment} /></Card>
          <Card><Stat label="Avg votes per award" value={s.avgVotes} /></Card>
        </div>
      )}

      <DataGrid
        gridKey="winners_report"
        columns={columns}
        fetcher={fetcher}
        rowKey={(r) => r.row_key}
        defaultSort={view === 'date' ? { column: 'published_at', dir: 'desc' } : { column: 'period_label', dir: 'desc' }}
        onRowClick={(r) => setSelected(r)}
        emptyTitle={view === 'date' && (from || to) ? `No awards were announced between ${from || 'the start'} and ${to || 'today'}` : 'No awards yet'}
        emptyBody="Awards appear here once HR publishes a winner for a closed cycle."
        renderCard={(r) => (
          <>
            <div className="grid__card-head row">
              <span style={{ flex: 1 }}>{r.pretty_period}</span>
              <StatusPill tone={r.award_type === 'Year' ? 'bronze' : 'plum'}>{r.award_type}</StatusPill>
            </div>
            <WinnerCell r={r} />
            {r.row_kind === 'Award' && (
              <div className="page__lede" style={{ fontSize: 12 }}>
                {r.department} · {r.votes} votes · {Number(r.avg_rating).toFixed(1)} average
              </div>
            )}
          </>
        )}
      />

      {selected && <Detail row={selected} isPrivileged={isPrivileged} onClose={() => setSelected(null)} />}

      {isPrivileged && (
        <Callout tone="plum" title="Shaded columns">
          Announced by and Decision are sent only to Admin and Auditor accounts. Employees' copies of this
          report do not contain them at all, and an export that includes them is marked confidential.
        </Callout>
      )}
    </div>
  );
}

function WinnerCell({ r }) {
  if (r.row_kind === 'NoAward') return <StatusPill tone="bronze">No award — closed with no valid votes</StatusPill>;
  if (r.row_kind === 'Pending') return <StatusPill tone="bronze">Awaiting publication</StatusPill>;
  return (
    <span className="row" style={{ gap: 8 }}>
      <Avatar name={r.full_name} size={24} />
      <span style={{ fontWeight: 700, color: 'var(--c-ink)' }}>{r.full_name}</span>
      {r.emp_status === 'Inactive' && <StatusPill tone="clay">Inactive</StatusPill>}
      {r.is_co_winner === 1 && <StatusPill tone="plum">Co-winner</StatusPill>}
      {r.row_kind === 'Unpublished' && <StatusPill tone="clay">Unpublished</StatusPill>}
    </span>
  );
}

function Detail({ row, isPrivileged, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [row.row_key]);
  return (
    <div ref={ref}>
      <Card accent="plum">
        <div className="row">
          <SectionLabel tone="plum">Employee of the {row.award_type} · {row.pretty_period}</SectionLabel>
          <span className="spacer" />
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {row.row_kind === 'Award' || row.row_kind === 'Unpublished' ? (
          <div className="stack">
            <div className="winner-card">
              <Avatar name={row.full_name} size={44} />
              <div className="winner-card__meta">
                <div className="winner-card__name">{row.full_name}</div>
                <div className="winner-card__role">{row.employee_code} · {row.designation} · {row.department} · {row.location}</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>{row.citation}</p>
            <dl className="detail-list">
              <div><dt>Cycle window</dt><dd>{row.opens_at?.slice(0, 10)} → {row.closes_at?.slice(0, 10)}</dd></div>
              <div><dt>Votes / average</dt><dd>{row.votes} · {Number(row.avg_rating).toFixed(2)}</dd></div>
              <div><dt>Participation</dt><dd>{row.participation}%</dd></div>
              {isPrivileged && <div><dt>Announced by</dt><dd>{row.published_by_name || '—'}</dd></div>}
              {isPrivileged && <div><dt>Decision</dt><dd>{row.decision}</dd></div>}
            </dl>
          </div>
        ) : (
          <p className="page__lede">
            {row.row_kind === 'NoAward'
              ? 'This cycle closed without a single valid vote, so no award was made.'
              : 'The tally is frozen; HR has not published a winner yet.'}
          </p>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <Button as={Link} size="sm" to={`/results/past?cycle=${row.cycle_id}`}>View leaderboard</Button>
          {row.showcase_status === 'Published' && (
            <Button as={Link} size="sm" to={`/winners/showcase/${row.winner_id}`}>View showcase</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

/* Date presets (6.9.3). Plain ISO dates — no personal data in the URL. */
function presets() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const q = Math.floor(m / 3) * 3;
  return [
    { label: 'This month', from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) },
    { label: 'Last month', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { label: 'This quarter', from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) },
    { label: 'This year', from: `${y}-01-01`, to: `${y}-12-31` },
    { label: 'Last year', from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { label: 'Last 12 months', from: iso(new Date(y, m - 11, 1)), to: iso(d) },
  ];
}
