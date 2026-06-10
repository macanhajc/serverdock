import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import docker from './docker.js';
import { getDataPath, getGame } from './gameLoader.js';
import {
  setTransient,
  settleTransient,
  emitPullProgress,
  emitServerEvent,
  getTransient,
  markAdminStop,
  clearAdminStop,
  hasAdminStop,
} from './statusBus.js';
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

async function pullImage(imageName, onProgress) {
  await new Promise((resolve, reject) => {
    docker.pull(imageName, (err, stream) => {
      if (err) return reject(err);

      // Aggregate per-layer progress into one {phase, percent} for the UI.
      const layers = new Map(); // layerId -> { dlCur, dlTot, exCur, exTot }
      let lastReported = '';
      const report = (event) => {
        if (!onProgress || !event.id) return;
        const layer = layers.get(event.id) ?? { dlCur: 0, dlTot: 0, exCur: 0, exTot: 0 };
        const d = event.progressDetail;
        if (event.status === 'Downloading' && d?.total) {
          layer.dlCur = d.current;
          layer.dlTot = d.total;
        } else if (event.status === 'Extracting' && d?.total) {
          layer.exCur = d.current;
          layer.exTot = d.total;
          layer.dlCur = layer.dlTot || layer.dlCur;
        } else if (event.status === 'Pull complete') {
          layer.dlCur = layer.dlTot || layer.dlCur;
          layer.exCur = layer.exTot || layer.exCur;
        }
        layers.set(event.id, layer);

        let dlCur = 0, dlTot = 0, exCur = 0, exTot = 0;
        for (const l of layers.values()) {
          dlCur += l.dlCur;
          dlTot += l.dlTot;
          exCur += l.exCur;
          exTot += l.exTot;
        }
        const downloading = dlTot > 0 && dlCur < dlTot;
        const phase = downloading ? 'downloading' : 'extracting';
        const percent = downloading
          ? Math.floor((dlCur / dlTot) * 100)
          : exTot > 0
            ? Math.floor((exCur / exTot) * 100)
            : 0;
        const key = `${phase}:${percent}`;
        if (key !== lastReported) {
          lastReported = key;
          onProgress({ phase, percent });
        }
      };

      docker.modem.followProgress(
        stream,
        (pullErr) => (pullErr ? reject(pullErr) : resolve()),
        report
      );
    });
  });
}

// On failure: settle to the real Docker state and tell every admin client what broke.
// The thrown error still reaches the acting client through the HTTP response.
async function reportActionFailure(id, action, err) {
  logger.error({ err, gameId: id, action }, 'container action failed');
  settleTransient(id, await getContainerStatus(id));
  emitServerEvent({
    type: 'action_failed',
    id,
    name: getGame(id)?.name ?? id,
    action,
    message: err.message,
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

// What clients should see: an in-flight operation state wins over Docker state,
// and an admin-initiated stop is never presented as a crash.
export async function getEffectiveStatus(id) {
  const t = getTransient(id);
  if (t) return t;
  let status = await getContainerStatus(id);
  if (status === 'error' && hasAdminStop(id)) status = 'stopped';
  return status;
}

export async function getContainerExitInfo(id) {
  try {
    const info = await docker.getContainer(`serverdock-${id}`).inspect();
    const s = info.State ?? {};
    return {
      exitCode: typeof s.ExitCode === 'number' ? s.ExitCode : null,
      oomKilled: !!s.OOMKilled,
      error: s.Error || null,
      finishedAt: s.FinishedAt ?? null,
    };
  } catch {
    return null;
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
  if (existing && existing.State === 'running') {
    throw clientError('Server is already running', 409);
  }

  // A new start supersedes any earlier stop intent — a later exit must alert again
  clearAdminStop(id);
  setTransient(id, 'starting');
  try {
    if (existing) {
      // Remove the stopped container so we recreate it with the current config
      // (image, ports, env vars, resource limits, etc. are only set at create time).
      await docker.getContainer(existing.Id).remove();
    }

    if (game.imageSource === 'public' && !(await imageExistsLocally(game.image))) {
      setTransient(id, 'pulling');
      await pullImage(game.image, (progress) => emitPullProgress(id, progress));
      setTransient(id, 'starting');
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
    settleTransient(id, 'running');
  } catch (err) {
    await reportActionFailure(id, 'start', err);
    throw err;
  }
}

export async function stopContainer(id) {
  logger.info({ gameId: id }, 'container stop');
  const found = await findContainer(id);
  if (!found || found.State !== 'running') throw clientError('Server is not running', 409);
  markAdminStop(id);
  setTransient(id, 'stopping');
  try {
    await docker.getContainer(found.Id).stop();
    settleTransient(id, 'stopped');
  } catch (err) {
    clearAdminStop(id); // stop didn't happen — a later exit is still a crash
    await reportActionFailure(id, 'stop', err);
    throw err;
  }
}

// Send a single command to the container's stdin via a short-lived, stdin-only
// attach (stdout/stderr stay off — output is observed through the log stream).
// One attach per command keeps it stateless: no persistent stream to leak.
export async function sendStdinCommand(id, command) {
  const container = docker.getContainer(`serverdock-${id}`);
  const stream = await new Promise((resolve, reject) => {
    container.attach(
      { stream: true, stdin: true, stdout: false, stderr: false },
      (err, s) => (err ? reject(err) : resolve(s))
    );
  });
  try {
    stream.write(`${command}\n`);
  } finally {
    stream.end();
  }
}

export async function restartContainer(id) {
  logger.info({ gameId: id }, 'container restart');
  const found = await findContainer(id);
  if (!found || found.State !== 'running') throw clientError('Server is not running', 409);
  setTransient(id, 'restarting');
  try {
    await docker.getContainer(found.Id).restart();
    settleTransient(id, 'running');
  } catch (err) {
    await reportActionFailure(id, 'restart', err);
    throw err;
  }
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
  markAdminStop(id);
  setTransient(id, 'stopping');
  try {
    const found = await findContainer(id);
    if (found) {
      if (found.State === 'running') await docker.getContainer(found.Id).stop();
      await docker.getContainer(found.Id).remove();
    }
    await wipeDataDir(getDataPath(id));
    settleTransient(id, 'not_created');
  } catch (err) {
    clearAdminStop(id);
    await reportActionFailure(id, 'reset', err);
    throw err;
  }
}
