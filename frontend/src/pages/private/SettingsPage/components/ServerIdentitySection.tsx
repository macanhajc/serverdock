import { useTranslation } from 'react-i18next';
import { Server } from 'pixelarticons/react';
import { TextField } from '../../../../components/forms/TextField';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import { networkProviders } from '../../../../data/networkProviders';
import type { NetworkProviderId } from '../../../../types';
import { SettingsCard } from './SettingsCard';

export function ServerIdentitySection({
  serverHost,
  networkProvider,
  wireguardInterface,
  canManage,
  onServerHostChange,
  onNetworkProviderChange,
  onWireguardInterfaceChange,
  open,
  onToggle,
  dirty,
}: {
  serverHost: string;
  networkProvider: NetworkProviderId;
  wireguardInterface: string;
  canManage: boolean;
  onServerHostChange: (value: string) => void;
  onNetworkProviderChange: (value: NetworkProviderId) => void;
  onWireguardInterfaceChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
  dirty: boolean;
}) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      icon={<Server width={14} height={14} />}
      title={t('settings.serverHostTitle')}
      description={t('settings.serverHostDesc')}
      open={open}
      onToggle={onToggle}
      dirty={dirty}
      summary={`${networkProviders.find((p) => p.id === networkProvider)?.label ?? networkProvider} · ${serverHost || t('settings.serverHostPlaceholder')}`}
    >
      <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-ink-3">{t('settings.networkProviderLabel')}</span>
          <SegmentedControl
            className="flex-wrap"
            options={networkProviders.map((p) => ({ label: p.label, value: p.id }))}
            value={networkProvider}
            disabled={!canManage}
            onChange={(value) => onNetworkProviderChange(value as NetworkProviderId)}
          />
          <span className="font-mono text-[11px] text-ink-3">
            {t(
              networkProviders.find((p) => p.id === networkProvider)?.descriptionKey ??
                'networkProviders.manual'
            )}
          </span>
        </div>
        {networkProvider === 'wireguard' && (
          <TextField
            label={t('settings.wireguardInterfaceLabel')}
            hint={t('settings.wireguardInterfaceHint')}
            mono
            disabled={!canManage}
            placeholder="wg0"
            value={wireguardInterface}
            onChange={(e) => onWireguardInterfaceChange(e.target.value)}
          />
        )}
        <TextField
          label={t('settings.serverHostLabel')}
          hint={t('settings.serverHostHint')}
          mono
          disabled={!canManage}
          placeholder={t('settings.serverHostPlaceholder')}
          value={serverHost}
          onChange={(e) => onServerHostChange(e.target.value)}
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
    </SettingsCard>
  );
}
