import { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import type { Server } from '../../../../types';
import { dashboardFetch } from './dashboardApi';
import { dashboardKeys } from './queryKeys';

type Action = 'start' | 'stop' | 'restart' | 'reset';

// Owns both the start/stop/restart/reset request and the per-server
// "loading" flag it drives — the two are tightly coupled (a status:update
// that settles into a stable state, handled by useServerSocketSync, needs to
// clear the same flag/timer early instead of waiting out the fallback poll),
// so splitting them into separate hooks would just mean threading callbacks
// back and forth for no isolation benefit.
export function useServerAction() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  // Fallback per action in case the socket status:update never arrives (e.g.
  // a dropped connection right after a successful action) — without this the
  // button stays stuck in a loading state forever.
  const actionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(
    () => () => {
      Object.values(actionTimers.current).forEach(clearTimeout);
    },
    []
  );

  const clearActionTimer = useCallback((id: string) => {
    clearTimeout(actionTimers.current[id]);
    delete actionTimers.current[id];
  }, []);

  const clearLoading = useCallback((id: string) => {
    setActionLoading((prev) => {
      if (!(id in prev)) return prev;
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, []);

  const callAction = useCallback(
    async (id: string, action: Action) => {
      setActionLoading((prev) => ({ ...prev, [id]: action }));
      const labels: Record<string, string> = {
        start: t('adminDashboard.actionStart'),
        stop: t('adminDashboard.actionStop'),
        restart: t('adminDashboard.actionRestart'),
        reset: t('adminDashboard.actionReset'),
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
          if (action === 'reset') {
            dashboardFetch<Server>(`/api/servers/${id}`)
              .then((updated) => {
                queryClient.setQueryData<Server[]>(dashboardKeys.servers, (prev) =>
                  prev?.map((s) => (s.id === id ? { ...s, diskUsed: updated.diskUsed } : s))
                );
              })
              .catch(() => {});
          }
          clearActionTimer(id);
          actionTimers.current[id] = setTimeout(() => {
            dashboardFetch<Server>(`/api/servers/${id}`)
              .then((updated) => {
                queryClient.setQueryData<Server[]>(dashboardKeys.servers, (prev) =>
                  prev?.map((s) => (s.id === id ? { ...s, ...updated } : s))
                );
              })
              .catch(() => {})
              .finally(() => {
                delete actionTimers.current[id];
                clearLoading(id);
              });
          }, 15_000);
        } else {
          const data = await res.json().catch(() => ({}));
          addToast(data.error ?? `${action} failed`, 'error');
          clearLoading(id);
        }
      } catch {
        addToast(`${action} failed — could not reach server`, 'error');
        clearLoading(id);
      }
    },
    [token, t, addToast, clearActionTimer, clearLoading, queryClient]
  );

  // Called by useServerSocketSync once a status:update settles into a stable
  // state — clears the loading flag/timer early instead of waiting out the
  // full 15s fallback.
  const onStatusSettled = useCallback(
    (id: string) => {
      clearActionTimer(id);
      clearLoading(id);
    },
    [clearActionTimer, clearLoading]
  );

  return { actionLoading, callAction, onStatusSettled };
}
