export function VisitorRowSkeleton() {
  return (
    <tr className="border-b border-line last:border-0 animate-pulse">
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3.5 w-24 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-20 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-28 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-20 bg-line-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-20 bg-line-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <div className="h-6 w-14 bg-bg-2 rounded-[1px]" />
          <div className="h-6 w-16 bg-bg-2 rounded-[1px]" />
        </div>
      </td>
    </tr>
  );
}
