import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/core/Button';

const NETBIRD_INSTALL_URL = 'https://app.netbird.io/install';

interface HowToConnectModalProps {
  onClose: () => void;
}

function Step({
  n,
  title,
  text,
  children,
}: {
  n: number;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="w-6 h-6 shrink-0 grid place-items-center font-mono text-xs font-bold"
        style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-edge)', color: 'var(--ink)' }}
      >
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <p className="m-0 mt-0.5 text-sm text-ink-2 leading-relaxed">{text}</p>
        {children}
      </div>
    </div>
  );
}

export function HowToConnectModal({ onClose }: HowToConnectModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: 'color-mix(in oklab, #000 70%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="w-125 max-w-full max-h-[85vh] overflow-y-auto bg-bg-1 border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
          <span className="text-accent font-bold text-[15px]">ℹ</span>
          <h2 className="m-0 text-[15px] font-bold">{t('publicDashboard.howToConnectTitle')}</h2>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <p className="m-0 text-sm text-ink-2 leading-relaxed">
            {t('publicDashboard.howToConnectIntro')}
          </p>

          <Step n={1} title={t('publicDashboard.connectStep1Title')} text={t('publicDashboard.connectStep1')}>
            <a
              href={NETBIRD_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 font-mono text-xs text-accent hover:underline"
            >
              app.netbird.io/install ↗
            </a>
            <p className="m-0 mt-2 text-xs text-ink-3 leading-relaxed">
              {t('publicDashboard.connectStep1Tip')}
            </p>
          </Step>
          <Step n={2} title={t('publicDashboard.connectStep2Title')} text={t('publicDashboard.connectStep2')} />
          <Step n={3} title={t('publicDashboard.connectStep3Title')} text={t('publicDashboard.connectStep3')} />
          <Step n={4} title={t('publicDashboard.connectStep4Title')} text={t('publicDashboard.connectStep4')} />

          <div
            className="px-3 py-2.5 text-xs text-ink-2 flex flex-col gap-1.5"
            style={{
              background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
              border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 shrink-0" style={{ background: 'var(--green)', borderRadius: '50%' }} />
              {t('publicDashboard.legendOnline')}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 shrink-0" style={{ background: 'var(--yellow)', borderRadius: '50%' }} />
              {t('publicDashboard.legendStarting')}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 shrink-0" style={{ background: 'var(--red)', borderRadius: '50%' }} />
              {t('publicDashboard.legendOffline')}
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-line">
          <Button variant="primary" onClick={onClose}>
            {t('publicDashboard.gotIt')}
          </Button>
        </div>
      </div>
    </div>
  );
}
