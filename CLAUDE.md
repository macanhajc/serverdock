# CLAUDE.md — ServerDock

Self-hosted game server manager. Admin controls Docker game containers via a login-protected panel; friends see a read-only status dashboard. Runs on a single Ubuntu machine, VPN-gated, no public internet exposure.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (port 4000) |
| Frontend | React + Vite + Tailwind CSS dark theme (port 3000) |
| Docker control | `dockerode`, endpoint resolved per-platform (`docker.js`) — Unix socket, Windows named pipe, or `DOCKER_HOST` |
| Real-time | `socket.io` (same port as backend) |
| Auth | JWT (24h, `sub`/`role`/`jti` payload) + bcrypt; roles & permissions in SQLite |
| Game config | JSON files, one per game in `backend/games/<id>/` |
| App database | SQLite (`better-sqlite3`) at `backend/serverdock.db` — admins, permissions, visitors, IP blocklist, bounded resource/crash event history |

---

## Directory Structure

```
/home/macanha/Desktop/Projects/ServerDock/   ← dev working directory
├── backend/
│   ├── src/
│   ├── games/                               ← one subfolder per game
│   │   └── <id>/
│   │       ├── <id>.json                    ← game definition
│   │       ├── avatar.<ext>                 ← optional cover image, set via the game edit form
│   │       ├── data/                        ← game server data (world saves, configs)
│   │       └── Dockerfile                   ← Steam/custom games only
│   ├── serverdock.db                        ← SQLite: admins, permissions, visitors, blocklist, server_events
│   ├── src/lib/adminStore.js                ← admin CRUD, roles, permission grants
│   ├── src/lib/eventLog.js                  ← server_events CRUD (resource/crash/action-failure alert history — see below)
│   ├── src/lib/db.js                        ← SQLite connection + schema (CREATE TABLE IF NOT EXISTS)
│   ├── src/lib/legacyMigration.js           ← one-time import of auth.json/visitors.json/blocklist.json into SQLite
│   ├── src/middleware/permissions.js        ← requirePermission() / requireSuperAdmin()
│   ├── src/routes/admins.js                 ← /api/admins/* (super_admin only, except self password change)
│   ├── setup-auth.js                        ← one-time credential setup script (writes the first super_admin into SQLite)
│   └── .env                                 ← PORT, JWT_SECRET, SERVER_HOST, optional CONTAINER_DNS/DOCKER_HOST
└── frontend/
    └── src/
        ├── pages/private/AdminsPage/        ← admin roster UI, gated to super_admin (route + nav item)
        └── data/
            └── templates.js                 ← game preset templates (static)
```

`auth.json` / `visitors.json` / `blocklist.json` no longer exist as the live store — on first boot after this change, `legacyMigration.js` reads any that are present, imports their contents into `serverdock.db`, and renames each to `<name>.migrated` (never deleted, so migration can be undone by hand). Each store only migrates once (skipped if its table is already non-empty).

Production root is `/opt/serverdock/`. Dev and prod share the same structure.

---

## Dev Commands

```bash
# Backend (nodemon)
cd backend && npm run dev

# Frontend (Vite)
cd frontend && npm run dev

# One-time admin credential setup
cd backend && node setup-auth.js --username admin --password yourpassword
```

---

## Key Architectural Decisions

- **SQLite holds app state that isn't Docker or a game config, plus one bounded exception for operational telemetry.** `backend/src/lib/db.js` opens `backend/serverdock.db` (WAL mode, `chmod 600` on POSIX) and owns six tables: `admins`, `admin_permissions`, `visitors`, `visitor_ips`, `blocked_ips`, and `server_events`. Docker is still the source of truth for container state, and game configs are still JSON files on disk — SQLite only replaced what used to be `auth.json`/`visitors.json`/`blocklist.json`, plus the deliberate, scoped addition of `server_events` (see the next bullet — capped and pruned, not a general log). Do not add anything beyond this scope (see [What NOT to Do](#what-not-to-do)).
- **Resource/crash/action-failure alerts persist in `server_events`, not in memory.** `backend/src/lib/eventLog.js` owns the table (types: `resource_high`, `crash`, `action_failed`; valid types are enforced in JS, not a SQL `CHECK` — SQLite can't `ALTER` one in place, so db.js one-time-rebuilds any table still carrying the original two-type constraint before applying the current schema). One row per detected occurrence, `resolved_at` NULL while still active. `resourceAlerts.js`/`crashInfo.js`/`actionFailures.js` are thin wrappers over it (`get/set/clear` — same call-site API each had before this table existed) that adapt the generic row shape into what callers expect (`{cpu, memPct, message, since}` / `{exitCode, oomKilled, error, at}` / `{action, message, stack, at}` — `action_failed` is scoped to start/restart failures only, and keeps the thrown error's stack trace, capped, as a debugging aid). The "current alert" for a (game, type) pair is just its newest unresolved row — there's no separate in-memory cache, so it survives a backend restart. Resolution happens when the underlying condition actually clears: a resource alert resolves when usage drops back under threshold (checked every tick for non-running games as a standing invariant, not just on the transition) or the admin manually stops/resets the server; a crash or action-failure resolves when the server successfully reaches `running` again (same standing-invariant treatment — see `pollStatus` in `socketHandlers.js`), or on reset. Distinct occurrences of the same type are never merged into one row (e.g. two failed start attempts before either is fixed both get their own row; resolving later clears every unresolved row of that type at once) — every table/history entry (`GET /api/servers/:id/events`, the Info tab's Event History section) shows every occurrence, and the live state can have more than one *type* active at once too (e.g. a crash and a subsequent failed restart) — the frontend's `getActiveIssues()` (`utils/serverStatus.ts`) surfaces all of them together rather than picking one to show. All capped at 50 rows per game (`MAX_EVENTS_PER_GAME` in `eventLog.js`, oldest pruned on insert) — an active row is always among the newest, so pruning never deletes something still open. `GET /api/servers/:id/events` needs JWT only, no specific permission — same "any admin can view" treatment as backup downloads. The live current-alert state is what drives the table row tint/badge (red for crash/action-failure, yellow for resource-only) and the detail-page banner (`resource:update`/`crash:update`/`action_failure:update` — see WebSocket Rooms).
- **Roles: `super_admin` vs `admin`, with granular permissions.** A `super_admin` can do everything and is never itself a grantable permission (that would let an admin self-escalate). A plain `admin` has *no* capabilities until a `super_admin` checks boxes from the fixed catalog in `adminStore.js`: `servers:power`, `servers:reset`, `games:create`, `games:edit`, `games:delete`, `files:write`, `backups:manage`, `console:write`, `visitors:manage`, `schedules:manage`, `settings:manage`. Every mutating route is gated server-side with `requirePermission('<perm>')` (`backend/src/middleware/permissions.js`) — the frontend's `hasPermission()`/`isSuperAdmin` (`AuthContext.tsx`) only hide controls for UX, they enforce nothing. A `command`-type schedule additionally requires `console:write` on top of `schedules:manage`, since a scheduled command has the same effect as console access. Only a `super_admin` can create/edit/delete admin accounts (`requireSuperAdmin`) — the last remaining `super_admin` can't be demoted or deleted.
- **JWT payload carries `sub` (admin id), `role`, and `jti`.** `role` is baked into the token at login and is *not* re-checked against the DB — a `super_admin` short-circuits every `requirePermission` check for the life of the token. Granular permissions, by contrast, are looked up fresh from SQLite on every request, so revoking one takes effect immediately instead of waiting out the 24h token lifetime. Logging out calls `revokeToken(jti, exp)` into an in-memory `Map` (`tokenRevocation.js`) checked by both HTTP (`middleware/auth.js`) and socket auth (`socketHandlers.js`) — this is the one and only revocation trigger; changing a password, changing a role, or deleting the admin does **not** revoke their outstanding token (it simply expires naturally within 24h). The map is in-memory only and clears on restart, consistent with "no persistent session store."
- **JWT in `sessionStorage` under key `sd_token`.** Never localStorage. Survives page reload within the same tab; cleared when tab/browser closes. Socket is reconnected on mount if a stored token exists.
- **RCON is implemented — `players` is no longer always `null`.** A game's `<id>.json` can carry an `rcon` block: `{ enabled, port, password, listCommand, commands: { broadcast } }`. `port` must also appear in the game's `ports` list so Docker actually publishes it — `sendRconCommand` (`backend/src/lib/rcon.js`) dials the *published host port* (not the container's internal Docker-network IP, which isn't routable from host-side Node under Docker Desktop), does a raw Source-RCON handshake, and is used both for the on-demand `POST /api/servers/:id/rcon` endpoint and — only for games that also set `listCommand` — a periodic (~15s) player-list poll from `socketHandlers.js` that populates a new `playerList` field (raw text, no cross-game parsing) alongside the existing A2S-derived `players` count. Games without `rcon.enabled` (e.g. SCUM) still report `players: null`.
- **Host/VPN resolution goes through a pluggable network provider.** `backend/src/lib/vpn/index.js` dispatches to one of five provider modules under `backend/src/lib/vpn/providers/` (`netbird.js`, `tailscale.js`, `wireguard.js`, `zerotier.js`, `manual.js`) based on `settings.networkProvider` (admin-set in Settings → Server Identity; defaults to `netbird` so existing installs don't change behavior), each exposing `getStatus(settings) -> {self, peers}` via `execFile` (never `exec` with string interpolation — `wireguardInterface` is regex-validated before it becomes a process argument). Results are cached 30s, keyed by provider id so a mid-flight switch never serves stale data from the old one; `PUT /api/settings` calls `invalidateVpnCache()` when the provider or interface changes. `resolveHost()` in `servers.js` tries `getSelfIp()` first, then falls back to `settings.serverHost`, then the `SERVER_HOST` env var, then `127.0.0.1` — unchanged by the provider split. None of these are Docker networks — game containers are never joined to any of them; they only supply the host's own VPN IP for the "how friends connect" address. The `manual` provider is the explicit "no mesh VPN" choice (`self: null, peers: []`), relying on `serverHost` alone. `GET /api/vpn/status` (JWT-protected) surfaces the active provider's self/peers info for the admin Network page and the Dashboard's network card.
- **`SERVER_HOST` env var is the last-resort fallback**, not the primary source anymore (see network provider bullet above). Still worth setting on install as a safety net for hosts without a network provider configured.
- **Containers get explicit DNS, not the host's.** `HostConfig.Dns` defaults to `1.1.1.1,8.8.8.8` (`containers.js`), overridable via `CONTAINER_DNS` in `.env`. Needed because a host running systemd-resolved or a VPN stub resolver hands containers an address (e.g. `127.0.0.53`) that's unreachable from inside the container, breaking Mojang/Steam/mod-CDN lookups and runtime image pulls.
- **Data volumes at `backend/games/<id>/data/`** inside the project, mounted into containers at `/data` (path may vary per game image — check template). Absolute path resolved at runtime via `getDataPath(id)` in `gameLoader.js`.
- **Container naming: `serverdock-<id>`.** ID is a lowercase slug, no spaces.
- **`RestartPolicy: { Name: "no" }`** on all containers. Admin controls start/stop. No auto-start on machine reboot.
- **No HTTPS.** VPN tunnel handles encryption. Plain HTTP is fine.
- **Cover image (`avatar`) and `storeUrl` (Steam/GOG/Epic link) live in `<id>.json`**, alongside the game definition — not in `data/`. They're uploaded/edited from the game form and never require the container to be stopped, since they don't touch the data volume Docker has mounted.
- **Image-update checks are manual only, never on a timer.** `POST /api/games/:id/check-update` (`imageUpdates.js`) compares the local image digest against the registry's manifest digest without pulling. It's request-triggered from the Info tab specifically to stay clear of Docker Hub's anonymous-pull rate limits across many configured games — do not wire this to a cron/interval.

---

## Auth Rules

**Public endpoints (no JWT needed):**
- `GET /api/servers`
- `GET /api/servers/:id`
- `GET /api/servers/:id/avatar` — streams the game's cover image (404 if none set); public so cards render it without a JWT
- `POST /api/auth/login`
- `GET /api/health`
- WebSocket `join:status` room

**Protected endpoints (require `Authorization: Bearer <token>`):**
- All `/api/games/*`, `/api/files/*`, `/api/admins/*`, `/api/vpn/status`
- `POST /api/servers/:id/start|stop|restart|reset|rcon`, `DELETE /api/servers/:id/events`
- `POST /api/auth/logout`, `GET /api/auth/me`
- WebSocket `join:logs` and `join:build` rooms (JWT passed on socket connection)

**Permission-gated on top of JWT** (see [Roles: `super_admin` vs `admin`](#key-architectural-decisions) above for the full catalog) — a valid token alone is not enough for these; `requirePermission('<perm>')` checks SQLite fresh per request:
- `servers:power` → start/stop/restart; `servers:reset` → reset, and `DELETE /api/servers/:id/events` (clears the Event History section — same permission since it also wipes any still-active resourceAlert/lastCrash/actionFailure, exactly like reset does)
- `games:create`/`games:edit`/`games:delete` → the matching `/api/games/*` mutation (including avatar upload/removal, Dockerfile save, build, import/export)
- `files:write` → `/api/files/*` mutations (still additionally gated by `requireStopped` — see File Manager Rules)
- `backups:manage` → create/restore/delete/retention (download stays read-only for any admin)
- `console:write` → `POST /api/servers/:id/rcon`, the `console:input` socket event, and any schedule with `action: 'command'`
- `visitors:manage`, `schedules:manage`, `settings:manage` → the matching route group
- `/api/admins/*` (create/edit role & permissions/delete) is `requireSuperAdmin`, not a grantable permission — the only exception is `PATCH /api/admins/me/password`, which any admin can call on themself

---

## WebSocket Rooms

| Room | Auth | Purpose |
|---|---|---|
| `status` | Public | Server status broadcasts to all clients |
| `logs:<id>` | JWT required | Live container log stream for one server |
| `build:<id>` | JWT required | Docker image build output for one game |

**Events on the `status` room:** `status:update` / `status:all` (statuses + players), `players:update` (`{id, players, playerList}` — fired whenever the A2S count or RCON player-list text actually changes, independent of a status transition), `pull:progress` (`{id, phase, percent}` during image downloads), `crash:alert` (`{id, name, status, exitInfo}` — one-shot toast), `crash:update` (`{id, info}` — persistent counterpart to crash:alert; `info` is `{exitCode, oomKilled, error, at}` or `null` once resolved), `resource:update` (`{id, alert}` — persistent counterpart to `server:event`'s `resource_high`; `alert` is `{cpu, memPct, message, since}` or `null` once resolved), `action_failure:update` (`{id, failure}` — persistent counterpart to `server:event`'s `action_failed`, scoped to start/restart only; `failure` is `{action, message, stack, at}` or `null` once resolved), `server:event` (`{type: action_failed | schedule_failed | schedule_executed | build_failed | build_complete | restore_complete | restore_failed | resource_high, …}`), `disk:status` (`{low}` host free-disk transitions), `docker:status` (`{available}` daemon reachability). Emission lives in `backend/src/lib/statusBus.js` — the single owner of lastKnown/transient status and admin-stop marks; the admin frontend listens globally in `ServerEventsBridge` (mounted in the admin layout), which also keeps the socket joined to `status` across navigation/reconnects. A `join:status` snapshot now also includes the last known `playerList`, `resourceAlert`, `lastCrash`, `actionFailure`, and `disk:status`.

A periodic poll (`socketHandlers.js`, every 5s) drives status/A2S player-count checks; every 3rd tick (~15s) it also polls RCON for games with `rcon.listCommand` set to refresh `playerList`; every 12th tick (~60s) it separately checks disk space (`disk:status`) and, for every running game, one-shot container stats to detect sustained high CPU/mem (>90% for 2 consecutive ~60s checks → `resource_high`).

**Events on `logs:<id>`:** `log:line` (`{id, ts, line, level}` — `ts` is the Docker RFC3339 timestamp), `log:history` (ring-buffer replay sent to a socket when it joins; the client dedupes by `ts`), `log:end`. The backend keeps a ~300-line ring buffer per game in `backend/src/lib/logBuffer.js` (`getLogBuffer`/`pushLogBuffer`, extracted out of `socketHandlers.js` so `containers.js` can also inject synthetic system lines via `pushSystemLogLine` — e.g. a failed start/stop shows up in the console even after its toast dismisses). Socket room cleanup must stay on the `disconnecting` event — `socket.rooms` is already empty in `disconnect`, which would leak attached Docker streams. Each stream's `end`/`error` handler must only evict its map slot if it's still the active one (`get(id) === slot`); otherwise a replaced stream's late `end` deletes its successor's slot, orphaning a live stream (double-emit + leak).

**Console = logs + stdin.** There is no separate console output stream/room. The merged Console tab reads output from `logs:<id>` and sends input via the `console:input` socket event, which writes one line through a short-lived **stdin-only** attach (`sendStdinCommand` in `containers.js`, also used by the scheduler's `command` action) — `stdout/stderr` stay off so output is never double-read. Both `console:input` and `command`-action schedules require `console:write`. RCON is a separate channel — `POST /api/servers/:id/rcon`, request/response only, dialed straight to the game's published RCON port (see [RCON is implemented](#key-architectural-decisions) above) — not routed through the container's stdin/stdout at all.

---

## File Manager Rules

- Sandbox: all paths are resolved against `backend/games/<id>/data/` (absolute path via `getDataPath(id)`) — anything that escapes returns 403.
- **Mutations require both the `files:write` permission and a stopped server.** `mkdir`/`upload`/`write`/`rename`/`delete` are gated `requirePermission('files:write')` then `requireStopped` (409, "Stop the server before changing its files") unless the effective status is `stopped`/`not_created`/`error` — a live container may hold files open or overwrite them mid-edit. Read/list/download work for any admin in any state. The admin Files tab mirrors both gates: read-only while the server is running, and again if the admin lacks `files:write`.
- Binary detection: read first 512 bytes, reject if null bytes found.
- Max file size for editing: 512 KB.
- Atomic writes: write to `.tmp` → rename to target.
- Symlinks followed and re-validated against the sandbox before access.

---

## Container States

`not_created` | `running` | `stopped` | `error` | `starting` | `stopping` | `restarting` | `pulling` | `building`

Stable states (`not_created`/`running`/`stopped`/`error`) are always read from Docker — never stored in the app. `pulling`/`starting`/`stopping`/`restarting` are transient states broadcast by `statusBus` while a lifecycle operation is in flight (the status poll skips ids that have one). Every lifecycle phase and failure must be visible to the user: pull progress is streamed, action failures are broadcast as `server:event`, and unexpected exits always produce a `crash:alert` + Discord/push.

---

## What NOT to Do

- Do not store the JWT in localStorage. `sessionStorage` is acceptable (and currently used).
- Do not add a relational/hosted database or any persistent session store. SQLite (`serverdock.db`) is the one sanctioned exception, scoped to exactly the tables already in `db.js`: admins/permissions/visitors/blocklist, plus the bounded `server_events` table (resource/crash alert history — capped at 50 rows/game, see the SQLite bullet above). Don't expand its scope further — no game state, no general logs, nothing Docker/filesystem already owns, and no new table without capping/pruning it the same way.
- Do not bake permission grants into the JWT — they're looked up fresh from SQLite per request specifically so a revoked grant takes effect immediately. `role` is the one thing that *is* JWT-cached; don't change that without accounting for the 24h propagation delay on role changes.
- Do not expose any port to the public internet.
- Do not skip path traversal validation in the file manager.
- Do not allow file mutations (write/upload/rename/delete/mkdir) while the container is running, or without the `files:write` permission — both gates are required.
- Do not change a game's `id` field after creation — it is tied to the container name, volume path, and all API routes.
- Do not set `RestartPolicy` to anything other than `"no"` unless explicitly requested.
- Do not poll `check-update`/registry digests on a timer — it's request-triggered only, to stay clear of Docker Hub's anonymous-pull rate limits.
- Do not join game containers to netbird/tailscale/wireguard/zerotier or otherwise route their traffic through a network provider — every provider is host-level only, used to resolve the host's own connect-info IP.
- Do not add a new network provider by shelling out with `exec()`/string interpolation — every provider under `backend/src/lib/vpn/providers/` uses `execFile()` with an argument array, and any settings-derived value (like `wireguardInterface`) must be validated before it reaches a process argument.

