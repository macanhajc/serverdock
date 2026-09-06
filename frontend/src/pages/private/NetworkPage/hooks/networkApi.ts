// Shared fetch helper for NetworkPage hooks — attaches the admin JWT and
// carries the HTTP status code so callers can tell a 401 (unauthorized) apart
// from any other failure (daemon/network unreachable), since the UI shows a
// different message for each.
export class VpnApiError extends Error {
  status: number;
  constructor(status: number) {
    super(String(status));
    this.status = status;
  }
}

export async function vpnFetch<T>(url: string, token: string | null): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new VpnApiError(res.status);
  return res.json();
}

export function vpnErrorMessage(err: unknown, t: (key: string) => string): string | null {
  if (!err) return null;
  if (err instanceof VpnApiError && err.status === 401) return t('network.unauthorized');
  return t('network.couldNotReach');
}
