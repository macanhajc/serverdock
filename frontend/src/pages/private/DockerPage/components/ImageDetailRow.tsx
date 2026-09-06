import { useTranslation } from 'react-i18next';
import type { ImageDetail } from '../hooks/useImageDetail';

export function ImageDetailRow({
  colSpan,
  detail,
  loading,
  error,
}: {
  colSpan: number;
  detail: ImageDetail | null;
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
            <Field
              label={t('docker.detailArchitecture')}
              value={`${detail.os}/${detail.architecture}`}
            />
            <Field label={t('docker.detailLayers')} value={String(detail.layers)} />
            <Field
              label={t('docker.detailEntrypoint')}
              value={detail.entrypoint?.join(' ') || t('docker.detailNone')}
            />
            <Field
              label={t('docker.detailCmd')}
              value={detail.cmd?.join(' ') || t('docker.detailNone')}
            />
            <Field
              label={t('docker.detailExposedPorts')}
              value={
                detail.exposedPorts.length ? detail.exposedPorts.join(', ') : t('docker.detailNone')
              }
            />
            <div className="col-span-2">
              <div className="text-ink-3 mb-1">{t('docker.detailDigests')}</div>
              {detail.repoDigests.length ? (
                detail.repoDigests.map((d) => (
                  <div key={d} className="text-ink-2 break-all">
                    {d}
                  </div>
                ))
              ) : (
                <div className="text-ink-2">{t('docker.detailNone')}</div>
              )}
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
