import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Server as ServerIcon, Upload } from 'pixelarticons/react';
import { Button } from '../../../../components';

export function ServersSummaryBar({
  onlineCount,
  totalCount,
  usersOnline,
  canImport,
  importing,
  onImportFile,
  onAddGame,
}: {
  onlineCount: number;
  totalCount: number;
  usersOnline: number;
  canImport: boolean;
  importing: boolean;
  onImportFile: (file: File | null) => void;
  onAddGame: () => void;
}) {
  const { t } = useTranslation();
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex container flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-2 tracking-wider uppercase mb-3">
          <ServerIcon width={16} height={16} className="text-accent" />
          {t('servers.title')}
        </div>
        <div className="flex items-center gap-8 font-mono">
          <div>
            <span className="text-[11px] text-ink-3 block uppercase mb-1">
              {t('adminDashboard.serversCardLabel')}
            </span>
            <span className="text-lg font-bold tabular-nums text-ink leading-none">
              {onlineCount}
            </span>
            <span className="text-sm text-ink-3">
              {' '}
              {t('adminDashboard.onlineOfTotal', { total: totalCount })}
            </span>
          </div>

          <div className="pl-6">
            <span className="text-[11px] text-ink-3 block uppercase mb-1">
              {t('adminDashboard.playersCardLabel')}
            </span>
            <span className="text-lg font-bold tabular-nums text-ink leading-none">
              {usersOnline}
            </span>
            <span className="text-sm text-ink-3"> {t('adminDashboard.playersOnline')}</span>
          </div>
        </div>
      </div>

      {canImport && (
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              onImportFile(e.target.files?.[0] ?? null);
              // Reset so re-selecting the same file path still fires onChange.
              e.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload width={14} height={14} className="mr-1.5" />
            {importing ? t('adminDashboard.importing') : t('adminDashboard.importGame')}
          </Button>
          <Button variant="primary" onClick={onAddGame}>
            <Plus width={14} height={14} className="mr-1.5" />
            {t('adminDashboard.addGame')}
          </Button>
        </div>
      )}
    </div>
  );
}
