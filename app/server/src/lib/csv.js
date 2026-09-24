/**
 * CSV export. Excel opens it directly; a UTF-8 BOM keeps names with
 * non-ASCII characters intact. Each export carries a header block recording
 * who generated it, when, and with which filters (R-6.9.6, DG-11).
 */
export function toCsv({ columns, rows, meta = [] }) {
  const esc = (v) => {
    if (v == null) return '';
    let s = String(v);
    // Neutralise spreadsheet formula injection from free-text fields.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  for (const [k, v] of meta) lines.push(`${esc(k)},${esc(v)}`);
  if (meta.length) lines.push('');
  lines.push(columns.map((c) => esc(c.label)).join(','));
  for (const r of rows) lines.push(columns.map((c) => esc(c.value ? c.value(r) : r[c.key])).join(','));
  return '﻿' + lines.join('\r\n');
}

export function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

/** Lists the grid filters a request carried, for the export header. */
export function describeFilters(query) {
  const parts = Object.entries(query)
    .filter(([k, v]) => (k.startsWith('f_') || k === 'q') && v !== '')
    .map(([k, v]) => `${k.replace(/^f_/, '')}=${v}`);
  return parts.length ? parts.join('; ') : 'none';
}
