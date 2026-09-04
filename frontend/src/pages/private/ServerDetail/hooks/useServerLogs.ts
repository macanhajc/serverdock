import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import socket from '../../../../socket';
import type { LogLine, Server } from '../../../../types';

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

function nowTs(): string {
  return new Date().toTimeString().slice(0, 8);
}

function fmtTs(iso?: string): string {
  if (!iso) return nowTs();
  const d = new Date(iso);
  return isNaN(d.getTime()) ? nowTs() : d.toTimeString().slice(0, 8);
}

// Cap kept log lines so a chatty server left open doesn't grow memory/renders forever
const MAX_LOG_LINES = 2000;

function appendCapped(prev: LogLine[], items: LogLine[]): LogLine[] {
  const next = prev.concat(items);
  return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
}

// Container output — deliberately owned above the Console tab (called from
// index.tsx, passed down) so it keeps accumulating while other tabs are open
// and survives switching between tabs.
export function useServerLogs(
  id: string | undefined,
  status: Server['status'] | undefined,
  onLogEnd: () => void
) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<LogLine[]>([]);
  // Newest docker timestamp seen — lets log:history replays skip lines we already have
  const lastLogIso = useRef('');
  // Keep `t` out of the effect's deps (react-i18next can change its identity,
  // which would needlessly re-join the room) while still reading the current value
  const tRef = useRef(t);
  tRef.current = t;
  const onLogEndRef = useRef(onLogEnd);
  onLogEndRef.current = onLogEnd;
  const prevStatus = useRef(status);

  useEffect(() => {
    if (!id) return;

    function onLogLine({
      id: lid,
      line,
      level,
      ts,
    }: {
      id: string;
      line: string;
      level?: string;
      ts?: string;
    }) {
      if (lid !== id) return;
      if (ts && ts > lastLogIso.current) lastLogIso.current = ts;
      setLines((prev) =>
        appendCapped(prev, [
          { ts: fmtTs(ts), level: (level ?? 'info').toUpperCase(), line: stripAnsi(line) },
        ])
      );
    }

    function onLogHistory({
      id: lid,
      lines: history,
    }: {
      id: string;
      lines: Array<{ ts: string; line: string; level?: string }>;
    }) {
      if (lid !== id) return;
      // Only lines newer than what we've already shown (re-joins replay the full buffer)
      const fresh = history.filter((l) => l.ts > lastLogIso.current);
      if (!fresh.length) return;
      lastLogIso.current = fresh[fresh.length - 1].ts;
      setLines((prev) =>
        appendCapped(
          prev,
          fresh.map((l) => ({
            ts: fmtTs(l.ts),
            level: (l.level ?? 'info').toUpperCase(),
            line: stripAnsi(l.line),
          }))
        )
      );
    }

    function onLogEnd({ id: lid }: { id: string }) {
      if (lid !== id) return;
      setLines((prev) =>
        appendCapped(prev, [
          { ts: nowTs(), level: 'DEBUG', line: tRef.current('serverDetail.containerStopped') },
        ])
      );
      onLogEndRef.current();
    }

    function onReconnect() {
      socket.emit('join:logs', { id });
    }

    socket.on('log:line', onLogLine);
    socket.on('log:history', onLogHistory);
    socket.on('log:end', onLogEnd);
    socket.on('connect', onReconnect);
    socket.emit('join:logs', { id });

    return () => {
      socket.off('log:line', onLogLine);
      socket.off('log:history', onLogHistory);
      socket.off('log:end', onLogEnd);
      socket.off('connect', onReconnect);
      socket.emit('leave:logs', { id });
    };
  }, [id]);

  // A fresh run means a fresh container process — re-join to get that run's
  // log buffer rather than whatever the previous run left behind.
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (!id) return;
    if (was && was !== 'running' && status === 'running') {
      socket.emit('leave:logs', { id });
      socket.emit('join:logs', { id });
    }
  }, [id, status]);

  return { lines, setLines };
}
