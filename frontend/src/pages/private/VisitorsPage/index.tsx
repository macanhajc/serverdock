import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { formatDate } from '../../../utils/format';
import type { Visitor } from '../../../types';

export default function VisitorsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { addToast } = useToast();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    fetchVisitors();
  }, [fetchVisitors]);

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

  async function blockVisitor(id: string, username: string) {
    try {
      const res = await fetch(`/api/visitors/${id}/block`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, blocked: true } : v)));
        addToast(t('visitors.blocked', { username }));
      } else {
        addToast(t('visitors.blockFailed'), 'error');
      }
    } catch {
      addToast(t('visitors.couldNotReach'), 'error');
    }
  }

  async function unblockVisitor(id: string, username: string) {
    try {
      const res = await fetch(`/api/visitors/${id}/unblock`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, blocked: false } : v)));
        addToast(t('visitors.unblocked', { username }));
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

      <div className="px-6 py-5">
        {!loaded && <span className="font-mono text-xs text-ink-3">{t('common.loading')}</span>}

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
                    <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">{v.ip || '—'}</td>
                    <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-3 whitespace-nowrap">
                      {formatDate(v.firstSeen)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-3 border-r border-line whitespace-nowrap">
                      {formatDate(v.lastSeen)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {v.blocked ? (
                          <Button
                            size="sm"
                            variant="warn"
                            onClick={() => unblockVisitor(v.id, v.username)}
                          >
                            {t('visitors.unblock')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => blockVisitor(v.id, v.username)}
                          >
                            {t('visitors.block')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeVisitor(v.id, v.username)}
                        >
                          {t('visitors.remove')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
