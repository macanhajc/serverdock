import type { ContainerStatus, UiStatus } from '../types';

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
