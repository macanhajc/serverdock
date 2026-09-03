import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { formatDate } from '../../../utils/format';
import { VisitorRowSkeleton } from './components/VisitorRowSkeleton';
import type { Visitor, BlockedIp } from '../../../types';

interface PendingConfirm {
  type: 'remove' | 'block';
  id: string;
  username: string;
  ip?: string;
}

export default function VisitorsPage() {
  const { t } = useTranslation();
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission('visitors:manage');
  const { addToast } = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const fetchVisitors = useCallback(
    () =>
      fetch('/api/visitors', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: Visitor[]) => {
          setVisitors(data);
          setLoaded(true);
        })
        .catch(() => {
          setLoaded(true);
        }),
    [token]
  );

  const fetchBlockedIps = useCallback(
    () =>
      fetch('/api/visitors/blocklist', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: BlockedIp[]) => setBlockedIps(data))
        .catch(() => {}),
    [token]
  );

  useEffect(() => {
    fetchVisitors();
    fetchBlockedIps();
  }, [fetchVisitors, fetchBlockedIps]);

  // IPs blocked from a visitor row that's since been removed — the per-row
  // Unblock button can't reach these, so they get their own section.
  const orphanedBlockedIps = blockedIps.filter((b) => !visitors.some((v) => v.ip === b.ip));

  async function removeVisitor(id: string, username: string) {
    try {
      const res = await fetch(`/api/visitors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVisitors((prev) => prev.filter((v) => v.id !== id));
        addToast(t('visitors.removed', { username }));
      } else {
        addToast(t('visitors.removeFailed'), 'error');
      }
    } catch {
      addToast(t('visitors.couldNotReach'), 'error');
    }
  }

  async function blockVisitor(id: string, username: string, ip?: string) {
    try {
      const res = await fetch(`/api/visitors/${id}/block`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVisitors((prev) => prev.map((v) => (v.ip && v.ip === ip ? { ...v, blocked: true } : v)));
        if (ip) fetchBlockedIps();
        addToast(t('visitors.blocked', { username }));
      } else {
        addToast(t('visitors.blockFailed'), 'error');
      }
    } catch {
      addToast(t('visitors.couldNotReach'), 'error');
    }
  }

  async function unblockVisitor(id: string, username: string, ip?: string) {
    try {
      const res = await fetch(`/api/visitors/${id}/unblock`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVisitors((prev) =>
          prev.map((v) => (v.ip && v.ip === ip ? { ...v, blocked: false } : v))
        );
        setBlockedIps((prev) => prev.filter((b) => b.ip !== ip));
        addToast(t('visitors.unblocked', { username }));
      } else {
        addToast(t('visitors.unblockFailed'), 'error');
      }
    } catch {
      addToast(t('visitors.couldNotReach'), 'error');
    }
  }

  function handleConfirm() {
    if (!confirm) return;
    const { type, id, username, ip } = confirm;
    setConfirm(null);
    if (type === 'remove') removeVisitor(id, username);
    else blockVisitor(id, username, ip);
  }

  async function unblockIp(ip: string) {
    try {
      const res = await fetch(`/api/visitors/blocklist/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBlockedIps((prev) => prev.filter((b) => b.ip !== ip));
        setVisitors((prev) => prev.map((v) => (v.ip === ip ? { ...v, blocked: false } : v)));
        addToast(t('visitors.ipUnblocked', { ip }));
      } else {
        addToast(t('visitors.unblockFailed'), 'error');
      }
    } catch {
      addToast(t('visitors.couldNotReach'), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={t('visitors.title')}
        subtitle={t('visitors.subtitle', { count: visitors.length })}
      />

      <div className="px-6 py-5 container">
        {!loaded && (
          <div className="border border-line bg-bg-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-bg-2 border-line">
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colUsername')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colIp')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colFirstSeen')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] border-r border-line text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colLastSeen')}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <VisitorRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loaded && visitors.length === 0 && (
          <span className="font-mono text-xs text-ink-3">{t('visitors.noVisitors')}</span>
        )}

        {loaded && visitors.length > 0 && (
          <div className="border border-line bg-bg-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-bg-2 border-line">
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colUsername')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colIp')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colFirstSeen')}
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[11px] border-r border-line text-ink-3 uppercase tracking-wider whitespace-nowrap">
                    {t('visitors.colLastSeen')}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {visitors.map((v, i) => (
                  <tr
                    key={v.id}
                    className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono border-r border-line text-sm text-ink">
                      <span className="flex items-center gap-2">
                        {v.username}
                        {v.blocked && (
                          <span
                            className="font-mono text-[8px] font-semibold tracking-wider uppercase px-1.5 py-0.5"
                            style={{
                              color: 'var(--red)',
                              background: 'color-mix(in oklab, var(--red) 10%, transparent)',
                              border: '1px solid color-mix(in oklab, var(--red) 45%, transparent)',
                            }}
                          >
                            {t('visitors.blockedBadge')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">
                      {v.ip || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-3 whitespace-nowrap">
                      {formatDate(v.firstSeen)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-3 border-r border-line whitespace-nowrap">
                      {formatDate(v.lastSeen)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="flex items-center justify-end gap-2">
                          {v.blocked ? (
                            <Button
                              size="sm"
                              variant="warn"
                              onClick={() => unblockVisitor(v.id, v.username, v.ip)}
                            >
                              {t('visitors.unblock')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() =>
                                setConfirm({
                                  type: 'block',
                                  id: v.id,
                                  username: v.username,
                                  ip: v.ip,
                                })
                              }
                            >
                              {t('visitors.block')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              setConfirm({ type: 'remove', id: v.id, username: v.username })
                            }
                          >
                            {t('visitors.remove')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {orphanedBlockedIps.length > 0 && (
          <div className="mt-6">
            <h2 className="font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-2">
              {t('visitors.blockedIpsTitle')}
            </h2>
            <div className="border border-line bg-bg-1 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-bg-2 border-line">
                    <th className="text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap">
                      {t('visitors.colIp')}
                    </th>
                    <th className="text-left px-4 py-3 font-mono text-[11px] border-r border-line text-ink-3 uppercase tracking-wider whitespace-nowrap">
                      {t('visitors.colBlockedAt')}
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orphanedBlockedIps.map((b, i) => (
                    <tr
                      key={b.ip}
                      className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">
                        {b.ip}
                      </td>
                      <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-3 whitespace-nowrap">
                        {formatDate(b.blockedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <Button size="sm" variant="warn" onClick={() => unblockIp(b.ip)}>
                            {t('visitors.unblock')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={t(
            confirm.type === 'remove' ? 'visitors.confirmRemoveTitle' : 'visitors.confirmBlockTitle'
          )}
          message={t(
            confirm.type === 'remove'
              ? 'visitors.confirmRemoveMessage'
              : 'visitors.confirmBlockMessage',
            { username: confirm.username }
          )}
          confirmLabel={t(
            confirm.type === 'remove' ? 'visitors.confirmRemoveBtn' : 'visitors.confirmBlockBtn'
          )}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
