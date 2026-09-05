export function MonitoringRowSkeleton() {
  return (
    <tr className="border-b border-line animate-pulse">
      <td className="px-5 py-5 sticky left-0 z-10 bg-bg-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 bg-bg-2 rounded-[1px]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-28 bg-bg-2 rounded-[1px]" />
            <div className="h-3 w-16 bg-line-2 rounded-[1px]" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="h-3 w-16 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-3 w-14 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-3 w-8 bg-bg-2 rounded-[1px]" />
      </td>
      {[0, 1, 2, 3].map((i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1" style={{ background: 'var(--line-2)' }} />
            <div className="h-3 w-12 bg-bg-2 rounded-[1px]" />
          </div>
        </td>
      ))}
      <td className="px-4 py-3.5">
        <div className="h-3 w-24 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-7 h-7 bg-bg-2 rounded-[1px]" />
          ))}
        </div>
      </td>
    </tr>
  );
}
