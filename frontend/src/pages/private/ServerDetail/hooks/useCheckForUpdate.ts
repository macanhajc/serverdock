import { useMutation } from '@tanstack/react-query';

export interface UpdateCheckResult {
  updateAvailable: boolean | null;
  reason?: string;
}

// Never rejects — a failed check is itself a result variant ({updateAvailable:
// null, reason: 'check_failed'}), not a mutation error, since the UI has no
// separate error state for this and just renders whatever result comes back.
export function useCheckForUpdate(id: string, token: string | null) {
  return useMutation({
    mutationFn: async (): Promise<UpdateCheckResult> => {
      try {
        const res = await fetch(`/api/games/${id}/check-update`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        return res.ok ? data : { updateAvailable: null, reason: 'check_failed' };
      } catch {
        return { updateAvailable: null, reason: 'check_failed' };
      }
    },
  });
}
