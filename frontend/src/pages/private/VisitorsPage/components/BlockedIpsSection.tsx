import { useTranslation } from 'react-i18next';
import { Lock, Unlock } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';
import { formatDate } from '../../../../utils/format';
import type { BlockedIp } from '../../../../types';
import { Th } from './TableParts';

export function BlockedIpsSection({
  blockedIps,
  canManage,
  onUnblockIp,
}: {
  blockedIps: BlockedIp[];
  canManage: boolean;
  onUnblockIp: (ip: string) => void;
}) {
  const { t } = useTranslation();

  if (blockedIps.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 uppercase tracking-wider mb-2">
        <Lock width={11} height={11} />
        {t('visitors.blockedIpsTitle')}
      </h2>
      <div className="border border-line bg-bg-1 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-bg-2 border-line">
              <Th>{t('visitors.colIp')}</Th>
              <Th>{t('visitors.colBlockedAt')}</Th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {blockedIps.map((b, i) => (
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
                    <Button size="sm" variant="warn" onClick={() => onUnblockIp(b.ip)}>
                      <Unlock width={12} height={12} className="mr-1.5" />
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
  );
}
