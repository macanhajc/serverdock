import { useTranslation } from 'react-i18next';
import { StatusDot } from '../../../../components/core/StatusDot';
import { timeAgo } from '../../../../utils/format';
import type { VpnPeer } from '../../../../types';
import { Td } from './TableParts';

export function PeerRow({ peer, striped }: { peer: VpnPeer; striped: boolean }) {
  const { t } = useTranslation();
  return (
    <tr className={`border-b border-line last:border-0 ${striped ? 'bg-bg-2' : ''}`}>
      <Td>
        <div className="flex items-center gap-2">
          <StatusDot online={peer.online} />
          <span className="font-mono text-sm text-ink">{peer.name}</span>
        </div>
      </Td>
      <Td mono>{peer.ip ?? '—'}</Td>
      <Td mono className="capitalize">
        {peer.os ?? '—'}
      </Td>
      <Td mono style={peer.connectionType === 'relayed' ? { color: 'var(--yellow)' } : undefined}>
        {peer.connectionType === 'direct' && t('network.connectionDirect')}
        {peer.connectionType === 'relayed' && t('network.connectionRelayed')}
        {!peer.connectionType && '—'}
      </Td>
      <Td mono>{typeof peer.latencyMs === 'number' ? `${peer.latencyMs} ms` : '—'}</Td>
      <Td mono style={{ color: peer.online ? 'var(--green)' : 'var(--ink-3)' }}>
        {peer.online ? t('network.online') : t('network.offline')}
      </Td>
      <Td mono last className="whitespace-nowrap">
        {peer.online ? '—' : timeAgo(peer.lastSeen, t)}
      </Td>
    </tr>
  );
}
