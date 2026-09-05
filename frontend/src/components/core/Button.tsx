import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'default' | 'primary' | 'danger' | 'warn' | 'ghost';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
  className?: string;
}

const SIZE: Record<ButtonSize, string> = {
  md: 'px-3.5 py-2 text-sm',
  sm: 'px-3 py-1.5 text-[13px]',
};

const VARIANT: Record<ButtonVariant, string> = {
  default: 'bg-bg-2 border-line-2 text-ink-2 hover:text-ink hover:border-[#4a4a4a] hover:bg-bg-3',
  primary:
    'bg-[var(--accent-dim)] border-[var(--accent-edge)] text-ink hover:bg-accent hover:text-white hover:border-accent',
  danger: 'border-line-2 text-red border-red/50 bg-fill-offline hover:bg-red hover:text-white',
  warn: 'border-line-2 text-yellow border-yellow/50 hover:bg-yellow hover:text-white',
  ghost: 'bg-transparent border-line-2 text-ink-2 hover:text-ink',
};

export function Button({
  variant = 'default',
  size = 'md',
  disabled = false,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center font-semibold tracking-[.02em] border cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
