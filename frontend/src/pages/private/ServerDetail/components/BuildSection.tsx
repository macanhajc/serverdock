import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tools } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';
import { StatusBadge } from '../../../../components/core/StatusBadge';
import { BuildLine } from '../../GameForm/components/BuildLine';
import { useBuildLog } from '../../../../hooks/useBuildLog';

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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function triggerBuild() {
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`/api/games/${id}/build`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('serverDetail.buildStartFailed'));
        return;
      }
      startBuild();
    } catch {
      setError(t('serverDetail.buildStartFailed'));
    } finally {
      setStarting(false);
    }
  }

  const building = status === 'building';
  // Once a build finishes in this session, trust that result over the page's
  // initial snapshot — reflects the outcome without needing a full refetch.
  const built = status === 'ok' ? true : status === 'failed' ? false : !!imageBuilt;

  return (
    <section className="border-t border-line pt-6">
      <div className="font-mono text-xs text-ink-3 tracking-widest uppercase mb-2 px-1">
        {t('serverDetail.buildSectionTitle')}
      </div>
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
          disabled={building || starting}
          onClick={triggerBuild}
        >
          <Tools width={12} height={12} className="mr-1.5" />
          {building
            ? t('serverDetail.building')
            : built
              ? t('serverDetail.rebuild')
              : t('serverDetail.buildNow')}
        </Button>
      </div>

      {error && <div className="font-mono text-xs text-red mt-2">{error}</div>}

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
