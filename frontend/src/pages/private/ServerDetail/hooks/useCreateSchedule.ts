import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ScheduleEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

export function useCreateSchedule(id: string, token: string | null) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>): Promise<ScheduleEntry> => {
      let res: Response;
      try {
        res = await fetch(`/api/schedules/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error(t('serverDetail.scheduleNetworkError'));
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t('serverDetail.scheduleCreateFailed'));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.schedules(id) });
    },
  });
}
