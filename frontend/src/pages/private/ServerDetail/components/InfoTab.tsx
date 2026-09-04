import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Copy,
  ExternalLink,
  User,
  Refresh,
  WarningDiamond,
  X,
} from 'pixelarticons/react';
import { CopyButton } from '../../../../components/core/CopyButton';
import { UptimeTicker } from '../../../../components/core/UptimeTicker';
import { copyText } from '../../../../utils/clipboard';
import { timeAgo, formatDate } from '../../../../utils/format';
import type { Server, ServerEventEntry } from '../../../../types';
import {
  gameHue,
  gameMark,
  getResourceIssues,
  getCrashSummary,
  getActionFailureSummary,
  getDisplayPlayerCount,
  splitPlayerListEntries,
} from '../../../../utils/serverStatus';
import { BuildSection } from './BuildSection';

// ─── InfoRow ──────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  suffix?: React.ReactNode;
  copyable?: boolean;
}

function InfoRow({ label, value, mono, suffix, copyable }: InfoRowProps) {
  const { t } = useTranslation();
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
          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 font-mono text-[11px] text-ink-3 hover:text-ink px-2 py-0.5 border border-line bg-bg-2 cursor-pointer transition-opacity shrink-0"
        >
          {copied ? <Check width={10} height={10} /> : <Copy width={10} height={10} />}
          {copied ? '' : t('common.copy')}
        </button>
      )}
    </div>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
      {children}
    </div>
  );
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── UpdateCheckRow ───────────────────────────────────────────────────────────

interface UpdateCheckResult {
  updateAvailable: boolean | null;
  reason?: string;
}

function UpdateCheckRow({ id, token }: { id: string; token: string | null }) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  async function check() {
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch(`/api/games/${id}/check-update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      setResult(res.ok ? data : { updateAvailable: null, reason: 'check_failed' });
    } catch {
      setResult({ updateAvailable: null, reason: 'check_failed' });
    } finally {
      setChecking(false);
    }
  }

  let label: string | null = null;
  let color = 'var(--ink-3)';
  let ResultIcon: typeof WarningDiamond | null = null;
  if (result) {
    if (result.updateAvailable === true) {
      label = t('serverDetail.updateAvailable');
      color = 'var(--yellow)';
      ResultIcon = WarningDiamond;
    } else if (result.updateAvailable === false) {
      label = t('serverDetail.upToDate');
      color = 'var(--green)';
      ResultIcon = Check;
    } else if (result.reason === 'not_pulled') {
      label = t('serverDetail.imageNotPulled');
      ResultIcon = X;
    } else {
      label = t('serverDetail.updateCheckFailed');
      ResultIcon = X;
    }
  }

  return (
    <div className="flex group">
      <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-2.5 border-r border-line uppercase tracking-wider w-32 shrink-0">
        {t('serverDetail.imageUpdateLabel')}
      </span>

      <span className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-3">
        {label && (
          <span className="inline-flex items-center gap-1.5 capitalize font-mono text-xs" style={{ color }}>
            {ResultIcon && <ResultIcon width={12} height={12} />}
            {label}
          </span>
        )}
        <button
          onClick={check}
          disabled={checking}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3 hover:text-ink px-2 py-0.5 border border-line bg-bg-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Refresh width={11} height={11} />
          {checking ? t('common.loading') : t('serverDetail.checkForUpdates')}
        </button>
      </span>
    </div>
  );
}

// ─── EventHistorySection ────────────────────────────────────────────────────

function summarizeEvent(
  entry: ServerEventEntry,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (entry.type === 'crash') {
    return getCrashSummary({ ...entry.data, at: entry.createdAt }, t);
  }
  if (entry.type === 'action_failed') {
    return getActionFailureSummary({ ...entry.data, at: entry.createdAt }, t);
  }
  return getResourceIssues({ ...entry.data, since: entry.createdAt })
    .map((issue) =>
      t(issue.kind === 'cpu' ? 'resourceAlert.cpuIssue' : 'resourceAlert.memoryIssue', {
        pct: issue.pct.toFixed(0),
      })
    )
    .join(' · ');
}

// A single history row — its own component (rather than inline in a .map())
// so the stack-trace toggle can hold its own expand/collapse state per row.
function EventRow({
  entry,
  t,
}: {
  entry: ServerEventEntry;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [showStack, setShowStack] = useState(false);
  const color = entry.type === 'resource_high' ? 'var(--yellow)' : 'var(--red)';
  const stack = entry.type === 'action_failed' ? entry.data.stack : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <WarningDiamond width={12} height={12} style={{ color }} className="shrink-0" />
        <span className="flex-1 min-w-0 font-mono text-xs text-ink truncate">
          {summarizeEvent(entry, t)}
        </span>
        {!entry.resolvedAt && (
          <span
            className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 shrink-0"
            style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
          >
            {t('serverDetail.eventOngoing')}
          </span>
        )}
        {stack && (
          <button
            type="button"
            onClick={() => setShowStack((v) => !v)}
            className="font-mono text-[10px] text-ink-3 hover:text-ink px-1.5 py-0.5 border border-line bg-bg-2 cursor-pointer shrink-0"
          >
            {showStack ? t('serverDetail.eventHideStack') : t('serverDetail.eventShowStack')}
          </button>
        )}
        <span
          className="font-mono text-[11px] w-20 text-ink-3 shrink-0"
          title={formatDate(entry.createdAt)}
        >
          {timeAgo(entry.createdAt, t)}
        </span>
      </div>
      {stack && showStack && (
        <pre className="mx-4 mb-3 p-3 bg-bg-2 border border-line font-mono text-[10px] text-ink-2 overflow-x-auto whitespace-pre-wrap break-words">
          {stack}
        </pre>
      )}
    </div>
  );
}

// Bounded, append-only history of past resource/crash alerts for this game
// (see backend/src/lib/eventLog.js) — separate from the live banners above,
// which only reflect the *current* unresolved condition. Fetched on demand
// rather than pushed over the socket since it's a diagnostic tail, not
// something that needs to update live while the tab is open.
function EventHistorySection({ id, token }: { id: string; token: string | null }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<ServerEventEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/servers/${id}/events`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ServerEventEntry[]) => {
        if (!cancelled) setEvents(data);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  return (
    <section className="border-t border-line pt-6 pb-6">
      <SectionTitle>{t('serverDetail.infoEventHistory')}</SectionTitle>
      {!events ? (
        <div className="border border-line px-4 py-3 font-mono text-xs text-ink-3">
          {t('common.loading')}
        </div>
      ) : events.length === 0 ? (
        <div className="border border-line px-4 py-3 font-mono text-xs text-ink-3">
          {t('serverDetail.eventHistoryEmpty')}
        </div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {events.map((e) => (
            <EventRow key={e.id} entry={e} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── InfoTab ──────────────────────────────────────────────────────────────────

interface InfoTabProps {
  server: Server;
  id: string;
  token: string | null;
}

export function InfoTab({ server, id, token }: InfoTabProps) {
  const { t } = useTranslation();

  const {
    image,
    connection,
    description,
    imageSource,
    ports,
    dataMount,
    pinnedEnv,
    query,
    rcon,
    startedAt,
    lastActiveAt,
    status,
  } = server;

  const playerListEntries = useMemo(
    () => (server.playerList ? splitPlayerListEntries(server.playerList) : []),
    [server.playerList]
  );

  const displayPlayers = getDisplayPlayerCount(server);

  const playersHint =
    displayPlayers != null
      ? t('serverDetail.infoOnline')
      : status !== 'running'
        ? t('serverDetail.infoOffline')
        : query?.port != null
          ? t('serverDetail.infoQuerying')
          : t('serverDetail.infoNoQuery');

  return (
    <div className="h-full overflow-y-auto p-6 container">
      <div className="flex flex-col gap-8">

        <div className="w-full h-96 shrink-0 border border-line overflow-hidden grid place-items-center">
          {server.avatarUrl ? (
            <img src={server.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span
              className="w-full h-full grid place-items-center font-mono text-[10px] font-bold"
              style={{
                color: `hsl(${gameHue(id)} 55% 78%)`,
                background: `hsl(${gameHue(id)} 38% 16%)`,
              }}
            >
              {gameMark(server.name)}
            </span>
          )}
        </div>

        {description && (
          <section>
            <SectionTitle>{t('serverDetail.infoDescription')}</SectionTitle>
            <div className="border border-line bg-bg-1 px-4 py-3">
              <p className="font-mono text-sm text-ink-2 leading-relaxed m-0">{description}</p>
            </div>
          </section>
        )}

        {server.storeUrl && (
          <section className='-mt-2'>
            <SectionTitle>{t('gameForm.fieldStoreUrl')}</SectionTitle>
            <div className="border border-line bg-bg-1 px-4 py-3">
              <a
                href={server.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline font-mono text-sm text-ink-2 leading-relaxed m-0"
              >
                {server.storeUrl}
                <ExternalLink width={12} height={12} />
              </a>
            </div>
          </section>
        )}

        {connection && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
            {/* Connection info */}
            <section>
              <SectionTitle>{t('serverDetail.infoConnection')}</SectionTitle>
              <div className="border border-line bg-bg-1 px-5 py-4 flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xl font-bold text-ink leading-tight">
                    {connection.host}:{connection.port}
                  </div>
                  <div className="font-mono text-xs text-ink-3 mt-1">
                    {t('serverDetail.infoShareHint')}
                  </div>
                </div>
                <CopyButton
                  text={`${connection.host}:${connection.port}`}
                  className="px-3 py-1.5 shrink-0"
                />
              </div>
            </section>

            {/* Uptime / Last Active */}
            <section>
              <SectionTitle>
                {startedAt ? t('serverDetail.infoUptime') : t('serverDetail.infoLastActive')}
              </SectionTitle>
              <div className="border border-line bg-bg-1 px-5 py-4 flex flex-col">
                {startedAt ? (
                  <>
                    <span className="font-mono text-xl font-bold text-ink leading-tight">
                      <UptimeTicker startedAt={startedAt} />
                    </span>
                    <span className="font-mono text-xs text-ink-3 mt-1">
                      {t('serverDetail.infoSince', { when: fmtWhen(startedAt) })}
                    </span>
                  </>
                ) : lastActiveAt ? (
                  <>
                    <span className="font-mono text-xl font-bold text-ink leading-tight">
                      {timeAgo(lastActiveAt, t)}
                    </span>
                    <span className="font-mono text-xs text-ink-3 mt-1">{fmtWhen(lastActiveAt)}</span>
                  </>
                ) : (
                  <span className="font-mono text-xl font-bold text-ink leading-tight">—</span>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Players */}
        <section className='border-t border-line pt-6'>
          <SectionTitle>{t('serverDetail.infoPlayers')}</SectionTitle>
          <div className="border border-line px-5 py-4 flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-ink">
              {displayPlayers != null ? displayPlayers : '—'}
            </span>
            <span className="font-mono text-xs text-ink-3">{playersHint}</span>
          </div>
          {playerListEntries.length > 0 && (
            <div className="border border-t-0 border-line px-5 py-3">
              <div className="font-mono text-[10px] tracking-[.08em] uppercase text-ink-3 mb-2">
                {t('serverDetail.infoPlayerListTitle')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {playerListEntries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex py-2 gap-2 px-2 items-center text-ink-2 hover:text-ink bg-bg-1 border border-line hover:border-line-2"
                  >
                    <User width={12} height={12} />
                    <span className="font-mono text-xs">
                      {entry}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
          {/* Configuration */}
          <section>
            <SectionTitle>{t('serverDetail.infoSectionConfig')}</SectionTitle>
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
              {imageSource === 'public' && <UpdateCheckRow id={id} token={token} />}
            </div>
          </section>

          {/* Ports */}
          <section>
            <SectionTitle>{t('serverDetail.infoSectionPorts')}</SectionTitle>
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
                <div className="px-3 py-4 font-mono text-xs text-ink-3">
                  {t('serverDetail.infoNoPorts')}
                </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
          {(pinnedEnv?.length ?? 0) > 0 && (
            <section>
              <SectionTitle>{t('serverDetail.infoSectionEnv')}</SectionTitle>
              <div className="border border-line divide-y divide-line">
                {pinnedEnv!.map((e) => (
                  <div key={e.key} className="flex font-mono text-sm">
                    <span className="text-ink-3 font-mono text-[11px] bg-bg-1 w-1/2 shrink-0 border-r border-line px-4 py-2.5">
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
            <SectionTitle>{t('serverDetail.infoQueryRcon')}</SectionTitle>
            <div className="border border-line divide-y divide-line">
              {query?.port != null ? (
                <InfoRow
                  label="Query"
                  value={`${query.type?.toUpperCase() ?? 'A2S'} :${query.port}`}
                  mono
                />
              ) : (
                <InfoRow label="Query" value={t('serverDetail.infoNotConfigured')} />
              )}
              {rcon ? (
                <InfoRow
                  label="RCON"
                  value={
                    rcon.enabled
                      ? rcon.port != null
                        ? `:${rcon.port}`
                        : t('serverDetail.infoEnabled')
                      : t('serverDetail.infoDisabled')
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
                      {rcon.enabled ? t('serverDetail.infoOn') : t('serverDetail.infoOff')}
                    </span>
                  }
                />
              ) : (
                <InfoRow label="RCON" value={t('serverDetail.infoNotConfigured')} />
              )}
            </div>
          </section>
        </div>

        {imageSource === 'local' && (
          <BuildSection id={id} token={token} imageBuilt={server.imageBuilt} />
        )}

        <EventHistorySection id={id} token={token} />

      </div>
    </div>
  );
}
