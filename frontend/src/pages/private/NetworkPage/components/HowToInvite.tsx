import { useTranslation } from 'react-i18next';
import { CircleInfo } from 'pixelarticons/react';
import type { NetworkProviderMeta } from '../../../../data/networkProviders';

export function HowToInvite({ providerMeta }: { providerMeta: NetworkProviderMeta }) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
        <CircleInfo width={14} height={14} />
        {t('network.howToInvite')}
      </h2>
      <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3 font-mono text-xs text-ink-2">
        <p className="m-0 text-ink-3">
          {t('network.sharedAccountNote', { provider: providerMeta.label })}
        </p>
        <p className="m-0">{t('network.step1', { provider: providerMeta.label })}</p>
        <p className="m-0">{t('network.step2', { provider: providerMeta.label })}</p>
        <p className="m-0">{t('network.step3')}</p>
        <p className="m-0 text-ink-3">
          {t('network.removeAccess')}{' '}
          <span className="text-ink-2">
            {t('network.vpnDashboard', { provider: providerMeta.label })}
          </span>{' '}
          {t('network.removeAccessPost')}
        </p>
      </div>
    </section>
  );
}
