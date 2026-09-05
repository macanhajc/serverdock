import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusDot } from '../../../components/core/StatusDot';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { GlobalStatsCard } from './components/GlobalStatsCard';
import { OsInfoCard } from './components/OsInfoCard';
import { NetworkCard } from './components/NetworkCard';
import { ServersSummaryBar } from './components/ServersSummaryBar';
import { ServersTable } from './components/ServersTable';
import { useServers } from './hooks/useServers';
import { useHostHealth } from './hooks/useHostHealth';
import { useVpnStatus } from './hooks/useVpnStatus';
import { useServerAction } from './hooks/useServerAction';
import { useServerSocketSync } from './hooks/useServerSocketSync';
import { useServerStats } from './hooks/useServerStats';
import { useImportGame } from './hooks/useImportGame';

interface DashboardMainProps {
  navigate: (path: string) => void;
}

export function DashboardMain({ navigate }: DashboardMainProps) {
  const { t } = useTranslation();
  const { hasPermission, socketConnected } = useAuth();
  const { addToast } = useToast();
  const [confirmWipe, setConfirmWipe] = useState<{ id: string; name: string } | null>(null);

  const serversQuery = useServers();
  const healthQuery = useHostHealth();
  const vpnQuery = useVpnStatus();
  const { actionLoading, callAction, onStatusSettled } = useServerAction();
  const { pullProgress } = useServerSocketSync(onStatusSettled);
  const importGame = useImportGame();

  const servers = serversQuery.data ?? [];
  const loaded = !serversQuery.isLoading;
  const loadError = serversQuery.isError;
  const { serverStats, serverStatsHistory } = useServerStats(servers);

  const health = healthQuery.data;
  const hostOs = health?.hostOs ?? null;

  const vpnStatus = vpnQuery.data ?? null;
  const vpnLoaded = !vpnQuery.isLoading;
  const usersOnline = (vpnQuery.data?.peers ?? []).filter(
    (p) => p.online && !p.name.includes('proxy')
  ).length;

  // Config + Dockerfile only — no data/, matches the shape produced by a
  // game's own Export button. Lands on the edit form so the admin can review
  // it (and rebuild the image / re-upload an avatar) before it goes live.
  async function handleImportFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    let bundle: unknown;
    try {
      bundle = JSON.parse(text);
    } catch {
      addToast(t('adminDashboard.importInvalidFile'), 'error');
      return;
    }
    importGame.mutate(bundle, {
      onSuccess: (data) => {
        addToast(t('adminDashboard.importSuccess', { id: data.id }));
        navigate(`/admin/servers/${data.id}/edit`);
      },
      onError: (err) => {
        addToast(
          err instanceof Error && err.message ? err.message : t('adminDashboard.importFailed'),
          'error'
        );
      },
    });
  }

  const onlineCount = servers.filter((s) => s.status === 'running').length;
  const totalCount = servers.length;

  return (
    <>
      <header className="container px-6 py-6 space-y-4">
        {hostOs && <OsInfoCard hostOs={hostOs} />}

        <NetworkCard status={vpnStatus} loaded={vpnLoaded} navigate={navigate} />

        <GlobalStatsCard
          servers={servers}
          serverStats={serverStats}
          hostTotalMem={health?.hostTotalMem ?? null}
          hostCpuCount={health?.hostCpuCount ?? null}
          hostCpuModel={health?.hostCpuModel ?? null}
          hostDisk={health?.hostDisk ?? null}
        />
      </header>

      <section className="p-6 border-t border-line flex-1 bg-bg-1/70 flex-1 flex flex-col gap-4 overflow-hidden">
        <ServersSummaryBar
          onlineCount={onlineCount}
          totalCount={totalCount}
          usersOnline={usersOnline}
          canImport={hasPermission('games:create')}
          importing={importGame.isPending}
          onImportFile={handleImportFile}
          onAddGame={() => navigate('/admin/servers/new')}
        />

        <ServersTable
          servers={servers}
          loaded={loaded}
          loadError={loadError}
          serverStats={serverStats}
          serverStatsHistory={serverStatsHistory}
          pullProgress={pullProgress}
          actionLoading={actionLoading}
          navigate={navigate}
          onAction={callAction}
          onWipeRequest={(id, name) => setConfirmWipe({ id, name })}
          onRetry={() => serversQuery.refetch()}
        />

        <div className="flex items-center justify-between text-xs text-ink-3 font-mono pt-1">
          <div className="flex items-center gap-2">
            <StatusDot online={socketConnected} />
            <span>
              {socketConnected
                ? t('adminDashboard.daemonConnected', { host: window.location.host })
                : t('adminDashboard.daemonDisconnected')}
            </span>
          </div>
          <div>{t('adminDashboard.totalInstances', { count: totalCount })}</div>
        </div>
      </section>

      {confirmWipe && (
        <ConfirmModal
          title={t('adminDashboard.resetTitle')}
          message={t('adminDashboard.resetMessage', { name: confirmWipe.name })}
          confirmLabel={t('adminDashboard.resetConfirm')}
          onConfirm={() => {
            callAction(confirmWipe.id, 'reset');
            setConfirmWipe(null);
          }}
          onCancel={() => setConfirmWipe(null)}
        />
      )}
    </>
  );
}
