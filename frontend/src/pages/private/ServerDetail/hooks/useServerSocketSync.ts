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
import { serverDetailKeys } from './queryKeys';

// Merges the live status/players/resource/crash/action-failure events pushed
// over the `status` socket room directly into the useServer query cache.
// Doesn't touch the logs or stats rooms — those are separate concerns with
// their own transition-driven rejoin logic (see useServerLogs/useServerStats).
export function useServerSocketSync(id: string | undefined, onStatusSettled: () => void) {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState<PullProgress | null>(null);

  useEffect(() => {
    if (!id) return;

    function patch(updater: (prev: Server) => Server) {
      queryClient.setQueryData<Server>(serverDetailKeys.server(id), (prev) =>
        prev ? updater(prev) : prev
      );
    }

    function onStatusUpdate({
      id: sid,
      status,
      players,
    }: {
      id: string;
      status: Server['status'];
      players: number | null;
    }) {
      if (sid !== id) return;
      patch((prev) => ({
        ...prev,
        status,
        players: status === 'running' ? (players ?? prev.players) : players,
      }));
      if (status !== 'pulling') setPull(null);
      if (STABLE.includes(status)) onStatusSettled();
    }

    function onPullProgress({ id: pid, phase, percent }: PullProgress & { id: string }) {
      if (pid !== id) return;
      setPull({ phase, percent });
    }

    // Player count/list can change without a status transition (players
    // joining a still-running server) — see statusBus.emitPlayers.
    function onPlayersUpdate({
      id: pid,
      players,
      playerList,
    }: {
      id: string;
      players: number | null;
      playerList: string | null;
    }) {
      if (pid !== id) return;
      patch((prev) => ({ ...prev, players, playerList }));
    }

    // Sustained high CPU/memory — persists until usage normalizes; see
    // statusBus.emitResourceAlert.
    function onResourceUpdate({ id: rid, alert }: { id: string; alert: ResourceAlert | null }) {
      if (rid !== id) return;
      patch((prev) => ({ ...prev, resourceAlert: alert }));
    }

    // Last unexpected-exit info — persists until the next successful start
    // (or a reset); see statusBus.emitCrashUpdate.
    function onCrashUpdate({ id: cid, info }: { id: string; info: CrashInfo | null }) {
      if (cid !== id) return;
      patch((prev) => ({ ...prev, lastCrash: info }));
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
      if (fid !== id) return;
      patch((prev) => ({ ...prev, actionFailure: failure }));
    }

    // Server-side streams die with the connection — re-join after a reconnect
    function onReconnect() {
      socket.emit('join:status');
    }

    socket.on('status:update', onStatusUpdate);
    socket.on('players:update', onPlayersUpdate);
    socket.on('resource:update', onResourceUpdate);
    socket.on('crash:update', onCrashUpdate);
    socket.on('action_failure:update', onActionFailureUpdate);
    socket.on('pull:progress', onPullProgress);
    socket.on('connect', onReconnect);
    // join:status refreshes the snapshot; room membership is kept by ServerEventsBridge
    socket.emit('join:status');

    return () => {
      socket.off('status:update', onStatusUpdate);
      socket.off('players:update', onPlayersUpdate);
      socket.off('resource:update', onResourceUpdate);
      socket.off('crash:update', onCrashUpdate);
      socket.off('action_failure:update', onActionFailureUpdate);
      socket.off('pull:progress', onPullProgress);
      socket.off('connect', onReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { pull };
}
