import { useCallback, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../state/auth.jsx';
import { DataGrid } from '../components/DataGrid.jsx';
import {
  Button, Callout, Card, Field, SectionLabel, StatusPill, TextInput, statusTone,
} from '../components/ui.jsx';
import './screens.scss';

/** SPEC 6.16 — cycles admin. Auditors may read this screen; only Admins act. */
export function AdminCycles() {
  const { isAdmin } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(null);
  const [banner, setBanner] = useState(null);
  const [creating, setCreating] = useState(false);

  const fetcher = useCallback((state) => api.cycles(state), [nonce]);

  async function act(id, fn, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(id); setBanner(null);
    try {
      await fn();
      setNonce((n) => n + 1);
    } catch (e) {
      setBanner({ tone: 'clay', text: e instanceof ApiError ? e.message : 'That did not work.' });
    } finally {
      setBusy(null);
    }
  }

  async function reopen(id) {
    // R-6.16.4 — a typed reason, recorded in the audit log, notified to all.
    const reason = window.prompt(
      'Reopening invalidates the frozen tally and notifies every employee.\n\nWhy are you reopening this cycle? (at least 15 characters)'
    );
    if (!reason) return;
    await act(id, () => api.reopenCycle(id, reason));
  }

  const columns = [
    { key: 'award_type', label: 'Type', width: 80, filter: 'enum',
      options: [{ value: 'Month', label: 'Month' }, { value: 'Year', label: 'Year' }] },
    { key: 'period_label', label: 'Period', width: 110, filter: 'text',
      render: (r) => <strong>{r.pretty_period}</strong> },
    { key: 'opens_at', label: 'Opens', width: 150, filter: 'date',
      render: (r) => new Date(r.opens_at).toLocaleString() },
    { key: 'closes_at', label: 'Closes', width: 150, filter: 'date',
      render: (r) => new Date(r.closes_at).toLocaleString() },
    {
      key: 'status', label: 'Status', width: 150, filter: 'enum',
      options: ['Draft', 'Open', 'Closed', 'Tallied', 'TieNeedsDecision', 'Published', 'Cancelled']
        .map((v) => ({ value: v, label: v === 'TieNeedsDecision' ? 'Tie — decide' : v })),
      render: (r) => (
        <StatusPill tone={statusTone(r.status)}>
          {r.status === 'TieNeedsDecision' ? 'Tie — decide' : r.status}
        </StatusPill>
      ),
    },
    { key: 'votes_cast', label: 'Votes', width: 80, numeric: true, filter: 'number' },
    { key: 'participation', label: 'Part.', width: 80, numeric: true, sortable: false,
      render: (r) => `${r.participation}%` },
    { key: 'winner_name', label: 'Winner', filter: 'text',
      render: (r) => r.winner_name
        || (r.status === 'TieNeedsDecision'
          ? <span style={{ color: 'var(--c-bronze-deep)', fontWeight: 700 }}>Needs a decision</span>
          : <span style={{ color: 'var(--c-faint)' }}>—</span>) },
    {
      key: 'actions', label: '', sortable: false, width: 230,
      render: (r) => !isAdmin ? null : (
        <span className="row" style={{ gap: 4 }}>
          {r.status === 'Draft' && (
            <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, () => api.openCycle(r.id))}>Open</Button>
          )}
          {r.status === 'Open' && (
            <Button size="sm" disabled={busy === r.id}
                    onClick={() => act(r.id, () => api.closeCycle(r.id),
                      'Close this cycle now? The tally is frozen at close and voting stops immediately.')}>
              Close
            </Button>
          )}
          {['Closed', 'Tallied', 'TieNeedsDecision'].includes(r.status) && (
            <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, () => api.recomputeCycle(r.id))}>
              Recompute
            </Button>
          )}
          {['Closed', 'Tallied', 'TieNeedsDecision', 'Published'].includes(r.status) && (
            <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => reopen(r.id)}>Reopen</Button>
          )}
          {['Draft', 'Open'].includes(r.status) && (
            <Button size="sm" variant="ghost" disabled={busy === r.id}
                    onClick={() => act(r.id, () => api.cancelCycle(r.id), 'Cancel this cycle?')}>
              Cancel
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="page fade-in">
      <div className="page__head">
        <p className="page__lede">
          Cycles open and close on their own schedule; the buttons here are overrides, and every one
          of them is written to the audit log.
        </p>
        <span className="spacer" />
        {isAdmin && <Button variant="primary" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : 'Create cycle'}
        </Button>}
      </div>

      {banner && <Callout tone={banner.tone}>{banner.text}</Callout>}

      {creating && <CreateCycle onDone={() => { setCreating(false); setNonce((n) => n + 1); }} />}

      <DataGrid
        gridKey="cycles"
        columns={columns}
        fetcher={fetcher}
        defaultSort={{ column: 'opens_at', dir: 'desc' }}
        emptyTitle="No cycles yet"
        emptyBody="Create the first one, and the scheduler will open and close it on time."
      />

      <Card>
        <SectionLabel>Lifecycle</SectionLabel>
        <div className="row" style={{ gap: 6 }}>
          <StatusPill tone="neutral">Draft</StatusPill><span>→</span>
          <StatusPill tone="sage">Open</StatusPill><span>→</span>
          <StatusPill tone="neutral">Closed</StatusPill><span>→</span>
          <StatusPill tone="neutral">Tallied</StatusPill><span>→</span>
          <StatusPill tone="plum">Published</StatusPill>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <span className="page__lede" style={{ margin: 0 }}>branches —</span>
          <StatusPill tone="bronze">Tie, needs decision</StatusPill>
          <StatusPill tone="neutral">Cancelled</StatusPill>
          <StatusPill tone="clay">Reopened</StatusPill>
        </div>
        <p className="page__lede" style={{ marginTop: 12 }}>
          A cycle cannot open with fewer than three active employees — anonymity would be
          arithmetically impossible. Reopening a closed cycle demands a typed reason and discards
          the frozen tally.
        </p>
      </Card>
    </div>
  );
}

function CreateCycle({ onDone }) {
  const now = new Date();
  const [awardType, setAwardType] = useState('Month');
  const [periodLabel, setPeriodLabel] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`
  );
  const [opensAt, setOpensAt] = useState(localInput(startOfNextMonth(9)));
  const [closesAt, setClosesAt] = useState(localInput(endOfNextMonth(18)));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.createCycle({
        awardType, periodLabel,
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that cycle.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="stack">
        <SectionLabel>New cycle</SectionLabel>
        {error && <Callout tone="clay">{error}</Callout>}
        <div className="cols cols--2">
          <Field label="Award type">
            <select className="input" value={awardType}
                    onChange={(e) => { setAwardType(e.target.value); setPeriodLabel(e.target.value === 'Year' ? String(now.getFullYear()) : periodLabel); }}>
              <option value="Month">Employee of the Month</option>
              <option value="Year">Employee of the Year</option>
            </select>
          </Field>
          <Field label="Period" help={awardType === 'Year' ? 'e.g. 2026' : 'e.g. 2026-10'}>
            <TextInput value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} required />
          </Field>
          <Field label="Opens at" help="Stored in UTC, shown in your local time.">
            <TextInput type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
          </Field>
          <Field label="Closes at">
            <TextInput type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
          </Field>
        </div>
        <div className="row">
          <Button type="submit" variant="primary" disabled={busy}>Create as draft</Button>
          <span className="page__lede" style={{ margin: 0 }}>
            The scheduler opens it at the time above. One cycle per type and period.
          </span>
        </div>
      </form>
    </Card>
  );
}

/* --------------------------------------------------------------- helpers */
function startOfNextMonth(hour) {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 1); d.setHours(hour, 0, 0, 0); return d;
}
function endOfNextMonth(hour) {
  const d = new Date(); d.setMonth(d.getMonth() + 2, 0); d.setHours(hour, 0, 0, 0); return d;
}
function localInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
