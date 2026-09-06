import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import type { NetworkProviderId } from '../../../types';

// Best-effort — swallows any failure internally so the wizard always moves
// on to finishSetup() regardless of outcome; worst case the admin adjusts
// the provider later in Settings.
export function useSaveNetworkProvider() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (networkProvider: NetworkProviderId) => {
      try {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ networkProvider }),
        });
      } catch {
        // Best-effort — worst case they adjust it later in Settings.
      }
    },
  });
}
