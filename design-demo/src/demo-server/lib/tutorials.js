import { db } from '../db.js';

/**
 * SPEC 6.14.2 — the launch library. The script is stored with each record
 * because it is the source of truth (R-6.14.1): captions and the transcript
 * are derived from it, and narration is regenerated from it when a screen
 * changes. Video files are recorded last (SPEC §17 note 2), so every entry
 * starts as a script with no video yet.
 */
const BASELINE = [
  ['Welcome — what this portal is for', 'Getting Started', 90, 'All', 1, '/',
    'This portal is where we recognise each other. Every month you can vote for one colleague as Employee of the Month, and once a year for Employee of the Year. A vote is more than a name: you say what they did, why it stood out, one suggestion for them, and a rating. Winners are chosen automatically when voting closes, and celebrated in the Hall of Fame.'],
  ['Signing in and setting your password', 'Getting Started', 120, 'All', 1, '/',
    'Sign in with your work email. Passwords need at least ten characters and three of: uppercase, lowercase, a digit, a symbol. If you forget it, use Forgot password on the sign-in screen; the link is valid for thirty minutes. Changing your password signs you out everywhere else.'],
  ['Finding your way around the Dashboard', 'Getting Started', 150, 'All', 1, '/',
    'The Dashboard shows one thing to do next, with its deadline. Below it: the current cycle, whether you have voted, company participation, and the appreciation you have received. Reigning winners and recent Hall of Fame entries sit underneath.'],
  ['Voting for Employee of the Month', 'Voting', 210, 'All', 0, '/vote/month',
    'Open Vote, then Employee of the Month. Choose a colleague — you will not find yourself in the list. Write the reason, why they stood out over others, one suggestion, and a rating from one to ten. Confirm it is your honest assessment and submit. Drafts save as you type.'],
  ['Voting for Employee of the Year', 'Voting', 120, 'All', 0, '/vote/year',
    'The year ballot works like the month ballot, with one difference: the comparison field needs at least fifty characters, because a year-level claim should carry more evidence.'],
  ['Editing or withdrawing your vote', 'Voting', 90, 'All', 0, '/my-votes',
    'Until the window closes you can change or withdraw your vote from My Votes. Every change is versioned. Once voting closes, the vote is locked.'],
  ['Reading the feedback you received', 'Your Feedback', 180, 'All', 0, '/feedback',
    'Feedback for Me shows what colleagues wrote about you, labelled only as a colleague. It appears once a cycle has closed and at least three people voted for you. The suggestion is highlighted — that is the part meant to help you grow.'],
  ['How anonymity works — and what admins can see', 'Your Feedback', 120, 'All', 1, '/help',
    'Nominees never see who voted for them: no names, departments, or times. Feedback is held back until at least three colleagues voted for you, so a single vote cannot be traced. Administrators and auditors can see voter identity, for audit only. We say this plainly so nobody has to discover it.'],
  ['How the winner is decided', 'Voting', 180, 'All', 0, '/results',
    'When the window closes, votes are counted and frozen. The most votes wins. Ties are broken by higher average rating, then more nines and tens, then the earliest first vote. If still level, an administrator decides in writing and the reason goes to the audit log.'],
  ['Hall of Fame and the Work Showcase', 'Winners & Showcase', 120, 'All', 0, '/winners',
    'The Hall of Fame lists every winner. Where a winner has a Work Showcase, open it to see what they actually did: a write-up, impact figures and links to the work.'],
  ['Using the Winners Report — filter, sort, export', 'Reports', 180, 'All', 0, '/reports/winners',
    'The Winners Report answers who won what and when. Switch between month-wise, year-wise, date-wise and all awards. Filter any column, sort by clicking headers, and export to a spreadsheet. The Award Statistics report counts wins and nominations per person.'],
  ['Using the portal on your phone', 'Getting Started', 120, 'All', 0, '/',
    'On a phone, the bottom bar holds Dashboard, Vote, Feedback and Winners. Everything else is under More. Tables become cards, and sort and filter open as sheets — nothing is left out.'],
  ['Managing voting cycles', 'Administration', 300, 'Admin', 0, '/admin/cycles',
    'Voting Cycles lists every cycle. Create one as a draft and the scheduler opens and closes it on time. Close, cancel, recompute and reopen are overrides, and every one is written to the audit log. Reopening needs a typed reason.'],
  ['Publishing a winner and building a showcase', 'Administration', 360, 'Admin', 0, '/admin/winners',
    'Publish Winners lists closed cycles. Review the frozen tally; the computed winner is pre-selected. Write a citation of at least fifty characters. Choosing someone else, or resolving a tie, requires a written justification. After publishing, build the Work Showcase from text, impact figures and links.'],
  ['Analytics, exports and the audit log', 'Administration', 240, 'Admin', 0, '/admin/analytics',
    'Analytics shows participation, ratings and winner history. Exports follow your filters. The audit log records every change — it can be read and exported, never edited.'],
];

export function seedBaselineTutorials() {
  const n = db.prepare('SELECT COUNT(*) n FROM tutorials').get().n;
  if (n > 0) return;
  const insert = db.prepare(
    `INSERT INTO tutorials (title, category, duration_seconds, audience, in_onboarding, related_path,
                            script, description, status, sort_order)
     VALUES (?,?,?,?,?,?,?,?, 'Published', ?)`
  );
  const tx = db.transaction(() => {
    BASELINE.forEach(([title, category, secs, audience, onboarding, path, script], i) => {
      insert.run(title, category, secs, audience, onboarding, path, script, firstSentence(script), i + 1);
    });
  });
  tx();
}

function firstSentence(text) {
  const m = text.match(/^[^.]+\./);
  return m ? m[0] : text.slice(0, 120);
}

/** Captions are cut from the script, never transcribed from audio (R-6.14.2). */
export function transcriptFrom(script, durationSeconds) {
  const lines = String(script).split(/(?<=[.?!])\s+/).filter(Boolean);
  const total = lines.reduce((a, l) => a + l.length, 0) || 1;
  let t = 0;
  return lines.map((text) => {
    const at = Math.round(t);
    t += (text.length / total) * (durationSeconds || 60);
    return { at, text };
  });
}
