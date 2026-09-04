import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export function useDeleteImage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      dockerFetch<{ message: string }>(`/api/docker/images/${encodeURIComponent(id)}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images });
      queryClient.invalidateQueries({ queryKey: dockerKeys.summary });
    },
  });
}
