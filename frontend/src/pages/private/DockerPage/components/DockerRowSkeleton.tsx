export function DockerRowSkeleton({ columns }: { columns: number }) {
  return (
    <tr className="border-b border-line last:border-0 animate-pulse">
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-4 py-3 border-r border-line">
          <div className="h-3 w-20 bg-bg-2 rounded-[1px]" />
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        <div className="h-6 w-14 bg-bg-2 rounded-[1px] ml-auto" />
      </td>
    </tr>
  );
}
