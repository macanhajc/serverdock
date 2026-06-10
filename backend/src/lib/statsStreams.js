import docker from './docker.js';
import logger from './logger.js';
import { getGame } from './gameLoader.js';

// Map<gameId, { stream, refCount, prevNetIn, prevNetOut, prevTs }>
const activeStatsStreams = new Map();

function parseStats(raw, slot) {
  try {
    const s = JSON.parse(raw);

    // CPU % as fraction of total system capacity (0–100%), matching htop/ubuntu system monitor.
    // system_cpu_usage is the aggregate across all cores, so cpuDelta/sysDelta is already
    // normalised — no need to multiply by numCpus.
    const cpuDelta =
      s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
    const sysDelta =
      s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage;
    const cpu = sysDelta > 0 ? (cpuDelta / sysDelta) * 100 : 0;

    // Memory (exclude page cache from used)
    const memUsed = s.memory_stats.usage - (s.memory_stats.stats?.cache ?? 0);
    const memLimit = s.memory_stats.limit;

    // Network — cumulative bytes → per-second rate using wall-clock delta
    const networks = s.networks ?? {};
    const netIn = Object.values(networks).reduce((a, n) => a + n.rx_bytes, 0);
    const netOut = Object.values(networks).reduce((a, n) => a + n.tx_bytes, 0);
    const now = Date.now();
    const dtSec = (now - slot.prevTs) / 1000;
    const netInRate = dtSec > 0 ? Math.max(0, (netIn - slot.prevNetIn) / dtSec) : 0;
    const netOutRate = dtSec > 0 ? Math.max(0, (netOut - slot.prevNetOut) / dtSec) : 0;
    slot.prevNetIn = netIn;
    slot.prevNetOut = netOut;
    slot.prevTs = now;

    return {
      cpu: Math.min(100, Math.max(0, cpu)),
      memUsed,
      memLimit,
      netInRate,
      netOutRate,
    };
  } catch {
    return null;
  }
}

export async function attachStatsStream(io, id) {
  const entry = activeStatsStreams.get(id);
  if (entry) {
    entry.refCount++;
    return;
  }

  const slot = {
    stream: null,
    refCount: 1,
    prevNetIn: 0,
    prevNetOut: 0,
    prevTs: Date.now(),
  };
  activeStatsStreams.set(id, slot);

  let stream;
  try {
    stream = await docker.getContainer(`serverdock-${id}`).stats({ stream: true });
  } catch {
    activeStatsStreams.delete(id);
    return;
  }

  // Slot may have been evicted by detachStatsStream while awaiting
  if (!activeStatsStreams.has(id)) {
    stream.destroy();
    return;
  }

  slot.stream = stream;
  logger.info({ gameId: id }, 'stats stream attached');

  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = parseStats(line, slot);
      if (parsed) {
        const configuredMB = getGame(id)?.resources?.memoryLimit;
        const memLimit = configuredMB ? configuredMB * 1024 * 1024 : null;
        io.to(`stats:${id}`).emit('stats:update', { id, ...parsed, memLimit });
      }
    }
  });

  stream.on('end', () => {
    logger.info({ gameId: id }, 'stats stream ended');
    // Only evict if this slot is still the active one — a replaced (leave→join)
    // stream's late 'end' must not delete the slot of the stream that succeeded it.
    if (activeStatsStreams.get(id) === slot) activeStatsStreams.delete(id);
  });

  stream.on('error', () => {
    if (activeStatsStreams.get(id) === slot) activeStatsStreams.delete(id);
  });
}

export function detachStatsStream(id) {
  const entry = activeStatsStreams.get(id);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    logger.info({ gameId: id }, 'stats stream detached');
    if (entry.stream) entry.stream.destroy();
    activeStatsStreams.delete(id);
  }
}
