import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../../components/core/StatusBadge';
import { Button } from '../../../../components/core/Button';
import type { BuildStatus } from '../../../../hooks/useBuildLog';
import { BuildLine } from './BuildLine';

export function BuildLogPanel({
  buildStatus,
  buildLog,
  onGoToDashboard,
}: {
  buildStatus: BuildStatus;
  buildLog: string[];
  onGoToDashboard: () => void;
}) {
  const { t } = useTranslation();
  const buildLogRef = useRef<HTMLDivElement>(null);
  const buildRunning = buildStatus === 'building';

  useEffect(() => {
    if (buildLogRef.current) buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
  }, [buildLog]);

  return (
    <div className="mt-4 border border-line bg-[#0c0c0c]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg-1">
        <span className="font-mono text-sm tracking-[.08em] uppercase text-ink-3">
          {t('gameForm.buildLogTitle')}
        </span>
        {buildStatus !== 'none' && (
          <>
            <StatusBadge
              status={
                buildStatus === 'building' ? 'building' : buildStatus === 'ok' ? 'built' : 'none'
              }
              label={
                buildStatus === 'building'
                  ? t('gameForm.buildBuilding')
                  : buildStatus === 'ok'
                    ? t('gameForm.buildComplete')
                    : t('gameForm.buildFailed')
              }
              className="ml-auto"
            />
            {!buildRunning && (
              <Button
                size="sm"
                variant={buildStatus === 'ok' ? 'primary' : 'ghost'}
                onClick={onGoToDashboard}
              >
                {buildStatus === 'ok' ? t('gameForm.buildToDashboard') : t('gameForm.buildClose')}
              </Button>
            )}
          </>
        )}
      </div>
      <div
        ref={buildLogRef}
        className="font-mono text-sm leading-6 px-3 py-3.5 h-37.5 overflow-y-auto"
      >
        {buildStatus === 'none' && (
          <span className="text-ink-3">{t('gameForm.buildLogPrompt')}</span>
        )}
        {buildLog.map((line, i) => (
          <BuildLine key={i} line={line} />
        ))}
      </div>
    </div>
  );
}
