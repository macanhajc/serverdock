import { useTranslation } from 'react-i18next';
import { Archive, Box, Database, Docker, Images } from 'pixelarticons/react';
import type { DockerSummary } from '../hooks/useDockerSummary';
import { formatBytes } from '../format';

const CATEGORIES: {
  key: keyof DockerSummary['disk'];
  icon: typeof Images;
  labelKey: string;
}[] = [
  { key: 'images', icon: Images, labelKey: 'docker.summaryImages' },
  { key: 'containers', icon: Box, labelKey: 'docker.summaryContainers' },
  { key: 'volumes', icon: Database, labelKey: 'docker.summaryVolumes' },
  { key: 'buildCache', icon: Archive, labelKey: 'docker.summaryBuildCache' },
];

export function DockerSummaryPanel({
  summary,
  loaded,
}: {
  summary: DockerSummary | null;
  loaded: boolean;
}) {
  const { t } = useTranslation();

  if (!loaded || !summary) {
    return (
      <div className="border border-line bg-bg-1 grid grid-cols-4 mb-5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`px-5 py-4 ${i < 4 ? 'border-r border-line' : ''}`}>
            <div className="h-3 w-16 bg-bg-2 rounded-[1px] mb-3" />
            <div className="h-6 w-20 bg-bg-2 rounded-[1px]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-line bg-bg-1 mb-5">
      <div className="px-5 py-2.5 border-b border-line font-mono text-[11px] text-ink-3 flex items-center gap-1.5">
        <Docker width={12} height={12} />
        {t('docker.summaryEngine', {
          version: summary.version,
          os: summary.os,
          arch: summary.arch,
          driver: summary.driver,
        })}
      </div>
      <div className="grid grid-cols-4">
        {CATEGORIES.map(({ key, icon: Icon, labelKey }, i) => {
          const cat = summary.disk[key];
          return (
            <div
              key={key}
              className={`px-5 py-4 ${i < CATEGORIES.length - 1 ? 'border-r border-line' : ''}`}
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
                <Icon width={12} height={12} />
                {t(labelKey)}
                <span className="normal-case tracking-normal">({cat.count})</span>
              </div>
              <div className="text-[22px] font-bold tabular-nums font-mono leading-none mb-1.5">
                {formatBytes(cat.total)}
              </div>
              <div
                className="font-mono text-[11px]"
                style={{ color: cat.reclaimable > 0 ? 'var(--yellow)' : 'var(--ink-3)' }}
              >
                {cat.reclaimable > 0
                  ? t('docker.summaryReclaimable', { size: formatBytes(cat.reclaimable) })
                  : t('docker.summaryNoneReclaimable')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
