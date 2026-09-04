import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CircleInfo } from 'pixelarticons/react';

export function ManualNotice({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section>
      <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CircleInfo width={14} height={14} className="text-ink-3 shrink-0" />
          <span className="font-mono text-sm text-ink font-semibold">
            {t('network.manualTitle')}
          </span>
        </div>
        <p className="m-0 font-mono text-xs text-ink-2">{t('network.manualBody')}</p>
        {canManage && (
          <button
            onClick={() => navigate('/admin/settings')}
            className="w-fit inline-flex items-center gap-1.5 font-mono text-xs text-ink-3 border border-line px-3 py-1.5 cursor-pointer hover:text-ink hover:bg-bg-1"
          >
            {t('network.manualSettingsLink')} →
          </button>
        )}
      </div>
    </section>
  );
}
