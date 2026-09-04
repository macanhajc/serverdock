import { useTranslation } from 'react-i18next';
import { Refresh } from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { PageHeader } from '../../../components/core/PageHeader';
import type { VpnSelf, VpnPeer, NetworkProviderId } from '../../../types';
import { getNetworkProvider } from '../../../data/networkProviders';
import { SelfSection } from './components/SelfSection';
import { PeersSection } from './components/PeersSection';
import { ManualNotice } from './components/ManualNotice';
import { HowToInvite } from './components/HowToInvite';
import { useVpnStatus } from './hooks/useVpnStatus';
import { vpnErrorMessage } from './hooks/networkApi';

// The only two providers with a well-known, always-correct one-line "turn it
// on" command — shown as a hint when that provider isn't reporting active.
// The rest (WireGuard/ZeroTier) vary too much by setup to guess safely.
const START_COMMANDS: Partial<Record<NetworkProviderId, string>> = {
  netbird: 'sudo netbird up',
  tailscale: 'sudo tailscale up',
};

export default function NetworkPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings:manage');

  const statusQuery = useVpnStatus();
  const status = statusQuery.data;
  const loaded = !statusQuery.isLoading;
  const error = vpnErrorMessage(statusQuery.error, t);

  const self: VpnSelf | null = status?.self ?? null;
  const providerId = (status?.provider ?? 'netbird') as NetworkProviderId;
  const providerMeta = getNetworkProvider(providerId);
  const isManual = providerId === 'manual';
  const startCommand = START_COMMANDS[providerId];
  // NetBird surfaces its own relay/signal infra as peers named "*proxy*" —
  // not something a friend ever needs to see. Other providers have no such
  // convention, so the filter only applies there.
  const peers: VpnPeer[] =
    providerId === 'netbird'
      ? (status?.peers ?? []).filter((p) => !p.name.includes('proxy'))
      : (status?.peers ?? []);
  const online = peers.filter((p) => p.online).length;

  return (
    <>
      <PageHeader
        title={t('network.title')}
        subtitle={`/admin/network · ${providerMeta.label} · ${t('network.peerCount', { count: online })}`}
      >
        <button
          onClick={() => statusQuery.refetch()}
          className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs text-ink-3 border border-line px-3 py-1.5 cursor-pointer hover:text-ink hover:bg-bg-1"
        >
          <Refresh
            width={12}
            height={12}
            className={statusQuery.isFetching ? 'animate-spin' : ''}
          />
          {t('network.refresh')}
        </button>
      </PageHeader>

      <div className="px-6 py-5 flex flex-col gap-6 container">
        {/* isManual is only known once loaded (defaults to netbird's
            fallback until then), so this branch also covers the initial
            loading skeleton. */}
        {!isManual && (
          <>
            <SelfSection
              self={self}
              error={error}
              providerMeta={providerMeta}
              startCommand={startCommand}
              loaded={loaded}
            />
            <PeersSection
              peers={peers}
              providerId={providerId}
              providerMeta={providerMeta}
              hasError={!!error}
              loaded={loaded}
            />
            {/* How to join — netbird-only for now; other providers don't
                have their own onboarding walkthrough written yet. */}
            {loaded && providerId === 'netbird' && <HowToInvite providerMeta={providerMeta} />}
          </>
        )}

        {loaded && isManual && <ManualNotice canManage={canManage} />}
      </div>
    </>
  );
}
