import type { Permission } from '../../../../types';

export function PermissionChecklist({
  catalog,
  selected,
  onToggle,
  t,
}: {
  catalog: Permission[];
  selected: Set<Permission>;
  onToggle: (p: Permission) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {catalog.map((p) => (
        <label
          key={p}
          className="flex items-center gap-2 font-mono text-xs text-ink-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.has(p)}
            onChange={() => onToggle(p)}
            className="accent-current"
          />
          {/* i18next treats ':' as its namespace separator by default, so the
              permission key (e.g. "servers:power") can't be used verbatim */}
          {t(`admins.perm.${p.replace(':', '_')}`)}
        </label>
      ))}
    </div>
  );
}
