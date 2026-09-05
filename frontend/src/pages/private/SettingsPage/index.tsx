import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { SettingsPageSkeleton } from './components/SettingsPageSkeleton';
import { NotificationsSection } from './components/NotificationsSection';
import { ServerIdentitySection } from './components/ServerIdentitySection';
import { RegistrationSection } from './components/RegistrationSection';
import { DataStorageSection } from './components/DataStorageSection';
import { DangerZoneSection } from './components/DangerZoneSection';
import { useSettings } from './hooks/useSettings';
import { useSaveSettings } from './hooks/useSaveSettings';
import { settingsErrorMessage } from './hooks/settingsApi';
import type { NetworkProviderId } from '../../../types';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings:manage');
  const { addToast } = useToast();

  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const saved = settingsQuery.data;
  const loaded = !settingsQuery.isLoading;

  const [serverHost, setServerHost] = useState('');
  const [networkProvider, setNetworkProvider] = useState<NetworkProviderId>('netbird');
  const [wireguardInterface, setWireguardInterface] = useState('wg0');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [dataRoot, setDataRoot] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Re-syncs local edit fields to the last-saved snapshot whenever it
  // changes — on first load, and again after a successful save (see
  // useSaveSettings, which merges the response back into this same query
  // cache entry), so the form always resets to "not dirty" post-save.
  useEffect(() => {
    if (!saved) return;
    setServerHost(saved.serverHost);
    setNetworkProvider(saved.networkProvider);
    setWireguardInterface(saved.wireguardInterface);
    setRegistrationOpen(saved.registrationOpen);
    setDataRoot(saved.dataRoot);
    setDiscordWebhookUrl(saved.discordWebhookUrl);
  }, [saved]);

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const notificationsDirty = !!saved && discordWebhookUrl !== saved.discordWebhookUrl;
  const identityDirty =
    !!saved &&
    (serverHost !== saved.serverHost ||
      networkProvider !== saved.networkProvider ||
      wireguardInterface !== saved.wireguardInterface);
  const registrationDirty = !!saved && registrationOpen !== saved.registrationOpen;
  const storageDirty = !!saved && dataRoot !== saved.dataRoot;

  const dirty = notificationsDirty || identityDirty || registrationDirty || storageDirty;

  function handleSave() {
    saveSettings.mutate(
      { serverHost, networkProvider, wireguardInterface, registrationOpen, dataRoot, discordWebhookUrl },
      {
        onSuccess: () => addToast(t('settings.saved')),
        onError: (err) => addToast(settingsErrorMessage(err, t('settings.saveError')), 'error'),
      }
    );
  }

  return (
    <div className="flex relative flex-col h-screen">
      <PageHeader title={t('settings.title')} subtitle="/admin/settings" />

      <div className="flex-1 min-h-0 container overflow-y-auto pb-24 px-6 py-6 flex flex-col gap-3">
        {!loaded || !saved ? (
          <SettingsPageSkeleton />
        ) : (
          <>
            <NotificationsSection
              discordWebhookUrl={discordWebhookUrl}
              savedDiscordWebhookUrl={saved.discordWebhookUrl}
              canManage={canManage}
              onDiscordChange={setDiscordWebhookUrl}
              vapidPublicKey={saved.vapidPublicKey}
              open={openSections.has('notifications')}
              onToggle={() => toggleSection('notifications')}
              dirty={notificationsDirty}
            />

            <ServerIdentitySection
              serverHost={serverHost}
              networkProvider={networkProvider}
              wireguardInterface={wireguardInterface}
              canManage={canManage}
              onServerHostChange={setServerHost}
              onNetworkProviderChange={setNetworkProvider}
              onWireguardInterfaceChange={setWireguardInterface}
              open={openSections.has('identity')}
              onToggle={() => toggleSection('identity')}
              dirty={identityDirty}
            />

            <RegistrationSection
              registrationOpen={registrationOpen}
              canManage={canManage}
              onChange={setRegistrationOpen}
              open={openSections.has('registration')}
              onToggle={() => toggleSection('registration')}
              dirty={registrationDirty}
            />

            <DataStorageSection
              dataRoot={dataRoot}
              defaultDataRoot={saved.defaultDataRoot}
              canManage={canManage}
              onChange={setDataRoot}
              open={openSections.has('storage')}
              onToggle={() => toggleSection('storage')}
              dirty={storageDirty}
            />

            <DangerZoneSection
              canManage={canManage}
              open={openSections.has('danger')}
              onToggle={() => toggleSection('danger')}
            />
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
          <Button
            variant="primary"
            disabled={!dirty || saveSettings.isPending || !loaded}
            onClick={handleSave}
          >
            <Save width={12} height={12} className="mr-1.5" />
            {saveSettings.isPending ? t('settings.saving') : t('settings.save')}
          </Button>
        )}
      </div>
    </div>
  );
}
