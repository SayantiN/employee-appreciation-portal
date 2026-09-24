import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, SkeletonRows, cx } from './ui.jsx';
import './DataGrid.scss';

/**
 * The Data Grid Standard, SPEC §11 — built once, used by every grid.
 *
 * DG-1  tri-state sort on every column, with aria-sort
 * DG-2  filter control matched to the column's data type
 * DG-3  AND across columns, OR within one — stated in the UI
 * DG-4  shift-click adds a numbered secondary sort
 * DG-5  global search across the declared text columns
 * DG-6  every active filter is a removable chip
 * DG-7  state lives in the URL, carrying ids — never names or emails (NF-12)
 * DG-9  the server filters, sorts and paginates
 * DG-12 loading overlays the existing rows rather than blanking them
 * DG-13 "no rows match your filters" is a different screen from "no data yet"
 * DG-14 real table semantics, header buttons, announced result counts
 * DG-15 below 768px this becomes cards — with nothing taken away
 * DG-16 every grid declares its default sort
 */
export function DataGrid({
  gridKey,
  columns,
  fetcher,
  defaultSort,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  renderCard,
  rowKey = (r) => r.id,
  onRowClick,
  toolbarExtra,
}) {
  const [params, setParams] = useSearchParams();
  const ns = (k) => `${gridKey}.${k}`;

  const state = useMemo(() => readState(params, ns, defaultSort), [params, gridKey, defaultSort]);

  const [data, setData] = useState({ rows: [], total: 0, page: 1, totalPages: 1, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null);      // 'sort' | 'filter' | null
  const [searchDraft, setSearchDraft] = useState(state.q);
  const liveRef = useRef(null);

  // DG-12 — 300ms debounce, and the old rows stay visible underneath.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== state.q) patch({ q: searchDraft || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await fetcher(state);
      setData(out);
      if (liveRef.current) liveRef.current.textContent = `${out.total} rows`;   // DG-14
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [fetcher, JSON.stringify(state)]);

  useEffect(() => { load(); }, [load]);

  function patch(next) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      const key = ns(k);
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) p.delete(key);
      else p.set(key, Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    setParams(p, { replace: true });
  }

  function writeFilters(filters) {
    const p = new URLSearchParams(params);
    for (const c of columns) p.delete(ns(`f_${c.key}`));
    for (const [k, v] of Object.entries(filters)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      p.set(ns(`f_${k}`), Array.isArray(v) ? v.join('|') : typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    p.set(ns('page'), '1');
    setParams(p, { replace: true });
  }

  /** DG-1 / DG-4 — ascending → descending → off; shift adds a secondary sort. */
  function toggleSort(col, additive) {
    const current = state.sort.find((s) => s.column === col);
    let next;
    if (!current) next = [...(additive ? state.sort : []), { column: col, dir: 'asc' }];
    else if (current.dir === 'asc') next = state.sort.map((s) => (s.column === col ? { ...s, dir: 'desc' } : s));
    else next = state.sort.filter((s) => s.column !== col);
    patch({ sort: next.map((s) => `${s.column}:${s.dir}`), page: 1 });
  }

  const activeChips = buildChips(columns, state.filters);
  const hasFilters = activeChips.length > 0 || !!state.q;

  return (
    <div className={cx('grid', loading && 'grid--loading')} data-grid={gridKey}>
      {/* ---------------------------------------------------------- toolbar */}
      <div className="grid__toolbar">
        <div className="grid__search">
          <input
            type="search"
            className="input"
            placeholder="Search this grid…"
            aria-label="Search this grid"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        {toolbarExtra}
        <div className="grid__toolbar-mobile">
          <Button size="sm" onClick={() => setSheet('sort')}>Sort</Button>
          <Button size="sm" onClick={() => setSheet('filter')}>
            Filter{activeChips.length > 0 && <span className="grid__badge">{activeChips.length}</span>}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- DG-6 filter chips */}
      {hasFilters && (
        <div className="grid__chips">
          <span className="grid__chips-label">Filters</span>
          {state.q && (
            <Chip label={`Search: ${state.q}`} onClear={() => { setSearchDraft(''); patch({ q: undefined, page: 1 }); }} />
          )}
          {activeChips.map((c) => (
            <Chip
              key={c.key}
              label={`${c.label}: ${c.display}`}
              onClear={() => writeFilters({ ...state.filters, [c.key]: undefined })}
            />
          ))}
          <Button size="sm" variant="ghost" onClick={() => { setSearchDraft(''); writeFilters({}); }}>
            Clear all
          </Button>
          <span className="grid__chips-note">Filters on different columns combine with AND.</span>
        </div>
      )}

      {/* ------------------------------------------------------------ table */}
      <div className="grid__scroller">
        <table className="grid__table">
          <thead>
            <tr>
              {columns.map((c) => {
                const s = state.sort.find((x) => x.column === c.key);
                const order = state.sort.findIndex((x) => x.column === c.key);
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    aria-sort={s ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cx(c.numeric && 'is-numeric', c.restricted && 'is-restricted')}
                  >
                    {c.sortable === false ? (
                      <span className="grid__th-label">{c.label}</span>
                    ) : (
                      <button
                        type="button"
                        className="grid__sort"
                        onClick={(e) => toggleSort(c.key, e.shiftKey)}
                        title="Click to sort. Shift-click to add a second sort."
                      >
                        {c.label}
                        <span className={cx('grid__caret', s && 'is-active')} aria-hidden="true">
                          {s ? (s.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                        {state.sort.length > 1 && order > -1 && (
                          <sup className="grid__sort-order">{order + 1}</sup>
                        )}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(onRowClick && 'is-clickable')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx(c.numeric && 'is-numeric', c.restricted && 'is-restricted')}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------- DG-15 mobile cards */}
      <div className="grid__cards">
        {data.rows.map((row) => (
          <div key={rowKey(row)} className="grid__card" onClick={onRowClick ? () => onRowClick(row) : undefined}>
            {renderCard ? renderCard(row) : <DefaultCard row={row} columns={columns} />}
          </div>
        ))}
      </div>

      {/* --------------------------------------------------------- states */}
      {loading && data.rows.length === 0 && <div className="grid__pad"><SkeletonRows rows={5} /></div>}

      {error && !loading && (
        <EmptyState
          variant="error"
          title="We could not load this list"
          body="The server did not respond. Your data is safe."
          action={<Button variant="primary" onClick={load}>Try again</Button>}
        />
      )}

      {!loading && !error && data.rows.length === 0 && (
        hasFilters ? (
          // DG-13 — a dead end the user can escape from…
          <EmptyState
            title="No rows match your filters"
            body={`${activeChips.length + (state.q ? 1 : 0)} filter${activeChips.length === 1 ? '' : 's'} active. Clearing them brings the full list back.`}
            action={<Button variant="primary" onClick={() => { setSearchDraft(''); writeFilters({}); }}>Clear filters</Button>}
          />
        ) : (
          // …and one they cannot. These must not be the same screen.
          <EmptyState title={emptyTitle} body={emptyBody} />
        )
      )}

      {/* ----------------------------------------------------- pagination */}
      {data.total > 0 && (
        <div className="grid__foot">
          <span className="grid__count">
            Showing {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </span>
          <span ref={liveRef} className="sr-only" aria-live="polite" />
          <div className="grid__pager">
            <label className="grid__pagesize">
              <span className="sr-only">Rows per page</span>
              <select
                className="input"
                value={state.pageSize}
                onChange={(e) => patch({ pageSize: e.target.value, page: 1 })}
              >
                {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <Button size="sm" disabled={data.page <= 1} onClick={() => patch({ page: data.page - 1 })}>Prev</Button>
            <Button size="sm" disabled={data.page >= data.totalPages} onClick={() => patch({ page: data.page + 1 })}>Next</Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ DG-15 mobile sheets */}
      {sheet === 'sort' && (
        <Sheet title="Sort by" onClose={() => setSheet(null)}>
          <div className="sheet__options">
            {columns.filter((c) => c.sortable !== false).map((c) => {
              const s = state.sort.find((x) => x.column === c.key);
              return (
                <label key={c.key} className="sheet__radio">
                  <input
                    type="radio"
                    name={`${gridKey}-sort`}
                    checked={!!s}
                    onChange={() => patch({ sort: [`${c.key}:${defaultSort?.dir || 'asc'}`], page: 1 })}
                  />
                  <span>{c.label}</span>
                </label>
              );
            })}
          </div>
          <div className="sheet__actions">
            <Button variant="primary" full onClick={() => {
              const first = state.sort[0];
              if (first) patch({ sort: [`${first.column}:asc`] });
              setSheet(null);
            }}>Ascending</Button>
            <Button full onClick={() => {
              const first = state.sort[0];
              if (first) patch({ sort: [`${first.column}:desc`] });
              setSheet(null);
            }}>Descending</Button>
          </div>
        </Sheet>
      )}

      {sheet === 'filter' && (
        <Sheet title="Filters" onClose={() => setSheet(null)}>
          <FilterPanel
            columns={columns}
            value={state.filters}
            onApply={(f) => { writeFilters(f); setSheet(null); }}
            onReset={() => { writeFilters({}); setSheet(null); }}
          />
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function Chip({ label, onClear }) {
  return (
    <span className="chip">
      {label}
      <button type="button" className="chip__x" aria-label={`Remove filter ${label}`} onClick={onClear}>×</button>
    </span>
  );
}

function DefaultCard({ row, columns }) {
  const [head, ...rest] = columns;
  return (
    <>
      <div className="grid__card-head">{head.render ? head.render(row) : row[head.key]}</div>
      <dl className="grid__card-body">
        {rest.filter((c) => !c.hideOnCard).map((c) => (
          <div key={c.key}>
            <dt>{c.label}</dt>
            <dd>{c.render ? c.render(row) : row[c.key]}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Sheet({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" aria-hidden="true" />
        <div className="sheet__head">
          <h3>{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">×</Button>
        </div>
        <div className="sheet__scroll">{children}</div>
      </div>
    </div>
  );
}

/** DG-2 — the control matches the data type, on desktop popovers and here. */
function FilterPanel({ columns, value, onApply, onReset }) {
  const [draft, setDraft] = useState(value);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <>
      <div className="filters">
        {columns.filter((c) => c.filter).map((c) => (
          <div className="filters__group" key={c.key}>
            <span className="filters__label">{c.label}</span>

            {c.filter === 'text' && (
              <input className="input" value={draft[c.key] || ''} placeholder="Contains…"
                     onChange={(e) => set(c.key, e.target.value)} />
            )}

            {c.filter === 'enum' && (
              <div className="filters__checks">
                {(c.options || []).map((o) => {
                  const selected = toArray(draft[c.key]);
                  const on = selected.includes(o.value);
                  return (
                    <label key={o.value} className="filters__check">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => set(c.key, on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                      />
                      <span>{o.label}</span>
                      {o.count != null && <em>{o.count}</em>}
                    </label>
                  );
                })}
                <p className="filters__hint">Choices here combine with OR.</p>
              </div>
            )}

            {(c.filter === 'number' || c.filter === 'date') && (
              <div className="filters__range">
                <input
                  className="input" type={c.filter === 'date' ? 'date' : 'number'}
                  value={draft[c.key]?.min || ''} aria-label={`${c.label} minimum`}
                  onChange={(e) => set(c.key, { ...(draft[c.key] || {}), min: e.target.value })}
                />
                <span>to</span>
                <input
                  className="input" type={c.filter === 'date' ? 'date' : 'number'}
                  value={draft[c.key]?.max || ''} aria-label={`${c.label} maximum`}
                  onChange={(e) => set(c.key, { ...(draft[c.key] || {}), max: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="sheet__actions">
        <Button variant="primary" full onClick={() => onApply(draft)}>Apply</Button>
        <Button full onClick={onReset}>Reset</Button>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- helpers */

const toArray = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split('|'));

function readState(params, ns, defaultSort) {
  const sortRaw = params.get(ns('sort'));
  const sort = sortRaw
    ? sortRaw.split(',').map((s) => { const [column, dir] = s.split(':'); return { column, dir: dir || 'asc' }; })
    : defaultSort ? [defaultSort] : [];

  const filters = {};
  for (const [k, v] of params.entries()) {
    const prefix = ns('f_');
    if (!k.startsWith(prefix)) continue;
    const col = k.slice(prefix.length);
    filters[col] = v.startsWith('{') ? safeJson(v) : v.includes('|') ? v.split('|') : v;
  }

  return {
    page: Number(params.get(ns('page'))) || 1,
    pageSize: Number(params.get(ns('pageSize'))) || 25,
    q: params.get(ns('q')) || '',
    sort,
    filters,
  };
}

function safeJson(v) { try { return JSON.parse(v); } catch { return v; } }

function buildChips(columns, filters) {
  return Object.entries(filters || {})
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([key, v]) => {
      const col = columns.find((c) => c.key === key);
      const display = Array.isArray(v)
        ? v.join(', ')
        : typeof v === 'object'
          ? [v.min, v.max].filter(Boolean).join(' – ')
          : String(v);
      return { key, label: col?.label || key, display };
    })
    .filter((c) => c.display);
}
