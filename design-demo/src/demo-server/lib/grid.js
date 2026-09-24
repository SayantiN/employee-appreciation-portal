import { db, getSettingInt } from '../db.js';

/**
 * The server half of the Data Grid Standard (SPEC §11).
 *
 * DG-9  — filtering, sorting and pagination happen here, not in the browser.
 * NF-9  — every column name arriving from the client is matched against the
 *         caller's allow-list before it can reach SQL. Nothing is interpolated:
 *         values are always bound parameters.
 * DG-3  — filters on different columns combine with AND; multiple values
 *         within one column combine with OR.
 */
export function applyGrid({ base, params = {}, columns, defaultSort, query = {}, maxPageSize = 200 }) {
  const where = [];
  const bound = { ...params };
  let i = 0;

  // ---- per-column filters -------------------------------------------------
  // f_<column>=value            contains / equals
  // f_<column>=a|b|c            OR within the column
  // f_<column>_min / _max       numeric or date range
  for (const [key, raw] of Object.entries(query)) {
    if (!key.startsWith('f_') || raw == null || raw === '') continue;

    const rangeMatch = key.match(/^f_(.+)_(min|max)$/);
    const name = rangeMatch ? rangeMatch[1] : key.slice(2);
    const sql = columns[name];
    if (!sql) continue;                       // not on the allow-list: ignored

    if (rangeMatch) {
      const p = `g${i++}`;
      bound[p] = raw;
      where.push(`${sql} ${rangeMatch[2] === 'min' ? '>=' : '<='} @${p}`);
      continue;
    }

    const values = String(raw).split('|').filter((v) => v !== '');
    if (!values.length) continue;
    const ors = values.map((v) => {
      const p = `g${i++}`;
      bound[p] = `%${v}%`;
      return `${sql} LIKE @${p}`;
    });
    where.push(`(${ors.join(' OR ')})`);
  }

  // ---- global search across the declared text columns (DG-5) --------------
  const q = String(query.q || '').trim();
  if (q) {
    const searchable = (query.qCols ? String(query.qCols).split(',') : Object.keys(columns))
      .filter((c) => columns[c]);
    if (searchable.length) {
      const p = `g${i++}`;
      bound[p] = `%${q}%`;
      where.push(`(${searchable.map((c) => `${columns[c]} LIKE @${p}`).join(' OR ')})`);
    }
  }

  const hasWhere = /\bWHERE\b/i.test(base);
  const whereSql = where.length ? `${hasWhere ? ' AND ' : ' WHERE '}${where.join(' AND ')}` : '';

  // ---- sorting (DG-1, DG-4) ----------------------------------------------
  // sort=period_label:desc,full_name:asc — multi-column, allow-listed.
  const sortSpec = String(query.sort || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [col, dir] = s.split(':');
      return { col, dir: String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC' };
    })
    .filter((s) => columns[s.col]);

  const effectiveSort = sortSpec.length
    ? sortSpec
    : defaultSort
      ? [{ col: defaultSort.column, dir: defaultSort.dir === 'desc' ? 'DESC' : 'ASC' }]
      : [];

  const orderSql = effectiveSort.length
    ? ` ORDER BY ${effectiveSort.map((s) => `${columns[s.col]} ${s.dir}`).join(', ')}`
    : '';

  // ---- pagination (DG-10) -------------------------------------------------
  const defaultSize = getSettingInt('default_page_size') || 25;
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || defaultSize, 1), maxPageSize);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) n FROM (${base}${whereSql})`).get(bound).n;
  const rows = db.prepare(`${base}${whereSql}${orderSql} LIMIT @__limit OFFSET @__offset`)
    .all({ ...bound, __limit: pageSize, __offset: offset });

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    sort: effectiveSort.map((s) => ({ column: s.col, dir: s.dir.toLowerCase() })),
    appliedFilters: where.length,
  };
}

/** Distinct values with counts, for enum filter popovers (DG-2). */
export function facet(base, params, columnSql) {
  return db.prepare(
    `SELECT ${columnSql} AS value, COUNT(*) AS count
       FROM (${base}) WHERE ${columnSql} IS NOT NULL AND ${columnSql} <> ''
      GROUP BY ${columnSql} ORDER BY ${columnSql}`
  ).all(params);
}
