import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import socket from '../../../../socket';
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
}

export function ConsoleTab({ id, token, isRunning, rcon }: ConsoleTabProps) {
  const { t } = useTranslation();

  const [consoleMode, setConsoleMode] = useState<'terminal' | 'rcon'>(
    rcon?.enabled ? 'rcon' : 'terminal'
  );

  const [consoleLines, setConsoleLines] = useState<LogLine[]>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const consoleTermRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);

  const [rconHistory, setRconHistory] = useState<RconEntry[]>([]);
  const [rconInput, setRconInput] = useState('');
  const [rconSending, setRconSending] = useState(false);
  const [rconCmdHistory, setRconCmdHistory] = useState<string[]>([]);
  const [rconHistoryIdx, setRconHistoryIdx] = useState(-1);
  const rconTermRef = useRef<HTMLDivElement>(null);
  const rconInputRef = useRef<HTMLInputElement>(null);
  const rconSeqRef = useRef<number>(0);

  useEffect(() => {
    function onConsoleLine({ id: cid, line, level }: { id: string; line: string; level?: string }) {
      if (cid !== id) return;
      setConsoleLines((prev) => [
        ...prev,
        { ts: nowTs(), level: (level ?? 'info').toUpperCase(), line },
      ]);
    }
    function onConsoleEnd({ id: cid }: { id: string }) {
      if (cid !== id) return;
      setConsoleLines((prev) => [
        ...prev,
        { ts: nowTs(), level: 'DEBUG', line: t('serverDetail.containerStopped') },
      ]);
    }

    socket.on('console:line', onConsoleLine);
    socket.on('console:end', onConsoleEnd);
    socket.emit('join:console', { id });

    return () => {
      socket.off('console:line', onConsoleLine);
      socket.off('console:end', onConsoleEnd);
      socket.emit('leave:console', { id });
    };
  }, [id, t]);

  useEffect(() => {
    if (consoleTermRef.current) {
      consoleTermRef.current.scrollTop = consoleTermRef.current.scrollHeight;
    }
  }, [consoleLines]);

  useEffect(() => {
    if (rconTermRef.current) {
      rconTermRef.current.scrollTop = rconTermRef.current.scrollHeight;
    }
  }, [rconHistory]);

  function sendConsoleCommand() {
    const cmd = consoleInput.trim();
    if (!cmd || !isRunning) return;
    socket.emit('console:input', { id, input: cmd });
    setConsoleLines((prev) => [...prev, { ts: nowTs(), level: 'CMD', line: `> ${cmd}` }]);
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
      {rcon?.enabled && (
        <div className="flex items-center gap-4 px-6 py-2.5 border-b border-line bg-bg-1 flex-none">
          <SegmentedControl
            options={[
              { label: 'Terminal', value: 'terminal' },
              { label: 'RCON', value: 'rcon' },
            ]}
            value={consoleMode}
            onChange={(v) => setConsoleMode(v as 'terminal' | 'rcon')}
          />
          {consoleMode === 'rcon' && (
            <span className="font-mono text-[11px] text-ink-3">{t('serverDetail.rconHint')}</span>
          )}
        </div>
      )}

      {consoleMode === 'terminal' && (
        <>
          <div ref={consoleTermRef} className="flex-1 overflow-y-auto bg-bg-terminal p-[14px_20px]">
            {!isRunning ? (
              <span className="font-mono text-xs text-ink-3">{t('serverDetail.consoleNotRunning')}</span>
            ) : consoleLines.length === 0 ? (
              <span className="font-mono text-xs text-ink-3">{t('serverDetail.consoleWaiting')}</span>
            ) : null}
            {consoleLines.map((l, i) => (
              <LogLineComp key={i} ts={l.ts} level={l.level}>
                {l.line}
              </LogLineComp>
            ))}
          </div>
          <div className="flex items-center gap-0 border-t border-line bg-bg-1 flex-none">
            <span className="font-mono text-sm text-ink-3 px-4 shrink-0 select-none">›</span>
            <input
              ref={consoleInputRef}
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
              ref={rconInputRef}
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
