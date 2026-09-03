import { useTranslation } from "react-i18next";
import { Trash } from 'pixelarticons/react';
import { PortFormRow } from "../../../../types";

interface PortRowProps {
  port: PortFormRow;
  idx: number;
  onChange: (idx: number, field: keyof PortFormRow, value: string) => void;
  onRemove: (idx: number) => void;
  conflictsWith?: string;
}

export function PortRow({ port, idx, onChange, onRemove, conflictsWith }: PortRowProps) {
  const { t } = useTranslation();
  const base = 'bg-bg-1 border text-ink px-3 py-2 font-mono text-sm w-full outline-none focus:bg-bg-2';
  const normal = `${base} border-line focus:border-[var(--focus-border)]`;
  const conflict = `${base} border-yellow/70 focus:border-yellow`;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid gap-2 items-center grid-cols-[1fr_1fr_100px_34px]">
        <input
          value={port.host}
          onChange={(e) => onChange(idx, 'host', e.target.value)}
          className={conflictsWith ? conflict : normal}
          placeholder="28015"
          type="number"
          min="1"
          max="65535"
        />
        <input
          value={port.container}
          onChange={(e) => onChange(idx, 'container', e.target.value)}
          className={normal}
          placeholder="28015"
          type="number"
          min="1"
          max="65535"
        />
        <select
          value={port.protocol}
          onChange={(e) => onChange(idx, 'protocol', e.target.value)}
          className={`${normal} appearance-none cursor-pointer`}
        >
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="h-9 flex items-center justify-center bg-bg-1 border border-line text-ink-3 cursor-pointer hover:text-red"
        >
          <Trash width={14} height={14} />
        </button>
      </div>
      {conflictsWith && (
        <p className="font-mono text-xs text-yellow leading-none">
          {t('gameForm.portConflict', { game: conflictsWith })}
        </p>
      )}
    </div>
  );
}
