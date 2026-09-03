import { describe, it, expect, afterEach } from 'vitest';
import { createSocket } from 'dgram';
import { parseA2SInfo, queryA2S } from './playerQuery.js';

function nullTerminated(str) {
  return Buffer.concat([Buffer.from(str, 'utf8'), Buffer.from([0x00])]);
}

function buildA2SInfoResponse({
  name = 'My Server',
  map = 'world',
  folder = 'game',
  game = 'Game Name',
  appId = 440,
  players = 3,
  maxPlayers = 10,
}) {
  const appIdBuf = Buffer.alloc(2);
  appIdBuf.writeUInt16LE(appId, 0);
  return Buffer.concat([
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49]), // header + type 'I'
    Buffer.from([0x11]), // protocol
    nullTerminated(name),
    nullTerminated(map),
    nullTerminated(folder),
    nullTerminated(game),
    appIdBuf,
    Buffer.from([players, maxPlayers]),
    Buffer.from([0x00]), // trailing bytes some servers append — should be ignored
  ]);
}

describe('parseA2SInfo', () => {
  it('extracts player count and max from a well-formed A2S_INFO response', () => {
    const buf = buildA2SInfoResponse({ players: 4, maxPlayers: 12 });
    expect(parseA2SInfo(buf)).toEqual({ count: 4, max: 12 });
  });

  it('returns null for a buffer too short to be a real response', () => {
    expect(parseA2SInfo(Buffer.from([0xff, 0xff, 0xff, 0xff]))).toBeNull();
  });

  it('returns null when the type byte is not 0x49 (e.g. a challenge response)', () => {
    const challenge = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x41, 1, 2, 3, 4]);
    expect(parseA2SInfo(challenge)).toBeNull();
  });

  it('returns null for a truncated/malformed payload instead of reading out of bounds', () => {
    const buf = buildA2SInfoResponse({});
    const truncated = buf.subarray(0, 10); // cuts off mid-string, no null terminators reached
    expect(parseA2SInfo(truncated)).toBeNull();
  });

  it('handles zero players correctly (falsy but valid)', () => {
    const buf = buildA2SInfoResponse({ players: 0, maxPlayers: 10 });
    expect(parseA2SInfo(buf)).toEqual({ count: 0, max: 10 });
  });
});

describe('queryA2S', () => {
  let fakeServer;

  afterEach(() => {
    fakeServer?.close();
    fakeServer = null;
  });

  it('resolves null when nothing is listening on the port (times out)', async () => {
    const result = await queryA2S(59182, 200);
    expect(result).toBeNull();
  });

  it('follows the challenge/response handshake and returns "count / max"', async () => {
    fakeServer = createSocket('udp4');
    fakeServer.on('message', (msg, rinfo) => {
      // First request has no challenge bytes appended — reply with a challenge.
      if (msg.length === 25) {
        const challengeReply = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x41, 0xaa, 0xbb, 0xcc, 0xdd]);
        fakeServer.send(challengeReply, rinfo.port, rinfo.address);
        return;
      }
      // Retry with challenge bytes — reply with the real info packet.
      const info = buildA2SInfoResponse({ players: 7, maxPlayers: 20 });
      fakeServer.send(info, rinfo.port, rinfo.address);
    });

    await new Promise((resolve) => fakeServer.bind(0, '127.0.0.1', resolve));
    const port = fakeServer.address().port;

    const result = await queryA2S(port, 2000);
    expect(result).toBe('7 / 20');
  });
});
