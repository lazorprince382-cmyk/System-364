import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);
const WS_KEY = 'sacco_workspace';

function resolveWorkspace(user, preferred) {
  if (!user) return null;
  if (preferred === 'desk' && user.can_desk) return 'desk';
  if (preferred === 'member' && user.can_member) return 'member';
  if (user.can_desk && !user.can_member) return 'desk';
  if (user.can_member && !user.can_desk) return 'member';
  if (user.can_desk) return 'desk';
  return 'member';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspaceState] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('sacco_token');
    if (!token) {
      setLoading(false);
      return;
    }
    const refresh = () =>
      api
        .me()
        .then((u) => {
          setUser(u);
          setWorkspaceState(resolveWorkspace(u, localStorage.getItem(WS_KEY)));
        })
        .catch(() => localStorage.removeItem('sacco_token'))
        .finally(() => setLoading(false));

    refresh();
    const onProfile = () => {
      api.me().then(setUser).catch(() => {});
    };
    window.addEventListener('sacco-profile-updated', onProfile);
    return () => window.removeEventListener('sacco-profile-updated', onProfile);
  }, []);

  const setWorkspace = (mode, forUser = user) => {
    const next = resolveWorkspace(forUser, mode);
    setWorkspaceState(next);
    if (next) localStorage.setItem(WS_KEY, next);
  };

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('sacco_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('sacco_token');
    localStorage.removeItem(WS_KEY);
    setUser(null);
    setWorkspaceState(null);
  };

  const value = useMemo(() => {
    const role = user?.role;
    const ws = workspace || resolveWorkspace(user, null);
    const inDesk = ws === 'desk';
    const inMember = ws === 'member';
    return {
      user,
      login,
      logout,
      loading,
      workspace: ws,
      setWorkspace,
      isOfficer: Boolean(user?.can_desk && inDesk),
      isChair: role === 'chairperson' && inDesk,
      isTreasurer: role === 'treasurer' && inDesk,
      isMember: Boolean(user?.can_member && inMember),
      canSwitch: Boolean(user?.dual_role),
    };
  }, [user, loading, workspace]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
