import { Rcon } from 'rcon-client';
import docker from './docker.js';

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

  const rcon = new Rcon({ host: ip, port: game.rcon.port, password: game.rcon.password, timeout: 5000 });
  await rcon.connect();
  try {
    return await rcon.send(command);
  } finally {
    await rcon.end().catch(() => {});
  }
}
