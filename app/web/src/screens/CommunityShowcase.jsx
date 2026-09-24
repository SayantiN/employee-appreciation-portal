import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import {
  Avatar, Button, Callout, Card, EmptyState, Field, Segmented, SectionLabel, Skeleton, StatusPill,
  TextArea, TextInput,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * SPEC 6.11A — Community Showcase. The winner showcase celebrates the few;
 * this one lets anyone share work worth learning from. Authors own their
 * posts; HR can hide a post with a reason, never edit it.
 */
export function CommunityShowcase() {
  const [data, setData] = useState(null);
  const [scope, setScope] = useState('all');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.communityPosts({ q, department: dept, mine: scope === 'mine' ? '1' : '' }).then(setData);
    }, 250);
    return () => clearTimeout(t);
  }, [q, dept, scope]);

  return (
    <div className="page fade-in">
      <div className="page__head">
        <p className="page__lede">
          Work from anyone in the company that others could learn from — a runbook, a template, a
          better way of doing something. You do not need to have won anything to share here.
        </p>
        <span className="spacer" />
        <Button as={Link} to="/showcase/community/new" variant="primary">Share your work</Button>
      </div>

      <div className="toolbar-row">
        <Segmented label="Show" value={scope} onChange={setScope}
                   options={[{ value: 'all', label: 'All work' }, { value: 'mine', label: 'My posts' }]} />
        <select className="input" style={{ width: 'auto' }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {(data?.departments || []).map((d) => <option key={d}>{d}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 260 }} type="search" placeholder="Search title, summary or author…"
               aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!data ? (
        <div className="hof">{[0, 1, 2].map((i) => <Skeleton key={i} h={190} r={10} />)}</div>
      ) : data.posts.length === 0 ? (
        scope === 'mine' && !q && !dept
          ? <EmptyState title="You have not shared anything yet"
                        body="Share a piece of work that would save a colleague time. Drafts stay private until you publish."
                        action={<Button as={Link} to="/showcase/community/new" variant="primary">Share your work</Button>} />
          : q || dept
            ? <EmptyState title="Nothing matches that search"
                          action={<Button variant="primary" onClick={() => { setQ(''); setDept(''); }}>Clear filters</Button>} />
            : <EmptyState title="No work shared yet" body="Be the first — it only takes a title, a summary and a link." />
      ) : (
        <div className="hof">
          {data.posts.map((p) => <PostCard key={p.id} p={p} />)}
        </div>
      )}

      <Callout tone="teal" title="How this differs from the Winner Showcase">
        The Winner Showcase is written by HR about an award winner. Community posts are written by the
        person who did the work, about anything useful. Posts have no effect on voting or awards.
      </Callout>
    </div>
  );
}

function PostCard({ p }) {
  return (
    <Link to={`/showcase/community/${p.id}`} className="tut-card community-card">
      <div className="tut-card__body">
        <div className="row" style={{ gap: 6 }}>
          {p.status !== 'Published' && <StatusPill tone={p.status === 'Hidden' ? 'clay' : 'neutral'}>{p.status}</StatusPill>}
          {p.is_mine && <StatusPill tone="teal">Yours</StatusPill>}
        </div>
        <div className="tut-card__title">{p.title}</div>
        <div className="tut-card__desc" style={{ WebkitLineClamp: 3 }}>{p.summary || 'No summary yet.'}</div>
        {p.metrics.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {p.metrics.map((m, i) => <StatusPill key={i} tone="sage">{m.value} · {m.label}</StatusPill>)}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
          <Avatar name={p.author_name} size={24} />
          <span style={{ fontSize: 12, minWidth: 0 }}>
            <strong>{p.author_name}</strong>
            <span className="page__lede" style={{ fontSize: 11, display: 'block' }}>
              {p.author_department} · {p.published_at ? new Date(p.published_at.replace(' ', 'T')).toLocaleDateString() : 'not published'}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------- detail */

export function CommunityPost() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => { setData(null); api.communityPost(id).then(setData).catch(setError); }, [id, nonce]);

  async function hide() {
    const reason = window.prompt('Hide this post from everyone? The author sees your reason, and it is audit-logged.\n\nReason (at least 10 characters):');
    if (!reason) return;
    try { await api.hideCommunityPost(id, reason); setNonce((n) => n + 1); }
    catch (e) { window.alert(e instanceof ApiError ? e.message : 'That did not work.'); }
  }
  async function restore() {
    await api.restoreCommunityPost(id); setNonce((n) => n + 1);
  }

  if (error) return <EmptyState title="That post could not be found" action={<Button as={Link} to="/showcase/community" variant="primary">Community Showcase</Button>} />;
  if (!data) return <div className="page"><Skeleton h={120} r={14} /><Skeleton h={260} r={10} /></div>;

  const p = data.post;
  const metrics = p.blocks.filter((b) => b.type === 'metric');
  const links = p.blocks.filter((b) => b.type === 'link');

  return (
    <div className="page fade-in showcase">
      <div className="row">
        <Link to="/showcase/community" className="page__editlink">← Community Showcase</Link>
        <span className="spacer" />
        {p.is_mine && p.status !== 'Hidden' && <Button as={Link} to={`/showcase/community/${p.id}/edit`} size="sm">Edit</Button>}
        {isAdmin && p.status === 'Published' && <Button size="sm" variant="ghost" onClick={hide}>Hide post…</Button>}
        {isAdmin && p.status === 'Hidden' && <Button size="sm" onClick={restore}>Restore</Button>}
      </div>

      <section className="community-head">
        <StatusPill tone="teal">Community Showcase</StatusPill>
        <h2>{p.title}</h2>
        <p>{p.summary}</p>
        <div className="row" style={{ gap: 10 }}>
          <Avatar name={p.author_name} size={36} />
          <div>
            <strong>{p.author_name}</strong>
            <div className="page__lede" style={{ fontSize: 12 }}>
              {p.author_designation} · {p.author_department}
              {p.published_at && ` · shared ${new Date(p.published_at.replace(' ', 'T')).toLocaleDateString()}`}
            </div>
          </div>
        </div>
      </section>

      {p.status === 'Draft' && <Callout tone="bronze" title="Draft">Only you can see this post until you publish it.</Callout>}
      {p.status === 'Hidden' && <Callout tone="clay" title="Hidden by HR">{p.hidden_reason}</Callout>}

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
        {p.blocks.filter((b) => b.type === 'text').map((b, i) => (
          <section key={i} className="showcase__text">
            {b.heading && <h2>{b.heading}</h2>}
            {b.body.split(/\n{2,}/).map((para, j) => <p key={j}>{para}</p>)}
          </section>
        ))}
        {links.length > 0 && (
          <Card>
            <SectionLabel>Links to the work</SectionLabel>
            <ul className="showcase__links">
              {links.map((b, i) => <li key={i}><a href={b.url} target="_blank" rel="noopener noreferrer">{b.label}</a></li>)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- editor */

const EMPTY = { text: { type: 'text', heading: '', body: '' }, metric: { type: 'metric', label: '', value: '' }, link: { type: 'link', label: '', url: '' } };

export function CommunityEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(id ? null : { title: '', summary: '', blocks: [{ ...EMPTY.text }] });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.communityPost(id).then(({ post }) => setForm({ title: post.title, summary: post.summary, blocks: post.blocks }));
  }, [id]);

  if (!form) return <div className="page"><Skeleton h={320} r={10} /></div>;

  const setBlock = (i, patch) => setForm((f) => ({ ...f, blocks: f.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const move = (i, d) => setForm((f) => {
    const b = [...f.blocks]; const j = i + d;
    if (j < 0 || j >= b.length) return f;
    [b[i], b[j]] = [b[j], b[i]];
    return { ...f, blocks: b };
  });

  async function save(status) {
    setBusy(true); setErrors({});
    try {
      const payload = { ...form, status };
      const out = id ? await api.updateCommunityPost(id, payload) : await api.createCommunityPost(payload);
      navigate(`/showcase/community/${id || out.id}`);
    } catch (e) {
      setErrors(e instanceof ApiError ? (e.errors || { form: e.message }) : { form: 'Could not save.' });
    } finally { setBusy(false); }
  }

  return (
    <div className="page fade-in">
      <div className="row">
        <Link to={id ? `/showcase/community/${id}` : '/showcase/community'} className="page__editlink">← Back</Link>
      </div>
      <Card>
        <div className="stack">
          <SectionLabel tone="teal">{id ? 'Edit your post' : 'Share your work'}</SectionLabel>
          {errors.form && <Callout tone="clay">{errors.form}</Callout>}
          <Field label="Title" required error={errors.title} counter={{ text: `${form.title.trim().length} / 120`, over: form.title.trim().length > 120 }}>
            {({ id: fid }) => <TextInput id={fid} value={form.title} placeholder="e.g. A one-page runbook for the nightly deploy"
                                         onChange={(e) => setForm({ ...form, title: e.target.value })} />}
          </Field>
          <Field label="Summary" required error={errors.summary}
                 help="What it is, and who it would help. Shown on the card."
                 counter={{ text: `${form.summary.trim().length} / 20–400`, over: form.summary.trim().length > 400 }}>
            {({ id: fid }) => <TextArea id={fid} rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />}
          </Field>

          <div>
            <div className="field__label" style={{ marginBottom: 6 }}>The work</div>
            {errors.blocks && <Callout tone="clay">{errors.blocks}</Callout>}
            <div className="stack">
              {form.blocks.map((b, i) => (
                <div key={i} className="sc-block">
                  <div className="row">
                    <StatusPill tone="teal">{b.type === 'text' ? 'Write-up' : b.type === 'metric' ? 'Impact figure' : 'Link'}</StatusPill>
                    <span className="spacer" />
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up">↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down">↓</Button>
                    <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, blocks: f.blocks.filter((_, j) => j !== i) }))}>Remove</Button>
                  </div>
                  {b.type === 'text' && <>
                    <TextInput placeholder="Heading" value={b.heading} onChange={(e) => setBlock(i, { heading: e.target.value })} aria-label="Heading" />
                    <TextArea rows={4} placeholder="What you did, how, and what others can reuse…" value={b.body} onChange={(e) => setBlock(i, { body: e.target.value })} aria-label="Write-up" />
                  </>}
                  {b.type === 'metric' && (
                    <div className="cols cols--2">
                      <TextInput placeholder="e.g. Recovery time" value={b.label} onChange={(e) => setBlock(i, { label: e.target.value })} aria-label="Figure label" />
                      <TextInput placeholder="e.g. 4h → 25m" value={b.value} onChange={(e) => setBlock(i, { value: e.target.value })} aria-label="Figure value" />
                    </div>
                  )}
                  {b.type === 'link' && (
                    <div className="cols cols--2">
                      <TextInput placeholder="Label" value={b.label} onChange={(e) => setBlock(i, { label: e.target.value })} aria-label="Link label" />
                      <TextInput placeholder="https://…" value={b.url} onChange={(e) => setBlock(i, { url: e.target.value })} aria-label="Link address" />
                    </div>
                  )}
                </div>
              ))}
              <div className="row">
                <Button size="sm" onClick={() => setForm((f) => ({ ...f, blocks: [...f.blocks, { ...EMPTY.text }] }))}>+ Write-up</Button>
                <Button size="sm" onClick={() => setForm((f) => ({ ...f, blocks: [...f.blocks, { ...EMPTY.metric }] }))}>+ Impact figure</Button>
                <Button size="sm" onClick={() => setForm((f) => ({ ...f, blocks: [...f.blocks, { ...EMPTY.link }] }))}>+ Link</Button>
              </div>
              <p className="page__lede" style={{ fontSize: 11 }}>
                File uploads need file storage and virus scanning, which are not set up yet. Link to where the work already lives.
              </p>
            </div>
          </div>

          <div className="row">
            <Button variant="primary" disabled={busy} onClick={() => save('Published')}>Publish</Button>
            <Button disabled={busy} onClick={() => save('Draft')}>Save as draft</Button>
            <span className="page__lede">Drafts are visible only to you.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
