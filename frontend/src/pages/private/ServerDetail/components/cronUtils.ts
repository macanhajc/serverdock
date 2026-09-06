export { relativeTime } from './relativeTime';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function dayName(dow: number, lang: string): string {
  const d = new Date(Date.UTC(2023, 0, 1 + dow)); // 2023-01-01 was a Sunday
  return new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(d);
}

export function previewCron(expr: string, t: TFunc, lang: string): string {
  const parts = (expr ?? '').trim().split(/\s+/);
  if (parts.length !== 5) return t('serverDetail.cronCustom');
  const [min, hour, dom, month, dow] = parts;
  if (/^\*\/\d+$/.test(min) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(min.slice(2), 10);
    if (n > 0) return t('serverDetail.cronEveryNMinutes', { count: n });
  }
  if (min === '0' && /^\*\/\d+$/.test(hour) && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour.slice(2), 10);
    if (h > 0) return t('serverDetail.cronEveryNHours', { count: h });
  }
  if (min === '0' && /^\d{1,2}$/.test(hour) && dom === '*' && month === '*' && /^\d$/.test(dow)) {
    const h = parseInt(hour, 10);
    const d = parseInt(dow, 10);
    if (h >= 0 && h <= 23 && d >= 0 && d <= 6)
      return t('serverDetail.cronWeeklyAt', {
        day: dayName(d, lang),
        time: `${String(h).padStart(2, '0')}:00`,
      });
  }
  if (min === '0' && /^\d{1,2}$/.test(hour) && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour, 10);
    if (h >= 0 && h <= 23)
      return t('serverDetail.cronDailyAt', { time: `${String(h).padStart(2, '0')}:00` });
  }
  return t('serverDetail.cronCustom');
}

export const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  start: { color: 'var(--green)', bg: 'color-mix(in oklab, var(--green)  12%, transparent)' },
  stop: { color: 'var(--red)', bg: 'color-mix(in oklab, var(--red)    12%, transparent)' },
  restart: { color: 'var(--yellow)', bg: 'color-mix(in oklab, var(--yellow) 12%, transparent)' },
  command: { color: 'var(--accent)', bg: 'color-mix(in oklab, var(--accent) 12%, transparent)' },
  backup: { color: 'var(--ink-2)', bg: 'color-mix(in oklab, var(--ink-2)  12%, transparent)' },
};

export function relativeFuture(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '<1m';
  const m = Math.ceil(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export const CRON_FIELDS = [
  { key: 'cronFieldMinute', range: '0–59' },
  { key: 'cronFieldHour', range: '0–23' },
  { key: 'cronFieldDay', range: '1–31' },
  { key: 'cronFieldMonth', range: '1–12' },
  { key: 'cronFieldWeekday', range: '0–6' },
];

export const CRON_EXAMPLES = ['0 4 * * *', '0 */6 * * *', '0 3 * * 0', '*/30 * * * *'];
