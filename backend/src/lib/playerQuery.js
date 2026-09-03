import { createSocket } from 'dgram';

// A2S_INFO request: header + "Source Engine Query\0"
const A2S_INFO_REQUEST = Buffer.concat([
  Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
  Buffer.from('Source Engine Query\0'),
]);

// Exported for direct unit testing — pure buffer parsing.
export function parseA2SInfo(buf) {
  // FF FF FF FF 49 [protocol] [name\0] [map\0] [folder\0] [game\0] [appid 2B] [players] [maxPlayers]
  if (buf.length < 12 || buf[4] !== 0x49) return null;
  let offset = 6; // past header(4) + type(1) + protocol(1)
  for (let i = 0; i < 4; i++) {
    while (offset < buf.length && buf[offset] !== 0x00) offset++;
    offset++; // skip null terminator
  }
  offset += 2; // skip 2-byte appID
  if (offset + 1 >= buf.length) return null;
  return { count: buf[offset], max: buf[offset + 1] };
}

// Query an A2S-compatible server running on localhost.
// Returns "N / Max" string, or null on error/timeout.
export function queryA2S(port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    socket.on('error', () => finish(null));

    socket.on('message', (msg) => {
      if (done || msg.length < 5) return;

      // Challenge response — resend with challenge bytes appended
      if (msg[4] === 0x41 && msg.length >= 9) {
        const withChallenge = Buffer.concat([A2S_INFO_REQUEST, msg.slice(5, 9)]);
        socket.send(withChallenge, port, '127.0.0.1');
        return;
      }

      // Info response
      if (msg[4] === 0x49) {
        const info = parseA2SInfo(msg);
        finish(info ? `${info.count} / ${info.max}` : null);
      }
    });

    socket.send(A2S_INFO_REQUEST, port, '127.0.0.1');
  });
}

// In-process player count cache: gameId → "N / Max" | null
const cache = new Map();
export const getPlayers = (id) => cache.get(id) ?? null;
export const setPlayers = (id, v) => cache.set(id, v);

// In-process RCON player-list cache: gameId → raw command response text | null.
// Whatever the game's own listCommand prints — there's no universal format to
// parse across titles, so this is shown as-is rather than turned into a
// structured name list.
const listCache = new Map();
export const getPlayerList = (id) => listCache.get(id) ?? null;
export const setPlayerList = (id, v) => listCache.set(id, v);
