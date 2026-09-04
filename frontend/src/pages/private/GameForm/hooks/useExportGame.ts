import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../context/AuthContext';

// Config + Dockerfile only — no data/, no avatar image bytes. Lets an admin
// version or migrate a game's definition independently of its data backups.
export function useExportGame() {
  const { t } = useTranslation();
  const { token } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      let res: Response;
      try {
        res = await fetch(`/api/games/${id}/export`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        throw new Error(t('gameForm.errExportFailed'));
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? t('gameForm.errExportFailed'));
      }
      try {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${id}.serverdock.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        throw new Error(t('gameForm.errExportFailed'));
      }
    },
  });
}
