import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serverDetailKeys } from './queryKeys';

export function useDeleteSchedule(id: string, token: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/schedules/${id}/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serverDetailKeys.schedules(id) });
    },
  });
}
