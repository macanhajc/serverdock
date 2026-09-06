import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ScheduleEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

export function useRunScheduleNow(id: string, token: string | null) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string): Promise<ScheduleEntry> => {
      const res = await fetch(`/api/schedules/${id}/${scheduleId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!(res.ok && data.id)) throw new Error(data.error ?? t('serverDetail.scheduleRunFailed'));
      return data;
    },
    // Refetch regardless of outcome — a failed run can still update the
    // schedule's lastRun (ok: false), which the original patched in from the
    // failure response; invalidating covers both that and the success path.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.schedules(id) });
    },
  });
}
