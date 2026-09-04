// Shared fetch helper for every DockerPage hook — attaches the admin JWT and
// throws with the server's error message so react-query's error state carries it.
export async function dockerFetch<T>(
  url: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? '');
  }
  return res.json();
}
