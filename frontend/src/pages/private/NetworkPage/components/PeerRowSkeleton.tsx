export function PeerRowSkeleton() {
  return (
    <tr className="border-b border-line last:border-0 animate-pulse">
      <td className="px-4 py-3 border-r border-line">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 shrink-0 rounded-full bg-bg-2" />
          <div className="h-3.5 w-24 bg-bg-2 rounded-[1px]" />
        </div>
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-20 bg-bg-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-14 bg-line-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3 border-r border-line">
        <div className="h-3 w-12 bg-line-2 rounded-[1px]" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 bg-line-2 rounded-[1px]" />
      </td>
    </tr>
  );
}
