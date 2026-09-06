import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash, Upload } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';

export function AvatarUploadField({
  name,
  slug,
  avatarPreview,
  avatarError,
  onFileChange,
  onRemove,
}: {
  name: string;
  slug: string;
  avatarPreview: string | null;
  avatarError: string;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function handleRemove() {
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    onRemove();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="w-30 h-30 border border-line bg-bg-2 overflow-hidden grid place-items-center">
        {avatarPreview ? (
          <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-mono text-2xl font-bold text-ink-3">
            {(name || slug).slice(0, 2).toUpperCase() || '—'}
          </span>
        )}
      </div>
      <div className="flex gap-2" style={{ width: 'max-content' }}>
        <Button size="sm" onClick={() => avatarInputRef.current?.click()}>
          <Upload width={12} height={12} className="mr-1.5" />
          {t('gameForm.avatarUpload')}
        </Button>
        {avatarPreview && (
          <Button size="sm" variant="ghost" onClick={handleRemove}>
            <Trash width={12} height={12} className="mr-1.5" />
            {t('gameForm.avatarRemove')}
          </Button>
        )}
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {avatarError && <span className="font-mono text-[10px] text-red">{avatarError}</span>}
    </div>
  );
}
