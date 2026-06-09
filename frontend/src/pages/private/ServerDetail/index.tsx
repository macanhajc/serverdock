/* eslint-disable no-empty */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import socket from '../../../socket';
import { Tabs } from '../../../components/navigation/Tabs';
import { StatusBadge } from '../../../components/core/StatusBadge';
import { Button } from '../../../components/core/Button';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { STABLE, toUiStatus } from '../../../utils/serverStatus';
import { fmtBytes } from '../../../utils/format';
import type { Server, ServerStats, LogLine } from '../../../types';
import { InfoTab } from './components/InfoTab';
import { LogsTab } from './components/LogsTab';
import { ConsoleTab } from './components/ConsoleTab';
import { FilesTab } from './components/FilesTab';
import { ScheduleTab } from './components/ScheduleTab';
import { BackupTab } from './components/BackupTab';

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

function nowTs(): string {
  return new Date().toTimeString().slice(0, 8);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

function Sparkline({ data, width = 160, height = 28 }: SparklineProps) {
  if (data.length < 2) return <div style={{ width, height }} className="shrink-0" />;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = ((i / (data.length - 1)) * width).toFixed(1);
      const y = (height - (v / max) * (height - 2) - 1).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="shrink-0 opacity-70">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── ServerDetail ─────────────────────────────────────────────────────────────

export default function ServerDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [server, setServer] = useState<Server | null>(null);
  const [actionLoading, setAL] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const prevStatus = useRef<string>('running');

  const [tab, setTab] = useState('info');

  const [lines, setLines] = useState<LogLine[]>([]);
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [autoscroll, setAutoscroll] = useState(true);
  const termRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);

  // ── load server ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/servers/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Server) => {
        setServer(data);
        prevStatus.current = data.status;
      })
      .catch(() => {});
  }, [id, token]);

  // ── socket: status + logs ─────────────────────────────────────────────────
  useEffect(() => {
    function onStatusUpdate({
      id: sid,
      status,
      players,
    }: {
      id: string;
      status: Server['status'];
      players: number | null;
    }) {
      if (sid !== id) return;
      const was = prevStatus.current;
      prevStatus.current = status;
      setServer((prev) => (prev ? { ...prev, status, players: players ?? prev.players } : prev));
      if (STABLE.includes(status)) setAL(null);
      if (status === 'running' && was !== 'running') {
        socket.emit('leave:logs', { id });
        socket.emit('join:logs', { id });
        socket.emit('leave:stats', { id });
        socket.emit('join:stats', { id });
        setCpuHistory([]);
      }
      if (was === 'running' && status !== 'running') {
        setStats(null);
        setCpuHistory([]);
      }
    }
    function onLogLine({
      id: lid,
      line,
      level,
    }: {
      id: string;
      line: string;
      level?: string;
    }) {
      if (lid !== id) return;
      setLines((prev) => [
        ...prev,
        { ts: nowTs(), level: (level ?? 'info').toUpperCase(), line: stripAnsi(line) },
      ]);
    }
    function onLogEnd({ id: lid }: { id: string }) {
      if (lid !== id) return;
      setLines((prev) => [
        ...prev,
        { ts: nowTs(), level: 'DEBUG', line: t('serverDetail.containerStopped') },
      ]);
      setAL(null);
    }

    function onCrashAlert({ id: cid, name }: { id: string; name: string }) {
      if (cid !== id) return;
      addToast(`${name} crashed unexpectedly`, 'error');
    }

    socket.on('status:update', onStatusUpdate);
    socket.on('log:line', onLogLine);
    socket.on('log:end', onLogEnd);
    socket.on('crash:alert', onCrashAlert);
    socket.emit('join:logs', { id });
    socket.emit('join:status');

    return () => {
      socket.off('status:update', onStatusUpdate);
      socket.off('log:line', onLogLine);
      socket.off('log:end', onLogEnd);
      socket.off('crash:alert', onCrashAlert);
      socket.emit('leave:logs', { id });
      socket.emit('leave:status');
    };
  }, [id, t, addToast]);

  // ── socket: stats ─────────────────────────────────────────────────────────
  useEffect(() => {
    function onStatsUpdate({
      id: sid,
      cpu,
      memUsed,
      memLimit,
      netInRate,
      netOutRate,
    }: ServerStats & { id: string }) {
      if (sid !== id) return;
      setStats({ cpu, memUsed, memLimit, netInRate, netOutRate });
      setCpuHistory((prev) => {
        const next = [...prev, cpu];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });
    }

    socket.on('stats:update', onStatsUpdate);
    socket.emit('join:stats', { id });

    return () => {
      socket.off('stats:update', onStatsUpdate);
      socket.emit('leave:stats', { id });
    };
  }, [id]);

  // ── autoscroll logs ───────────────────────────────────────────────────────
  useEffect(() => {
    if (autoscroll && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines, autoscroll]);

  // ── actions ───────────────────────────────────────────────────────────────
  async function callAction(action: 'start' | 'stop' | 'restart' | 'reset') {
    setAL(action);
    setActionError(null);
    const labels: Record<string, string> = {
      start: t('serverDetail.actionStart'),
      stop: t('serverDetail.actionStop'),
      restart: t('serverDetail.actionRestart'),
      reset: t('serverDetail.actionReset'),
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
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error ?? `${action} failed`);
        setAL(null);
      }
    } catch {
      setActionError(`${action} failed — could not reach server`);
      setAL(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (!server) {
    return <div className="p-6 font-mono text-xs text-ink-3">{t('common.loading')}</div>;
  }

  const { name, status, connection, image, rcon } = server;
  const isNotCreated = status === 'stopped' || status === 'not_created' || status === 'error';
  const isRunning = status === 'running';
  const busy = !!actionLoading;

  return (
    <div className="flex container flex-col h-screen">
      {/* ── Detail head ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 py-4 px-6 border-b border-line bg-bg-1 flex-none">
        <button
          onClick={() => navigate('/admin')}
          className="bg-bg-2 border border-line-2 text-ink-2 px-3 py-2 font-mono text-xs cursor-pointer flex-none"
        >
          {t('serverDetail.back')}
        </button>
        <div className="min-w-0">
          <div className="text-4 font-bold leading-tight">{name}</div>
          <div className="font-mono text-xs text-ink-3 mt-0.5 truncate">
            {id} · {connection?.host}:{connection?.port} · {image}
          </div>
        </div>
        <StatusBadge status={toUiStatus(status)} className="shrink-0" />
        <div className="ml-auto flex gap-1.5 flex-none">
          <Button
            size="sm"
            variant="primary"
            disabled={!isNotCreated || busy}
            onClick={() => callAction('start')}
          >
            {t('serverDetail.actStart')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={!isRunning || busy}
            onClick={() => callAction('stop')}
          >
            {t('serverDetail.actStop')}
          </Button>
          <Button size="sm" disabled={!isRunning || busy} onClick={() => callAction('restart')}>
            {t('serverDetail.actRestart')}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => setConfirmReset(true)}>
            {t('serverDetail.actReset')}
          </Button>
        </div>
      </div>

      {/* ── Action error banner ───────────────────────────────────────────── */}
      {actionError && (
        <div
          className="flex items-center gap-2 px-4 py-2.25 border-b border-line font-mono text-[11.5px] text-red flex-none"
          style={{ background: 'color-mix(in oklab, var(--red) 8%, transparent)' }}
        >
          <span>✕</span>
          <span className="flex-1">{actionError}</span>
          <button
            className="text-ink-3 hover:text-ink cursor-pointer"
            onClick={() => setActionError(null)}
          >
            {t('serverDetail.dismiss')}
          </button>
        </div>
      )}

      {/* ── Resources panel ───────────────────────────────────────────────── */}
      {stats && (
        <div className="border-b border-line flex-none bg-bg-1">
          <div
            className="flex items-center gap-4 px-6 py-2.5 cursor-pointer hover:bg-bg-2 select-none"
            onClick={() => setStatsOpen((v) => !v)}
          >
            <span className="font-mono text-xs text-ink-3 flex-none">
              Resources {statsOpen ? '▾' : '▸'}
            </span>
            {!statsOpen && (
              <>
                <span className="font-mono text-xs text-ink-3">
                  CPU <span className="text-ink">{stats.cpu.toFixed(1)}%</span>
                </span>
                <span className="font-mono text-xs text-ink-3">
                  RAM{' '}
                  <span className="text-ink">
                    {fmtBytes(stats.memUsed)}
                    {stats.memLimit ? ` / ${fmtBytes(stats.memLimit)}` : ''}
                  </span>
                </span>
                <span className="font-mono text-xs text-ink-3">
                  Net ↓ <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span> ↑{' '}
                  <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
                </span>
                <span className="font-mono text-xs text-ink-3">
                  Disk <span className="text-ink">{fmtBytes(server.diskUsed ?? 0)}</span>
                </span>
              </>
            )}
          </div>

          {statsOpen && (
            <div className="px-6 pt-1 pb-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-ink-3 w-10 shrink-0">CPU</span>
                <div className="flex-1 h-1.5 relative" style={{ background: 'var(--line-2)' }}>
                  <div
                    className="absolute inset-y-0 left-0 transition-[width] duration-500"
                    style={{ width: `${Math.min(stats.cpu, 100)}%`, background: 'var(--accent)' }}
                  />
                </div>
                <span className="font-mono text-xs text-ink w-12 text-right shrink-0">
                  {stats.cpu.toFixed(1)}%
                </span>
                <Sparkline data={cpuHistory} />
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-ink-3 w-10 shrink-0">RAM</span>
                {stats.memLimit ? (
                  <>
                    <div className="flex-1 h-1.5 relative" style={{ background: 'var(--line-2)' }}>
                      <div
                        className="absolute inset-y-0 left-0 transition-[width] duration-500"
                        style={{
                          width: `${Math.min((stats.memUsed / stats.memLimit) * 100, 100)}%`,
                          background:
                            stats.memUsed / stats.memLimit > 0.8
                              ? 'var(--yellow)'
                              : 'var(--accent)',
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ink w-12 text-right shrink-0">
                      {((stats.memUsed / stats.memLimit) * 100).toFixed(0)}%
                    </span>
                    <span className="font-mono text-xs text-ink-3 shrink-0">
                      {fmtBytes(stats.memUsed)} / {fmtBytes(stats.memLimit)}
                    </span>
                  </>
                ) : (
                  <span className="font-mono text-xs text-ink">{fmtBytes(stats.memUsed)}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-ink-3 w-10 shrink-0">Net</span>
                <span className="font-mono text-xs text-ink-3">
                  ↓ <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
                </span>
                <span className="font-mono text-xs text-ink-3">
                  ↑ <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
                </span>
              </div>

              <div className="flex flex-row gap-3">
                <span className="font-mono text-xs text-ink-3 w-10 shrink-0">Disk</span>
                <span className="font-mono text-xs text-ink shrink-0">
                  {fmtBytes(server.diskUsed ?? 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <Tabs
        tabs={[
          { label: t('serverDetail.tabInfo'), value: 'info' },
          { label: t('serverDetail.tabLogs'), value: 'logs' },
          { label: t('serverDetail.tabConsole'), value: 'console' },
          { label: t('serverDetail.tabFiles'), value: 'files' },
          { label: t('serverDetail.tabSchedule'), value: 'schedule' },
          { label: t('serverDetail.tabBackups'), value: 'backups' },
        ]}
        value={tab}
        onChange={setTab}
        className="shrink-0"
      />

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {tab === 'info' && <InfoTab server={server} id={id!} stats={stats} cpuHistory={cpuHistory} />}
        {tab === 'logs' && (
          <LogsTab
            id={id!}
            lines={lines}
            setLines={setLines}
            levelFilter={levelFilter}
            setLevelFilter={setLevelFilter}
            autoscroll={autoscroll}
            setAutoscroll={setAutoscroll}
            termRef={termRef}
          />
        )}
        {tab === 'console' && (
          <ConsoleTab id={id!} token={token} isRunning={isRunning} rcon={rcon} />
        )}
        {tab === 'files' && <FilesTab id={id!} token={token} />}
        {tab === 'schedule' && <ScheduleTab id={id!} token={token} />}
        {tab === 'backups' && <BackupTab id={id!} token={token} />}
      </div>

      {confirmReset && (
        <ConfirmModal
          title={t('serverDetail.resetTitle')}
          message={t('serverDetail.resetMessage', { name })}
          confirmLabel={t('serverDetail.resetConfirm')}
          onConfirm={() => {
            callAction('reset');
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
