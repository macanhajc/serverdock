import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Close, Download, Plus, Save, Trash, Undo } from 'pixelarticons/react';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { fmtBytes } from '../../../../utils/format';
import type { BackupEntry } from '../../../../types';
import { relativeTime } from './relativeTime';
import { useBackups } from '../hooks/useBackups';
import { useUpdateRetention } from '../hooks/useUpdateRetention';
import { useCreateBackup } from '../hooks/useCreateBackup';
import { useRestoreBackup } from '../hooks/useRestoreBackup';
import { useDeleteBackup } from '../hooks/useDeleteBackup';
import { useDownloadBackup } from '../hooks/useDownloadBackup';

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
  isRunning: boolean;
}

export function BackupTab({ id, token, isRunning }: BackupTabProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('backups:manage');

  const [retentionDraft, setRetentionDraft] = useState('0');
  const hydratedRetention = useRef(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [createError, setCreateError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<BackupEntry | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const backupsQuery = useBackups(id, token);
  const backups = backupsQuery.data?.backups ?? [];
  const retention = backupsQuery.data?.retention ?? 0;
  const loading = backupsQuery.isLoading;

  const updateRetention = useUpdateRetention(id, token);
  const createBackupMutation = useCreateBackup(id, token);
  const restoreBackupMutation = useRestoreBackup(id, token);
  const deleteBackupMutation = useDeleteBackup(id, token);
  const { download, downloadingId, downloadPct } = useDownloadBackup(id, token);

  // Sync the draft from the fetched retention exactly once — after that it's
  // purely local until saveRetention() either commits or reverts it, same as
  // the original (a later background refetch, e.g. after creating a backup,
  // must never clobber an in-progress edit).
  useEffect(() => {
    if (backupsQuery.data && !hydratedRetention.current) {
      setRetentionDraft(String(backupsQuery.data.retention));
      hydratedRetention.current = true;
    }
  }, [backupsQuery.data]);

  function saveRetention() {
    const keep = parseInt(retentionDraft, 10);
    if (isNaN(keep) || keep < 0 || keep === retention) {
      setRetentionDraft(String(retention));
      return;
    }
    updateRetention.mutate(keep, {
      onSuccess: (data) => {
        setRetentionDraft(String(data.retention));
        addToast(t('serverDetail.backupRetentionSaved'));
      },
      onError: (err) => {
        setRetentionDraft(String(retention));
        addToast(
          err instanceof Error && err.message
            ? err.message
            : t('serverDetail.backupRetentionFailed'),
          'error'
        );
      },
    });
  }

  function handleCreateBackup() {
    setCreateError('');
    createBackupMutation.mutate(createLabel, {
      onSuccess: () => {
        setShowCreateForm(false);
        setCreateLabel('');
        addToast(t('serverDetail.backupCreated'));
      },
      onError: (err) =>
        setCreateError(err instanceof Error && err.message ? err.message : 'Backup failed'),
    });
  }

  function doRestore(backup: BackupEntry) {
    setActionId(backup.id);
    restoreBackupMutation.mutate(backup.id, {
      onSuccess: () => addToast(t('serverDetail.backupRestored')),
      onError: (err) =>
        addToast(
          err instanceof Error && err.message ? err.message : t('serverDetail.backupRestoreFailed'),
          'error'
        ),
      onSettled: () => setActionId(null),
    });
  }

  function doDelete(backup: BackupEntry) {
    setActionId(backup.id);
    deleteBackupMutation.mutate(backup.id, {
      onSuccess: () => addToast(t('serverDetail.backupDeleted')),
      onError: () => addToast(t('serverDetail.backupDeleteFailed'), 'error'),
      onSettled: () => setActionId(null),
    });
  }

  function downloadBackup(backup: BackupEntry) {
    download(backup).catch(() => addToast(t('serverDetail.backupDownloadFailed'), 'error'));
  }

  const totalSize = backups.reduce((sum, b) => sum + (b.size ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 h-14 border-b border-line bg-bg-1 flex-none">
        <span className="font-mono text-xs text-ink-3">
          {t('serverDetail.backupCount', { count: backups.length })}
          {backups.length > 0 && <> · {fmtBytes(totalSize)}</>}
        </span>
        <div
          className="ml-auto flex items-center gap-2"
          title={t('serverDetail.backupRetentionHint')}
        >
          <span className="font-mono text-xs text-ink-3">{t('serverDetail.backupRetention')}</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={retentionDraft}
            disabled={updateRetention.isPending || !canManage}
            onChange={(e) => setRetentionDraft(e.target.value)}
            onBlur={saveRetention}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-16 bg-bg-2 border border-line-2 font-mono text-xs text-ink px-2 py-1 outline-none focus:border-accent disabled:opacity-40"
            style={{ borderRadius: 0 }}
          />
        </div>
        {!showCreateForm && canManage && (
          <Button size="sm" variant="primary" onClick={() => setShowCreateForm(true)}>
            <Plus width={12} height={12} className="mr-1.5" />
            {t('serverDetail.backupCreate')}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && canManage && (
        <div className="px-6 py-5 border-b border-line bg-bg-1 flex flex-col gap-3">
          {isRunning && (
            <div className="font-mono text-xs text-yellow">
              {t('serverDetail.backupRunningWarning')}
            </div>
          )}
          <input
            type="text"
            value={createLabel}
            onChange={(e) => setCreateLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBackup()}
            placeholder={t('serverDetail.backupLabelPlaceholder')}
            autoFocus
            className="bg-bg-2 border border-line-2 font-mono text-sm text-ink px-3 py-2 outline-none focus:border-accent"
            style={{ borderRadius: 0 }}
          />
          {createError && <div className="font-mono text-xs text-red">{createError}</div>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={createBackupMutation.isPending}
              onClick={handleCreateBackup}
            >
              <Save width={12} height={12} className="mr-1.5" />
              {createBackupMutation.isPending ? t('serverDetail.backupCreating') : t('common.save')}
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
              <Close width={12} height={12} className="mr-1.5" />
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
          <Archive width={24} height={24} className="text-ink-3" />
          <p className="font-mono text-sm text-ink-3 text-center">
            {t('serverDetail.backupEmpty')}
          </p>
          {canManage && (
            <Button variant="primary" onClick={() => setShowCreateForm(true)}>
              <Plus width={12} height={12} className="mr-1.5" />
              {t('serverDetail.backupCreate')}
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {backups.map((b) => {
            const busy = actionId === b.id || downloadingId === b.id;
            const displayName = b.label ?? fmtDate(b.createdAt);
            return (
              <div key={b.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-bg-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{displayName}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono text-xs text-ink-2">{fmtDate(b.createdAt)}</span>
                    <span className="font-mono text-xs text-ink-3">·</span>
                    <span className="font-mono text-xs text-ink-3">
                      {relativeTime(b.createdAt)}
                    </span>
                    <span className="font-mono text-xs text-ink-3">·</span>
                    <span className="font-mono text-xs text-ink-3">{fmtBytes(b.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" onClick={() => downloadBackup(b)} disabled={busy}>
                    <Download width={12} height={12} className="mr-1.5" />
                    {downloadingId === b.id && downloadPct != null
                      ? t('serverDetail.backupDownloading', { pct: downloadPct })
                      : t('serverDetail.backupDownload')}
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setConfirmRestore(b)}
                        disabled={busy}
                      >
                        <Undo width={12} height={12} className="mr-1.5" />
                        {actionId === b.id && restoreBackupMutation.isPending
                          ? t('serverDetail.backupRestoring')
                          : t('serverDetail.backupRestore')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmDelete(b)}
                        disabled={busy}
                      >
                        <Trash width={12} height={12} className="mr-1.5" />
                        {t('common.delete')}
                      </Button>
                    </>
                  )}
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
