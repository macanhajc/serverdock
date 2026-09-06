import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Gear, Key, Trash, User } from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { formatDate } from '../../../utils/format';
import type { Admin } from '../../../types';
import { ManagePanel } from './components/ManagePanel';
import { ResetPasswordPanel } from './components/ResetPasswordPanel';
import { CreateAdminForm } from './components/CreateAdminForm';
import { useAdmins } from './hooks/useAdmins';
import { usePermissionCatalog } from './hooks/usePermissionCatalog';
import { useDeleteAdmin } from './hooks/useDeleteAdmin';
import { adminErrorMessage } from './hooks/adminsApi';

export default function AdminsPage() {
  const { t } = useTranslation();
  const { username: myUsername } = useAuth();
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState<{ id: string; mode: 'manage' | 'password' } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<Admin | null>(null);

  const adminsQuery = useAdmins();
  const catalogQuery = usePermissionCatalog();
  const deleteAdmin = useDeleteAdmin();

  const admins = adminsQuery.data ?? [];
  const catalog = catalogQuery.data ?? [];
  const loaded = !adminsQuery.isLoading;

  function handleDelete(admin: Admin) {
    deleteAdmin.mutate(admin.id, {
      onSuccess: () => addToast(t('admins.removed', { username: admin.username })),
      onError: (err) => {
        addToast(
          adminErrorMessage(err, t, 'admins.errDeleteFailed') ?? t('admins.errDeleteFailed'),
          'error'
        );
      },
    });
  }

  return (
    <>
      <PageHeader
        title={t('admins.title')}
        subtitle={t('admins.subtitle', { count: admins.length })}
      />

      <div className="px-6 py-5 container">
        <CreateAdminForm catalog={catalog} />

        {!loaded && <span className="font-mono text-xs text-ink-3">{t('common.loading')}</span>}

        {loaded && admins.length > 0 && (
          <div className="border border-line bg-bg-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-bg-2 border-line">
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('admins.colUsername')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('admins.colRole')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('admins.colPermissions')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('admins.colLastLogin')}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {admins.map((a, i) => {
                  const isSelf = a.username === myUsername;
                  const isExpanded = expanded?.id === a.id;
                  return (
                    <Fragment key={a.id}>
                      <tr
                        className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono border-r border-line text-sm text-ink">
                          {a.username}
                          {isSelf && (
                            <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-ink-3">
                              <User width={9} height={9} />
                              {t('admins.youBadge')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">
                          {a.role === 'super_admin'
                            ? t('admins.roleSuperAdmin')
                            : t('admins.roleAdmin')}
                        </td>
                        <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">
                          {a.role === 'super_admin'
                            ? t('admins.allPermissions')
                            : (a.permissions?.length ?? 0) > 0
                              ? t('admins.permissionCount', { count: a.permissions!.length })
                              : t('admins.noPermissions')}
                        </td>
                        <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-3 whitespace-nowrap">
                          {a.lastLoginAt ? formatDate(a.lastLoginAt) : t('admins.neverLoggedIn')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setExpanded(
                                  isExpanded && expanded?.mode === 'manage'
                                    ? null
                                    : { id: a.id, mode: 'manage' }
                                )
                              }
                            >
                              <Gear width={12} height={12} className="mr-1.5" />
                              {t('admins.actManage')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpanded(
                                  isExpanded && expanded?.mode === 'password'
                                    ? null
                                    : { id: a.id, mode: 'password' }
                                )
                              }
                            >
                              <Key width={12} height={12} className="mr-1.5" />
                              {t('admins.actResetPassword')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={isSelf}
                              onClick={() => setConfirmDelete(a)}
                            >
                              <Trash width={12} height={12} className="mr-1.5" />
                              {t('admins.remove')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && expanded?.mode === 'manage' && (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <ManagePanel
                              admin={a}
                              catalog={catalog}
                              onCancel={() => setExpanded(null)}
                              onSaved={() => setExpanded(null)}
                            />
                          </td>
                        </tr>
                      )}
                      {isExpanded && expanded?.mode === 'password' && (
                        <tr>
                          <td colSpan={5} className="p-0">
                            <ResetPasswordPanel
                              admin={a}
                              onCancel={() => setExpanded(null)}
                              onDone={() => setExpanded(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={t('admins.confirmDeleteTitle')}
          message={t('admins.confirmDeleteMessage', { username: confirmDelete.username })}
          confirmLabel={t('admins.confirmDeleteBtn')}
          onConfirm={() => {
            handleDelete(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
