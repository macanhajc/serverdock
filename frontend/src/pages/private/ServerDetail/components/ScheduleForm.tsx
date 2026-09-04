import { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import type { ScheduleFormState } from '../../../../types';
import { previewCron, CRON_FIELDS, CRON_EXAMPLES } from './cronUtils';

interface ScheduleFormProps {
  form: ScheduleFormState;
  setForm: Dispatch<SetStateAction<ScheduleFormState>>;
  onCronPick: (expr: string) => void;
  // A 'command' schedule runs arbitrary console input — the backend also
  // requires console:write for it, so it's hidden here rather than letting
  // someone pick it and hit a confusing 403 on save.
  canUseCommand: boolean;
}

export function ScheduleForm({ form, setForm, onCronPick, canUseCommand }: ScheduleFormProps) {
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
