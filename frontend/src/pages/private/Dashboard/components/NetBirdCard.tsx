import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'pixelarticons/react';
import { StatusDot } from '../../../../components/core/StatusDot';
import type { VpnStatus } from '../../../../types';

interface NetBirdCardProps {
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

// Surfaces NetBird's own health at a glance on the main dashboard — every
// server's connection info depends on this VPN mesh being up, so a silent
// failure here is worse than a silent failure on any one game server.
export function NetBirdCard({ status, loaded, navigate }: NetBirdCardProps) {
  const { t } = useTranslation();
  if (!loaded) return null;

  const self = status?.self ?? null;
  const peers = status?.peers.filter((p) => !p.name.includes('proxy')) ?? [];
  const online = peers.filter((p) => p.online).length;
  const isDown = !self;

  return (
    <div
      className="border border-line border-b-0 bg-bg-1 px-5 py-4 flex items-center gap-8 cursor-pointer hover:bg-bg-2"
      onClick={() => navigate('/admin/network')}
    >
      <div className="flex items-center gap-2 shrink-0">
        <StatusDot online={!isDown} />
        <span className="font-mono text-sm text-ink font-semibold">
          {t('adminDashboard.netbirdTitle')}
        </span>
      </div>

      {isDown ? (
        <span className="font-mono text-xs" style={{ color: 'var(--red)' }}>
          {t('network.vpnInactive')}
        </span>
      ) : (
        <>
          <Field label={t('network.vpnIp')} value={self?.ip ?? '—'} />
          <Field
            label={t('adminDashboard.netbirdPeers')}
            value={t('network.peerCount', { count: online })}
          />
        </>
      )}

      <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-ink-3 shrink-0">
        {t('adminDashboard.netbirdViewNetwork')}
        <ChevronRight width={12} height={12} />
      </span>
    </div>
  );
}
