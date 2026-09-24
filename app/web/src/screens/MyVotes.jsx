import { useCallback } from 'react';
import { api } from '../api/client.js';
import { DataGrid } from '../components/DataGrid.jsx';
import { Avatar, Callout, StatusPill, statusTone } from '../components/ui.jsx';
import './screens.scss';

/**
 * SPEC 6.6 — your own votes, and never anyone else's. The server pins the
 * voter before the grid layer runs, so no sort or filter parameter can widen
 * the result set (R-6.6.1).
 */
export function MyVotes() {
  const fetcher = useCallback((state) => api.myVotes(state), []);

  const columns = [
    {
      key: 'period_label', label: 'Cycle', width: 110, filter: 'text',
      render: (r) => <strong>{r.period_label}</strong>,
    },
    {
      key: 'award_type', label: 'Award', width: 90, filter: 'enum',
      options: [{ value: 'Month', label: 'Month' }, { value: 'Year', label: 'Year' }],
    },
    {
      key: 'nominee_name', label: 'Nominee', filter: 'text',
      render: (r) => (
        <span className="row" style={{ gap: 8 }}>
          <Avatar name={r.nominee_name} size={22} />
          {r.nominee_name}
        </span>
      ),
    },
    { key: 'nominee_department', label: 'Department', width: 140, filter: 'enum', hideOnCard: true,
      options: uniqueDepartments() },
    { key: 'rating', label: 'Rating', width: 90, numeric: true, filter: 'number',
      render: (r) => (r.rating == null ? '—' : r.rating) },
    {
      key: 'status', label: 'Status', width: 130, filter: 'enum',
      options: ['Submitted', 'Draft', 'Withdrawn', 'Locked'].map((v) => ({ value: v, label: v })),
      // Status is the column that does the work here, so it carries the colour.
      render: (r) => {
        const label = r.editable ? r.status : r.status === 'Submitted' ? 'Locked' : r.status;
        return <StatusPill tone={statusTone(r.editable ? r.status : label)}>{label}</StatusPill>;
      },
    },
    {
      key: 'submitted_at', label: 'Submitted', width: 140, filter: 'date',
      render: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'),
    },
    {
      key: 'actions', label: '', width: 80, sortable: false,
      render: (r) => (
        r.editable
          ? <a href={r.award_type === 'Year' ? '/vote/year' : '/vote/month'} className="page__editlink">Edit</a>
          // R-6.6.2 — disabled with the reason visible, not silently missing.
          : <span title={r.locked_reason} style={{ color: 'var(--c-faint)' }}>View</span>
      ),
    },
  ];

  return (
    <div className="page fade-in">
      <div className="page__head">
        <p className="page__lede">
          Everything you have submitted. Nobody else can see this page, and it has no view,
          filter or export that could show another person&rsquo;s vote.
        </p>
      </div>

      <DataGrid
        gridKey="my_votes"
        columns={columns}
        fetcher={fetcher}
        defaultSort={{ column: 'submitted_at', dir: 'desc' }}
        emptyTitle="You have not voted yet"
        emptyBody="Your votes appear here once you submit one. You can edit or withdraw any vote until its window closes."
        renderCard={(r) => (
          <>
            <div className="grid__card-head row" style={{ gap: 8 }}>
              <Avatar name={r.nominee_name} size={30} />
              <span style={{ flex: 1 }}>{r.nominee_name}</span>
              <strong>{r.rating ?? '—'}</strong>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <StatusPill tone="neutral">{r.period_label}</StatusPill>
              <StatusPill tone={statusTone(r.editable ? r.status : 'Closed')}>
                {r.editable ? r.status : r.status === 'Submitted' ? 'Locked' : r.status}
              </StatusPill>
            </div>
            {!r.editable && r.locked_reason && (
              <div className="page__lede" style={{ fontSize: 11 }}>{r.locked_reason}</div>
            )}
          </>
        )}
      />

      <Callout tone="blue" title="Why some rows cannot be edited">
        A vote stays editable until its window closes — every change is versioned, and the nominee
        only ever sees the latest version. Once the cycle closes the row is locked, and the button
        is disabled with the reason attached rather than quietly removed.
      </Callout>
    </div>
  );
}

// The department list is small and static enough to hard-wire for the filter
// popover; when the directory screen lands it will come from its facets.
function uniqueDepartments() {
  return ['Engineering', 'Design', 'Operations', 'Product', 'Finance', 'Sales']
    .map((d) => ({ value: d, label: d }));
}
