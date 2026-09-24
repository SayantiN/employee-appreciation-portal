import { forwardRef, useId } from 'react';
import './ui.scss';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Button */
export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', tone, full, as: Tag = 'button', className, children, ...rest },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={cx('btn', `btn--${variant}`, `btn--${size}`, tone && `btn--tone-${tone}`, full && 'btn--full', className)}
      {...(Tag === 'button' ? { type: rest.type || 'button' } : null)}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/* -------------------------------------------------------------------- Card */
export function Card({ accent, padded = true, className, children, ...rest }) {
  return (
    <div className={cx('card', accent && `card--${accent}`, padded && 'card--padded', className)} {...rest}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- SectionLabel */
export function SectionLabel({ tone, children }) {
  return <div className={cx('section-label', tone && `section-label--${tone}`)}>{children}</div>;
}

/* --------------------------------------------------------------- StatusPill */
/**
 * A-8 — the hue never carries the meaning alone. Every pill has a word in it,
 * so it survives colour-blindness and a greyscale printout.
 */
export function StatusPill({ tone = 'neutral', children, title }) {
  return <span className={cx('pill', `pill--${tone}`)} title={title}>{children}</span>;
}

export function statusTone(status) {
  switch (status) {
    case 'Open': case 'Submitted': case 'Active': case 'Published': return status === 'Published' ? 'plum' : 'sage';
    case 'TieNeedsDecision': case 'Stale': return 'bronze';
    case 'Withdrawn': case 'RemovedByAdmin': case 'Inactive': return 'clay';
    case 'Draft': case 'Cancelled': case 'Closed': case 'Tallied': default: return 'neutral';
  }
}

/* ------------------------------------------------------------------ Avatar */
export function Avatar({ name = '', size = 32, tone }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  // Deterministic tone per person, so the same face keeps the same colour.
  const tones = ['blue', 'plum', 'sage', 'bronze', 'teal'];
  const picked = tone || tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span
      className={cx('avatar', `avatar--${picked}`)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
      aria-hidden="true"
    >
      {initials || '·'}
    </span>
  );
}

/* ------------------------------------------------------------------- Field */
/**
 * A-3 — every input gets a real <label>, programmatically associated.
 * Help text sits above the control, never in the placeholder, because a
 * placeholder disappears exactly when the prompt is needed.
 */
export function Field({ label, help, error, counter, required, children, htmlFor }) {
  const id = useId();
  const forId = htmlFor || id;
  const describedBy = [help && `${forId}-help`, error && `${forId}-err`].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('field', error && 'field--error')}>
      <label className="field__label" htmlFor={forId}>
        {label}{required && <span className="field__req" aria-hidden="true"> *</span>}
      </label>
      {help && <p className="field__help" id={`${forId}-help`}>{help}</p>}
      {typeof children === 'function' ? children({ id: forId, describedBy, invalid: !!error }) : children}
      <div className="field__foot">
        {error
          ? <p className="field__error" id={`${forId}-err`} role="alert">{error}</p>
          : <span />}
        {counter && <span className={cx('field__counter', counter.over && 'is-bad')}>{counter.text}</span>}
      </div>
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cx('input', invalid && 'is-invalid', className)} {...rest} />;
});

export const TextArea = forwardRef(function TextArea({ className, invalid, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('textarea', invalid && 'is-invalid', className)} {...rest} />;
});

/* ------------------------------------------------------------ RatingSlider */
/**
 * A range input with explicit −/+ steppers. Sliders are unusable precisely on
 * touch; the steppers give 44px targets without losing the at-a-glance scale.
 */
export function RatingSlider({ value, onChange, id, describedBy }) {
  const v = value ?? 0;
  const set = (n) => onChange(Math.min(10, Math.max(1, n)));
  return (
    <div className="rating">
      <Button className="rating__step" aria-label="Lower rating" onClick={() => set(v - 1)}>−</Button>
      <div className="rating__track">
        <input
          id={id}
          className="rating__input"
          type="range"
          min="1" max="10" step="1"
          value={v || 1}
          aria-describedby={describedBy}
          aria-valuetext={`${v || 1} out of 10`}
          onChange={(e) => set(Number(e.target.value))}
        />
        <div className="rating__ticks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <span key={i}>{i + 1}</span>)}
        </div>
      </div>
      <Button className="rating__step" aria-label="Raise rating" onClick={() => set(v + 1)}>+</Button>
      <output className="rating__value" htmlFor={id}>{v || '–'}</output>
    </div>
  );
}

/* ----------------------------------------------------------------- Callout */
export function Callout({ tone = 'blue', title, children }) {
  return (
    <div className={cx('callout', `callout--${tone}`)}>
      {title && <span className="callout__title">{title}</span>}
      <div className="callout__body">{children}</div>
    </div>
  );
}

/**
 * Withheld-by-rule. Used wherever the product is deliberately not showing
 * something — an explained absence reads as a rule; silence reads as a bug.
 */
export function Withheld({ title, children }) {
  return (
    <div className="withheld">
      {title && <div className="withheld__title">{title}</div>}
      <div className="withheld__body">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------- feedback */
export function EmptyState({ title, body, action, variant = 'empty' }) {
  return (
    <div className={cx('empty', `empty--${variant}`)} role={variant === 'error' ? 'alert' : undefined}>
      <div className="empty__mark" aria-hidden="true" />
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

/** Skeletons, not spinners — the shape of what is coming is information. */
export function Skeleton({ h = 14, w = '100%', r = 6, style }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={44} w={`${100 - i * 6}%`} />
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = 'sage', label }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i className={`progress__fill progress__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className={cx('stat__value', tone && `stat__value--${tone}`)}>{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

export { cx };
