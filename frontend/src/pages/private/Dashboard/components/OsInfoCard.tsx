interface HostOs {
  type: string;
  release: string;
  arch: string;
  hostname: string;
  uptime: number;
}

interface OsInfoCardProps {
  hostOs: HostOs | null;
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[11px] text-ink-3 uppercase tracking-wider">{label}</span>
      <span className="font-mono text-sm text-ink truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

export function OsInfoCard({ hostOs }: OsInfoCardProps) {
  if (!hostOs) return null;

  return (
    <div className="border border-line bg-bg-1 border-b-0 px-5 py-4 grid grid-cols-4 gap-x-8 gap-y-4">
      <Field label="OS" value={`${hostOs.type} ${hostOs.release}`} />
      <Field label="Architecture" value={hostOs.arch} />
      <Field label="Hostname" value={hostOs.hostname} />
      <Field label="Uptime" value={fmtUptime(hostOs.uptime)} />
    </div>
  );
}
