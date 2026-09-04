// Shared fetch helper for every AdminsPage hook — attaches the admin JWT and
// distinguishes "server responded with an error" from "couldn't reach the
// server at all", since the UI shows a different message for each.
export class AdminApiError extends Error {
  kind: 'validation' | 'network';
  constructor(message: string, kind: 'validation' | 'network') {
    super(message);
    this.kind = kind;
  }
}

export async function adminsFetch<T>(
  url: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AdminApiError('', 'network');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AdminApiError(body.error ?? '', 'validation');
  }
  return res.json();
}

// Resolves a mutation's caught error into the message the UI should show, or
// null if there's nothing to show yet (no error). Network errors always get
// the generic "couldn't reach" copy; validation errors show the server's
// message, falling back to the caller's default when the server sent none.
export function adminErrorMessage(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
  fallbackKey: string
): string | null {
  if (!(err instanceof AdminApiError)) return null;
  if (err.kind === 'network') return t('admins.couldNotReach');
  return err.message || t(fallbackKey);
}
