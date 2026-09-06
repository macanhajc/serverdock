import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Check, Close, Pencil, Play, Plus, Save, Trash, X } from 'pixelarticons/react';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { Toggle } from '../../../../components/core/Toggle';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import type { ScheduleEntry, ScheduleFormState } from '../../../../types';
import { ScheduleForm } from './ScheduleForm';
import { ACTION_STYLE, previewCron, relativeFuture, relativeTime } from './cronUtils';
import { useSchedules } from '../hooks/useSchedules';
import { useCreateSchedule } from '../hooks/useCreateSchedule';
import { useUpdateSchedule } from '../hooks/useUpdateSchedule';
import { useRunScheduleNow } from '../hooks/useRunScheduleNow';
import { useDeleteSchedule } from '../hooks/useDeleteSchedule';

const EMPTY_FORM: ScheduleFormState = {
  label: '',
  action: 'restart',
  cron: '',
  command: '',
  timezone: '',
};

interface ScheduleTabProps {
  id: string;
  token: string | null;
}

export function ScheduleTab({ id, token }: ScheduleTabProps) {
  const { t, i18n } = useTranslation();
  const { addToast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('schedules:manage');
  const canUseCommand = hasPermission('console:write');

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ScheduleFormState>({ ...EMPTY_FORM });
  const [addError, setAddError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ScheduleFormState>({ ...EMPTY_FORM });
  const [editError, setEditError] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduleEntry | null>(null);

  const schedulesQuery = useSchedules(id, token);
  const schedules = schedulesQuery.data ?? [];
  const schedulesLoading = schedulesQuery.isLoading;

  const createSchedule = useCreateSchedule(id, token);
  // Separate instances so a toggle elsewhere in the list never disables the
  // open edit form's Save button (or vice versa) via a shared isPending.
  const updateScheduleForEdit = useUpdateSchedule(id, token);
  const updateScheduleForToggle = useUpdateSchedule(id, token);
  const runScheduleNow = useRunScheduleNow(id, token);
  const deleteScheduleMutation = useDeleteSchedule(id, token);

  function handleCreate() {
    const { label, action, cron, command, timezone } = addForm;
    if (!label.trim() || !cron.trim()) {
      setAddError(t('serverDetail.scheduleRequired'));
      return;
    }
    if (action === 'command' && !command.trim()) {
      setAddError(t('serverDetail.scheduleCommandRequired'));
      return;
    }
    setAddError('');
    createSchedule.mutate(
      {
        label: label.trim(),
        action,
        cron: cron.trim(),
        ...(action === 'command' ? { command: command.trim() } : {}),
        ...(timezone.trim() ? { timezone: timezone.trim() } : {}),
        enabled: true,
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setAddForm({ ...EMPTY_FORM });
          addToast(t('serverDetail.scheduleCreated'));
        },
        onError: (err) =>
          setAddError(
            err instanceof Error && err.message
              ? err.message
              : t('serverDetail.scheduleCreateFailed')
          ),
      }
    );
  }

  function handleSaveEdit() {
    if (!editId) return;
    const { label, action, cron, command, timezone } = editForm;
    if (!label.trim() || !cron.trim()) {
      setEditError(t('serverDetail.scheduleRequired'));
      return;
    }
    if (action === 'command' && !command.trim()) {
      setEditError(t('serverDetail.scheduleCommandRequired'));
      return;
    }
    setEditError('');
    updateScheduleForEdit.mutate(
      {
        scheduleId: editId,
        payload: {
          label: label.trim(),
          action,
          cron: cron.trim(),
          command: action === 'command' ? command.trim() : '',
          timezone: timezone.trim(),
        },
      },
      {
        onSuccess: () => {
          setEditId(null);
          addToast(t('serverDetail.scheduleUpdated'));
        },
        onError: (err) =>
          setEditError(
            err instanceof Error && err.message
              ? err.message
              : t('serverDetail.scheduleUpdateFailed')
          ),
      }
    );
  }

  function runNow(scheduleId: string) {
    setRunningId(scheduleId);
    runScheduleNow.mutate(scheduleId, {
      onSuccess: () => addToast(t('serverDetail.scheduleRanNow')),
      onError: (err) =>
        addToast(
          err instanceof Error && err.message ? err.message : t('serverDetail.scheduleRunFailed'),
          'error'
        ),
      onSettled: () => setRunningId(null),
    });
  }

  function toggleScheduleEnabled(schedule: ScheduleEntry) {
    updateScheduleForToggle.mutate(
      { scheduleId: schedule.id, payload: { enabled: !schedule.enabled } },
      {
        onSuccess: () => addToast(t('serverDetail.scheduleUpdated')),
        onError: (err) =>
          addToast(
            err instanceof Error && err.message
              ? err.message
              : t('serverDetail.scheduleUpdateFailed'),
            'error'
          ),
      }
    );
  }

  function handleDelete(scheduleId: string) {
    deleteScheduleMutation.mutate(scheduleId, {
      onSuccess: () => addToast(t('serverDetail.scheduleDeleted')),
      onError: (err) =>
        addToast(
          err instanceof Error && err.message
            ? err.message
            : t('serverDetail.scheduleDeleteFailed'),
          'error'
        ),
    });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-3 h-14 border-b border-line bg-bg-1 flex-none">
        <span className="font-mono text-xs text-ink-3">
          {t('serverDetail.scheduleCount', { count: schedules.length })}
        </span>
        <div className="ml-auto">
          {!showAddForm && canManage && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setShowAddForm(true);
                setEditId(null);
              }}
            >
              <Plus width={12} height={12} className="mr-1.5" />
              {t('serverDetail.scheduleAdd')}
            </Button>
          )}
        </div>
      </div>

      {schedulesLoading ? (
        <div className="px-6 py-8 font-mono text-xs text-ink-3">{t('common.loading')}</div>
      ) : schedules.length === 0 && !showAddForm ? (
        <div className="px-6 py-12 flex flex-col items-center gap-4">
          <Calendar width={24} height={24} className="text-ink-3" />
          <p className="font-mono text-sm text-ink-3 text-center">
            {t('serverDetail.scheduleEmpty')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {schedules.map((s) => {
            const style = ACTION_STYLE[s.action] ?? ACTION_STYLE.restart;

            if (editId === s.id) {
              return (
                <div key={s.id} className="px-6 py-5 bg-bg-2 flex flex-col gap-4">
                  <ScheduleForm
                    form={editForm}
                    setForm={setEditForm}
                    onCronPick={(expr) => setEditForm((f) => ({ ...f, cron: expr }))}
                    canUseCommand={canUseCommand}
                  />
                  {editError && <div className="font-mono text-xs text-red">{editError}</div>}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateScheduleForEdit.isPending}
                      onClick={handleSaveEdit}
                    >
                      <Save width={12} height={12} className="mr-1.5" />
                      {updateScheduleForEdit.isPending
                        ? t('serverDetail.saving')
                        : t('common.save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(null);
                        setEditError('');
                      }}
                    >
                      <Close width={12} height={12} className="mr-1.5" />
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-bg-2">
                <Toggle
                  checked={s.enabled}
                  disabled={!canManage}
                  onChange={() => toggleScheduleEnabled(s)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm text-ink">{s.label}</span>
                    <span
                      className="font-mono text-[11px] px-1.5 py-0.5 leading-none"
                      style={{ color: style.color, background: style.bg }}
                    >
                      {s.action.toUpperCase()}
                    </span>
                    {s.action === 'command' && s.command && (
                      <span className="font-mono text-[11px] text-ink-3 truncate max-w-45">
                        {s.command}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono text-xs text-ink-2">{s.cron}</span>
                    <span className="font-mono text-xs text-ink-3">·</span>
                    <span className="font-mono text-xs text-ink-3">
                      {previewCron(s.cron, t, i18n.language)}
                    </span>
                    {s.timezone && (
                      <>
                        <span className="font-mono text-xs text-ink-3">·</span>
                        <span className="font-mono text-xs text-ink-3">{s.timezone}</span>
                      </>
                    )}
                    {s.enabled && s.nextRun && (
                      <>
                        <span className="font-mono text-xs text-ink-3">·</span>
                        <span className="font-mono text-xs text-accent">
                          {t('serverDetail.scheduleNextIn', { time: relativeFuture(s.nextRun) })}
                        </span>
                      </>
                    )}
                    {s.lastRun && (
                      <>
                        <span className="font-mono text-xs text-ink-3">·</span>
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs ${s.lastRun.ok ? 'text-green' : 'text-red'}`}
                        >
                          {relativeTime(s.lastRun.at)}
                          {s.lastRun.ok ? (
                            <Check width={11} height={11} />
                          ) : (
                            <X width={11} height={11} />
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="primary"
                      onClick={() => runNow(s.id)}
                      disabled={runningId === s.id}
                    >
                      {runningId === s.id ? (
                        '…'
                      ) : (
                        <>
                          <Play width={12} height={12} className="mr-1.5" />
                          {t('serverDetail.scheduleRunNow')}
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditId(s.id);
                        setEditForm({
                          label: s.label,
                          action: s.action,
                          cron: s.cron,
                          command: s.command ?? '',
                          timezone: s.timezone ?? '',
                        });
                        setEditError('');
                        setShowAddForm(false);
                      }}
                    >
                      <Pencil width={12} height={12} className="mr-1.5" />
                      {t('common.edit')}
                    </Button>
                    <Button onClick={() => setConfirmDelete(s)}>
                      <Trash width={12} height={12} className="mr-1.5" />
                      {t('common.delete')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <div className="px-6 py-5 border-t border-line bg-bg-1 flex flex-col gap-4">
          <ScheduleForm
            form={addForm}
            setForm={setAddForm}
            onCronPick={(expr) => setAddForm((f) => ({ ...f, cron: expr }))}
            canUseCommand={canUseCommand}
          />
          {addError && <div className="font-mono text-xs text-red">{addError}</div>}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={createSchedule.isPending}
              onClick={handleCreate}
            >
              <Save width={12} height={12} className="mr-1.5" />
              {createSchedule.isPending ? t('serverDetail.saving') : t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setAddForm({ ...EMPTY_FORM });
                setAddError('');
              }}
            >
              <Close width={12} height={12} className="mr-1.5" />
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={t('serverDetail.scheduleDeleteTitle')}
          message={t('serverDetail.scheduleDeleteMessage', { label: confirmDelete.label })}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            handleDelete(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
