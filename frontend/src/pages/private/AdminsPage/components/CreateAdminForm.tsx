import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { TextField } from '../../../../components/forms/TextField';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import type { AdminRole, Permission } from '../../../../types';
import { ROLE_OPTIONS } from '../constants';
import { adminErrorMessage } from '../hooks/adminsApi';
import { useCreateAdmin } from '../hooks/useCreateAdmin';
import { PermissionChecklist } from './PermissionChecklist';

export function CreateAdminForm({ catalog }: { catalog: Permission[] }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [formError, setFormError] = useState('');
  const createAdmin = useCreateAdmin();

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function create() {
    setFormError('');
    if (!username.trim()) {
      setFormError(t('admins.errUsernameRequired'));
      return;
    }
    if (password.length < 8) {
      setFormError(t('admins.errPasswordLength'));
      return;
    }
    createAdmin.mutate(
      { username: username.trim(), password, role, permissions: [...selected] },
      {
        onSuccess: (data) => {
          addToast(t('admins.created', { username: data.username }));
          setUsername('');
          setPassword('');
          setRole('admin');
          setSelected(new Set());
        },
      }
    );
  }

  const error = formError || adminErrorMessage(createAdmin.error, t, 'admins.errSaveFailed');

  return (
    <div className="border border-line bg-bg-1 p-5 flex flex-col gap-4 mb-6">
      <div className="font-mono text-xs tracking-widest uppercase text-ink-3">
        {t('admins.createTitle')}
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-140">
        <TextField
          label={t('admins.fieldUsername')}
          mono
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label={t('admins.fieldPassword')}
          type="password"
          mono
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div>
        <div className="font-mono text-[10px] tracking-[.08em] uppercase text-ink-3 mb-2">
          {t('admins.colRole')}
        </div>
        <SegmentedControl
          options={ROLE_OPTIONS}
          value={role}
          onChange={(v) => setRole(v as AdminRole)}
        />
      </div>

      {role === 'admin' && (
        <div>
          <div className="font-mono text-[10px] tracking-[.08em] uppercase text-ink-3 mb-2">
            {t('admins.permissionsTitle')}
          </div>
          <PermissionChecklist catalog={catalog} selected={selected} onToggle={toggle} t={t} />
        </div>
      )}

      {role === 'super_admin' && (
        <span className="font-mono text-[11px] text-ink-3">{t('admins.superAdminHasAll')}</span>
      )}

      {error && <span className="font-mono text-xs text-red">{error}</span>}

      <div>
        <Button variant="primary" disabled={createAdmin.isPending} onClick={create}>
          {createAdmin.isPending ? t('common.loading') : t('admins.actCreate')}
        </Button>
      </div>
    </div>
  );
}
