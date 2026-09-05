import { useTranslation } from 'react-i18next';
import { Check, Refresh, WarningDiamond, X } from 'pixelarticons/react';
import { useCheckForUpdate } from '../hooks/useCheckForUpdate';

export function UpdateCheckRow({ id, token }: { id: string; token: string | null }) {
  const { t } = useTranslation();
  const check = useCheckForUpdate(id, token);
  const result = check.data;

  let label: string | null = null;
  let color = 'var(--ink-3)';
  let ResultIcon: typeof WarningDiamond | null = null;
  if (result) {
    if (result.updateAvailable === true) {
      label = t('serverDetail.updateAvailable');
      color = 'var(--accent-2)';
      ResultIcon = WarningDiamond;
    } else if (result.updateAvailable === false) {
      label = t('serverDetail.upToDate');
      color = 'var(--green)';
      ResultIcon = Check;
    } else if (result.reason === 'not_pulled') {
      label = t('serverDetail.imageNotPulled');
      ResultIcon = X;
    } else {
      label = t('serverDetail.updateCheckFailed');
      ResultIcon = X;
    }
  }

  return (
    <div className="flex group">
      <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-2.5 border-r border-line uppercase tracking-wider w-32 shrink-0">
        {t('serverDetail.imageUpdateLabel')}
      </span>

      <span className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-3">
        {label && (
          <span
            className="inline-flex items-center gap-1.5 capitalize font-mono text-xs"
            style={{ color }}
          >
            {ResultIcon && <ResultIcon width={12} height={12} />}
            {label}
          </span>
        )}
        <button
          onClick={() => check.mutate()}
          disabled={check.isPending}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3 hover:text-ink px-2 py-0.5 border border-line bg-bg-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Refresh width={11} height={11} />
          {check.isPending ? t('common.loading') : t('serverDetail.checkForUpdates')}
        </button>
      </span>
    </div>
  );
}
