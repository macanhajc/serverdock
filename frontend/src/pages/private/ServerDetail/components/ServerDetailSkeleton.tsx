function Bar({ className = '' }: { className?: string }) {
  return <div className={`bg-bg-2 rounded-[1px] ${className}`} />;
}

function LineBar({ className = '' }: { className?: string }) {
  return <div className={`bg-line-2 rounded-[1px] ${className}`} />;
}

function CardSkeleton({ labelW, className }: { labelW: string; className?: string }) {
  return (
    <section>
      <LineBar className={`h-3 mb-2 ${labelW}`} />
      <Bar className={className ?? 'h-[76px] w-full'} />
    </section>
  );
}

// Mirrors the real ServerDetail head bar / tab bar / info-tab layout so there's
// no shape shift once the fetched server data swaps this out.
export function ServerDetailSkeleton() {
  return (
    <div className="flex flex-col h-screen animate-pulse">
      {/* ── Detail head ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 py-4 px-6 border-b border-line bg-bg-1 flex-none">
        <Bar className="h-[34px] w-[92px] shrink-0" />
        <Bar className="w-10 h-10 shrink-0" />
        <div className="min-w-0 flex flex-col gap-2">
          <Bar className="h-4 w-44" />
          <LineBar className="h-3 w-64" />
        </div>
        <Bar className="h-5 w-16 shrink-0" />
        <div className="ml-auto flex gap-1.5 flex-none">
          <Bar className="h-[34px] w-[76px]" />
          <Bar className="h-[34px] w-[76px]" />
          <Bar className="h-[34px] w-[92px]" />
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex border-b border-line px-6 bg-bg flex-none">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b-2 border-transparent">
          <Bar className="w-3 h-3" />
          <Bar className="h-3 w-8" />
        </div>
        <div className="flex items-center gap-1.5 px-4 py-3 border-b-2 border-transparent">
          <Bar className="w-3 h-3" />
          <Bar className="h-3 w-14" />
        </div>
        <div className="flex items-center gap-1.5 px-4 py-3 border-b-2 border-transparent">
          <Bar className="w-3 h-3" />
          <Bar className="h-3 w-10" />
        </div>
        <div className="flex items-center gap-1.5 px-4 py-3 border-b-2 border-transparent">
          <Bar className="w-3 h-3" />
          <Bar className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-1.5 px-4 py-3 border-b-2 border-transparent">
          <Bar className="w-3 h-3" />
          <Bar className="h-3 w-16" />
        </div>
      </div>

      {/* ── Tab content (Info tab shape — the default tab) ──────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-6 container">
          <div className="flex flex-col gap-8">
            <Bar className="w-full h-96 shrink-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
              <CardSkeleton labelW="w-36" />
              <CardSkeleton labelW="w-28" />
            </div>

            <section className="border-t border-line pt-6">
              <LineBar className="h-3 w-24 mb-2" />
              <Bar className="h-[68px] w-full" />
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-line pt-6">
              <CardSkeleton labelW="w-32" className="h-40 w-full" />
              <CardSkeleton labelW="w-24" className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
