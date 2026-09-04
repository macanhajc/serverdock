import { CSSProperties, ReactNode } from 'react';

export function Th({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <th
      className={`text-left px-4 py-3 font-mono text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap ${
        last ? '' : 'border-r border-line'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  mono,
  last,
  className,
  style,
}: {
  children: ReactNode;
  mono?: boolean;
  last?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <td
      className={`px-4 py-3 text-xs ${last ? '' : 'border-r border-line'} ${
        mono ? 'font-mono text-ink-2' : 'text-ink-3'
      } ${className ?? ''}`}
      style={style}
    >
      {children}
    </td>
  );
}
