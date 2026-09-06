import { describe, it, expect } from 'vitest';
import { encodePacket, readPacket } from './rcon.js';

describe('encodePacket / readPacket round trip', () => {
  it('recovers id, type, and payload exactly, consuming the whole buffer', () => {
    const buf = encodePacket(1, 2, 'players');
    const { packet, rest } = readPacket(buf);

    expect(packet).toEqual({ id: 1, type: 2, payload: 'players' });
    expect(rest.length).toBe(0);
  });

  it('round-trips a negative id (used by the spec to signal auth failure)', () => {
    const buf = encodePacket(-1, 2, '');
    const { packet } = readPacket(buf);

    expect(packet.id).toBe(-1);
    expect(packet.payload).toBe('');
  });

  it('round-trips an empty payload (leading placeholder packets some servers send)', () => {
    const buf = encodePacket(0, 2, '');
    const { packet } = readPacket(buf);

    expect(packet.payload).toBe('');
  });

  it('round-trips a multi-byte UTF-8 payload without mangling it', () => {
    const buf = encodePacket(1, 0, 'saved 🎮 world');
    const { packet } = readPacket(buf);

    expect(packet.payload).toBe('saved 🎮 world');
  });
});

describe('readPacket framing', () => {
  it('returns null on an empty buffer', () => {
    expect(readPacket(Buffer.alloc(0))).toBeNull();
  });

  it('returns null when fewer than 4 bytes have arrived (can\'t even read the size)', () => {
    expect(readPacket(Buffer.from([1, 2, 3]))).toBeNull();
  });

  it('returns null for a partial packet — declared size larger than what has arrived', () => {
    const full = encodePacket(1, 2, 'a long enough payload to matter');
    const partial = full.subarray(0, full.length - 5);
    expect(readPacket(partial)).toBeNull();
  });

  it('leaves trailing bytes after the packet in `rest` untouched', () => {
    const packetBuf = encodePacket(1, 2, 'hello');
    const trailer = Buffer.from([9, 9, 9]);
    const combined = Buffer.concat([packetBuf, trailer]);

    const { packet, rest } = readPacket(combined);

    expect(packet.payload).toBe('hello');
    expect(rest).toEqual(trailer);
  });

  it('extracts two concatenated packets one at a time, mirroring the real read loop', () => {
    const combined = Buffer.concat([
      encodePacket(1, 2, 'first'),
      encodePacket(2, 2, 'second'),
    ]);

    const results = [];
    let buf = combined;
    let parsed;
    while ((parsed = readPacket(buf))) {
      results.push(parsed.packet);
      buf = parsed.rest;
    }

    expect(results).toEqual([
      { id: 1, type: 2, payload: 'first' },
      { id: 2, type: 2, payload: 'second' },
    ]);
    expect(buf.length).toBe(0);
  });
});
