import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export function useTriggerBuild(id: string, token: string | null) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      let res: Response;
      try {
        res = await fetch(`/api/games/${id}/build`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        throw new Error(t('serverDetail.buildStartFailed'));
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t('serverDetail.buildStartFailed'));
    },
  });
}
