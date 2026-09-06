// Shared fetch helper for Dashboard hooks. Unlike AdminsPage/VisitorsPage,
// nothing here needs to tell "server said no" apart from "couldn't reach the
// server" — the original code never made that distinction either, it just
// has one loadError flag for the servers list and silently no-ops elsewhere.
export async function dashboardFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
