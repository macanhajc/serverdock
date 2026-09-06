import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  MemoryStick,
  Wifi,
} from 'pixelarticons/react';
import { Sparkline } from '../../../../components/data/Sparkline';
import { fmtBytes } from '../../../../utils/format';
import type { ServerStats } from '../../../../types';

export function ResourcesPanel({
  stats,
  cpuHistory,
  memHistory,
  diskUsed,
  open,
  onToggle,
}: {
  stats: ServerStats;
  cpuHistory: number[];
  memHistory: number[];
  diskUsed: number | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-line flex-none bg-bg-1">
      <div
        className="flex items-center gap-4 px-6 py-2.5 cursor-pointer hover:bg-bg-2 select-none"
        onClick={onToggle}
      >
        <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 flex-none">
          {t('serverDetail.resources')}
          {open ? <ChevronDown width={12} height={12} /> : <ChevronRight width={12} height={12} />}
        </span>
        {!open && (
          <>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
              <Cpu width={12} height={12} />{' '}
              <span className="text-ink">{stats.cpu.toFixed(1)}%</span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
              <MemoryStick width={12} height={12} />
              <span className="text-ink">
                {fmtBytes(stats.memUsed)}
                {stats.memLimit ? ` / ${fmtBytes(stats.memLimit)}` : ''}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
              <Wifi width={12} height={12} /> {t('serverDetail.resNet')}
              <ArrowDown width={12} height={12} />
              <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
              <ArrowUp width={12} height={12} />
              <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
              <Database width={12} height={12} /> {t('serverDetail.resDisk')}{' '}
              <span className="text-ink">{fmtBytes(diskUsed ?? 0)}</span>
            </span>
          </>
        )}
      </div>

      {open && (
        <div className="px-6 pt-1 pb-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 w-10 shrink-0">
              <Cpu width={12} height={12} /> CPU
            </span>
            <div className="flex-1 h-1.5 relative" style={{ background: 'var(--line-2)' }}>
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{ width: `${Math.min(stats.cpu, 100)}%`, background: 'var(--accent)' }}
              />
            </div>
            <span className="font-mono text-xs text-ink w-12 text-right shrink-0">
              {stats.cpu.toFixed(1)}%
            </span>
            <Sparkline data={cpuHistory} />
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 w-10 shrink-0">
              <MemoryStick width={12} height={12} /> RAM
            </span>
            {stats.memLimit ? (
              <>
                <div className="flex-1 h-1.5 relative" style={{ background: 'var(--line-2)' }}>
                  <div
                    className="absolute inset-y-0 left-0 transition-[width] duration-500"
                    style={{
                      width: `${Math.min((stats.memUsed / stats.memLimit) * 100, 100)}%`,
                      background:
                        stats.memUsed / stats.memLimit > 0.8 ? 'var(--yellow)' : 'var(--accent)',
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-ink w-12 text-right shrink-0">
                  {((stats.memUsed / stats.memLimit) * 100).toFixed(0)}%
                </span>
                <span className="font-mono text-xs text-ink-3 shrink-0">
                  {fmtBytes(stats.memUsed)} / {fmtBytes(stats.memLimit)}
                </span>
              </>
            ) : (
              <span className="font-mono text-xs text-ink">{fmtBytes(stats.memUsed)}</span>
            )}
            <Sparkline data={memHistory} />
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 shrink-0">
              <Wifi width={12} height={12} /> {t('serverDetail.resNet')}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
              <ArrowDown width={12} height={12} />
              <span className="text-ink">{fmtBytes(stats.netInRate)}/s</span>
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3">
              <ArrowUp width={12} height={12} />
              <span className="text-ink">{fmtBytes(stats.netOutRate)}/s</span>
            </span>
          </div>

          <div className="flex flex-row gap-3">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 shrink-0">
              <Database width={12} height={12} /> {t('serverDetail.resDisk')}
            </span>
            <span className="font-mono text-xs text-ink shrink-0">{fmtBytes(diskUsed ?? 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
