import { HTMLAttributes } from 'react';

type SegmentedOption = string | { label: string; value: string };

interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options?: SegmentedOption[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options = [], value, onChange, className = '', ...rest }: SegmentedControlProps) {
  const opts = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));
  return (
    <div className={`inline-flex border border-line-2 ${className}`} {...rest}>
      {opts.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange?.(o.value)}
            className={`px-4 py-2 text-xs font-semibold cursor-pointer transition-colors border-r border-line-2 last:border-r-0 ${
              active ? 'bg-(--accent-dim) text-ink' : 'bg-bg-1 text-ink-3 hover:text-ink-2'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
