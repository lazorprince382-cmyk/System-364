const API = '/api';

function getToken() {
  return localStorage.getItem('token');
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientFailure(status, message = '') {
  if (status === 502 || status === 503 || status === 504) return true;
  return /temporarily unavailable|cannot reach server|ECONNREFUSED|ECONNRESET|proxy/i.test(
    message
  );
}

async function request(path, options = {}, retries = 2) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${path}`, { ...options, headers });
    } catch {
      lastError = new Error('Cannot reach server. Please wait a moment and try again.');
      if (attempt < retries) {
        await wait(400 * (attempt + 1));
        continue;
      }
      throw lastError;
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;

    const fallback =
      res.status >= 500
        ? 'Server is starting or temporarily unavailable. Please try again.'
        : `Request failed (${res.status})`;
    const message = data.error || fallback;
    lastError = new Error(message);

    if (attempt < retries && isTransientFailure(res.status, message)) {
      await wait(400 * (attempt + 1));
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  updateProfile: (data) =>
    request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (data) =>
    request('/auth/password', { method: 'PATCH', body: JSON.stringify(data) }),
  dashboard: {
    stats: (month) => request(`/dashboard/stats${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    search: (q) => request(`/dashboard/search?q=${encodeURIComponent(q)}`),
    notifications: () => request('/dashboard/notifications'),
  },
  categories: {
    list: () => request('/categories'),
    create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  products: {
    list: (params = '') => request(`/products${params}`),
    get: (id) => request(`/products/${id}`),
    inventorySizes: (id) => request(`/products/${id}/inventory-sizes`),
    create: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  },
  parents: {
    list: () => request('/parents'),
    get: (id) => request(`/parents/${id}`),
    create: (data) => request('/parents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/parents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/parents/${id}`, { method: 'DELETE' }),
    addStudent: (parentId, data) =>
      request(`/parents/${parentId}/students`, { method: 'POST', body: JSON.stringify(data) }),
    updateStudent: (studentId, data) =>
      request(`/parents/students/${studentId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteStudent: (studentId) =>
      request(`/parents/students/${studentId}`, { method: 'DELETE' }),
    allStudents: () => request('/parents/students/all'),
  },
  stock: {
    inventory: (params = '') => request(`/stock/inventory${params}`),
    transactions: () => request('/stock/transactions'),
    in: (data) => request('/stock/in', { method: 'POST', body: JSON.stringify(data) }),
    out: (data) => request('/stock/out', { method: 'POST', body: JSON.stringify(data) }),
  },
  orders: {
    list: () => request('/orders'),
    get: (id) => request(`/orders/${id}`),
    create: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status) =>
      request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    updateItem: (itemId, data) =>
      request(`/orders/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteItem: (itemId) => request(`/orders/items/${itemId}`, { method: 'DELETE' }),
  },
  returns: {
    list: () => request('/returns'),
    create: (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) }),
  },
  uniformHistory: {
    list: () => request('/uniform-history'),
    get: (studentId) => request(`/uniform-history/${studentId}`),
  },
  reports: {
    stock: () => request('/reports/stock'),
    collections: () => request('/reports/sales'),
    lowStock: () => request('/reports/low-stock'),
    downloadExcel: async (type, params = {}) => {
      const token = getToken();
      const qs = new URLSearchParams(params).toString();
      const url = `${API}/reports/export/${type}${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not download report');
      }
      const blob = await res.blob();
      return { blob, filename: res.headers.get('content-disposition') || '' };
    },
  },
  system: {
    users: () => request('/system/users'),
    createUser: (data) => request('/system/users', { method: 'POST', body: JSON.stringify(data) }),
    roles: () => request('/system/roles'),
    updateRole: (id, data) =>
      request(`/system/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    settings: () => request('/system/settings'),
    updateSettings: (data) =>
      request('/system/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
