import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useTheme } from '../state/auth.jsx';
import { Avatar, Button, cx } from './ui.jsx';
import './AppShell.scss';

/**
 * Navigation, SPEC §5.
 *   ≥1280  expanded rail
 *   1024–1279 icon rail that expands over content
 *   768–1023 off-canvas drawer
 *   ≤767   bottom tab bar with the four most-used destinations, then More
 *
 * R-5.1 — the active item is never signalled by colour alone: colour, a left
 * bar and a heavier weight together.
 * NF-3 — Administration is hidden from anyone without the role, and the API
 * refuses those routes regardless, so hiding is convenience and not security.
 */

const NAV = [
  { label: 'Dashboard', to: '/', end: true },
  {
    group: 'Vote',
    items: [
      { label: 'Employee of the Month', to: '/vote/month' },
      { label: 'Employee of the Year', to: '/vote/year' },
    ],
  },
  {
    group: 'My Activity',
    items: [
      { label: 'My Votes', to: '/my-votes' },
      { label: 'Feedback for Me', to: '/feedback' },
    ],
  },
  {
    group: 'Results',
    items: [
      { label: 'Current Cycle Status', to: '/results', end: true },
      { label: 'Past Results', to: '/results/past' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { label: 'Winners Report', to: '/reports/winners' },
      { label: 'Award Statistics', to: '/reports/award-stats' },
    ],
  },
  {
    group: 'Winners',
    items: [
      { label: 'Hall of Fame', to: '/winners', end: true },
      { label: 'Work Showcase', to: '/winners/showcase' },
    ],
  },
  { group: 'Help & Training', items: [
    { label: 'How It Works', to: '/help' },
    { label: 'Video Tutorials', to: '/tutorials' },
  ] },
];

const ADMIN_NAV = {
  group: 'Administration',
  admin: true,
  items: [
    { label: 'Voting Cycles', to: '/admin/cycles' },
    { label: 'Publish Winners', to: '/admin/winners' },
    { label: 'Employee Directory', to: '/admin/employees' },
    { label: 'Tutorial Library', to: '/admin/tutorials' },
    { label: 'Analytics & Exports', to: '/admin/analytics' },
    { label: 'Audit Log', to: '/admin/audit' },
    { label: 'System Settings', to: '/admin/settings' },
  ],
};

const TABS = [
  { label: 'Dashboard', to: '/', end: true },
  { label: 'Vote', to: '/vote/month' },
  { label: 'Feedback', to: '/feedback' },
  { label: 'Winners', to: '/winners', end: true },
];

export function AppShell() {
  const { user, logout, isPrivileged } = useAuth();
  const [theme, setTheme] = useTheme();
  const [drawer, setDrawer] = useState(false);
  const [more, setMore] = useState(false);
  const location = useLocation();

  useEffect(() => { setDrawer(false); setMore(false); }, [location.pathname]);

  const sections = isPrivileged ? [...NAV, ADMIN_NAV] : NAV;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className={cx('shell__side', drawer && 'is-open')} aria-label="Main navigation">
        <div className="shell__brand">
          <span className="shell__logo" aria-hidden="true" />
          <span className="shell__brand-text">Appreciation</span>
        </div>
        <nav className="shell__nav">
          {sections.map((entry, i) =>
            entry.group ? (
              <div key={entry.group} className="shell__group">
                <span className={cx('shell__group-label', entry.admin && 'is-admin')}>{entry.group}</span>
                {entry.items.map((it) => <NavItem key={it.to} {...it} />)}
              </div>
            ) : (
              <NavItem key={entry.to || i} {...entry} />
            )
          )}
        </nav>
        <div className="shell__me">
          <Avatar name={user?.full_name} size={30} />
          <div className="shell__me-text">
            <span className="shell__me-name">{user?.full_name}</span>
            <span className="shell__me-role">{user?.role}</span>
          </div>
        </div>
      </aside>

      {drawer && <div className="shell__scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <div className="shell__main">
        <header className="shell__top">
          <button
            type="button"
            className="shell__burger"
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => setDrawer((v) => !v)}
          >
            <span /><span /><span />
          </button>
          <h1 className="shell__title">{titleFor(location.pathname)}</h1>
          <div className="shell__top-actions">
            <select
              className="shell__theme input"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              aria-label="Colour theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <Button size="sm" onClick={logout}>Sign out</Button>
          </div>
        </header>

        <main className="shell__content" id="main">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tabs — four by frequency, then everything else (§5). */}
      <nav className="shell__tabs" aria-label="Primary">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
                   className={({ isActive }) => cx('shell__tab', isActive && 'is-active')}>
            <span className="shell__tab-mark" aria-hidden="true" />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button type="button" className={cx('shell__tab', more && 'is-active')} onClick={() => setMore((v) => !v)}>
          <span className="shell__tab-mark" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {more && (
        <div className="shell__more" role="dialog" aria-label="More destinations">
          <div className="shell__more-panel">
            <div className="shell__grab" aria-hidden="true" />
            <h2>More</h2>
            <div className="shell__more-list">
              {sections.flatMap((s) => (s.group ? s.items : [s])).map((it) => (
                <NavItem key={it.to} {...it} />
              ))}
              <button type="button" className="shell__link" onClick={logout}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ label, to, end, soon }) {
  if (soon) {
    // Honest about scope: the route exists in the spec but not yet in the build.
    return <span className="shell__link is-soon" title="Planned — not built yet">{label}<em>soon</em></span>;
  }
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('shell__link', isActive && 'is-active')}>
      {label}
    </NavLink>
  );
}

function titleFor(path) {
  if (path === '/') return 'Dashboard';
  if (path.startsWith('/vote/month')) return 'Vote — Employee of the Month';
  if (path.startsWith('/vote/year')) return 'Vote — Employee of the Year';
  if (path.startsWith('/my-votes')) return 'My Votes';
  if (path.startsWith('/feedback')) return 'Feedback for Me';
  if (path.startsWith('/results/past')) return 'Past Results & Leaderboard';
  if (path.startsWith('/results')) return 'Current Cycle Status';
  if (path.startsWith('/reports/winners')) return 'Winners Report';
  if (path.startsWith('/reports/award-stats')) return 'Award Statistics';
  if (path.startsWith('/winners/showcase')) return 'Work Showcase';
  if (path.startsWith('/winners')) return 'Hall of Fame';
  if (path.startsWith('/help')) return 'How It Works';
  if (path.startsWith('/tutorials')) return 'Video Tutorials';
  if (path.startsWith('/admin/cycles')) return 'Voting Cycles';
  if (path.startsWith('/admin/winners')) return 'Publish Winners';
  if (path.startsWith('/admin/employees')) return 'Employee Directory';
  if (path.startsWith('/admin/tutorials')) return 'Tutorial Library';
  if (path.startsWith('/admin/analytics')) return 'Analytics & Exports';
  if (path.startsWith('/admin/audit')) return 'Audit Log';
  if (path.startsWith('/admin/settings')) return 'System Settings';
  return 'Employee Appreciation Portal';
}
