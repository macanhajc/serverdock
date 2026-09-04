import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../context/AuthContext';

export interface SaveGamePayload {
  isEdit: boolean;
  id: string | undefined;
  slug: string;
  gameData: unknown;
  dockerfile: string;
  imageSource: string;
  avatarFile: File | null;
  removeAvatar: boolean;
  buildAfter: boolean;
  // Fired the instant the base config record is saved — the caller uses
  // this to clear its "unsaved changes" flag right then, since everything
  // past this point (dockerfile/avatar/build) can still fail without there
  // being anything left to "discard".
  onConfigSaved: () => void;
}

export interface SaveGameResult {
  targetId: string;
  built: boolean;
}

export function useSaveGame() {
  const { t } = useTranslation();
  const { token } = useAuth();

  return useMutation({
    mutationFn: async ({
      isEdit,
      id,
      slug,
      gameData,
      dockerfile,
      imageSource,
      avatarFile,
      removeAvatar,
      buildAfter,
      onConfigSaved,
    }: SaveGamePayload): Promise<SaveGameResult> => {
      const url = isEdit ? `/api/games/${id}` : '/api/games';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData),
      }).catch(() => null);

      if (!res || !res.ok) {
        const data = await res?.json().catch(() => ({}));
        throw new Error(data?.error ?? t('gameForm.errSaveFailed'));
      }

      // The config record is saved past this point — dockerfile/avatar/build
      // substeps below can still fail, but there's nothing left to "discard".
      onConfigSaved();

      const targetId = isEdit ? id! : slug;

      if (imageSource === 'local' && dockerfile.trim()) {
        const dfRes = await fetch(`/api/games/${targetId}/dockerfile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: dockerfile }),
        }).catch(() => null);

        if (!dfRes || !dfRes.ok) {
          const data = await dfRes?.json().catch(() => ({}));
          throw new Error(data?.error ?? t('gameForm.errDockerfileFailed'));
        }
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarRes = await fetch(`/api/games/${targetId}/avatar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }).catch(() => null);

        if (!avatarRes || !avatarRes.ok) {
          const data = await avatarRes?.json().catch(() => ({}));
          throw new Error(data?.error ?? t('gameForm.errAvatarFailed'));
        }
      } else if (removeAvatar && isEdit) {
        await fetch(`/api/games/${targetId}/avatar`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
      }

      if (!buildAfter) {
        return { targetId, built: false };
      }

      const buildRes = await fetch(`/api/games/${targetId}/build`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      if (!buildRes || !buildRes.ok) {
        const data = await buildRes?.json().catch(() => ({}));
        throw new Error(data?.error ?? t('gameForm.errBuildFailed'));
      }

      return { targetId, built: true };
    },
  });
}
