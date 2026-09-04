import { useMutation } from '@tanstack/react-query';

export type AdminLoginResult =
  | { kind: 'ok'; token: string }
  | { kind: 'error'; error?: string }
  | { kind: 'networkError' };

export function useAdminLogin() {
  return useMutation({
    mutationFn: async ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }): Promise<AdminLoginResult> => {
      let res: Response;
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
      } catch {
        return { kind: 'networkError' };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { kind: 'error', error: data.error };
      return { kind: 'ok', token: data.token };
    },
  });
}
