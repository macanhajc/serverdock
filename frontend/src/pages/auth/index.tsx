import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/forms/TextField';
import { LangSwitcher } from '../../components/core/LangSwitcher';

type LoginMode = 'visitor' | 'admin';

const USERNAME_RE = /^[a-z0-9_-]+$/i;

function validateUsername(v: string): string | null {
  if (!v || v.length < 2) return 'login.minLength';
  if (v.length > 20) return 'login.maxLength';
  if (!USERNAME_RE.test(v)) return 'login.invalidChars';
  return null;
}

export default function Auth() {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<LoginMode>(params.get('mode') === 'admin' ? 'admin' : 'visitor');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    if (isAuthenticated) navigate('/admin', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const token = localStorage.getItem('sd_visitor_token');
    if (!token || mode === 'admin') return;
    fetch('/api/visitors/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (r.status === 403) {
          const body = await r.json().catch(() => ({}));
          if (body.error === 'blocked') navigate('/blocked', { replace: true });
          return;
        }
        if (r.ok) {
          const data = await r.json();
          if (data) navigate('/', { replace: true });
        }
      })
      .catch(() => {});
  }, [mode, navigate]);

  useEffect(() => {
    if (mode !== 'visitor') return;
    fetch('/api/settings/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setRegistrationOpen(data.registrationOpen);
      })
      .catch(() => {});
  }, [mode]);

  function switchMode(m: LoginMode) {
    setMode(m);
    setError('');
    setName('');
    setUsername('');
    setPassword('');
  }

  async function handleVisitor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    const errKey = validateUsername(trimmed);
    if (errKey) {
      setError(t(errKey));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/visitors/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (res.status === 403) {
        if (data.error === 'blocked') {
          navigate('/blocked', { replace: true });
          return;
        }
        setRegistrationOpen(false);
        setError(t('login.registrationClosed'));
        return;
      }
      if (!res.ok) {
        setError(data.error ?? t('login.couldNotRegister'));
        return;
      }
      localStorage.setItem('sd_visitor_token', data.token);
      navigate('/', { replace: true });
    } catch {
      setError(t('login.couldNotReach'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t('login.invalidCredentials'));
        return;
      }
      login(data.token);
      navigate('/admin', { replace: true });
    } catch {
      setError(t('login.couldNotReach'));
    } finally {
      setLoading(false);
    }
  }

  const isVisitor = mode === 'visitor';

  return (
    <div className="min-h-screen bg-bg">
      <div
        className="min-h-screen grid place-items-center px-5 py-10"
        style={{
          background: `
            radial-gradient(60% 50% at 50% 0%, #161616 0%, var(--bg) 60%),
            repeating-linear-gradient(0deg, transparent 0 38px, color-mix(in oklab,var(--line) 40%,transparent) 38px 39px),
            repeating-linear-gradient(90deg, transparent 0 38px, color-mix(in oklab,var(--line) 40%,transparent) 38px 39px)
          `,
        }}
      >
        <div className="w-95 max-w-full bg-bg-1 border border-line">
          {/* Card header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
            <span className="w-7.5 h-7.5 bg-accent grid place-items-center text-white font-bold text-base font-mono">
              S
            </span>
            <b className="text-[17px] font-bold">ServerDock</b>
            <span className="ml-auto font-mono text-xs tracking-[.08em] uppercase text-ink-3 border border-line px-2 py-0.5">
              {isVisitor ? '/access' : '/admin'}
            </span>
          </div>

          {/* Form body */}
          <div className="p-6">
            {isVisitor ? (
              <>
                <h2 className="m-0 mb-1 text-lg font-bold">{t('login.visitorTitle')}</h2>
                <p className="m-0 mb-6 text-xs text-ink-3 font-mono">
                  {t('login.visitorSubtitle')}
                </p>
              </>
            ) : (
              <>
                <h2 className="m-0 mb-1 text-lg font-bold">{t('login.adminTitle')}</h2>
                <p className="m-0 mb-6 text-xs text-ink-3 font-mono">{t('login.adminSubtitle')}</p>
              </>
            )}

            {error && (
              <div
                className="flex items-center gap-2 mb-4 px-3 py-2 font-mono text-xs text-red"
                style={{
                  background: 'color-mix(in oklab, var(--red) 10%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--red) 45%, transparent)',
                }}
              >
                <span>✕</span>
                <span>{error}</span>
              </div>
            )}

            {isVisitor ? (
              registrationOpen ? (
                <form onSubmit={handleVisitor} autoComplete="off" className="flex flex-col gap-4">
                  <TextField
                    label={t('login.nameLabel')}
                    mono
                    placeholder="your-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 mt-2 text-sm font-semibold bg-(--accent-dim) border border-(--accent-edge) text-ink tracking-[.02em] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? t('login.entering') : t('login.enter')}
                  </button>
                </form>
              ) : (
                <div
                  className="flex items-start gap-2 px-3 py-3 font-mono text-xs text-yellow"
                  style={{
                    background: 'color-mix(in oklab, var(--yellow) 6%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--yellow) 30%, transparent)',
                  }}
                >
                  <span className="shrink-0">⚠</span>
                  <span>{t('login.registrationClosed')}</span>
                </div>
              )
            ) : (
              <form onSubmit={handleAdmin} autoComplete="off" className="flex flex-col gap-4">
                <TextField
                  label={t('login.usernameLabel')}
                  mono
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
                <TextField
                  label={t('login.passwordLabel')}
                  mono
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-2 text-sm font-semibold bg-(--accent-dim) border border-(--accent-edge) text-ink tracking-[.02em] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? t('login.signingIn') : t('login.signIn')}
                </button>
              </form>
            )}
          </div>

          {/* Mode toggle */}
          <div className="px-6 pb-5 text-center">
            {isVisitor ? (
              <button
                type="button"
                onClick={() => switchMode('admin')}
                className="font-mono text-xs text-ink-3 underline cursor-pointer bg-transparent border-0 p-0"
              >
                {t('login.switchToAdmin')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('visitor')}
                className="font-mono text-xs text-ink-3 underline cursor-pointer bg-transparent border-0 p-0"
              >
                {t('login.switchToVisitor')}
              </button>
            )}
          </div>

          {/* Card footer */}
          <div className="flex items-center gap-2 px-6 py-3 border-t border-line font-mono text-xs text-ink-3">
            <span className="w-2 h-2 bg-green rounded-full" />
            {t('login.footer')}
            <LangSwitcher className="ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
