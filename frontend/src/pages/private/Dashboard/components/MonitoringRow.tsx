import { Play, RotateCw, Square, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, CopyButton, StatusBadge } from "../../../../components";
import { UptimeTicker } from "../../../../components/core/UptimeTicker";
import { fmtBytes } from "../../../../utils/format";
import { toUiStatus, IN_FLIGHT } from "../../../../utils/serverStatus";
import { Server, ServerStats, PullProgress } from "../../../../types";
import { COLS } from "../";

interface MonitoringRowProps {
  server: Server;
  stats: ServerStats | undefined;
  pull?: PullProgress;
  navigate: (path: string) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onWipe: () => void;
  actionLoading: string | null | undefined;
}

export function MonitoringRow({
  server,
  stats,
  pull,
  navigate,
  onStart,
  onStop,
  onRestart,
  onWipe,
  actionLoading,
}: MonitoringRowProps) {
  const { t } = useTranslation();
  const { id, name, status } = server;
  const isRunning = status === 'running';
  const isNotCreated = status === 'stopped' || status === 'not_created' || status === 'error';
  // Busy if this client has a request in flight, or any client/scheduler does
  const busy = !!actionLoading || IN_FLIGHT.includes(status);
  const memMax = stats?.memLimit ?? null;

  const badgeLabel =
    status === 'pulling' && pull
      ? `${t(pull.phase === 'extracting' ? 'status.extracting' : 'status.pulling')} ${pull.percent}%`
      : undefined;

  function act(e: React.MouseEvent, handler: () => void) {
    e.stopPropagation();
    handler();
  }

  return (
    <div
      className="group grid border-b border-line hover:bg-bg-2 last:border-none cursor-pointer transition-colors"
      style={{ gridTemplateColumns: COLS, width: 'fit-content' }}
      onClick={() => navigate(`/admin/servers/${id}`)}
    >
      <div className="flex flex-col items-start border-r border-line gap-1 px-5 py-3.5 sticky left-0 z-10 bg-bg-1 group-hover:bg-bg-2 transition-colors">
        <span className="font-bold text-sm text-ink whitespace-nowrap">{name}</span>
        <span className="font-mono text-xs text-ink-3 whitespace-nowrap">{id}</span>
      </div>

      <div className="flex items-center border-r border-line px-4 py-3.5">
        <StatusBadge status={toUiStatus(status)}>{badgeLabel}</StatusBadge>
      </div>

      <div className="flex items-center border-r border-line px-4 py-3.5">
        {isRunning && server.startedAt ? (
          <span className="font-mono text-xs text-ink whitespace-nowrap">
            <UptimeTicker startedAt={server.startedAt} />
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center border-r border-line px-4 py-3.5">
        {server.players !== null && server.players !== undefined ? (
          <span className="font-mono text-xs text-ink">{server.players}</span>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center border-r border-line gap-2.5 px-4 py-3.5">
        {isRunning && stats ? (
          <span className="font-mono text-xs text-ink shrink-0" style={{ minWidth: '7rem' }}>
            {stats.cpu.toFixed(1)}%
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center border-r border-line gap-2.5 px-4 py-3.5">
        {isRunning && stats ? (
          <span
            className="font-mono text-xs text-ink shrink-0 whitespace-nowrap text-ellipsis overflow-hidden"
            style={{ minWidth: '8rem' }}
          >
            {fmtBytes(stats.memUsed)}
            {memMax ? ` / ${fmtBytes(memMax)}` : ' / - '}
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center border-r border-line px-4 py-3.5">
        {server.diskUsed != null ? (
          <span className="font-mono text-xs text-ink whitespace-nowrap text-ellipsis overflow-hidden">
            {fmtBytes(server.diskUsed)}
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center border-r border-line gap-3 px-4 py-3.5">
        {isRunning && stats ? (
          <span className="font-mono text-xs text-ink-3 whitespace-nowrap text-ellipsis overflow-hidden">
            ↓ <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
            <span className="mx-2 text-line-2">·</span>↑{' '}
            <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center gap-2 border-r border-line px-4 py-3.5">
        {server.connection ? (
          <>
            <span className="font-mono text-xs text-ink">
              {server.connection.host}:{server.connection.port}
            </span>
            <CopyButton
              text={`${server.connection.host}:${server.connection.port}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </>
        ) : (
          <span className="font-mono text-xs text-ink-3">—</span>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 py-3.5">
        <Button
          size="sm"
          variant="primary"
          className="p-1.5"
          disabled={!isNotCreated || busy}
          title={t('adminDashboard.actStart')}
          aria-label={t('adminDashboard.actStart')}
          onClick={(e) => act(e, onStart)}
        >
          <Play size={12} />
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="p-1.5"
          disabled={!isRunning || busy}
          title={t('adminDashboard.actStop')}
          aria-label={t('adminDashboard.actStop')}
          onClick={(e) => act(e, onStop)}
        >
          <Square size={12} />
        </Button>
        <Button
          size="sm"
          className="p-1.5"
          disabled={!isRunning || busy}
          title={t('adminDashboard.actRestart')}
          aria-label={t('adminDashboard.actRestart')}
          onClick={(e) => act(e, onRestart)}
        >
          <RotateCw size={12} />
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="p-1.5"
          disabled={busy}
          title={t('adminDashboard.actReset')}
          aria-label={t('adminDashboard.actReset')}
          onClick={(e) => act(e, onWipe)}
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
}
