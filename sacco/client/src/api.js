// import.meta.env.BASE_URL is Vite's configured `base` (see vite.config.js):
// `/sacco/` in production (VITE_BASE, so this resolves under the gateway's
// /sacco mount) and `/` in local dev (where the dev server proxies /api
// straight to this app's own backend).
const API = `${import.meta.env.BASE_URL}api`;

/** Public asset path (avatars) under Vite base / gateway /sacco mount. */
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function getToken() {
  return localStorage.getItem('sacco_token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error('Cannot reach SACCO server.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  summary: (workspace) =>
    request(`/dashboard/summary${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''}`),
  search: (q) => request(`/dashboard/search?q=${encodeURIComponent(q)}`),
  members: {
    list: () => request('/members'),
    directory: () => request('/members/directory'),
    create: (data) => request('/members', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  savings: {
    list: () => request('/savings'),
    create: (data) => request('/savings', { method: 'POST', body: JSON.stringify(data) }),
    verify: (id, reject = false) =>
      request(`/savings/${id}/verify`, { method: 'POST', body: JSON.stringify({ reject }) }),
  },
  loans: {
    list: (status) => request(status ? `/loans?status=${encodeURIComponent(status)}` : '/loans'),
    create: (data) => request('/loans', { method: 'POST', body: JSON.stringify(data) }),
    decide: (id, reject = false, notes = '', recommended_amount = '') =>
      request(`/loans/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ reject, notes, recommended_amount }),
      }),
    disburse: (id, notes = '') => request(`/loans/${id}/disburse`, { method: 'POST', body: JSON.stringify({ notes }) }),
    repay: (id, data) => request(`/loans/${id}/repay`, { method: 'POST', body: JSON.stringify(data) }),
    verifyPay: (payId, reject = false) =>
      request(`/loans/repayments/${payId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ reject }),
      }),
    repayments: (id) => request(`/loans/${id}/repayments`),
  },
  my: {
    savings: () => request('/me/savings'),
    loans: () => request('/me/loans'),
    profile: () => request('/me/profile'),
    saveProfile: (data) => request('/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
    password: (data) => request('/me/password', { method: 'POST', body: JSON.stringify(data) }),
    requests: () => request('/me/requests'),
    guarantees: () => request('/me/guarantees'),
    respondGuarantee: (id, reject = false, note = '') =>
      request(`/me/guarantees/${id}/respond`, { method: 'POST', body: JSON.stringify({ reject, note }) }),
  },
  messages: {
    list: (userId) => request(userId ? `/messages?user_id=${userId}` : '/messages'),
    threads: () => request('/messages/threads'),
    contacts: () => request('/messages/contacts'),
    send: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
  },
  accounts: {
    list: () => request('/accounts'),
    create: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    entries: (id) => request(`/accounts/${id}/entries`),
    addEntry: (id, data) => request(`/accounts/${id}/entries`, { method: 'POST', body: JSON.stringify(data) }),
  },
  payroll: {
    preview: (year_month) =>
      request(`/payroll/preview${year_month ? `?year_month=${encodeURIComponent(year_month)}` : ''}`),
    history: () => request('/payroll/history'),
    run: (id) => request(`/payroll/runs/${id}`),
    post: (data) => request('/payroll/post', { method: 'POST', body: JSON.stringify(data) }),
  },
  notifications: {
    list: () => request('/notifications'),
    unread: () => request('/notifications/unread-count'),
    read: (id) => request(`/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({}) }),
    readAll: () => request('/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }),
  },
  welfare: {
    get: () => request('/welfare'),
    contribute: (data) => request('/welfare/contributions', { method: 'POST', body: JSON.stringify(data) }),
    verify: (id, reject = false) =>
      request(`/welfare/contributions/${id}/verify`, { method: 'POST', body: JSON.stringify({ reject }) }),
    request: (data) => request('/welfare/requests', { method: 'POST', body: JSON.stringify(data) }),
    decide: (id, reject = false, notes = '') =>
      request(`/welfare/requests/${id}/decide`, { method: 'POST', body: JSON.stringify({ reject, notes }) }),
    postEvent: (id, data = {}) =>
      request(`/welfare/events/${id}/post`, { method: 'POST', body: JSON.stringify(data) }),
    payEvent: (id, data) =>
      request(`/welfare/events/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
    verifyEventPay: (id, reject = false) =>
      request(`/welfare/events/payments/${id}/verify`, { method: 'POST', body: JSON.stringify({ reject }) }),
    ledger: (data) => request('/welfare/ledger', { method: 'POST', body: JSON.stringify(data) }),
  },
};
