import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sacco_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem('sacco_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('sacco_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('sacco_token');
    setUser(null);
  };

  const role = user?.role;
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        isOfficer: role === 'chairperson' || role === 'treasurer',
        isChair: role === 'chairperson',
        isTreasurer: role === 'treasurer',
        isMember: role === 'member',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
