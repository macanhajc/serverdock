import { Plus } from 'pixelarticons/react';

interface AddRowBtnProps {
  onClick: () => void;
  label: string;
}

export function AddRowBtn({ onClick, label }: AddRowBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 self-start inline-flex items-center gap-1.5 bg-transparent border border-dashed border-line-2 text-ink-2 px-4 py-2 text-xs font-mono cursor-pointer hover:text-ink hover:border-(--accent-edge)"
    >
      <Plus width={12} height={12} />
      {label}
    </button>
  );
}
