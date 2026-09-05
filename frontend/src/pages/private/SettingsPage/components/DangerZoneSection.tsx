import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash, WarningDiamond } from 'pixelarticons/react';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { SettingsCard } from './SettingsCard';
import { settingsErrorMessage } from '../hooks/settingsApi';
import { useWipeAll } from '../hooks/useWipeAll';

export function DangerZoneSection({
  canManage,
  open,
  onToggle,
}: {
  canManage: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const wipeAll = useWipeAll();

  function handleWipe() {
    wipeAll.mutate(undefined, {
      onSuccess: (data) => addToast(t('settings.wipeSuccess', { count: data.wiped })),
      onError: (err) => addToast(settingsErrorMessage(err, t('settings.wipeFailed')), 'error'),
    });
  }

  return (
    <SettingsCard
      icon={<WarningDiamond width={14} height={14} />}
      title={t('settings.dangerZoneTitle')}
      description={t('settings.dangerZoneDesc')}
      open={open}
      onToggle={onToggle}
      danger
    >
      <div
        className="flex items-center justify-between gap-4 px-4 py-4"
        style={{
          background: 'color-mix(in oklab, var(--red) 6%, transparent)',
          border: '1px dashed color-mix(in oklab, var(--red) 25%, transparent)',
        }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-ink">{t('settings.wipeAllTitle')}</span>
          <span className="font-mono text-xs text-ink-3">{t('settings.wipeAllDesc')}</span>
        </div>
        {canManage && (
          <Button
            variant="danger"
            size="sm"
            disabled={wipeAll.isPending}
            onClick={() => setConfirmWipe(true)}
          >
            <Trash width={12} height={12} className="mr-1.5" />
            {wipeAll.isPending ? t('settings.wiping') : t('settings.wipeAllBtn')}
          </Button>
        )}
      </div>

      {confirmWipe && (
        <ConfirmModal
          title={t('settings.wipeConfirmTitle')}
          message={t('settings.wipeConfirmMessage')}
          confirmLabel={t('settings.wipeConfirmBtn')}
          onConfirm={() => {
            setConfirmWipe(false);
            handleWipe();
          }}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </SettingsCard>
  );
}
