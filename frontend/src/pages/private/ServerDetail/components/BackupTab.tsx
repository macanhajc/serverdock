import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { fmtBytes } from '../../../../utils/format';
import type { BackupEntry } from '../../../../types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface BackupTabProps {
  id: string;
  token: string | null;
}

export function BackupTab({ id, token }: BackupTabProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<BackupEntry | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/backups/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: BackupEntry[]) => setBackups(data))
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function createBackup() {
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`/api/backups/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: createLabel.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error ?? 'Backup failed');
        return;
      }
      setBackups((prev) => [data, ...prev]);
      setShowCreateForm(false);
      setCreateLabel('');
      addToast(t('serverDetail.backupCreated'));
    } catch {
      setCreateError('Could not reach server');
    } finally {
      setCreating(false);
    }
  }

  async function doRestore(backup: BackupEntry) {
    setActionId(backup.id);
    try {
      const res = await fetch(`/api/backups/${id}/${backup.id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        addToast(t('serverDetail.backupRestored'));
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('serverDetail.backupRestoreFailed'), 'error');
      }
    } catch {
      addToast(t('serverDetail.backupRestoreFailed'), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function doDelete(backup: BackupEntry) {
    setActionId(backup.id);
    try {
      const res = await fetch(`/api/backups/${id}/${backup.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBackups((prev) => prev.filter((b) => b.id !== backup.id));
        addToast(t('serverDetail.backupDeleted'));
      } else {
        addToast(t('serverDetail.backupDeleteFailed'), 'error');
      }
    } catch {
      addToast(t('serverDetail.backupDeleteFailed'), 'error');
    } finally {
      setActionId(null);
    }
  }

  function downloadBackup(backup: BackupEntry) {
    window.open(`/api/backups/${id}/${backup.id}/download?token=${token}`);
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 h-14 border-b border-line bg-bg-1 flex-none">
        <span className="font-mono text-xs text-ink-3">
          {backups.length} backup{backups.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto">
          {!showCreateForm && (
            <Button size="sm" variant="primary" onClick={() => setShowCreateForm(true)}>
              {t('serverDetail.backupCreate')}
            </Button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="px-6 py-5 border-b border-line bg-bg-1 flex flex-col gap-3">
          <input
            type="text"
            value={createLabel}
            onChange={(e) => setCreateLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createBackup()}
            placeholder={t('serverDetail.backupLabelPlaceholder')}
            autoFocus
            className="bg-bg-2 border border-line-2 font-mono text-sm text-ink px-3 py-2 outline-none focus:border-accent"
            style={{ borderRadius: 0 }}
          />
          {createError && <div className="font-mono text-xs text-red">{createError}</div>}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={creating} onClick={createBackup}>
              {creating ? t('serverDetail.backupCreating') : t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreateForm(false);
                setCreateLabel('');
                setCreateError('');
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="px-6 py-8 font-mono text-xs text-ink-3">{t('common.loading')}</div>
      ) : backups.length === 0 && !showCreateForm ? (
        <div className="px-6 py-12 flex flex-col items-center gap-4">
          <p className="font-mono text-sm text-ink-3 text-center">{t('serverDetail.backupEmpty')}</p>
          <Button variant="primary" onClick={() => setShowCreateForm(true)}>
            {t('serverDetail.backupCreate')}
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {backups.map((b) => {
            const busy = actionId === b.id;
            const displayName = b.label ?? fmtDate(b.createdAt);
            return (
              <div key={b.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-bg-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{displayName}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono text-xs text-ink-2">{fmtDate(b.createdAt)}</span>
                    <span className="font-mono text-xs text-ink-3">·</span>
                    <span className="font-mono text-xs text-ink-3">{relativeTime(b.createdAt)}</span>
                    <span className="font-mono text-xs text-ink-3">·</span>
                    <span className="font-mono text-xs text-ink-3">{fmtBytes(b.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" onClick={() => downloadBackup(b)} disabled={busy}>
                    {t('serverDetail.backupDownload')}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setConfirmRestore(b)}
                    disabled={busy}
                  >
                    {busy && actionId === b.id ? t('serverDetail.backupRestoring') : t('serverDetail.backupRestore')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmDelete(b)}
                    disabled={busy}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={t('serverDetail.backupConfirmDeleteTitle')}
          message={t('serverDetail.backupConfirmDeleteMessage')}
          confirmLabel={t('serverDetail.backupConfirmDeleteBtn')}
          onConfirm={() => {
            doDelete(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmRestore && (
        <ConfirmModal
          title={t('serverDetail.backupConfirmRestoreTitle')}
          message={t('serverDetail.backupConfirmRestoreMessage')}
          confirmLabel={t('serverDetail.backupConfirmRestoreBtn')}
          onConfirm={() => {
            doRestore(confirmRestore);
            setConfirmRestore(null);
          }}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  );
}
