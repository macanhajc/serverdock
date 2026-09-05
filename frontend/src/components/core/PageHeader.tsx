import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-center gap-3.5 py-5 px-6 border-b border-line">
      <div>
        <h1 className="m-0 text-[19px] font-bold tracking-[.01em]">{title}</h1>
        {subtitle && <span className="font-mono text-[13px] text-ink-3">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
