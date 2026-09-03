// Small in-memory fixed-window limiter, keyed by IP. No external deps —
// consistent with the project's no-database, filesystem-state approach.
const buckets = new Map();

export function rateLimit({ windowMs, max }) {
  // Sweep expired buckets periodically so the map doesn't grow unbounded.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, windowMs);
  sweeper.unref?.();

  return (req, res, next) => {
    const key = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests, try again later' });
    }

    bucket.count += 1;
    next();
  };
}
