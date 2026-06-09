import { InputHTMLAttributes, ReactNode } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: ReactNode;
  hint?: string;
  mono?: boolean;
  textarea?: boolean;
  code?: boolean;
  className?: string;
  inputClassName?: string;
}

export function TextField({
  label,
  hint,
  mono = false,
  textarea = false,
  code = false,
  disabled = false,
  className = '',
  inputClassName = '',
  ...rest
}: TextFieldProps) {
  const Tag = textarea ? 'textarea' : 'input';

  const fieldCls = [
    'w-full border border-line px-3 py-2 outline-none text-ink placeholder:text-ink-3',
    'focus:border-[var(--focus-border)]',
    mono || code ? 'font-mono text-sm' : 'text-sm',
    code ? 'bg-bg-terminal' : 'bg-bg-1 focus:bg-bg-2',
    textarea ? `resize-y leading-[1.5] ${code ? 'min-h-[140px]' : 'min-h-[74px]'}` : '',
    disabled ? 'opacity-45 cursor-not-allowed' : '',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-xs text-ink-2 flex items-center gap-2">{label}</span>}
      <Tag disabled={disabled} className={fieldCls} {...(rest as any)} />
      {hint && (
        <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[.06em]">{hint}</span>
      )}
    </label>
  );
}
