import { useState, useEffect, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { TextField } from '../../../components/forms/TextField';
import { SegmentedControl } from '../../../components/forms/SegmentedControl';
import { formatDate } from '../../../utils/format';
import type { Admin, AdminRole, Permission } from '../../../types';

const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Super Admin', value: 'super_admin' },
];

function PermissionChecklist({
  catalog,
  selected,
  onToggle,
  t,
}: {
  catalog: Permission[];
  selected: Set<Permission>;
  onToggle: (p: Permission) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {catalog.map((p) => (
        <label
          key={p}
          className="flex items-center gap-2 font-mono text-xs text-ink-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.has(p)}
            onChange={() => onToggle(p)}
            className="accent-current"
          />
          {/* i18next treats ':' as its namespace separator by default, so the
              permission key (e.g. "servers:power") can't be used verbatim */}
          {t(`admins.perm.${p.replace(':', '_')}`)}
        </label>
      ))}
    </div>
  );
}

function permSet(list: Permission[] | null): Set<Permission> {
  return new Set(list ?? []);
}

// ─── Manage row (role + permissions) ───────────────────────────────────────

function ManagePanel({
  admin,
  catalog,
  onCancel,
  onSaved,
}: {
  admin: Admin;
  catalog: Permission[];
  onCancel: () => void;
  onSaved: (updated: Admin) => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const [role, setRole] = useState<AdminRole>(admin.role);
  const [selected, setSelected] = useState<Set<Permission>>(permSet(admin.permissions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('admins.errSaveFailed'));
        setSaving(false);
        return;
      }
      addToast(t('admins.saved', { username: admin.username }));
      onSaved(data);
    } catch {
      setError(t('admins.couldNotReach'));
      setSaving(false);
    }
  }

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
        <Button size="sm" variant="primary" disabled={saving} onClick={save}>
          {saving ? t('common.loading') : t('common.save')}
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

// ─── Reset password panel ──────────────────────────────────────────────────

function ResetPasswordPanel({
  admin,
  onCancel,
  onDone,
}: {
  admin: Admin;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (newPassword.length < 8) {
      setError(t('admins.errPasswordLength'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admins/${admin.id}/password`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('admins.errSaveFailed'));
        setSaving(false);
        return;
      }
      addToast(t('admins.passwordReset', { username: admin.username }));
      onDone();
    } catch {
      setError(t('admins.couldNotReach'));
      setSaving(false);
    }
  }

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
        <Button size="sm" variant="primary" disabled={saving} onClick={save}>
          {saving ? t('common.loading') : t('admins.actResetPassword')}
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

// ─── Create admin form ──────────────────────────────────────────────────────

function CreateAdminForm({
  catalog,
  onCreated,
}: {
  catalog: Permission[];
  onCreated: (admin: Admin) => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(p: Permission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function create() {
    setError('');
    if (!username.trim()) {
      setError(t('admins.errUsernameRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('admins.errPasswordLength'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          role,
          permissions: [...selected],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('admins.errSaveFailed'));
        setSaving(false);
        return;
      }
      addToast(t('admins.created', { username: data.username }));
      setUsername('');
      setPassword('');
      setRole('admin');
      setSelected(new Set());
      onCreated(data);
    } catch {
      setError(t('admins.couldNotReach'));
    } finally {
      setSaving(false);
    }
  }

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
        <Button variant="primary" disabled={saving} onClick={create}>
          {saving ? t('common.loading') : t('admins.actCreate')}
        </Button>
      </div>
    </div>
  );
}

// ─── AdminsPage ──────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const { t } = useTranslation();
  const { token, username: myUsername } = useAuth();
  const { addToast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<{ id: string; mode: 'manage' | 'password' } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<Admin | null>(null);

  const fetchAdmins = useCallback(
    () =>
      fetch('/api/admins', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: Admin[]) => {
          setAdmins(data);
          setLoaded(true);
        })
        .catch(() => setLoaded(true)),
    [token]
  );

  useEffect(() => {
    fetchAdmins();
    fetch('/api/admins/permissions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setCatalog)
      .catch(() => {});
  }, [fetchAdmins, token]);

  async function handleDelete(admin: Admin) {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
        addToast(t('admins.removed', { username: admin.username }));
      } else {
        addToast(data.error ?? t('admins.errDeleteFailed'), 'error');
      }
    } catch {
      addToast(t('admins.couldNotReach'), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={t('admins.title')}
        subtitle={t('admins.subtitle', { count: admins.length })}
      />

      <div className="px-6 py-5 container">
        <CreateAdminForm
          catalog={catalog}
          onCreated={(admin) => setAdmins((prev) => [...prev, admin])}
        />

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
                            <span className="ml-2 font-mono text-[10px] text-ink-3">
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
                              {t('admins.actResetPassword')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={isSelf}
                              onClick={() => setConfirmDelete(a)}
                            >
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
                              onSaved={(updated) => {
                                setAdmins((prev) =>
                                  prev.map((x) => (x.id === updated.id ? updated : x))
                                );
                                setExpanded(null);
                              }}
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
