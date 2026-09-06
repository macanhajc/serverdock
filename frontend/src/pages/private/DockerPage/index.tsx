import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Images, Inbox, Refresh } from 'pixelarticons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { DockerRowSkeleton } from './components/DockerRowSkeleton';
import { DockerSummaryPanel } from './components/DockerSummaryPanel';
import { ImageRow } from './components/ImageRow';
import { ContainerRow } from './components/ContainerRow';
import { Th } from './components/TableParts';
import { useDockerImages, type DockerImage } from './hooks/useDockerImages';
import { useDockerContainers, type DockerContainer } from './hooks/useDockerContainers';
import { useDockerSummary } from './hooks/useDockerSummary';
import { useDeleteImage } from './hooks/useDeleteImage';
import { useDeleteContainer } from './hooks/useDeleteContainer';

type Tab = 'images' | 'containers';
type ConfirmState =
  | { type: 'image'; item: DockerImage }
  | { type: 'container'; item: DockerContainer };

export default function DockerPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings:manage');
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('containers');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [sizeSort, setSizeSort] = useState<'asc' | 'desc' | null>(null);

  const imagesQuery = useDockerImages();
  const containersQuery = useDockerContainers();
  const summaryQuery = useDockerSummary();
  const deleteImage = useDeleteImage();
  const deleteContainer = useDeleteContainer();

  const images = imagesQuery.data ?? [];
  const containers = containersQuery.data ?? [];
  const loaded = !imagesQuery.isLoading && !containersQuery.isLoading;
  const refreshing =
    imagesQuery.isFetching || containersQuery.isFetching || summaryQuery.isFetching;

  function refresh() {
    // Prefix match — invalidates images/containers/summary and any expanded
    // row's detail query in one call, then react-query refetches in the background.
    queryClient.invalidateQueries({ queryKey: ['docker'] });
  }

  const sortedImages =
    sizeSort === null
      ? images
      : [...images].sort((a, b) => (sizeSort === 'asc' ? a.size - b.size : b.size - a.size));

  function toggleSizeSort() {
    setSizeSort((prev) => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : null));
  }

  async function handleDelete() {
    if (!confirm) return;
    setConfirm(null);
    try {
      if (confirm.type === 'image') {
        await deleteImage.mutateAsync(confirm.item.id);
        addToast(t('docker.imageDeleted', { label: confirm.item.tags[0] ?? confirm.item.shortId }));
      } else {
        await deleteContainer.mutateAsync(confirm.item.id);
        addToast(
          t('docker.containerDeleted', {
            label: confirm.item.names[0] ?? confirm.item.shortId,
          })
        );
      }
    } catch (err) {
      addToast(err instanceof Error && err.message ? err.message : t('error.unexpected'), 'error');
    }
  }

  const TAB_CLS = (active: boolean) =>
    `flex items-center gap-1 px-4 py-2 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
      active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
    }`;

  return (
    <>
      <PageHeader
        title={t('docker.title')}
        subtitle={t('docker.subtitle', { images: images.length, containers: containers.length })}
      />

      <div className="px-6 py-5 container">
        <DockerSummaryPanel summary={summaryQuery.data ?? null} loaded={!summaryQuery.isLoading} />

        <div className="flex gap-0 border-b border-line mb-5">
          <button className={TAB_CLS(tab === 'containers')} onClick={() => setTab('containers')}>
            <Box width={16} height={16} />
            {t('docker.tabContainers')} ({containers.length})
          </button>
          <button className={TAB_CLS(tab === 'images')} onClick={() => setTab('images')}>
            <Images width={16} height={16} />
            {t('docker.tabImages')} ({images.length})
          </button>
          <div className="ml-auto flex items-center pb-2">
            <Button size="sm" onClick={refresh} disabled={refreshing}>
              <Refresh
                width={12}
                height={12}
                className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              {t('network.refresh')}
            </Button>
          </div>
        </div>

        {!loaded && tab === 'images' && (
          <div className="border border-line bg-bg-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-bg-2 border-line">
                  <th className="w-8 px-2 py-3 border-r border-line" />
                  <Th>{t('docker.colId')}</Th>
                  <Th>{t('docker.colTags')}</Th>
                  <Th>{t('docker.colInUse')}</Th>
                  <Th>{t('docker.colSize')}</Th>
                  <Th>{t('docker.colCreated')}</Th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <DockerRowSkeleton key={i} columns={6} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loaded && tab === 'containers' && (
          <div className="border border-line bg-bg-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-bg-2 border-line">
                  <th className="w-8 px-2 py-3 border-r border-line" />
                  <Th>{t('docker.colId')}</Th>
                  <Th>{t('docker.colName')}</Th>
                  <Th>{t('docker.colImage')}</Th>
                  <Th>{t('docker.colState')}</Th>
                  <Th>{t('docker.colCreated')}</Th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <DockerRowSkeleton key={i} columns={6} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loaded && tab === 'images' && (
          <>
            {images.length === 0 ? (
              <div className="flex items-center gap-2 font-mono text-xs text-ink-3">
                <Inbox width={14} height={14} />
                {t('docker.noImages')}
              </div>
            ) : (
              <div className="border border-line bg-bg-1 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-bg-2 border-line">
                      <th className="w-8 px-2 py-3 border-r border-line" />
                      <Th>{t('docker.colId')}</Th>
                      <Th>{t('docker.colTags')}</Th>
                      <Th>{t('docker.colInUse')}</Th>
                      <Th sortDir={sizeSort} onSort={toggleSizeSort}>
                        {t('docker.colSize')}
                      </Th>
                      <Th>{t('docker.colCreated')}</Th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedImages.map((img, i) => (
                      <ImageRow
                        key={img.id}
                        img={img}
                        striped={i % 2 === 1}
                        canManage={canManage}
                        onDeleteRequest={(item) => setConfirm({ type: 'image', item })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {loaded && tab === 'containers' && (
          <>
            {containers.length === 0 ? (
              <div className="flex items-center gap-2 font-mono text-xs text-ink-3">
                <Inbox width={14} height={14} />
                {t('docker.noContainers')}
              </div>
            ) : (
              <div className="border border-line bg-bg-1 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-bg-2 border-line">
                      <th className="w-8 px-2 py-3 border-r border-line" />
                      <Th>{t('docker.colId')}</Th>
                      <Th>{t('docker.colName')}</Th>
                      <Th>{t('docker.colImage')}</Th>
                      <Th>{t('docker.colState')}</Th>
                      <Th>{t('docker.colCreated')}</Th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((c, i) => (
                      <ContainerRow
                        key={c.id}
                        container={c}
                        striped={i % 2 === 1}
                        canManage={canManage}
                        onDeleteRequest={(item) => setConfirm({ type: 'container', item })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={t(
            confirm.type === 'image' ? 'docker.confirmImageTitle' : 'docker.confirmContainerTitle'
          )}
          message={t(
            confirm.type === 'image'
              ? 'docker.confirmImageMessage'
              : 'docker.confirmContainerMessage',
            {
              label:
                confirm.type === 'image'
                  ? (confirm.item.tags[0] ?? confirm.item.shortId)
                  : (confirm.item.names[0] ?? confirm.item.shortId),
            }
          )}
          confirmLabel={t('docker.confirmDeleteBtn')}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
