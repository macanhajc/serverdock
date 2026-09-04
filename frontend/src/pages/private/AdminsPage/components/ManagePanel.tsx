import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import type { Admin, AdminRole, Permission } from '../../../../types';
import { ROLE_OPTIONS } from '../constants';
import { adminErrorMessage } from '../hooks/adminsApi';
import { useUpdateAdmin } from '../hooks/useUpdateAdmin';
import { PermissionChecklist } from './PermissionChecklist';

function permSet(list: Permission[] | null): Set<Permission> {
  return new Set(list ?? []);
}

export function ManagePanel({
  admin,
  catalog,
  onCancel,
  onSaved,
}: {
  admin: Admin;
  catalog: Permission[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [role, setRole] = useState<AdminRole>(admin.role);
  const [selected, setSelected] = useState<Set<Permission>>(permSet(admin.permissions));
  const updateAdmin = useUpdateAdmin();

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function save() {
    updateAdmin.mutate(
      { id: admin.id, role, permissions: [...selected] },
      {
        onSuccess: () => {
          addToast(t('admins.saved', { username: admin.username }));
          onSaved();
        },
      }
    );
  }

  const error = adminErrorMessage(updateAdmin.error, t, 'admins.errSaveFailed');

  return (
    <div className="px-4 py-4 bg-bg-2 border-t border-line flex flex-col gap-4">
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

      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={updateAdmin.isPending} onClick={save}>
          {updateAdmin.isPending ? t('common.loading') : t('common.save')}
        </Button>
        <Button size="sm" variant="ghost" disabled={updateAdmin.isPending} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
