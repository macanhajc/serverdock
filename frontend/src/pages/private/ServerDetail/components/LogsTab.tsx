import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/core/Button';
import { Toggle } from '../../../../components/core/Toggle';
import { LogLine as LogLineComp } from '../../../../components/data/LogLine';
import type { LogLine } from '../../../../types';

interface LogsTabProps {
  id: string;
  lines: LogLine[];
  setLines: React.Dispatch<React.SetStateAction<LogLine[]>>;
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  autoscroll: boolean;
  setAutoscroll: (v: boolean) => void;
  termRef: React.RefObject<HTMLDivElement | null>;
}

export function LogsTab({
  id,
  lines,
  setLines,
  levelFilter,
  setLevelFilter,
  autoscroll,
  setAutoscroll,
  termRef,
}: LogsTabProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  function copyLogs() {
    const text = lines.map((l) => `[${l.ts}] [${l.level}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const filteredLines =
    levelFilter === 'ALL' ? lines : lines.filter((l) => l.level === levelFilter || l.level === 'DEBUG');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3.5 px-6 py-3 border-b border-line bg-bg-1 flex-none flex-wrap">
        <span className="font-mono text-sm text-ink-3">
          {t('serverDetail.container')} {id}
        </span>
        <div className="flex gap-1">
          {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`font-mono text-xs tracking-wider px-2 py-1 border cursor-pointer ${
                levelFilter === lvl
                  ? 'border-line-2 text-ink bg-bg-3'
                  : 'border-line text-ink-3 bg-bg-2'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3.5">
          <span className="font-mono text-sm text-ink-3">
            {t('serverDetail.lines', { count: lines.length })}
          </span>
          <Toggle checked={autoscroll} onChange={setAutoscroll} label={t('serverDetail.autoScroll')} />
          <Button size="sm" variant="ghost" onClick={copyLogs} disabled={lines.length === 0}>
            {copied ? t('serverDetail.copied') : t('serverDetail.copyLogs')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLines([])}>
            {t('serverDetail.clear')}
          </Button>
        </div>
      </div>
      <div ref={termRef} className="flex-1 overflow-y-auto bg-bg-terminal p-[14px_20px]">
        {filteredLines.length === 0 && (
          <span className="font-mono text-xs text-ink-3">{t('serverDetail.waitingLogs')}</span>
        )}
        {filteredLines.map((l, i) => (
          <LogLineComp key={i} ts={l.ts} level={l.level}>
            {l.line}
          </LogLineComp>
        ))}
      </div>
    </div>
  );
}
