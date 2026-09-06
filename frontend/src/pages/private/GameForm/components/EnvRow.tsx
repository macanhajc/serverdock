import { Bookmark, Trash } from 'pixelarticons/react';
import { EnvVarRow } from '../../../../types';

interface EnvRowProps {
  env: EnvVarRow;
  idx: number;
  onChange: (idx: number, field: keyof EnvVarRow | 'pinned', value: string | boolean) => void;
  onRemove: (idx: number) => void;
  pinnedLabel: string;
  pinLabel: string;
}

export function EnvRow({ env, idx, onChange, onRemove, pinnedLabel, pinLabel }: EnvRowProps) {
  const cls =
    'bg-bg-1 border border-line text-ink px-3 py-2 font-mono text-sm w-full outline-none focus:border-[var(--focus-border)] focus:bg-bg-2';
  return (
    <div className="grid gap-2 items-center grid-cols-[1fr_1.4fr_34px_34px]">
      <input
        value={env.key}
        onChange={(e) => onChange(idx, 'key', e.target.value)}
        className={cls}
        placeholder="EULA"
      />
      <input
        value={env.value}
        onChange={(e) => onChange(idx, 'value', e.target.value)}
        className={cls}
        placeholder="TRUE"
      />
      <button
        type="button"
        title={env.pinned ? pinnedLabel : pinLabel}
        onClick={() => onChange(idx, 'pinned', !env.pinned)}
        className={`h-9 flex items-center justify-center border cursor-pointer text-base transition-colors ${
          env.pinned
            ? 'bg-(--accent-dim) border-(--accent-edge) text-accent'
            : 'bg-bg-1 border-line text-ink-3 hover:text-ink'
        }`}
      >
        <Bookmark width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="h-9 flex items-center justify-center bg-bg-1 border border-line text-ink-3 cursor-pointer hover:text-red"
      >
        <Trash width={14} height={14} />
      </button>
    </div>
  );
}
