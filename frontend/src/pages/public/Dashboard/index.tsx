import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { ServerCard } from '../../../components/data/ServerCard';
import { ServerCardSkeleton } from '../../../components/data/ServerCardSkeleton';
import { LangSwitcher } from '../../../components/core/LangSwitcher';
import { CopyButton } from '../../../components/core/CopyButton';
import { PageHeader } from '../../../components/core/PageHeader';
import { HowToConnectModal } from './components/HowToConnectModal';
import { toUiStatus, gameHue, gameMark, sortOnlineFirst } from '../../../utils/serverStatus';
import { timeAgo } from '../../../utils/format';
import type { Server } from '../../../types';

interface ConnectCellProps {
  host: string;
  port: number;
}

function ConnectCell({ host, port }: ConnectCellProps) {
  const addr = `${host}:${port}`;
  return (
    <span className="flex items-center gap-2">
      <span>{addr}</span>
      <CopyButton text={addr} className="text-sm" />
    </span>
  );
}

interface Visitor {
  username: string;
}

export default function PublicDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [identifying, setIdentifying] = useState(true);
  const [servers, setServers] = useState<Server[]>([]);
  const [search, setSearch] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('sd_visitor_token');
    fetch('/api/visitors/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token ?? undefined }),
    })
      .then(async (r) => {
        if (r.status === 403) {
          const body = await r.json().catch(() => ({}));
          navigate(body.error === 'blocked' ? '/blocked' : '/auth', { replace: true });
          return;
        }
        if (!r.ok) {
          navigate('/auth', { replace: true });
          return;
        }
        const data = await r.json();
        localStorage.setItem('sd_visitor_token', data.token);
        setVisitor({ username: data.username });
      })
      .catch(() => navigate('/auth', { replace: true }))
      .finally(() => setIdentifying(false));
  }, [navigate]);

  const fetchServers = useCallback(
    () =>
      fetch('/api/servers')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: Server[]) => setServers(data))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    if (!visitor) return;

    const socket = io({ autoConnect: false });

    socket.on('status:all', (snapshot: Array<{ id: string; status: Server['status']; players: number | null }>) => {
      setServers((prev) => {
        if (prev.length === 0) return prev;
        const map = new Map(snapshot.map((u) => [u.id, { status: u.status, players: u.players }]));
        return prev.map((s) => {
          const u = map.get(s.id);
          if (!u) return s;
          const players = u.status === 'running' ? (u.players ?? s.players) : u.players;
          return { ...s, status: u.status, players };
        });
      });
    });

    socket.on('status:update', ({ id, status, players }: { id: string; status: Server['status']; players: number | null }) => {
      setServers((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status, players: status === 'running' ? (players ?? s.players) : players }
            : s
        )
      );
    });

    fetchServers().then(() => {
      socket.connect();
      socket.emit('join:status');
    });

    const poll = setInterval(fetchServers, 10_000);

    return () => {
      socket.emit('leave:status');
      socket.disconnect();
      clearInterval(poll);
    };
  }, [visitor, fetchServers]);

  const loading = identifying || servers.length === 0;
  const onlineCount = servers.filter((s) => s.status === 'running').length;
  const filtered = sortOnlineFirst(
    search ? servers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())) : servers
  );

  return (
    <div className="min-h-screen bg-bg">
      {/* Topbar */}
      <header className="flex items-center gap-3.5 h-14 px-6 border-b border-line bg-bg-1">
        <div className="flex items-center gap-3">
          <span className="w-5.5 h-5.5 bg-accent grid place-items-center text-white font-bold text-sm font-mono">
            S
          </span>
          <b className="font-bold tracking-[.01em] text-[15px]">ServerDock</b>
        </div>

        {visitor && (
          <span className="ml-auto font-mono text-xs text-ink-3 border border-line px-2 py-1">
            {visitor.username}
          </span>
        )}

        <LangSwitcher />

        <Link
          to="/auth?mode=admin"
          className="ml-1 bg-(--accent-dim) border border-(--accent-edge) text-ink px-3.5 py-2 text-xs font-semibold no-underline tracking-[.02em]"
        >
          {t('publicDashboard.admin')}
        </Link>
      </header>

      <PageHeader
        title={t('publicDashboard.title')}
        subtitle={t('publicDashboard.statusLine', { count: servers.length, online: onlineCount })}
      >
        <div className="ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('publicDashboard.filterPlaceholder')}
            className="bg-bg-1 border border-line text-ink-2 px-3 py-2 text-xs font-mono w-52.5 outline-none"
          />
        </div>
      </PageHeader>

      {/* Help banner */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b border-line flex-wrap"
        style={{ background: 'var(--accent-dim)' }}
      >
        <span className="text-accent font-bold text-[15px] shrink-0">ℹ</span>
        <span className="text-sm text-white">{t('publicDashboard.helpBannerText')}</span>
        <button
          onClick={() => setShowHelp(true)}
          className="ml-auto shrink-0 border px-3.5 py-2 text-xs font-semibold cursor-pointer bg-accent text-white border-accent tracking-[.02em]"
        >
          {t('publicDashboard.howToConnect')}
        </button>
      </div>

      {/* Card grid */}
      <div className="grid gap-6 pt-8 pb-16 px-6 grid-cols-[repeat(auto-fill,minmax(var(--card-min),1fr))] *:max-w-105">
        {filtered.map((server) => (
          <ServerCard
            key={server.id}
            name={server.name}
            engine={server.image}
            status={toUiStatus(server.status)}
            players={server.players ?? '—'}
            ip={server.connection
              ? <ConnectCell host={server.connection.host} port={server.connection.port} />
              : <span className="font-mono text-xs text-ink-3">—</span>
            }
            hue={gameHue(server.id)}
            mark={gameMark(server.name)}
            source={server.imageSource === 'local' ? 'Steam' : 'Public'}
            avatarUrl={server.avatarUrl}
            storeUrl={server.storeUrl}
            pinnedEnv={server.pinnedEnv ?? []}
            lastActive={
              server.status !== 'running' && server.lastActiveAt
                ? t('publicDashboard.lastActive', { time: timeAgo(server.lastActiveAt, t) })
                : undefined
            }
          />
        ))}

        {loading && Array.from({ length: 6 }, (_, i) => <ServerCardSkeleton key={i} />)}

        {!loading && filtered.length === 0 && (
          <span className="font-mono text-xs text-ink-3">
            {t('publicDashboard.noMatch', { search })}
          </span>
        )}
      </div>

      {showHelp && <HowToConnectModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
