import { Plus } from 'pixelarticons/react';
import { GameTemplate } from '../../../../types';

interface TplTileProps {
  tpl: GameTemplate;
  active: boolean;
  onClick: () => void;
}

export function TplTile({ tpl, active, onClick }: TplTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 w-22 py-4 px-2 cursor-pointer border ${
        active
          ? 'border-(--accent-edge) bg-(--accent-dim)'
          : 'border-line bg-bg-1 hover:border-line-2 hover:bg-bg-2'
      }`}
    >
      <div
        className={`w-9 h-9 border grid place-items-center font-mono font-bold text-sm ${
          active ? 'border-(--accent-edge) text-ink' : 'border-line-2 text-ink-2'
        }`}
        style={
          tpl.id !== 'blank'
            ? { background: 'repeating-linear-gradient(45deg,#1d1d1d 0 5px,#161616 5px 10px)' }
            : {}
        }
      >
        {tpl.id === 'blank' ? <Plus width={16} height={16} /> : tpl.name.slice(0, 2).toUpperCase()}
      </div>
      <span className="font-mono text-sm text-ink-2 text-center leading-tight tracking-[.04em]">
        {tpl.name}
      </span>
    </button>
  );
}
