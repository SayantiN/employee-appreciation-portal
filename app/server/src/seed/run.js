/**
 * Seed runner.  npm run seed:demo | seed:minimal | reset
 *
 * The demo dataset is the one the spec requires for tutorial recordings
 * (R-6.14.6): entirely fictitious people, repeatable, so screen captures can
 * be retaken identically and no real vote or feedback is ever filmed.
 */
import { db, migrate } from '../db.js';
import { hashPassword } from '../lib/password.js';
import { computeTally } from '../lib/cycles.js';
import { auditSystem } from '../lib/audit.js';
import { seedBaselineTutorials } from '../lib/tutorials.js';

const mode = process.argv[2] || 'demo';
const DEMO_PASSWORD = 'Portal#2026';

const PEOPLE = [
  ['E-0655', 'Ganesh Kulkarni',  'ganesh@isgesolutions.com',     'Engineering Manager', 'Engineering', 'Admin'],
  ['E-1042', 'Priya Nair',       'priya.nair@isgesolutions.com', 'Platform Engineer',   'Engineering', 'Auditor'],
  ['E-0293', 'Aisha Khan',       'aisha.khan@isgesolutions.com', 'Operations Lead',     'Operations',  'Employee'],
  ['E-0871', 'Rahul Menon',      'rahul.menon@isgesolutions.com','Senior Designer',     'Design',      'Employee'],
  ['E-0448', 'Sneha Patel',      'sneha.patel@isgesolutions.com','QA Engineer',         'Engineering', 'Employee'],
  ['E-1180', 'Vikram Rao',       'vikram.rao@isgesolutions.com', 'Data Engineer',       'Engineering', 'Employee'],
  ['E-0512', 'Meera Iyer',       'meera.iyer@isgesolutions.com', 'Product Manager',     'Product',     'Employee'],
  ['E-0177', 'Karan Shah',       'karan.shah@isgesolutions.com', 'Support Specialist',  'Operations',  'Employee'],
  ['E-0733', 'Divya Raman',      'divya.raman@isgesolutions.com','Frontend Engineer',   'Engineering', 'Employee'],
  ['E-0901', 'Arjun Das',        'arjun.das@isgesolutions.com',  'Backend Engineer',    'Engineering', 'Employee'],
  ['E-0264', 'Nisha Verma',      'nisha.verma@isgesolutions.com','Finance Analyst',     'Finance',     'Employee'],
  ['E-1355', 'Rohit Bansal',     'rohit.bansal@isgesolutions.com','Account Manager',    'Sales',       'Employee'],
  ['E-0688', 'Kavya Suresh',     'kavya.suresh@isgesolutions.com','UX Researcher',      'Design',      'Employee'],
  ['E-0420', 'Imran Sheikh',     'imran.sheikh@isgesolutions.com','DevOps Engineer',    'Engineering', 'Employee'],
  ['E-0999', 'Tara Joshi',       'tara.joshi@isgesolutions.com', 'HR Partner',          'Operations',  'Employee'],
  ['E-0301', 'Sameer Gupta',     'sameer.gupta@isgesolutions.com','Solutions Architect','Engineering', 'Employee'],
  ['E-0574', 'Leena Fernandes',  'leena.f@isgesolutions.com',    'Content Designer',    'Design',      'Employee'],
  ['E-0846', 'Manoj Pillai',     'manoj.pillai@isgesolutions.com','QA Lead',            'Engineering', 'Employee'],
  ['E-0135', 'Anita Desai',      'anita.desai@isgesolutions.com','Finance Manager',     'Finance',     'Employee'],
  ['E-0762', 'Farhan Ali',       'farhan.ali@isgesolutions.com', 'Sales Engineer',      'Sales',       'Employee'],
  ['E-0489', 'Ritu Chawla',      'ritu.chawla@isgesolutions.com','Product Designer',    'Design',      'Employee'],
  ['E-0617', 'Deepak Nair',      'deepak.nair@isgesolutions.com','SRE',                 'Engineering', 'Employee'],
  ['E-0208', 'Shreya Kapoor',    'shreya.k@isgesolutions.com',   'Business Analyst',    'Product',     'Employee'],
  ['E-0953', 'Naveen Kumar',     'naveen.kumar@isgesolutions.com','Support Lead',       'Operations',  'Employee'],
  ['E-0371', 'Pooja Sinha',      'pooja.sinha@isgesolutions.com','Recruiter',           'Operations',  'Employee'],
  ['E-0824', 'Aditya Bose',      'aditya.bose@isgesolutions.com','Mobile Engineer',     'Engineering', 'Employee'],
  ['E-0146', 'Swati Menon',      'swati.menon@isgesolutions.com','Marketing Manager',   'Sales',       'Employee'],
  ['E-0695', 'Rajesh Iyer',      'rajesh.iyer@isgesolutions.com','Database Engineer',   'Engineering', 'Employee'],
  ['E-0537', 'Ananya Roy',       'ananya.roy@isgesolutions.com', 'Technical Writer',    'Product',     'Employee'],
  ['E-0280', 'Vivek Agarwal',    'vivek.agarwal@isgesolutions.com','Finance Analyst',   'Finance',     'Employee'],
];

const REASONS = [
  'Caught the regression in the payment retry logic two days before release, then wrote the test that would have caught it earlier.',
  'Took over the migration script when it was already failing and rewrote it in a day, with notes so nobody repeats the mistake.',
  'Stayed on the incident call past midnight and wrote the postmortem nobody wanted to write.',
  'Rewrote the onboarding guide that three new joiners had been quietly struggling with.',
  'Picked up the on-call rota nobody else would take, twice, without making it anyone else’s problem.',
  'Rebuilt the booking flow end to end and cut drop-off by roughly a third.',
  'Found the reporting discrepancy that two teams had failed to reproduce, and fixed the cause rather than the symptom.',
  'Ran the design review that saved us two months of rework on the wrong idea.',
];
const COMPARISONS = [
  'Others helped when asked; she saw it coming and moved first, which is a different thing entirely.',
  'It was invisible work that made everyone else faster, and he never once mentioned it in a standup.',
  'Consistent across the whole month, not only in the week the deadline was visible.',
  'She owned the outcome rather than her part of it, and that is rarer than it should be.',
  'He turned a fix into something the rest of us could learn from, which nobody else did.',
];
const SUGGESTIONS = [
  'Delegate more of the follow-up — the team wants to help and you make it hard to.',
  'Say more in reviews; your written comments are better than your spoken ones.',
  'Ask for cover sooner. You burned two weekends that you did not need to.',
  'Share the reasoning earlier — the team would learn from it.',
  'Put your hand up for the bigger projects. You are ready for them.',
];

// deterministic PRNG so the demo dataset is identical on every seed (R-6.14.6)
let seedState = 20260922;
const rnd = () => (seedState = (seedState * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function wipe() {
  const tables = [
    'work_posts', 'tutorial_progress', 'tutorials', 'showcases', 'feedback_reports',
    'vote_versions', 'votes', 'cycle_results', 'winners', 'notifications',
    'announcements', 'audit_log', 'grid_preferences', 'sessions',
    'password_reset_tokens', 'login_attempts', 'voting_cycles', 'employees',
  ];
  db.pragma('foreign_keys = OFF');
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
  db.prepare(`DELETE FROM sqlite_sequence`).run();
  db.pragma('foreign_keys = ON');
}

function insertPeople(list) {
  const stmt = db.prepare(
    `INSERT INTO employees
       (employee_code, full_name, work_email, password_hash, designation, department, location,
        date_of_joining, role, status, must_change_password)
     VALUES (?,?,?,?,?,?,?,?,?,'Active',0)`
  );
  const hash = hashPassword(DEMO_PASSWORD);
  const ids = [];
  const tx = db.transaction(() => {
    for (const [code, name, email, designation, dept, role] of list) {
      const info = stmt.run(code, name, email, hash, designation, dept, 'Mumbai', '2021-06-01', role);
      ids.push(Number(info.lastInsertRowid));
    }
  });
  tx();
  return ids;
}

function monthWindow(year, month) {
  const opens = new Date(Date.UTC(year, month - 1, 1, 3, 30));           // 09:00 IST
  const closes = new Date(Date.UTC(year, month, 0, 12, 30));             // 18:00 IST last day
  return { opens: opens.toISOString(), closes: closes.toISOString() };
}

function createCycle(awardType, periodLabel, opens, closes, status, adminId) {
  return Number(db.prepare(
    `INSERT INTO voting_cycles (award_type, period_label, opens_at, closes_at, status, created_by)
     VALUES (?,?,?,?,?,?)`
  ).run(awardType, periodLabel, opens, closes, status, adminId).lastInsertRowid);
}

function castVotes(cycleId, voterIds, weights, closesAt) {
  const insert = db.prepare(
    `INSERT INTO votes (cycle_id, voter_id, nominee_id, reason_text, comparison_text,
                        suggestion_text, rating, status, submitted_at, last_edited_at)
     VALUES (?,?,?,?,?,?,?, 'Submitted', ?, ?)`
  );
  const version = db.prepare(
    `INSERT INTO vote_versions (vote_id, version_no, nominee_id, reason_text, comparison_text,
                                suggestion_text, rating, status, changed_by, changed_at)
     VALUES (?,1,?,?,?,?,?, 'Submitted', ?, ?)`
  );
  const at = new Date(new Date(closesAt).getTime() - 3 * 864e5).toISOString();

  const tx = db.transaction(() => {
    for (const voter of voterIds) {
      const pool = weights.filter((n) => n !== voter);
      if (!pool.length) continue;
      const nominee = pool[Math.floor(rnd() * pool.length)];
      const rating = 6 + Math.floor(rnd() * 5);
      const info = insert.run(
        cycleId, voter, nominee, pick(REASONS), pick(COMPARISONS), pick(SUGGESTIONS), rating, at, at
      );
      version.run(Number(info.lastInsertRowid), nominee, pick(REASONS), pick(COMPARISONS), pick(SUGGESTIONS), rating, voter, at);
    }
  });
  tx();
}

function publishWinner(cycleId, adminId, citation) {
  const top = db.prepare(
    `SELECT * FROM cycle_results WHERE cycle_id = ? AND rank = 1 ORDER BY nominee_id`
  ).all(cycleId);
  if (!top.length) return null;
  const coWinner = top.length > 1 ? 1 : 0;
  for (const w of top) {
    db.prepare(
      `INSERT INTO winners (cycle_id, employee_id, citation, final_vote_count, final_average_rating,
                            is_co_winner, published_at, published_by, status)
       VALUES (?,?,?,?,?,?, datetime('now'), ?, 'Published')`
    ).run(cycleId, w.nominee_id, citation, w.vote_count, w.average_rating, coWinner, adminId);
  }
  db.prepare(`UPDATE voting_cycles SET status='Published' WHERE id=?`).run(cycleId);
  return top;
}

// ---------------------------------------------------------------- seed modes

function seedMinimal() {
  wipe();
  insertPeople([['E-0001', 'Portal Administrator', 'admin@isgesolutions.com', 'Administrator', 'Operations', 'Admin']]);
  db.prepare(`UPDATE employees SET must_change_password = 1 WHERE work_email = 'admin@isgesolutions.com'`).run();
  seedBaselineTutorials();
  auditSystem('seed.minimal');
  console.log(`
  Minimal seed complete.
    admin@isgesolutions.com / ${DEMO_PASSWORD}   (change on first login)

  Import your employee list from the Admin > Employee Directory screen.
`);
}

function seedDemo() {
  wipe();
  const ids = insertPeople(PEOPLE);
  const adminId = ids[0];
  const everyone = ids.slice();

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;

  const citations = [
    'Rebuilt the booking flow end to end, cut drop-off by a third, and documented every decision so the next person would not have to guess.',
    'Held the release train together through a platform migration that nobody else wanted to own.',
    'Turned a recurring support burden into a fix, then wrote the runbook that retired the ticket queue.',
    'Found and fixed the reporting discrepancy two teams had failed to reproduce.',
  ];

  // Four closed and published month cycles, running backwards from last month.
  for (let back = 4; back >= 1; back--) {
    const d = new Date(Date.UTC(y, m - 1 - back, 1));
    const yy = d.getUTCFullYear(), mm = d.getUTCMonth() + 1;
    const { opens, closes } = monthWindow(yy, mm);
    const label = `${yy}-${String(mm).padStart(2, '0')}`;
    const id = createCycle('Month', label, opens, closes, 'Open', adminId);

    // participation drifts between roughly 60% and 80%
    const turnout = Math.floor(everyone.length * (0.6 + rnd() * 0.2));
    castVotes(id, everyone.slice(0, turnout), everyone, closes);
    db.prepare(`UPDATE voting_cycles SET status='Closed', closed_at=?, closed_by=? WHERE id=?`)
      .run(closes, adminId, id);
    computeTally(id);
    publishWinner(id, adminId, citations[(4 - back) % citations.length]);
  }

  // A closed cycle that ended level on every tie-break — TieNeedsDecision.
  {
    const d = new Date(Date.UTC(y, m - 6, 1));
    const yy = d.getUTCFullYear(), mm = d.getUTCMonth() + 1;
    const { opens, closes } = monthWindow(yy, mm);
    const id = createCycle('Month', `${yy}-${String(mm).padStart(2, '0')}`, opens, closes, 'Open', adminId);
    const at = new Date(new Date(closes).getTime() - 2 * 864e5).toISOString();
    const [a, b] = [ids[2], ids[3]];
    const voters = everyone.filter((v) => v !== a && v !== b).slice(0, 8);
    const ins = db.prepare(
      `INSERT INTO votes (cycle_id, voter_id, nominee_id, reason_text, comparison_text, suggestion_text,
                          rating, status, submitted_at, last_edited_at)
       VALUES (?,?,?,?,?,?,9,'Submitted',?,?)`
    );
    voters.forEach((v, i) => ins.run(id, v, i % 2 ? a : b, pick(REASONS), pick(COMPARISONS), pick(SUGGESTIONS), at, at));
    db.prepare(`UPDATE voting_cycles SET status='Closed', closed_at=?, closed_by=? WHERE id=?`).run(closes, adminId, id);
    computeTally(id);   // leaves the cycle in TieNeedsDecision
  }

  // A month that closed with no valid votes at all — the "No award" row (R-6.9.5).
  {
    const d = new Date(Date.UTC(y, m - 7, 1));
    const yy = d.getUTCFullYear(), mm = d.getUTCMonth() + 1;
    const { opens, closes } = monthWindow(yy, mm);
    const id = createCycle('Month', `${yy}-${String(mm).padStart(2, '0')}`, opens, closes, 'Open', adminId);
    db.prepare(`UPDATE voting_cycles SET status='Closed', closed_at=?, closed_by=? WHERE id=?`).run(closes, adminId, id);
    computeTally(id);
  }

  // Last year's Employee of the Year, published.
  {
    const opens = new Date(Date.UTC(y - 1, 11, 1, 3, 30)).toISOString();
    const closes = new Date(Date.UTC(y - 1, 11, 31, 12, 30)).toISOString();
    const id = createCycle('Year', String(y - 1), opens, closes, 'Open', adminId);
    castVotes(id, everyone.slice(0, 25), everyone, closes);
    db.prepare(`UPDATE voting_cycles SET status='Closed', closed_at=?, closed_by=? WHERE id=?`).run(closes, adminId, id);
    computeTally(id);
    publishWinner(id, adminId, 'Consistent across the entire year, in the months that were being watched and the ones that were not.');
  }

  // The live month cycle — open now, with a partial turnout and no vote from
  // the admin account, so the first screen you see has something to do.
  {
    const { opens, closes } = monthWindow(y, m);
    const id = createCycle('Month', `${y}-${String(m).padStart(2, '0')}`,
      new Date(Math.min(new Date(opens).getTime(), Date.now() - 864e5)).toISOString(),
      new Date(Math.max(new Date(closes).getTime(), Date.now() + 3 * 864e5)).toISOString(),
      'Open', adminId);
    const voters = everyone.filter((v) => v !== adminId).slice(0, 19);
    castVotes(id, voters, everyone, new Date(Date.now() + 864e5).toISOString());
    db.prepare(`UPDATE votes SET submitted_at = datetime('now','-2 days'),
                   last_edited_at = datetime('now','-2 days') WHERE cycle_id = ?`).run(id);
  }

  // Next month, and this year's award, sitting as drafts for the scheduler.
  {
    const d = new Date(Date.UTC(y, m, 1));
    const { opens, closes } = monthWindow(d.getUTCFullYear(), d.getUTCMonth() + 1);
    createCycle('Month', `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, opens, closes, 'Draft', adminId);
    createCycle('Year', String(y),
      new Date(Date.UTC(y, 11, 1, 3, 30)).toISOString(),
      new Date(Date.UTC(y, 11, 31, 12, 30)).toISOString(), 'Draft', adminId);
  }

  seedBaselineTutorials();

  // One published Work Showcase, so the page has something real to show.
  {
    const latest = db.prepare(
      `SELECT w.id FROM winners w JOIN voting_cycles c ON c.id = w.cycle_id
        WHERE c.award_type='Month' AND w.status='Published' ORDER BY c.period_label DESC LIMIT 1`
    ).get();
    if (latest) {
      const blocks = [
        { type: 'text', heading: 'The problem', body: 'Customers were abandoning the booking flow at the payment step. Nobody owned the whole journey, so every team had fixed its own piece and the drop-off stayed.' },
        { type: 'metric', label: 'Drop-off at payment', value: '−34%' },
        { type: 'metric', label: 'Median time to book', value: '2m 10s' },
        { type: 'text', heading: 'What changed', body: 'The flow was rebuilt end to end, with one owner, one set of analytics events and a written decision log so the next person does not have to guess why anything is the way it is.' },
        { type: 'link', label: 'Decision log (internal wiki)', url: 'https://wiki.example.internal/booking-flow' },
      ];
      db.prepare(`INSERT INTO showcases (winner_id, status, body_json, published_at, updated_by)
                  VALUES (?, 'Published', ?, datetime('now'), ?)`).run(latest.id, JSON.stringify(blocks), adminId);
    }
  }

  // Community Showcase (6.11A) — work shared by people who did not win.
  {
    const post = db.prepare(
      `INSERT INTO work_posts (author_id, title, summary, body_json, status, published_at, updated_at)
       VALUES (?,?,?,?, 'Published', datetime('now', ?), datetime('now', ?))`
    );
    post.run(ids[13], 'A one-page runbook for the nightly deploy',
      'Every step of the nightly deploy on one page, with the three failure modes we actually hit and how to recover from each. New on-call engineers use it on their first night.',
      JSON.stringify([
        { type: 'text', heading: 'Why it exists', body: 'The deploy knowledge lived in two people\'s heads. When both were on leave in the same week, a routine failure took four hours to recover.' },
        { type: 'metric', label: 'Median recovery time', value: '4h → 25m' },
        { type: 'link', label: 'Runbook (internal wiki)', url: 'https://wiki.example.internal/runbooks/nightly-deploy' },
      ]), '-3 days', '-3 days');
    post.run(ids[12], 'Interview notes template for user research',
      'A template that keeps research notes comparable across interviewers, so findings from five people can be merged in an afternoon instead of a week.',
      JSON.stringify([
        { type: 'text', heading: 'How to use it', body: 'Copy the template before each interview. Fill the observation column during the call and the interpretation column afterwards — never both at once.' },
        { type: 'metric', label: 'Synthesis time', value: '−60%' },
        { type: 'link', label: 'Template', url: 'https://docs.example.internal/research/interview-template' },
      ]), '-8 days', '-8 days');
    post.run(ids[10], 'Month-end close checklist that finally stuck',
      'The finance close broken into 22 checks with owners and cut-off times. The close now finishes a day earlier and nothing is discovered on day five.',
      JSON.stringify([
        { type: 'metric', label: 'Close duration', value: '5 → 4 days' },
        { type: 'text', heading: 'What made it stick', body: 'Each check has one named owner and a time, not a team and a day. Late items are visible to everyone on the shared board.' },
      ]), '-15 days', '-15 days');
  }

  db.prepare(`INSERT INTO announcements (title, body, created_by) VALUES (?,?,?)`)
    .run('Award ceremony', 'Friday 12 Oct, 4:00 PM, main floor. Everyone welcome.', adminId);
  db.prepare(`INSERT INTO announcements (title, body, created_by) VALUES (?,?,?)`)
    .run('Next cycle', 'Voting for next month opens on the 1st at 9:00 AM.', adminId);

  auditSystem('seed.demo', { after: { employees: ids.length } });

  const counts = {
    employees: db.prepare('SELECT COUNT(*) n FROM employees').get().n,
    cycles: db.prepare('SELECT COUNT(*) n FROM voting_cycles').get().n,
    votes: db.prepare('SELECT COUNT(*) n FROM votes').get().n,
    winners: db.prepare("SELECT COUNT(*) n FROM winners WHERE status='Published'").get().n,
  };

  console.log(`
  Demo seed complete.
    ${counts.employees} employees · ${counts.cycles} cycles · ${counts.votes} votes · ${counts.winners} published winners

  Sign in with any of these — the password is the same for all:
    ganesh@isgesolutions.com       Admin
    priya.nair@isgesolutions.com   Auditor  (read-only, sees the pre-close tally)
    aisha.khan@isgesolutions.com   Employee
    password: ${DEMO_PASSWORD}

  The current month is open and the admin account has not voted yet.
  One past cycle is deliberately a tie awaiting a decision, and one month
  closed with no votes at all, so both edge cases are visible.
`);
}

migrate();
if (mode === 'demo') seedDemo();
else if (mode === 'minimal') seedMinimal();
else if (mode === 'reset') { wipe(); console.log('\n  Database emptied. Run npm run seed:demo or seed:minimal.\n'); }
else { console.error(`Unknown mode "${mode}". Use demo, minimal or reset.`); process.exit(1); }
