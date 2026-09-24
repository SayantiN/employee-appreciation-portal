/**
 * The one place the front end talks to the API.
 *
 * Every state-changing request carries X-Requested-With, which the server
 * demands (NF-4 CSRF). Cookies are same-origin and httpOnly, so nothing here
 * ever sees or stores a token.
 */
import { send, download } from './transport.js';

const BASE = '/api';

export { download };

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `Request failed (${status})`);
    this.status = status;
    this.payload = payload || {};
    this.errors = payload?.errors || null;
    this.code = payload?.error || null;
  }
}

async function request(method, path, body, opts) {
  const res = await send(method, BASE + path, body, opts);
  const payload = res.text ? safeParse(res.text) : null;
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

  closedCycles: () => api.get('/cycles/closed'),

  // employees
  employees: (state) => api.get(`/employees${gridQuery(state)}`),
  selectableEmployees: () => api.get('/employees/selectable'),
  createEmployee: (payload) => api.post('/employees', payload),
  updateEmployee: (id, payload) => api.patch(`/employees/${id}`, payload),
  setEmployeeStatus: (id, status) => api.post(`/employees/${id}/status`, { status }),
  setEmployeeRole: (id, role) => api.post(`/employees/${id}/role`, { role }),
  importEmployees: (csv, dryRun) => api.post('/employees/import', { csv, dryRun }),

  // feedback
  myFeedback: () => api.get('/feedback/mine'),
  reportFeedback: (voteId, reason) => api.post(`/feedback/${voteId}/report`, { reason }),
  feedbackReports: () => api.get('/feedback/reports'),
  resolveFeedbackReport: (id, status) => api.post(`/feedback/reports/${id}`, { status }),

  // winners, reports
  hallOfFame: () => api.get('/winners'),
  showcase: (winnerId) => api.get(`/winners/showcase/${winnerId}`),
  winnersReport: (state, extra) => api.get(`/winners/report${withExtra(gridQuery(state), extra)}`),
  awardStats: (state, extra) => api.get(`/winners/stats${withExtra(gridQuery(state), extra)}`),
  awardStatsHistory: (employeeId, extra) => api.get(`/winners/stats/${employeeId}${withExtra('', extra)}`),

  // publish
  publishCycles: () => api.get('/publish/cycles'),
  publishCycle: (id) => api.get(`/publish/cycles/${id}`),
  publishWinner: (id, payload) => api.post(`/publish/cycles/${id}`, payload),
  unpublishWinner: (id, reason) => api.post(`/publish/cycles/${id}/unpublish`, { reason }),
  saveShowcase: (winnerId, payload) => request('PUT', `/publish/showcase/${winnerId}`, payload),

  // community showcase (6.11A)
  communityPosts: (params) => api.get(`/community${withExtra('', params)}`),
  communityPost: (id) => api.get(`/community/${id}`),
  createCommunityPost: (payload) => api.post('/community', payload),
  updateCommunityPost: (id, payload) => request('PUT', `/community/${id}`, payload),
  hideCommunityPost: (id, reason) => api.post(`/community/${id}/hide`, { reason }),
  restoreCommunityPost: (id) => api.post(`/community/${id}/restore`),

  // tutorials
  tutorials: () => api.get('/tutorials'),
  tutorial: (id) => api.get(`/tutorials/${id}`),
  tutorialProgress: (id, percent) => api.post(`/tutorials/${id}/progress`, { percent }),
  adminTutorials: (state) => api.get(`/tutorials/admin${gridQuery(state)}`),
  adminTutorial: (id) => api.get(`/tutorials/admin/${id}`),
  createTutorial: (payload) => api.post('/tutorials/admin', payload),
  updateTutorial: (id, payload) => api.patch(`/tutorials/admin/${id}`, payload),

  // admin
  auditLog: (state) => api.get(`/admin/audit${gridQuery(state)}`),
  settings: () => api.get('/admin/settings'),
  saveSetting: (key, value) => request('PUT', `/admin/settings/${key}`, { value }),
  analytics: (awardType) => api.get(`/admin/analytics${awardType ? `?awardType=${awardType}` : ''}`),
};

/** Appends non-grid parameters (view, date range…) to a grid query string. */
export function withExtra(qs, extra = {}) {
  const p = new URLSearchParams(qs.replace(/^\?/, ''));
  for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** A download link carrying the same filters as the grid on screen (DG-11). */
export function exportUrl(path, state, extra) {
  return `${BASE}${path}${withExtra(gridQuery({ ...state, page: undefined, pageSize: undefined }), extra)}`;
}
