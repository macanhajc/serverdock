import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Cpu, Database, MemoryStick, Wifi } from 'pixelarticons/react';
import { HostDisk, Server, ServerStats } from '../../../../types';
import { fmtBytes } from '../../../../utils/format';

interface GlobalStatsCardProps {
  servers: Server[];
  serverStats: Record<string, ServerStats>;
  hostTotalMem: number | null;
  hostCpuCount: number | null;
  hostCpuModel: string | null;
  hostDisk: HostDisk | null;
}

export function GlobalStatsCard({
  servers,
  serverStats,
  hostTotalMem,
  hostCpuCount,
  hostCpuModel,
  hostDisk,
}: GlobalStatsCardProps) {
  const { t } = useTranslation();
  const allStats = servers
    .filter((s) => s.status === 'running')
    .map((s) => serverStats[s.id])
    .filter(Boolean) as ServerStats[];

  const totalCpu = allStats.reduce((a, s) => a + s.cpu, 0);
  // per-container cpu is already a % of total host capacity, so the sum is too
  const cpuPct = Math.min(totalCpu, 100);
  const totalMemUsed = allStats.reduce((a, s) => a + s.memUsed, 0);
  const totalNetIn = allStats.reduce((a, s) => a + s.netInRate, 0);
  const totalNetOut = allStats.reduce((a, s) => a + s.netOutRate, 0);
  const ramMax = hostTotalMem;
  const ramPct = ramMax ? Math.min((totalMemUsed / ramMax) * 100, 100) : null;
  const serversDiskUsed = servers.reduce((a, s) => a + (s.diskUsed ?? 0), 0);
  const diskPct = hostDisk ? Math.min((serversDiskUsed / hostDisk.total) * 100, 100) : null;

  return (
    <div className="border border-line bg-bg-1 grid grid-cols-4">
      {/* CPU */}
      <div className="px-5 py-4 border-r border-line">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
          <Cpu width={12} height={12} />
          {t('adminDashboard.statCpu')}
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[26px] font-bold tabular-nums font-mono leading-none">
            {totalCpu.toFixed(1)}
          </span>
          <span className="font-mono text-sm text-ink-3">
            {hostCpuCount
              ? t('adminDashboard.cpuOfCores', { cores: hostCpuCount })
              : t('adminDashboard.cpuCombined')}
          </span>
        </div>

        <div className="h-1 relative" style={{ background: 'var(--line-2)' }}>
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-500"
            style={{
              width: `${cpuPct}%`,
              background: cpuPct > 80 ? 'var(--yellow)' : 'var(--accent)',
            }}
          />
        </div>

        {hostCpuModel && (
          <div className="font-mono text-[11px] text-ink-3 mt-2 truncate" title={hostCpuModel}>
            {hostCpuModel}
          </div>
        )}
      </div>

      {/* RAM */}
      <div className="px-5 py-4 border-r border-line">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
          <MemoryStick width={12} height={12} />
          {t('adminDashboard.statRam')}
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[26px] font-bold tabular-nums font-mono leading-none">
            {fmtBytes(totalMemUsed)}
          </span>
          {ramMax && <span className="font-mono text-sm text-ink-3">/ {fmtBytes(ramMax)}</span>}
        </div>

        {ramPct !== null && (
          <div className="h-1 relative" style={{ background: 'var(--line-2)' }}>
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-500"
              style={{
                width: `${ramPct}%`,
                background: ramPct > 80 ? 'var(--yellow)' : 'var(--accent)',
              }}
            />
          </div>
        )}
        {ramMax && (
          <div className="font-mono text-[11px] text-ink-3 mt-2">
            {t('adminDashboard.ramTotal', { size: fmtBytes(ramMax) })}
          </div>
        )}
      </div>

      {/* Disk */}
      <div className="px-5 py-4 border-r border-line">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
          <Database width={12} height={12} />
          {t('adminDashboard.statDisk')}
        </div>
        {hostDisk ? (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-[26px] font-bold tabular-nums font-mono leading-none">
                {fmtBytes(serversDiskUsed)}
              </span>
              <span className="font-mono text-sm text-ink-3">/ {fmtBytes(hostDisk.total)}</span>
            </div>
            <div className="h-1 relative" style={{ background: 'var(--line-2)' }}>
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${diskPct}%`,
                  background: (diskPct ?? 0) > 80 ? 'var(--yellow)' : 'var(--accent)',
                }}
              />
            </div>
          </>
        ) : (
          <span className="font-mono text-sm text-ink-3">—</span>
        )}
      </div>

      {/* Network */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
          <Wifi width={12} height={12} />
          {t('adminDashboard.statNetwork')}
        </div>
        <div className="font-mono text-sm text-ink-3 flex flex-col gap-1">
          <span className="inline-flex items-center gap-1">
            <ArrowDown width={11} height={11} />
            <span className="text-ink font-bold">{fmtBytes(totalNetIn)}/s</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUp width={11} height={11} />
            <span className="text-ink font-bold">{fmtBytes(totalNetOut)}/s</span>
          </span>
        </div>
      </div>
    </div>
  );
}
