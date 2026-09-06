import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Trash } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';
import { useImageDetail } from '../hooks/useImageDetail';
import type { DockerImage } from '../hooks/useDockerImages';
import { formatBytes, formatCreated } from '../format';
import { ImageDetailRow } from './ImageDetailRow';
import { Td } from './TableParts';

export function ImageRow({
  img,
  striped,
  canManage,
  onDeleteRequest,
}: {
  img: DockerImage;
  striped: boolean;
  canManage: boolean;
  onDeleteRequest: (img: DockerImage) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const detailQuery = useImageDetail(img.id, expanded);

  return (
    <Fragment>
      <tr className={`border-b border-line last:border-0 ${striped ? 'bg-bg-2' : ''}`}>
        <td className="px-2 py-3 border-r border-line text-center">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-ink-3 hover:text-ink-2 cursor-pointer bg-transparent border-0 p-0.5"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown width={12} height={12} />
            ) : (
              <ChevronRight width={12} height={12} />
            )}
          </button>
        </td>
        <Td mono>{img.shortId}</Td>
        <Td mono>
          {img.tags.length > 0 ? (
            img.tags.map((tag) => (
              <span key={tag} className="block">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-ink-3">{t('docker.untagged')}</span>
          )}
        </Td>
        <td className="px-4 py-3 font-mono text-xs border-r border-line">
          {img.inUse ? (
            <span className="text-green-400">{t('docker.inUse')}</span>
          ) : (
            <span className="text-ink-3">{t('docker.unused')}</span>
          )}
        </td>
        <Td>{formatBytes(img.size)}</Td>
        <Td>{formatCreated(img.created)}</Td>
        <td className="px-4 py-3 text-right">
          {canManage && (
            <Button size="sm" variant="danger" onClick={() => onDeleteRequest(img)}>
              <Trash width={12} height={12} className="mr-1.5" />
              {t('common.delete')}
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <ImageDetailRow
          colSpan={7}
          detail={detailQuery.data ?? null}
          loading={detailQuery.isLoading}
          error={detailQuery.isError}
        />
      )}
    </Fragment>
  );
}
