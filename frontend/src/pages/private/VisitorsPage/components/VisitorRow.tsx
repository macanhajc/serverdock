import { useTranslation } from 'react-i18next';
import { Lock, Unlock, UserX } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';
import { StatusDot } from '../../../../components/core/StatusDot';
import { formatDate } from '../../../../utils/format';
import type { Visitor } from '../../../../types';

export function VisitorRow({
  visitor,
  striped,
  canManage,
  onBlockRequest,
  onRemoveRequest,
  onUnblock,
}: {
  visitor: Visitor;
  striped: boolean;
  canManage: boolean;
  onBlockRequest: (visitor: Visitor) => void;
  onRemoveRequest: (visitor: Visitor) => void;
  onUnblock: (visitor: Visitor) => void;
}) {
  const { t } = useTranslation();
  const v = visitor;

  return (
    <tr className={`border-b border-line last:border-0 ${striped ? 'bg-bg-2' : ''}`}>
      <td className="px-4 py-3 font-mono border-r border-line text-sm text-ink">
        <span className="flex items-center gap-2">
          {v.username}
          {v.blocked && (
            <span
              className="inline-flex items-center gap-1 font-mono text-[8px] font-semibold tracking-wider uppercase px-1.5 py-0.5"
              style={{
                color: 'var(--red)',
                background: 'color-mix(in oklab, var(--red) 10%, transparent)',
                border: '1px solid color-mix(in oklab, var(--red) 45%, transparent)',
              }}
            >
              <Lock width={9} height={9} />
              {t('visitors.blockedBadge')}
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">
        {v.peer ? (
          <span className="flex items-center gap-2">
            <StatusDot online={v.peer.online} />
            {v.peer.name}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 font-mono border-r border-line text-xs text-ink-2">{v.ip || '—'}</td>
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
              <Button size="sm" variant="warn" onClick={() => onUnblock(v)}>
                <Unlock width={12} height={12} className="mr-1.5" />
                {t('visitors.unblock')}
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => onBlockRequest(v)}>
                <Lock width={12} height={12} className="mr-1.5" />
                {t('visitors.block')}
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => onRemoveRequest(v)}>
              <UserX width={12} height={12} className="mr-1.5" />
              {t('visitors.remove')}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
