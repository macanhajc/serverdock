// Shared fetch helper for this page's hooks. Like the admin Dashboard's
// dashboardFetch, nothing here needs to tell "server said no" apart from
// "couldn't reach the server" — the original code silently swallowed both.
export async function publicDashboardFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
