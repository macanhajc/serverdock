import { useState, useEffect, useRef } from 'react';

export function fmtUptime(startedAt: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function UptimeTicker({ startedAt }: { startedAt: string }) {
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    timer.current = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer.current!);
  }, [startedAt]);

  return <>{fmtUptime(startedAt)}</>;
}
