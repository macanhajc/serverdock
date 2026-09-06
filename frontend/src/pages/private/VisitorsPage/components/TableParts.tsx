import { ReactNode } from 'react';

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  );
}
