import { useTranslation } from 'react-i18next';
import { Close, Database, WarningDiamond } from 'pixelarticons/react';
import { TextField } from '../../../../components/forms/TextField';
import { SettingsCard } from './SettingsCard';

export function DataStorageSection({
  dataRoot,
  defaultDataRoot,
  canManage,
  onChange,
  open,
  onToggle,
  dirty,
}: {
  dataRoot: string;
  defaultDataRoot: string;
  canManage: boolean;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
  dirty: boolean;
}) {
  const { t } = useTranslation();
  const effectiveRoot = dataRoot.trim() || defaultDataRoot;

  return (
    <SettingsCard
      icon={<Database width={14} height={14} />}
      title={t('settings.dataStorageTitle')}
      description={t('settings.dataStorageDesc')}
      open={open}
      onToggle={onToggle}
      dirty={dirty}
      summary={effectiveRoot}
    >
      <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
        <TextField
          label={t('settings.dataRootLabel')}
          hint={t('settings.dataRootHint')}
          mono
          disabled={!canManage}
          placeholder={t('settings.dataRootPlaceholder')}
          value={dataRoot}
          onChange={(e) => onChange(e.target.value)}
        />

        {canManage && dataRoot.trim() && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="self-start inline-flex items-center gap-1 font-mono text-xs text-ink-3 underline cursor-pointer bg-transparent border-0 p-0 hover:text-ink"
          >
            <Close width={11} height={11} />
            {t('settings.dataRootClear')}
          </button>
        )}

        <div
          className="px-3 py-2.5 font-mono text-xs flex flex-col gap-1"
          style={{
            background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
            border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
          }}
        >
          <span className="text-ink-3 uppercase tracking-[.06em] text-[10px]">
            {t('settings.effectiveLabel')}
          </span>
          <span className="text-ink-2">{t('settings.effectiveDesc')}</span>
          <span className="text-ink break-all">
            {t('settings.effectivePattern', { root: effectiveRoot })}
          </span>
        </div>

        <div
          className="flex gap-2 px-3 py-2.5 font-mono text-xs text-yellow"
          style={{
            background: 'color-mix(in oklab, var(--yellow) 6%, transparent)',
            border: '1px solid color-mix(in oklab, var(--yellow) 30%, transparent)',
          }}
        >
          <WarningDiamond width={13} height={13} className="shrink-0" />
          <span>{t('settings.migrationWarning')}</span>
        </div>
      </div>
    </SettingsCard>
  );
}
