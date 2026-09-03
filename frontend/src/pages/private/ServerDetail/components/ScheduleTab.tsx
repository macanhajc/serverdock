import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { Toggle } from '../../../../components/core/Toggle';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import type { ScheduleEntry, ScheduleFormState } from '../../../../types';

// ─── Cron helpers ─────────────────────────────────────────────────────────────

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function dayName(dow: number, lang: string): string {
  const d = new Date(Date.UTC(2023, 0, 1 + dow)); // 2023-01-01 was a Sunday
  return new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(d);
}

function previewCron(expr: string, t: TFunc, lang: string): string {
  const parts = (expr ?? '').trim().split(/\s+/);
  if (parts.length !== 5) return t('serverDetail.cronCustom');
  const [min, hour, dom, month, dow] = parts;
  if (/^\*\/\d+$/.test(min) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    const n = parseInt(min.slice(2), 10);
    if (n > 0) return t('serverDetail.cronEveryNMinutes', { count: n });
  }
  if (min === '0' && /^\*\/\d+$/.test(hour) && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour.slice(2), 10);
    if (h > 0) return t('serverDetail.cronEveryNHours', { count: h });
  }
  if (min === '0' && /^\d{1,2}$/.test(hour) && dom === '*' && month === '*' && /^\d$/.test(dow)) {
    const h = parseInt(hour, 10);
    const d = parseInt(dow, 10);
    if (h >= 0 && h <= 23 && d >= 0 && d <= 6)
      return t('serverDetail.cronWeeklyAt', {
        day: dayName(d, lang),
        time: `${String(h).padStart(2, '0')}:00`,
      });
  }
  if (min === '0' && /^\d{1,2}$/.test(hour) && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour, 10);
    if (h >= 0 && h <= 23)
      return t('serverDetail.cronDailyAt', { time: `${String(h).padStart(2, '0')}:00` });
  }
  return t('serverDetail.cronCustom');
}

const ACTION_STYLE: Record<string, { color: string; bg: string }> = {
  start: { color: 'var(--green)', bg: 'color-mix(in oklab, var(--green)  12%, transparent)' },
  stop: { color: 'var(--red)', bg: 'color-mix(in oklab, var(--red)    12%, transparent)' },
  restart: { color: 'var(--yellow)', bg: 'color-mix(in oklab, var(--yellow) 12%, transparent)' },
  command: { color: 'var(--accent)', bg: 'color-mix(in oklab, var(--accent) 12%, transparent)' },
  backup: { color: 'var(--ink-2)', bg: 'color-mix(in oklab, var(--ink-2)  12%, transparent)' },
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function relativeFuture(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '<1m';
  const m = Math.ceil(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

// ─── ScheduleForm ─────────────────────────────────────────────────────────────

const CRON_FIELDS = [
  { key: 'cronFieldMinute', range: '0–59' },
  { key: 'cronFieldHour', range: '0–23' },
  { key: 'cronFieldDay', range: '1–31' },
  { key: 'cronFieldMonth', range: '1–12' },
  { key: 'cronFieldWeekday', range: '0–6' },
];

const CRON_EXAMPLES = ['0 4 * * *', '0 */6 * * *', '0 3 * * 0', '*/30 * * * *'];

interface ScheduleFormProps {
  form: ScheduleFormState;
  setForm: React.Dispatch<React.SetStateAction<ScheduleFormState>>;
  onCronPick: (expr: string) => void;
  // A 'command' schedule runs arbitrary console input — the backend also
  // requires console:write for it, so it's hidden here rather than letting
  // someone pick it and hit a confusing 403 on save.
  canUseCommand: boolean;
}

function ScheduleForm({ form, setForm, onCronPick, canUseCommand }: ScheduleFormProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-ink-3">
          {t('serverDetail.scheduleLabelField')}
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder={t('serverDetail.scheduleLabelPlaceholder')}
          className="bg-bg-2 border border-line-2 font-mono text-sm text-ink px-3 py-2 outline-none focus:border-accent"
          style={{ borderRadius: 0 }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-ink-3">
          {t('serverDetail.scheduleActionField')}
        </label>
        <SegmentedControl
          options={[
            { label: 'Start', value: 'start' },
            { label: 'Stop', value: 'stop' },
            { label: 'Restart', value: 'restart' },
            ...(canUseCommand ? [{ label: 'Command', value: 'command' }] : []),
            { label: 'Backup', value: 'backup' },
          ]}
          value={form.action}
          onChange={(v) => setForm((f) => ({ ...f, action: v as ScheduleFormState['action'] }))}
        />
      </div>

      {form.action === 'command' && (
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-xs text-ink-3">
            {t('serverDetail.scheduleCommandField')}
          </label>
          <input
            type="text"
            value={form.command}
            onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
            placeholder={t('serverDetail.scheduleCommandPlaceholder')}
            className="bg-bg-2 border border-line-2 font-mono text-sm text-ink px-3 py-2 outline-none focus:border-accent"
            style={{ borderRadius: 0 }}
          />
          <span className="font-mono text-[11px] text-ink-3">
            {t('serverDetail.scheduleCommandHint')}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-ink-3">
          {t('serverDetail.scheduleCronField')}
        </label>
        <input
          type="text"
          value={form.cron}
          onChange={(e) => setForm((f) => ({ ...f, cron: e.target.value }))}
          placeholder={t('serverDetail.scheduleCronPlaceholder')}
          className="bg-bg-2 border border-line-2 font-mono text-sm text-ink px-3 py-2 outline-none focus:border-accent"
          style={{ borderRadius: 0 }}
        />
        {form.cron.trim() && (
          <span className="font-mono text-xs text-ink-3">
            {previewCron(form.cron, t, i18n.language)}
          </span>
        )}
        <div className="mt-1 border border-line bg-bg-2 px-3 py-3 flex flex-col gap-3">
          <div className="flex gap-0 font-mono text-[11px] text-center">
            {CRON_FIELDS.map((f, i, arr) => (
              <div key={f.key} className="flex items-center">
                <div
                  className="flex flex-col items-center px-3 py-1 gap-0.5"
                  style={{ background: 'color-mix(in oklab, var(--accent) 8%, transparent)' }}
                >
                  <span className="text-accent font-semibold">{t(`serverDetail.${f.key}`)}</span>
                  <span className="text-ink-3">{f.range}</span>
                </div>
                {i < arr.length - 1 && <span className="text-ink-3 px-1">·</span>}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {CRON_EXAMPLES.map((expr) => (
              <button
                key={expr}
                type="button"
                onClick={() => onCronPick(expr)}
                className="flex items-center gap-3 px-2 py-1 text-left hover:bg-bg-1 cursor-pointer border-0 bg-transparent w-full"
              >
                <code className="font-mono text-xs text-accent w-28 shrink-0">{expr}</code>
                <span className="font-mono text-xs text-ink-3">
                  {previewCron(expr, t, i18n.language)}
                </span>
              </button>
            ))}
          </div>
          <p className="m-0 font-mono text-[10px] text-ink-3">{t('serverDetail.cronHelpText')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-xs text-ink-3">
          {t('serverDetail.scheduleTimezoneField')}
        </label>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          placeholder={t('serverDetail.scheduleTimezonePlaceholder')}
          className="bg-bg-2 border border-line-2 font-mono text-sm text-ink px-3 py-2 outline-none focus:border-accent"
          style={{ borderRadius: 0 }}
        />
        <span className="font-mono text-[11px] text-ink-3">
          {t('serverDetail.scheduleTimezoneHint')}
        </span>
      </div>
    </>
  );
}

// ─── ScheduleTab ──────────────────────────────────────────────────────────────

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

  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ScheduleFormState>({ ...EMPTY_FORM });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ScheduleFormState>({ ...EMPTY_FORM });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduleEntry | null>(null);

  useEffect(() => {
    setSchedulesLoading(true);
    fetch(`/api/schedules/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ScheduleEntry[]) => setSchedules(data))
      .catch(() => setSchedules([]))
      .finally(() => setSchedulesLoading(false));
  }, [id, token]);

  async function createSchedule() {
    const { label, action, cron, command, timezone } = addForm;
    if (!label.trim() || !cron.trim()) {
      setAddError(t('serverDetail.scheduleRequired'));
      return;
    }
    if (action === 'command' && !command.trim()) {
      setAddError(t('serverDetail.scheduleCommandRequired'));
      return;
    }
    setAddSaving(true);
    setAddError('');
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          action,
          cron: cron.trim(),
          ...(action === 'command' ? { command: command.trim() } : {}),
          ...(timezone.trim() ? { timezone: timezone.trim() } : {}),
          enabled: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(data.error ?? t('serverDetail.scheduleCreateFailed'));
        return;
      }
      setSchedules((prev) => [...prev, data]);
      setShowAddForm(false);
      setAddForm({ ...EMPTY_FORM });
      addToast(t('serverDetail.scheduleCreated'));
    } catch {
      setAddError(t('serverDetail.scheduleNetworkError'));
    } finally {
      setAddSaving(false);
    }
  }

  async function saveEditSchedule() {
    const { label, action, cron, command, timezone } = editForm;
    if (!label.trim() || !cron.trim()) {
      setEditError(t('serverDetail.scheduleRequired'));
      return;
    }
    if (action === 'command' && !command.trim()) {
      setEditError(t('serverDetail.scheduleCommandRequired'));
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/schedules/${id}/${editId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          action,
          cron: cron.trim(),
          command: action === 'command' ? command.trim() : '',
          timezone: timezone.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.error ?? t('serverDetail.scheduleUpdateFailed'));
        return;
      }
      setSchedules((prev) => prev.map((s) => (s.id === editId ? data : s)));
      setEditId(null);
      addToast(t('serverDetail.scheduleUpdated'));
    } catch {
      setEditError(t('serverDetail.scheduleNetworkError'));
    } finally {
      setEditSaving(false);
    }
  }

  async function runNow(scheduleId: string) {
    setRunningId(scheduleId);
    try {
      const res = await fetch(`/api/schedules/${id}/${scheduleId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? data : s)));
        addToast(t('serverDetail.scheduleRanNow'));
      } else {
        addToast(data.error ?? t('serverDetail.scheduleRunFailed'), 'error');
        if (data.schedule) {
          setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? data.schedule : s)));
        }
      }
    } catch {
      addToast(t('serverDetail.scheduleRunFailed'), 'error');
    } finally {
      setRunningId(null);
    }
  }

  async function toggleScheduleEnabled(schedule: ScheduleEntry) {
    try {
      const res = await fetch(`/api/schedules/${id}/${schedule.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? data : s)));
        addToast(t('serverDetail.scheduleUpdated'));
      } else {
        addToast(data.error ?? t('serverDetail.scheduleUpdateFailed'), 'error');
      }
    } catch {
      addToast(t('serverDetail.scheduleUpdateFailed'), 'error');
    }
  }

  async function deleteSchedule(scheduleId: string) {
    try {
      const res = await fetch(`/api/schedules/${id}/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
        addToast(t('serverDetail.scheduleDeleted'));
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('serverDetail.scheduleDeleteFailed'), 'error');
      }
    } catch {
      addToast(t('serverDetail.scheduleDeleteFailed'), 'error');
    }
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
              {t('serverDetail.scheduleAdd')}
            </Button>
          )}
        </div>
      </div>

      {schedulesLoading ? (
        <div className="px-6 py-8 font-mono text-xs text-ink-3">{t('common.loading')}</div>
      ) : schedules.length === 0 && !showAddForm ? (
        <div className="px-6 py-12 flex flex-col items-center gap-4">
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
                      disabled={editSaving}
                      onClick={saveEditSchedule}
                    >
                      {editSaving ? t('serverDetail.saving') : t('common.save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditId(null);
                        setEditError('');
                      }}
                    >
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
                          className={`font-mono text-xs ${s.lastRun.ok ? 'text-green' : 'text-red'}`}
                        >
                          {relativeTime(s.lastRun.at)} {s.lastRun.ok ? '✓' : '✗'}
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
                      {runningId === s.id ? '…' : t('serverDetail.scheduleRunNow')}
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
                      {t('common.edit')}
                    </Button>
                    <Button onClick={() => setConfirmDelete(s)}>{t('common.delete')}</Button>
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
            <Button size="sm" variant="primary" disabled={addSaving} onClick={createSchedule}>
              {addSaving ? t('serverDetail.saving') : t('common.save')}
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
            deleteSchedule(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
