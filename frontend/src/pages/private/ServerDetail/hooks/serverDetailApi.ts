// Shared fetch helper for every ServerDetail hook (main page + all tabs) —
// attaches the admin JWT when present and throws with the server's error
// message on failure. GET /api/servers/:id itself is a public endpoint (no
// JWT required), so token is optional here, unlike the tab-specific routes
// which all require one.
export async function serverDetailFetch<T>(
  url: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? '');
  }
  return res.json();
}
