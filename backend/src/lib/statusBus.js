import { getIo } from './socket.js';
import { getPlayers } from './playerQuery.js';
import logger from './logger.js';

// Single owner of what clients believe about each server:
// - lastKnown: last status broadcast; the poll diffs against this
// - transient: in-flight operation states (pulling/starting/stopping/restarting)
//   that Docker cannot report itself; while set, the poll leaves the id alone
//   so it never overwrites an operation in progress with stale Docker state
// - adminStops: ids whose next stop transition is admin-initiated (no crash alert)

const lastKnown = new Map();
const transient = new Map();
const adminStops = new Set();

export function markAdminStop(id) {
  adminStops.add(id);
}

export function clearAdminStop(id) {
  adminStops.delete(id);
}

// True if the stop was admin-initiated; consumes the mark
export function consumeAdminStop(id) {
  const has = adminStops.has(id);
  adminStops.delete(id);
  return has;
}

export function hasAdminStop(id) {
  return adminStops.has(id);
}

export function getLastKnown(id) {
  return lastKnown.get(id);
}

export function setLastKnown(id, status) {
  lastKnown.set(id, status);
}

export function getTransient(id) {
  return transient.get(id) ?? null;
}

export function emitStatus(id, status) {
  lastKnown.set(id, status);
  getIo()?.to('status').emit('status:update', { id, status, players: getPlayers(id) });
}

export function setTransient(id, status) {
  transient.set(id, status);
  emitStatus(id, status);
}

export function settleTransient(id, finalStatus) {
  transient.delete(id);
  if (finalStatus) emitStatus(id, finalStatus);
}

export function emitPullProgress(id, payload) {
  getIo()?.to('status').emit('pull:progress', { id, ...payload });
}

export function emitServerEvent(event) {
  logger.info({ event }, 'server event');
  getIo()?.to('status').emit('server:event', event);
}

export function emitCrashAlert(payload) {
  getIo()?.to('status').emit('crash:alert', payload);
}

// Persistent counterpart to crash:alert's one-shot toast — `info` is null
// once the game starts running again or its data is reset.
export function emitCrashUpdate(id, info) {
  getIo()?.to('status').emit('crash:update', { id, info });
}

export function emitDockerStatus(available) {
  getIo()?.to('status').emit('docker:status', { available });
}

export function emitDiskStatus(payload) {
  getIo()?.to('status').emit('disk:status', payload);
}

// Player count/list can change without a status transition (players joining
// while the container just keeps running) — pollStatus emits this on an
// actual change so clients don't need to poll GET /api/servers to see it.
export function emitPlayers(id, players, playerList) {
  getIo()?.to('status').emit('players:update', { id, players, playerList });
}

// Sustained high CPU/memory usage — persists until usage normalizes, unlike
// server:event's resource_high which is a one-shot toast. `alert` is null
// when the condition clears.
export function emitResourceAlert(id, alert) {
  getIo()?.to('status').emit('resource:update', { id, alert });
}

// Persistent counterpart to server:event's one-shot action_failed toast,
// scoped to start/restart failures — see actionFailures.js. `failure` is
// null once the game starts running again.
export function emitActionFailure(id, failure) {
  getIo()?.to('status').emit('action_failure:update', { id, failure });
}
