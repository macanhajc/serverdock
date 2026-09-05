import { ComponentType, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'pixelarticons/react';

type IconComponent = ComponentType<{ width?: number; height?: number; className?: string }>;

type SidebarNavProps = {
  items: {
    value?: string;
    label?: string;
    icon?: IconComponent;
    divider?: boolean;
  }[];
  active?: string;
  onSelect: (value: string) => void;
  footer: any;
  onLogout: () => void;
  logoutLabel: string;
  LogoutIcon: IconComponent;
  className?: string;
};

const COLLAPSE_KEY = 'sd_sidebar_collapsed';

export function SidebarNav({
  items = [],
  active,
  onSelect,
  footer,
  onLogout,
  logoutLabel,
  LogoutIcon,
  className = '',
}: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // sessionStorage/localStorage unavailable — collapse state just won't persist
    }
  }, [collapsed]);

  return (
    <aside
      className={`${collapsed ? 'w-20' : 'w-(--sidebar-w)'} sticky top-0 h-screen z-10 shrink-0 bg-bg-sidebar border-r border-line flex flex-col justify-between transition-[width] duration-200 ease-[var(--ease)] ${className}`}
    >
      <div className="flex flex-col min-h-0">
        <div
          className={`h-16 flex items-center gap-3 px-4 border-b border-line shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <img src="/favicon.svg" alt="ServerDock" className="w-7 h-7 shrink-0" />
          {!collapsed && (
            <b className="font-bold text-lg text-ink whitespace-nowrap">ServerDock</b>
          )}
        </div>

        <nav className="px-2 py-3 flex flex-col gap-0.5 min-h-0 overflow-y-auto overflow-x-hidden">
          {items.map((it, i) => <NavItem
            key={it.value}
            item={it}
            active={it.value === active}
            onSelect={onSelect}
            collapsed={collapsed}
          />)}
        </nav>
      </div>

      <div className="p-3 h-32 border-t border-line flex flex-col gap-3 shrink-0">
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? logoutLabel : undefined}
          className={`flex items-center gap-2.5 px-2 py-1.5 bg-transparent border-none cursor-pointer text-ink-3 hover:text-red transition-colors ${collapsed ? 'justify-center px-0' : ''
            }`}
        >
          <LogoutIcon width={18} height={18} className="shrink-0" />
          {!collapsed && <span className="text-sm">{logoutLabel}</span>}
        </button>

        <div
          className={`flex items-center pt-3 border-t border-line/50 ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}
        >
          {!collapsed && footer}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className="p-1 text-ink-3 hover:text-ink transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? (
              <ChevronRight width={16} height={16} />
            ) : (
              <ChevronLeft width={16} height={16} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, active, onSelect, collapsed }) {
  const label = item.label ?? '';
  const Icon = item.icon as IconComponent | undefined;

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onSelect?.(item.value);
      }}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 no-underline px-3 py-3 text-[13px] border transition-colors ${collapsed ? 'justify-center px-0' : ''
        } ${active
          ? 'text-ink border-line bg-bg-2 [box-shadow:var(--rail-accent)]'
          : 'text-ink-2 border-transparent hover:text-ink hover:bg-bg-1'
        }`}
    >
      {collapsed ? (
        <span
          className={`w-7 h-7 grid place-items-center shrink-0 border ${active ? 'bg-accent text-white border-accent' : 'bg-bg-2 text-current border-line-2'
            }`}
        >
          {Icon && <Icon width={16} height={16} />}
        </span>
      ) : (
        <>
          {Icon ? (
            <Icon width={18} height={18} className={`shrink-0 ${active ? 'text-accent' : ''}`} />
          ) : (
            <span className={`w-2 h-2 shrink-0 ${active ? 'bg-accent' : 'bg-current'}`} />
          )}
          {label}
        </>
      )}
    </a>
  );
}
