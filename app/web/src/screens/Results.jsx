import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import {
  Avatar, Button, Callout, Card, EmptyState, ProgressBar, SectionLabel,
  Skeleton, Stat, StatusPill, Withheld,
} from '../components/ui.jsx';
import './screens.scss';

/**
 * SPEC 6.8 — the same cycle renders two different screens by role.
 * An employee sees participation and nothing else until the window closes;
 * an admin or auditor sees the live tally, watermarked. The rule is a product
 * behaviour, not a permission checkbox (BR-5, AC-2).
 */
export function Results() {
  const { isPrivileged } = useAuth();
  const [cycles, setCycles] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(null);

  useEffect(() => {
    api.currentCycles().then((out) => {
      setCycles(out.cycles);
      if (out.cycles.length) setSelected(out.cycles[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setView(null);
    api.cycleResults(selected).then(setView);
  }, [selected]);

  if (!cycles) return <div className="page"><Skeleton h={48} r={10} /><Skeleton h={280} r={10} /></div>;

  if (!cycles.length) {
    return <EmptyState title="No cycle is open right now"
                       body="Past results appear on the Winners Report, which arrives in a later phase." />;
  }

  return (
    <div className="page fade-in">
      <div className="row">
        {cycles.map((c) => (
          <Button key={c.id} size="sm"
                  variant={c.id === selected ? 'primary' : 'secondary'}
                  onClick={() => setSelected(c.id)}>
            {c.award_type} · {c.pretty_period}
          </Button>
        ))}
      </div>

      {!view ? <Skeleton h={260} r={10} /> : view.hidden ? (
        <>
          {/* The hidden state explains itself. "Results are hidden" alone
              invites workaround requests; naming the reason pre-empts them. */}
          <Withheld title={view.message}>
            Nobody can see who is leading — not colleagues, not the person in the lead.
            This is deliberate: visible standings change how people vote.
          </Withheld>

          <Card>
            <SectionLabel>Participation so far</SectionLabel>
            <div className="row" style={{ alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{view.participation}%</span>
              <span className="page__lede" style={{ margin: 0 }}>
                {view.votes_cast} of {view.eligible} employees
              </span>
            </div>
            <ProgressBar value={view.participation} label="Participation" />
          </Card>
        </>
      ) : (
        <>
          {view.preClose && (
            <div className="confidential">Confidential — pre-close</div>
          )}

          {view.noAward && (
            <Callout tone="bronze" title="No award">
              This cycle closed with no valid votes. The month is shown as absent rather than
              omitted, so a gap in the record is never mistaken for missing data.
            </Callout>
          )}

          {view.cycle.status === 'TieNeedsDecision' && (
            <Callout tone="clay" title="Tie — needs a decision">
              Two or more nominees finished level on every tie-break. No winner was published
              automatically; an admin must decide in writing, and the reason goes to the audit log.
            </Callout>
          )}

          {view.leaderboard.length > 0 && (
            <>
              <Card>
                <SectionLabel>
                  {view.preClose ? 'Live tally — not final' : 'Final leaderboard'}
                </SectionLabel>
                <div className="grid__scroller">
                  <table className="grid__table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>Rank</th>
                        <th>Employee</th>
                        <th style={{ width: 150 }}>Department</th>
                        <th style={{ width: 90 }} className="is-numeric">Votes</th>
                        <th style={{ width: 110 }} className="is-numeric">Avg rating</th>
                        <th style={{ width: 90 }} className="is-numeric">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.leaderboard.map((r) => (
                        <tr key={r.employee_id} style={r.rank === 1 ? { background: 'var(--c-plum-tint)' } : undefined}>
                          <td><strong>{r.rank}</strong></td>
                          <td>
                            <span className="row" style={{ gap: 8 }}>
                              <Avatar name={r.full_name} size={24} />
                              <span style={{ fontWeight: r.rank === 1 ? 800 : 500 }}>{r.full_name}</span>
                              {r.is_winner === 1 && !view.preClose && <StatusPill tone="plum">Winner</StatusPill>}
                            </span>
                          </td>
                          <td>{r.department}</td>
                          <td className="is-numeric">{r.vote_count}</td>
                          <td className="is-numeric">{r.average_rating}</td>
                          <td className="is-numeric">{r.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="page__lede" style={{ marginTop: 12 }}>
                  Withdrawn, draft and admin-removed votes are excluded from every figure above.
                </p>
              </Card>

              <Card>
                <SectionLabel>How the winner is decided</SectionLabel>
                <div className="ladder">
                  {['Higher vote count', 'Higher average rating', 'More 9s and 10s', 'Earliest first vote received']
                    .map((step, i) => (
                      <div key={step} className="ladder__row">
                        <StatusPill tone="neutral">{i + 1}</StatusPill>
                        <span>{step}</span>
                      </div>
                    ))}
                  <div className="ladder__row">
                    <StatusPill tone="clay">5</StatusPill>
                    <span><strong>Admin decides, in writing, into the audit log</strong></span>
                  </div>
                </div>
                <p className="page__lede" style={{ marginTop: 12 }}>
                  The tally is frozen the moment the window shuts. Later corrections cannot silently
                  rewrite a published result.
                </p>
              </Card>
            </>
          )}

          {isPrivileged && view.preClose && (
            <Callout tone="blue" title="Why you can see this and colleagues cannot">
              Pre-close standings are excluded from every employee-facing API response — not
              returned and hidden in the interface, but absent from the payload entirely.
            </Callout>
          )}

          <Card>
            <SectionLabel>Cycle statistics</SectionLabel>
            <div className="tiles">
              <Stat label="Nominees" value={view.leaderboard.length} />
              <Stat label="Votes counted" value={view.leaderboard.reduce((a, r) => a + r.vote_count, 0)} />
              <Stat label="Status" value={view.cycle.status} />
              <Stat label="Closes" value={new Date(view.cycle.closes_at).toLocaleDateString()} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
