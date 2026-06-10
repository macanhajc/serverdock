import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import socket from '../../socket';
import { useToast } from '../../context/ToastContext';

interface ExitInfo {
  exitCode: number | null;
  oomKilled: boolean;
  error: string | null;
}

interface CrashAlert {
  id: string;
  name: string;
  status: string;
  exitInfo?: ExitInfo | null;
}

interface ServerEvent {
  type: string;
  id: string;
  name: string;
  action?: string;
  label?: string;
  message?: string;
}

// Mounted once in the admin layout: keeps the socket joined to the status room
// across page navigation and reconnects, and turns every backend event —
// crashes, failed actions, schedule results, build outcomes, Docker loss —
// into something the admin can see no matter which page is open.
export function ServerEventsBridge() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [dockerDown, setDockerDown] = useState(false);

  useEffect(() => {
    function joinStatus() {
      socket.emit('join:status');
    }

    function onCrash({ name, exitInfo }: CrashAlert) {
      let detail = '';
      if (exitInfo?.oomKilled) detail = ` — ${t('events.oom')}`;
      else if (exitInfo?.error) detail = ` — ${exitInfo.error}`;
      else if (exitInfo?.exitCode != null && exitInfo.exitCode !== 0)
        detail = ` — ${t('events.exitCode', { code: exitInfo.exitCode })}`;
      addToast(t('events.crashed', { name }) + detail, 'error');
    }

    function onServerEvent(evt: ServerEvent) {
      const action = evt.action
        ? t(`events.actions.${evt.action}`, { defaultValue: evt.action })
        : '';
      switch (evt.type) {
        case 'action_failed':
          addToast(
            t('events.actionFailed', { name: evt.name, action, message: evt.message }),
            'error'
          );
          break;
        case 'schedule_failed':
          addToast(
            t('events.scheduleFailed', { name: evt.name, label: evt.label, message: evt.message }),
            'error'
          );
          break;
        case 'schedule_executed':
          addToast(t('events.scheduleExecuted', { name: evt.name, action }), 'info');
          break;
        case 'build_failed':
          addToast(t('events.buildFailed', { name: evt.name, message: evt.message }), 'error');
          break;
        case 'build_complete':
          addToast(t('events.buildComplete', { name: evt.name }), 'success');
          break;
      }
    }

    function onDockerStatus({ available }: { available: boolean }) {
      setDockerDown(!available);
    }

    function onSocketError({ message }: { message?: string } = {}) {
      if (message) addToast(message, 'error');
    }

    socket.on('connect', joinStatus);
    socket.on('crash:alert', onCrash);
    socket.on('server:event', onServerEvent);
    socket.on('docker:status', onDockerStatus);
    socket.on('error', onSocketError);
    joinStatus();

    // Initial Docker state — socket events only report transitions after this point
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { docker?: string } | null) => {
        if (d && d.docker !== 'connected') setDockerDown(true);
      })
      .catch(() => {});

    return () => {
      socket.off('connect', joinStatus);
      socket.off('crash:alert', onCrash);
      socket.off('server:event', onServerEvent);
      socket.off('docker:status', onDockerStatus);
      socket.off('error', onSocketError);
    };
  }, [t, addToast]);

  if (!dockerDown) return null;

  return (
    <div
      className="fixed bottom-0 left-52 right-0 z-40 flex items-center gap-2 px-4 py-2 font-mono text-[11.5px] text-red border-t"
      style={{
        background: 'color-mix(in oklab, var(--red) 10%, var(--bg-1))',
        borderColor: 'color-mix(in oklab, var(--red) 40%, transparent)',
      }}
    >
      <span>⚠</span>
      <span>{t('events.dockerDown')}</span>
    </div>
  );
}
