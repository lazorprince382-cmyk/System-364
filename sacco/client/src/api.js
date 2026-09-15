const API = '/api';

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
  summary: () => request('/dashboard/summary'),
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
    list: (memberId) => request(memberId ? `/messages?member_id=${memberId}` : '/messages'),
    threads: () => request('/messages/threads'),
    send: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
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
  },
};
