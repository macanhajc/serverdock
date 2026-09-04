import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'pixelarticons/react';
import { StatusDot } from '../../../../components/core/StatusDot';
import { getNetworkProvider } from '../../../../data/networkProviders';
import type { VpnStatus, NetworkProviderId } from '../../../../types';

interface NetworkCardProps {
  status: VpnStatus | null;
  loaded: boolean;
  navigate: (path: string) => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[11px] text-ink-3 uppercase tracking-wider">{label}</span>
      <span className="font-mono text-sm text-ink truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

// Surfaces the active network provider's health at a glance on the main
// dashboard — every server's connection info depends on it, so a silent
// failure here is worse than a silent failure on any one game server.
export function NetworkCard({ status, loaded, navigate }: NetworkCardProps) {
  const { t } = useTranslation();
  if (!loaded) return null;

  const providerId = (status?.provider ?? 'netbird') as NetworkProviderId;
  const providerMeta = getNetworkProvider(providerId);
  const isManual = providerId === 'manual';
  const self = status?.self ?? null;
  const peers =
    providerId === 'netbird'
      ? (status?.peers.filter((p) => !p.name.includes('proxy')) ?? [])
      : (status?.peers ?? []);
  const online = peers.filter((p) => p.online).length;
  // Manual networking has no self/peer concept — that's not "down", it's
  // the admin's deliberate choice, so it gets a neutral row, not a red one.
  const isDown = !isManual && !self;

  return (
    <div
      className="border border-line border-b-0 bg-bg-1 px-5 py-4 flex items-center gap-8 cursor-pointer hover:bg-bg-2"
      onClick={() => navigate('/admin/network')}
    >
      <div className="flex items-center gap-2 shrink-0">
        <StatusDot online={!isDown} />
        <span className="font-mono text-sm text-ink font-semibold">{providerMeta.label}</span>
      </div>

      {isManual ? (
        <span className="font-mono text-xs text-ink-3">{t('adminDashboard.networkManualLabel')}</span>
      ) : isDown ? (
        <span className="font-mono text-xs" style={{ color: 'var(--red)' }}>
          {t('network.providerInactive', { provider: providerMeta.label })}
        </span>
      ) : (
        <>
          <Field label={t('network.vpnIp')} value={self?.ip ?? '—'} />
          <Field
            label={t('adminDashboard.networkPeersLabel')}
            value={t('network.peerCount', { count: online })}
          />
        </>
      )}

      <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-ink-3 shrink-0">
        {t('adminDashboard.networkViewNetwork')}
        <ChevronRight width={12} height={12} />
      </span>
    </div>
  );
}
