import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit } from './rateLimit.js';

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

function reqFrom(ip) {
  return { ip, socket: {} };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows requests up to the max within the window', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const req = reqFrom('1.1.1.1');

    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it('blocks the request past max with 429 and a Retry-After header', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    const req = reqFrom('2.2.2.2');

    limiter(req, mockRes(), vi.fn());
    limiter(req, mockRes(), vi.fn());

    const res = mockRes();
    const next = vi.fn();
    limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests, try again later' });
    expect(res.set).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('resets the count once the window has elapsed', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    const req = reqFrom('3.3.3.3');

    limiter(req, mockRes(), vi.fn());
    const blockedRes = mockRes();
    limiter(req, blockedRes, vi.fn());
    expect(blockedRes.status).toHaveBeenCalledWith(429);

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z')); // past the 60s window

    const res = mockRes();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('tracks separate buckets per key, so one IP cannot exhaust another\'s quota', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });

    limiter(reqFrom('4.4.4.1'), mockRes(), vi.fn());

    const res = mockRes();
    const next = vi.fn();
    limiter(reqFrom('4.4.4.2'), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('falls back to req.socket.remoteAddress when req.ip is missing', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    const req = { socket: { remoteAddress: '5.5.5.5' } };

    limiter(req, mockRes(), vi.fn());
    const res = mockRes();
    const next = vi.fn();
    limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('falls back to a shared "unknown" key when neither ip nor remoteAddress is available', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });

    limiter({ socket: {} }, mockRes(), vi.fn());
    const res = mockRes();
    const next = vi.fn();
    limiter({ socket: {} }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
