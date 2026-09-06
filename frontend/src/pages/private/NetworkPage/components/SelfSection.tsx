import { useTranslation } from 'react-i18next';
import { Server, WarningDiamond } from 'pixelarticons/react';
import { CopyButton } from '../../../../components/core/CopyButton';
import { StatusDot } from '../../../../components/core/StatusDot';
import type { NetworkProviderMeta } from '../../../../data/networkProviders';
import type { VpnSelf } from '../../../../types';
import { SelfCardSkeleton } from './SelfCardSkeleton';

export function SelfSection({
  self,
  error,
  providerMeta,
  startCommand,
  loaded,
}: {
  self: VpnSelf | null;
  error: string | null;
  providerMeta: NetworkProviderMeta;
  startCommand: string | undefined;
  loaded: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="m-0 mb-3 flex items-center gap-2 text-sm font-semibold tracking-[.02em] text-ink-2 uppercase font-mono">
        <Server width={14} height={14} />
        {t('network.thisServer')}
      </h2>

      {!loaded && <SelfCardSkeleton />}

      {loaded && error && (
        <div
          className="flex items-center gap-2 border px-4 py-3 font-mono text-xs text-red"
          style={{
            background: 'color-mix(in oklab, var(--red) 8%, transparent)',
            borderColor: 'color-mix(in oklab, var(--red) 35%, transparent)',
          }}
        >
          <WarningDiamond width={13} height={13} className="shrink-0" />
          {error} — {t('network.vpnCheck', { provider: providerMeta.label })}
        </div>
      )}

      {loaded && !error && !self && (
        <div className="flex items-center gap-2 border border-line bg-bg-1 px-4 py-3 font-mono text-xs text-ink-3">
          <WarningDiamond width={13} height={13} className="shrink-0 text-yellow" />
          {t('network.providerInactive', { provider: providerMeta.label })}{' '}
          {startCommand ? (
            <>
              {t('network.providerInactiveRunPrefix')}{' '}
              <code className="text-ink">{startCommand}</code>{' '}
              {t('network.providerInactiveOnMachine')}
            </>
          ) : (
            t('network.providerInactiveGenericHint')
          )}
        </div>
      )}

      {loaded && self && (
        <div className="border border-line bg-bg-1 px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <StatusDot online={self.online} />
            <span className="font-mono text-sm text-ink font-semibold">{self.name}</span>
            <span className="ml-auto font-mono text-xs text-ink-3">
              {self.online ? t('network.connected') : t('network.offline')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-3 w-20 shrink-0">{t('network.vpnIp')}</span>
            <span className="font-mono text-sm text-ink">{self.ip ?? '—'}</span>
            {self.ip && <CopyButton text={self.ip} />}
          </div>
          <div
            className="mt-1 px-3 py-2.5 font-mono text-xs text-ink-2"
            style={{
              background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
              border: '1px solid color-mix(in oklab, var(--accent) 20%, transparent)',
            }}
          >
            {t('network.friendsConnect1')}{' '}
            <span className="text-ink font-semibold">{self.ip ?? 'your VPN IP'}</span>{' '}
            {t('network.friendsConnect2')}
          </div>
        </div>
      )}
    </section>
  );
}
