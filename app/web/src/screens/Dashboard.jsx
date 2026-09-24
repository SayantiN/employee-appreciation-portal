import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import {
  Avatar, Button, Card, EmptyState, ProgressBar, SectionLabel,
  Skeleton, Stat, StatusPill, Withheld,
} from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

export function Dashboard() {
  const { user, isPrivileged } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(setError);
  }, []);

  if (error) {
    return <EmptyState variant="error" title="We could not load your dashboard"
                       body="The server did not respond. Your data is safe."
                       action={<Button variant="primary" onClick={() => location.reload()}>Try again</Button>} />;
  }
  if (!data) return <DashboardSkeleton />;

  const month = data.openCycles.find((c) => c.award_type === 'Month');
  const year = data.openCycles.find((c) => c.award_type === 'Year');
  const primary = month || year;

  return (
    <div className="page fade-in">
      {/* One call to action, with its deadline. Not a menu of six. */}
      <section className="hero">
        <div className="hero__text">
          <div className="hero__greet">{greeting()}, {user.full_name.split(' ')[0]}</div>
          <div className="hero__line">{callToAction(primary)}</div>
        </div>
        {primary?.votable && (
          <Button as={Link} to={primary.award_type === 'Year' ? '/vote/year' : '/vote/month'}
                  variant="onDark" size="lg" className="hero__cta">
            {primary.my_status === 'Submitted' ? 'Review your vote' : 'Vote Now'}
          </Button>
        )}
      </section>

      {/* Both cycles open at once get two distinct calls to action (SPEC 6.5). */}
      {month && year && (
        <Card accent="plum">
          <div className="row">
            <SectionLabel tone="plum">Employee of the Year is also open</SectionLabel>
            <span className="spacer" />
            <Button as={Link} to="/vote/year" size="sm">Vote for the year award</Button>
          </div>
        </Card>
      )}

      <div className="tiles">
        <Card>
          <Stat label="Current cycle" value={primary ? primary.pretty_period : 'None open'} />
          <div className="row" style={{ marginTop: 8 }}>
            {primary?.votable && <StatusPill tone="sage">Open</StatusPill>}
            {primary && <StatusPill tone="bronze">{closesIn(primary.closes_at)}</StatusPill>}
          </div>
        </Card>

        <Card>
          <Stat
            label="Your voting status"
            value={statusWord(primary?.my_status)}
            sub={primary?.my_status === 'Submitted' ? 'Editable until the window closes' : undefined}
          />
        </Card>

        <Card>
          {/* R-6.3.1 / BR-5 — a count, never a standing. */}
          <Stat label="Company participation" value={primary ? `${primary.participation}%` : '—'}
                sub={primary ? `${primary.votes_cast} of ${primary.eligible} employees` : undefined} />
          {primary && <div style={{ marginTop: 8 }}><ProgressBar value={primary.participation} label="Participation" /></div>}
        </Card>

        <Card>
          <Stat label="Appreciation you received" value={data.received.count}
                sub={data.received.average ? `votes · ${data.received.average} average` : 'from closed cycles'} />
        </Card>
      </div>

      {isPrivileged && data.adminSnapshot && (
        <Card>
          <SectionLabel>Admin snapshot</SectionLabel>
          <div className="tiles">
            <Stat label="Votes cast today" value={data.adminSnapshot.votesToday} />
            <Stat label="Cycles needing action" value={data.adminSnapshot.cyclesNeedingAction}
                  tone={data.adminSnapshot.cyclesNeedingAction ? 'bronze' : undefined} />
            <Stat label="Pending publication" value={data.adminSnapshot.pendingPublication} />
            <Stat label="Flagged content" value={data.adminSnapshot.flagged}
                  tone={data.adminSnapshot.flagged ? 'clay' : undefined} />
          </div>
        </Card>
      )}

      <div className="cols cols--dash">
        <div className="stack">
          <div className="cols cols--2">
            {data.reigning.length === 0 && (
              <Card><EmptyState title="No winners published yet"
                                body="The first award appears here once a cycle closes and HR publishes the winner." /></Card>
            )}
            {data.reigning.map((w) => (
              <Card key={`${w.award_type}-${w.period_label}`} accent="plum">
                <SectionLabel tone="plum">
                  Employee of the {w.award_type} · {w.pretty_period}
                </SectionLabel>
                <div className="winner-card">
                  <Avatar name={w.full_name} size={44} />
                  <div className="winner-card__meta">
                    <div className="winner-card__name">{w.full_name}</div>
                    <div className="winner-card__role">{w.designation} · {w.department}</div>
                    <p className="winner-card__cite">{w.citation}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <SectionLabel>Your appreciation · last {data.trend.length || 0} closed cycles</SectionLabel>
            {data.trend.length === 0 ? (
              <p className="page__lede">Nothing yet. Votes appear here once a cycle you were nominated in has closed.</p>
            ) : (
              <>
                <div className="spark">
                  {data.trend.map((t, i) => (
                    <i key={t.period_label}
                       className={i === data.trend.length - 1 ? 'is-current' : undefined}
                       style={{ height: `${Math.max(12, (t.n / Math.max(...data.trend.map((x) => x.n))) * 100)}%` }} />
                  ))}
                </div>
                <div className="spark-x">
                  {data.trend.map((t) => <span key={t.period_label}>{t.period_label.slice(5)}</span>)}
                </div>
                {/* RR-14 — the same numbers are always available as text. */}
                <details style={{ marginTop: 12 }}>
                  <summary className="page__lede" style={{ cursor: 'pointer' }}>View as table</summary>
                  <table className="grid__table" style={{ marginTop: 8 }}>
                    <thead><tr><th>Cycle</th><th className="is-numeric">Votes</th><th className="is-numeric">Average</th></tr></thead>
                    <tbody>
                      {data.trend.map((t) => (
                        <tr key={t.period_label}>
                          <td>{t.period_label}</td>
                          <td className="is-numeric">{t.n}</td>
                          <td className="is-numeric">{t.avg ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </Card>

          <Card>
            <SectionLabel>Hall of Fame — recent</SectionLabel>
            {data.hallOfFame.length === 0
              ? <p className="page__lede">No winners yet.</p>
              : <div className="faces">
                  {data.hallOfFame.map((w) => (
                    <Avatar key={`${w.award_type}${w.period_label}${w.employee_id}`} name={w.full_name} size={40} />
                  ))}
                </div>}
          </Card>
        </div>

        <div className="stack">
          <Card accent="teal">
            <SectionLabel tone="teal">Getting started</SectionLabel>
            <p className="page__lede" style={{ marginBottom: 12 }}>
              Short walkthroughs of every screen, and a five-minute tour for new joiners.
            </p>
            <div className="row">
              <Button as={Link} to="/tutorials" size="sm">Video tutorials</Button>
              <Button as={Link} to="/help" size="sm" variant="ghost">How it works</Button>
            </div>
          </Card>

          <Card>
            <SectionLabel>Recent feedback about you</SectionLabel>
            {/* R-6.7.3 — nothing from an open cycle is ever shown here. */}
            <Withheld title="Feedback is not visible yet">
              It appears once a cycle closes <strong>and</strong> at least three colleagues have voted for you.
            </Withheld>
            <div style={{ marginTop: 8 }}><Link to="/feedback" className="page__editlink">Open Feedback for Me →</Link></div>
          </Card>

          {data.announcements.length > 0 && (
            <Card>
              <SectionLabel>Announcements</SectionLabel>
              <div className="stack">
                {data.announcements.map((a, i) => (
                  <div key={i}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</div>
                    <div className="page__lede">{a.body}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- bits */

function DashboardSkeleton() {
  return (
    <div className="page">
      <Skeleton h={96} r={14} />
      <div className="tiles">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={104} r={10} />)}
      </div>
      <Skeleton h={220} r={10} />
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function statusWord(s) {
  if (s === 'Submitted') return 'Submitted';
  if (s === 'Draft') return 'Draft saved';
  if (s === 'Withdrawn') return 'Withdrawn';
  return 'Not submitted';
}

function callToAction(cycle) {
  if (!cycle) return 'No cycle is open right now. We will let you know when the next one opens.';
  if (!cycle.votable) return `Voting for ${cycle.pretty_period} opens ${new Date(cycle.opens_at).toLocaleString()}.`;
  if (cycle.my_status === 'Submitted') {
    return `Your vote is in. You can change or withdraw it until ${new Date(cycle.closes_at).toLocaleString()}.`;
  }
  return `Voting for ${cycle.pretty_period} closes ${closesIn(cycle.closes_at)} — you haven't voted yet.`;
}

function closesIn(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'closing now';
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  if (d > 0) return `in ${d}d ${h}h`;
  const m = Math.floor((ms % 36e5) / 6e4);
  return `in ${h}h ${m}m`;
}
