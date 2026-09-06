import { useState, useEffect } from 'react';
import socket from '../socket';

export type BuildStatus = 'none' | 'building' | 'ok' | 'failed';

// Shared build:<id> socket wiring — used by GameForm (build right after Save)
// and ServerDetail's BuildSection (rebuild an already-saved local-image game).
export function useBuildLog(gameId: string | null) {
  const [status, setStatus] = useState<BuildStatus>('none');
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!gameId || status !== 'building') return;

    function onLine({ id, line }: { id: string; line: string }) {
      if (id === gameId) setLog((prev) => [...prev, line]);
    }
    function onComplete({ id }: { id: string }) {
      if (id === gameId) setStatus('ok');
    }
    function onFailed({ id, error }: { id: string; error?: string }) {
      if (id !== gameId) return;
      setStatus('failed');
      if (error) setLog((prev) => [...prev, `Error: ${error}`]);
    }

    socket.on('build:line', onLine);
    socket.on('build:complete', onComplete);
    socket.on('build:failed', onFailed);
    socket.emit('join:build', { id: gameId });

    return () => {
      socket.off('build:line', onLine);
      socket.off('build:complete', onComplete);
      socket.off('build:failed', onFailed);
      socket.emit('leave:build', { id: gameId });
    };
  }, [gameId, status]);

  function startBuild() {
    setLog([]);
    setStatus('building');
  }

  return { status, log, startBuild };
}
