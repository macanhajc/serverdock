import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, RotateCw, Trash2, Hammer, ExternalLink } from 'lucide-react';
import type { Server } from '../../types';
import { ServerCard } from './ServerCard';
import { StatusBadge } from '../core/StatusBadge';
import { Button } from '../core/Button';
import { CopyButton } from '../core/CopyButton';
import { toUiStatus, gameHue, gameMark } from '../../utils/serverStatus';

// ─── ServerCardSkeleton ───────────────────────────────────────────────────────

export function ServerCardSkeleton() {
  return (
    <div className="bg-bg-1 border border-line animate-pulse">
      <div className="h-22.5 bg-bg-2 border-b border-line" />
      <div className="p-(--row-pad) flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4.5 w-32 bg-bg-2 rounded-[1px]" />
          <div className="h-4.5 w-16 bg-bg-2 rounded-[1px]" />
        </div>
        <div className="h-3 w-40 bg-bg-2 rounded-[1px]" />
        <div className="mt-1 flex gap-8">
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-12 bg-bg-2 rounded-[1px]" />
            <div className="h-3 w-6 bg-bg-2 rounded-[1px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-12 bg-bg-2 rounded-[1px]" />
            <div className="h-3 w-24 bg-bg-2 rounded-[1px]" />
          </div>
        </div>
        <div className="mt-2 pt-4 border-t border-line flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7.5 w-12 bg-bg-2 rounded-[1px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── IpCell ───────────────────────────────────────────────────────────────────

interface IpCellProps {
  host: string;
  port: number | string;
}

export function IpCell({ host, port }: IpCellProps) {
  return (
    <span className="flex items-center gap-2">
      <span>
        {host}:{port}
      </span>
      <CopyButton text={`${host}:${port}`} />
    </span>
  );
}

// ─── SteamStrip ───────────────────────────────────────────────────────────────

interface SteamStripProps {
  isBuilding: boolean;
  imageBuilt?: boolean;
  disabled?: boolean;
  onBuild?: () => void;
}

export function SteamStrip({ isBuilding, imageBuilt, disabled, onBuild }: SteamStripProps) {
  const { t } = useTranslation();
  const badgeStatus = isBuilding ? 'building' : imageBuilt ? 'built' : 'none';
  return (
    <div className="flex items-center gap-2 mt-3 p3 border border-line bg-[#0c0c0c]">
      <span className="font-mono text-sm tracking-[.08em] uppercase text-ink-3">Steam</span>
      <StatusBadge status={badgeStatus} />
      <span className="flex-1" />
      <Button size="sm" disabled={isBuilding || disabled} onClick={onBuild}>
        <Hammer size={13} className="mr-1" />
        {isBuilding
          ? t('adminDashboard.steamBuilding')
          : imageBuilt
            ? t('adminDashboard.steamRebuild')
            : t('adminDashboard.steamBuildImage')}
      </Button>
    </div>
  );
}

// ─── AdminServerCard ──────────────────────────────────────────────────────────

interface AdminServerCardProps {
  server: Server;
  actionLoading?: string | null;
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onReset?: () => void;
  onEdit?: () => void;
  onBuild?: () => void;
}

export function AdminServerCard({ server, actionLoading, onStart, onStop, onRestart, onReset, onEdit, onBuild }: AdminServerCardProps) {
  const { t } = useTranslation();
  const { id, name, image, status, imageSource, imageBuilt, players, connection, pinnedEnv } =
    server;

  const isNotCreated = status === 'stopped' || status === 'not_created' || status === 'error';
  const isRunning = status === 'running';
  const busy = !!actionLoading;
  const isBuilding = status === 'building' || actionLoading === 'build';

  const ip: ReactNode = connection?.port != null ? (
    <IpCell host={connection.host} port={connection.port} />
  ) : (
    <span className="font-mono text-xs text-ink-3">—</span>
  );

  return (
    <ServerCard
      name={name}
      engine={image}
      status={toUiStatus(status)}
      players={players != null ? String(players) : '—'}
      ip={ip}
      hue={gameHue(id)}
      mark={gameMark(name)}
      source={imageSource === 'local' ? 'Steam' : 'Public'}
      pinnedEnv={pinnedEnv ?? []}
      coverActions={
        <Button size="sm" onClick={onEdit}>
          <ExternalLink size={13} />
        </Button>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={!isNotCreated || busy} onClick={onStart}>
            <Play size={13} className="mr-1" />
            {t('adminDashboard.actStart')}
          </Button>
          <Button size="sm" variant="danger" disabled={isNotCreated || busy} onClick={onStop}>
            <Square size={13} className="mr-1" />
            {t('adminDashboard.actStop')}
          </Button>
          <Button size="sm" disabled={!isRunning || busy} onClick={onRestart}>
            <RotateCw size={13} className="mr-1" />
            {t('adminDashboard.actRestart')}
          </Button>
          <Button size="sm" disabled={busy} onClick={onReset}>
            <Trash2 size={13} className="mr-1" />
            {t('adminDashboard.actReset')}
          </Button>
        </div>
      }
    >
      {imageSource === 'local' && (
        <SteamStrip
          isBuilding={isBuilding}
          imageBuilt={imageBuilt}
          disabled={busy && !isBuilding}
          onBuild={onBuild}
        />
      )}
    </ServerCard>
  );
}
