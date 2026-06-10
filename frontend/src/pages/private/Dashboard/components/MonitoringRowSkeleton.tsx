import { COLS } from "../";

export function MonitoringRowSkeleton() {
  return (
    <div className="grid border-b border-line animate-pulse" style={{ gridTemplateColumns: COLS }}>
      <div className="px-5 py-4 flex items-center gap-3 sticky left-0 z-10 bg-bg-1 border-r border-line">
        <div className="h-3.5 w-28 bg-bg-2 rounded-[1px]" />
        <div className="h-3 w-16 bg-line-2 rounded-[1px]" />
      </div>
      <div className="px-4 py-4 flex items-center">
        <div className="h-3 w-16 bg-bg-2 rounded-[1px]" />
      </div>
      <div className="px-4 py-4 flex items-center">
        <div className="h-3 w-14 bg-bg-2 rounded-[1px]" />
      </div>
      <div className="px-4 py-4 flex items-center">
        <div className="h-3 w-8 bg-bg-2 rounded-[1px]" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="px-4 py-4 flex items-center gap-3">
          <div className="flex-1 h-1" style={{ background: 'var(--line-2)' }} />
          <div className="h-3 w-12 bg-bg-2 rounded-[1px]" />
        </div>
      ))}
      <div className="px-4 py-4 flex items-center">
        <div className="h-3 w-24 bg-bg-2 rounded-[1px]" />
      </div>
    </div>
  );
}
