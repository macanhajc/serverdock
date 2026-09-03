import { useEffect, useState } from 'react';

type SidebarNavProps = {
  items: { value?: string; label?: string; divider?: boolean; danger?: boolean }[];
  active?: string;
  onSelect: (value: string) => void;
  footer: any;
  className?: string;
};

const COLLAPSE_KEY = 'sd_sidebar_collapsed';

export function SidebarNav({
  items = [],
  active,
  onSelect,
  footer,
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
      className={`${collapsed ? 'w-16' : 'w-(--sidebar-w)'} sticky top-0 h-screen z-10 shrink-0 bg-[#0c0c0c] border-r border-line flex flex-col transition-[width] duration-200 ease-[var(--ease)] ${className}`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-4 border-b border-line ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <span className="w-6 h-6 bg-accent grid place-items-center text-white font-bold text-sm font-mono shrink-0">
          S
        </span>
        {!collapsed && <b className="font-bold text-lg text-ink whitespace-nowrap">ServerDock</b>}
      </div>

      <nav className="px-2 py-3 flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {items.map((it, i) =>
          it.divider ? (
            <div key={`d${i}`} className="h-px bg-line mx-2 my-3" />
          ) : (
            <NavItem
              key={it.value}
              item={it}
              active={it.value === active}
              onSelect={onSelect}
              collapsed={collapsed}
            />
          )
        )}
      </nav>

      {footer && !collapsed && (
        <div className="px-4 py-4 border-t border-line font-mono text-sm text-ink-3">{footer}</div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-pressed={collapsed}
        className={`flex items-center gap-3 px-4 py-3 border-t border-line text-ink-3 hover:text-ink hover:bg-bg-1 transition-colors cursor-pointer shrink-0 ${
          collapsed ? 'justify-center px-0' : ''
        }`}
      >
        <span className="w-6 h-6 border border-line-2 grid place-items-center font-mono text-xs shrink-0">
          {collapsed ? '›' : '‹'}
        </span>
      </button>
    </aside>
  );
}

function NavItem({ item, active, onSelect, collapsed }) {
  const danger = item.danger;
  const label = item.label ?? '';
  const mark = label.slice(0, 2).toUpperCase();

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onSelect?.(item.value);
      }}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 no-underline px-3 py-3 text-sm border transition-colors ${
        collapsed ? 'justify-center px-0' : ''
      } ${
        active
          ? 'text-ink border-line bg-bg-2 [box-shadow:var(--rail-accent)]'
          : danger
            ? 'text-ink-3 border-transparent hover:text-red'
            : 'text-ink-2 border-transparent hover:text-ink hover:bg-bg-1'
      }`}
    >
      {collapsed ? (
        <span
          className={`w-6 h-6 grid place-items-center shrink-0 font-mono text-[10px] font-bold border ${
            active ? 'bg-accent text-white border-accent' : 'bg-bg-2 text-current border-line-2'
          }`}
        >
          {mark}
        </span>
      ) : (
        <>
          <span className={`w-2 h-2 shrink-0 ${active ? 'bg-accent' : 'bg-current'}`} />
          {label}
        </>
      )}
    </a>
  );
}
