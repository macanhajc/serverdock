import { HTMLAttributes, ReactNode, memo } from 'react';
import { ExternalLink } from 'pixelarticons/react';
import { StatusBadge } from '../core/StatusBadge';
import { CopyButton } from '../core/CopyButton';
import { storeLabel } from '../../utils/serverStatus';

interface ConnectionInfo {
  host: string;
  port: number | null;
}

function ConnectCell({ host, port }: ConnectionInfo) {
  const addr = port != null ? `${host}:${port}` : host;
  return (
    <span className="flex items-center gap-2">
      <span>{addr}</span>
      <CopyButton text={addr} className="text-sm" />
    </span>
  );
}

interface PinnedEnvItem {
  key: string;
  value: string;
}

function PinnedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-mono text-[10px] tracking-[.08em] uppercase text-ink-3 shrink-0">
        {label}:
      </span>
      <span className="font-mono text-xs text-ink flex-1 truncate">{value}</span>
    </div>
  );
}

function PinnedEnv({ items }: { items: PinnedEnvItem[] }) {
  return (
    <div className="mt-3 pt-3 border-t border-line">
      <div className="flex items-center gap-1.5 w-full group">
        <span className="font-mono text-[10px] tracking-[.08em] uppercase text-ink-3 group-hover:text-ink-2">
          Env vars
        </span>
        {items.length > 0 && (
          <span className="font-mono text-[10px] text-ink-3 group-hover:text-ink-2">
            ({items.length})
          </span>
        )}
      </div>

      <div className="mt-2 border border-[#4c4c4c] border-dashed p-2 bg-line flex flex-col gap-2">
        {items.length > 0 ? (
          items.map((e, i) => <PinnedRow key={i} label={e.key} value={e.value} />)
        ) : (
          <span className="font-mono text-[11px] text-ink-3 italic">No pinned env vars</span>
        )}
      </div>
    </div>
  );
}

interface ServerCardProps extends HTMLAttributes<HTMLElement> {
  name: string;
  engine?: string;
  status?: string;
  players?: ReactNode;
  connection?: ConnectionInfo | null;
  lastActive?: ReactNode;
  hue?: number;
  mark?: string;
  source?: string;
  avatarUrl?: string | null;
  storeUrl?: string | null;
  pinnedEnv?: PinnedEnvItem[];
  coverActions?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

// Memoized — the public dashboard's status:update ticks rebuild the servers
// array, and without this every card would re-render even when only one
// server's row actually changed.
export const ServerCard = memo(function ServerCard({
  name,
  engine,
  status = 'offline',
  players,
  connection,
  lastActive,
  hue = 210,
  mark,
  source,
  avatarUrl,
  storeUrl,
  pinnedEnv = [],
  coverActions,
  actions,
  children,
  className = '',
  ...rest
}: ServerCardProps) {
  return (
    <article
      className={`flex flex-col bg-bg-1 border border-line hover:[box-shadow:var(--hs)] hover:-translate-y-1 transition-all duration-300 ${className}`}
      style={{
        '--hs': `0 8px 34px 2px hsl(${hue} 55% 40% / 0.25), 0 0 6px 1px hsl(${hue} 55% 50% / 0.15)`,
      } as React.CSSProperties}
      {...rest}
    >
      {/* cover — radial gradient uses runtime hue, must stay inline */}
      <div
        className="relative h-(--thumb-h) border-b border-line overflow-hidden"
        style={{
          background: `radial-gradient(130% 120% at 12% 0%, hsl(${hue} 38% 16%) 0%, #0c0c0c 62%)`,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span
            className="absolute left-4 bottom3 font-mono text-[40px] font-bold tracking-[.04em] opacity-[.92]"
            style={{ color: `hsl(${hue} 55% 78%)` }}
          >
            {mark}
          </span>
        )}
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute left-3 top-3 inline-flex items-center gap-1 font-mono text-xs tracking-widest uppercase px-2 py-0.5 text-ink-2 hover:text-ink"
            style={{
              border: '1px solid var(--line-2)',
              background: 'color-mix(in oklab, #000 45%, transparent)',
            }}
          >
            {storeLabel(storeUrl)}
            <ExternalLink width={11} height={11} />
          </a>
        )}
        {coverActions && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1">{coverActions}</div>
        )}
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-(--row-pad)">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg font-bold text-ink tracking-[.01em]">{name}</div>
          <StatusBadge status={status as any} className="shrink-0" />
        </div>

        <div className="font-mono text-sm text-ink-3 mt-1 whitespace-nowrap text-ellipsis overflow-hidden">
          {engine}
        </div>

        {lastActive && (
          <div className="font-mono text-[11px] text-ink-3 mt-1">{lastActive}</div>
        )}

        <div className="mt-4 flex justify-between gap-4">
          <Meta k="Players" v={players} />
          <Meta
            k="Connect"
            v={
              connection ? (
                <ConnectCell host={connection.host} port={connection.port} />
              ) : (
                <span className="font-mono text-xs text-ink-3">—</span>
              )
            }
            dim
          />
        </div>

        {children}

        {actions && (
          <div className="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">{actions}</div>
        )}

        <PinnedEnv items={pinnedEnv} />
      </div>
    </article>
  );
});

function Meta({ k, v, dim }: { k: string; v?: ReactNode; dim?: boolean }) {
  return (
    <div>
      <div className="font-mono text-xs tracking-[.08em] uppercase text-ink-3">{k}</div>
      <div className={`font-mono text-sm mt-0.5 ${dim ? 'text-ink-2' : 'text-ink'}`}>{v}</div>
    </div>
  );
}
