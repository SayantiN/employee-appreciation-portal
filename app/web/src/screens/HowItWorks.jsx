import { Link } from 'react-router-dom';
import { Card, SectionLabel, StatusPill } from '../components/ui.jsx';
import './screens.scss';
import './pages.scss';

/**
 * SPEC 6.13 — the rules, in plain words. The anonymity section states what
 * admins can see (R-4.1); a portal that relies on people not asking has not
 * disclosed anything.
 */
export function HowItWorks() {
  return (
    <div className="page fade-in prose">
      <p className="page__lede">
        Everything about how the awards work, in one place. Prefer video? The{' '}
        <Link to="/tutorials" className="page__editlink">Video Tutorials</Link> cover the same ground.
      </p>

      <Card>
        <SectionLabel>The two awards</SectionLabel>
        <p><strong>Employee of the Month</strong> — voting opens on the 1st and closes on the last day of the month.</p>
        <p><strong>Employee of the Year</strong> — voting runs through December. Anyone active can be nominated, not only that year's monthly winners.</p>
      </Card>

      <Card>
        <SectionLabel>Voting</SectionLabel>
        <ul>
          <li>You get <strong>one vote per cycle</strong>, and you cannot vote for yourself.</li>
          <li>A vote has four parts: why you chose them, what set them apart from others, one suggestion for them, and a rating from 1 to 10. All four are required.</li>
          <li>You can edit or withdraw your vote until the window closes. Every edit is kept as a version; the nominee only ever sees the final one.</li>
          <li>The server's clock decides when voting closes, not the countdown on your screen.</li>
        </ul>
      </Card>

      <Card accent="plum">
        <SectionLabel tone="plum">Anonymity — and what admins can see</SectionLabel>
        <ul>
          <li><strong>Nominees never see who voted for them.</strong> Feedback cards say "A colleague" — no name, team, avatar, or time of day.</li>
          <li>Feedback is shown only after the cycle closes <strong>and</strong> at least three colleagues voted for that person. With fewer votes, the author could be guessed.</li>
          <li><strong>HR administrators and auditors can see who cast each vote.</strong> This exists for audit only — to investigate abuse or a disputed result.</li>
          <li>You can report a feedback card as abusive. It disappears for you at once and HR reviews it.</li>
        </ul>
      </Card>

      <Card>
        <SectionLabel>How the winner is decided</SectionLabel>
        <p>Nobody — not colleagues, not the person in the lead — can see standings while voting is open. When the window closes, the tally is counted and frozen.</p>
        <div className="ladder">
          {['Most votes', 'Higher average rating', 'More 9s and 10s', 'Earliest first vote received'].map((s, i) => (
            <div key={s} className="ladder__row"><StatusPill>{i + 1}</StatusPill><span>{s}</span></div>
          ))}
          <div className="ladder__row"><StatusPill tone="clay">5</StatusPill><span>Still level: HR decides in writing, and the reason is recorded in the audit log. HR may also declare joint winners.</span></div>
        </div>
        <p>If HR publishes someone other than the computed winner, that requires a written justification, and the Winners Report marks it as an override.</p>
      </Card>

      <Card>
        <SectionLabel>After the result</SectionLabel>
        <ul>
          <li>Winners appear on the Dashboard, in the <Link to="/winners" className="page__editlink">Hall of Fame</Link>, and in the <Link to="/reports/winners" className="page__editlink">Winners Report</Link>.</li>
          <li>The <Link to="/reports/award-stats" className="page__editlink">Award Statistics</Link> report counts how many times each person has won or been nominated. Only closed cycles count.</li>
          <li>HR may add a Work Showcase describing what the winner actually did.</li>
        </ul>
      </Card>

      <Card>
        <SectionLabel>Questions</SectionLabel>
        <details><summary>I voted for the wrong person. Can I fix it?</summary><p>Yes, until voting closes — open My Votes and edit it.</p></details>
        <details><summary>Why can't I see my feedback from last month?</summary><p>Fewer than three colleagues voted for you in that cycle, so the words stay hidden to protect them. The vote count still shows on your Dashboard.</p></details>
        <details><summary>Can a month have no winner?</summary><p>Yes. If nobody votes, the month is shown as "No award" rather than left blank.</p></details>
        <details><summary>Who do I contact?</summary><p>Your HR partner.</p></details>
      </Card>
    </div>
  );
}
