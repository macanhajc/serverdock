import { useEffect, useRef, useState } from 'react';
import socket from '../../../../socket';
import type { ServerStats, Server } from '../../../../types';

const HISTORY_LEN = 60;

export function useServerStats(id: string | undefined, status: Server['status'] | undefined) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (!id) return;

    function onStatsUpdate({
      id: sid,
      cpu,
      memUsed,
      memLimit,
      netInRate,
      netOutRate,
    }: ServerStats & { id: string }) {
      if (sid !== id) return;
      setStats({ cpu, memUsed, memLimit, netInRate, netOutRate });
      setCpuHistory((prev) => {
        const next = [...prev, cpu];
        return next.length > HISTORY_LEN ? next.slice(next.length - HISTORY_LEN) : next;
      });
      setMemHistory((prev) => {
        const next = [...prev, memUsed];
        return next.length > HISTORY_LEN ? next.slice(next.length - HISTORY_LEN) : next;
      });
    }

    function onReconnect() {
      socket.emit('join:stats', { id });
    }

    socket.on('stats:update', onStatsUpdate);
    socket.on('connect', onReconnect);
    socket.emit('join:stats', { id });

    return () => {
      socket.off('stats:update', onStatsUpdate);
      socket.off('connect', onReconnect);
      socket.emit('leave:stats', { id });
    };
  }, [id]);

  // A fresh run starts a fresh chart — clear whatever the previous run left
  // behind rather than let it bleed into the new one; a stop clears the
  // panel back to its "no live data" state.
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (!id) return;
    if (was && was !== 'running' && status === 'running') {
      socket.emit('leave:stats', { id });
      socket.emit('join:stats', { id });
      setCpuHistory([]);
      setMemHistory([]);
    }
    if (was === 'running' && status !== 'running') {
      setStats(null);
      setCpuHistory([]);
      setMemHistory([]);
    }
  }, [id, status]);

  return { stats, cpuHistory, memHistory };
}
