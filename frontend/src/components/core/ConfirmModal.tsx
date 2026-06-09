import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const cl = cancelLabel ?? t('common.cancel');

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: 'color-mix(in oklab, #000 70%, transparent)' }}
      onClick={onCancel}
    >
      <div
        className="w-100 max-w-full bg-bg-1 border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
          <span className="text-yellow font-bold text-[15px]">⚠</span>
          <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        </div>

        <div className="p-6">
          <p className="m-0 text-sm text-ink-2">{message}</p>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-line">
          <Button variant="ghost" onClick={onCancel}>
            {cl}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
