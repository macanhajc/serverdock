import { execFile } from 'child_process';
import { promisify } from 'util';
import { statfs } from 'fs/promises';

const execFileAsync = promisify(execFile);

// Returns bytes consumed by a directory tree. Returns 0 on missing path or error.
export async function getDirSize(path) {
  try {
    const { stdout } = await execFileAsync('du', ['-sb', path]);
    const bytes = parseInt(stdout.split('\t')[0], 10);
    return isNaN(bytes) ? 0 : bytes;
  } catch {
    return 0;
  }
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
