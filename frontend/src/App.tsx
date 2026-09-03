import { Component, ReactNode, ErrorInfo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import i18n from './i18n';

import PublicDashboard from './pages/public/Dashboard';
import Auth from './pages/auth';
import Setup from './pages/setup';
import Blocked from './pages/public/Blocked';
import PrivateDashboard from './pages/private';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-bg grid place-items-center font-mono text-xs p-8">
          <div className="border border-line px-8 py-6 text-center max-w-sm">
            <div className="text-red mb-3">✕ {i18n.t('error.unexpected')}</div>
            <div className="text-ink-2 mb-4 text-[13px]">{this.state.error.message}</div>
            <button
              className="border border-line-2 bg-bg-2 text-ink-2 px-4 py-2 cursor-pointer hover:text-ink"
              onClick={() => this.setState({ error: null })}
            >
              {i18n.t('error.tryAgain')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

// First-run gate: while no admin exists yet, every route redirects to
// /setup; once one exists, /setup redirects away. The initial value comes
// from the server once per page load, but completing setup flips it to
// false locally (via onSetupComplete) — otherwise the gate below would
// bounce a just-registered admin from /admin straight back to /setup,
// since it wouldn't know setup had finished until the next full reload.
function SetupGate({ needsSetup, children }: { needsSetup: boolean; children: ReactNode }) {
  return needsSetup ? <Navigate to="/setup" replace /> : <>{children}</>;
}

function SetupRoute({ needsSetup, onSetupComplete }: { needsSetup: boolean; onSetupComplete: () => void }) {
  return needsSetup ? <Setup onSetupComplete={onSetupComplete} /> : <Navigate to="/auth" replace />;
}

export default function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((r) => (r.ok ? r.json() : { needsSetup: false }))
      .then((data) => setNeedsSetup(!!data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (needsSetup === null) {
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route
              path="/setup"
              element={<SetupRoute needsSetup={needsSetup} onSetupComplete={() => setNeedsSetup(false)} />}
            />
            <Route
              path="/"
              element={
                <SetupGate needsSetup={needsSetup}>
                  <PublicDashboard />
                </SetupGate>
              }
            />
            <Route
              path="/auth"
              element={
                <SetupGate needsSetup={needsSetup}>
                  <Auth />
                </SetupGate>
              }
            />
            <Route path="/blocked" element={<Blocked />} />

            <Route
              path="/admin/*"
              element={
                <SetupGate needsSetup={needsSetup}>
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <PrivateDashboard />
                    </ErrorBoundary>
                  </ProtectedRoute>
                </SetupGate>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
