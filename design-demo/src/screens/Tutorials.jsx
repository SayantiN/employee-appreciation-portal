import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import {
  Button, Callout, Card, EmptyState, ProgressBar, SectionLabel, Skeleton, StatusPill,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

const mins = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** SPEC 6.14.1 — the library, grouped by category, with the onboarding tour. */
export function Tutorials() {
  const [data, setData] = useState(null);
  useEffect(() => { api.tutorials().then(setData); }, []);

  if (!data) return <div className="page"><Skeleton h={90} r={14} /><div className="hof">{[0, 1, 2].map((i) => <Skeleton key={i} h={160} r={10} />)}</div></div>;
  if (!data.enabled) return <EmptyState title="Video tutorials are switched off" body="Your administrator has disabled the tutorial library." />;

  const ob = data.onboarding;
  const pct = ob.total ? Math.round((ob.done / ob.total) * 100) : 0;

  return (
    <div className="page fade-in">
      {ob.total > 0 && (
        <section className="tour">
          <div className="tour__ring" style={{ '--pct': `${pct}%` }} aria-hidden="true"><span>{pct}%</span></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="tour__title">{ob.done === ob.total ? 'Tour complete' : 'New here? Start the 5-minute tour'}</div>
            <div className="tour__sub">{ob.done} of {ob.total} onboarding videos finished</div>
          </div>
          {ob.nextId && <Button as={Link} to={`/tutorials/${ob.nextId}`} variant="onDark">{ob.done ? 'Continue' : 'Start'}</Button>}
        </section>
      )}

      {data.categories.map((cat) => (
        <section key={cat} className="stack">
          <SectionLabel tone={cat === 'Administration' ? 'plum' : 'teal'}>{cat}</SectionLabel>
          <div className="hof">
            {data.tutorials.filter((t) => t.category === cat).map((t) => (
              <Link key={t.id} to={`/tutorials/${t.id}`} className="tut-card">
                <div className="tut-card__thumb" aria-hidden="true"><span>▶</span><em>{mins(t.duration_seconds)}</em></div>
                <div className="tut-card__body">
                  <div className="tut-card__title">{t.title}</div>
                  <div className="tut-card__desc">{t.description}</div>
                  <div className="row" style={{ gap: 6 }}>
                    {t.completed ? <StatusPill tone="sage">Watched</StatusPill>
                      : t.percent > 0 ? <StatusPill tone="bronze">In progress</StatusPill>
                      : <StatusPill>Not started</StatusPill>}
                    {t.status === 'Stale' && <StatusPill tone="clay">May be out of date</StatusPill>}
                    {!t.has_video && <StatusPill tone="teal">Transcript</StatusPill>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="page__lede" style={{ fontSize: 12 }}>{data.disclosure}</p>
    </div>
  );
}

/**
 * SPEC 6.14.3 — the player. Videos are recorded last (SPEC §17), so until a
 * file is attached the transcript is the lesson; it is mandatory anyway
 * (WCAG 1.2.3) and generated from the script, never from the audio (R-6.14.2).
 */
export function TutorialPlayer() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState(false);
  const video = useRef(null);
  const reported = useRef(0);

  useEffect(() => {
    setData(null); setError(null); setDone(false); reported.current = 0;
    api.tutorial(id).then((d) => { setData(d); setDone(!!d.progress.completed); }).catch(setError);
  }, [id]);

  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed]);

  function onTime() {
    const v = video.current;
    if (!v?.duration) return;
    const pct = Math.floor((v.currentTime / v.duration) * 100);
    // Report in 10% steps — resume position without a request every second.
    if (pct >= reported.current + 10) {
      reported.current = pct;
      api.tutorialProgress(id, pct).then((r) => r.completed && setDone(true));
    }
  }

  async function markRead() {
    const r = await api.tutorialProgress(id, 100);
    setDone(r.completed);
  }

  if (error) return <EmptyState title="That tutorial could not be found" action={<Button as={Link} to="/tutorials" variant="primary">All tutorials</Button>} />;
  if (!data) return <div className="page"><Skeleton h={320} r={10} /></div>;

  const t = data.tutorial;
  const lines = data.transcript.filter((l) => !q || l.text.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page fade-in">
      <div className="row">
        <Link to="/tutorials" className="page__editlink">← All tutorials</Link>
        <span className="spacer" />
        <StatusPill tone="teal">{t.category}</StatusPill>
        {t.status === 'Stale' && <StatusPill tone="clay">May be out of date</StatusPill>}
      </div>
      <h2 className="player__title">{t.title}</h2>

      <div className="player">
        <div className="player__main">
          {t.video_url ? (
            <video ref={video} className="player__video" src={t.video_url} controls preload="metadata" onTimeUpdate={onTime}>
              <track kind="captions" srcLang="en" label="English" default />
            </video>
          ) : (
            <div className="player__placeholder">
              <strong>Video not recorded yet</strong>
              <span>Footage is captured once the screens are final. The transcript beside this box is the full lesson.</span>
            </div>
          )}
          <div className="row">
            {t.video_url && (
              <label className="row" style={{ gap: 6 }}>Speed
                <select className="input" style={{ width: 'auto' }} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                  {[0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}×</option>)}
                </select>
              </label>
            )}
            <span className="page__lede" style={{ fontSize: 12 }}>{mins(t.duration_seconds)} · {data.disclosure}</span>
            <span className="spacer" />
            {done ? <StatusPill tone="sage">Completed</StatusPill>
              : !t.video_url && <Button size="sm" variant="primary" onClick={markRead}>Mark as read</Button>}
          </div>
          {!done && t.video_url && <ProgressBar value={data.progress.percent} tone="teal" label="Watched" />}
          <div className="row">
            {data.prevId && <Button as={Link} to={`/tutorials/${data.prevId}`} size="sm">← Previous</Button>}
            {t.related_path && <Button as={Link} to={t.related_path} size="sm" variant="ghost">Open the screen this explains</Button>}
            <span className="spacer" />
            {data.nextId && <Button as={Link} to={`/tutorials/${data.nextId}`} size="sm">Next →</Button>}
          </div>
        </div>

        <Card className="player__transcript">
          <SectionLabel>Transcript</SectionLabel>
          <input className="input" type="search" placeholder="Search the transcript…" aria-label="Search the transcript"
                 value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <ol className="transcript">
            {lines.map((l) => (
              <li key={l.at}>
                <button type="button" disabled={!t.video_url}
                        onClick={() => { if (video.current) { video.current.currentTime = l.at; video.current.play(); } }}>
                  <time>{mins(l.at)}</time> {l.text}
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Callout tone="teal" title="Watch time is private">
        Progress is kept only to resume where you left off and to show your onboarding tour. It is never
        used in voting, appraisals or any report that ranks people.
      </Callout>
    </div>
  );
}
