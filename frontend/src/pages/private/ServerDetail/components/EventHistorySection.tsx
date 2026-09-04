import { useTranslation } from 'react-i18next';
import { useServerEvents } from '../hooks/useServerEvents';
import { SectionTitle } from './SectionTitle';
import { EventRow } from './EventRow';

export function EventHistorySection({ id, token }: { id: string; token: string | null }) {
  const { t } = useTranslation();
  const eventsQuery = useServerEvents(id, token);
  const events = eventsQuery.data;

  return (
    <section className="border-t border-line pt-6 pb-6">
      <SectionTitle>{t('serverDetail.infoEventHistory')}</SectionTitle>
      {!events ? (
        <div className="border border-line px-4 py-3 font-mono text-xs text-ink-3">
          {t('common.loading')}
        </div>
      ) : events.length === 0 ? (
        <div className="border border-line px-4 py-3 font-mono text-xs text-ink-3">
          {t('serverDetail.eventHistoryEmpty')}
        </div>
      ) : (
        <div className="border border-line divide-y divide-line">
          {events.map((e) => (
            <EventRow key={e.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}
