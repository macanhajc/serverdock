import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScheduleEntry } from '../../../../types';
import { serverDetailKeys } from './queryKeys';

// Shared by both the edit-form save and the enabled-toggle — same endpoint,
// different payload shape. Error fallback wording is the caller's job (via
// onError), since the two call sites want slightly different default text.
export function useUpdateSchedule(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scheduleId,
      payload,
    }: {
      scheduleId: string;
      payload: Record<string, unknown>;
    }): Promise<ScheduleEntry> => {
      const res = await fetch(`/api/schedules/${id}/${scheduleId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.schedules(id) });
    },
  });
}
