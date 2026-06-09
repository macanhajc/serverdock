import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { PageHeader } from '../../../components/core/PageHeader';
import { CopyButton } from '../../../components/core/CopyButton';
import type { VpnStatus, VpnSelf, VpnPeer } from '../../../types';
import { StatusDot } from './components/StatusDot';

function formatLastSeen(iso: string | undefined, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return t('network.justNow');
  if (diff < 3_600_000) return t('network.mAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('network.hAgo', { count: Math.floor(diff / 3_600_000) });
  return d.toLocaleDateString();
}

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
  const provider = status?.provider ?? 'tailscale';

  return (
    <>
      <PageHeader
        title={t('network.title')}
        subtitle={`/admin/network · ${provider} · ${t('network.peerCount', { count: online })}`}
      >
        <button
          onClick={fetchStatus}
          className="ml-auto font-mono text-xs text-ink-3 border border-line px-3 py-1.5 cursor-pointer hover:text-ink hover:bg-bg-1"
        >
          {t('network.refresh')}
        </button>
      </PageHeader>

      <div className="px-6 py-5 flex flex-col gap-6">
        {/* This server */}
        <section>
          <h2 className="m-0 mb-3 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
            {t('network.thisServer')}
          </h2>
          {!loaded && (
            <div className="border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3 animate-pulse">
              {t('common.loading')}
            </div>
          )}
          {loaded && error && (
            <div
              className="border px-4 py-3 font-mono text-xs text-red"
              style={{
                background: 'color-mix(in oklab, var(--red) 8%, transparent)',
                borderColor: 'color-mix(in oklab, var(--red) 35%, transparent)',
              }}
            >
              {error} — {t('network.tailscaleCheck')}
            </div>
          )}
          {loaded && !error && !self && (
            <div className="border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3">
              {t('network.tailscaleInactive')} <code className="text-ink">sudo tailscale up</code>{' '}
              {t('network.tailscaleInactiveSuffix')}
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
          <h2 className="m-0 mb-3 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
            {t('network.peers')}
          </h2>

          {loaded && peers.length === 0 && !error && (
            <div className="border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3">
              {t('network.noPeers')}{' '}
              <a
                href="https://login.tailscale.com/admin/invite"
                target="_blank"
                rel="noreferrer"
                className="text-ink underline"
              >
                tailscale.com/admin/invite
              </a>
              .
            </div>
          )}

          {loaded && peers.length > 0 && (
            <div className="border border-line bg-bg-1 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left px-4 py-3 font-mono text-xs text-ink-3 uppercase tracking-[.08em] whitespace-nowrap">
                      {t('network.colDevice')}
                    </th>
                    <th className="text-left px-4 py-3 font-mono text-xs text-ink-3 uppercase tracking-[.08em] whitespace-nowrap">
                      {t('network.colIp')}
                    </th>
                    <th className="text-left px-4 py-3 font-mono text-xs text-ink-3 uppercase tracking-[.08em] whitespace-nowrap">
                      {t('network.colOs')}
                    </th>
                    <th className="text-left px-4 py-3 font-mono text-xs text-ink-3 uppercase tracking-[.08em] whitespace-nowrap">
                      {t('network.colStatus')}
                    </th>
                    <th className="text-left px-4 py-3 font-mono text-xs text-ink-3 uppercase tracking-[.08em] whitespace-nowrap">
                      {t('network.colLastSeen')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {peers.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusDot online={p.online} />
                          <span className="font-mono text-sm text-ink">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-2">{p.ip ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-3 capitalize">
                        {p.os ?? '—'}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs"
                        style={{ color: p.online ? 'var(--green)' : 'var(--ink-3)' }}
                      >
                        {p.online ? t('network.online') : t('network.offline')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-3 whitespace-nowrap">
                        {p.online ? '—' : formatLastSeen(p.lastSeen, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* How to join */}
        <section>
          <h2 className="m-0 mb-3 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
            {t('network.howToInvite')}
          </h2>
          <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3 font-mono text-xs text-ink-2">
            <p className="m-0">
              {t('network.step1pre')}{' '}
              <a
                href="https://login.tailscale.com/admin/invite"
                target="_blank"
                rel="noreferrer"
                className="text-ink underline"
              >
                tailscale.com/admin/invite
              </a>{' '}
              {t('network.step1post')}
            </p>
            <p className="m-0">{t('network.step2')}</p>
            <p className="m-0">{t('network.step3')}</p>
            <p className="m-0 text-ink-3">
              {t('network.removeAccess')}{' '}
              <a
                href="https://login.tailscale.com/admin/machines"
                target="_blank"
                rel="noreferrer"
                className="text-ink-2 underline"
              >
                tailscale.com/admin/machines
              </a>{' '}
              {t('network.removeAccessPost')}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
