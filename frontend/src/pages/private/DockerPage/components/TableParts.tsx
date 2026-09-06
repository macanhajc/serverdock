import { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'pixelarticons/react';

export function Th({
  children,
  sortDir,
  onSort,
}: {
  children: ReactNode;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
}) {
  return (
    <th
      onClick={onSort}
      className={`text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap ${
        onSort ? 'cursor-pointer select-none hover:text-ink-2' : ''
      }`}
    >
      {children}
      {onSort && (
        <span className="inline-block w-3 ml-1 text-ink-3 align-[-2px]">
          {sortDir === 'asc' && <ChevronUp width={11} height={11} />}
          {sortDir === 'desc' && <ChevronDown width={11} height={11} />}
        </span>
      )}
    </th>
  );
}

export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td
      className={`px-4 py-3 border-r border-line text-xs ${mono ? 'font-mono text-ink-2' : 'text-ink-3'}`}
    >
      {children}
    </td>
  );
}

export function StateBadge({ state, status }: { state: string; status: string }) {
  const color =
    state === 'running'
      ? 'text-green-400'
      : state === 'exited' || state === 'dead'
        ? 'text-red'
        : 'text-yellow';
  return <span className={color}>{status}</span>;
}
