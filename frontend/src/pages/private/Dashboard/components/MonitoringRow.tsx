import { Play, RotateCw, Square, Trash2 } from "lucide-react";
import { Button, StatusBadge } from "../../../../components";
import { fmtBytes } from "../../../../utils/format";
import { toUiStatus } from "../../../../utils/serverStatus";
import { Server, ServerStats } from "../../../../types";
import { COLS } from "../";

interface MonitoringRowProps {
  server: Server;
  stats: ServerStats | undefined;
  navigate: (path: string) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onWipe: () => void;
  actionLoading: string | null | undefined;
  hostTotalMem: number | null;
  hostCpuCount: number | null;
}

export function MonitoringRow({
  server,
  stats,
  navigate,
  onStart,
  onStop,
  onRestart,
  onWipe,
  actionLoading,
}: MonitoringRowProps) {
  const { id, name, status } = server;
  const isRunning = status === 'running';
  const isNotCreated = status === 'stopped' || status === 'not_created' || status === 'error';
  const busy = !!actionLoading;
  const memMax = stats?.memLimit ?? null;

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
        <StatusBadge status={toUiStatus(status)} />
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

      <div className="flex items-center border-r border-line px-4 py-3.5">
        {server.connection ? (
          <span className="font-mono text-xs text-ink">
            {server.connection.host}:{server.connection.port}
          </span>
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
          title="Start"
          onClick={(e) => act(e, onStart)}
        >
          <Play size={12} />
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="p-1.5"
          disabled={!isRunning || busy}
          title="Stop"
          onClick={(e) => act(e, onStop)}
        >
          <Square size={12} />
        </Button>
        <Button
          size="sm"
          className="p-1.5"
          disabled={!isRunning || busy}
          title="Restart"
          onClick={(e) => act(e, onRestart)}
        >
          <RotateCw size={12} />
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="p-1.5"
          disabled={busy}
          title="Wipe"
          onClick={(e) => act(e, onWipe)}
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
}
