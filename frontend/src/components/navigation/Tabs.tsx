import { ComponentType, HTMLAttributes } from 'react';

type IconComponent = ComponentType<{ width?: number; height?: number; className?: string }>;

type TabItem =
  | string
  | { label: string; value: string; count?: number; icon?: IconComponent };

interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs?: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs = [], value, onChange, className = '', ...rest }: TabsProps) {
  const items = tabs.map((t) =>
    typeof t === 'string' ? { label: t, value: t, count: undefined, icon: undefined } : t
  );
  return (
    <div className={`flex border-b border-line px-6 bg-bg ${className}`} {...rest}>
      {items.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange?.(t.value)}
            className={`inline-flex items-center gap-1.5 bg-transparent border-b-2 px-4 py-3 text-sm font-semibold tracking-[.02em] cursor-pointer transition-colors ${
              active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            {Icon && <Icon width={13} height={13} />}
            {t.label}
            {t.count != null && (
              <span className={`font-mono text-xs ml-2 ${active ? 'text-accent' : 'text-ink-3'}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
