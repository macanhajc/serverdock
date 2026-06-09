import { PortFormRow } from "../../../../types";

interface PortRowProps {
  port: PortFormRow;
  idx: number;
  onChange: (idx: number, field: keyof PortFormRow, value: string) => void;
  onRemove: (idx: number) => void;
}

export function PortRow({ port, idx, onChange, onRemove }: PortRowProps) {
  const cls =
    'bg-bg-1 border border-line text-ink px-3 py-2 font-mono text-sm w-full outline-none focus:border-[var(--focus-border)] focus:bg-bg-2';
    
  return (
    <div className="grid gap-2 items-center grid-cols-[1fr_1fr_100px_34px]">
      <input
        value={port.host}
        onChange={(e) => onChange(idx, 'host', e.target.value)}
        className={cls}
        placeholder="28015"
        type="number"
        min="1"
        max="65535"
      />
      <input
        value={port.container}
        onChange={(e) => onChange(idx, 'container', e.target.value)}
        className={cls}
        placeholder="28015"
        type="number"
        min="1"
        max="65535"
      />
      <select
        value={port.protocol}
        onChange={(e) => onChange(idx, 'protocol', e.target.value)}
        className={`${cls} appearance-none cursor-pointer`}
      >
        <option value="tcp">TCP</option>
        <option value="udp">UDP</option>
      </select>
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="h-9 flex items-center justify-center bg-bg-1 border border-line text-ink-3 cursor-pointer hover:text-red"
      >
        X
      </button>
    </div>
  );
}
