import { describe, it, expect, beforeEach } from 'vitest';
import db from './db.js';
import { getBlockedIps, isIpBlocked, blockIp, unblockIp } from './blocklistStore.js';

beforeEach(() => {
  db.exec('DELETE FROM blocked_ips;');
});

describe('isIpBlocked', () => {
  it('is false for an ip that was never blocked', () => {
    expect(isIpBlocked('1.2.3.4')).toBe(false);
  });

  it('is false for a falsy ip without touching the database', () => {
    expect(isIpBlocked(null)).toBe(false);
    expect(isIpBlocked('')).toBe(false);
  });

  it('is true once blocked', async () => {
    await blockIp('1.2.3.4');
    expect(isIpBlocked('1.2.3.4')).toBe(true);
  });
});

describe('blockIp', () => {
  it('is idempotent — blocking the same ip twice does not error or duplicate', async () => {
    await blockIp('5.6.7.8');
    await blockIp('5.6.7.8');
    expect(getBlockedIps().filter((r) => r.ip === '5.6.7.8')).toHaveLength(1);
  });

  it('is a no-op for a falsy ip', async () => {
    await blockIp(null);
    expect(getBlockedIps()).toEqual([]);
  });
});

describe('unblockIp', () => {
  it('removes the ip and reports true', async () => {
    await blockIp('9.9.9.9');
    expect(await unblockIp('9.9.9.9')).toBe(true);
    expect(isIpBlocked('9.9.9.9')).toBe(false);
  });

  it('reports false when the ip was not blocked', async () => {
    expect(await unblockIp('not-blocked')).toBe(false);
  });
});

describe('getBlockedIps', () => {
  it('lists most-recently-blocked first', async () => {
    await blockIp('1.1.1.1');
    await new Promise((r) => setTimeout(r, 20));
    await blockIp('2.2.2.2');

    expect(getBlockedIps().map((r) => r.ip)).toEqual(['2.2.2.2', '1.1.1.1']);
  });
});
