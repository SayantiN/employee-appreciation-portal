import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email, password, remember) => {
    const out = await api.login(email, password, remember);
    setUser(out.user);
    return out;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refresh,
    isAdmin: user?.role === 'Admin',
    // Auditors read everything an admin can, but change nothing.
    isPrivileged: user?.role === 'Admin' || user?.role === 'Auditor',
  }), [user, loading, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Light/dark with a manual override, persisted per device (RR-12). */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('eap-theme') || 'system'; } catch { return 'system'; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('eap-theme', theme); } catch { /* private mode */ }
  }, [theme]);

  return [theme, setTheme];
}
