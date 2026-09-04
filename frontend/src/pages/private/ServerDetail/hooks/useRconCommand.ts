import { useMutation } from '@tanstack/react-query';

// Multiple commands can be in flight at once (the admin can send another
// before the first responds) — this hook only wraps the raw request; the
// caller (ConsoleTab) keeps its own seq-keyed history so each row resolves
// independently regardless of response order, which a single useMutation's
// data/error/isPending can't represent on its own.
export function useRconCommand(id: string, token: string | null) {
  return useMutation({
    mutationFn: async (command: string): Promise<string | null> => {
      let res: Response;
      try {
        res = await fetch(`/api/servers/${id}/rcon`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });
      } catch {
        throw new Error('Could not reach server');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Command failed');
      return data.response ?? null;
    },
  });
}
