import { useTranslation } from 'react-i18next';
import { Close, Download, Trash } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';

export function FormFooter({
  isEdit,
  canDelete,
  canSave,
  saving,
  buildRunning,
  isLocalImage,
  error,
  onDelete,
  onExport,
  onCancel,
  onSave,
  onSaveAndBuild,
}: {
  isEdit: boolean;
  canDelete: boolean;
  canSave: boolean;
  saving: boolean;
  buildRunning: boolean;
  isLocalImage: boolean;
  error: string;
  onDelete: () => void;
  onExport: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSaveAndBuild: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="shrink-0 flex items-center gap-3 px-6 py-3 border-t border-line"
      style={{
        background: 'color-mix(in oklab, var(--bg-1) 94%, transparent)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {isEdit && canDelete && (
        <Button variant="danger" disabled={saving} onClick={onDelete}>
          <Trash width={12} height={12} className="mr-1.5" />
          {t('gameForm.actDelete')}
        </Button>
      )}

      {isEdit && (
        <Button variant="ghost" disabled={saving} onClick={onExport}>
          <Download width={12} height={12} className="mr-1.5" />
          {t('gameForm.actExport')}
        </Button>
      )}

      <span className="font-mono text-sm text-ink-3">
        {isLocalImage ? t('gameForm.footerSteam') : t('gameForm.footerPublic')}
      </span>

      <span className="flex-1" />

      {error && <span className="font-mono text-sm text-red max-w-70">{error}</span>}

      <Button variant="ghost" disabled={saving} onClick={onCancel}>
        <Close width={12} height={12} className="mr-1.5" />
        {t('gameForm.actCancel')}
      </Button>

      {canSave && (
        <Button variant="primary" disabled={saving} onClick={onSave}>
          {saving && !buildRunning ? t('gameForm.actSaving') : t('gameForm.actSave')}
        </Button>
      )}

      {isLocalImage && canSave && (
        <Button variant="primary" disabled={saving || buildRunning} onClick={onSaveAndBuild}>
          {saving ? t('gameForm.actSaving') : t('gameForm.actSaveAndBuild')}
        </Button>
      )}
    </div>
  );
}
