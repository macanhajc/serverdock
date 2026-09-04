function CardSkeleton({ titleW = 'w-40', descW = 'w-64' }: { titleW?: string; descW?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-line-2 px-4 py-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-3.5 h-3.5 shrink-0 bg-bg-2 rounded-[1px]" />
        <div className="flex flex-col gap-1.5">
          <div className={`h-3.5 ${titleW} bg-bg-2 rounded-[1px]`} />
          <div className={`h-3 ${descW} bg-line-2 rounded-[1px]`} />
        </div>
      </div>
      <div className="w-3.5 h-3.5 shrink-0 bg-bg-2 rounded-[1px]" />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <CardSkeleton titleW="w-32" descW="w-60" />
      <CardSkeleton titleW="w-36" descW="w-72" />
      <CardSkeleton titleW="w-44" descW="w-80" />
      <CardSkeleton titleW="w-28" descW="w-64" />
      <CardSkeleton titleW="w-28" descW="w-56" />
    </div>
  );
}
