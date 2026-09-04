import { useMutation } from '@tanstack/react-query';

export type VisitorRegisterResult =
  | { kind: 'ok'; token: string }
  | { kind: 'blocked' }
  | { kind: 'registrationClosed' }
  | { kind: 'error'; error?: string }
  | { kind: 'networkError' };

// Modeled as a discriminated result rather than throw/succeed — a 403 here
// splits into two genuinely different outcomes (blocked vs. registration
// closed) that the caller needs to tell apart, so a single error channel
// wouldn't fit.
export function useVisitorRegister() {
  return useMutation({
    mutationFn: async (username: string): Promise<VisitorRegisterResult> => {
      let res: Response;
      try {
        res = await fetch('/api/visitors/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
      } catch {
        return { kind: 'networkError' };
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        return data.error === 'blocked' ? { kind: 'blocked' } : { kind: 'registrationClosed' };
      }
      if (!res.ok) return { kind: 'error', error: data.error };
      return { kind: 'ok', token: data.token };
    },
  });
}
