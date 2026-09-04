import { useTranslation } from 'react-i18next';
import { Users } from 'pixelarticons/react';
import type { Visitor } from '../../../../types';
import { VisitorRow } from './VisitorRow';
import { VisitorRowSkeleton } from './VisitorRowSkeleton';
import { Th } from './TableParts';

export function VisitorsTable({
  visitors,
  loaded,
  canManage,
  onBlockRequest,
  onRemoveRequest,
  onUnblock,
}: {
  visitors: Visitor[];
  loaded: boolean;
  canManage: boolean;
  onBlockRequest: (visitor: Visitor) => void;
  onRemoveRequest: (visitor: Visitor) => void;
  onUnblock: (visitor: Visitor) => void;
}) {
  const { t } = useTranslation();

  if (!loaded) {
    return (
      <div className="border border-line bg-bg-1 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-bg-2 border-line">
              <Th>{t('visitors.colUsername')}</Th>
              <Th>{t('visitors.colPeer')}</Th>
              <Th>{t('visitors.colIp')}</Th>
              <Th>{t('visitors.colFirstSeen')}</Th>
              <Th>{t('visitors.colLastSeen')}</Th>
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
    );
  }

  if (visitors.length === 0) {
    return (
      <div className="flex border border-line bg-bg-1 p-4 items-center gap-2 font-mono text-xs text-ink-3">
        <Users width={14} height={14} />
        {t('visitors.noVisitors')}
      </div>
    );
  }

  return (
    <div className="border border-line bg-bg-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-bg-2 border-line">
            <Th>{t('visitors.colUsername')}</Th>
            <Th>{t('visitors.colPeer')}</Th>
            <Th>{t('visitors.colIp')}</Th>
            <Th>{t('visitors.colFirstSeen')}</Th>
            <Th>{t('visitors.colLastSeen')}</Th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {visitors.map((v, i) => (
            <VisitorRow
              key={v.id}
              visitor={v}
              striped={i % 2 === 1}
              canManage={canManage}
              onBlockRequest={onBlockRequest}
              onRemoveRequest={onRemoveRequest}
              onUnblock={onUnblock}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
