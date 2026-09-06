import { platform } from 'os';
import Docker from 'dockerode';

// The daemon endpoint is not the same on every host: Linux/macOS expose a unix
// socket, Docker Desktop on Windows exposes the named pipe \\.\pipe\docker_engine.
// Hard-coding /var/run/docker.sock makes every call fail with ENOENT on Windows,
// which surfaces as "docker daemon unreachable". DOCKER_HOST overrides both and
// is what the docker CLI itself honours (tcp:// for a remote or TLS-less daemon).
function resolveEndpoint() {
  const host = process.env.DOCKER_HOST?.trim();
  if (!host) {
    return {
      socketPath: platform() === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock',
    };
  }
  if (host.startsWith('unix://')) return { socketPath: host.slice(7) };
  if (host.startsWith('npipe://')) return { socketPath: host.slice(8).replace(/\\/g, '/') };
  const url = new URL(host.replace(/^tcp:\/\//, 'http://'));
  return {
    host: url.hostname,
    port: url.port || 2375,
    protocol: url.protocol === 'https:' ? 'https' : 'http',
  };
}

const endpoint = resolveEndpoint();
const docker = new Docker(endpoint);

// For log lines / health output — tells the admin which endpoint was actually tried.
export const dockerEndpoint = endpoint.socketPath
  ? endpoint.socketPath
  : `${endpoint.protocol}://${endpoint.host}:${endpoint.port}`;

export async function isDockerAvailable() {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export default docker;
