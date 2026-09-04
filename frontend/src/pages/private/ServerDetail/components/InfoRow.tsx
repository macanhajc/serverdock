import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'pixelarticons/react';
import { copyText } from '../../../../utils/clipboard';

export function InfoRow({
  label,
  value,
  mono,
  suffix,
  copyable,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  suffix?: ReactNode;
  copyable?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copyText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group flex">
      <span className="font-mono bg-bg-1 text-[11px] text-ink-3 px-4 py-2.5 border-r border-line uppercase tracking-wider w-32 shrink-0">
        {label}
      </span>
      <span
        className={`flex-1 min-w-0 text-sm text-ink truncate px-4 py-2.5 ${mono ? 'font-mono' : ''}`}
      >
        {value}
        {suffix}
      </span>
      {copyable && (
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 font-mono text-[11px] text-ink-3 hover:text-ink px-2 py-0.5 border border-line bg-bg-2 cursor-pointer transition-opacity shrink-0"
        >
          {copied ? <Check width={10} height={10} /> : <Copy width={10} height={10} />}
          {copied ? '' : t('common.copy')}
        </button>
      )}
    </div>
  );
}
