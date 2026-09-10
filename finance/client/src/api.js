const API = '/api';

function getToken() {
  return localStorage.getItem('finance_token');
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
    throw new Error('Cannot reach Finance server.');
  }

  if (options.raw) return res;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  users: {
    list: () => request('/users'),
    create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  summary: () => request('/dashboard/summary'),
  terms: () => request('/dashboard/terms'),
  search: (q) => request(`/dashboard/search${qs({ q })}`),
  income: {
    list: (params) => request(`/income${qs(params)}`),
    create: (data) => request('/income', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/income/${id}`, { method: 'DELETE' }),
  },
  expenses: {
    list: (params) => request(`/expenses${qs(params)}`),
    create: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
  },
  vans: {
    list: () => request('/vans'),
    create: (data) => request('/vans', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/vans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  mechanical: {
    list: (params) => request(`/mechanical${qs(params)}`),
    create: (data) => request('/mechanical', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/mechanical/${id}`, { method: 'DELETE' }),
  },
  fuel: {
    expensesList: (params) => request(`/fuel/expenses${qs(params)}`),
    expensesCreate: (data) =>
      request('/fuel/expenses', { method: 'POST', body: JSON.stringify(data) }),
    expensesRemove: (id) => request(`/fuel/expenses/${id}`, { method: 'DELETE' }),
  },
  departments: {
    list: () => request('/departments'),
    create: (data) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
    summary: (id, params) => request(`/departments/${id}/summary${qs(params)}`),
    expensesList: (id, params) => request(`/departments/${id}/expenses${qs(params)}`),
    expensesCreate: (id, data) =>
      request(`/departments/${id}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
    expensesRemove: (id, expenseId) =>
      request(`/departments/${id}/expenses/${expenseId}`, { method: 'DELETE' }),
    purchasesList: (id, params) => request(`/departments/${id}/purchases${qs(params)}`),
    purchasesCreate: (id, data) =>
      request(`/departments/${id}/purchases`, { method: 'POST', body: JSON.stringify(data) }),
    purchasesRemove: (id, purchaseId) =>
      request(`/departments/${id}/purchases/${purchaseId}`, { method: 'DELETE' }),
    stock: (id) => request(`/departments/${id}/stock`),
    issuesList: (id, params) => request(`/departments/${id}/issues${qs(params)}`),
    issuesCreate: (id, data) =>
      request(`/departments/${id}/issues`, { method: 'POST', body: JSON.stringify(data) }),
    issuesRemove: (id, issueId) =>
      request(`/departments/${id}/issues/${issueId}`, { method: 'DELETE' }),
    issuesRemoveBatch: (id, batchId) =>
      request(`/departments/${id}/issues/batch/${batchId}`, { method: 'DELETE' }),
  },
  downloadReport: async (type, params = {}) => {
    const token = getToken();
    const res = await fetch(`${API}/reports/export/${type}${qs(params)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toks-finance-${type}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
  reports: {
    preview: (type, params) => request(`/reports/preview/${type}${qs(params)}`),
  },
};
