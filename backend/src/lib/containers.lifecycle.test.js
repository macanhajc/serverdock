import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// containers.js talks to Docker and to the on-disk game config through two
// narrow seams (docker.js, gameLoader.js) — mock exactly those two module
// boundaries and let everything else (statusBus, logBuffer) run for real,
// since neither touches the filesystem or network without a socket.io
// instance installed (see statusBus.test.js / logBuffer.test.js).
const { dockerMock, containerMock, imageMock, streamMock, gameLoaderMock } = vi.hoisted(() => ({
  dockerMock: {
    listContainers: vi.fn(),
    getContainer: vi.fn(),
    createContainer: vi.fn(),
    getImage: vi.fn(),
    pull: vi.fn(),
    run: vi.fn(),
    modem: { followProgress: vi.fn() },
  },
  containerMock: {
    inspect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    remove: vi.fn(),
    attach: vi.fn(),
  },
  imageMock: { inspect: vi.fn(), distribution: vi.fn() },
  streamMock: { write: vi.fn(), end: vi.fn() },
  gameLoaderMock: { getDataPath: vi.fn(), getGame: vi.fn() },
}));

vi.mock('./docker.js', () => ({ default: dockerMock }));
vi.mock('./gameLoader.js', () => gameLoaderMock);

const {
  getEffectiveStatus,
  getEffectiveStatuses,
  getContainerStatus,
  getContainerExitInfo,
  getContainerTimestamps,
  startContainer,
  stopContainer,
  restartContainer,
  resetContainer,
  sendStdinCommand,
} = await import('./containers.js');
const { getTransient, getLastKnown, hasAdminStop, setTransient } = await import('./statusBus.js');

let tempRoot;

beforeAll(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'serverdock-containers-test-'));
});

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

function fakeId() {
  return `game-${randomUUID()}`;
}

function fakeGame(overrides = {}) {
  const id = fakeId();
  return {
    id,
    name: id,
    imageSource: 'public',
    image: 'someimage:latest',
    ports: [{ container: 25565, host: 25565, protocol: 'tcp' }],
    environment: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  dockerMock.listContainers.mockResolvedValue([]);
  dockerMock.getContainer.mockReturnValue(containerMock);
  dockerMock.createContainer.mockResolvedValue(containerMock);
  dockerMock.getImage.mockReturnValue(imageMock);
  dockerMock.pull.mockImplementation((_imageName, cb) => cb(null, {}));
  dockerMock.run.mockImplementation((_image, _cmd, _output, _opts, cb) => cb(null, { StatusCode: 0 }));
  dockerMock.modem.followProgress.mockImplementation((_stream, doneCb) => doneCb(null));

  containerMock.inspect.mockResolvedValue({ State: {} });
  containerMock.start.mockResolvedValue(undefined);
  containerMock.stop.mockResolvedValue(undefined);
  containerMock.restart.mockResolvedValue(undefined);
  containerMock.remove.mockResolvedValue(undefined);
  containerMock.attach.mockImplementation((_opts, cb) => cb(null, streamMock));

  imageMock.inspect.mockResolvedValue({ RepoDigests: [] });
  imageMock.distribution.mockResolvedValue({});

  gameLoaderMock.getDataPath.mockImplementation((id) => join(tempRoot, id));
  gameLoaderMock.getGame.mockImplementation((id) => ({ id, name: id }));
});

// --- pure status/info getters ---

describe('getContainerStatus', () => {
  it('is "not_created" when Docker has no container by that name', async () => {
    expect(await getContainerStatus(fakeId())).toBe('not_created');
  });

  it('maps the Docker container State via dockerStateToStatus', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Names: [`/serverdock-${id}`], State: 'running' }]);
    expect(await getContainerStatus(id)).toBe('running');
  });

  it('is "not_created" when the Docker API call itself fails', async () => {
    dockerMock.listContainers.mockRejectedValue(new Error('daemon unreachable'));
    expect(await getContainerStatus(fakeId())).toBe('not_created');
  });
});

describe('getEffectiveStatus', () => {
  it('prefers an in-flight transient state over the real Docker state', async () => {
    const id = fakeId();
    setTransient(id, 'starting');
    dockerMock.listContainers.mockResolvedValue([{ Names: [`/serverdock-${id}`], State: 'running' }]);
    expect(await getEffectiveStatus(id)).toBe('starting');
  });

  it('downgrades "error" to "stopped" when the exit was admin-initiated', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([
      { Names: [`/serverdock-${id}`], State: 'exited', Status: 'Exited (1) 2 minutes ago' },
    ]);
    // stopContainer's own admin-stop marking is exercised below; here we only
    // need a container that Docker reports as a crash (nonzero exit).
    const { markAdminStop } = await import('./statusBus.js');
    markAdminStop(id);
    expect(await getEffectiveStatus(id)).toBe('stopped');
  });
});

describe('getEffectiveStatuses (batched)', () => {
  it('resolves each id independently in one Docker round trip', async () => {
    const running = fakeId();
    const missing = fakeId();
    dockerMock.listContainers.mockResolvedValue([
      { Names: [`/serverdock-${running}`], State: 'running' },
    ]);

    const result = await getEffectiveStatuses([running, missing]);

    expect(result.get(running)).toBe('running');
    expect(result.get(missing)).toBe('not_created');
    expect(dockerMock.listContainers).toHaveBeenCalledTimes(1);
  });
});

describe('getContainerExitInfo', () => {
  it('reports exit details from the container State', async () => {
    containerMock.inspect.mockResolvedValue({
      State: { ExitCode: 137, OOMKilled: true, Error: '', FinishedAt: '2026-01-01T00:00:00Z' },
    });
    expect(await getContainerExitInfo(fakeId())).toEqual({
      exitCode: 137,
      oomKilled: true,
      error: null,
      finishedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('returns null when inspect fails (e.g. container was removed)', async () => {
    containerMock.inspect.mockRejectedValue(new Error('no such container'));
    expect(await getContainerExitInfo(fakeId())).toBeNull();
  });
});

describe('getContainerTimestamps', () => {
  it('reports startedAt while running, and no lastActiveAt', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`] }]);
    containerMock.inspect.mockResolvedValue({ State: { Running: true, StartedAt: '2026-01-01T00:00:00Z' } });
    expect(await getContainerTimestamps(id)).toEqual({
      startedAt: '2026-01-01T00:00:00Z',
      lastActiveAt: null,
    });
  });

  it('reports lastActiveAt once stopped, and no startedAt', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`] }]);
    containerMock.inspect.mockResolvedValue({
      State: { Running: false, FinishedAt: '2026-01-01T01:00:00Z' },
    });
    expect(await getContainerTimestamps(id)).toEqual({
      startedAt: null,
      lastActiveAt: '2026-01-01T01:00:00Z',
    });
  });

  it('treats Docker\'s zero-value FinishedAt as "never exited"', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`] }]);
    containerMock.inspect.mockResolvedValue({
      State: { Running: false, FinishedAt: '0001-01-01T00:00:00Z' },
    });
    expect((await getContainerTimestamps(id)).lastActiveAt).toBeNull();
  });

  it('returns both fields null when the container does not exist', async () => {
    expect(await getContainerTimestamps(fakeId())).toEqual({ startedAt: null, lastActiveAt: null });
  });
});

// --- lifecycle actions ---

describe('startContainer', () => {
  it('refuses to start a local-image game that has not been built yet', async () => {
    const game = fakeGame({ imageSource: 'local', imageBuilt: false });
    await expect(startContainer(game)).rejects.toMatchObject({
      status: 400,
      message: 'Build the image before starting',
    });
    expect(dockerMock.createContainer).not.toHaveBeenCalled();
    expect(getTransient(game.id)).toBeNull(); // rejected before any state change
  });

  it('refuses to start a container that is already running', async () => {
    const game = fakeGame();
    dockerMock.listContainers.mockResolvedValue([
      { Id: 'c1', Names: [`/serverdock-${game.id}`], State: 'running' },
    ]);
    await expect(startContainer(game)).rejects.toMatchObject({
      status: 409,
      message: 'Server is already running',
    });
    expect(dockerMock.createContainer).not.toHaveBeenCalled();
  });

  it('pulls the image first when a public image is not present locally', async () => {
    const game = fakeGame({ imageSource: 'public' });
    imageMock.inspect.mockRejectedValue(new Error('no such image'));

    await startContainer(game);

    expect(dockerMock.pull).toHaveBeenCalledWith(game.image, expect.any(Function));
    expect(dockerMock.createContainer).toHaveBeenCalled();
    expect(getTransient(game.id)).toBeNull();
    expect(getLastKnown(game.id)).toBe('running');
  });

  it('skips pulling when the image is already present locally', async () => {
    const game = fakeGame({ imageSource: 'public' });
    imageMock.inspect.mockResolvedValue({ RepoDigests: [`${game.image.split(':')[0]}@sha256:abc`] });

    await startContainer(game);

    expect(dockerMock.pull).not.toHaveBeenCalled();
    expect(dockerMock.createContainer).toHaveBeenCalled();
  });

  it('removes a stale stopped container before recreating it, without pulling for a local image', async () => {
    const game = fakeGame({ imageSource: 'local', imageBuilt: true, image: 'local/mygame' });
    dockerMock.listContainers.mockResolvedValue([
      { Id: 'stale-id', Names: [`/serverdock-${game.id}`], State: 'exited', Status: 'Exited (0)' },
    ]);

    await startContainer(game);

    expect(dockerMock.getContainer).toHaveBeenCalledWith('stale-id');
    expect(containerMock.remove).toHaveBeenCalledOnce();
    expect(dockerMock.pull).not.toHaveBeenCalled();
  });

  it('builds port bindings, DNS, and resource limits into the container config', async () => {
    const game = fakeGame({
      ports: [{ container: 7777, host: 7777, protocol: 'udp' }],
      resources: { cpuLimit: 2, memoryLimit: 1024 },
      environment: [{ key: 'FOO', value: 'bar' }],
    });
    imageMock.inspect.mockResolvedValue({ RepoDigests: [`${game.image.split(':')[0]}@sha256:abc`] });

    await startContainer(game);

    const [config] = dockerMock.createContainer.mock.calls[0];
    expect(config.name).toBe(`serverdock-${game.id}`);
    expect(config.Env).toEqual(['FOO=bar']);
    expect(config.ExposedPorts).toEqual({ '7777/udp': {} });
    expect(config.HostConfig.PortBindings).toEqual({ '7777/udp': [{ HostPort: '7777' }] });
    expect(config.HostConfig.Dns).toEqual(['1.1.1.1', '8.8.8.8']);
    expect(config.HostConfig.NanoCpus).toBe(2e9);
    expect(config.HostConfig.Memory).toBe(1024 * 1024 * 1024);
    expect(config.HostConfig.RestartPolicy).toEqual({ Name: 'no' });
  });

  it('on failure, settles back to real Docker status and rethrows the original error', async () => {
    const game = fakeGame();
    imageMock.inspect.mockResolvedValue({ RepoDigests: [`${game.image.split(':')[0]}@sha256:abc`] });
    const boom = new Error('createContainer exploded');
    dockerMock.createContainer.mockRejectedValue(boom);

    await expect(startContainer(game)).rejects.toBe(boom);

    expect(getTransient(game.id)).toBeNull();
    expect(getLastKnown(game.id)).toBe('not_created'); // settled via getContainerStatus()
  });
});

describe('stopContainer', () => {
  it('refuses to stop a container that is not running', async () => {
    const id = fakeId();
    await expect(stopContainer(id)).rejects.toMatchObject({
      status: 409,
      message: 'Server is not running',
    });
    expect(hasAdminStop(id)).toBe(false);
  });

  it('marks the stop as admin-initiated and settles to "stopped"', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`], State: 'running' }]);

    await stopContainer(id);

    expect(containerMock.stop).toHaveBeenCalledOnce();
    expect(hasAdminStop(id)).toBe(true); // left marked — a later poll consumes it
    expect(getLastKnown(id)).toBe('stopped');
  });

  it('clears the admin-stop mark if the Docker stop call itself fails', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`], State: 'running' }]);
    const boom = new Error('stop failed');
    containerMock.stop.mockRejectedValue(boom);

    await expect(stopContainer(id)).rejects.toBe(boom);

    // Not cleared -> a later real exit would be wrongly suppressed as "admin stop"
    expect(hasAdminStop(id)).toBe(false);
  });
});

describe('restartContainer', () => {
  it('refuses to restart a container that is not running', async () => {
    await expect(restartContainer(fakeId())).rejects.toMatchObject({ status: 409 });
  });

  it('restarts and settles back to "running"', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`], State: 'running' }]);

    await restartContainer(id);

    expect(containerMock.restart).toHaveBeenCalledOnce();
    expect(getLastKnown(id)).toBe('running');
  });

  it('does not mark an admin stop on failure (a restart failure is a crash, not an intentional stop)', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`], State: 'running' }]);
    containerMock.restart.mockRejectedValue(new Error('restart failed'));

    await expect(restartContainer(id)).rejects.toThrow('restart failed');

    expect(hasAdminStop(id)).toBe(false);
  });
});

describe('resetContainer', () => {
  it('stops and removes a running container, then wipes the data dir', async () => {
    const id = fakeId();
    dockerMock.listContainers.mockResolvedValue([{ Id: 'c1', Names: [`/serverdock-${id}`], State: 'running' }]);
    imageMock.inspect.mockResolvedValue({ RepoDigests: ['alpine@sha256:abc'] }); // alpine already present

    await resetContainer(id);

    expect(containerMock.stop).toHaveBeenCalledOnce();
    expect(containerMock.remove).toHaveBeenCalledOnce();
    expect(dockerMock.run).toHaveBeenCalledOnce();
    expect(getLastKnown(id)).toBe('not_created');
  });

  it('skips stop/remove entirely when no container exists yet, but still wipes the data dir', async () => {
    const id = fakeId();
    imageMock.inspect.mockResolvedValue({ RepoDigests: ['alpine@sha256:abc'] });

    await resetContainer(id);

    expect(containerMock.stop).not.toHaveBeenCalled();
    expect(containerMock.remove).not.toHaveBeenCalled();
    expect(dockerMock.run).toHaveBeenCalledOnce();
  });

  it('pulls alpine first if it is not present locally', async () => {
    const id = fakeId();
    imageMock.inspect.mockRejectedValue(new Error('no such image'));

    await resetContainer(id);

    expect(dockerMock.pull).toHaveBeenCalledWith('alpine', expect.any(Function));
  });

  it('fails when the wipe container exits with a nonzero status, and clears the admin-stop mark', async () => {
    const id = fakeId();
    imageMock.inspect.mockResolvedValue({ RepoDigests: ['alpine@sha256:abc'] });
    dockerMock.run.mockImplementation((_i, _c, _o, _opts, cb) => cb(null, { StatusCode: 1 }));

    await expect(resetContainer(id)).rejects.toThrow('Data wipe exited with code 1');

    expect(hasAdminStop(id)).toBe(false);
  });
});

describe('sendStdinCommand', () => {
  it('writes the command with a trailing newline over a stdin-only attach, then closes it', async () => {
    const id = fakeId();

    await sendStdinCommand(id, 'say hello');

    expect(containerMock.attach).toHaveBeenCalledWith(
      { stream: true, stdin: true, stdout: false, stderr: false },
      expect.any(Function)
    );
    expect(streamMock.write).toHaveBeenCalledWith('say hello\n');
    expect(streamMock.end).toHaveBeenCalledOnce();
  });

  it('propagates an attach failure', async () => {
    containerMock.attach.mockImplementation((_opts, cb) => cb(new Error('attach failed'), null));
    await expect(sendStdinCommand(fakeId(), 'say hi')).rejects.toThrow('attach failed');
  });
});
