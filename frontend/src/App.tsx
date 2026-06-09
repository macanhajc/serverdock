import { Component, ReactNode, ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import i18n from './i18n';

import PublicDashboard from './pages/public/Dashboard';
import Auth from './pages/auth';
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

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/" element={<PublicDashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/blocked" element={<Blocked />} />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <PrivateDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
