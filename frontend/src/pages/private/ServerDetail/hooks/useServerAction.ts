import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import type { Server } from '../../../../types';
import { serverDetailFetch } from './serverDetailApi';
import { serverDetailKeys } from './queryKeys';

type Action = 'start' | 'stop' | 'restart' | 'reset';

// Owns the start/stop/restart/reset request and the loading/error state it
// drives. Unlike Dashboard's per-row toasts, this page shows action failures
// as a dismissible banner — that's an intentional UI difference, not an
// oversight, so it's kept here rather than reusing Dashboard's toast pattern.
export function useServerAction(id: string | undefined) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Fallback in case the socket status:update (or log:end) never arrives —
  // without this the action buttons stay stuck disabled forever.
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(actionTimer.current), []);

  const onStatusSettled = useCallback(() => {
    clearTimeout(actionTimer.current);
    setActionLoading(null);
  }, []);

  const callAction = useCallback(
    async (action: Action) => {
      setActionLoading(action);
      setActionError(null);
      const labels: Record<string, string> = {
        start: t('serverDetail.actionStart'),
        stop: t('serverDetail.actionStop'),
        restart: t('serverDetail.actionRestart'),
        reset: t('serverDetail.actionReset'),
      };
      try {
        const body = action === 'reset' ? { confirm: true } : {};
        const res = await fetch(`/api/servers/${id}/${action}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          addToast(labels[action] ?? 'Done');
          clearTimeout(actionTimer.current);
          actionTimer.current = setTimeout(() => {
            serverDetailFetch<Server>(`/api/servers/${id}`, token)
              .then((updated) => {
                queryClient.setQueryData<Server>(serverDetailKeys.server(id), (prev) =>
                  prev ? { ...prev, ...updated } : prev
                );
              })
              .catch(() => {})
              .finally(() => setActionLoading(null));
          }, 15_000);
        } else {
          const data = await res.json().catch(() => ({}));
          setActionError(data.error ?? `${action} failed`);
          setActionLoading(null);
        }
      } catch {
        setActionError(`${action} failed — could not reach server`);
        setActionLoading(null);
      }
    },
    [id, token, t, addToast, queryClient]
  );

  return {
    actionLoading,
    actionError,
    clearActionError: () => setActionError(null),
    callAction,
    onStatusSettled,
  };
}
