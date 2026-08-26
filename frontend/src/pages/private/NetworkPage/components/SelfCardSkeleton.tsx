export function SelfCardSkeleton() {
  return (
    <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 shrink-0 rounded-full bg-bg-2" />
        <div className="h-4 w-32 bg-bg-2 rounded-[1px]" />
        <div className="ml-auto h-3 w-16 bg-line-2 rounded-[1px]" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-20 bg-line-2 rounded-[1px] shrink-0" />
        <div className="h-3.5 w-28 bg-bg-2 rounded-[1px]" />
      </div>
      <div className="mt-1 h-8 w-full bg-bg-2 rounded-[1px]" />
    </div>
  );
}
