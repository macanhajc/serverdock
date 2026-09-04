import { useTranslation } from 'react-i18next';
import type { ContainerDetail } from '../hooks/useContainerDetail';

// Docker reports "0001-01-01T00:00:00Z" for a timestamp that never happened
// (e.g. finishedAt on a container that's still running).
function formatDate(iso: string) {
  const d = new Date(iso);
  if (d.getUTCFullYear() < 1970) return null;
  return d.toLocaleString();
}

export function ContainerDetailRow({
  colSpan,
  detail,
  loading,
  error,
}: {
  colSpan: number;
  detail: ContainerDetail | null;
  loading: boolean;
  error: boolean;
}) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-line last:border-0 bg-bg-2">
      <td colSpan={colSpan} className="px-5 py-4">
        {loading && <div className="font-mono text-xs text-ink-3">{t('common.loading')}</div>}
        {error && <div className="font-mono text-xs text-red">{t('docker.detailLoadFailed')}</div>}
        {detail && (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 font-mono text-xs">
            <Field label={t('docker.detailNetworkMode')} value={detail.networkMode} />
            <Field label={t('docker.detailRestartCount')} value={String(detail.restartCount)} />
            <div className="col-span-2">
              <div className="text-ink-3 mb-1">{t('docker.detailCmd')}</div>
              <div className="text-ink-2 break-all">{detail.command || t('docker.detailNone')}</div>
            </div>

            <div className="col-span-2">
              <div className="text-ink-3 mb-1">{t('docker.detailPorts')}</div>
              {detail.ports.length ? (
                detail.ports.map((p) => (
                  <div key={p.containerPort} className="text-ink-2">
                    {p.containerPort}
                    {' → '}
                    {p.hostBindings.length
                      ? p.hostBindings
                          .map((b) => `${b.hostIp || '0.0.0.0'}:${b.hostPort}`)
                          .join(', ')
                      : t('docker.detailNotPublished')}
                  </div>
                ))
              ) : (
                <div className="text-ink-2">{t('docker.detailNone')}</div>
              )}
            </div>

            <div className="col-span-2">
              <div className="text-ink-3 mb-1">{t('docker.detailMounts')}</div>
              {detail.mounts.length ? (
                detail.mounts.map((m) => (
                  <div key={m.destination} className="text-ink-2 break-all">
                    {m.source} → {m.destination} ({m.rw ? 'rw' : 'ro'})
                  </div>
                ))
              ) : (
                <div className="text-ink-2">{t('docker.detailNone')}</div>
              )}
            </div>

            <div className="col-span-2">
              <div className="text-ink-3 mb-1">{t('docker.detailState')}</div>
              <div className="text-ink-2 flex flex-col gap-0.5">
                <span>{detail.state.status}</span>
                {formatDate(detail.state.startedAt) && (
                  <span>
                    {t('docker.detailStartedAt')}: {formatDate(detail.state.startedAt)}
                  </span>
                )}
                {formatDate(detail.state.finishedAt) && (
                  <span>
                    {t('docker.detailFinishedAt')}: {formatDate(detail.state.finishedAt)}
                  </span>
                )}
                {detail.state.exitCode !== 0 && (
                  <span>
                    {t('docker.detailExitCode')}: {detail.state.exitCode}
                    {detail.state.oomKilled ? ` (${t('docker.detailOomKilled')})` : ''}
                  </span>
                )}
                {detail.state.error && (
                  <span className="text-red">
                    {t('docker.detailError')}: {detail.state.error}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-3 mb-1">{label}</div>
      <div className="text-ink-2 break-all">{value}</div>
    </div>
  );
}
