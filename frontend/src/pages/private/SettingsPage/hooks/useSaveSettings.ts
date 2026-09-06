import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { NetworkProviderId } from '../../../../types';
import { settingsFetch } from './settingsApi';
import { settingsKeys } from './queryKeys';
import type { SettingsData } from './useSettings';

export interface SaveSettingsPayload {
  serverHost: string;
  networkProvider: NetworkProviderId;
  wireguardInterface: string;
  registrationOpen: boolean;
  dataRoot: string;
  discordWebhookUrl: string;
}

export function useSaveSettings() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSettingsPayload) =>
      settingsFetch<Partial<SaveSettingsPayload>>('/api/settings', token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    // The PUT response only echoes the saved fields, not defaultDataRoot/
    // vapidPublicKey — merge onto the existing cache entry rather than
    // replacing it so those two don't get wiped out.
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.get, (prev: SettingsData | undefined) => ({
        ...(prev as SettingsData),
        ...data,
      }));
    },
  });
}
