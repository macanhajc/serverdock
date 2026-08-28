import net from 'net';
import docker from './docker.js';

const PACKET_AUTH = 3;
const PACKET_AUTH_RESPONSE = 2;
const PACKET_COMMAND = 2;
const PACKET_COMMAND_RESPONSE = 0;

function encodePacket(id, type, payload) {
  const body = Buffer.from(payload, 'utf8');
  const size = 4 + 4 + body.length + 2;
  const buf = Buffer.alloc(4 + size);
  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  body.copy(buf, 12);
  buf.writeInt16LE(0, 12 + body.length);
  return buf;
}

// Pulls one length-prefixed packet off the front of buf, if a full one has arrived.
function readPacket(buf) {
  if (buf.length < 4) return null;
  const size = buf.readInt32LE(0);
  const total = 4 + size;
  if (buf.length < total) return null;
  return {
    packet: {
      id: buf.readInt32LE(4),
      type: buf.readInt32LE(8),
      payload: buf.subarray(12, total - 2).toString('utf8'),
    },
    rest: buf.subarray(total),
  };
}

export async function sendRconCommand(game, command) {
  const container = docker.getContainer(`serverdock-${game.id}`);
  const info = await container.inspect();

  // Prefer default bridge IP; fall back to first named network
  let ip = info.NetworkSettings.IPAddress;
  if (!ip) {
    const nets = Object.values(info.NetworkSettings.Networks ?? {});
    ip = nets[0]?.IPAddress;
  }
  if (!ip) throw new Error('Cannot determine container IP');

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: ip, port: game.rcon.port });
    let buf = Buffer.alloc(0);
    let authenticated = false;
    let settled = false;

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err); else resolve(value);
    };

    socket.setTimeout(5000, () => finish(new Error('RCON connection timed out')));
    socket.on('error', (err) => finish(err));
    socket.on('close', () => finish(new Error('RCON connection closed')));
    socket.on('connect', () => socket.write(encodePacket(0, PACKET_AUTH, game.rcon.password)));

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let parsed;
      while ((parsed = readPacket(buf))) {
        buf = parsed.rest;
        const { packet } = parsed;

        if (!authenticated) {
          // The spec signals a bad password via id === -1 on the AuthResponse
          // packet, but some bridges (e.g. HumanitZ's) put -1 in the type
          // field instead — check both. Servers also send a leading empty
          // placeholder packet before the real AuthResponse; skip anything
          // that isn't one of those two signals.
          if (packet.id === -1 || packet.type === -1) return finish(new Error('RCON authentication failed'));
          if (packet.type !== PACKET_AUTH_RESPONSE) continue;
          authenticated = true;
          socket.write(encodePacket(1, PACKET_COMMAND, command));
          continue;
        }

        // Match on packet type, not id: some RCON bridges (e.g. HumanitZ's)
        // always echo back id 0 instead of the request's id. Safe here since
        // only one command is ever in flight per connection.
        if (packet.type === PACKET_COMMAND_RESPONSE) {
          return finish(null, packet.payload);
        }
      }
    });
  });
}
