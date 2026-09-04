// Shared by ScheduleTab (last-run timestamps) and BackupTab (backup created
// time) — deliberately not the app-wide, translated utils/format.ts#timeAgo:
// this one has a seconds-level tier that timeAgo doesn't, and (matching both
// call sites' pre-existing behavior) isn't run through t().
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
