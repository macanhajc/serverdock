import { LabelHTMLAttributes } from 'react';

interface ToggleProps extends Omit<LabelHTMLAttributes<HTMLLabelElement>, 'onChange'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked = false,
  onChange,
  label,
  disabled = false,
  className = '',
  ...rest
}: ToggleProps) {
  return (
    <label
      onClick={() => !disabled && onChange && onChange(!checked)}
      className={`inline-flex items-center gap-2 text-xs text-ink-2 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      {...rest}
    >
      <span
        className={`relative w-8.5 h-4 shrink-0 border transition-colors ${
          checked ? 'bg-(--accent-dim) border-(--accent-edge)' : 'bg-bg-3 border-line-2'
        }`}
      >
        <span
          className={`absolute top-px w-4 h-4 transition-all ${
            checked ? 'left-4.25 bg-accent' : 'left-0 bg-ink-3'
          }`}
        />
      </span>
      {label}
    </label>
  );
}
