interface AddRowBtnProps {
  onClick: () => void;
  label: string;
}

export function AddRowBtn({ onClick, label }: AddRowBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 self-start bg-transparent border border-dashed border-line-2 text-ink-2 px-4 py-2 text-xs font-mono cursor-pointer hover:text-ink hover:border-(--accent-edge)"
    >
      {label}
    </button>
  );
}
