# ServerDock — Security Notes

ServerDock's threat model is deliberately narrow: **the network boundary is the security boundary.** It assumes it's running on a machine that is never reachable from the public internet, and that everyone who can reach it at all is someone the admin has already invited onto a private network (see [NETWORKING.md](NETWORKING.md)). Everything below is defense-in-depth on top of that assumption, not a substitute for it.

**Do not expose ServerDock's port to the public internet.** There is no HTTPS, and the app was not designed to withstand hostile traffic from strangers.

---

## Authentication

- Passwords are hashed with bcrypt (12 rounds).
- Sessions are JWTs (24h expiry), payload `{ sub, role, jti }`, signed with `JWT_SECRET` — either operator-supplied or auto-generated on first boot and persisted in `settings.json`/`state/settings.json`.
- The JWT is stored in `sessionStorage` under `sd_token`, **never `localStorage`** — it's cleared when the tab/browser closes and isn't readable across tabs.
- `role` is baked into the token and not re-checked against the database — a `super_admin` token stays a super-admin for its full 24h lifetime even if demoted. Granular permissions, by contrast, are looked up fresh from SQLite on **every** request, so revoking one takes effect immediately.
- Logging out revokes the token's `jti` in an in-memory map, checked by both HTTP and socket auth. This is the *only* revocation trigger — changing a password or role does not invalidate an outstanding token early; it simply expires naturally. The revocation map is in-memory and clears on a backend restart (there's no persistent session store by design).
- `POST /api/auth/login` and `POST /api/auth/setup` are rate-limited to 10 requests / 15 minutes / IP.
- `POST /api/auth/setup` only succeeds once, ever — after the first admin exists it always 4xxs, so it can't be replayed to create a rogue account later.

## Authorization

- Two roles: `super_admin` (everything, always; never itself a grantable permission — this prevents a plain admin from checking a box that would let them self-escalate) and `admin` (nothing until a `super_admin` grants specific permissions from a fixed catalog).
- Every mutating API route is enforced server-side via `requirePermission('<perm>')` or `requireSuperAdmin`. The frontend's permission checks (`hasPermission()`, `isSuperAdmin`) only hide controls for UX — they enforce nothing on their own. Treat the backend middleware as the actual boundary; see [API.md](API.md#permission-gated) for the full route ↔ permission mapping.
- The last remaining `super_admin` can't be demoted or deleted, so an install can never lock itself out of administration entirely.

## File manager sandboxing

- All paths resolve against `backend/games/<id>/data/`; anything that escapes that sandbox (via `..`, an absolute path, or a symlink that resolves outside it) returns 403. Symlinks are followed and then re-validated against the sandbox.
- Files are detected as binary by scanning the first 512 bytes for a null byte and rejected from editing if found; edits are capped at 512 KB.
- Writes are atomic (`.tmp` file, then rename over the target) so a crash mid-write can't corrupt a config file.
- Mutations (`mkdir`/`upload`/`write`/`rename`/`delete`) require **both** the `files:write` permission **and** the server being stopped (409 otherwise) — a running container may hold files open or overwrite them mid-edit. Read/list/download work for any admin in any server state.

## Docker access is broad by design

Whatever process runs ServerDock has `/var/run/docker.sock` bind-mounted in (Docker install) or direct socket access (non-Docker install) so it can create and control game containers — the same "Docker-outside-of-Docker" model tools like Portainer use. **Anything with access to that process effectively has root-equivalent control of the host's Docker daemon**, and by extension the host itself. This is why ServerDock is not meant to run anywhere reachable by anyone you wouldn't hand host-root to.

## Network egress from game containers

Game containers get explicit DNS (`1.1.1.1`/`8.8.8.8` by default, overridable via `CONTAINER_DNS`) rather than the host's resolver, so mod/update-server lookups keep working even when the host's own resolver isn't reachable from inside a container. This is a correctness fix, not a security control — game containers otherwise have normal outbound network access.

## What's intentionally *not* here

- **No HTTPS.** The VPN tunnel is expected to provide transport security; plain HTTP is the deliberate tradeoff for "no cert management on a home server."
- **No CSRF tokens.** There are no cookies in play (JWT is sent as an `Authorization` header from JS, not stored in a cookie), which removes the classic CSRF vector.
- **No account lockout beyond rate limiting.** A wrong password just fails; there's no escalating lockout, since the login rate limit already bounds brute-force attempts per IP.
- **No audit log of admin actions** beyond the bounded `server_events` table (resource/crash/action-failure history — see [CLAUDE.md](CLAUDE.md#key-architectural-decisions)), which exists for operational visibility, not accountability.

## Reporting a concern

This is a self-hosted, single-operator tool without a public deployment to protect — if you find an issue, open it as a regular GitHub issue or reach out to the maintainer directly.
