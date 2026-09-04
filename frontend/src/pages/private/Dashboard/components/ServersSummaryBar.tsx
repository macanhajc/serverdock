import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Upload } from 'pixelarticons/react';
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
    <div className="flex flex-row justify-between items-center border border-line bg-bg-1 px-5 py-4 mb-6">
      <div className="flex flex-1 items-center gap-8">
        <div className="flex flex-col flex-1">
          <div className="font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
            {t('adminDashboard.serversCardLabel')}
          </div>
          <div className="flex flex-1 items-baseline gap-2">
            <span className="text-[26px] font-bold tabular-nums leading-none">{onlineCount}</span>
            <span className="font-mono text-sm text-ink-3">
              {t('adminDashboard.onlineOfTotal', { total: totalCount })}
            </span>
          </div>
        </div>

        <div className="border-l border-line pl-8">
          <div className="font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-3">
            {t('adminDashboard.playersCardLabel')}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-bold tabular-nums leading-none">{usersOnline}</span>
            <span className="font-mono text-sm text-ink-3">
              {t('adminDashboard.playersOnline')}
            </span>
          </div>
        </div>
      </div>

      {canImport && (
        <div className="flex flex-1 justify-end gap-2">
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
            <Upload width={12} height={12} className="mr-1.5" />
            {importing ? t('adminDashboard.importing') : t('adminDashboard.importGame')}
          </Button>
          <Button variant="primary" onClick={onAddGame}>
            <Plus width={12} height={12} className="mr-1.5" />
            {t('adminDashboard.addGame')}
          </Button>
        </div>
      )}
    </div>
  );
}
