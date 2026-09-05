import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, Refresh, WarningDiamond } from 'pixelarticons/react';
import { Button } from '../../../../components';
import { sortOnlineFirst } from '../../../../utils/serverStatus';
import type { Server, ServerStats, PullProgress } from '../../../../types';
import { MonitoringRow } from './MonitoringRow';
import { MonitoringRowSkeleton } from './MonitoringRowSkeleton';

type Action = 'start' | 'stop' | 'restart' | 'reset';

export function ServersTable({
  servers,
  loaded,
  loadError,
  serverStats,
  serverStatsHistory,
  pullProgress,
  actionLoading,
  navigate,
  onAction,
  onWipeRequest,
  onRetry,
}: {
  servers: Server[];
  loaded: boolean;
  loadError: boolean;
  serverStats: Record<string, ServerStats>;
  serverStatsHistory: Record<string, { cpu: number[]; mem: number[] }>;
  pullProgress: Record<string, PullProgress>;
  actionLoading: Record<string, string>;
  navigate: (path: string) => void;
  onAction: (id: string, action: Action) => void;
  onWipeRequest: (id: string, name: string) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Toggled via direct DOM manipulation (not React state) so a scroll tick
  // never re-renders the table — the sticky first column's shadow is driven
  // purely by CSS off this class.
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    e.currentTarget.classList.toggle('is-scrolled', e.currentTarget.scrollLeft > 0);
  }, []);

  return (
    <div
      ref={tableScrollRef}
      onScroll={handleTableScroll}
      className="border flex flex-1 border-line bg-bg-1 overflow-x-auto"
    >
     <table
        className="border-collapse text-left"
        style={{ tableLayout: 'fixed', width: '100%', minWidth: 1590 }}
      >
        <colgroup>
          <col style={{ width: 220 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 230 }} />
          <col style={{ width: 250 }} />
          <col style={{ width: 190 }} />
        </colgroup>
        <thead>
          <tr className="bg-bg">
            {[
              t('adminDashboard.colServer'),
              t('adminDashboard.colStatus'),
              t('adminDashboard.colUptime'),
              t('adminDashboard.colPlayers'),
              t('adminDashboard.colCpu'),
              t('adminDashboard.colRam'),
              t('adminDashboard.colDisk'),
              t('adminDashboard.colNetwork'),
              t('adminDashboard.colConnect'),
              t('adminDashboard.colActions'),
            ].map((col, i) => (
              <th
                key={col}
                className={`px-4 py-2.5 border-b border-line-2 font-mono text-sm font-normal last:border-r-0 text-ink-3 uppercase tracking-wider sticky top-0 z-20 ${
                  i === 0 ? ' left-0 z-30 transition-shadow' : ''
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loaded && [1, 2, 3].map((i) => <MonitoringRowSkeleton key={i} />)}

          {loaded &&
            sortOnlineFirst(servers).map((server) => (
              <MonitoringRow
                key={server.id}
                server={server}
                stats={serverStats[server.id]}
                history={serverStatsHistory[server.id]}
                pull={pullProgress[server.id]}
                navigate={navigate}
                actionLoading={actionLoading[server.id]}
                onAction={onAction}
                onWipeRequest={onWipeRequest}
              />
            ))}

          {loaded && loadError && servers.length === 0 && (
            <tr>
              <td colSpan={10} className="px-5 py-10">
                <div className="flex items-center gap-4">
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-sm"
                    style={{ color: 'var(--red)' }}
                  >
                    <WarningDiamond width={15} height={15} />
                    {t('adminDashboard.loadFailed')}
                  </span>
                  <Button size="sm" onClick={onRetry}>
                    <Refresh width={14} height={14} className="mr-1.5" />
                    {t('adminDashboard.retry')}
                  </Button>
                </div>
              </td>
            </tr>
          )}

          {loaded && !loadError && servers.length === 0 && (
            <tr>
              <td colSpan={10} className="px-5 py-10">
                <div className="flex flex-col items-center gap-2 font-mono text-sm text-ink-3">
                  <Inbox width={24} height={24} />
                  {t('adminDashboard.noServers')}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
