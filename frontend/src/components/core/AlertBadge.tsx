import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { WarningDiamond } from 'pixelarticons/react';
import { Button } from './Button';

export interface AlertBadgeIssue {
  key: string;
  text: string;
  sinceLabel: string;
}

interface AlertBadgeProps {
  color: string;
  badgeTitle: string;
  panelTitle: string;
  issues: AlertBadgeIssue[];
}

// A small warning badge that, on click, opens a modal listing what's behind
// it — the persistent counterpart to a one-shot toast (sustained high
// resource usage, an unexpected exit, a failed start, …). Every currently-
// active issue gets its own row with its own timestamp rather than being
// collapsed into one summary line, since a server can have more than one
// distinct problem at once (e.g. it crashed, then a restart attempt also
// failed). Same fixed-inset-0/backdrop/portal structure as ConfirmModal and
// HowToConnectModal — portaled into document.body rather than rendered
// in place, since the button normally sits inside the monitoring table's
// sticky first column, which (being `position: sticky`) establishes its own
// stacking context; anything positioned relative to the viewport but still a
// DOM descendant of that column stays capped at the column's z-index no
// matter what z-index it's given itself, so escaping via a portal is the
// actual fix, not a bigger z-index.
export function AlertBadge({ color, badgeTitle, panelTitle, issues }: AlertBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={badgeTitle}
        aria-label={badgeTitle}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border cursor-pointer shrink-0"
        style={{ color, background: 'var(--bg-1)', borderColor: color }}
      >
        <WarningDiamond width={10} height={10} />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center px-4"
            style={{ background: 'color-mix(in oklab, #000 70%, transparent)' }}
            onClick={() => setOpen(false)}
          >
            <div
              className="min-w-100 max-w-[50%] bg-bg-1 border border-line"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
                <WarningDiamond width={16} height={16} className="shrink-0" style={{ color }} />
                <h2 className="m-0 text-[15px] font-bold">{panelTitle}</h2>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {issues.map((issue) => (
                  <div key={issue.key} className="flex items-start gap-4 px-6 py-3">
                    <span className="flex-1 min-w-0 text-sm text-ink-2">{issue.text}</span>
                    <span className="font-mono text-xs text-ink-3 shrink-0 whitespace-nowrap">
                      {issue.sinceLabel}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end px-6 py-4 border-t border-line">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  {t('common.close')}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
