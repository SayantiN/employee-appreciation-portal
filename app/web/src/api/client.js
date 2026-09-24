/**
 * The one place the front end talks to the API.
 *
 * Every state-changing request carries X-Requested-With, which the server
 * demands (NF-4 CSRF). Cookies are same-origin and httpOnly, so nothing here
 * ever sees or stores a token.
 */
const BASE = '/api';

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `Request failed (${status})`);
    this.status = status;
    this.payload = payload || {};
    this.errors = payload?.errors || null;
    this.code = payload?.error || null;
  }
}

async function request(method, path, body, { signal } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'same-origin',
    signal,
    headers: {
      'X-Requested-With': 'eap-web',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const payload = text ? safeParse(text) : null;

  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/** Turns a grid state object into the query string the server expects. */
export function gridQuery({ page, pageSize, sort, filters, q } = {}) {
  const p = new URLSearchParams();
  if (page) p.set('page', page);
  if (pageSize) p.set('pageSize', pageSize);
  if (q) p.set('q', q);
  if (sort?.length) p.set('sort', sort.map((s) => `${s.column}:${s.dir}`).join(','));
  for (const [col, value] of Object.entries(filters || {})) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) p.set(`f_${col}`, value.join('|'));
    } else if (typeof value === 'object') {
      if (value.min) p.set(`f_${col}_min`, value.min);
      if (value.max) p.set(`f_${col}_max`, value.max);
    } else {
      p.set(`f_${col}`, value);
    }
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  get:   (path, opts) => request('GET', path, null, opts),
  post:  (path, body, opts) => request('POST', path, body ?? {}, opts),
  patch: (path, body, opts) => request('PATCH', path, body ?? {}, opts),

  // auth
  login: (email, password, remember) => api.post('/auth/login', { email, password, remember }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),

  // dashboard
  dashboard: () => api.get('/dashboard'),

  // voting
  currentBallot: (awardType) => api.get(`/votes/current?awardType=${awardType}`),
  saveVote: (payload) => api.post('/votes', payload),
  withdrawVote: (id) => api.post(`/votes/${id}/withdraw`),
  myVotes: (state) => api.get(`/votes/mine${gridQuery(state)}`),

  // cycles
  currentCycles: () => api.get('/cycles/current'),
  cycles: (state) => api.get(`/cycles${gridQuery(state)}`),
  cycleResults: (id) => api.get(`/cycles/${id}/results`),
  createCycle: (payload) => api.post('/cycles', payload),
  openCycle: (id) => api.post(`/cycles/${id}/open`),
  closeCycle: (id) => api.post(`/cycles/${id}/close`),
  extendCycle: (id, closesAt) => api.post(`/cycles/${id}/extend`, { closesAt }),
  cancelCycle: (id) => api.post(`/cycles/${id}/cancel`),
  reopenCycle: (id, reason) => api.post(`/cycles/${id}/reopen`, { reason }),
  recomputeCycle: (id) => api.post(`/cycles/${id}/recompute`),

  // employees
  employees: (state) => api.get(`/employees${gridQuery(state)}`),
  selectableEmployees: () => api.get('/employees/selectable'),
};
