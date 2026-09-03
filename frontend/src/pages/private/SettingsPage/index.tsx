import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BellOff,
  Close,
  Database,
  Save,
  Send,
  Server,
  Trash,
  Users,
  WarningDiamond,
} from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { Toggle } from '../../../components/core/Toggle';
import { TextField } from '../../../components/forms/TextField';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { PageHeader } from '../../../components/core/PageHeader';
import { SettingsPageSkeleton } from './components/SettingsPageSkeleton';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

interface SavedSettings {
  serverHost: string;
  registrationOpen: boolean;
  dataRoot: string;
  discordWebhookUrl: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission('settings:manage');
  const { addToast } = useToast();

  const [serverHost, setServerHost] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [dataRoot, setDataRoot] = useState('');
  const [defaultDataRoot, setDefault] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [saved, setSaved] = useState<SavedSettings>({
    serverHost: '',
    registrationOpen: true,
    dataRoot: '',
    discordWebhookUrl: '',
  });

  // Push state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const s: SavedSettings = {
          serverHost: data.serverHost ?? '',
          registrationOpen: data.registrationOpen ?? true,
          dataRoot: data.dataRoot ?? '',
          discordWebhookUrl: data.discordWebhookUrl ?? '',
        };
        setServerHost(s.serverHost);
        setRegistrationOpen(s.registrationOpen);
        setDataRoot(s.dataRoot);
        setDiscordWebhookUrl(s.discordWebhookUrl);
        setSaved(s);
        setDefault(data.defaultDataRoot ?? '');
        setVapidPublicKey(data.vapidPublicKey ?? '');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [token]);

  // Check push support and existing subscription
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushSupported(true);
    setPushPermission(Notification.permission);
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setPushSubscription(sub))
    );
  }, []);

  const dirty =
    serverHost !== saved.serverHost ||
    registrationOpen !== saved.registrationOpen ||
    dataRoot !== saved.dataRoot ||
    discordWebhookUrl !== saved.discordWebhookUrl;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverHost, registrationOpen, dataRoot, discordWebhookUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('settings.saveError'), 'error');
        return;
      }
      const data = await res.json();
      const s: SavedSettings = {
        serverHost: data.serverHost ?? '',
        registrationOpen: data.registrationOpen ?? true,
        dataRoot: data.dataRoot ?? '',
        discordWebhookUrl: data.discordWebhookUrl ?? '',
      };
      setServerHost(s.serverHost);
      setRegistrationOpen(s.registrationOpen);
      setDataRoot(s.dataRoot);
      setDiscordWebhookUrl(s.discordWebhookUrl);
      setSaved(s);
      addToast(t('settings.saved'));
    } catch {
      addToast(t('settings.saveError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestDiscord() {
    setDiscordTesting(true);
    try {
      const res = await fetch('/api/settings/notify/test-discord', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) addToast(t('settings.discordTestSent'));
      else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('settings.discordTestFailed'), 'error');
      }
    } catch {
      addToast(t('settings.discordTestFailed'), 'error');
    } finally {
      setDiscordTesting(false);
    }
  }

  async function handlePushSubscribe() {
    if (!vapidPublicKey) return;
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') return;
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // @ts-ignore
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushSubscription(sub);
      addToast(t('settings.pushSubscribed'));
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('settings.pushTestFailed'), 'error');
    } finally {
      setPushBusy(false);
    }
  }

  async function handlePushUnsubscribe() {
    if (!pushSubscription) return;
    setPushBusy(true);
    try {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: pushSubscription.endpoint }),
      });
      await pushSubscription.unsubscribe();
      setPushSubscription(null);
      addToast(t('settings.pushNotSubscribed'));
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('settings.pushTestFailed'));
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    setPushTesting(true);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: pushSubscription?.endpoint }),
      });
      if (res.ok) addToast(t('settings.pushTestSent'));
      else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('settings.pushTestFailed'));
      }
    } catch {
      addToast(t('settings.pushTestFailed'));
    } finally {
      setPushTesting(false);
    }
  }

  async function handleWipe() {
    setWiping(true);
    try {
      const res = await fetch('/api/settings/wipe-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        addToast(t('settings.wipeSuccess', { count: data.wiped }));
      } else {
        addToast(data.error ?? t('settings.wipeFailed'));
      }
    } catch {
      addToast(t('settings.wipeFailed'));
    } finally {
      setWiping(false);
    }
  }

  const effectiveRoot = dataRoot.trim() || defaultDataRoot;

  return (
    <div className="flex relative flex-col h-screen">
      <PageHeader title={t('settings.title')} subtitle="/admin/settings" />

      <div className="flex-1 min-h-0 overflow-y-auto pb-24 px-6 py-6 flex flex-col gap-8">
        {!loaded ? (
          <SettingsPageSkeleton />
        ) : (
          <>
            {/* Notifications */}
            <section>
              <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold">
                <Bell width={14} height={14} />
                {t('settings.notificationsTitle')}
              </h3>
              <p className="m-0 mb-5 text-xs text-ink-3">{t('settings.notificationsDesc')}</p>

              <div className="flex flex-col gap-6">
                {/* Discord */}
                <div className="flex border border-dashed bg-line/10 border-line-2 p-4 flex-col gap-3">
                  <h3 className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">
                    {t('settings.discordTitle')}
                  </h3>
                  <p className="m-0 text-xs text-ink-3">{t('settings.discordDesc')}</p>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <TextField
                        label={t('settings.discordLabel')}
                        hint={t('settings.discordHint')}
                        mono
                        disabled={!canManage}
                        placeholder={t('settings.discordPlaceholder')}
                        value={discordWebhookUrl}
                        onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!canManage || !saved.discordWebhookUrl || discordTesting}
                      onClick={handleTestDiscord}
                    >
                      {discordTesting ? (
                        '…'
                      ) : (
                        <>
                          <Send width={12} height={12} className="mr-1.5" />
                          {t('settings.discordTest')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Browser Push */}
                <div className="flex border border-dashed bg-line/10 border-line-2 p-4 flex-col gap-3">
                  <h3 className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">
                    {t('settings.pushTitle')}
                  </h3>
                  <p className="m-0 text-xs text-ink-3">{t('settings.pushDesc')}</p>
                  {!pushSupported ? (
                    <div className="font-mono text-xs text-ink-3">
                      {t('settings.pushNotSupported')}
                    </div>
                  ) : pushPermission === 'denied' ? (
                    <div className="font-mono text-xs text-yellow">
                      {t('settings.pushPermissionDenied')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink-3">
                        {pushSubscription
                          ? t('settings.pushSubscribed')
                          : t('settings.pushNotSubscribed')}
                      </span>
                      {pushSubscription ? (
                        <>
                          <Button size="sm" disabled={pushTesting} onClick={handleTestPush}>
                            {pushTesting ? (
                              '…'
                            ) : (
                              <>
                                <Bell width={12} height={12} className="mr-1.5" />
                                {t('settings.pushTest')}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={pushBusy}
                            onClick={handlePushUnsubscribe}
                          >
                            <BellOff width={12} height={12} className="mr-1.5" />
                            {t('settings.pushUnsubscribe')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={pushBusy || !vapidPublicKey}
                          onClick={handlePushSubscribe}
                        >
                          {pushBusy ? (
                            '…'
                          ) : (
                            <>
                              <Bell width={12} height={12} className="mr-1.5" />
                              {t('settings.pushSubscribe')}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Server Identity */}
            <section className="border-t border-line pt-6">
              <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold">
                <Server width={14} height={14} />
                {t('settings.serverHostTitle')}
              </h3>
              <p className="m-0 mb-5 text-xs text-ink-3">{t('settings.serverHostDesc')}</p>

              <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
                <TextField
                  label={t('settings.serverHostLabel')}
                  hint={t('settings.serverHostHint')}
                  mono
                  disabled={!canManage}
                  placeholder={t('settings.serverHostPlaceholder')}
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                />
                <div
                  className="px-3 py-2.5 font-mono text-xs"
                  style={{
                    background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
                  }}
                >
                  <span className="text-ink-3">{t('settings.serverHostNote')}</span>
                </div>
              </div>
            </section>

            {/* Visitor Registration */}
            <section>
              <div className="border-t border-line pt-6">
                <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold">
                  <Users width={14} height={14} />
                  {t('settings.registrationTitle')}
                </h3>
                <p className="m-0 mb-5 text-xs text-ink-3">{t('settings.registrationDesc')}</p>

                <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
                  <Toggle
                    checked={registrationOpen}
                    disabled={!canManage}
                    onChange={(v: boolean) => setRegistrationOpen(v)}
                    label={t('settings.registrationOpenLabel')}
                  />

                  {!registrationOpen && (
                    <div
                      className="flex gap-2 px-3 py-2.5 font-mono text-xs text-yellow"
                      style={{
                        background: 'color-mix(in oklab, var(--yellow) 6%, transparent)',
                        border: '1px solid color-mix(in oklab, var(--yellow) 30%, transparent)',
                      }}
                    >
                      <WarningDiamond width={13} height={13} className="shrink-0" />
                      <span>{t('settings.registrationClosedWarning')}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Data Storage */}
            <section>
              <div className="border-t border-line pt-6">
                <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold">
                  <Database width={14} height={14} />
                  {t('settings.dataStorageTitle')}
                </h3>
                <p className="m-0 mb-5 text-xs text-ink-3">{t('settings.dataStorageDesc')}</p>

                <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
                  <TextField
                    label={t('settings.dataRootLabel')}
                    hint={t('settings.dataRootHint')}
                    mono
                    disabled={!canManage}
                    placeholder={t('settings.dataRootPlaceholder')}
                    value={dataRoot}
                    onChange={(e) => setDataRoot(e.target.value)}
                  />

                  {canManage && dataRoot.trim() && (
                    <button
                      type="button"
                      onClick={() => setDataRoot('')}
                      className="self-start inline-flex items-center gap-1 font-mono text-xs text-ink-3 underline cursor-pointer bg-transparent border-0 p-0 hover:text-ink"
                    >
                      <Close width={11} height={11} />
                      {t('settings.dataRootClear')}
                    </button>
                  )}

                  <div
                    className="px-3 py-2.5 font-mono text-xs flex flex-col gap-1"
                    style={{
                      background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
                    }}
                  >
                    <span className="text-ink-3 uppercase tracking-[.06em] text-[10px]">
                      {t('settings.effectiveLabel')}
                    </span>
                    <span className="text-ink-2">{t('settings.effectiveDesc')}</span>
                    <span className="text-ink break-all">
                      {t('settings.effectivePattern', { root: effectiveRoot })}
                    </span>
                  </div>

                  <div
                    className="flex gap-2 px-3 py-2.5 font-mono text-xs text-yellow"
                    style={{
                      background: 'color-mix(in oklab, var(--yellow) 6%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--yellow) 30%, transparent)',
                    }}
                  >
                    <WarningDiamond width={13} height={13} className="shrink-0" />
                    <span>{t('settings.migrationWarning')}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Danger Zone */}
            <section>
              <div className="border-t border-line pt-6">
                <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold text-red">
                  <WarningDiamond width={14} height={14} />
                  {t('settings.dangerZoneTitle')}
                </h3>
                <p className="m-0 mb-5 text-xs text-ink-3">{t('settings.dangerZoneDesc')}</p>

                <div
                  className="flex items-center justify-between gap-4 px-4 py-4"
                  style={{
                    background: 'color-mix(in oklab, var(--red) 6%, transparent)',
                    border: '1px dashed color-mix(in oklab, var(--red) 25%, transparent)',
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-ink">{t('settings.wipeAllTitle')}</span>
                    <span className="font-mono text-xs text-ink-3">
                      {t('settings.wipeAllDesc')}
                    </span>
                  </div>
                  {canManage && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={wiping}
                      onClick={() => setConfirmWipe(true)}
                    >
                      <Trash width={12} height={12} className="mr-1.5" />
                      {wiping ? t('settings.wiping') : t('settings.wipeAllBtn')}
                    </Button>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <div
        className="shrink-0 fixed bottom-0 left-0 right-0 flex items-center gap-3 px-6 py-3 justify-end border-t border-line"
        style={{
          background: 'color-mix(in oklab, var(--bg-1) 94%, transparent)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {canManage && (
          <Button variant="primary" disabled={!dirty || saving || !loaded} onClick={handleSave}>
            <Save width={12} height={12} className="mr-1.5" />
            {saving ? t('settings.saving') : t('settings.save')}
          </Button>
        )}
      </div>

      {confirmWipe && (
        <ConfirmModal
          title={t('settings.wipeConfirmTitle')}
          message={t('settings.wipeConfirmMessage')}
          confirmLabel={t('settings.wipeConfirmBtn')}
          onConfirm={() => {
            setConfirmWipe(false);
            handleWipe();
          }}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </div>
  );
}
