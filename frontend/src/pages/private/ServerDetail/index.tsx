/* eslint-disable no-empty */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleInfo,
  Cpu,
  Database,
  Folder,
  MemoryStick,
  Pencil,
  Play,
  Refresh,
  Stop,
  Terminal,
  Trash,
  Wifi,
  X,
} from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import socket from '../../../socket';
import { Tabs } from '../../../components/navigation/Tabs';
import { StatusBadge } from '../../../components/core/StatusBadge';
import { Button } from '../../../components/core/Button';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { Sparkline } from '../../../components/data/Sparkline';
import {
  STABLE,
  IN_FLIGHT,
  toUiStatus,
  gameHue,
  gameMark,
  storeLabel,
} from '../../../utils/serverStatus';
import { fmtBytes } from '../../../utils/format';
import type { Server, ServerStats, LogLine, PullProgress } from '../../../types';
import { InfoTab } from './components/InfoTab';
import { ConsoleTab } from './components/ConsoleTab';
import { FilesTab } from './components/FilesTab';
import { ScheduleTab } from './components/ScheduleTab';
import { BackupTab } from './components/BackupTab';

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

function nowTs(): string {
  return new Date().toTimeString().slice(0, 8);
}

function fmtTs(iso?: string): string {
  if (!iso) return nowTs();
  const d = new Date(iso);
  return isNaN(d.getTime()) ? nowTs() : d.toTimeString().slice(0, 8);
}

// Cap kept log lines so a chatty server left open doesn't grow memory/renders forever
const MAX_LOG_LINES = 2000;

function appendCapped(prev: LogLine[], items: LogLine[]): LogLine[] {
  const next = prev.concat(items);
  return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
}

// ─── ServerDetail ─────────────────────────────────────────────────────────────

export default function ServerDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { token, hasPermission } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [server, setServer] = useState<Server | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setAL] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pull, setPull] = useState<PullProgress | null>(null);
  const prevStatus = useRef<string>('running');
  // Fallback in case the socket status:update never arrives (e.g. a dropped
  // connection right after a successful action) — without this the action
  // buttons stay stuck disabled forever.
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(actionTimer.current), []);

  const [tab, setTab] = useState('info');

  // Container output lives here (not in the tab) so it keeps accumulating while
  // other tabs are open and survives switching between tabs.
  const [lines, setLines] = useState<LogLine[]>([]);
  // Newest docker timestamp seen — lets log:history replays skip lines we already have
  const lastLogIso = useRef<string>('');
  // Keep `t` out of the log effect's deps (react-i18next can change its identity,
  // which would needlessly re-join the room) while still reading the current value
  const tRef = useRef(t);
  tRef.current = t;

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);

  // ── load server ───────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadError(false);
    fetch(`/api/servers/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Server) => {
        setServer(data);
        prevStatus.current = data.status;
      })
      .catch(() => setLoadError(true));
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
      setServer((prev) =>
        prev
          ? { ...prev, status, players: status === 'running' ? (players ?? prev.players) : players }
          : prev
      );
      if (status !== 'pulling') setPull(null);
      if (STABLE.includes(status)) {
        clearTimeout(actionTimer.current);
        setAL(null);
      }
      if (status === 'running' && was !== 'running') {
        socket.emit('leave:logs', { id });
        socket.emit('join:logs', { id });
        socket.emit('leave:stats', { id });
        socket.emit('join:stats', { id });
        setCpuHistory([]);
        setMemHistory([]);
      }
      if (was === 'running' && status !== 'running') {
        setStats(null);
        setCpuHistory([]);
        setMemHistory([]);
      }
    }
    function onLogLine({
      id: lid,
      line,
      level,
      ts,
    }: {
      id: string;
      line: string;
      level?: string;
      ts?: string;
    }) {
      if (lid !== id) return;
      if (ts && ts > lastLogIso.current) lastLogIso.current = ts;
      setLines((prev) =>
        appendCapped(prev, [
          { ts: fmtTs(ts), level: (level ?? 'info').toUpperCase(), line: stripAnsi(line) },
        ])
      );
    }
    function onLogHistory({
      id: lid,
      lines: history,
    }: {
      id: string;
      lines: Array<{ ts: string; line: string; level?: string }>;
    }) {
      if (lid !== id) return;
      // Only lines newer than what we've already shown (re-joins replay the full buffer)
      const fresh = history.filter((l) => l.ts > lastLogIso.current);
      if (!fresh.length) return;
      lastLogIso.current = fresh[fresh.length - 1].ts;
      setLines((prev) =>
        appendCapped(
          prev,
          fresh.map((l) => ({
            ts: fmtTs(l.ts),
            level: (l.level ?? 'info').toUpperCase(),
            line: stripAnsi(l.line),
          }))
        )
      );
    }
    function onLogEnd({ id: lid }: { id: string }) {
      if (lid !== id) return;
      setLines((prev) =>
        appendCapped(prev, [
          { ts: nowTs(), level: 'DEBUG', line: tRef.current('serverDetail.containerStopped') },
        ])
      );
      clearTimeout(actionTimer.current);
      setAL(null);
    }

    function onPullProgress({ id: pid, phase, percent }: PullProgress & { id: string }) {
      if (pid !== id) return;
      setPull({ phase, percent });
    }

    // Player count/list can change without a status transition (players
    // joining a still-running server) — see statusBus.emitPlayers.
    function onPlayersUpdate({
      id: pid,
      players,
      playerList,
    }: {
      id: string;
      players: number | null;
      playerList: string | null;
    }) {
      if (pid !== id) return;
      setServer((prev) => (prev ? { ...prev, players, playerList } : prev));
    }

    // Server-side streams die with the connection — re-join after a reconnect
    function onReconnect() {
      socket.emit('join:logs', { id });
      socket.emit('join:status');
    }

    socket.on('status:update', onStatusUpdate);
    socket.on('players:update', onPlayersUpdate);
    socket.on('log:line', onLogLine);
    socket.on('log:history', onLogHistory);
    socket.on('log:end', onLogEnd);
    socket.on('pull:progress', onPullProgress);
    socket.on('connect', onReconnect);
    socket.emit('join:logs', { id });
    // join:status refreshes the snapshot; room membership is kept by ServerEventsBridge
    socket.emit('join:status');

    return () => {
      socket.off('status:update', onStatusUpdate);
      socket.off('players:update', onPlayersUpdate);
      socket.off('log:line', onLogLine);
      socket.off('log:history', onLogHistory);
      socket.off('log:end', onLogEnd);
      socket.off('pull:progress', onPullProgress);
      socket.off('connect', onReconnect);
      socket.emit('leave:logs', { id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      setMemHistory((prev) => {
        const next = [...prev, memUsed];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });
    }

    function onReconnect() {
      socket.emit('join:stats', { id });
    }

    socket.on('stats:update', onStatsUpdate);
    socket.on('connect', onReconnect);
    socket.emit('join:stats', { id });

    return () => {
      socket.off('stats:update', onStatsUpdate);
      socket.off('connect', onReconnect);
      socket.emit('leave:stats', { id });
    };
  }, [id]);

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
        clearTimeout(actionTimer.current);
        actionTimer.current = setTimeout(() => {
          fetch(`/api/servers/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((updated: Server) => setServer((prev) => (prev ? { ...prev, ...updated } : prev)))
            .catch(() => {})
            .finally(() => setAL(null));
        }, 15_000);
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

  if (loadError) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <p className="m-0 font-mono text-sm text-red">{t('serverDetail.loadFailed')}</p>
        <Button size="sm" onClick={() => navigate('/admin')}>
          <ChevronLeft width={12} height={12} className="mr-1.5" />
          {t('serverDetail.back')}
        </Button>
      </div>
    );
  }

  if (!server) {
    return <div className="p-6 font-mono text-xs text-ink-3">{t('common.loading')}</div>;
  }

  const { name, status, connection, image, rcon } = server;
  const isNotCreated = status === 'stopped' || status === 'not_created' || status === 'error';
  const isRunning = status === 'running';
  // Busy if this client has a request in flight, or any client/scheduler does
  const busy = !!actionLoading || IN_FLIGHT.includes(status);

  const badgeLabel =
    status === 'pulling' && pull
      ? `${t(pull.phase === 'extracting' ? 'status.extracting' : 'status.pulling')} ${pull.percent}%`
      : undefined;

  return (
    <div className="flex flex-col h-screen">
      {/* ── Detail head ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 py-4 px-6 border-b border-line bg-bg-1 flex-none">
        <button
          onClick={() => navigate('/admin')}
          className="inline-flex items-center gap-1.5 bg-bg-2 border border-line-2 text-ink-2 px-3 py-2 font-mono text-xs cursor-pointer flex-none"
        >
          <ChevronLeft width={12} height={12} />
          {t('serverDetail.back')}
        </button>
        {server.avatarUrl ? (
          <img
            src={server.avatarUrl}
            alt=""
            className="w-10 h-10 shrink-0 border border-line object-cover"
          />
        ) : (
          <div
            className="w-10 h-10 shrink-0 border border-line grid place-items-center font-mono text-xs font-bold"
            style={{
              color: `hsl(${gameHue(id!)} 55% 78%)`,
              background: `hsl(${gameHue(id!)} 38% 16%)`,
            }}
          >
            {gameMark(name)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-4 font-bold leading-tight">{name}</div>
          <div className="font-mono text-xs text-ink-3 mt-0.5 truncate">
            {id} · {connection?.host}:{connection?.port} · {image}
          </div>
        </div>
        <StatusBadge status={toUiStatus(status)} className="shrink-0">
          {badgeLabel}
        </StatusBadge>
        <div className="ml-auto flex gap-1.5 flex-none">
          {hasPermission('servers:power') && (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={!isNotCreated || busy}
                onClick={() => callAction('start')}
              >
                <Play width={12} height={12} className="mr-1.5" />
                {t('serverDetail.actStart')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!isRunning || busy}
                onClick={() => callAction('stop')}
              >
                <Stop width={12} height={12} className="mr-1.5" />
                {t('serverDetail.actStop')}
              </Button>
              <Button size="sm" disabled={!isRunning || busy} onClick={() => callAction('restart')}>
                <Refresh width={12} height={12} className="mr-1.5" />
                {t('serverDetail.actRestart')}
              </Button>
            </>
          )}
          {hasPermission('servers:reset') && (
            <Button size="sm" disabled={busy} onClick={() => setConfirmReset(true)}>
              <Trash width={12} height={12} className="mr-1.5" />
              {t('serverDetail.actReset')}
            </Button>
          )}
          {hasPermission('games:edit') && (
            <Button size="sm" onClick={() => navigate(`/admin/servers/${id}/edit`)}>
              <Pencil width={12} height={12} className="mr-1.5" />
              {t('serverDetail.editConfig')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Action error banner ───────────────────────────────────────────── */}
      {actionError && (
        <div
          className="flex items-center gap-2 px-4 py-2.25 border-b border-line font-mono text-[11.5px] text-red flex-none"
          style={{ background: 'color-mix(in oklab, var(--red) 8%, transparent)' }}
        >
          <X width={13} height={13} className="shrink-0" />
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
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 flex-none">
              {t('serverDetail.resources')}
              {statsOpen ? (
                <ChevronDown width={12} height={12} />
              ) : (
                <ChevronRight width={12} height={12} />
              )}
            </span>
            {!statsOpen && (
              <>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
                  <Cpu width={11} height={11} /> <span className="text-ink">{stats.cpu.toFixed(1)}%</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
                  <MemoryStick width={11} height={11} />
                  <span className="text-ink">
                    {fmtBytes(stats.memUsed)}
                    {stats.memLimit ? ` / ${fmtBytes(stats.memLimit)}` : ''}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
                  <Wifi width={11} height={11} /> {t('serverDetail.resNet')}
                  <ArrowDown width={11} height={11} />
                  <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
                  <ArrowUp width={11} height={11} />
                  <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
                  <Database width={11} height={11} /> {t('serverDetail.resDisk')}{' '}
                  <span className="text-ink">{fmtBytes(server.diskUsed ?? 0)}</span>
                </span>
              </>
            )}
          </div>

          {statsOpen && (
            <div className="px-6 pt-1 pb-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 w-10 shrink-0">
                  <Cpu width={11} height={11} /> CPU
                </span>
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
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 w-10 shrink-0">
                  <MemoryStick width={11} height={11} /> RAM
                </span>
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
                <Sparkline data={memHistory} />
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 w-10 shrink-0">
                  <Wifi width={11} height={11} /> {t('serverDetail.resNet')}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
                  <ArrowDown width={11} height={11} />
                  <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
                  <ArrowUp width={11} height={11} />
                  <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
                </span>
              </div>

              <div className="flex flex-row gap-3">
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 w-10 shrink-0">
                  <Database width={11} height={11} /> {t('serverDetail.resDisk')}
                </span>
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
          { label: t('serverDetail.tabInfo'), value: 'info', icon: CircleInfo },
          { label: t('serverDetail.tabConsole'), value: 'console', icon: Terminal },
          { label: t('serverDetail.tabFiles'), value: 'files', icon: Folder },
          { label: t('serverDetail.tabSchedule'), value: 'schedule', icon: Calendar },
          { label: t('serverDetail.tabBackups'), value: 'backups', icon: Archive },
        ]}
        value={tab}
        onChange={setTab}
        className="shrink-0"
      />

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {tab === 'info' && <InfoTab server={server} id={id!} token={token} />}
        {/* Console stays mounted so its filter/command/RCON state survives tab
            switches; the output itself lives in `lines` on the parent */}
        <div className={tab === 'console' ? 'h-full' : 'hidden'}>
          <ConsoleTab
            id={id!}
            token={token}
            isRunning={isRunning}
            canWrite={hasPermission('console:write')}
            rcon={rcon}
            visible={tab === 'console'}
            lines={lines}
            setLines={setLines}
          />
        </div>
        {/* Files are only mutable on a stopped server — `isNotCreated` is the
            stopped/not_created/error set, matching the backend's editable states */}
        {tab === 'files' && (
          <FilesTab
            id={id!}
            token={token}
            editable={isNotCreated}
            canWrite={hasPermission('files:write')}
          />
        )}
        {tab === 'schedule' && <ScheduleTab id={id!} token={token} />}
        {tab === 'backups' && <BackupTab id={id!} token={token} isRunning={isRunning} />}
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
