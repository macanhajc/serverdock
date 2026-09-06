import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import type { NetworkProviderId } from '../../../../types';
import { settingsFetch } from './settingsApi';
import { settingsKeys } from './queryKeys';

export interface SettingsData {
  serverHost: string;
  networkProvider: NetworkProviderId;
  wireguardInterface: string;
  registrationOpen: boolean;
  dataRoot: string;
  discordWebhookUrl: string;
  defaultDataRoot: string;
  vapidPublicKey: string;
}

// Normalizes the raw response the same way the page always has, so a fresh
// install (no settings saved yet) still gets sane defaults instead of
// undefined fields leaking into form state.
function normalize(data: Partial<SettingsData> | undefined): SettingsData {
  return {
    serverHost: data?.serverHost ?? '',
    networkProvider: data?.networkProvider ?? 'netbird',
    wireguardInterface: data?.wireguardInterface ?? 'wg0',
    registrationOpen: data?.registrationOpen ?? true,
    dataRoot: data?.dataRoot ?? '',
    discordWebhookUrl: data?.discordWebhookUrl ?? '',
    defaultDataRoot: data?.defaultDataRoot ?? '',
    vapidPublicKey: data?.vapidPublicKey ?? '',
  };
}

export function useSettings() {
  const { token } = useAuth();
  return useQuery({
    queryKey: settingsKeys.get,
    queryFn: async () => normalize(await settingsFetch<Partial<SettingsData>>('/api/settings', token)),
    enabled: !!token,
  });
}
