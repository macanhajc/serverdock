// Shared fetch helper for every SettingsPage hook — attaches the admin JWT
// and surfaces the server's `{error}` message when present. Settings never
// distinguished network-unreachable from a validation error (every call site
// just fell back to one generic per-action toast), so unlike AdminsPage this
// doesn't need a `kind` — only the message matters.
export class SettingsApiError extends Error {}

export async function settingsFetch<T>(
  url: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!res || !res.ok) {
    const body = await res?.json().catch(() => ({}));
    throw new SettingsApiError(body?.error ?? '');
  }
  // A couple of endpoints (test-discord, push subscribe/test) reply 200 with
  // no useful body — treat an empty/non-JSON body as success with no data.
  return res.json().catch(() => undefined) as Promise<T>;
}

export function settingsErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SettingsApiError && err.message ? err.message : fallback;
}
