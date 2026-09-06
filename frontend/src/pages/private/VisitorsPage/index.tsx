import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { PageHeader } from '../../../components/core/PageHeader';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { VisitorsTable } from './components/VisitorsTable';
import { BlockedIpsSection } from './components/BlockedIpsSection';
import type { Visitor } from '../../../types';
import { useVisitors } from './hooks/useVisitors';
import { useBlockedIps } from './hooks/useBlockedIps';
import { useRemoveVisitor } from './hooks/useRemoveVisitor';
import { useBlockVisitor } from './hooks/useBlockVisitor';
import { useUnblockVisitor } from './hooks/useUnblockVisitor';
import { useUnblockIp } from './hooks/useUnblockIp';
import { visitorErrorMessage } from './hooks/visitorsApi';

interface PendingConfirm {
  type: 'remove' | 'block';
  id: string;
  username: string;
  ip?: string;
}

export default function VisitorsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('visitors:manage');
  const { addToast } = useToast();
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const visitorsQuery = useVisitors();
  const blockedIpsQuery = useBlockedIps();
  const removeVisitor = useRemoveVisitor();
  const blockVisitor = useBlockVisitor();
  const unblockVisitor = useUnblockVisitor();
  const unblockIp = useUnblockIp();

  const visitors = visitorsQuery.data ?? [];
  const blockedIps = blockedIpsQuery.data ?? [];
  const loaded = !visitorsQuery.isLoading;

  // IPs blocked from a visitor row that's since been removed — the per-row
  // Unblock button can't reach these, so they get their own section.
  const orphanedBlockedIps = blockedIps.filter((b) => !visitors.some((v) => v.ip === b.ip));

  function handleConfirm() {
    if (!confirm) return;
    const { type, id, username } = confirm;
    setConfirm(null);
    if (type === 'remove') {
      removeVisitor.mutate(id, {
        onSuccess: () => addToast(t('visitors.removed', { username })),
        onError: (err) => addToast(visitorErrorMessage(err, t, 'visitors.removeFailed'), 'error'),
      });
    } else {
      blockVisitor.mutate(id, {
        onSuccess: () => addToast(t('visitors.blocked', { username })),
        onError: (err) => addToast(visitorErrorMessage(err, t, 'visitors.blockFailed'), 'error'),
      });
    }
  }

  function handleUnblockVisitor(v: Visitor) {
    unblockVisitor.mutate(v.id, {
      onSuccess: () => addToast(t('visitors.unblocked', { username: v.username })),
      onError: (err) => addToast(visitorErrorMessage(err, t, 'visitors.unblockFailed'), 'error'),
    });
  }

  function handleUnblockIp(ip: string) {
    unblockIp.mutate(ip, {
      onSuccess: () => addToast(t('visitors.ipUnblocked', { ip })),
      onError: (err) => addToast(visitorErrorMessage(err, t, 'visitors.unblockFailed'), 'error'),
    });
  }

  return (
    <>
      <PageHeader
        title={t('visitors.title')}
        subtitle={t('visitors.subtitle', { count: visitors.length })}
      />

      <div className="px-6 py-5 container">
        <VisitorsTable
          visitors={visitors}
          loaded={loaded}
          canManage={canManage}
          onBlockRequest={(v) =>
            setConfirm({ type: 'block', id: v.id, username: v.username, ip: v.ip })
          }
          onRemoveRequest={(v) => setConfirm({ type: 'remove', id: v.id, username: v.username })}
          onUnblock={handleUnblockVisitor}
        />

        <BlockedIpsSection
          blockedIps={orphanedBlockedIps}
          canManage={canManage}
          onUnblockIp={handleUnblockIp}
        />
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
