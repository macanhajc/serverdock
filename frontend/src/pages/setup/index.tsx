import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/forms/TextField';
import { Button } from '../../components/core/Button';
import { LangSwitcher } from '../../components/core/LangSwitcher';
import { networkProviders } from '../../data/networkProviders';
import { useSetupAccount } from './hooks/useSetupAccount';
import { useSaveNetworkProvider } from './hooks/useSaveNetworkProvider';
import type { NetworkProviderId } from '../../types';

export default function Setup({ onSetupComplete }: { onSetupComplete: () => void }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'account' | 'network'>('account');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const [networkChoice, setNetworkChoice] = useState<NetworkProviderId>('netbird');

  const setupAccount = useSetupAccount();
  const saveNetworkProvider = useSaveNetworkProvider();
  const loading = setupAccount.isPending;
  const networkSaving = saveNetworkProvider.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('setup.passwordMismatch'));
      return;
    }
    setError('');
    const result = await setupAccount.mutateAsync({ username, password });
    switch (result.kind) {
      case 'alreadySetup':
        navigate('/auth', { replace: true });
        break;
      case 'error':
        setError(result.error ?? t('login.invalidCredentials'));
        break;
      case 'networkError':
        setError(t('login.couldNotReach'));
        break;
      case 'ok':
        // Log in but don't finish yet — the network step below still needs to
        // run before onSetupComplete() flips needsSetup, which would otherwise
        // yank this component straight to /auth mid-wizard (see SetupGate).
        login(result.token);
        setStep('network');
        break;
    }
  }

  function finishSetup() {
    onSetupComplete();
    navigate('/admin', { replace: true });
  }

  function handleNetworkContinue() {
    saveNetworkProvider.mutate(networkChoice, { onSettled: finishSetup });
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
            {step === 'account' && (
              <>
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
              </>
            )}

            {step === 'network' && (
              <>
                <h2 className="m-0 mb-1 text-lg font-bold">{t('setup.networkTitle')}</h2>
                <p className="m-0 mb-6 text-xs text-ink-3 font-mono">
                  {t('setup.networkSubtitle')}
                </p>

                <div className="flex flex-col gap-2 mb-6">
                  {networkProviders.map((p) => {
                    const active = p.id === networkChoice;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNetworkChoice(p.id)}
                        className={`text-left px-4 py-3 border cursor-pointer transition-colors ${
                          active
                            ? 'border-(--accent-edge) bg-(--accent-dim)'
                            : 'border-line bg-bg-2 hover:bg-bg-3'
                        }`}
                      >
                        <div className="font-mono text-sm font-semibold text-ink">{p.label}</div>
                        <div className="font-mono text-[11px] text-ink-3 mt-0.5">
                          {t(p.descriptionKey)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-center py-3"
                    disabled={networkSaving}
                    onClick={() => finishSetup()}
                  >
                    {t('setup.networkSkip')}
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 justify-center py-3"
                    disabled={networkSaving}
                    onClick={() => handleNetworkContinue()}
                  >
                    {t('setup.networkContinue')}
                  </Button>
                </div>
              </>
            )}
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
