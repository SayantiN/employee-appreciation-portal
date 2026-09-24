import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import {
  Bars, Button, Callout, Card, EmptyState, SectionLabel, Skeleton, Stat, StatusPill, Withheld,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * SPEC 6.7 — what colleagues said about you. Every card says "A colleague";
 * the payload carries no voter field at all (R-6.7.1), and a cycle's words
 * appear only once it has closed and cleared the reveal threshold (R-6.7.2).
 */
export function FeedbackForMe() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cycle, setCycle] = useState('');
  const [award, setAward] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sort, setSort] = useState('newest');
  const [hidden, setHidden] = useState([]);

  useEffect(() => { api.myFeedback().then(setData).catch(setError); }, []);

  if (error) return <EmptyState variant="error" title="We could not load your feedback" body="The server did not respond." />;
  if (!data) return <div className="page"><div className="tiles">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={86} r={10} />)}</div><Skeleton h={300} r={10} /></div>;

  const s = data.summary;
  let cards = data.cards.filter((c) => !hidden.includes(c.id)
    && (!cycle || String(c.cycle_id) === cycle)
    && (!award || c.award_type === award)
    && (!minRating || (c.rating ?? 0) >= Number(minRating)));
  if (sort === 'rating') cards = [...cards].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  async function report(card) {
    const reason = window.prompt('Report this feedback as abusive. It will be hidden from you straight away and reviewed by HR.\n\nWhat is wrong with it? (optional)');
    if (reason === null) return;
    setHidden((h) => [...h, card.id]);   // R-6.7.4 — hidden immediately
    try { await api.reportFeedback(card.id, reason); } catch { /* the card stays hidden; HR still sees the flag on retry */ }
  }

  return (
    <div className="page fade-in print-page">
      <div className="page__head">
        <p className="page__lede">
          What colleagues wrote when they voted for you. You will never see who wrote it — not their name,
          team, or the time of day. Suggestions are highlighted: that is the part meant to help you grow.
        </p>
        <span className="spacer" />
        <Button size="sm" className="no-print" onClick={() => window.print()}>Download as PDF</Button>
      </div>

      <div className="tiles">
        <Card><Stat label="Votes received" value={s.totalVotes}
                    sub={s.latestCycle ? `${s.latestCycleVotes} in ${s.latestCycle}` : 'from closed cycles'} /></Card>
        <Card><Stat label="Average rating" value={s.average ?? '—'} sub={s.best ? `best ever ${s.best}` : undefined} /></Card>
        <Card><Stat label="Cycles nominated in" value={s.cyclesNominated} /></Card>
        <Card accent={s.wins ? 'plum' : undefined}><Stat label="Awards won" value={s.wins} tone={s.wins ? 'plum' : undefined} /></Card>
      </div>

      <div className="cols cols--feedback">
        <div className="stack feedback__rail">
          <Card>
            <SectionLabel>Ratings you received</SectionLabel>
            {data.cards.length === 0 ? <p className="page__lede">No revealed feedback yet.</p> : (
              <Bars tone="blue" items={data.distribution.map((n, i) => ({ label: String(i + 1), value: n }))} />
            )}
          </Card>

          <Card className="no-print">
            <SectionLabel>Filter</SectionLabel>
            <div className="stack">
              <select className="input" value={cycle} onChange={(e) => setCycle(e.target.value)} aria-label="Cycle">
                <option value="">All cycles</option>
                {data.cycles.map((c) => <option key={c.id} value={c.id}>{c.award_type} · {c.pretty_period}</option>)}
              </select>
              <select className="input" value={award} onChange={(e) => setAward(e.target.value)} aria-label="Award type">
                <option value="">Both awards</option>
                <option value="Month">Employee of the Month</option>
                <option value="Year">Employee of the Year</option>
              </select>
              <select className="input" value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Minimum rating">
                <option value="">Any rating</option>
                {[9, 8, 7, 6, 5].map((r) => <option key={r} value={r}>{r} and above</option>)}
              </select>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
                <option value="newest">Newest first</option>
                <option value="rating">Highest rating first</option>
              </select>
            </div>
          </Card>

          {data.withheld.length > 0 && (
            <Withheld title="Feedback will appear once more colleagues have voted">
              {data.withheld.map((w) => `${w.award_type} · ${w.pretty_period}`).join(', ')}: fewer than{' '}
              {data.threshold} colleagues voted for you, so the words stay hidden. With so few votes,
              you could work out who wrote them — and that would break the promise to them.
            </Withheld>
          )}
        </div>

        <div className="feedback__feed">
          {cards.length === 0 ? (
            <EmptyState
              title={data.cards.length ? 'No feedback matches those filters' : 'No feedback to show yet'}
              body={data.cards.length ? undefined : `Feedback appears once a cycle closes and at least ${data.threshold} colleagues have voted for you in it. Nothing from an open cycle is ever shown.`}
              action={data.cards.length ? <Button variant="primary" onClick={() => { setCycle(''); setAward(''); setMinRating(''); }}>Clear filters</Button> : null}
            />
          ) : cards.map((c) => (
            <Card key={c.id} className="fb-card">
              <div className="row">
                <span className="fb-card__who">A colleague</span>
                <StatusPill tone={c.award_type === 'Year' ? 'bronze' : 'plum'}>{c.award_type} · {c.pretty_period}</StatusPill>
                <span className="spacer" />
                <span className="fb-card__rating" aria-label={`Rating ${c.rating} out of 10`}>{c.rating ?? '—'}<small>/10</small></span>
              </div>
              <Quote label="Why they voted for you" text={c.reason} />
              <Quote label="What set you apart" text={c.comparison} />
              <div className="fb-card__suggest">
                <span className="section-label section-label--sage" style={{ marginBottom: 4 }}>One suggestion</span>
                <p>{c.suggestion}</p>
              </div>
              <div className="row">
                <span className="page__lede" style={{ fontSize: 11 }}>{new Date(c.date).toLocaleDateString()}</span>
                <span className="spacer" />
                <button type="button" className="linkbtn no-print" onClick={() => report(c)}>Report</button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Callout tone="blue" title="Who can see this">
        Only you. HR administrators and auditors can see who cast each vote, for audit purposes only —
        that is disclosed to everyone in How It Works, rather than left for anyone to discover.
      </Callout>
    </div>
  );
}

function Quote({ label, text }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 2 }}>{label}</div>
      <p className={`fb-card__text${long && !open ? ' is-clamped' : ''}`}>{text}</p>
      {long && <button type="button" className="linkbtn no-print" onClick={() => setOpen((v) => !v)}>{open ? 'Show less' : 'Read more'}</button>}
    </div>
  );
}
