import { useState } from 'react';
import { api } from '../api/client.js';
import { resetDemo } from '../demo-server/app.js';
import './demo.scss';

// The demo accounts from the seed. Every one uses the same sample password.
const ACCOUNTS = [
  { email: 'ganesh@isgesolutions.com', role: 'Admin', note: 'Everything, including publishing and settings' },
  { email: 'priya.nair@isgesolutions.com', role: 'Auditor', note: 'Sees all, changes nothing' },
  { email: 'aisha.khan@isgesolutions.com', role: 'Employee', note: 'The everyday experience' },
];
const DEMO_PASSWORD = 'Portal#2026';

/**
 * Floating panel, only in the design demo: say plainly that this is sample
 * data, switch role in one click, and reset everything back to the start.
 */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signInAs(email) {
    setBusy(true);
    try { await api.logout(); } catch { /* not signed in */ }
    await api.login(email, DEMO_PASSWORD, true);
    window.location.hash = '#/';
    window.location.reload();
  }

  async function reset() {
    if (!window.confirm('Reset the demo? Every vote, winner and change made in this browser is discarded.')) return;
    setBusy(true);
    await resetDemo();
    window.location.hash = '#/';
    window.location.reload();
  }

  return (
    <div className={`demo-panel${open ? ' is-open' : ''}`}>
      {open && (
        <div className="demo-panel__card" role="dialog" aria-label="Design demo">
          <div className="demo-panel__title">Design demo</div>
          <p className="demo-panel__text">
            Sample data only. Everything works, but it runs in your browser and nothing is sent anywhere.
          </p>
          <div className="demo-panel__label">View as</div>
          {ACCOUNTS.map((a) => (
            <button key={a.email} type="button" className="demo-panel__acct" disabled={busy} onClick={() => signInAs(a.email)}>
              <strong>{a.role}</strong><span>{a.note}</span>
            </button>
          ))}
          <p className="demo-panel__text">Or sign in with any of those emails and <code>{DEMO_PASSWORD}</code>.</p>
          <button type="button" className="demo-panel__reset" disabled={busy} onClick={reset}>Reset demo data</button>
        </div>
      )}
      <button type="button" className="demo-panel__pill" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Close' : 'Design demo'}
      </button>
    </div>
  );
}
