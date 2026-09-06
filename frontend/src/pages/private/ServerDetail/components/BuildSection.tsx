import { useTranslation } from 'react-i18next';
import { Tools } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';
import { StatusBadge } from '../../../../components/core/StatusBadge';
import { BuildLine } from '../../GameForm/components/BuildLine';
import { useBuildLog } from '../../../../hooks/useBuildLog';
import { useTriggerBuild } from '../hooks/useTriggerBuild';
import { SectionTitle } from './SectionTitle';

interface BuildSectionProps {
  id: string;
  token: string | null;
  imageBuilt: boolean | null | undefined;
}

// The build pipeline itself (Dockerfile save, docker build, imageBuilt gating
// on start) already existed — this just surfaces it outside the GameForm edit
// page, so a local-image game's build status/log/rebuild is visible without
// re-entering the full edit flow every time.
export function BuildSection({ id, token, imageBuilt }: BuildSectionProps) {
  const { t } = useTranslation();
  const { status, log, startBuild } = useBuildLog(id);
  const triggerBuild = useTriggerBuild(id, token);

  const building = status === 'building';
  // Once a build finishes in this session, trust that result over the page's
  // initial snapshot — reflects the outcome without needing a full refetch.
  const built = status === 'ok' ? true : status === 'failed' ? false : !!imageBuilt;

  return (
    <section className="border-t border-line pt-6">
      <SectionTitle>{t('serverDetail.buildSectionTitle')}</SectionTitle>
      <div className="border border-line px-5 py-4 flex items-center gap-3">
        <StatusBadge status={building ? 'building' : built ? 'built' : 'none'} />
        <span className="font-mono text-xs text-ink-3">
          {building
            ? t('serverDetail.buildInProgress')
            : built
              ? t('serverDetail.buildOk')
              : t('serverDetail.buildNotBuilt')}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={building || triggerBuild.isPending}
          onClick={() => triggerBuild.mutate(undefined, { onSuccess: startBuild })}
        >
          <Tools width={12} height={12} className="mr-1.5" />
          {building
            ? t('serverDetail.building')
            : built
              ? t('serverDetail.rebuild')
              : t('serverDetail.buildNow')}
        </Button>
      </div>

      {triggerBuild.isError && (
        <div className="font-mono text-xs text-red mt-2">{triggerBuild.error.message}</div>
      )}

      {(building || log.length > 0) && (
        <div className="mt-3 border border-line bg-bg-terminal px-3 py-3 max-h-48 overflow-y-auto font-mono text-sm leading-6">
          {log.map((line, i) => (
            <BuildLine key={i} line={line} />
          ))}
        </div>
      )}
    </section>
  );
}
