import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../context/AuthContext';

export function useDeleteGame() {
  const { t } = useTranslation();
  const { token } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/games/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      if (!res || !res.ok) {
        const data = await res?.json().catch(() => ({}));
        throw new Error(data?.error ?? t('gameForm.errDeleteFailed'));
      }
    },
  });
}
