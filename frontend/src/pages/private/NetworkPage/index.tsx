import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircleInfo,
  Refresh,
  Server,
  Users,
  WarningDiamond,
} from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { PageHeader } from '../../../components/core/PageHeader';
import { CopyButton } from '../../../components/core/CopyButton';
import { timeAgo } from '../../../utils/format';
import type { VpnStatus, VpnSelf, VpnPeer } from '../../../types';
import { StatusDot } from '../../../components/core/StatusDot';
import { SelfCardSkeleton } from './components/SelfCardSkeleton';
import { PeerRowSkeleton } from './components/PeerRowSkeleton';

export default function NetworkPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(
    () =>
      fetch('/api/vpn/status', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: VpnStatus) => {
          setStatus(data);
          setLoaded(true);
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err === 401 ? t('network.unauthorized') : t('network.couldNotReach'));
          setLoaded(true);
        }),
    [token, t]
  );

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const self: VpnSelf | null = status?.self ?? null;
  const peers: VpnPeer[] = status?.peers ?? [];
  const online = peers.filter((p) => p.online).length;
  const provider = status?.provider ?? 'netbird';

  return (
    <>
      <PageHeader
        title={t('network.title')}
        subtitle={`/admin/network · ${provider} · ${t('network.peerCount', { count: online })}`}
      >
        <button
          onClick={fetchStatus}
          className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs text-ink-3 border border-line px-3 py-1.5 cursor-pointer hover:text-ink hover:bg-bg-1"
        >
          <Refresh width={12} height={12} />
          {t('network.refresh')}
        </button>
      </PageHeader>

      <div className="px-6 py-5 flex flex-col gap-6 container">
        {/* This server */}
        <section>
          <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
            <Server width={14} height={14} />
            {t('network.thisServer')}
          </h2>
          {!loaded && <SelfCardSkeleton />}
          {loaded && error && (
            <div
              className="flex items-center gap-2 border px-4 py-3 font-mono text-xs text-red"
              style={{
                background: 'color-mix(in oklab, var(--red) 8%, transparent)',
                borderColor: 'color-mix(in oklab, var(--red) 35%, transparent)',
              }}
            >
              <WarningDiamond width={13} height={13} className="shrink-0" />
              {error} — {t('network.vpnCheck')}
            </div>
          )}
          {loaded && !error && !self && (
            <div className="flex items-center gap-2 border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3">
              <WarningDiamond width={13} height={13} className="shrink-0 text-yellow" />
              {t('network.vpnInactive')} <code className="text-ink">sudo netbird up</code>{' '}
              {t('network.vpnInactiveSuffix')}
            </div>
          )}
          {loaded && self && (
            <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <StatusDot online={self.online} />
                <span className="font-mono text-sm text-ink font-semibold">{self.name}</span>
                <span className="ml-auto font-mono text-xs text-ink-3">
                  {self.online ? t('network.connected') : t('network.offline')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-3 w-20 shrink-0">
                  {t('network.vpnIp')}
                </span>
                <span className="font-mono text-sm text-ink">{self.ip ?? '—'}</span>
                {self.ip && <CopyButton text={self.ip} />}
              </div>
              <div
                className="mt-1 px-3 py-2.5 font-mono text-xs text-ink-2"
                style={{
                  background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
                }}
              >
                {t('network.friendsConnect1')}{' '}
                <span className="text-ink font-semibold">{self.ip ?? 'your VPN IP'}</span>{' '}
                {t('network.friendsConnect2')}
              </div>
            </div>
          )}
        </section>

        {/* Peers */}
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

          {loaded && peers.length === 0 && !error && (
            <div className="flex items-center gap-2 border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3">
              <Users width={14} height={14} className="shrink-0" />
              {t('network.noPeers')}{' '}
              <span className="text-ink">{t('network.vpnDashboard')}</span>.
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
                    <Th>{t('network.colStatus')}</Th>
                    <Th last>{t('network.colLastSeen')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {peers.filter(p =>  !p.name.includes("proxy")).map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <StatusDot online={p.online} />
                          <span className="font-mono text-sm text-ink">{p.name}</span>
                        </div>
                      </Td>
                      <Td mono>{p.ip ?? '—'}</Td>
                      <Td mono className="capitalize">
                        {p.os ?? '—'}
                      </Td>
                      <Td mono style={{ color: p.online ? 'var(--green)' : 'var(--ink-3)' }}>
                        {p.online ? t('network.online') : t('network.offline')}
                      </Td>
                      <Td mono last className="whitespace-nowrap">
                        {p.online ? '—' : timeAgo(p.lastSeen, t)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* How to join */}
        <section>
          <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
            <CircleInfo width={14} height={14} />
            {t('network.howToInvite')}
          </h2>
          <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3 font-mono text-xs text-ink-2">
            <p className="m-0 text-ink-3">{t('network.sharedAccountNote')}</p>
            <p className="m-0">{t('network.step1')}</p>
            <p className="m-0">{t('network.step2')}</p>
            <p className="m-0">{t('network.step3')}</p>
            <p className="m-0 text-ink-3">
              {t('network.removeAccess')}{' '}
              <span className="text-ink-2">{t('network.vpnDashboard')}</span>{' '}
              {t('network.removeAccessPost')}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Th({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <th
      className={`text-left px-4 py-3 font-mono text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap ${
        last ? '' : 'border-r border-line'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  last,
  className,
  style,
}: {
  children: React.ReactNode;
  mono?: boolean;
  last?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={`px-4 py-3 text-xs ${last ? '' : 'border-r border-line'} ${
        mono ? 'font-mono text-ink-2' : 'text-ink-3'
      } ${className ?? ''}`}
      style={style}
    >
      {children}
    </td>
  );
}
