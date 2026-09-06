import { useTranslation } from 'react-i18next';
import { ChevronLeft, Pencil, Play, Refresh, Stop, Trash } from 'pixelarticons/react';
import { useAuth } from '../../../../context/AuthContext';
import { StatusBadge } from '../../../../components/core/StatusBadge';
import { Button } from '../../../../components/core/Button';
import { toUiStatus, gameHue, gameMark } from '../../../../utils/serverStatus';
import type { Server } from '../../../../types';

export function DetailHeader({
  server,
  id,
  busy,
  isRunning,
  isNotCreated,
  badgeLabel,
  onBack,
  onStart,
  onStop,
  onRestart,
  onResetRequest,
  onEditConfig,
}: {
  server: Server;
  id: string;
  busy: boolean;
  isRunning: boolean;
  isNotCreated: boolean;
  badgeLabel?: string;
  onBack: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onResetRequest: () => void;
  onEditConfig: () => void;
}) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { name, connection, image } = server;

  return (
    <div className="flex items-center gap-4 py-4 px-6 border-b border-line bg-bg-1 flex-none">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 bg-bg-2 border border-line-2 text-ink-2 px-3 py-2 font-mono text-xs cursor-pointer flex-none"
      >
        <ChevronLeft width={12} height={12} />
        {t('serverDetail.back')}
      </button>
      {server.avatarUrl ? (
        <img
          src={server.avatarUrl}
          alt=""
          className="w-10 h-10 shrink-0 border border-line object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 shrink-0 border border-line grid place-items-center font-mono text-xs font-bold"
          style={{
            color: `hsl(${gameHue(id)} 55% 78%)`,
            background: `hsl(${gameHue(id)} 38% 16%)`,
          }}
        >
          {gameMark(name)}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-4 font-bold leading-tight">{name}</div>
        <div className="font-mono text-xs text-ink-3 mt-0.5 truncate">
          {id} · {connection?.host}:{connection?.port} · {image}
        </div>
      </div>
      <StatusBadge status={toUiStatus(server.status)} className="shrink-0">
        {badgeLabel}
      </StatusBadge>
      <div className="ml-auto flex gap-1.5 flex-none">
        {hasPermission('servers:power') && (
          <>
            <Button size="sm" variant="primary" disabled={!isNotCreated || busy} onClick={onStart}>
              <Play width={12} height={12} className="mr-1.5" />
              {t('serverDetail.actStart')}
            </Button>
            <Button size="sm" variant="danger" disabled={!isRunning || busy} onClick={onStop}>
              <Stop width={12} height={12} className="mr-1.5" />
              {t('serverDetail.actStop')}
            </Button>
            <Button size="sm" disabled={!isRunning || busy} onClick={onRestart}>
              <Refresh width={12} height={12} className="mr-1.5" />
              {t('serverDetail.actRestart')}
            </Button>
          </>
        )}
        {hasPermission('servers:reset') && (
          <Button size="sm" disabled={busy} onClick={onResetRequest}>
            <Trash width={12} height={12} className="mr-1.5" />
            {t('serverDetail.actReset')}
          </Button>
        )}
        {hasPermission('games:edit') && (
          <Button size="sm" onClick={onEditConfig}>
            <Pencil width={12} height={12} className="mr-1.5" />
            {t('serverDetail.editConfig')}
          </Button>
        )}
      </div>
    </div>
  );
}
