import { HTMLAttributes } from 'react';

type SegmentedOption = string | { label: string; value: string };

interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options?: SegmentedOption[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SegmentedControl({
  options = [],
  value,
  onChange,
  className = '',
  disabled = false,
  ...rest
}: SegmentedControlProps) {
  const opts = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));
  return (
    <div className={`inline-flex border border-line-2 ${className}`} {...rest}>
      {opts.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(o.value)}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-r border-line-2 last:border-r-0 ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${active ? 'bg-(--accent-dim) text-ink' : 'bg-bg-1 text-ink-3 hover:text-ink-2'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
