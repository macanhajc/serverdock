import { describe, it, expect, beforeEach, vi } from 'vitest';

const netbirdStatus = vi.fn();
const manualStatus = vi.fn();

vi.mock('./providers/netbird.js', () => ({
  id: 'netbird',
  label: 'NetBird',
  getStatus: (...args) => netbirdStatus(...args),
}));
vi.mock('./providers/tailscale.js', () => ({
  id: 'tailscale',
  label: 'Tailscale',
  getStatus: vi.fn(async () => ({ self: null, peers: [] })),
}));
vi.mock('./providers/wireguard.js', () => ({
  id: 'wireguard',
  label: 'WireGuard',
  getStatus: vi.fn(async () => ({ self: null, peers: [] })),
}));
vi.mock('./providers/zerotier.js', () => ({
  id: 'zerotier',
  label: 'ZeroTier',
  getStatus: vi.fn(async () => ({ self: null, peers: [] })),
}));
vi.mock('./providers/manual.js', () => ({
  id: 'manual',
  label: 'Manual',
  getStatus: (...args) => manualStatus(...args),
}));

const { saveSettings } = await import('../settingsStore.js');
const { getVpnStatus, getSelfIp, invalidateVpnCache } = await import('./index.js');

beforeEach(async () => {
  netbirdStatus.mockReset().mockResolvedValue({
    self: { name: 'me', ip: '100.64.0.1', online: true },
    peers: [],
  });
  manualStatus.mockReset().mockResolvedValue({ self: null, peers: [] });
  invalidateVpnCache();
  await saveSettings({ networkProvider: 'netbird' });
});

describe('vpn/index dispatcher', () => {
  it('dispatches to the provider named in settings', async () => {
    const status = await getVpnStatus();
    expect(status.provider).toBe('netbird');
    expect(status.self.ip).toBe('100.64.0.1');
    expect(netbirdStatus).toHaveBeenCalledTimes(1);
  });

  it('falls back to manual for an unknown provider id', async () => {
    await saveSettings({ networkProvider: 'made-up' });
    const status = await getVpnStatus();
    expect(status.provider).toBe('manual');
    expect(manualStatus).toHaveBeenCalledTimes(1);
  });

  it('caches within the TTL instead of calling the provider again', async () => {
    await getVpnStatus();
    await getVpnStatus();
    expect(netbirdStatus).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when the provider changes', async () => {
    await getVpnStatus();
    await saveSettings({ networkProvider: 'manual' });
    await getVpnStatus();
    expect(netbirdStatus).toHaveBeenCalledTimes(1);
    expect(manualStatus).toHaveBeenCalledTimes(1);
  });

  it('getSelfIp returns null when self is null', async () => {
    await saveSettings({ networkProvider: 'manual' });
    const ip = await getSelfIp();
    expect(ip).toBeNull();
  });
});
