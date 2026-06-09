import { useTranslation } from 'react-i18next';
import { LangSwitcher } from '../../../components/core/LangSwitcher';

export default function Blocked() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg">
      <div
        className="min-h-screen grid place-items-center px-5 py-10"
        style={{
          background: `
            radial-gradient(60% 50% at 50% 0%, #161616 0%, var(--bg) 60%),
            repeating-linear-gradient(0deg, transparent 0 38px, color-mix(in oklab,var(--line) 40%,transparent) 38px 39px),
            repeating-linear-gradient(90deg, transparent 0 38px, color-mix(in oklab,var(--line) 40%,transparent) 38px 39px)
          `,
        }}
      >
        <div className="w-95 max-w-full bg-bg-1 border border-line">
          {/* Card header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
            <span className="w-7.5 h-7.5 bg-accent grid place-items-center text-white font-bold text-base font-mono">
              S
            </span>
            <b className="text-[17px] font-bold">ServerDock</b>
            <span className="ml-auto font-mono text-xs tracking-[.08em] uppercase text-ink-3 border border-line px-2 py-0.5">
              /blocked
            </span>
          </div>

          {/* Card body */}
          <div className="p-6 flex flex-col gap-4">
            <div
              className="flex items-start gap-2 px-3 py-3 font-mono text-xs text-red"
              style={{
                background: 'color-mix(in oklab, var(--red) 10%, transparent)',
                border: '1px solid color-mix(in oklab, var(--red) 45%, transparent)',
              }}
            >
              <span className="shrink-0">✕</span>
              <span>{t('blocked.message')}</span>
            </div>

            <p className="m-0 font-mono text-xs text-ink-3">{t('blocked.hint')}</p>
          </div>

          {/* Card footer */}
          <div className="flex items-center gap-2 px-6 py-3 border-t border-line font-mono text-xs text-ink-3">
            <span className="w-2 h-2 bg-red rounded-full" />
            {t('blocked.footer')}
            <LangSwitcher className="ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
