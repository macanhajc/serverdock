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

export function gameHue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 360;
}

export function gameMark(name: string): string {
  return name.slice(0, 2).toUpperCase();
}
