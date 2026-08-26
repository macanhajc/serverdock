export function fmtBytes(b: number): string {
  if (!b || b < 1) return '0 B';
  if (b < 1024) return `${Math.round(b)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

// Relative "time ago" string (just now / Nm ago / Nh ago / Nd ago), falling
// back to a plain date past 30 days. `t` is passed in rather than imported so
// this stays a plain util usable outside component scope.
export function timeAgo(
  iso: string | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return t('common.justNow');
  if (diff < 3_600_000) return t('common.mAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('common.hAgo', { count: Math.floor(diff / 3_600_000) });
  if (diff < 30 * 86_400_000) return t('common.dAgo', { count: Math.floor(diff / 86_400_000) });
  return new Date(iso).toLocaleDateString();
}
