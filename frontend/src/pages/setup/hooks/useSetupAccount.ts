import { useMutation } from '@tanstack/react-query';

export type SetupAccountResult =
  | { kind: 'ok'; token: string }
  | { kind: 'alreadySetup' }
  | { kind: 'error'; error?: string }
  | { kind: 'networkError' };

// Modeled as a discriminated result rather than throw/succeed — a 409 here
// means setup already ran (the caller bounces to /auth instead of showing an
// error), a distinct outcome from a validation rejection. Fetch and JSON
// parsing share one try/catch, same as the original: a malformed response
// is indistinguishable from a network failure here.
export function useSetupAccount() {
  return useMutation({
    mutationFn: async ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }): Promise<SetupAccountResult> => {
      try {
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (res.status === 409) return { kind: 'alreadySetup' };
        if (!res.ok) return { kind: 'error', error: data.error };
        return { kind: 'ok', token: data.token };
      } catch {
        return { kind: 'networkError' };
      }
    },
  });
}
