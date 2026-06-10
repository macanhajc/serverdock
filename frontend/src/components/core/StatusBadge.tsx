import { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

type BadgeStatus =
  | 'online'
  | 'offline'
  | 'error'
  | 'starting'
  | 'stopping'
  | 'pulling'
  | 'built'
  | 'building'
  | 'none';

interface StatusStyle {
  color: string;
  edge: string | null;
  fill: string;
  halo?: boolean;
  pulse?: boolean;
  dashed?: boolean;
}

const STATUS_STYLE: Record<BadgeStatus, StatusStyle> = {
  online: { color: 'var(--green)', edge: 'var(--green)', fill: 'var(--fill-online)', halo: true },
  offline: { color: 'var(--red)', edge: 'var(--red)', fill: 'var(--fill-offline)' },
  error: { color: 'var(--yellow)', edge: 'var(--yellow)', fill: 'var(--fill-pending)' },
  starting: {
    color: 'var(--yellow)',
    edge: 'var(--yellow)',
    fill: 'var(--fill-pending)',
    pulse: true,
  },
  stopping: {
    color: 'var(--yellow)',
    edge: 'var(--yellow)',
    fill: 'var(--fill-pending)',
    pulse: true,
  },
  pulling: {
    color: 'var(--yellow)',
    edge: 'var(--yellow)',
    fill: 'var(--fill-pending)',
    pulse: true,
  },
  built: { color: 'var(--ink-2)', edge: null, fill: 'var(--bg-2)' },
  building: {
    color: 'var(--yellow)',
    edge: 'var(--yellow)',
    fill: 'var(--fill-pending)',
    pulse: true,
  },
  none: { color: 'var(--ink-3)', edge: null, fill: 'transparent', dashed: true },
};

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  label?: string;
}

export function StatusBadge({
  status = 'offline',
  label,
  children,
  className = '',
  style,
  ...rest
}: StatusBadgeProps) {
  const { t } = useTranslation();
  const s = STATUS_STYLE[status] || STATUS_STYLE.offline;
  const defaultLabel = t(`status.${status}`, { defaultValue: status });
  const text = children || label || defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[8px] font-semibold tracking-wider uppercase whitespace-nowrap px-1.5 py-1 ${className}`}
      style={{
        color: s.color,
        background: s.fill,
        border: `1px ${s.dashed ? 'dashed' : 'solid'} ${s.edge ? `color-mix(in oklab, ${s.edge} 45%, transparent)` : 'var(--line-2)'}`,
        ...style,
      }}
      {...rest}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{
          background:
            s.color === 'var(--ink-2)' || s.color === 'var(--ink-3)' ? 'var(--ink-3)' : s.color,
          boxShadow: s.halo ? `0 0 0 3px color-mix(in oklab, ${s.color} 22%, transparent)` : 'none',
          animation: s.pulse ? 'ds-blink 1s steps(2,start) infinite' : 'none',
        }}
      />
      {text}
    </span>
  );
}
