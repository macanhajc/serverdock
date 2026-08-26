function TitleBar({ w = 'w-40' }: { w?: string }) {
  return <div className={`h-4 ${w} bg-bg-2 rounded-[1px]`} />;
}

function TextBar({ w = 'w-64' }: { w?: string }) {
  return <div className={`h-3 ${w} bg-line-2 rounded-[1px]`} />;
}

function FieldSkeleton({ labelW = 'w-24' }: { labelW?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-3 ${labelW} bg-line-2 rounded-[1px]`} />
      <div className="h-9 w-full bg-bg-2 rounded-[1px]" />
      <div className="h-2.5 w-40 bg-line-2 rounded-[1px]" />
    </div>
  );
}

function NoteSkeleton() {
  return <div className="h-10 w-full bg-bg-2 rounded-[1px]" />;
}

export function SettingsPageSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Notifications */}
      <section>
        <div className="mb-1">
          <TitleBar />
        </div>
        <div className="mb-5">
          <TextBar w="w-80" />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex border border-dashed bg-line/10 border-line-2 p-4 flex-col gap-3">
            <TitleBar w="w-28" />
            <TextBar w="w-72" />
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <FieldSkeleton labelW="w-32" />
              </div>
              <div className="h-8 w-16 bg-bg-2 rounded-[1px] self-end" />
            </div>
          </div>

          <div className="flex border border-dashed bg-line/10 border-line-2 p-4 flex-col gap-3">
            <TitleBar w="w-36" />
            <TextBar w="w-72" />
            <div className="flex items-center gap-3">
              <div className="h-3 w-28 bg-line-2 rounded-[1px]" />
              <div className="h-8 w-20 bg-bg-2 rounded-[1px]" />
            </div>
          </div>
        </div>
      </section>

      {/* Server Identity */}
      <section className="border-t border-line pt-6">
        <div className="mb-1">
          <TitleBar w="w-44" />
        </div>
        <div className="mb-5">
          <TextBar w="w-72" />
        </div>
        <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
          <FieldSkeleton labelW="w-28" />
          <NoteSkeleton />
        </div>
      </section>

      {/* Visitor Registration */}
      <section className="border-t border-line pt-6">
        <div className="mb-1">
          <TitleBar w="w-52" />
        </div>
        <div className="mb-5">
          <TextBar w="w-80" />
        </div>
        <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-8.5 bg-bg-2 rounded-[1px]" />
            <div className="h-3 w-36 bg-line-2 rounded-[1px]" />
          </div>
        </div>
      </section>

      {/* Data Storage */}
      <section className="border-t border-line pt-6">
        <div className="mb-1">
          <TitleBar w="w-36" />
        </div>
        <div className="mb-5">
          <TextBar w="w-72" />
        </div>
        <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
          <FieldSkeleton labelW="w-28" />
          <NoteSkeleton />
          <NoteSkeleton />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="border-t border-line pt-6">
        <div className="mb-1">
          <TitleBar w="w-32" />
        </div>
        <div className="mb-5">
          <TextBar w="w-72" />
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-4 border border-dashed border-line-2 bg-line/10">
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-40 bg-bg-2 rounded-[1px]" />
            <div className="h-3 w-56 bg-line-2 rounded-[1px]" />
          </div>
          <div className="h-8 w-24 bg-bg-2 rounded-[1px]" />
        </div>
      </section>
    </div>
  );
}
