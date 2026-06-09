import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/core/Button';
import { fmtBytes } from '../../../../utils/format';
import type { Server, ServerStats } from '../../../../types';

// ─── copy helpers ─────────────────────────────────────────────────────────────

function copyFallback(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function copyText(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => copyFallback(text));
  } else {
    copyFallback(text);
  }
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

interface CopyButtonProps {
  value: string | number;
}

function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  function handle() {
    copyText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handle}
      className={`font-mono text-xs text-ink-3 hover:text-ink border px-3 py-1.5 cursor-pointer shrink-0 transition-colors ${
        copied ? 'bg-green-500/5 border-green-500/20 text-green-500' : 'border-line bg-bg-2'
      }`}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  suffix?: React.ReactNode;
  copyable?: boolean;
}

function InfoRow({ label, value, mono, suffix, copyable }: InfoRowProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copyText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group flex">
      <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-2.5 border-r border-line uppercase tracking-wider w-32 shrink-0">
        {label}
      </span>
      <span
        className={`flex-1 min-w-0 text-sm text-ink truncate px-4 py-2.5 ${mono ? 'font-mono' : ''}`}
      >
        {value}
        {suffix}
      </span>
      {copyable && (
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 font-mono text-[11px] text-ink-3 hover:text-ink px-2 py-0.5 border border-line bg-bg-2 cursor-pointer transition-opacity shrink-0"
        >
          {copied ? '✓' : 'copy'}
        </button>
      )}
    </div>
  );
}

// ─── Uptime ───────────────────────────────────────────────────────────────────

function fmtUptime(startedAt: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function UptimeTicker({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    timer.current = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer.current!);
  }, [startedAt]);

  return <>{fmtUptime(startedAt)}</>;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  width = 120,
  height = 24,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
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

// ─── ResourceBar ──────────────────────────────────────────────────────────────

function ResourceBar({ label, pct, warn }: { label: string; pct: number; warn?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-ink-3 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 relative" style={{ background: 'var(--line-2)' }}>
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-500"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: warn ? 'var(--yellow)' : 'var(--accent)',
          }}
        />
      </div>
      <span className="font-mono text-xs text-ink w-10 text-right shrink-0">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── InfoTab ──────────────────────────────────────────────────────────────────

interface InfoTabProps {
  server: Server;
  id: string;
  stats?: ServerStats | null;
  cpuHistory?: number[];
}

export function InfoTab({ server, id, stats, cpuHistory = [] }: InfoTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    name: _name,
    image,
    connection,
    description,
    imageSource,
    ports,
    dataMount,
    pinnedEnv,
    players,
    query,
    rcon,
    startedAt,
    status,
  } = server;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-8">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => navigate(`/admin/servers/${id}/edit`)}>
            {t('serverDetail.editConfig')}
          </Button>
        </div>

        {description && (
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              Description
            </div>
            <div className="border border-line bg-bg-1 px-4 py-3">
              <p className="font-mono text-sm text-ink-2 leading-relaxed m-0">{description}</p>
            </div>
          </section>
        )}

        {connection && (
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              Connection
            </div>
            <div className="border border-line bg-bg-1 px-5 py-4 flex items-center gap-5">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xl font-bold text-ink leading-tight">
                  {connection.host}:{connection.port}
                </div>
                <div className="font-mono text-xs text-ink-3 mt-1">
                  Share with friends to connect
                </div>
              </div>
              <CopyButton value={`${connection.host}:${connection.port}`} />
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
          {/* Configuration */}
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              {t('serverDetail.infoSectionConfig')}
            </div>
            <div className="border border-line divide-y divide-line">
              <InfoRow label="ID" value={id} mono copyable />
              <InfoRow label="Container" value={`serverdock-${id}`} mono copyable />
              <InfoRow
                label={t('serverDetail.infoImage')}
                value={image}
                mono
                suffix={
                  <span
                    className="ml-2 font-mono text-[11px] px-1.5 py-0.5 leading-none"
                    style={{
                      color: imageSource === 'local' ? 'var(--accent)' : 'var(--ink-3)',
                      background:
                        imageSource === 'local'
                          ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
                          : 'var(--bg-2)',
                    }}
                  >
                    {imageSource === 'local'
                      ? t('serverDetail.infoLocal')
                      : t('serverDetail.infoPublic')}
                  </span>
                }
              />
              <InfoRow label={t('serverDetail.infoDataMount')} value={dataMount ?? '/data'} mono />
            </div>
          </section>

          {/* Ports */}
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              {t('serverDetail.infoSectionPorts')}
            </div>
            <div className="border border-line">
              <div className="grid grid-cols-3 border-b border-line bg-bg-2">
                <span className="font-mono text-[11px] border-r border-line px-4 py-2.5 text-ink-3 uppercase tracking-wider">
                  {t('serverDetail.infoPortHost')}
                </span>
                <span className="font-mono text-[11px] border-r border-line px-4 py-2.5 text-ink-3 uppercase tracking-wider">
                  {t('serverDetail.infoPortContainer')}
                </span>
                <span className="font-mono text-[11px] px-4 py-2.5 text-ink-3 uppercase tracking-wider">
                  {t('serverDetail.infoPortProtocol')}
                </span>
              </div>
              {(ports ?? []).length === 0 ? (
                <div className="px-3 py-4 font-mono text-xs text-ink-3">No ports configured</div>
              ) : (
                (ports ?? []).map((p, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-3 items-center border-b border-line last:border-b-0"
                  >
                    <span className="font-mono border-r border-line text-sm px-4 py-2.5 text-ink">
                      {p.host}
                    </span>
                    <span className="font-mono text-sm border-r border-line px-4 py-2.5 text-ink">
                      {p.container}
                    </span>
                    <span
                      className="font-mono text-xs mx-4 px-1.5 py-1.5 w-fit leading-none uppercase"
                      style={{
                        color:
                          p.protocol?.toLowerCase() === 'udp' ? 'var(--yellow)' : 'var(--accent)',
                        background:
                          p.protocol?.toLowerCase() === 'udp'
                            ? 'color-mix(in oklab, var(--yellow) 12%, transparent)'
                            : 'color-mix(in oklab, var(--accent) 12%, transparent)',
                      }}
                    >
                      {p.protocol}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Runtime stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
          {/* Players */}
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              Players
            </div>
            <div className="border border-line px-5 py-4 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-ink">
                {players != null ? players : '—'}
              </span>
              <span className="font-mono text-xs text-ink-3">
                {players == null
                  ? status === 'running'
                    ? 'querying…'
                    : 'server offline'
                  : 'online'}
              </span>
            </div>
          </section>

          {/* Uptime */}
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              Uptime
            </div>
            <div className="border border-line px-5 py-4 flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-ink tabular-nums">
                {startedAt ? <UptimeTicker startedAt={startedAt} /> : '—'}
              </span>
              {startedAt && (
                <span className="font-mono text-xs text-ink-3">
                  since {new Date(startedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
          {(pinnedEnv?.length ?? 0) > 0 && (
            <section>
              <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
                {t('serverDetail.infoSectionEnv')}
              </div>
              <div className="border border-line divide-y divide-line">
                {pinnedEnv!.map((e) => (
                  <div key={e.key} className="flex font-mono text-sm">
                    <span className="text-ink-3 font-mono text-[11px] bg-bg-1 w-32 shrink-0 border-r border-line px-4 py-2.5">
                      {e.key}
                    </span>
                    <span className="text-ink flex-1 px-4 py-2.5">{e.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Query / RCON */}
          <section>
            <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
              Query &amp; RCON
            </div>
            <div className="border border-line divide-y divide-line">
              {query?.port != null ? (
                <InfoRow
                  label="Query"
                  value={`${query.type?.toUpperCase() ?? 'A2S'} :${query.port}`}
                  mono
                />
              ) : (
                <InfoRow label="Query" value="not configured" />
              )}
              {rcon ? (
                <InfoRow
                  label="RCON"
                  value={
                    rcon.enabled ? (rcon.port != null ? `:${rcon.port}` : 'enabled') : 'disabled'
                  }
                  mono
                  suffix={
                    <span
                      className="ml-2 font-mono text-[11px] px-1.5 py-0.5 leading-none"
                      style={{
                        color: rcon.enabled ? 'var(--accent)' : 'var(--ink-3)',
                        background: rcon.enabled
                          ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
                          : 'var(--bg-2)',
                      }}
                    >
                      {rcon.enabled ? 'on' : 'off'}
                    </span>
                  }
                />
              ) : (
                <InfoRow label="RCON" value="not configured" />
              )}
            </div>
          </section>
        </div>

        {/* Resources */}
        <section className='border-t border-line py-6'>
          <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
            Resources
          </div>
          <div className="border border-line divide-y divide-line">
            {/* CPU */}
            <div className="flex">
              <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-3 border-r border-line uppercase tracking-wider w-32 shrink-0 flex items-center">
                CPU
              </span>
              <div className="flex-1 px-4 py-3 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-3">
                  {stats && (
                    <span className="font-mono text-xs text-ink-3">
                      · <span className="text-ink">{stats.cpu.toFixed(1)}%</span> now
                    </span>
                  )}
                  {cpuHistory.length > 1 && <Sparkline data={cpuHistory} />}
                </div>
                {stats && <ResourceBar label="use" pct={stats.cpu} />}
              </div>
            </div>
            {/* Memory */}
            <div className="flex">
              <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-3 border-r border-line uppercase tracking-wider w-32 shrink-0 flex items-center">
                Memory
              </span>
              <div className="flex-1 px-4 py-3 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-3">
                  {stats && (
                    <span className="font-mono text-xs text-ink-3">
                      · <span className="text-ink">{fmtBytes(stats.memUsed)}</span> used
                      {stats.memLimit ? ` / ${fmtBytes(stats.memLimit)}` : ''}
                    </span>
                  )}
                </div>
                {stats && stats.memLimit ? (
                  <ResourceBar
                    label="use"
                    pct={(stats.memUsed / stats.memLimit) * 100}
                    warn={stats.memUsed / stats.memLimit > 0.8}
                  />
                ) : stats ? (
                  <span className="font-mono text-xs text-ink-3">
                    {fmtBytes(stats.memUsed)} in use
                  </span>
                ) : null}
              </div>
            </div>
            {/* Disk */}
            <div className="flex">
              <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-3 border-r border-line uppercase tracking-wider w-32 shrink-0 flex items-center">
                Disk
              </span>
              <div className="flex-1 px-4 py-3 flex items-center min-w-0">
                <span className="font-mono text-sm text-ink">
                  {fmtBytes(server.diskUsed ?? 0)} used by game data
                </span>
              </div>
            </div>
            {/* Network */}
            {stats && (
              <div className="flex">
                <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-3 border-r border-line uppercase tracking-wider w-32 shrink-0 flex items-center">
                  Network
                </span>
                <div className="flex-1 px-4 py-3 flex items-center gap-4 min-w-0">
                  <span className="font-mono text-xs text-ink-3">
                    ↓ <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
                  </span>
                  <span className="font-mono text-xs text-ink-3">
                    ↑ <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
