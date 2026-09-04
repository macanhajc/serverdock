import type { NetworkProviderId } from '../types';

export interface NetworkProviderMeta {
  id: NetworkProviderId;
  // Brand name — not translated.
  label: string;
  // i18n key for a one-line explanation, shown in Settings and the setup wizard.
  descriptionKey: string;
}

export const networkProviders: NetworkProviderMeta[] = [
  { id: 'netbird', label: 'NetBird', descriptionKey: 'networkProviders.netbird' },
  { id: 'tailscale', label: 'Tailscale', descriptionKey: 'networkProviders.tailscale' },
  { id: 'wireguard', label: 'WireGuard', descriptionKey: 'networkProviders.wireguard' },
  { id: 'zerotier', label: 'ZeroTier', descriptionKey: 'networkProviders.zerotier' },
  { id: 'manual', label: 'Manual', descriptionKey: 'networkProviders.manual' },
];

export function getNetworkProvider(id?: NetworkProviderId | string | null): NetworkProviderMeta {
  return networkProviders.find((p) => p.id === id) ?? networkProviders[networkProviders.length - 1];
}

export function getNetworkProviderLabel(id?: NetworkProviderId | string | null): string {
  return getNetworkProvider(id).label;
}
