import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import socket from '../socket';
import type { AdminRole, Permission } from '../types';

const SESSION_KEY = 'sd_token';

export interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  role: AdminRole | null;
  isSuperAdmin: boolean;
  // true if this admin can use `permission` — always true for a super admin
  hasPermission: (permission: Permission) => boolean;
  login: (token: string) => void;
  logout: () => void;
  socketConnected: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  // null permissions + role 'super_admin' means "all"; null + no role means "unknown yet"
  const [permissions, setPermissions] = useState<Permission[] | null>(null);

  const fetchMe = useCallback((jwt: string) => {
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${jwt}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { username: string; role: AdminRole; permissions: Permission[] | null }) => {
        setUsername(data.username);
        setRole(data.role);
        setPermissions(data.permissions);
      })
      .catch(() => {});
  }, []);

  // Reconnect socket once on mount if a stored token exists, and load who-am-I
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      if (!socket.connected) {
        socket.auth = { token: stored };
        socket.connect();
      }
      fetchMe(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track socket connectivity for E2 disconnect indicator
  useEffect(() => {
    function onConnect() {
      setSocketConnected(true);
    }
    function onDisconnect() {
      setSocketConnected(false);
    }
    function onConnectError() {
      setSocketConnected(false);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  function login(jwt: string) {
    sessionStorage.setItem(SESSION_KEY, jwt);
    setToken(jwt);
    socket.auth = { token: jwt };
    // A visitor browsing the public dashboard before logging in may already
    // hold an unauthenticated connection (see socket.ts) — .connect() alone
    // is a no-op on an already-open socket, so force a fresh handshake that
    // actually carries the new auth.
    if (socket.connected) socket.disconnect();
    socket.connect();
    fetchMe(jwt);
  }

  function logout() {
    // Best-effort server-side revocation — local logout must still succeed if this fails
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUsername(null);
    setRole(null);
    setPermissions(null);
    socket.disconnect();
    socket.auth = {};
  }

  // Server-side enforcement is the real boundary (every mutating route checks
  // this independently) — this is UI-gating only, so buttons the caller can't
  // use don't render, but a stale/bypassed client is still safely rejected.
  function hasPermission(permission: Permission): boolean {
    if (role === 'super_admin') return true;
    return !!permissions?.includes(permission);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        role,
        isSuperAdmin: role === 'super_admin',
        hasPermission,
        login,
        logout,
        isAuthenticated: !!token,
        socketConnected,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
