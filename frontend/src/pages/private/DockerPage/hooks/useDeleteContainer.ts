import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { dockerFetch } from './dockerApi';
import { dockerKeys } from './queryKeys';

export function useDeleteContainer() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      dockerFetch<{ message: string }>(`/api/docker/containers/${id}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers });
      queryClient.invalidateQueries({ queryKey: dockerKeys.summary });
      // a container's removal can flip images from in-use to unused
      queryClient.invalidateQueries({ queryKey: dockerKeys.images });
    },
  });
}
