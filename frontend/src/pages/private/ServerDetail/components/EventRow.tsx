import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningDiamond } from 'pixelarticons/react';
import { timeAgo, formatDate } from '../../../../utils/format';
import type { ServerEventEntry } from '../../../../types';
import {
  getResourceIssues,
  getCrashSummary,
  getActionFailureSummary,
} from '../../../../utils/serverStatus';

function summarizeEvent(
  entry: ServerEventEntry,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (entry.type === 'crash') {
    return getCrashSummary({ ...entry.data, at: entry.createdAt }, t);
  }
  if (entry.type === 'action_failed') {
    return getActionFailureSummary({ ...entry.data, at: entry.createdAt }, t);
  }
  return getResourceIssues({ ...entry.data, since: entry.createdAt })
    .map((issue) =>
      t(issue.kind === 'cpu' ? 'resourceAlert.cpuIssue' : 'resourceAlert.memoryIssue', {
        pct: issue.pct.toFixed(0),
      })
    )
    .join(' · ');
}

// A single history row — its own component (rather than inline in a .map())
// so the stack-trace toggle can hold its own expand/collapse state per row.
export function EventRow({ entry }: { entry: ServerEventEntry }) {
  const { t } = useTranslation();
  const [showStack, setShowStack] = useState(false);
  const color = entry.type === 'resource_high' ? 'var(--yellow)' : 'var(--red)';
  const stack = entry.type === 'action_failed' ? entry.data.stack : null;

  return (
    <div className="flex flex-col border mt-1" style={{ borderColor:  `color-mix(in oklab, ${color} 50%, transparent)`, background: `color-mix(in oklab, ${color} 5%, transparent)`  }}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <WarningDiamond width={12} height={12} style={{ color }} className="shrink-0" />
        <span className="flex-1 min-w-0 font-mono text-xs text-ink truncate" style={{ color }}>
          {summarizeEvent(entry, t)}
        </span>
        {!entry.resolvedAt && (
          <span
            className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 shrink-0"
            style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
          >
            {t('serverDetail.eventOngoing')}
          </span>
        )}
        {stack && (
          <button
            type="button"
            onClick={() => setShowStack((v) => !v)}
            className="font-mono text-[10px] text-ink-3 hover:text-ink px-1.5 py-0.5 border border-line bg-bg-2 cursor-pointer shrink-0"
          >
            {showStack ? t('serverDetail.eventHideStack') : t('serverDetail.eventShowStack')}
          </button>
        )}
        <span
          className="font-mono text-[11px] w-20 text-ink-3 shrink-0"
          title={formatDate(entry.createdAt)}
        >
          {timeAgo(entry.createdAt, t)}
        </span>
      </div>
      {stack && showStack && (
        <pre className="mx-4 mb-3 p-3 bg-bg-2 border border-line font-mono text-[10px] text-ink-2 overflow-x-auto whitespace-pre-wrap break-words">
          {stack}
        </pre>
      )}
    </div>
  );
}
