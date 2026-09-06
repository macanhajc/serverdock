import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import socket from '../../../../socket';
import type { Server } from '../../../../types';
import { publicDashboardKeys } from './queryKeys';

// Merges the live status/players events pushed over the `status` socket room
// directly into the useServers query cache. Unlike the admin Dashboard's
// version (kept alive across navigation by ServerEventsBridge), an anonymous
// visitor has no guaranteed persistent connection, so this hook owns its own
// connect/join/leave lifecycle instead of assuming the room is already
// joined.
export function useServerSocketSync(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    function patch(updater: (prev: Server[]) => Server[]) {
      queryClient.setQueryData<Server[]>(publicDashboardKeys.servers, (prev) =>
        prev ? updater(prev) : prev
      );
    }

    function onStatusAll(
      snapshot: Array<{
        id: string;
        status: Server['status'];
        players: number | null;
        playerList?: string | null;
      }>
    ) {
      patch((prev) => {
        const map = new Map(snapshot.map((u) => [u.id, u]));
        return prev.map((s) => {
          const u = map.get(s.id);
          if (!u) return s;
          const players = u.status === 'running' ? (u.players ?? s.players) : u.players;
          return { ...s, status: u.status, players, playerList: u.playerList ?? s.playerList };
        });
      });
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
            ? { ...s, status, players: status === 'running' ? (players ?? s.players) : players }
            : s
        )
      );
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

    socket.on('status:all', onStatusAll);
    socket.on('status:update', onStatusUpdate);
    socket.on('players:update', onPlayersUpdate);

    // Reuses the app's one shared connection (see socket.ts) instead of
    // opening a second transport — an already-authenticated admin landing
    // here keeps their connection, and an anonymous visitor connects it here.
    if (!socket.connected) socket.connect();
    socket.emit('join:status');

    return () => {
      socket.off('status:all', onStatusAll);
      socket.off('status:update', onStatusUpdate);
      socket.off('players:update', onPlayersUpdate);
      socket.emit('leave:status');
    };
  }, [enabled, queryClient]);
}
