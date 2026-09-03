import { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Send as SendIcon,
  Trash,
} from 'pixelarticons/react';
import socket from '../../../../socket';
import { Button } from '../../../../components/core/Button';
import { Toggle } from '../../../../components/core/Toggle';
import { LogLine as LogLineComp } from '../../../../components/data/LogLine';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import type { Server, LogLine, RconEntry } from '../../../../types';

function nowTs(): string {
  return new Date().toTimeString().slice(0, 8);
}

// Splits `text` around case-insensitive matches of `query`, wrapping each in
// <mark>. Virtuoso only ever has the visible rows mounted, so this only runs
// against whatever's currently rendered — matches off-screen are found via
// matchIndices/scrollToIndex instead, since the browser's own Ctrl+F can't
// see rows that aren't in the DOM.
function highlightMatches(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(q, i);
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={idx} className="bg-yellow text-black">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    i = idx + query.length;
    idx = lower.indexOf(q, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

interface ConsoleTabProps {
  id: string;
  token: string | null;
  isRunning: boolean;
  /** console:write permission — gates sending input, not viewing output */
  canWrite: boolean;
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
  canWrite,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [matchCursor, setMatchCursor] = useState(0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // RCON view — request/response pairs, separate from stdout
  const [rconHistory, setRconHistory] = useState<RconEntry[]>([]);
  const [rconInput, setRconInput] = useState('');
  const [rconSending, setRconSending] = useState(false);
  const [rconCmdHistory, setRconCmdHistory] = useState<string[]>([]);
  const [rconHistoryIdx, setRconHistoryIdx] = useState(-1);
  const rconTermRef = useRef<HTMLDivElement>(null);
  const rconSeqRef = useRef<number>(0);

  // Quick action — broadcast template configured per-game (rcon.commands.broadcast)
  const [broadcastInput, setBroadcastInput] = useState('');

  const filteredLines =
    levelFilter === 'ALL'
      ? lines
      : lines.filter((l) => l.level === levelFilter || l.level === 'DEBUG' || l.level === 'CMD');

  const trimmedQuery = searchQuery.trim();
  const matchIndices = useMemo(() => {
    if (!trimmedQuery) return [];
    const q = trimmedQuery.toLowerCase();
    const idxs: number[] = [];
    filteredLines.forEach((l, i) => {
      if (l.line.toLowerCase().includes(q)) idxs.push(i);
    });
    return idxs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLines.length, lines, trimmedQuery]);

  // Jump to the first match when the query itself changes — but not on every
  // recount caused by a new line arriving, which would yank the view away
  // from wherever the admin is currently looking.
  useEffect(() => {
    setMatchCursor(0);
    if (matchIndices.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: matchIndices[0], align: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  function goToMatch(delta: number) {
    if (matchIndices.length === 0) return;
    const next = (matchCursor + delta + matchIndices.length) % matchIndices.length;
    setMatchCursor(next);
    virtuosoRef.current?.scrollToIndex({ index: matchIndices[next], align: 'center' });
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToMatch(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  }

  // Virtuoso's followOutput handles auto-scroll while streaming, but a
  // display:none tab renders at zero height, so scrollTop changes made while
  // hidden are lost — re-apply once the tab becomes visible again.
  useEffect(() => {
    if (visible && autoscroll && consoleMode === 'terminal' && filteredLines.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: filteredLines.length - 1, align: 'end' });
    }
    // Only the "just became visible" transition needs this — ongoing
    // streaming auto-scroll is handled by followOutput.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible && consoleMode === 'rcon' && rconTermRef.current) {
      rconTermRef.current.scrollTop = rconTermRef.current.scrollHeight;
    }
  }, [rconHistory, visible, consoleMode]);

  function sendConsoleCommand() {
    const cmd = consoleInput.trim();
    if (!cmd || !isRunning || !canWrite) return;
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

  async function sendRconCommand(cmd: string) {
    const seq = ++rconSeqRef.current;
    setRconHistory((prev) => [
      ...prev,
      { seq, ts: nowTs(), command: cmd, response: null, error: null },
    ]);
    setRconCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setRconHistoryIdx(-1);
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

  function sendRcon() {
    const cmd = rconInput.trim();
    if (!cmd || rconSending || !isRunning || !canWrite) return;
    setRconInput('');
    sendRconCommand(cmd);
  }

  function sendBroadcast() {
    const text = broadcastInput.trim();
    if (!text || rconSending || !isRunning || !canWrite || !rcon?.commands?.broadcast) return;
    setBroadcastInput('');
    sendRconCommand(rcon.commands.broadcast.replace('{message}', text));
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

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t('serverDetail.searchPlaceholder')}
                spellCheck={false}
                className="bg-bg-2 border border-line text-ink placeholder:text-ink-3 font-mono text-xs px-2 py-1 outline-none focus:border-[var(--focus-border)] w-40"
              />
              {trimmedQuery && (
                <>
                  <span className="font-mono text-[11px] text-ink-3 whitespace-nowrap">
                    {matchIndices.length > 0
                      ? t('serverDetail.searchMatchCount', {
                          current: matchCursor + 1,
                          total: matchIndices.length,
                        })
                      : t('serverDetail.searchNoMatches')}
                  </span>
                  <button
                    onClick={() => goToMatch(-1)}
                    disabled={matchIndices.length === 0}
                    title={t('serverDetail.searchPrev')}
                    className="font-mono text-xs text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-1 border border-line bg-bg-2 cursor-pointer"
                  >
                    <ChevronUp width={11} height={11} />
                  </button>
                  <button
                    onClick={() => goToMatch(1)}
                    disabled={matchIndices.length === 0}
                    title={t('serverDetail.searchNext')}
                    className="font-mono text-xs text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-1 border border-line bg-bg-2 cursor-pointer"
                  >
                    <ChevronDown width={11} height={11} />
                  </button>
                </>
              )}
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
                {copied ? (
                  <Check width={12} height={12} className="mr-1.5" />
                ) : (
                  <Copy width={12} height={12} className="mr-1.5" />
                )}
                {copied ? t('serverDetail.copied') : t('serverDetail.copyLogs')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLines([])}>
                <Trash width={12} height={12} className="mr-1.5" />
                {t('serverDetail.clear')}
              </Button>
            </div>
          </>
        )}

        {consoleMode === 'rcon' && (
          <>
            <span className="font-mono text-[11px] text-ink-3">{t('serverDetail.rconHint')}</span>

            {rcon?.commands?.broadcast && (
              <div className="border-l border-line pl-4 ml-auto flex items-center gap-2">
                <input
                  type="text"
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendBroadcast()}
                  disabled={!isRunning || !canWrite || rconSending}
                  placeholder={t('serverDetail.broadcastPlaceholder')}
                  spellCheck={false}
                  className="bg-bg-2 h-[34px] border border-line text-ink placeholder:text-ink-3 font-mono text-xs px-2 py-1 outline-none focus:border-[var(--focus-border)] w-56 disabled:opacity-40"
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!isRunning || !canWrite || rconSending || !broadcastInput.trim()}
                  onClick={sendBroadcast}
                >
                  {t('serverDetail.broadcastAction')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {consoleMode === 'terminal' && (
        <>
          {filteredLines.length === 0 ? (
            <div className="flex-1 bg-bg-terminal p-[14px_20px]">
              <span className="font-mono text-xs text-ink-3">{t('serverDetail.waitingLogs')}</span>
            </div>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              className="flex-1 bg-bg-terminal"
              style={{ padding: '14px 20px' }}
              data={filteredLines}
              followOutput={autoscroll}
              initialTopMostItemIndex={filteredLines.length - 1}
              computeItemKey={(index) => index}
              itemContent={(_index, l) => (
                <LogLineComp ts={l.ts} level={l.level}>
                  {trimmedQuery ? highlightMatches(l.line, trimmedQuery) : l.line}
                </LogLineComp>
              )}
            />
          )}
          <div className="flex items-center gap-0 border-t border-line bg-bg-1 flex-none">
            <span className="font-mono text-sm text-ink-3 px-4 shrink-0 select-none">›</span>
            <input
              type="text"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              onKeyDown={onConsoleKeyDown}
              disabled={!isRunning || !canWrite}
              placeholder={
                !canWrite
                  ? t('serverDetail.consoleNoPermission')
                  : isRunning
                    ? t('serverDetail.consolePlaceholder')
                    : t('serverDetail.consoleNotRunning')
              }
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-[12.5px] text-ink placeholder:text-ink-3 outline-none py-3 pr-3 min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendConsoleCommand}
              disabled={!isRunning || !canWrite || !consoleInput.trim()}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed px-4 py-3 border-l border-line cursor-pointer shrink-0"
            >
              <SendIcon width={12} height={12} />
              Send
            </button>
          </div>
        </>
      )}

      {consoleMode === 'rcon' && (
        <>
          <div ref={rconTermRef} className="flex-1 overflow-y-auto bg-bg-terminal p-[14px_20px]">
            {!isRunning && (
              <span className="font-mono text-xs text-ink-3">
                {t('serverDetail.consoleNotRunning')}
              </span>
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
              disabled={!isRunning || !canWrite || rconSending}
              placeholder={
                !canWrite
                  ? t('serverDetail.consoleNoPermission')
                  : isRunning
                    ? t('serverDetail.rconPlaceholder')
                    : t('serverDetail.consoleNotRunning')
              }
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-[12.5px] text-ink placeholder:text-ink-3 outline-none py-3 pr-3 min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendRcon}
              disabled={!isRunning || !canWrite || !rconInput.trim() || rconSending}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed px-4 py-3 border-l border-line cursor-pointer shrink-0"
            >
              {rconSending ? '…' : <SendIcon width={12} height={12} />}
              {rconSending ? '' : 'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
