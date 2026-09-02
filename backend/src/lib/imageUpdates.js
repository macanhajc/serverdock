import docker from './docker.js';
import logger from './logger.js';

function localDigestFor(inspectResult, imageName) {
  const repo = imageName.split(':')[0];
  const match = (inspectResult.RepoDigests ?? []).find((d) => d.startsWith(`${repo}@`));
  return match ? match.slice(repo.length + 1) : null;
}

// Manual, on-demand only — never called on a timer, to stay well clear of
// Docker Hub's anonymous-pull rate limits across ~17 configured games.
export async function checkImageUpdate(imageName) {
  let local;
  try {
    local = await docker.getImage(imageName).inspect();
  } catch {
    return { updateAvailable: null, reason: 'not_pulled' };
  }

  const localDigest = localDigestFor(local, imageName);
  if (!localDigest) return { updateAvailable: null, reason: 'not_pulled' };

  try {
    // Docker Engine's own /distribution/{name}/json — checks the registry's
    // manifest digest without pulling. dockerode wraps it as Image#distribution.
    const remote = await docker.getImage(imageName).distribution();
    const remoteDigest = remote?.Descriptor?.digest;
    if (!remoteDigest) return { updateAvailable: null, reason: 'check_failed' };
    return { updateAvailable: remoteDigest !== localDigest, localDigest, remoteDigest };
  } catch (err) {
    logger.warn({ err, imageName }, 'image update check failed');
    return { updateAvailable: null, reason: 'check_failed' };
  }
}
