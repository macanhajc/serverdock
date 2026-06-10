import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '../../utils/clipboard';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e?.stopPropagation?.();
    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className={`border border-line bg-bg-2 font-mono text-[10px] px-1.5 py-0.5 cursor-pointer ${copied ? 'text-green' : 'text-ink-3'} ${className ?? ''}`}
    >
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  );
}
