import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import socket from '../../../../socket';
import { Button } from '../../../../components/core/Button';
import { Toggle } from '../../../../components/core/Toggle';
import { LogLine as LogLineComp } from '../../../../components/data/LogLine';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import type { Server, LogLine, RconEntry } from '../../../../types';

function nowTs(): string {
  return new Date().toTimeString().slice(0, 8);
}

interface ConsoleTabProps {
  id: string;
  token: string | null;
  isRunning: boolean;
  rcon?: Server['rcon'];
  /** The tab stays mounted in the background; true when it's the active tab */
  visible?: boolean;
  /** Live container output, owned by the parent (shared logs pipeline) */
  lines: LogLine[];
  setLines: React.Dispatch<React.SetStateAction<LogLine[]>>;
}

export function ConsoleTab({
  id,
  token,
  isRunning,
  rcon,
  visible = true,
  lines,
  setLines,
}: ConsoleTabProps) {
  const { t } = useTranslation();

  const [consoleMode, setConsoleMode] = useState<'terminal' | 'rcon'>('terminal');

  // Terminal (stdout/stderr) view — shares the parent's log pipeline
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [autoscroll, setAutoscroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [consoleInput, setConsoleInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const termRef = useRef<HTMLDivElement>(null);

  // RCON view — request/response pairs, separate from stdout
  const [rconHistory, setRconHistory] = useState<RconEntry[]>([]);
  const [rconInput, setRconInput] = useState('');
  const [rconSending, setRconSending] = useState(false);
  const [rconCmdHistory, setRconCmdHistory] = useState<string[]>([]);
  const [rconHistoryIdx, setRconHistoryIdx] = useState(-1);
  const rconTermRef = useRef<HTMLDivElement>(null);
  const rconSeqRef = useRef<number>(0);

  const filteredLines =
    levelFilter === 'ALL'
      ? lines
      : lines.filter(
          (l) => l.level === levelFilter || l.level === 'DEBUG' || l.level === 'CMD'
        );

  // `visible` is a dep: scrollHeight is 0 while the tab is display:none, so the
  // scroll must be re-applied when it becomes visible again
  useEffect(() => {
    if (visible && autoscroll && consoleMode === 'terminal' && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines, autoscroll, visible, consoleMode]);

  useEffect(() => {
    if (visible && consoleMode === 'rcon' && rconTermRef.current) {
      rconTermRef.current.scrollTop = rconTermRef.current.scrollHeight;
    }
  }, [rconHistory, visible, consoleMode]);

  function sendConsoleCommand() {
    const cmd = consoleInput.trim();
    if (!cmd || !isRunning) return;
    socket.emit('console:input', { id, input: cmd });
    // Echo into the shared output stream so the command and its log output interleave
    setLines((prev) => [...prev, { ts: nowTs(), level: 'CMD', line: `> ${cmd}` }]);
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setConsoleInput('');
  }

  function onConsoleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendConsoleCommand();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(next);
      if (cmdHistory[next] !== undefined) setConsoleInput(cmdHistory[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setConsoleInput(next === -1 ? '' : (cmdHistory[next] ?? ''));
    }
  }

  function copyLogs() {
    const text = filteredLines.map((l) => `[${l.ts}] [${l.level}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function sendRcon() {
    const cmd = rconInput.trim();
    if (!cmd || rconSending || !isRunning) return;

    const seq = ++rconSeqRef.current;
    setRconHistory((prev) => [
      ...prev,
      { seq, ts: nowTs(), command: cmd, response: null, error: null },
    ]);
    setRconCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setRconHistoryIdx(-1);
    setRconInput('');
    setRconSending(true);

    try {
      const res = await fetch(`/api/servers/${id}/rcon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRconHistory((prev) =>
          prev.map((e) => (e.seq === seq ? { ...e, response: data.response } : e))
        );
      } else {
        setRconHistory((prev) =>
          prev.map((e) => (e.seq === seq ? { ...e, error: data.error ?? 'Command failed' } : e))
        );
      }
    } catch {
      setRconHistory((prev) =>
        prev.map((e) => (e.seq === seq ? { ...e, error: 'Could not reach server' } : e))
      );
    } finally {
      setRconSending(false);
    }
  }

  function onRconKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendRcon();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(rconHistoryIdx + 1, rconCmdHistory.length - 1);
      setRconHistoryIdx(next);
      if (rconCmdHistory[next] !== undefined) setRconInput(rconCmdHistory[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(rconHistoryIdx - 1, -1);
      setRconHistoryIdx(next);
      setRconInput(next === -1 ? '' : (rconCmdHistory[next] ?? ''));
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex items-center gap-3.5 px-6 py-2.5 border-b border-line bg-bg-1 flex-none flex-wrap">
        {rcon?.enabled && (
          <SegmentedControl
            options={[
              { label: 'Terminal', value: 'terminal' },
              { label: 'RCON', value: 'rcon' },
            ]}
            value={consoleMode}
            onChange={(v) => setConsoleMode(v as 'terminal' | 'rcon')}
          />
        )}

        {consoleMode === 'terminal' && (
          <>
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
                {levelFilter === 'ALL'
                  ? t('serverDetail.lines', { count: lines.length })
                  : t('serverDetail.linesFiltered', {
                      shown: filteredLines.length,
                      total: lines.length,
                    })}
              </span>
              <Toggle
                checked={autoscroll}
                onChange={setAutoscroll}
                label={t('serverDetail.autoScroll')}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={copyLogs}
                disabled={filteredLines.length === 0}
              >
                {copied ? t('serverDetail.copied') : t('serverDetail.copyLogs')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLines([])}>
                {t('serverDetail.clear')}
              </Button>
            </div>
          </>
        )}

        {consoleMode === 'rcon' && (
          <span className="font-mono text-[11px] text-ink-3">{t('serverDetail.rconHint')}</span>
        )}
      </div>

      {consoleMode === 'terminal' && (
        <>
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
          <div className="flex items-center gap-0 border-t border-line bg-bg-1 flex-none">
            <span className="font-mono text-sm text-ink-3 px-4 shrink-0 select-none">›</span>
            <input
              type="text"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={onConsoleKeyDown}
              disabled={!isRunning}
              placeholder={
                isRunning ? t('serverDetail.consolePlaceholder') : t('serverDetail.consoleNotRunning')
              }
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-[12.5px] text-ink placeholder:text-ink-3 outline-none py-3 pr-3 min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendConsoleCommand}
              disabled={!isRunning || !consoleInput.trim()}
              className="font-mono text-xs text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed px-4 py-3 border-l border-line cursor-pointer shrink-0"
            >
              Send
            </button>
          </div>
        </>
      )}

      {consoleMode === 'rcon' && (
        <>
          <div ref={rconTermRef} className="flex-1 overflow-y-auto bg-bg-terminal p-[14px_20px]">
            {!isRunning && (
              <span className="font-mono text-xs text-ink-3">{t('serverDetail.consoleNotRunning')}</span>
            )}
            {isRunning && rconHistory.length === 0 && (
              <span className="font-mono text-xs text-ink-3">{t('serverDetail.rconWaiting')}</span>
            )}
            {rconHistory.map((entry) => (
              <div key={entry.seq} className="mb-3">
                <div className="font-mono text-[12.5px] text-accent leading-relaxed">
                  › {entry.command}
                </div>
                {entry.response != null && (
                  <div className="font-mono text-[12.5px] text-ink leading-relaxed pl-4 whitespace-pre-wrap">
                    {entry.response}
                  </div>
                )}
                {entry.error != null && (
                  <div className="font-mono text-[12.5px] text-red leading-relaxed pl-4">
                    {entry.error}
                  </div>
                )}
                {entry.response == null && entry.error == null && (
                  <div className="font-mono text-[12.5px] text-ink-3 leading-relaxed pl-4">…</div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-0 border-t border-line bg-bg-1 flex-none">
            <span className="font-mono text-sm text-ink-3 px-4 shrink-0 select-none">›</span>
            <input
              type="text"
              value={rconInput}
              onChange={(e) => setRconInput(e.target.value)}
              onKeyDown={onRconKeyDown}
              disabled={!isRunning || rconSending}
              placeholder={
                isRunning ? t('serverDetail.rconPlaceholder') : t('serverDetail.consoleNotRunning')
              }
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-[12.5px] text-ink placeholder:text-ink-3 outline-none py-3 pr-3 min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendRcon}
              disabled={!isRunning || !rconInput.trim() || rconSending}
              className="font-mono text-xs text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed px-4 py-3 border-l border-line cursor-pointer shrink-0"
            >
              {rconSending ? '…' : 'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
