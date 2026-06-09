import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import socket from '../../../socket';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { PageHeader } from '../../../components/core/PageHeader';
import { STABLE } from '../../../utils/serverStatus';
import type { Server, ServerStats, HostDisk } from '../../../types';
import { GlobalStatsCard } from './components/GlobalStatsCard';
import { OsInfoCard } from './components/OsInfoCard';
import { MonitoringRowSkeleton } from './components/MonitoringRowSkeleton';
import { MonitoringRow } from './components/MonitoringRow';
import { Button } from '../../../components';

export const COLS =
  'minmax(260px, 1fr) 100px 100px 100px 180px 110px 220px 180px minmax(185px, 1fr)';

interface DashboardMainProps {
  navigate: (path: string) => void;
}

export function DashboardMain({ navigate }: DashboardMainProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [serverStats, setServerStats] = useState<Record<string, ServerStats>>({});
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
  const subscribedIds = useRef(new Set<string>());

  async function callAction(id: string, action: 'start' | 'stop' | 'restart' | 'reset') {
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
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? `${action} failed`);
        setLoading((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
    } catch {
      addToast(`${action} failed — could not reach server`);
      setLoading((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    }
  }

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
        prev.map((s) => (s.id === id ? { ...s, status, players: players ?? s.players } : s))
      );
      if (STABLE.includes(status)) {
        setLoading((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
    }
    function onStatusAll(
      snapshot: Array<{ id: string; status: Server['status']; players: number | null }>
    ) {
      setServers((prev) => {
        const map = new Map(snapshot.map((u) => [u.id, u]));
        return prev.map((s) => {
          const u = map.get(s.id);
          return u ? { ...s, status: u.status, players: u.players ?? s.players } : s;
        });
      });
    }

    function onCrashAlert({ name }: { name: string }) {
      addToast(`${name} crashed unexpectedly`, 'error');
    }

    socket.on('status:update', onStatusUpdate);
    socket.on('status:all', onStatusAll);
    socket.on('crash:alert', onCrashAlert);
    socket.emit('join:status');

    fetch('/api/servers')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Server[]) => {
        setServers(data);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });

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
      socket.off('crash:alert', onCrashAlert);
      socket.emit('leave:status');
    };
  }, []);

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
    socket.on('stats:update', onStatsUpdate);
    return () => {
      socket.off('stats:update', onStatsUpdate);
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

      <div className="mx-6 mt-6">
        <div className="mb-2">
          <span className="text-base text-ink-2 uppercase font-mono">
            {t('serverDetail.infoSectionResources')}
          </span>
        </div>

        {hostOs && <OsInfoCard hostOs={hostOs} />}

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

      <div className="mx-6 pb-16">
        <div className="mb-2">
          <span className="text-base text-ink-2 uppercase font-mono">{t('servers.title')}</span>
        </div>

        <div className="flex flex-row justify-between items-center border border-line bg-bg-1 px-5 py-4 mb-6">
          <div>
            <div className="font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
              Servers
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-bold tabular-nums leading-none">{onlineCount}</span>
              <span className="font-mono text-sm text-ink-3">/ {totalCount} online</span>
            </div>
          </div>

          <Button variant='primary' onClick={() => navigate('/admin/servers/new')}>
            {t("adminDashboard.addGame")}
          </Button>
        </div>

        <div
          className="border border-line bg-bg-1 overflow-x-auto overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          <div
            className="grid border-b border-line-2 bg-bg-2 sticky top-0 z-10"
            style={{ gridTemplateColumns: COLS, width: 'fit-content' }}
          >
            {[
              'Server',
              'Status',
              'Players',
              'CPU (%)',
              'RAM',
              'Disk',
              'Network',
              'Connect',
              'Actions',
            ].map((col, i) => (
              <div
                key={col}
                className={`px-4 py-2.5 border-r border-line font-mono text-[11px] last:border-none text-ink-3 uppercase tracking-wider${
                  i === 0 ? ' sticky left-0 z-20 bg-bg-2' : ''
                }`}
              >
                {col}
              </div>
            ))}
          </div>

          {!loaded && [1, 2, 3].map((i) => <MonitoringRowSkeleton key={i} />)}

          {loaded &&
            servers.map((server) => (
              <MonitoringRow
                key={server.id}
                server={server}
                stats={serverStats[server.id]}
                navigate={navigate}
                actionLoading={loading[server.id]}
                onStart={() => callAction(server.id, 'start')}
                onStop={() => callAction(server.id, 'stop')}
                onRestart={() => callAction(server.id, 'restart')}
                onWipe={() => setConfirmWipe({ id: server.id, name: server.name })}
                hostTotalMem={hostTotalMem}
                hostCpuCount={hostCpuCount}
              />
            ))}

          {loaded && servers.length === 0 && (
            <div className="px-5 py-10 font-mono text-xs text-ink-3">
              {t('adminDashboard.noServers')}
            </div>
          )}
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
