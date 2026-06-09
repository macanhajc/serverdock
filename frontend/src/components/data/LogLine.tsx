import { HTMLAttributes, ReactNode } from 'react';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'OK' | 'DEBUG';

const LEVEL_CLS: Record<string, string> = {
  INFO: 'text-log-info',
  WARN: 'text-log-warn',
  ERROR: 'text-log-error',
  OK: 'text-log-ok',
  DEBUG: 'text-log-debug',
};

interface LogLineProps extends HTMLAttributes<HTMLDivElement> {
  ts?: string;
  level?: string;
  children?: ReactNode;
  className?: string;
}

export function LogLine({ ts, level = 'INFO', children, className = '', ...rest }: LogLineProps) {
  return (
    <div
      className={`grid gap-4 items-start font-mono text-[12.5px] leading-[1.65] grid-cols-[max-content_52px_1fr] ${className}`}
      {...rest}
    >
      <span className="text-[#5a5a5a]">{ts}</span>
      <span className={`font-bold ${LEVEL_CLS[level as string] || 'text-ink-2'}`}>{level}</span>
      <span className="text-[#c8c8c8] whitespace-pre-wrap wrap-break-word min-w-0">{children}</span>
    </div>
  );
}

interface LogViewerProps extends HTMLAttributes<HTMLDivElement> {
  height?: number | string;
  className?: string;
  children?: ReactNode;
}

export function LogViewer({ children, height = 420, className = '', ...rest }: LogViewerProps) {
  return (
    <div
      className={`bg-bg-terminal p-[14px_20px] overflow-auto scroll-smooth ${className}`}
      style={{ height }}
      {...rest}
    >
      {children}
    </div>
  );
}
