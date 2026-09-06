import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { verifyToken } from './auth.js';
import { revokeToken } from '../lib/tokenRevocation.js';

function sign(payload, opts) {
  return jwt.sign({ jti: randomUUID(), ...payload }, process.env.JWT_SECRET, {
    expiresIn: '1h',
    ...opts,
  });
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('verifyToken', () => {
  it('rejects a request with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid token' });
  });

  it('rejects a header that is not "Bearer <token>"', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a garbage/tampered token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-jwt' } };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('rejects an expired token', () => {
    const token = sign({ sub: 'admin-1', role: 'admin' }, { expiresIn: '-10s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts a valid token and attaches the decoded payload as req.user', () => {
    const token = sign({ sub: 'admin-1', username: 'alice', role: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ sub: 'admin-1', username: 'alice', role: 'admin' });
  });

  it('rejects a token whose jti has been revoked, even though the JWT itself is still valid', () => {
    const jti = randomUUID();
    const token = sign({ sub: 'admin-1', role: 'admin', jti });
    revokeToken(jti, Date.now() / 1000 + 3600);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    verifyToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });
});
