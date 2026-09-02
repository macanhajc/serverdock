// In-memory JWT revocation list — no persistent session store per project rules.
// Entries are pruned lazily on lookup rather than on a timer; a server restart
// clears the list, which just means any revoked-but-unexpired token becomes
// valid again (acceptable: the JWT's own 24h expiry is still the hard bound).
const revoked = new Map(); // jti -> exp (seconds since epoch)

export function revokeToken(jti, exp) {
  if (!jti) return;
  revoked.set(jti, exp);
}

export function isRevoked(jti) {
  if (!jti) return false;
  const exp = revoked.get(jti);
  if (exp === undefined) return false;
  if (Date.now() / 1000 > exp) {
    revoked.delete(jti);
    return false;
  }
  return true;
}
