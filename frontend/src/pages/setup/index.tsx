import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/forms/TextField';
import { LangSwitcher } from '../../components/core/LangSwitcher';

export default function Setup({ onSetupComplete }: { onSetupComplete: () => void }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('setup.passwordMismatch'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.status === 409) {
        navigate('/auth', { replace: true });
        return;
      }
      if (!res.ok) {
        setError(data.error ?? t('login.invalidCredentials'));
        return;
      }
      onSetupComplete();
      login(data.token);
      navigate('/admin', { replace: true });
    } catch {
      setError(t('login.couldNotReach'));
    } finally {
      setLoading(false);
    }
  }

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
              /setup
            </span>
          </div>

          {/* Form body */}
          <div className="p-6">
            <h2 className="m-0 mb-1 text-lg font-bold">{t('setup.title')}</h2>
            <p className="m-0 mb-6 text-xs text-ink-3 font-mono">{t('setup.subtitle')}</p>

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

            <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
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
              <TextField
                label={t('setup.confirmPasswordLabel')}
                mono
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 text-sm font-semibold bg-(--accent-dim) border border-(--accent-edge) text-ink tracking-[.02em] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? t('setup.creating') : t('setup.create')}
              </button>
            </form>
          </div>

          {/* Card footer */}
          <div className="flex items-center gap-2 px-6 py-3 border-t border-line font-mono text-xs text-ink-3">
            <span className="w-2 h-2 bg-green rounded-full" />
            {t('setup.footer')}
            <LangSwitcher className="ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
