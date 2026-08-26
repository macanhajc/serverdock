export function ServerCardSkeleton() {
  return (
    <article className="flex flex-col bg-bg-1 border border-line animate-pulse">
      <div className="h-(--thumb-h) border-b border-line bg-bg-2" />

      <div className="flex flex-1 flex-col p-(--row-pad)">
        <div className="flex items-start justify-between gap-3">
          <div className="h-5 w-32 bg-bg-2 rounded-[1px]" />
          <div className="h-5 w-16 bg-bg-2 rounded-[1px] shrink-0" />
        </div>

        <div className="h-3.5 w-24 bg-line-2 rounded-[1px] mt-2" />

        <div className="mt-4 flex justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="h-2.5 w-14 bg-line-2 rounded-[1px]" />
            <div className="h-3.5 w-10 bg-bg-2 rounded-[1px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-2.5 w-16 bg-line-2 rounded-[1px]" />
            <div className="h-3.5 w-24 bg-bg-2 rounded-[1px]" />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-line">
          <div className="h-2.5 w-16 bg-line-2 rounded-[1px] mb-2" />
          <div className="border border-dashed border-[#4c4c4c] p-2 bg-line">
            <div className="h-3 w-40 bg-bg-2 rounded-[1px]" />
          </div>
        </div>
      </div>
    </article>
  );
}
