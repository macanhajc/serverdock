import { useTranslation } from 'react-i18next';
import { Users, WarningDiamond } from 'pixelarticons/react';
import { Toggle } from '../../../../components/core/Toggle';
import { SettingsCard } from './SettingsCard';

export function RegistrationSection({
  registrationOpen,
  canManage,
  onChange,
  open,
  onToggle,
  dirty,
}: {
  registrationOpen: boolean;
  canManage: boolean;
  onChange: (value: boolean) => void;
  open: boolean;
  onToggle: () => void;
  dirty: boolean;
}) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      icon={<Users width={14} height={14} />}
      title={t('settings.registrationTitle')}
      description={t('settings.registrationDesc')}
      open={open}
      onToggle={onToggle}
      dirty={dirty}
      summary={registrationOpen ? t('settings.statusOpen') : t('settings.statusClosed')}
    >
      <div className="flex flex-col gap-4 border border-dashed bg-line/10 border-line-2 p-4">
        <Toggle
          checked={registrationOpen}
          disabled={!canManage}
          onChange={onChange}
          label={t('settings.registrationOpenLabel')}
        />

        {!registrationOpen && (
          <div
            className="flex gap-2 px-3 py-2.5 font-mono text-xs text-yellow"
            style={{
              background: 'color-mix(in oklab, var(--yellow) 6%, transparent)',
              border: '1px solid color-mix(in oklab, var(--yellow) 30%, transparent)',
            }}
          >
            <WarningDiamond width={13} height={13} className="shrink-0" />
            <span>{t('settings.registrationClosedWarning')}</span>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
