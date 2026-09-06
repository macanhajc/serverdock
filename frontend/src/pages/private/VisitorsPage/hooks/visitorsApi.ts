// Shared fetch helper for every VisitorsPage hook — attaches the admin JWT
// and distinguishes "server responded with an error" from "couldn't reach
// the server at all", since the UI shows a different message for each. The
// API here doesn't send a useful error body on failure (just {error: "..."}
// generic strings), so unlike AdminsPage's helper this only needs to carry
// the kind, not a message — callers supply their own per-action copy.
export class VisitorApiError extends Error {
  kind: 'validation' | 'network';
  constructor(kind: 'validation' | 'network') {
    super(kind);
    this.kind = kind;
  }
}

export async function visitorsFetch<T>(
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
    throw new VisitorApiError('network');
  }
  if (!res.ok) throw new VisitorApiError('validation');
  return res.json();
}

export function visitorErrorMessage(
  err: unknown,
  t: (key: string) => string,
  validationKey: string
): string {
  if (err instanceof VisitorApiError && err.kind === 'network') return t('visitors.couldNotReach');
  return t(validationKey);
}
