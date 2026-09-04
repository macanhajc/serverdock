import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';

// Config + Dockerfile only — no data/, matches the shape produced by a
// game's own Export button.
export function useImportGame() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (bundle: unknown) => {
      const res = await fetch('/api/games/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '');
      return data as { id: string };
    },
  });
}
