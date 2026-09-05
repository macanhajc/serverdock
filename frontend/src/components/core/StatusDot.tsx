interface StatusDotProps {
  online: boolean;
}

export function StatusDot({ online }: StatusDotProps) {
  return (
    <span
      className="w-[7px] h-[7px] shrink-0 rounded-full inline-block"
      style={{ background: online ? 'var(--green)' : 'var(--ink-3)' }}
    />
  );
}
