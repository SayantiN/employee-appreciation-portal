import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import {
  Avatar, Button, Callout, Card, EmptyState, Field, SectionLabel, Skeleton, StatusPill, TextArea, TextInput, statusTone,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * SPEC 6.17 — select a closed cycle, review the frozen tally, confirm the
 * winner, write the citation, publish; then build the showcase (6.11).
 */
export function AdminPublish() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [cycles, setCycles] = useState(null);
  const [detail, setDetail] = useState(null);
  const [nonce, setNonce] = useState(0);
  const selected = Number(params.get('cycle')) || null;

  useEffect(() => { api.publishCycles().then((o) => setCycles(o.cycles)); }, [nonce]);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetail(null);
    api.publishCycle(selected).then(setDetail);
  }, [selected, nonce]);

  const pick = (id) => setParams({ cycle: String(id) }, { replace: true });
  const refresh = () => setNonce((n) => n + 1);

  // Open on the most recent month straight away (last month, or the current
  // one once it has closed) rather than an empty right-hand panel.
  useEffect(() => {
    if (selected || !cycles?.length) return;
    const latest = [...cycles].sort((a, b) =>
      (b.award_type === 'Month') - (a.award_type === 'Month') || b.period_label.localeCompare(a.period_label))[0];
    pick(latest.id);
  }, [cycles, selected]);

  if (!cycles) return <div className="page"><Skeleton h={300} r={10} /></div>;

  return (
    <div className="page fade-in">
      <p className="page__lede">
        Cycles needing a decision come first. The computed winner is pre-selected; choosing anyone else, or
        resolving a tie, needs a written justification that goes to the audit log and the Winners Report.
      </p>

      <div className="cols cols--publish">
        <Card padded={false}>
          <div className="pub-list">
            {cycles.length === 0 && <p className="page__lede" style={{ padding: 16 }}>No closed cycles yet.</p>}
            {cycles.map((c) => (
              <button key={c.id} type="button" className={`pub-list__item${c.id === selected ? ' is-on' : ''}`} onClick={() => pick(c.id)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{c.award_type} · {c.pretty_period}</strong>
                  <span className="pub-list__sub">{c.winner_names || `${c.nominees} nominees · ${c.votes_cast} votes`}</span>
                </span>
                <StatusPill tone={statusTone(c.status)}>
                  {c.status === 'TieNeedsDecision' ? 'Tie' : c.status === 'Published' ? 'Published' : c.nominees ? 'To publish' : 'No award'}
                </StatusPill>
              </button>
            ))}
          </div>
        </Card>

        <div className="stack">
          {!selected && cycles.length === 0 && <EmptyState title="Nothing to publish yet" body="Closed cycles appear here once a voting window shuts." />}
          {selected && !detail && <Skeleton h={300} r={10} />}
          {detail && <CycleDetail detail={detail} isAdmin={isAdmin} onDone={refresh} />}
        </div>
      </div>
    </div>
  );
}

function CycleDetail({ detail, isAdmin, onDone }) {
  const { cycle, leaderboard, winners } = detail;
  const published = winners.filter((w) => w.status === 'Published');
  const leaders = leaderboard.filter((r) => r.rank === 1);
  const tie = leaders.length > 1;

  return (
    <>
      <Card>
        <div className="row">
          <SectionLabel>Employee of the {cycle.award_type} · {cycle.pretty_period}</SectionLabel>
          <span className="spacer" />
          <Link className="page__editlink" to={`/results/past?cycle=${cycle.id}`}>Full leaderboard</Link>
        </div>
        {leaderboard.length === 0 ? (
          <Callout tone="bronze" title="No award">This cycle closed with no valid votes. It appears in the Winners Report as “No award”.</Callout>
        ) : (
          <table className="grid__table">
            <thead><tr><th>Rank</th><th>Nominee</th><th className="is-numeric">Votes</th><th className="is-numeric">Avg</th><th className="is-numeric">9s &amp; 10s</th></tr></thead>
            <tbody>
              {leaderboard.slice(0, 8).map((r) => (
                <tr key={r.employee_id}>
                  <td><strong>{r.rank}</strong></td>
                  <td><span className="row" style={{ gap: 8 }}><Avatar name={r.full_name} size={22} />{r.full_name}</span></td>
                  <td className="is-numeric">{r.vote_count}</td>
                  <td className="is-numeric">{r.average_rating}</td>
                  <td className="is-numeric">{r.high_rating_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {published.length > 0 ? (
        <>
          <Callout tone="plum" title="Published">
            {published.map((w) => w.full_name).join(' and ')} — {new Date(published[0].published_at).toLocaleDateString()}
            {published[0].is_override ? ` · ${published[0].override_justification}` : ''}
          </Callout>
          {published.map((w) => <ShowcaseEditor key={w.id} winner={w} isAdmin={isAdmin} />)}
          {isAdmin && <Unpublish cycleId={cycle.id} onDone={onDone} />}
        </>
      ) : leaderboard.length > 0 && (
        isAdmin
          ? <PublishForm cycle={cycle} leaderboard={leaderboard} tie={tie} leaders={leaders} onDone={onDone} />
          : <Callout tone="blue">Awaiting publication by an Admin. Auditors can review but not publish.</Callout>
      )}
    </>
  );
}

function PublishForm({ cycle, leaderboard, tie, leaders, onDone }) {
  const [chosen, setChosen] = useState(tie ? [] : [leaders[0].employee_id]);
  const [citation, setCitation] = useState('');
  const [justification, setJustification] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const computed = !tie && chosen.length === 1 && chosen[0] === leaders[0].employee_id;
  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({});
    try {
      await api.publishWinner(cycle.id, { employeeIds: chosen, citation, justification });
      onDone();
    } catch (err) {
      setErrors(err instanceof ApiError ? (err.errors || { form: err.message }) : { form: 'That did not work.' });
    } finally { setBusy(false); }
  }

  return (
    <Card accent="plum">
      <form className="stack" onSubmit={submit}>
        <SectionLabel tone="plum">Publish the winner</SectionLabel>
        {tie && (
          <Callout tone="clay" title="Tie — needs a decision">
            {leaders.map((l) => l.full_name).join(' and ')} finished level on every tie-break. Choose one
            winner, or tick more than one to declare joint winners. Either way, record why.
          </Callout>
        )}
        {errors.form && <Callout tone="clay">{errors.form}</Callout>}

        <Field label="Winner" error={errors.winner} required>
          <div className="pub-choices">
            {leaderboard.slice(0, 8).map((r) => (
              <label key={r.employee_id} className={`pub-choice${chosen.includes(r.employee_id) ? ' is-on' : ''}`}>
                <input type={tie ? 'checkbox' : 'radio'} name="winner" checked={chosen.includes(r.employee_id)}
                       onChange={() => (tie ? toggle(r.employee_id) : setChosen([r.employee_id]))} />
                <span style={{ flex: 1 }}>{r.full_name} <span className="page__lede">· rank {r.rank} · {r.vote_count} votes</span></span>
                {r.rank === 1 && !tie && <StatusPill tone="sage">Computed winner</StatusPill>}
              </label>
            ))}
          </div>
        </Field>

        {!computed && chosen.length > 0 && (
          <Field label={tie ? 'How the tie was resolved' : 'Justification for the override'} required error={errors.justification}
                 help="Recorded in the audit log, visible to Auditors, and shown in the Winners Report's Decision column.">
            {({ id }) => <TextArea id={id} value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} />}
          </Field>
        )}

        <Field label="Citation" required error={errors.citation}
               help="Why they won, in a few sentences. Shown on the Dashboard, the Hall of Fame and the showcase."
               counter={{ text: `${citation.trim().length} / 50–1000`, over: citation.trim().length > 1000 }}>
          {({ id }) => <TextArea id={id} value={citation} onChange={(e) => setCitation(e.target.value)} rows={4} />}
        </Field>

        <div className="row">
          <Button type="submit" variant="primary" disabled={busy || !chosen.length}>Publish</Button>
          <span className="page__lede">Everyone is notified, and the winner is told first.</span>
        </div>
      </form>
    </Card>
  );
}

function Unpublish({ cycleId, onDone }) {
  const [error, setError] = useState(null);
  async function go() {
    const reason = window.prompt('Unpublishing removes this winner from every employee view and notifies everyone.\n\nWhy? (at least 15 characters)');
    if (!reason) return;
    try { await api.unpublishWinner(cycleId, reason); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work.'); }
  }
  return (
    <div className="row">
      {error && <Callout tone="clay">{error}</Callout>}
      <span className="spacer" />
      <Button size="sm" variant="ghost" onClick={go}>Unpublish this result…</Button>
    </div>
  );
}

/* ------------------------------------------------------ 6.11 showcase */

const EMPTY = { text: { type: 'text', heading: '', body: '' }, metric: { type: 'metric', label: '', value: '' }, link: { type: 'link', label: '', url: '' } };

function ShowcaseEditor({ winner, isAdmin }) {
  const [blocks, setBlocks] = useState(null);
  const [status, setStatus] = useState(winner.showcase_status);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.showcase(winner.id).then((d) => setBlocks(d.showcase?.blocks || []));
  }, [winner.id]);

  const set = (i, patch) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => setBlocks((b) => {
    const n = [...b]; const j = i + d;
    if (j < 0 || j >= n.length) return b;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  async function save(nextStatus) {
    setBusy(true); setMsg(null);
    try {
      const r = await api.saveShowcase(winner.id, { blocks, status: nextStatus });
      setStatus(r.status);
      setMsg({ tone: 'sage', text: r.status === 'Published' ? 'Showcase published.' : 'Draft saved. Only admins can see it.' });
    } catch (e) {
      setMsg({ tone: 'clay', text: e instanceof ApiError ? e.message : 'Could not save.' });
    } finally { setBusy(false); }
  }

  if (!blocks) return <Skeleton h={160} r={10} />;

  return (
    <Card>
      <div className="row">
        <SectionLabel>Work showcase — {winner.full_name}</SectionLabel>
        <span className="spacer" />
        <StatusPill tone={status === 'Published' ? 'plum' : 'neutral'}>{status || 'Not added'}</StatusPill>
        <Link className="page__editlink" to={`/winners/showcase/${winner.id}`}>View</Link>
      </div>
      {msg && <Callout tone={msg.tone}>{msg.text}</Callout>}
      <div className="stack" style={{ marginTop: 8 }}>
        {blocks.length === 0 && <p className="page__lede">No blocks yet. Add a write-up, an impact figure or a link to the work.</p>}
        {blocks.map((b, i) => (
          <div key={i} className="sc-block">
            <div className="row">
              <StatusPill tone="teal">{b.type === 'text' ? 'Write-up' : b.type === 'metric' ? 'Impact figure' : 'Link'}</StatusPill>
              <span className="spacer" />
              {isAdmin && <>
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up">↑</Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down">↓</Button>
                <Button size="sm" variant="ghost" onClick={() => setBlocks((x) => x.filter((_, j) => j !== i))}>Remove</Button>
              </>}
            </div>
            {b.type === 'text' && <>
              <TextInput placeholder="Heading" value={b.heading} disabled={!isAdmin} onChange={(e) => set(i, { heading: e.target.value })} aria-label="Heading" />
              <TextArea rows={4} placeholder="What they did, and why it mattered…" value={b.body} disabled={!isAdmin} onChange={(e) => set(i, { body: e.target.value })} aria-label="Write-up" />
            </>}
            {b.type === 'metric' && (
              <div className="cols cols--2">
                <TextInput placeholder="e.g. Processing time" value={b.label} disabled={!isAdmin} onChange={(e) => set(i, { label: e.target.value })} aria-label="Figure label" />
                <TextInput placeholder="e.g. −42%" value={b.value} disabled={!isAdmin} onChange={(e) => set(i, { value: e.target.value })} aria-label="Figure value" />
              </div>
            )}
            {b.type === 'link' && (
              <div className="cols cols--2">
                <TextInput placeholder="Label" value={b.label} disabled={!isAdmin} onChange={(e) => set(i, { label: e.target.value })} aria-label="Link label" />
                <TextInput placeholder="https://…" value={b.url} disabled={!isAdmin} onChange={(e) => set(i, { url: e.target.value })} aria-label="Link address" />
              </div>
            )}
          </div>
        ))}
        {isAdmin && (
          <div className="row">
            <Button size="sm" onClick={() => setBlocks((b) => [...b, { ...EMPTY.text }])}>+ Write-up</Button>
            <Button size="sm" onClick={() => setBlocks((b) => [...b, { ...EMPTY.metric }])}>+ Impact figure</Button>
            <Button size="sm" onClick={() => setBlocks((b) => [...b, { ...EMPTY.link }])}>+ Link</Button>
            <span className="spacer" />
            <Button size="sm" disabled={busy} onClick={() => save('Draft')}>Save draft</Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => save('Published')}>Publish showcase</Button>
          </div>
        )}
        <p className="page__lede" style={{ fontSize: 11 }}>
          Image, video and document uploads need file storage and virus scanning (R-6.11.3–4), which are not set up yet.
          Link to the work where it already lives instead.
        </p>
      </div>
    </Card>
  );
}
