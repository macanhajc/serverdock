type SidebarNavProps = {
  items: { value?: string; label?: string; divider?: boolean }[];
  active?: string;
  onSelect: (value: string) => void;
  footer: any;
  className?: string;
};

export function SidebarNav({
  items = [],
  active,
  onSelect,
  footer,
  className = '',
}: SidebarNavProps) {
  return (
    <aside
      className={`w-(--sidebar-w) z-50 shrink-0 bg-[#0c0c0c] border-r border-line flex flex-col ${className}`}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
        <span className="w-6 h-6 bg-accent grid place-items-center text-white font-bold text-sm font-mono shrink-0">
          S
        </span>
        <b className="font-bold text-lg text-ink">ServerDock</b>
      </div>

      <nav className="px-2 py-3 flex flex-col gap-0.5">
        {items.map((it, i) =>
          it.divider ? (
            <div key={`d${i}`} className="h-px bg-line mx-2 my-3" />
          ) : (
            <NavItem key={it.value} item={it} active={it.value === active} onSelect={onSelect} />
          )
        )}
      </nav>

      {footer && (
        <div className="mt-auto px-4 py-4 border-t border-line font-mono text-sm text-ink-3">
          {footer}
        </div>
      )}
    </aside>
  );
}

function NavItem({ item, active, onSelect }) {
  const danger = item.danger;
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onSelect?.(item.value);
      }}
      className={`flex items-center gap-3 no-underline px-3 py-3 text-sm border transition-colors ${
        active
          ? 'text-ink border-line bg-bg-2 [box-shadow:var(--rail-accent)]'
          : danger
            ? 'text-ink-3 border-transparent hover:text-red'
            : 'text-ink-2 border-transparent hover:text-ink hover:bg-bg-1'
      }`}
    >
      <span className={`w-2 h-2 shrink-0 ${active ? 'bg-accent' : 'bg-current'}`} />
      {item.label}
    </a>
  );
}
