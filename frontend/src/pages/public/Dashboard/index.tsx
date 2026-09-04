import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ServerCard } from '../../../components/data/ServerCard';
import { ServerCardSkeleton } from '../../../components/data/ServerCardSkeleton';
import { LangSwitcher } from '../../../components/core/LangSwitcher';
import { PageHeader } from '../../../components/core/PageHeader';
import { HowToConnectModal } from './components/HowToConnectModal';
import { useVisitorIdentify } from './hooks/useVisitorIdentify';
import { useNetworkProvider } from './hooks/useNetworkProvider';
import { useServers } from './hooks/useServers';
import { useServerSocketSync } from './hooks/useServerSocketSync';
import {
  toUiStatus,
  gameHue,
  gameMark,
  sortOnlineFirst,
  getDisplayPlayerCount,
} from '../../../utils/serverStatus';
import { timeAgo } from '../../../utils/format';

function maintenanceMinutes(at: string): number {
  return Math.max(1, Math.round((new Date(at).getTime() - Date.now()) / 60_000));
}

export default function PublicDashboard() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const { visitor, identifying } = useVisitorIdentify();
  const networkProviderQuery = useNetworkProvider();
  const serversQuery = useServers(!!visitor);
  useServerSocketSync(!!visitor);

  const networkProvider = networkProviderQuery.data?.networkProvider ?? null;
  const servers = serversQuery.data ?? [];
  const loading = identifying || serversQuery.isLoading;
  const onlineCount = servers.filter((s) => s.status === 'running').length;
  const filtered = sortOnlineFirst(
    search ? servers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())) : servers
  );

  return (
    <div className="min-h-screen bg-bg">
      {/* Topbar */}
      <header className="flex items-center gap-3.5 h-14 px-6 border-b border-line bg-bg-1">
        <div className="flex items-center gap-3">
          <span className="w-5.5 h-5.5 bg-accent grid place-items-center text-white font-bold text-sm font-mono">
            S
          </span>
          <b className="font-bold tracking-[.01em] text-[15px]">ServerDock</b>
        </div>

        {visitor && (
          <span className="ml-auto font-mono text-xs text-ink-3 border border-line px-2 py-1">
            {visitor.username}
          </span>
        )}

        <LangSwitcher />

        <Link
          to="/auth?mode=admin"
          className="ml-1 bg-(--accent-dim) border border-(--accent-edge) text-ink px-3.5 py-2 text-xs font-semibold no-underline tracking-[.02em]"
        >
          {t('publicDashboard.admin')}
        </Link>
      </header>

      <PageHeader
        title={t('publicDashboard.title')}
        subtitle={t('publicDashboard.statusLine', { count: servers.length, online: onlineCount })}
      >
        <div className="ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('publicDashboard.filterPlaceholder')}
            className="bg-bg-1 border border-line text-ink-2 px-3 py-2 text-xs font-mono w-52.5 outline-none"
          />
        </div>
      </PageHeader>

      {/* Help banner — netbird-only for now, see the networkProvider fetch above */}
      {networkProvider === 'netbird' && (
        <div
          className="flex items-center gap-3 px-6 py-3 border-b border-line flex-wrap"
          style={{ background: 'var(--accent-dim)' }}
        >
          <span className="text-accent font-bold text-[15px] shrink-0">ℹ</span>
          <span className="text-sm text-white">{t('publicDashboard.helpBannerText')}</span>
          <button
            onClick={() => setShowHelp(true)}
            className="ml-auto shrink-0 border px-3.5 py-2 text-xs font-semibold cursor-pointer bg-accent text-white border-accent tracking-[.02em]"
          >
            {t('publicDashboard.howToConnect')}
          </button>
        </div>
      )}

      {/* Card grid */}
      <div className="grid gap-6 pt-8 pb-16 px-6 grid-cols-[repeat(auto-fill,minmax(var(--card-min),1fr))] *:max-w-105">
        {filtered.map((server) => (
          <ServerCard
            key={server.id}
            name={server.name}
            engine={server.image}
            status={toUiStatus(server.status)}
            players={
              server.playerList ? (
                <span title={server.playerList}>{getDisplayPlayerCount(server) ?? '—'}</span>
              ) : (
                (getDisplayPlayerCount(server) ?? '—')
              )
            }
            connection={server.connection}
            hue={gameHue(server.id)}
            mark={gameMark(server.name)}
            source={server.imageSource === 'local' ? 'Steam' : 'Public'}
            avatarUrl={server.avatarUrl}
            storeUrl={server.storeUrl}
            pinnedEnv={server.pinnedEnv}
            lastActive={
              server.status !== 'running' && server.lastActiveAt
                ? t('publicDashboard.lastActive', { time: timeAgo(server.lastActiveAt, t) })
                : undefined
            }
          >
            {server.maintenanceSoon && (
              <div
                className="mt-3 pt-3 border-t border-line font-mono text-[11px]"
                style={{ color: 'var(--yellow)' }}
              >
                ⚠{' '}
                {t(
                  server.maintenanceSoon.action === 'stop'
                    ? 'publicDashboard.maintenanceStop'
                    : 'publicDashboard.maintenanceRestart',
                  { minutes: maintenanceMinutes(server.maintenanceSoon.at) }
                )}
              </div>
            )}
          </ServerCard>
        ))}

        {loading && Array.from({ length: 6 }, (_, i) => <ServerCardSkeleton key={i} />)}

        {!loading && filtered.length === 0 && (
          <span className="font-mono text-xs text-ink-3">
            {search ? t('publicDashboard.noMatch', { search }) : t('publicDashboard.noServers')}
          </span>
        )}
      </div>

      {showHelp && networkProvider === 'netbird' && (
        <HowToConnectModal onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}
