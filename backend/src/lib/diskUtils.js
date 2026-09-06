import { readdir, stat, statfs } from 'fs/promises';
import { join } from 'path';

// Returns bytes consumed by a directory tree. Returns 0 on missing path or error.
// Walks in pure JS rather than shelling out to `du` — `du -sb` is GNU-only
// (unavailable on Windows dev machines, absent on BSD/macOS) and this way
// behavior is identical everywhere this code runs.
export async function getDirSize(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = join(path, entry.name);
    try {
      if (entry.isDirectory()) {
        total += await getDirSize(full);
      } else if (entry.isFile()) {
        total += (await stat(full)).size;
      }
    } catch {
      // entry vanished or became inaccessible mid-walk — skip it
    }
  }
  return total;
}

// Cached variant for hot/public paths. GET /api/servers is unauthenticated and
// polled by every visitor; walking each game's full data tree on every request
// is expensive for multi-GB world saves. Cache per path with a short TTL and
// share the in-flight promise so concurrent callers trigger a single walk.
const DIR_SIZE_TTL = 60_000;
const dirSizeCache = new Map(); // path -> { at, promise }

export function getDirSizeCached(path) {
  const hit = dirSizeCache.get(path);
  if (hit && Date.now() - hit.at < DIR_SIZE_TTL) return hit.promise;
  const promise = getDirSize(path);
  dirSizeCache.set(path, { at: Date.now(), promise });
  return promise;
}

// Returns { total, free, used } in bytes for the filesystem containing path.
// Returns null on error.
export async function getHostDiskInfo(path = '/') {
  try {
    const s = await statfs(path);
    const total = s.blocks * s.bsize;
    const free  = s.bavail * s.bsize;
    const used  = (s.blocks - s.bfree) * s.bsize;
    return { total, free, used };
  } catch {
    return null;
  }
}
