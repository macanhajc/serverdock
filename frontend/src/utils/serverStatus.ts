import type {
  ActionFailureInfo,
  ContainerStatus,
  CrashInfo,
  ResourceAlert,
  Server,
  UiStatus,
} from '../types';

export const STABLE: ContainerStatus[] = ['running', 'stopped', 'not_created', 'error'];

export function toUiStatus(status: ContainerStatus | string): UiStatus {
  switch (status) {
    case 'running':     return 'online';
    case 'stopped':
    case 'not_created': return 'offline';
    case 'error':       return 'error';
    case 'starting':
    case 'restarting':  return 'starting';
    case 'stopping':    return 'stopping';
    case 'pulling':     return 'pulling';
    case 'building':    return 'building';
    default:            return 'offline';
  }
}

// Statuses owned by an in-flight operation — actions stay disabled while one is active
export const IN_FLIGHT: string[] = ['pulling', 'starting', 'stopping', 'restarting', 'building'];

// Running servers first; stable otherwise so unrelated re-sorts don't reshuffle the list
export function sortOnlineFirst<T extends { status: ContainerStatus | string }>(servers: T[]): T[] {
  return [...servers].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running'));
}

export function gameHue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 360;
}

export function gameMark(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// Mirrors the backend's RESOURCE_HIGH_PCT (socketHandlers.js) — an alert can
// carry either metric over threshold, or both at once, hence a list rather
// than the single-line message used for the toast.
const RESOURCE_HIGH_PCT = 90;

export function getResourceIssues(alert: ResourceAlert): Array<{ kind: 'cpu' | 'memory'; pct: number }> {
  const issues: Array<{ kind: 'cpu' | 'memory'; pct: number }> = [];
  if (alert.cpu > RESOURCE_HIGH_PCT) issues.push({ kind: 'cpu', pct: alert.cpu });
  if (alert.memPct > RESOURCE_HIGH_PCT) issues.push({ kind: 'memory', pct: alert.memPct });
  return issues;
}

// Same precedence as ServerEventsBridge's crash toast: OOM is the most
// specific/actionable cause, then Docker's own error string, then a bare
// non-zero exit code, then a generic fallback.
export function getCrashCause(crash: CrashInfo): 'oom' | 'error' | 'exitCode' | 'unknown' {
  if (crash.oomKilled) return 'oom';
  if (crash.error) return 'error';
  if (crash.exitCode != null && crash.exitCode !== 0) return 'exitCode';
  return 'unknown';
}

export function getCrashSummary(
  crash: CrashInfo,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  switch (getCrashCause(crash)) {
    case 'oom':
      return t('crashAlert.oom');
    case 'error':
      return t('crashAlert.error', { message: crash.error });
    case 'exitCode':
      return t('crashAlert.exitCode', { code: crash.exitCode });
    default:
      return t('crashAlert.unknown');
  }
}

export function getActionFailureSummary(
  failure: ActionFailureInfo,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const action = t(`events.actions.${failure.action}`, { defaultValue: failure.action });
  return t('actionFailure.summary', { action, message: failure.message });
}

export interface ActiveIssue {
  key: string;
  text: string;
  since: string;
  severity: 'red' | 'yellow';
}

// Every currently-active problem for a server, distinct and never collapsed
// into "most recent wins" — a crash and a subsequent failed restart attempt
// (say) can both be active at once, and both show up here as their own
// entry. resourceAlert can never coexist with the other two (it only exists
// while running; they only exist while not), so severity is unambiguous:
// red if the server actually failed to run, yellow if it's merely under
// resource pressure while running fine.
export function getActiveIssues(
  server: Pick<Server, 'lastCrash' | 'actionFailure' | 'resourceAlert'>,
  t: (key: string, opts?: Record<string, unknown>) => string
): ActiveIssue[] {
  const issues: ActiveIssue[] = [];
  if (server.lastCrash) {
    issues.push({
      key: 'crash',
      text: getCrashSummary(server.lastCrash, t),
      since: server.lastCrash.at,
      severity: 'red',
    });
  }
  if (server.actionFailure) {
    issues.push({
      key: 'action_failed',
      text: getActionFailureSummary(server.actionFailure, t),
      since: server.actionFailure.at,
      severity: 'red',
    });
  }
  if (server.resourceAlert) {
    for (const issue of getResourceIssues(server.resourceAlert)) {
      issues.push({
        key: `resource-${issue.kind}`,
        text: t(issue.kind === 'cpu' ? 'resourceAlert.cpuIssue' : 'resourceAlert.memoryIssue', {
          pct: issue.pct.toFixed(0),
        }),
        since: server.resourceAlert.since,
        severity: 'yellow',
      });
    }
  }
  return issues;
}

// Best-effort split of a game's raw RCON player-list text into individual
// entries — output format varies per title (and per listCommand the admin
// configures), so this can't parse out structured id/name fields, just break
// the blob into rows the admin can scan and click-to-copy.
export function splitPlayerListEntries(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return raw
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);
}

// The A2S count is the primary source, but some titles (e.g. HumanitZ) never
// answer A2S_INFO at all — if RCON's listCommand is already giving us a live
// player list, its entry count is a truthful stand-in rather than showing
// "unknown" next to data that proves otherwise.
export function getDisplayPlayerCount(server: Pick<Server, 'players' | 'playerList'>): number | null {
  if (server.players != null) return server.players;
  if (!server.playerList) return null;
  return splitPlayerListEntries(server.playerList).length;
}

// Best-effort platform label for a store link's cover badge — falls back to a
// generic label for anything that isn't Steam/GOG/Epic.
export function storeLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('steampowered.com')) return 'Steam';
    if (host.includes('gog.com')) return 'GOG';
    if (host.includes('epicgames.com')) return 'Epic';
    return 'Store';
  } catch {
    return 'Store';
  }
}
