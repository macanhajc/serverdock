import { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
      {children}
    </div>
  );
}
