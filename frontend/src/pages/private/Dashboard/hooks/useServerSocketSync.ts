import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import socket from '../../../../socket';
import { STABLE } from '../../../../utils/serverStatus';
import type {
  Server,
  PullProgress,
  ResourceAlert,
  CrashInfo,
  ActionFailureInfo,
} from '../../../../types';
import { dashboardKeys } from './queryKeys';

// Merges the live status/players/stats-alert events pushed over the
// `status` socket room directly into the useServers query cache, so the
// fetched list and the live view can never drift apart into two competing
// sources of truth.
export function useServerSocketSync(onStatusSettled: (id: string) => void) {
  const queryClient = useQueryClient();
  const [pullProgress, setPullProgress] = useState<Record<string, PullProgress>>({});

  useEffect(() => {
    function patch(updater: (prev: Server[]) => Server[]) {
      queryClient.setQueryData<Server[]>(dashboardKeys.servers, (prev) =>
        prev ? updater(prev) : prev
      );
    }

    function onStatusUpdate({
      id,
      status,
      players,
    }: {
      id: string;
      status: Server['status'];
      players: number | null;
    }) {
      patch((prev) =>
        prev.map((s) =>
          s.id === id
            ? // null players on a non-running server means "no players", not "unknown"
              { ...s, status, players: status === 'running' ? (players ?? s.players) : players }
            : s
        )
      );
      if (status !== 'pulling') {
        setPullProgress((prev) => {
          if (!(id in prev)) return prev;
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }
      if (STABLE.includes(status)) onStatusSettled(id);
    }

    function onPullProgress({ id, phase, percent }: PullProgress & { id: string }) {
      setPullProgress((prev) => ({ ...prev, [id]: { phase, percent } }));
    }

    function onStatusAll(
      snapshot: Array<{
        id: string;
        status: Server['status'];
        players: number | null;
        resourceAlert?: ResourceAlert | null;
        lastCrash?: CrashInfo | null;
        actionFailure?: ActionFailureInfo | null;
      }>
    ) {
      patch((prev) => {
        const map = new Map(snapshot.map((u) => [u.id, u]));
        return prev.map((s) => {
          const u = map.get(s.id);
          if (!u) return s;
          const players = u.status === 'running' ? (u.players ?? s.players) : u.players;
          return {
            ...s,
            status: u.status,
            players,
            resourceAlert: u.resourceAlert ?? null,
            lastCrash: u.lastCrash ?? null,
            actionFailure: u.actionFailure ?? null,
          };
        });
      });
    }

    // Sustained high CPU/memory — persists until usage normalizes; see
    // statusBus.emitResourceAlert.
    function onResourceUpdate({ id: rid, alert }: { id: string; alert: ResourceAlert | null }) {
      patch((prev) => prev.map((s) => (s.id === rid ? { ...s, resourceAlert: alert } : s)));
    }

    // Last unexpected-exit info — persists until the next successful start
    // (or a reset); see statusBus.emitCrashUpdate.
    function onCrashUpdate({ id: cid, info }: { id: string; info: CrashInfo | null }) {
      patch((prev) => prev.map((s) => (s.id === cid ? { ...s, lastCrash: info } : s)));
    }

    // Failed start/restart attempt — persists until the next successful
    // start; see statusBus.emitActionFailure.
    function onActionFailureUpdate({
      id: fid,
      failure,
    }: {
      id: string;
      failure: ActionFailureInfo | null;
    }) {
      patch((prev) => prev.map((s) => (s.id === fid ? { ...s, actionFailure: failure } : s)));
    }

    // Player count/list can change without a status transition (players
    // joining a still-running server) — see statusBus.emitPlayers.
    function onPlayersUpdate({
      id,
      players,
      playerList,
    }: {
      id: string;
      players: number | null;
      playerList: string | null;
    }) {
      patch((prev) => prev.map((s) => (s.id === id ? { ...s, players, playerList } : s)));
    }

    socket.on('status:update', onStatusUpdate);
    socket.on('status:all', onStatusAll);
    socket.on('players:update', onPlayersUpdate);
    socket.on('resource:update', onResourceUpdate);
    socket.on('crash:update', onCrashUpdate);
    socket.on('action_failure:update', onActionFailureUpdate);
    socket.on('pull:progress', onPullProgress);
    // join:status refreshes the snapshot; room membership is kept by ServerEventsBridge
    socket.emit('join:status');

    return () => {
      socket.off('status:update', onStatusUpdate);
      socket.off('status:all', onStatusAll);
      socket.off('players:update', onPlayersUpdate);
      socket.off('resource:update', onResourceUpdate);
      socket.off('crash:update', onCrashUpdate);
      socket.off('action_failure:update', onActionFailureUpdate);
      socket.off('pull:progress', onPullProgress);
    };
  }, [queryClient, onStatusSettled]);

  return { pullProgress };
}
