import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import docker from './docker.js';
import { getDataPath } from './gameLoader.js';
import logger from './logger.js';

function dockerStateToStatus(found) {
  const { State, Status } = found;
  if (State === 'running') return 'running';
  if (State === 'restarting') return 'restarting';
  if (State === 'dead') return 'error';
  if (State === 'exited') {
    const match = Status?.match(/Exited \((-?\d+)\)/);
    const code = match ? parseInt(match[1], 10) : 0;
    // 137 = SIGKILL (docker stop timeout), 143 = SIGTERM — both are normal admin stops
    if (code !== 0 && code !== 137 && code !== 143) return 'error';
  }
  return 'stopped';
}

function clientError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function findContainer(id) {
  const containers = await docker.listContainers({ all: true });
  return containers.find((c) => c.Names.includes(`/serverdock-${id}`)) ?? null;
}

async function imageExistsLocally(imageName) {
  try {
    await docker.getImage(imageName).inspect();
    return true;
  } catch {
    return false;
  }
}

async function pullImage(imageName) {
  await new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (pullErr) => {
        if (pullErr) return reject(pullErr);
        resolve();
      });
    });
  });
}

export async function getContainerStatus(id) {
  try {
    const found = await findContainer(id);
    if (!found) return 'not_created';
    return dockerStateToStatus(found);
  } catch {
    return 'not_created';
  }
}

export async function getContainerStartedAt(id) {
  try {
    const found = await findContainer(id);
    if (!found || found.State !== 'running') return null;
    const info = await docker.getContainer(found.Id).inspect();
    return info.State?.StartedAt ?? null;
  } catch {
    return null;
  }
}

export async function startContainer(game) {
  logger.info({ gameId: game.id }, 'container start');
  const { id } = game;

  if (game.imageSource === 'local' && !game.imageBuilt) {
    throw clientError('Build the image before starting', 400);
  }

  const existing = await findContainer(id);
  if (existing) {
    if (existing.State === 'running') throw clientError('Server is already running', 409);
    // Remove the stopped container so we recreate it with the current config
    // (image, ports, env vars, resource limits, etc. are only set at create time).
    await docker.getContainer(existing.Id).remove();
  }

  if (game.imageSource === 'public' && !(await imageExistsLocally(game.image))) {
    await pullImage(game.image);
  }

  await mkdir(getDataPath(id), { recursive: true });

  const portBindings = {};
  const exposedPorts = {};
  for (const p of game.ports) {
    const key = `${p.container}/${p.protocol}`;
    exposedPorts[key] = {};
    portBindings[key] = [{ HostPort: String(p.host) }];
  }

  const { cpuLimit, memoryLimit } = game.resources ?? {};
  const container = await docker.createContainer({
    name: `serverdock-${id}`,
    Image: game.image,
    Env: (game.environment ?? []).map((e) => `${e.key}=${e.value}`),
    OpenStdin: true,
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: [`${getDataPath(id)}:${game.dataMount ?? '/data'}`],
      RestartPolicy: { Name: 'no' },
      ...(cpuLimit    ? { NanoCpus: Math.round(cpuLimit * 1e9) }     : {}),
      ...(memoryLimit ? { Memory: memoryLimit * 1024 * 1024 }        : {}),
    },
  });

  await container.start();
}

export async function stopContainer(id) {
  logger.info({ gameId: id }, 'container stop');
  const found = await findContainer(id);
  if (!found || found.State !== 'running') throw clientError('Server is not running', 409);
  await docker.getContainer(found.Id).stop();
}

export async function restartContainer(id) {
  logger.info({ gameId: id }, 'container restart');
  const found = await findContainer(id);
  if (!found || found.State !== 'running') throw clientError('Server is not running', 409);
  await docker.getContainer(found.Id).restart();
}

// Docker containers run as root, so data files may be root-owned. Wipe via a
// temporary Alpine container instead of fs.rm, which would hit EACCES.
async function wipeDataDir(dataPath) {
  if (!(await imageExistsLocally('alpine'))) await pullImage('alpine');
  const parentPath = dirname(dataPath);
  await new Promise((resolve, reject) => {
    docker.run(
      'alpine',
      ['sh', '-c', 'rm -rf /mnt/data && mkdir /mnt/data'],
      null,
      { HostConfig: { Binds: [`${parentPath}:/mnt`], AutoRemove: true } },
      (err, data) => {
        if (err) return reject(err);
        if (data?.StatusCode !== 0)
          return reject(new Error(`Data wipe exited with code ${data?.StatusCode}`));
        resolve();
      }
    );
  });
}

export async function resetContainer(id) {
  logger.info({ gameId: id }, 'container reset');
  const found = await findContainer(id);
  if (found) {
    if (found.State === 'running') await docker.getContainer(found.Id).stop();
    await docker.getContainer(found.Id).remove();
  }
  await wipeDataDir(getDataPath(id));
}
