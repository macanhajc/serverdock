import { useEffect, useRef, useState } from 'react';
import socket from '../../../../socket';
import type { Server, ServerStats } from '../../../../types';

// Joins/leaves the per-server `stats:<id>` socket room as servers start and
// stop running, and tracks the live cpu/mem/network numbers pushed there.
export function useServerStats(servers: Server[]) {
  const [serverStats, setServerStats] = useState<Record<string, ServerStats>>({});
  const [serverStatsHistory, setServerStatsHistory] = useState<
    Record<string, { cpu: number[]; mem: number[] }>
  >({});
  const subscribedIds = useRef(new Set<string>());

  useEffect(() => {
    const runningIds = new Set(servers.filter((s) => s.status === 'running').map((s) => s.id));

    for (const id of runningIds) {
      if (!subscribedIds.current.has(id)) {
        socket.emit('join:stats', { id });
        subscribedIds.current.add(id);
      }
    }

    for (const id of [...subscribedIds.current]) {
      if (!runningIds.has(id)) {
        socket.emit('leave:stats', { id });
        subscribedIds.current.delete(id);
        setServerStats((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setServerStatsHistory((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }, [servers]);

  useEffect(() => {
    function onStatsUpdate({
      id,
      cpu,
      memUsed,
      memLimit,
      netInRate,
      netOutRate,
    }: ServerStats & { id: string }) {
      setServerStats((prev) => ({
        ...prev,
        [id]: { cpu, memUsed, memLimit, netInRate, netOutRate },
      }));
    }
    // Server-side streams die with the connection — re-join after a reconnect
    function rejoinStats() {
      for (const id of subscribedIds.current) {
        socket.emit('join:stats', { id });
      }
    }
    socket.on('stats:update', onStatsUpdate);
    socket.on('connect', rejoinStats);
    return () => {
      socket.off('stats:update', onStatsUpdate);
      socket.off('connect', rejoinStats);
      for (const id of subscribedIds.current) {
        socket.emit('leave:stats', { id });
      }
      subscribedIds.current.clear();
    };
  }, []);

  return { serverStats, serverStatsHistory };
}
