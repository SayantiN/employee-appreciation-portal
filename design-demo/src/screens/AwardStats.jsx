import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, download, exportUrl } from '../api/client.js';
import { DataGrid } from '../components/DataGrid.jsx';
import {
  Avatar, Button, Callout, Card, SectionLabel, Skeleton, Stat, StatusPill,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * Award Statistics — per employee, how many times they were announced
 * Employee of the Month and of the Year, and how many cycles of each they
 * were nominated in.
 *
 * A nomination is at least one submitted vote in a cycle that has closed; a
 * win is a published winner. Open cycles never contribute — a live
 * nomination count would leak standings (BR-5). The server applies the rule;
 * this screen only displays it.
 */
export function AwardStats() {
  const [params, setParams] = useSearchParams();
  const year = params.get('award_stats.year') || '';
  const all = params.get('award_stats.all') === '1';
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const last = useRef({});

  const setExtra = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(`award_stats.${k}`, v); else p.delete(`award_stats.${k}`);
    p.delete('award_stats.page');
    setParams(p, { replace: true });
    setSelected(null);
  };

  const fetcher = useCallback(async (state) => {
    last.current = state;
    const out = await api.awardStats(state, { year, all: all ? '1' : '' });
    setMeta(out);
    return out;
  }, [year, all]);

  const s = meta?.summary;
  const departments = (meta?.departments || []).map((d) => ({ value: d, label: d }));

  const columns = [
    {
      key: 'full_name', label: 'Employee', filter: 'text',
      render: (r) => (
        <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <Avatar name={r.full_name} size={26} />
          <span style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: 'var(--c-ink)' }}>{r.full_name}</span>
            {r.emp_status === 'Inactive' && <> <StatusPill tone="clay">Inactive</StatusPill></>}
            <span className="stats__sub">{r.employee_code} · {r.designation}</span>
          </span>
        </span>
      ),
    },
    { key: 'department', label: 'Department', width: 130, filter: 'enum', options: departments, hideOnCard: true },
    { key: 'eom_wins', label: 'EoM wins', width: 96, numeric: true, filter: 'number',
      render: (r) => <Count n={r.eom_wins} tone="plum" /> },
    { key: 'eoy_wins', label: 'EoY wins', width: 96, numeric: true, filter: 'number',
      render: (r) => <Count n={r.eoy_wins} tone="bronze" /> },
    { key: 'eom_nominations', label: 'EoM nominated', width: 120, numeric: true, filter: 'number' },
    { key: 'eoy_nominations', label: 'EoY nominated', width: 120, numeric: true, filter: 'number' },
    { key: 'total_wins', label: 'Total wins', width: 100, numeric: true, filter: 'number',
      render: (r) => <strong>{r.total_wins}</strong> },
    { key: 'total_nominations', label: 'Total nominated', width: 124, numeric: true, filter: 'number' },
    { key: 'votes_received', label: 'Votes', width: 80, numeric: true, filter: 'number', hideOnCard: true },
    { key: 'last_won', label: 'Last won', width: 100, filter: 'text',
      render: (r) => r.last_won || <span style={{ color: 'var(--c-faint)' }}>—</span> },
  ];

  return (
    <div className="page fade-in print-page">
      <div className="page__head">
        <p className="page__lede">
          How many times each person has been announced <strong>Employee of the Month</strong> or{' '}
          <strong>Employee of the Year</strong>, and how many cycles of each they were nominated in.
          Click a row to see every cycle behind the numbers.
        </p>
      </div>

      <div className="toolbar-row no-print">
        <label className="row" style={{ gap: 6 }}>
          <span className="section-label" style={{ margin: 0 }}>Year</span>
          <select className="input" style={{ width: 'auto' }} value={year} onChange={(e) => setExtra('year', e.target.value)}>
            <option value="">All years</option>
            {(meta?.years || []).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="checkline">
          <input type="checkbox" checked={all} onChange={(e) => setExtra('all', e.target.checked ? '1' : '')} />
          Include employees never nominated
        </label>
        <span className="spacer" />
        <Button size="sm" onClick={() => window.print()}>Print</Button>
        <Button size="sm" variant="primary"
                onClick={() => { download(exportUrl('/winners/stats.csv', last.current, { year, all: all ? '1' : '' })); }}>
          Export to Excel (CSV)
        </Button>
      </div>

      <div className="print-only print-head">
        Award Statistics · {year || 'All years'} · generated {new Date().toLocaleString()}
      </div>

      {!s ? <div className="tiles">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={86} r={10} />)}</div> : (
        <div className="tiles">
          <Card accent="plum"><Stat label="Employee of the Month — awards" value={s.eomWins}
                                    sub={`${s.closedMonthCycles} closed month cycle${s.closedMonthCycles === 1 ? '' : 's'}`} /></Card>
          <Card accent="bronze"><Stat label="Employee of the Year — awards" value={s.eoyWins}
                                      sub={`${s.closedYearCycles} closed year cycle${s.closedYearCycles === 1 ? '' : 's'}`} /></Card>
          <Card><Stat label="Nominations" value={s.eomNominations + s.eoyNominations}
                      sub={`${s.eomNominations} month · ${s.eoyNominations} year`} /></Card>
          <Card><Stat label="People listed" value={s.people}
                      sub={`${s.multiWinners} won more than once`} /></Card>
        </div>
      )}

      <DataGrid
        gridKey="award_stats"
        columns={columns}
        fetcher={fetcher}
        defaultSort={{ column: 'total_wins', dir: 'desc' }}
        onRowClick={(r) => setSelected(r)}
        emptyTitle={year ? `Nobody was nominated in ${year}` : 'No closed cycles yet'}
        emptyBody="Counts appear once a voting cycle has closed. Open cycles are never counted, so nobody can read the standings early."
        renderCard={(r) => (
          <>
            <div className="grid__card-head row" style={{ gap: 8 }}>
              <Avatar name={r.full_name} size={30} />
              <span style={{ flex: 1 }}>{r.full_name}</span>
              {r.emp_status === 'Inactive' && <StatusPill tone="clay">Inactive</StatusPill>}
            </div>
            <div className="stats__cardgrid">
              <span><b>{r.eom_wins}</b> EoM wins</span>
              <span><b>{r.eoy_wins}</b> EoY wins</span>
              <span><b>{r.eom_nominations}</b> EoM nominated</span>
              <span><b>{r.eoy_nominations}</b> EoY nominated</span>
            </div>
            <div className="page__lede" style={{ fontSize: 11 }}>{r.department} · last won {r.last_won || '—'}</div>
          </>
        )}
      />

      {selected && <History employee={selected} year={year} onClose={() => setSelected(null)} />}

      <Callout tone="blue" title="How these numbers are counted">
        A <strong>nomination</strong> is counted once per cycle in which the person received at least one
        submitted vote, and only after that cycle has closed. A <strong>win</strong> is a published winner —
        a tie still awaiting HR's decision, or a withdrawn result, does not count. Joint winners each count
        one win. Figures come from the frozen tally, so they never change after a cycle closes.
      </Callout>
    </div>
  );
}

function Count({ n, tone }) {
  return n > 0 ? <StatusPill tone={tone}>{n}</StatusPill> : <span style={{ color: 'var(--c-faint)' }}>0</span>;
}

function History({ employee, year, onClose }) {
  const [rows, setRows] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    setRows(null);
    api.awardStatsHistory(employee.id, { year }).then((o) => setRows(o.history));
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [employee.id, year]);

  return (
    <div ref={ref}>
      <Card accent="plum">
        <div className="row">
          <Avatar name={employee.full_name} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{employee.full_name}</div>
            <div className="page__lede">{employee.designation} · {employee.department} · {year || 'all years'}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close history">Close</Button>
        </div>
        <div style={{ marginTop: 12 }}>
          {!rows ? <Skeleton h={80} /> : rows.length === 0 ? (
            <p className="page__lede">No nominations in closed cycles.</p>
          ) : (
            <table className="grid__table">
              <thead>
                <tr><th>Cycle</th><th>Award</th><th className="is-numeric">Votes</th><th className="is-numeric">Rank</th><th>Outcome</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.cycle_id}>
                    <td><strong>{h.pretty_period}</strong></td>
                    <td>Employee of the {h.award_type}</td>
                    <td className="is-numeric">{h.votes}</td>
                    <td className="is-numeric">{h.rank ?? '—'}</td>
                    <td>{h.won ? <StatusPill tone="plum">Won</StatusPill> : <StatusPill>Nominated</StatusPill>}</td>
                    <td><Link className="page__editlink" to={`/results/past?cycle=${h.cycle_id}`}>Leaderboard</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
