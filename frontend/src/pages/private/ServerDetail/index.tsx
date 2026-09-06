import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Calendar,
  ChevronLeft,
  CircleInfo,
  Folder,
  Terminal,
  WarningDiamond,
  X,
} from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { Tabs } from '../../../components/navigation/Tabs';
import { Button } from '../../../components/core/Button';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { IN_FLIGHT, getActiveIssues } from '../../../utils/serverStatus';
import { timeAgo } from '../../../utils/format';
import { InfoTab } from './components/InfoTab';
import { ConsoleTab } from './components/ConsoleTab';
import { FilesTab } from './components/FilesTab';
import { ScheduleTab } from './components/ScheduleTab';
import { BackupTab } from './components/BackupTab';
import { ServerDetailSkeleton } from './components/ServerDetailSkeleton';
import { DetailHeader } from './components/DetailHeader';
import { ResourcesPanel } from './components/ResourcesPanel';
import { useServer } from './hooks/useServer';
import { useServerAction } from './hooks/useServerAction';
import { useServerSocketSync } from './hooks/useServerSocketSync';
import { useServerLogs } from './hooks/useServerLogs';
import { useServerStats } from './hooks/useServerStats';

// ─── ServerDetail ─────────────────────────────────────────────────────────────

export default function ServerDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [confirmReset, setConfirmReset] = useState(false);
  const [tab, setTab] = useState('info');
  const [statsOpen, setStatsOpen] = useState(false);

  const serverQuery = useServer(id, token);
  const server = serverQuery.data ?? null;

  const { actionLoading, actionError, clearActionError, callAction, onStatusSettled } =
    useServerAction(id);
  const { pull } = useServerSocketSync(id, onStatusSettled);
  const { lines, setLines } = useServerLogs(id, server?.status, onStatusSettled);
  const { stats, cpuHistory, memHistory } = useServerStats(id, server?.status);

  // ── render ────────────────────────────────────────────────────────────────

  if (serverQuery.isError) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <p className="m-0 font-mono text-sm text-red">{t('serverDetail.loadFailed')}</p>
        <Button size="sm" onClick={() => navigate('/admin')}>
          <ChevronLeft width={12} height={12} className="mr-1.5" />
          {t('serverDetail.back')}
        </Button>
      </div>
    );
  }

  if (!server) {
    return <ServerDetailSkeleton />;
  }

  const { name, status, rcon } = server;
  const isNotCreated = status === 'stopped' || status === 'not_created' || status === 'error';
  const isRunning = status === 'running';
  // Busy if this client has a request in flight, or any client/scheduler does
  const busy = !!actionLoading || IN_FLIGHT.includes(status);

  const activeIssues = getActiveIssues(server, t);
  const issuesColor = activeIssues.some((i) => i.severity === 'red')
    ? 'var(--red)'
    : 'var(--yellow)';

  const badgeLabel =
    status === 'pulling' && pull
      ? `${t(pull.phase === 'extracting' ? 'status.extracting' : 'status.pulling')} ${pull.percent}%`
      : undefined;

  return (
    <div className="flex flex-col h-screen">
      <DetailHeader
        server={server}
        id={id!}
        busy={busy}
        isRunning={isRunning}
        isNotCreated={isNotCreated}
        badgeLabel={badgeLabel}
        onBack={() => navigate('/admin')}
        onStart={() => callAction('start')}
        onStop={() => callAction('stop')}
        onRestart={() => callAction('restart')}
        onResetRequest={() => setConfirmReset(true)}
        onEditConfig={() => navigate(`/admin/servers/${id}/edit`)}
      />

      {/* ── Action error banner ───────────────────────────────────────────── */}
      {actionError && (
        <div
          className="flex items-center gap-2 px-4 py-2.25 border-b border-line font-mono text-[11.5px] text-red flex-none"
          style={{ background: 'color-mix(in oklab, var(--red) 8%, transparent)' }}
        >
          <X width={13} height={13} className="shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button className="text-ink-3 hover:text-ink cursor-pointer" onClick={clearActionError}>
            {t('serverDetail.dismiss')}
          </button>
        </div>
      )}

      {/* ── Issues banner ────────────────────────────────────────────────── */}
      {/* Every currently-active issue gets its own row — a crash and a failed
          restart attempt (say) can both be active at once, and neither one
          is hidden in favor of the other. */}
      {activeIssues.length > 0 && (
        <div
          className="flex flex-col border-b border-line flex-none font-mono text-[11.5px]"
          style={{
            color: issuesColor,
            background: `color-mix(in oklab, ${issuesColor} 8%, transparent)`,
          }}
        >
          {activeIssues.map((issue) => (
            <div key={issue.key} className="flex items-center gap-2 px-4 py-2">
              <WarningDiamond width={13} height={13} className="shrink-0" />
              <span className="flex-1 text-ink">{issue.text}</span>
              <span className="shrink-0">{timeAgo(issue.since, t)}</span>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <ResourcesPanel
          stats={stats}
          cpuHistory={cpuHistory}
          memHistory={memHistory}
          diskUsed={server.diskUsed}
          open={statsOpen}
          onToggle={() => setStatsOpen((v) => !v)}
        />
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <Tabs
        tabs={[
          { label: t('serverDetail.tabInfo'), value: 'info', icon: CircleInfo },
          { label: t('serverDetail.tabConsole'), value: 'console', icon: Terminal },
          { label: t('serverDetail.tabFiles'), value: 'files', icon: Folder },
          { label: t('serverDetail.tabSchedule'), value: 'schedule', icon: Calendar },
          { label: t('serverDetail.tabBackups'), value: 'backups', icon: Archive },
        ]}
        value={tab}
        onChange={setTab}
        className="shrink-0"
      />

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {tab === 'info' && <InfoTab server={server} id={id!} token={token} />}
        {/* Console stays mounted so its filter/command/RCON state survives tab
            switches; the output itself lives in `lines` on the parent */}
        <div className={tab === 'console' ? 'h-full' : 'hidden'}>
          <ConsoleTab
            id={id!}
            token={token}
            isRunning={isRunning}
            canWrite={hasPermission('console:write')}
            rcon={rcon}
            visible={tab === 'console'}
            lines={lines}
            setLines={setLines}
          />
        </div>
        {/* Files are only mutable on a stopped server — `isNotCreated` is the
            stopped/not_created/error set, matching the backend's editable states */}
        {tab === 'files' && (
          <FilesTab
            id={id!}
            token={token}
            editable={isNotCreated}
            canWrite={hasPermission('files:write')}
          />
        )}
        {tab === 'schedule' && <ScheduleTab id={id!} token={token} />}
        {tab === 'backups' && <BackupTab id={id!} token={token} isRunning={isRunning} />}
      </div>

      {confirmReset && (
        <ConfirmModal
          title={t('serverDetail.resetTitle')}
          message={t('serverDetail.resetMessage', { name })}
          confirmLabel={t('serverDetail.resetConfirm')}
          onConfirm={() => {
            callAction('reset');
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
