import { ReactNode } from 'react';
import { ChevronDown } from 'pixelarticons/react';

interface SettingsCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  dirty?: boolean;
  danger?: boolean;
  children: ReactNode;
}

export function SettingsCard({
  icon,
  title,
  description,
  summary,
  open,
  onToggle,
  dirty = false,
  danger = false,
  children,
}: SettingsCardProps) {
  return (
    <div className={`border ${danger ? 'border-red/30' : 'border-line-2'}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex bg-bg-1 items-center justify-between gap-4 px-4 py-3.5 text-left cursor-pointer border-0 hover:bg-line/10"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 ${danger ? 'text-red' : 'text-ink'}`}>{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className={`m-0 text-sm font-bold ${danger ? 'text-red' : 'text-ink'}`}>
                {title}
              </h3>
              {dirty && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--accent)' }}
                  title="Unsaved changes"
                />
              )}
            </div>
            <p className="m-0 text-xs text-ink-3 truncate">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {summary && !open && (
            <span className="hidden sm:inline font-mono text-[11px] text-ink-3 max-w-52 truncate">
              {summary}
            </span>
          )}
          <ChevronDown
            width={14}
            height={14}
            className={`text-ink-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="p-4 border-t border-line-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
