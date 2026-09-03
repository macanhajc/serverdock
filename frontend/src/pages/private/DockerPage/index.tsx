import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Inbox, Refresh, Trash } from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/core/Button';
import { PageHeader } from '../../../components/core/PageHeader';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { DockerRowSkeleton } from './components/DockerRowSkeleton';

interface DockerImage {
  id: string;
  shortId: string;
  tags: string[];
  size: number;
  created: number;
}

interface DockerContainer {
  id: string;
  shortId: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  created: number;
}

type Tab = 'images' | 'containers';

function formatBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function formatCreated(unix: number) {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DockerPage() {
  const { t } = useTranslation();
  const { token, hasPermission } = useAuth();
  const canManage = hasPermission('settings:manage');
  const { addToast } = useToast();

  const [tab, setTab] = useState<Tab>('images');
  const [images, setImages] = useState<DockerImage[]>([]);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirm, setConfirm] = useState<{
    type: 'image' | 'container';
    id: string;
    label: string;
  } | null>(null);
  const [sizeSort, setSizeSort] = useState<'asc' | 'desc' | null>(null);

  const authHeader = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoaded(false);
    try {
      const [imgRes, ctnRes] = await Promise.all([
        fetch('/api/docker/images', { headers: authHeader }),
        fetch('/api/docker/containers', { headers: authHeader }),
      ]);
      if (imgRes.ok) setImages(await imgRes.json());
      if (ctnRes.ok) setContainers(await ctnRes.json());
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedImages =
    sizeSort === null
      ? images
      : [...images].sort((a, b) => (sizeSort === 'asc' ? a.size - b.size : b.size - a.size));

  function toggleSizeSort() {
    setSizeSort((prev) => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : null));
  }

  async function handleDelete() {
    if (!confirm) return;
    const { type, id, label } = confirm;
    setConfirm(null);
    const url =
      type === 'image'
        ? `/api/docker/images/${encodeURIComponent(id)}`
        : `/api/docker/containers/${id}`;
    try {
      const res = await fetch(url, { method: 'DELETE', headers: authHeader });
      if (res.ok) {
        addToast(
          t(type === 'image' ? 'docker.imageDeleted' : 'docker.containerDeleted', { label })
        );
        if (type === 'image') setImages((prev) => prev.filter((i) => i.id !== id));
        else setContainers((prev) => prev.filter((c) => c.id !== id));
      } else {
        const body = await res.json().catch(() => ({}));
        addToast(body.error ?? t('error.unexpected'), 'error');
      }
    } catch {
      addToast(t('error.unexpected'), 'error');
    }
  }

  const TAB_CLS = (active: boolean) =>
    `px-4 py-2 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
      active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
    }`;

  return (
    <>
      <PageHeader
        title={t('docker.title')}
        subtitle={t('docker.subtitle', { images: images.length, containers: containers.length })}
      />

      <div className="px-6 py-5 container">
        <div className="flex gap-0 border-b border-line mb-5">
          <button className={TAB_CLS(tab === 'images')} onClick={() => setTab('images')}>
            {t('docker.tabImages')} ({images.length})
          </button>
          <button className={TAB_CLS(tab === 'containers')} onClick={() => setTab('containers')}>
            {t('docker.tabContainers')} ({containers.length})
          </button>
          <div className="ml-auto flex items-center pb-2">
            <Button size="sm" onClick={fetchData}>
              <Refresh width={12} height={12} className="mr-1.5" />
              {t('network.refresh')}
            </Button>
          </div>
        </div>

        {!loaded && tab === 'images' && (
          <div className="border border-line bg-bg-1 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-bg-2 border-line">
                  <Th>{t('docker.colId')}</Th>
                  <Th>{t('docker.colTags')}</Th>
                  <Th>{t('docker.colSize')}</Th>
                  <Th>{t('docker.colCreated')}</Th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <DockerRowSkeleton key={i} columns={4} />
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
                  <DockerRowSkeleton key={i} columns={5} />
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
                      <Th>{t('docker.colId')}</Th>
                      <Th>{t('docker.colTags')}</Th>
                      <Th sortDir={sizeSort} onSort={toggleSizeSort}>
                        {t('docker.colSize')}
                      </Th>
                      <Th>{t('docker.colCreated')}</Th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedImages.map((img, i) => (
                      <tr
                        key={img.id}
                        className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                      >
                        <Td mono>{img.shortId}</Td>
                        <Td mono>
                          {img.tags.length > 0 ? (
                            img.tags.map((t) => (
                              <span key={t} className="block">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-ink-3">{t('docker.untagged')}</span>
                          )}
                        </Td>
                        <Td>{formatBytes(img.size)}</Td>
                        <Td>{formatCreated(img.created)}</Td>
                        <td className="px-4 py-3 text-right">
                          {canManage && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() =>
                                setConfirm({
                                  type: 'image',
                                  id: img.id,
                                  label: img.tags[0] ?? img.shortId,
                                })
                              }
                            >
                              <Trash width={12} height={12} className="mr-1.5" />
                              {t('common.delete')}
                            </Button>
                          )}
                        </td>
                      </tr>
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
                      <tr
                        key={c.id}
                        className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-bg-2' : ''}`}
                      >
                        <Td mono>{c.shortId}</Td>
                        <Td mono>{c.names.join(', ')}</Td>
                        <Td mono>{c.image}</Td>
                        <td className="px-4 py-3 font-mono text-xs border-r border-line">
                          <StateBadge state={c.state} status={c.status} />
                        </td>
                        <Td>{formatCreated(c.created)}</Td>
                        <td className="px-4 py-3 text-right">
                          {canManage && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() =>
                                setConfirm({
                                  type: 'container',
                                  id: c.id,
                                  label: c.names[0] ?? c.shortId,
                                })
                              }
                            >
                              <Trash width={12} height={12} className="mr-1.5" />
                              {t('common.delete')}
                            </Button>
                          )}
                        </td>
                      </tr>
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
            { label: confirm.label }
          )}
          confirmLabel={t('docker.confirmDeleteBtn')}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function Th({
  children,
  sortDir,
  onSort,
}: {
  children: React.ReactNode;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
}) {
  return (
    <th
      onClick={onSort}
      className={`text-left px-4 py-3 font-mono border-r border-line text-[11px] text-ink-3 uppercase tracking-wider whitespace-nowrap ${
        onSort ? 'cursor-pointer select-none hover:text-ink-2' : ''
      }`}
    >
      {children}
      {onSort && (
        <span className="inline-block w-3 ml-1 text-ink-3 align-[-2px]">
          {sortDir === 'asc' && <ChevronUp width={11} height={11} />}
          {sortDir === 'desc' && <ChevronDown width={11} height={11} />}
        </span>
      )}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={`px-4 py-3 border-r border-line text-xs ${mono ? 'font-mono text-ink-2' : 'text-ink-3'}`}
    >
      {children}
    </td>
  );
}

function StateBadge({ state, status }: { state: string; status: string }) {
  const color =
    state === 'running'
      ? 'text-green-400'
      : state === 'exited' || state === 'dead'
        ? 'text-red'
        : 'text-yellow';
  return <span className={color}>{status}</span>;
}
