import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { revokeToken, isRevoked } from './tokenRevocation.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('isRevoked', () => {
  it('is false for a jti that was never revoked', () => {
    expect(isRevoked('never-seen')).toBe(false);
  });

  it('is false for null/undefined jti', () => {
    expect(isRevoked(null)).toBe(false);
    expect(isRevoked(undefined)).toBe(false);
  });

  it('is true right after revokeToken, before expiry', () => {
    const futureExp = Date.now() / 1000 + 3600; // 1h from now
    revokeToken('jti-active', futureExp);
    expect(isRevoked('jti-active')).toBe(true);
  });

  it('treats revoking a null/undefined jti as a no-op', () => {
    expect(() => revokeToken(null, Date.now() / 1000 + 3600)).not.toThrow();
    expect(isRevoked(null)).toBe(false);
  });
});

describe('expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('stops reporting a token as revoked once its exp has passed, matching the JWT’s own lifetime', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const exp = Date.now() / 1000 + 60; // revoked entry expires in 60s
    revokeToken('jti-expiring', exp);
    expect(isRevoked('jti-expiring')).toBe(true);

    vi.setSystemTime(new Date('2026-01-01T00:02:00Z')); // +120s, past exp
    expect(isRevoked('jti-expiring')).toBe(false);
  });

  it('prunes the expired entry so a later lookup does not just get lucky on timing', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const exp = Date.now() / 1000 + 60;
    revokeToken('jti-pruned', exp);

    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'));
    expect(isRevoked('jti-pruned')).toBe(false); // triggers the lazy prune

    // Time moves back within the original window — if the entry were still
    // sitting in the map this would read true again. Pruning must be real.
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    expect(isRevoked('jti-pruned')).toBe(false);
  });
});
