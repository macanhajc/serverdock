import { useTranslation } from 'react-i18next';
import { Users } from 'pixelarticons/react';
import type { NetworkProviderMeta } from '../../../../data/networkProviders';
import type { NetworkProviderId, VpnPeer } from '../../../../types';
import { PeerRow } from './PeerRow';
import { PeerRowSkeleton } from './PeerRowSkeleton';
import { Th } from './TableParts';

export function PeersSection({
  peers,
  providerId,
  providerMeta,
  hasError,
  loaded,
}: {
  peers: VpnPeer[];
  providerId: NetworkProviderId;
  providerMeta: NetworkProviderMeta;
  hasError: boolean;
  loaded: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
        <Users width={14} height={14} />
        {t('network.peers')}
      </h2>

      {!loaded && (
        <div className="border border-line bg-bg-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-bg-2 border-line">
                <Th>{t('network.colDevice')}</Th>
                <Th>{t('network.colIp')}</Th>
                <Th>{t('network.colOs')}</Th>
                <Th>{t('network.colConnection')}</Th>
                <Th>{t('network.colLatency')}</Th>
                <Th>{t('network.colStatus')}</Th>
                <Th last>{t('network.colLastSeen')}</Th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <PeerRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loaded && peers.length === 0 && !hasError && (
        <div className="flex items-center gap-2 border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3">
          <Users width={14} height={14} className="shrink-0" />
          {providerId === 'netbird' ? (
            <>
              {t('network.noPeers')}{' '}
              <span className="text-ink">
                {t('network.vpnDashboard', { provider: providerMeta.label })}
              </span>
              .
            </>
          ) : (
            t('network.noPeersNoDashboard')
          )}
        </div>
      )}

      {loaded && peers.length > 0 && (
        <div className="border border-line bg-bg-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-bg-2 border-line">
                <Th>{t('network.colDevice')}</Th>
                <Th>{t('network.colIp')}</Th>
                <Th>{t('network.colOs')}</Th>
                <Th>{t('network.colConnection')}</Th>
                <Th>{t('network.colLatency')}</Th>
                <Th>{t('network.colStatus')}</Th>
                <Th last>{t('network.colLastSeen')}</Th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p, i) => (
                <PeerRow key={p.id} peer={p} striped={i % 2 === 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
