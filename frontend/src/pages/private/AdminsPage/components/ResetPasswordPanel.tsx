import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { TextField } from '../../../../components/forms/TextField';
import type { Admin } from '../../../../types';
import { adminErrorMessage } from '../hooks/adminsApi';
import { useResetAdminPassword } from '../hooks/useResetAdminPassword';

export function ResetPasswordPanel({
  admin,
  onCancel,
  onDone,
}: {
  admin: Admin;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [lengthError, setLengthError] = useState('');
  const resetPassword = useResetAdminPassword();

  function save() {
    if (newPassword.length < 8) {
      setLengthError(t('admins.errPasswordLength'));
      return;
    }
    setLengthError('');
    resetPassword.mutate(
      { id: admin.id, newPassword },
      {
        onSuccess: () => {
          addToast(t('admins.passwordReset', { username: admin.username }));
          onDone();
        },
      }
    );
  }

  const error = lengthError || adminErrorMessage(resetPassword.error, t, 'admins.errSaveFailed');

  return (
    <div className="px-4 py-4 bg-bg-2 border-t border-line flex flex-col gap-3">
      <TextField
        label={t('admins.fieldNewPassword')}
        type="password"
        mono
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="max-w-70"
      />
      {error && <span className="font-mono text-xs text-red">{error}</span>}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={resetPassword.isPending} onClick={save}>
          {resetPassword.isPending ? t('common.loading') : t('admins.actResetPassword')}
        </Button>
        <Button size="sm" variant="ghost" disabled={resetPassword.isPending} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
