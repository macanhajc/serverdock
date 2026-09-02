import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import socket from '../socket';

const SESSION_KEY = 'sd_token';

export interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  socketConnected: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  // Reconnect socket once on mount if a stored token exists
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && !socket.connected) {
      socket.auth = { token: stored };
      socket.connect();
    }
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
    socket.disconnect();
    socket.auth = {};
  }

  return (
    <AuthContext.Provider
      value={{ token, login, logout, isAuthenticated: !!token, socketConnected }}
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
