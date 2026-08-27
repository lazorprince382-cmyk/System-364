import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    let auth;
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        auth = await api.login(email, password);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const retryable = /temporarily unavailable|cannot reach server|request failed/i.test(
          err?.message || ''
        );
        if (!retryable || attempt === 2) throw err;
        await wait(600 * (attempt + 1));
      }
    }
    if (lastErr) throw lastErr;
    const { token, user: u } = auth;
    localStorage.setItem('token', token);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const refreshUser = async () => {
    const u = await api.me();
    setUser(u);
    return u;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
