import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, Plus, Refresh, Server as ServerIcon, Sliders, Upload, WarningDiamond } from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import socket from '../../../socket';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { PageHeader } from '../../../components/core/PageHeader';
import { STABLE, sortOnlineFirst } from '../../../utils/serverStatus';
import type {
  Server,
  ServerStats,
  HostDisk,
  PullProgress,
  VpnStatus,
  ResourceAlert,
  CrashInfo,
  ActionFailureInfo,
} from '../../../types';
import { GlobalStatsCard } from './components/GlobalStatsCard';
import { OsInfoCard } from './components/OsInfoCard';
import { NetworkCard } from './components/NetworkCard';
import { MonitoringRowSkeleton } from './components/MonitoringRowSkeleton';
import { MonitoringRow } from './components/MonitoringRow';
import { Button } from '../../../components';

interface DashboardMainProps {
  navigate: (path: string) => void;
}

export function DashboardMain({ navigate }: DashboardMainProps) {
  const { t } = useTranslation();
  const { token, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [serverStats, setServerStats] = useState<Record<string, ServerStats>>({});
  const [serverStatsHistory, setServerStatsHistory] = useState<
    Record<string, { cpu: number[]; mem: number[] }>
  >({});
  const [pullProgress, setPullProgress] = useState<Record<string, PullProgress>>({});
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [confirmWipe, setConfirmWipe] = useState<{ id: string; name: string } | null>(null);
  const [hostTotalMem, setHostTotalMem] = useState<number | null>(null);
  const [hostCpuCount, setHostCpuCount] = useState<number | null>(null);
  const [hostCpuModel, setHostCpuModel] = useState<string | null>(null);
  const [hostDisk, setHostDisk] = useState<HostDisk | null>(null);
  const [hostOs, setHostOs] = useState<{
    type: string;
    release: string;
    arch: string;
    hostname: string;
    uptime: number;
  } | null>(null);
  const [usersOnline, setUsersOnline] = useState(0);
  const [vpnStatus, setVpnStatus] = useState<VpnStatus | null>(null);
  const [vpnLoaded, setVpnLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const subscribedIds = useRef(new Set<string>());
  // Fallback per action in case the socket status:update never arrives (e.g. a
  // dropped connection right after a successful action) — without this the
  // button stays stuck in a loading state forever.
  const actionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(
    () => () => {
      Object.values(actionTimers.current).forEach(clearTimeout);
    },
    []
  );

  const clearActionTimer = useCallback((id: string) => {
    clearTimeout(actionTimers.current[id]);
    delete actionTimers.current[id];
  }, []);

  function loadServers() {
    fetch('/api/servers')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Server[]) => {
        setServers(data);
        setLoadError(false);
        setLoaded(true);
      })
      .catch(() => {
        setLoadError(true);
        setLoaded(true);
      });
  }

  // Config + Dockerfile only — no data/, matches the shape produced by a
  // game's own Export button. Lands on the edit form so the admin can review
  // it (and rebuild the image / re-upload an avatar) before it goes live.
  async function handleImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let bundle: unknown;
      try {
        bundle = JSON.parse(text);
      } catch {
        addToast(t('adminDashboard.importInvalidFile'), 'error');
        return;
      }
      const res = await fetch('/api/games/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        addToast(t('adminDashboard.importSuccess', { id: data.id }));
        navigate(`/admin/servers/${data.id}/edit`);
      } else {
        addToast(data.error ?? t('adminDashboard.importFailed'), 'error');
      }
    } catch {
      addToast(t('adminDashboard.importFailed'), 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  const callAction = useCallback(
    async (id: string, action: 'start' | 'stop' | 'restart' | 'reset') => {
      setLoading((prev) => ({ ...prev, [id]: action }));
      const labels: Record<string, string> = {
        start: t('adminDashboard.actionStart'),
        stop: t('adminDashboard.actionStop'),
        restart: t('adminDashboard.actionRestart'),
        reset: t('adminDashboard.actionReset'),
      };
      try {
        const body = action === 'reset' ? { confirm: true } : {};
        const res = await fetch(`/api/servers/${id}/${action}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          addToast(labels[action] ?? 'Done');
          if (action === 'reset') {
            fetch(`/api/servers/${id}`)
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((updated: Server) => {
                setServers((prev) =>
                  prev.map((s) => (s.id === id ? { ...s, diskUsed: updated.diskUsed } : s))
                );
              })
              .catch(() => {});
          }
          clearActionTimer(id);
          actionTimers.current[id] = setTimeout(() => {
            fetch(`/api/servers/${id}`)
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((updated: Server) => {
                setServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
              })
              .catch(() => {})
              .finally(() => {
                delete actionTimers.current[id];
                setLoading((prev) => {
                  const n = { ...prev };
                  delete n[id];
                  return n;
                });
              });
          }, 15_000);
        } else {
          const data = await res.json().catch(() => ({}));
          addToast(data.error ?? `${action} failed`, 'error');
          setLoading((prev) => {
            const n = { ...prev };
            delete n[id];
            return n;
          });
        }
      } catch {
        addToast(`${action} failed — could not reach server`, 'error');
        setLoading((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
    },
    [token, t, addToast, clearActionTimer]
  );

  const onWipeRequest = useCallback((id: string, name: string) => setConfirmWipe({ id, name }), []);

  // Toggled via direct DOM manipulation (not React state) so a scroll tick
  // never re-renders the table — the sticky first column's shadow is driven
  // purely by CSS off this class.
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    e.currentTarget.classList.toggle('is-scrolled', e.currentTarget.scrollLeft > 0);
  }, []);

  useEffect(() => {
    function onStatusUpdate({
      id,
      status,
      players,
    }: {
      id: string;
      status: Server['status'];
      players: number | null;
    }) {
      setServers((prev) =>
        prev.map((s) =>
          s.id === id
            ? // null players on a non-running server means "no players", not "unknown"
              { ...s, status, players: status === 'running' ? (players ?? s.players) : players }
            : s
        )
      );
      if (status !== 'pulling') {
        setPullProgress((prev) => {
          if (!(id in prev)) return prev;
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
      if (STABLE.includes(status)) {
        clearActionTimer(id);
        setLoading((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
    }
    function onPullProgress({ id, phase, percent }: PullProgress & { id: string }) {
      setPullProgress((prev) => ({ ...prev, [id]: { phase, percent } }));
    }
    function onStatusAll(
      snapshot: Array<{
        id: string;
        status: Server['status'];
        players: number | null;
        resourceAlert?: ResourceAlert | null;
        lastCrash?: CrashInfo | null;
        actionFailure?: ActionFailureInfo | null;
      }>
    ) {
      setServers((prev) => {
        const map = new Map(snapshot.map((u) => [u.id, u]));
        return prev.map((s) => {
          const u = map.get(s.id);
          if (!u) return s;
          const players = u.status === 'running' ? (u.players ?? s.players) : u.players;
          return {
            ...s,
            status: u.status,
            players,
            resourceAlert: u.resourceAlert ?? null,
            lastCrash: u.lastCrash ?? null,
            actionFailure: u.actionFailure ?? null,
          };
        });
      });
    }

    // Sustained high CPU/memory — persists until usage normalizes; see
    // statusBus.emitResourceAlert.
    function onResourceUpdate({ id: rid, alert }: { id: string; alert: ResourceAlert | null }) {
      setServers((prev) => prev.map((s) => (s.id === rid ? { ...s, resourceAlert: alert } : s)));
    }

    // Last unexpected-exit info — persists until the next successful start
    // (or a reset); see statusBus.emitCrashUpdate.
    function onCrashUpdate({ id: cid, info }: { id: string; info: CrashInfo | null }) {
      setServers((prev) => prev.map((s) => (s.id === cid ? { ...s, lastCrash: info } : s)));
    }

    // Failed start/restart attempt — persists until the next successful
    // start; see statusBus.emitActionFailure.
    function onActionFailureUpdate({
      id: fid,
      failure,
    }: {
      id: string;
      failure: ActionFailureInfo | null;
    }) {
      setServers((prev) => prev.map((s) => (s.id === fid ? { ...s, actionFailure: failure } : s)));
    }

    // Player count/list can change without a status transition (players
    // joining a still-running server) — see statusBus.emitPlayers.
    function onPlayersUpdate({
      id,
      players,
      playerList,
    }: {
      id: string;
      players: number | null;
      playerList: string | null;
    }) {
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, players, playerList } : s)));
    }

    socket.on('status:update', onStatusUpdate);
    socket.on('status:all', onStatusAll);
    socket.on('players:update', onPlayersUpdate);
    socket.on('resource:update', onResourceUpdate);
    socket.on('crash:update', onCrashUpdate);
    socket.on('action_failure:update', onActionFailureUpdate);
    socket.on('pull:progress', onPullProgress);
    // join:status refreshes the snapshot; room membership is kept by ServerEventsBridge
    socket.emit('join:status');

    loadServers();

    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (data: {
          hostTotalMem?: number;
          hostCpuCount?: number;
          hostCpuModel?: string;
          hostDisk?: HostDisk;
          hostOs?: {
            type: string;
            release: string;
            arch: string;
            hostname: string;
            uptime: number;
          };
        }) => {
          if (data.hostTotalMem) setHostTotalMem(data.hostTotalMem);
          if (data.hostCpuCount) setHostCpuCount(data.hostCpuCount);
          if (data.hostCpuModel) setHostCpuModel(data.hostCpuModel);
          if (data.hostDisk) setHostDisk(data.hostDisk);
          if (data.hostOs) setHostOs(data.hostOs);
        }
      )
      .catch(() => {});

    return () => {
      socket.off('status:update', onStatusUpdate);
      socket.off('status:all', onStatusAll);
      socket.off('players:update', onPlayersUpdate);
      socket.off('resource:update', onResourceUpdate);
      socket.off('crash:update', onCrashUpdate);
      socket.off('action_failure:update', onActionFailureUpdate);
      socket.off('pull:progress', onPullProgress);
    };
  }, []);

  // "Players online" is the count of the active network provider's peers
  // currently connected — the only always-available presence signal
  // (per-game A2S player counts only exist for a handful of Steam/Source
  // titles). Empty/zero when the provider is 'manual' (no peer concept).
  useEffect(() => {
    function fetchVpnStatus() {
      fetch('/api/vpn/status', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: VpnStatus) => {
          setUsersOnline(data.peers.filter((p) => p.online && !p.name.includes('proxy')).length);
          setVpnStatus(data);
          setVpnLoaded(true);
        })
        .catch(() => setVpnLoaded(true));
    }
    fetchVpnStatus();
    const interval = setInterval(fetchVpnStatus, 30_000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const runningIds = new Set(servers.filter((s) => s.status === 'running').map((s) => s.id));

    for (const id of runningIds) {
      if (!subscribedIds.current.has(id)) {
        socket.emit('join:stats', { id });
        subscribedIds.current.add(id);
      }
    }

    for (const id of [...subscribedIds.current]) {
      if (!runningIds.has(id)) {
        socket.emit('leave:stats', { id });
        subscribedIds.current.delete(id);
        setServerStats((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setServerStatsHistory((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }, [servers]);

  useEffect(() => {
    function onStatsUpdate({
      id,
      cpu,
      memUsed,
      memLimit,
      netInRate,
      netOutRate,
    }: ServerStats & { id: string }) {
      setServerStats((prev) => ({
        ...prev,
        [id]: { cpu, memUsed, memLimit, netInRate, netOutRate },
      }));
    }
    // Server-side streams die with the connection — re-join after a reconnect
    function rejoinStats() {
      for (const id of subscribedIds.current) {
        socket.emit('join:stats', { id });
      }
    }
    socket.on('stats:update', onStatsUpdate);
    socket.on('connect', rejoinStats);
    return () => {
      socket.off('stats:update', onStatsUpdate);
      socket.off('connect', rejoinStats);
      for (const id of subscribedIds.current) {
        socket.emit('leave:stats', { id });
      }
      subscribedIds.current.clear();
    };
  }, []);

  const onlineCount = servers.filter((s) => s.status === 'running').length;
  const totalCount = servers.length;

  return (
    <>
      <PageHeader
        title={t('adminDashboard.title')}
        subtitle={t('adminDashboard.subtitle', { count: servers.length, online: onlineCount })}
      />

      <div className="px-6 mt-6 container">
        <div className="mb-2 flex items-center gap-2">
          <Sliders width={15} height={15} className="text-ink-2" />
          <span className="text-base text-ink-2 uppercase font-mono">
            {t('serverDetail.infoSectionResources')}
          </span>
        </div>

        {hostOs && <OsInfoCard hostOs={hostOs} />}
        <NetworkCard status={vpnStatus} loaded={vpnLoaded} navigate={navigate} />

        <GlobalStatsCard
          servers={servers}
          serverStats={serverStats}
          hostTotalMem={hostTotalMem}
          hostCpuCount={hostCpuCount}
          hostCpuModel={hostCpuModel}
          hostDisk={hostDisk}
        />
      </div>

      <div className="border-t border-line mx-6 my-6" />

      <div className="px-6 pb-8 container overflow-hidden">
        <div className="mb-2 flex items-center gap-2">
          <ServerIcon width={15} height={15} className="text-ink-2" />
          <span className="text-base text-ink-2 uppercase font-mono">{t('servers.title')}</span>
        </div>

        <div className="flex flex-row justify-between items-center border border-line bg-bg-1 px-5 py-4 mb-6">
          <div className="flex flex-1 items-center gap-8">
            <div className="flex flex-col flex-1">
              <div className="font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
                {t('adminDashboard.serversCardLabel')}
              </div>
              <div className="flex flex-1 items-baseline gap-2">
                <span className="text-[26px] font-bold tabular-nums leading-none">
                  {onlineCount}
                </span>
                <span className="font-mono text-sm text-ink-3">
                  {t('adminDashboard.onlineOfTotal', { total: totalCount })}
                </span>
              </div>
            </div>

            <div className="border-l border-line pl-8">
              <div className="font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
                {t('adminDashboard.playersCardLabel')}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold tabular-nums leading-none">
                  {usersOnline}
                </span>
                <span className="font-mono text-sm text-ink-3">
                  {t('adminDashboard.playersOnline')}
                </span>
              </div>
            </div>
          </div>

          {hasPermission('games:create') && (
            <div className="flex flex-1 justify-end gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
              <Button
                variant="ghost"
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
              >
                <Upload width={12} height={12} className="mr-1.5" />
                {importing ? t('adminDashboard.importing') : t('adminDashboard.importGame')}
              </Button>
              <Button variant="primary" onClick={() => navigate('/admin/servers/new')}>
                <Plus width={12} height={12} className="mr-1.5" />
                {t('adminDashboard.addGame')}
              </Button>
            </div>
          )}
        </div>

        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className="border border-line bg-bg-1 overflow-x-auto"
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
              <tr className="bg-bg-2">
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
                    className={`px-4 py-2.5 border-r border-b border-line-2 font-mono text-[11px] font-normal last:border-r-0 text-ink-3 uppercase tracking-wider sticky top-0 z-20 bg-bg-2${
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
                    actionLoading={loading[server.id]}
                    onAction={callAction}
                    onWipeRequest={onWipeRequest}
                  />
                ))}

              {loaded && loadError && servers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10">
                    <div className="flex items-center gap-4">
                      <span
                        className="inline-flex items-center gap-1.5 font-mono text-xs"
                        style={{ color: 'var(--red)' }}
                      >
                        <WarningDiamond width={13} height={13} />
                        {t('adminDashboard.loadFailed')}
                      </span>
                      <Button size="sm" onClick={loadServers}>
                        <Refresh width={12} height={12} className="mr-1.5" />
                        {t('adminDashboard.retry')}
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {loaded && !loadError && servers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10">
                    <div className="flex flex-col items-center gap-2 font-mono text-xs text-ink-3">
                      <Inbox width={22} height={22} />
                      {t('adminDashboard.noServers')}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
