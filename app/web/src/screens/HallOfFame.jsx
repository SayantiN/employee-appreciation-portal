import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import {
  Avatar, Button, Callout, Card, EmptyState, Segmented, SectionLabel, Skeleton, StatusPill,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * SPEC 6.10 — celebration, not reporting. Cards, with Employee of the Year
 * given the emphasis. For the tabular record, see the Winners Report.
 */
export function HallOfFame() {
  const [data, setData] = useState(null);
  const [params, setParams] = useSearchParams();
  const award = params.get('award') || 'all';
  const year = params.get('year') || '';
  const dept = params.get('dept') || '';
  const [q, setQ] = useState('');

  useEffect(() => { api.hallOfFame().then((o) => setData(o.winners)); }, []);

  const set = (k, v) => {
    const p = new URLSearchParams(params);
    if (v && v !== 'all') p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const years = useMemo(() => [...new Set((data || []).map((w) => w.period_label.slice(0, 4)))], [data]);
  const depts = useMemo(() => [...new Set((data || []).map((w) => w.department))].sort(), [data]);

  const shown = (data || []).filter((w) =>
    (award === 'all' || w.award_type === award)
    && (!year || w.period_label.startsWith(year))
    && (!dept || w.department === dept)
    && (!q || w.full_name.toLowerCase().includes(q.toLowerCase())));

  const yearAwards = shown.filter((w) => w.award_type === 'Year');
  const monthAwards = shown.filter((w) => w.award_type === 'Month');

  if (!data) {
    return <div className="page"><div className="hof">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={220} r={10} />)}</div></div>;
  }

  return (
    <div className="page fade-in">
      <div className="page__head">
        <p className="page__lede">
          Everyone who has won. For dates, filters and exports, use the{' '}
          <Link to="/reports/winners" className="page__editlink">Winners Report</Link>.
        </p>
      </div>

      <div className="toolbar-row">
        <Segmented label="Award" value={award} onChange={(v) => set('award', v)}
                   options={[{ value: 'all', label: 'All' }, { value: 'Month', label: 'Month' }, { value: 'Year', label: 'Year' }]} />
        <select className="input" style={{ width: 'auto' }} value={year} onChange={(e) => set('year', e.target.value)} aria-label="Year">
          <option value="">All years</option>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={dept} onChange={(e) => set('dept', e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {depts.map((d) => <option key={d}>{d}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 240 }} type="search" placeholder="Search by name…"
               aria-label="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.length === 0 && (
        data.length === 0
          ? <EmptyState title="No winners yet" body="The first winner appears here once a cycle closes and HR publishes the result." />
          : <EmptyState title="No winners match those filters"
                        action={<Button variant="primary" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>Clear filters</Button>} />
      )}

      {yearAwards.length > 0 && (
        <section className="stack">
          <SectionLabel tone="bronze">Employee of the Year</SectionLabel>
          <div className="hof hof--year">{yearAwards.map((w) => <WinnerTile key={w.winner_id} w={w} />)}</div>
        </section>
      )}
      {monthAwards.length > 0 && (
        <section className="stack">
          <SectionLabel tone="plum">Employee of the Month</SectionLabel>
          <div className="hof">{monthAwards.map((w) => <WinnerTile key={w.winner_id} w={w} />)}</div>
        </section>
      )}
    </div>
  );
}

function WinnerTile({ w }) {
  const year = w.award_type === 'Year';
  return (
    <Card accent={year ? 'bronze' : 'plum'} className={year ? 'hof__tile hof__tile--year' : 'hof__tile'}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <StatusPill tone={year ? 'bronze' : 'plum'}>{year ? 'Year' : 'Month'} · {w.pretty_period}</StatusPill>
        {w.is_co_winner === 1 && <StatusPill>Co-winner</StatusPill>}
      </div>
      <div className="hof__who">
        <Avatar name={w.full_name} size={year ? 64 : 52} />
        <div>
          <div className="hof__name">{w.full_name}</div>
          <div className="hof__role">{w.designation} · {w.department}</div>
          {w.emp_status === 'Inactive' && <StatusPill tone="clay">Inactive</StatusPill>}
        </div>
      </div>
      <p className="hof__cite">{w.citation}</p>
      <div className="row" style={{ marginTop: 'auto' }}>
        <span className="page__lede" style={{ fontSize: 12 }}>{w.final_vote_count} votes · {Number(w.final_average_rating).toFixed(1)} avg</span>
        <span className="spacer" />
        {w.has_showcase
          ? <Link className="page__editlink" to={`/winners/showcase/${w.winner_id}`}>
              {w.showcase_status === 'Draft' ? 'Showcase (draft)' : 'Work showcase →'}
            </Link>
          : <span style={{ fontSize: 12, color: 'var(--c-faint)' }}>Showcase not added</span>}
      </div>
    </Card>
  );
}

/* ================================================== 6.11 Work Showcase */

export function Showcase() {
  const { winnerId } = useParams();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null); setError(null);
    api.showcase(winnerId).then(setData).catch(setError);
  }, [winnerId]);

  if (error) return <EmptyState title="That showcase could not be found" action={<Button as={Link} to="/winners" variant="primary">Hall of Fame</Button>} />;
  if (!data) return <div className="page"><Skeleton h={140} r={14} /><Skeleton h={300} r={10} /></div>;

  const { winner: w, showcase } = data;
  const metrics = showcase?.blocks.filter((b) => b.type === 'metric') || [];

  return (
    <div className="page fade-in showcase">
      <section className="result-banner">
        <Avatar name={w.full_name} size={64} />
        <div className="result-banner__meta">
          <div className="result-banner__label">Employee of the {w.award_type} · {w.pretty_period}</div>
          <div className="result-banner__name">{w.full_name}</div>
          <div className="result-banner__role">{w.designation} · {w.department}</div>
          <p className="result-banner__cite">{w.citation}</p>
        </div>
        <div className="result-banner__figs">
          <div className="result-banner__fig"><b>{w.final_vote_count}</b><span>votes</span></div>
          <div className="result-banner__fig"><b>{Number(w.final_average_rating).toFixed(1)}</b><span>average</span></div>
        </div>
      </section>

      {showcase?.status === 'Draft' && (
        <Callout tone="bronze" title="Draft">Only admins can see this showcase until it is published.</Callout>
      )}

      {!showcase ? (
        <EmptyState title="The work showcase has not been added yet"
                    body="HR can publish a winner first and add the showcase later."
                    action={isAdmin ? <Button as={Link} to={`/admin/winners?cycle=${w.cycle_id}`} variant="primary">Build the showcase</Button> : null} />
      ) : (
        <div className="showcase__body">
          {metrics.length > 0 && (
            <div className="tiles">
              {metrics.map((m, i) => (
                <Card key={i} accent="sage"><div className="stat">
                  <div className="stat__label">{m.label}</div>
                  <div className="stat__value">{m.value}</div>
                </div></Card>
              ))}
            </div>
          )}
          {showcase.blocks.map((b, i) => b.type === 'text' ? (
            <section key={i} className="showcase__text">
              {b.heading && <h2>{b.heading}</h2>}
              {b.body.split(/\n{2,}/).map((para, j) => <p key={j}>{para}</p>)}
            </section>
          ) : null)}
          {showcase.blocks.some((b) => b.type === 'link') && (
            <Card>
              <SectionLabel>Links to the work</SectionLabel>
              <ul className="showcase__links">
                {showcase.blocks.filter((b) => b.type === 'link').map((b, i) => (
                  <li key={i}><a href={b.url} target="_blank" rel="noopener noreferrer">{b.label}</a></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="row">
        {data.prevId && <Button as={Link} to={`/winners/showcase/${data.prevId}`}>← Newer winner</Button>}
        <span className="spacer" />
        {isAdmin && <Button as={Link} to={`/admin/winners?cycle=${w.cycle_id}`} variant="ghost">Edit showcase</Button>}
        {data.nextId && <Button as={Link} to={`/winners/showcase/${data.nextId}`}>Older winner →</Button>}
      </div>
    </div>
  );
}

/** The Work Showcase menu item on its own: every published showcase. */
export function ShowcaseIndex() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.hallOfFame().then((o) => setRows(o.winners.filter((w) => w.has_showcase))); }, []);
  if (!rows) return <div className="page"><Skeleton h={200} r={10} /></div>;
  return (
    <div className="page fade-in">
      <p className="page__lede">What our winners actually did — the reason they won, made visible.</p>
      {rows.length === 0
        ? <EmptyState title="No showcases published yet" body="Showcases appear here as HR publishes them." />
        : <div className="hof">{rows.map((w) => <WinnerTile key={w.winner_id} w={w} />)}</div>}
    </div>
  );
}
