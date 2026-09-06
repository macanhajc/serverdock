import { useTranslation } from 'react-i18next';
import type { Server } from '../../types';
import { getActiveIssues } from '../../utils/serverStatus';
import { timeAgo } from '../../utils/format';
import { AlertBadge } from './AlertBadge';

interface ServerIssuesBadgeProps {
  server: Pick<Server, 'lastCrash' | 'actionFailure' | 'resourceAlert'>;
}

// Renders nothing if the server has no active issues. Color/title reflect
// the worst thing currently going on — red if the server actually failed to
// run (crash or a failed start/restart), yellow if it's merely under
// resource pressure while running fine — but every distinct active issue
// still gets its own line in the popover, not just the worst one.
export function ServerIssuesBadge({ server }: ServerIssuesBadgeProps) {
  const { t } = useTranslation();
  const issues = getActiveIssues(server, t);
  if (issues.length === 0) return null;

  const color = issues.some((i) => i.severity === 'red') ? 'var(--red)' : 'var(--yellow)';

  return (
    <AlertBadge
      color={color}
      badgeTitle={t('serverIssues.badgeTitle')}
      panelTitle={t('serverIssues.panelTitle')}
      issues={issues.map((issue) => ({
        key: issue.key,
        text: issue.text,
        sinceLabel: timeAgo(issue.since, t),
      }))}
    />
  );
}
