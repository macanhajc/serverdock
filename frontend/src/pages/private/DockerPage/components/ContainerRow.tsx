import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Trash } from 'pixelarticons/react';
import { Button } from '../../../../components/core/Button';
import { useContainerDetail } from '../hooks/useContainerDetail';
import type { DockerContainer } from '../hooks/useDockerContainers';
import { formatCreated } from '../format';
import { ContainerDetailRow } from './ContainerDetailRow';
import { Td, StateBadge } from './TableParts';

export function ContainerRow({
  container,
  striped,
  canManage,
  onDeleteRequest,
}: {
  container: DockerContainer;
  striped: boolean;
  canManage: boolean;
  onDeleteRequest: (container: DockerContainer) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const detailQuery = useContainerDetail(container.id, expanded);

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
        <Td mono>{container.shortId}</Td>
        <Td mono>{container.names.join(', ')}</Td>
        <Td mono>{container.image}</Td>
        <td className="px-4 py-3 font-mono text-xs border-r border-line">
          <StateBadge state={container.state} status={container.status} />
        </td>
        <Td>{formatCreated(container.created)}</Td>
        <td className="px-4 py-3 text-right">
          {canManage && (
            <Button size="sm" variant="danger" onClick={() => onDeleteRequest(container)}>
              <Trash width={12} height={12} className="mr-1.5" />
              {t('common.delete')}
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <ContainerDetailRow
          colSpan={7}
          detail={detailQuery.data ?? null}
          loading={detailQuery.isLoading}
          error={detailQuery.isError}
        />
      )}
    </Fragment>
  );
}
