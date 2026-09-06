import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash } from 'pixelarticons/react';
import { useAuth } from '../../../../context/AuthContext';
import { Button } from '../../../../components/core/Button';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { useServerEvents } from '../hooks/useServerEvents';
import { useClearServerEvents } from '../hooks/useClearServerEvents';
import { SectionTitle } from './SectionTitle';
import { EventRow } from './EventRow';

export function EventHistorySection({ id, token }: { id: string; token: string | null }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const eventsQuery = useServerEvents(id, token);
  const events = eventsQuery.data;
  const clearMutation = useClearServerEvents(id, token);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <section className="border-t border-line pt-6 pb-6">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('serverDetail.infoEventHistory')}</SectionTitle>
        {hasPermission('servers:reset') && (
          <Button
            size="sm"
            variant="danger"
            className="mb-2"
            disabled={!events || events.length === 0 || clearMutation.isPending}
            onClick={() => setConfirmClear(true)}
          >
            <Trash width={12} height={12} className="mr-1.5" />
            {t('serverDetail.clear')}
          </Button>
        )}
      </div>
      {confirmClear && (
        <ConfirmModal
          title={t('serverDetail.eventHistoryClearTitle')}
          message={t('serverDetail.eventHistoryClearMessage')}
          confirmLabel={t('serverDetail.clear')}
          onConfirm={() => {
            clearMutation.mutate();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {!events ? (
        <div className="border border-line px-4 py-3 font-mono text-xs text-ink-3">
          {t('common.loading')}
        </div>
      ) : events.length === 0 ? (
        <div className="border border-line px-4 py-3 font-mono text-xs text-ink-3">
          {t('serverDetail.eventHistoryEmpty')}
        </div>
      ) : (
        <div className="divide divide-line">
          {events.map((e) => (
            <EventRow key={e.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}
