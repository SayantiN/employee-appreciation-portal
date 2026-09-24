import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import {
  Avatar, Button, Callout, Card, EmptyState, Field, RatingSlider,
  SectionLabel, Skeleton, StatusPill, TextArea, TextInput, Withheld, cx,
} from '../components/ui.jsx';
import './screens.scss';

/**
 * SPEC 6.4 (Month) and 6.5 (Year) — one component, because the two ballots
 * differ only in the comparison field's minimum, one optional field, and the
 * candidate pool. Building them twice would guarantee they drift apart.
 *
 * The form is the least colourful screen in the product on purpose: a person
 * writing an honest appraisal of a colleague should not be visually hurried.
 */
export function VoteForm({ awardType }) {
  const isYear = awardType === 'Year';
  const compMin = isYear ? 50 : 30;

  const [state, setState] = useState(null);       // { cycle, vote, nominees, votable }
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const out = await api.currentBallot(awardType);
    setState(out);
    if (out.vote) {
      setForm({
        nomineeId: out.vote.nominee_id,
        reason: out.vote.reason || '',
        comparison: out.vote.comparison || '',
        suggestion: out.vote.suggestion || '',
        rating: out.vote.rating || null,
        confirm: out.vote.status === 'Submitted',
      });
    } else {
      setForm(blank());
    }
  }, [awardType]);

  useEffect(() => { setState(null); load(); }, [load]);

  // R-6.4.6 — drafts autosave every 20 seconds, and are never counted.
  useEffect(() => {
    if (!state?.votable) return;
    const t = setInterval(() => { if (dirty.current) save('draft', true); }, 20000);
    return () => clearInterval(t);
  }, [state?.votable, form]);

  const nominee = useMemo(
    () => state?.nominees.find((n) => n.id === form.nomineeId) || null,
    [state, form.nomineeId]
  );

  function set(key, value) {
    dirty.current = true;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function save(action, silent = false) {
    if (!state?.cycle) return;
    if (!silent) { setBusy(true); setBanner(null); }
    try {
      const out = await api.saveVote({
        cycleId: state.cycle.id,
        nomineeId: form.nomineeId,
        reason: form.reason,
        comparison: form.comparison,
        suggestion: form.suggestion,
        rating: form.rating,
        confirm: form.confirm,
        action,
      });
      dirty.current = false;
      setSavedAt(new Date());
      setErrors({});
      setState((s) => ({ ...s, vote: out.vote }));
      if (!silent) {
        setBanner(action === 'submit'
          ? { tone: 'sage', text: 'Your vote is in. You can change or withdraw it until the window closes.' }
          : { tone: 'blue', text: 'Draft saved. It is private and does not count until you submit.' });
      }
    } catch (e) {
      if (e instanceof ApiError && e.errors) {
        setErrors(e.errors);
        // R-9.1 — move focus to the first problem rather than leaving the
        // user to hunt for it.
        const first = Object.keys(e.errors)[0];
        document.getElementById(`vote-${first}`)?.focus();
      } else if (e instanceof ApiError && e.code === 'window_closed') {
        setBanner({ tone: 'clay', text: e.message });
        load();
      } else if (!silent) {
        setBanner({ tone: 'clay', text: 'We could not save that. Your text is still here — try again.' });
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function withdraw() {
    if (!state?.vote) return;
    setBusy(true);
    try {
      await api.withdrawVote(state.vote.id);
      setBanner({ tone: 'blue', text: 'Your vote has been withdrawn. It no longer counts and the nominee will not see it.' });
      await load();
      setForm(blank());
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <div className="page"><Skeleton h={64} r={10} /><Skeleton h={420} r={10} /></div>;

  if (!state.cycle) {
    return (
      <EmptyState
        title={`No ${isYear ? 'yearly' : 'monthly'} cycle is open right now`}
        body="We will let you know when the next one opens."
      />
    );
  }

  const submitted = state.vote?.status === 'Submitted';
  const closed = !state.votable;

  return (
    <div className="page fade-in">
      <div className="vote__head">
        <div>
          <div className="vote__period">{state.cycle.pretty_period}</div>
          <div className="vote__closes">
            Closes {new Date(state.cycle.closes_at).toLocaleString()} ({tz()})
          </div>
        </div>
        <span className="spacer" />
        {isYear && <StatusPill tone="plum">Year award</StatusPill>}
        {state.votable
          ? <><StatusPill tone="sage">Open</StatusPill><StatusPill tone="bronze">{closesIn(state.cycle.closes_at)}</StatusPill></>
          : <StatusPill tone="neutral">Closed</StatusPill>}
      </div>

      {banner && <Callout tone={banner.tone}>{banner.text}</Callout>}

      {closed && (
        <Callout tone="clay" title="This window has closed">
          {submitted
            ? 'Your vote is locked and can no longer be edited.'
            : 'You did not submit a vote for this cycle.'}
        </Callout>
      )}

      <div className="cols cols--form">
        <form className="vote__form" onSubmit={(e) => { e.preventDefault(); save('submit'); }} noValidate>

          <Field label="1 · Who are you voting for?" error={errors.nominee} required>
            <button type="button" id="vote-nominee"
                    className={cx('vote__nominee', !nominee && 'is-empty')}
                    disabled={closed}
                    onClick={() => setPicker(true)}>
              <Avatar name={nominee?.full_name || '?'} size={36} />
              <span>
                <span className="vote__nominee-name">{nominee ? nominee.full_name : 'Choose a colleague'}</span>
                <span className="vote__nominee-role">
                  {nominee ? `${nominee.designation} · ${nominee.department}` : 'Search the directory'}
                </span>
              </span>
              <span className="vote__nominee-change">{nominee ? 'Change' : 'Select'}</span>
            </button>
          </Field>

          {/* BR-2 — shown, not silent. Someone who cannot find their own name
              will otherwise assume the list is broken. */}
          <Withheld>Your own name is not in this list. You cannot vote for yourself.</Withheld>

          <Field
            label="2 · Reason for voting"
            help="What did they actually do this month? Be specific — name the project, the save, the help."
            error={errors.reason}
            counter={counter(form.reason, 30, 1000)}
            required
          >
            {({ id, describedBy, invalid }) => (
              <TextArea id="vote-reason" aria-describedby={describedBy} invalid={invalid}
                        disabled={closed} value={form.reason}
                        onChange={(e) => set('reason', e.target.value)} />
            )}
          </Field>

          <div className={cx(isYear && 'vote__emphasis')}>
            <Field
              label={isYear ? '3 · Why they are the best of the entire year' : '3 · Why better than others this month'}
              help={isYear
                ? 'Evidence across the whole year, not one good month.'
                : 'What set them apart from everyone else?'}
              error={errors.comparison}
              counter={counter(form.comparison, compMin, 1000)}
              required
            >
              {({ describedBy, invalid }) => (
                <TextArea id="vote-comparison" aria-describedby={describedBy} invalid={invalid}
                          rows={isYear ? 4 : 3} disabled={closed} value={form.comparison}
                          onChange={(e) => set('comparison', e.target.value)} />
              )}
            </Field>
          </div>

          <Field
            label="4 · One suggestion for them"
            help="One thing that would make them even stronger. Keep it kind and actionable."
            error={errors.suggestion}
            counter={counter(form.suggestion, 20, 500)}
            required
          >
            {({ describedBy, invalid }) => (
              <TextArea id="vote-suggestion" rows={2} aria-describedby={describedBy} invalid={invalid}
                        disabled={closed} value={form.suggestion}
                        onChange={(e) => set('suggestion', e.target.value)} />
            )}
          </Field>

          <Field label="5 · Rating out of 10" error={errors.rating} required>
            {({ id, describedBy }) => (
              <RatingSlider id="vote-rating" describedBy={describedBy}
                            value={form.rating} onChange={(v) => set('rating', v)} />
            )}
          </Field>

          {isYear && (
            <div className="vote__optional">
              <Field
                label="6 · Standout contribution of the year"
                help="Optional. Feeds the citation on their Hall of Fame card if they win."
              >
                <TextArea rows={2} disabled={closed} />
              </Field>
            </div>
          )}

          <label className="vote__confirm">
            <input id="vote-confirm" type="checkbox" checked={form.confirm} disabled={closed}
                   onChange={(e) => set('confirm', e.target.checked)} />
            <span>{isYear ? '7' : '6'} · I confirm this is my honest assessment.</span>
          </label>
          {errors.confirm && <p className="field__error" role="alert">{errors.confirm}</p>}

          {!closed && (
            <div className="vote__actions">
              <Button type="submit" variant="primary" size="lg" disabled={busy}>
                {submitted ? 'Save changes' : 'Submit Vote'}
              </Button>
              <Button size="lg" disabled={busy} onClick={() => save('draft')}>Save Draft</Button>
              {submitted && <Button size="lg" variant="ghost" disabled={busy} onClick={withdraw}>Withdraw</Button>}
              {savedAt && <span className="vote__saved">Saved {savedAt.toLocaleTimeString()}</span>}
            </div>
          )}
        </form>

        {/* The rail carries no colour. It names what is missing and why. */}
        <aside className="vote__rail">
          <Card>
            <SectionLabel>Your vote so far</SectionLabel>
            <dl className="vote__summary">
              <Summary label="Nominee"    ok={!!nominee}                       done="Chosen" todo="Not chosen" />
              <Summary label="Reason"     ok={form.reason.trim().length >= 30}  done="Done" todo={form.reason ? 'Too short' : 'Empty'} />
              <Summary label="Comparison" ok={form.comparison.trim().length >= compMin} done="Done" todo={form.comparison ? 'Too short' : 'Empty'} />
              <Summary label="Suggestion" ok={form.suggestion.trim().length >= 20} done="Done" todo={form.suggestion ? 'Too short' : 'Empty'} />
              <Summary label="Rating"     ok={!!form.rating}                   done={`${form.rating} / 10`} todo="Not set" />
            </dl>
          </Card>

          <Card>
            <SectionLabel>Before you submit</SectionLabel>
            <div className="stack">
              <p className="page__lede">Your name is <strong>never</strong> shown to the person you vote for.</p>
              {/* R-4.1 — the caveat is stated at the moment of decision. */}
              <p className="page__lede">Administrators <strong>can</strong> see who voted, for audit only.</p>
              <p className="page__lede">You can change or withdraw this vote until the window closes.</p>
              <p className="page__lede">Results stay hidden until then.</p>
            </div>
          </Card>
        </aside>
      </div>

      {picker && (
        <NomineePicker
          nominees={state.nominees}
          selectedId={form.nomineeId}
          onPick={(id) => { set('nomineeId', id); setPicker(false); }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- parts */

function Summary({ label, ok, done, todo }) {
  return (
    <div className={cx('vote__summary-row', ok ? 'is-ok' : 'is-todo')}>
      <dt>{label}</dt>
      <dd>{ok ? done : todo}</dd>
    </div>
  );
}

/** Full-screen search sheet on mobile — never a cramped native dropdown. */
function NomineePicker({ nominees, selectedId, onPick, onClose }) {
  const [q, setQ] = useState('');
  const list = nominees.filter((n) =>
    `${n.full_name} ${n.designation} ${n.department}`.toLowerCase().includes(q.toLowerCase())
  );

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose a colleague"
           onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" aria-hidden="true" />
        <div className="sheet__head">
          <h3>Choose a colleague</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">×</Button>
        </div>
        <div className="sheet__scroll">
          <div className="picker__search">
            <TextInput autoFocus placeholder="Search by name…" aria-label="Search colleagues"
                       value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="picker__list">
            {list.length === 0 && <EmptyState title="Nobody matches that" body="Try part of a name or a department." />}
            {list.map((n) => (
              <button key={n.id} type="button"
                      className={cx('picker__item', n.id === selectedId && 'is-selected')}
                      onClick={() => onPick(n.id)}>
                <Avatar name={n.full_name} size={34} />
                <span>
                  <span className="picker__item-name">{n.full_name}</span>
                  <span className="picker__item-role">{n.designation} · {n.department}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- helpers */

const blank = () => ({ nomineeId: null, reason: '', comparison: '', suggestion: '', rating: null, confirm: false });

function counter(value, min, max) {
  const n = String(value || '').trim().length;
  return { text: `${n} / ${max} · minimum ${min}`, over: n > max };
}

function closesIn(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'closing now';
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function tz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'local time'; }
}
