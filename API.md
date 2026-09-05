# ServerDock — API & WebSocket Reference

All protected routes take `Authorization: Bearer <token>`. Some of those additionally require a specific permission — see [Permission-gated](#permission-gated), checked fresh against SQLite on every request. This is a route-by-route summary; for exact request/response shapes see the corresponding file under `backend/src/routes/`.

- [Public endpoints](#public-no-auth)
- [Authenticated — any admin](#authenticated--any-admin)
- [Permission-gated](#permission-gated)
- [Super-admin only](#super-admin-only)
- [WebSocket](#websocket)

---

## Public (no auth)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Docker connectivity + host info |
| `GET` | `/api/servers` | All servers — status, players, disk usage, uptime |
| `GET` | `/api/servers/:id` | Single server status |
| `GET` | `/api/servers/:id/avatar` | Server cover image (404 if none set) |
| `POST` | `/api/auth/login` | Obtain a JWT — rate-limited (10 requests / 15 min / IP) |
| `GET` | `/api/auth/setup-status` | Whether first-run setup is still needed |
| `POST` | `/api/auth/setup` | One-time: create the first admin (fails once one exists) — rate-limited (10 / 15 min / IP) |
| `POST` | `/api/visitors/identify` | Register or re-identify a visitor by display name |
| `GET` | `/api/settings/public` | `registrationOpen` + `networkProvider` — just enough for the public dashboard's connect UI |
| `GET` | `/api/push/vapid-public-key` | VAPID key for push subscription (503 if push isn't configured yet) |

## Authenticated — any admin

No specific permission required beyond a valid, non-revoked JWT.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/logout` | Revoke the current token (`jti`) |
| `GET` | `/api/auth/me` | Who am I |
| `PATCH` | `/api/admins/me/password` | Change your own password — the one admin mutation that isn't super-admin-only |
| `GET` | `/api/admins` · `/api/admins/permissions` | Read-only admin roster + permission catalog |
| `GET` | `/api/servers/:id/events` | Resource/crash/action-failure event history |
| `GET` | `/api/games` · `/api/games/:id` | List / read game configs |
| `GET` | `/api/games/:id/export` | Portable config export |
| `POST` | `/api/games/:id/check-update` | Compare local image digest vs. registry (no pull) |
| `GET` | `/api/files/:id` · `/:id/read` · `/:id/download` | File manager — read/list/download work in any server state |
| `GET` | `/api/backups/:id` | List backups for a game |
| `GET` | `/api/backups/:id/:backupId/download` | Download a backup (read-only, no permission gate) |
| `GET` | `/api/schedules/:id` | List a game's cron schedules |
| `GET` | `/api/docker/summary` · `/images` · `/images/:id` · `/containers` · `/containers/:id` | Raw Docker inventory (read) |
| `GET` | `/api/visitors` · `/api/visitors/blocklist` | Visitor list + IP blocklist (read) |
| `GET` | `/api/settings` | Current settings (secrets excluded) |
| `GET` | `/api/vpn/status` | Active provider's self/peer info |
| `POST` | `/api/push/subscribe` · `DELETE /subscribe` · `POST /test` | Push subscription management |

## Permission-gated

Valid JWT **and** the named permission (see the catalog in [CLAUDE.md](CLAUDE.md#key-architectural-decisions)).

| Permission | Method | Endpoint | Purpose |
|---|---|---|---|
| `servers:power` | `POST` | `/api/servers/:id/start` \| `/stop` \| `/restart` | Lifecycle actions |
| `servers:reset` | `POST` | `/api/servers/:id/reset` | Wipe and recreate the container |
| `servers:reset` | `DELETE` | `/api/servers/:id/events` | Clear event history (also clears any still-active alert) |
| `console:write` | `POST` | `/api/servers/:id/rcon` | Send an RCON command |
| `console:write` | socket | `console:input` | Write one line to the container's stdin |
| `games:create` | `POST` | `/api/games` · `/api/games/import` | Create / import a game |
| `games:edit` | `PUT` | `/api/games/:id` | Update a game config |
| `games:edit` | `GET`/`POST` | `/api/games/:id/dockerfile` | Read/save a custom Dockerfile |
| `games:edit` | `POST` | `/api/games/:id/build` | Build the local image (streams to `build:<id>`) |
| `games:edit` | `POST`/`DELETE` | `/api/games/:id/avatar` | Upload/remove cover image |
| `games:delete` | `DELETE` | `/api/games/:id` | Delete a game and its config |
| `files:write` | `POST`/`PUT`/`PATCH`/`DELETE` | `/api/files/:id/mkdir` \| `/upload` \| `/write` \| `/rename` \| `/delete` | File mutations — additionally gated by `requireStopped` (409 while the container is running) |
| `backups:manage` | `PUT` | `/api/backups/:id/retention` | Set keep-last-N policy |
| `backups:manage` | `POST` | `/api/backups/:id` | Create a backup |
| `backups:manage` | `POST` | `/api/backups/:id/:backupId/restore` | Restore (auto stop/restart around the swap) |
| `backups:manage` | `DELETE` | `/api/backups/:id/:backupId` | Delete a backup |
| `schedules:manage` | `POST`/`PUT`/`DELETE` | `/api/schedules/:id[/:scheduleId]` | Schedule CRUD |
| `schedules:manage` | `POST` | `/api/schedules/:id/:scheduleId/run` | Run a schedule now |
| `schedules:manage` **+** `console:write` | — | a `command`-type schedule | Scheduled console commands need both, since they're equivalent to console access |
| `visitors:manage` | `PATCH` | `/api/visitors/:id/block` \| `/unblock` | Block/unblock a visitor |
| `visitors:manage` | `DELETE` | `/api/visitors/:id` | Remove a visitor (IP block persists) |
| `visitors:manage` | `DELETE` | `/api/visitors/blocklist/:ip` | Remove an IP block |
| `settings:manage` | `PUT` | `/api/settings` | Update settings |
| `settings:manage` | `POST` | `/api/settings/notify/test-discord` | Send a test Discord message |
| `settings:manage` | `POST` | `/api/settings/wipe-all` | Factory reset — resets every configured game's container |
| `docker.js` deletes | `DELETE` | `/api/docker/images/:id` · `/api/docker/containers/:id` | Raw Docker inventory cleanup — JWT only, no dedicated permission |

## Super-admin only

`requireSuperAdmin` — a plain `admin`, no matter what's granted, gets 403.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/admins` | Create an admin |
| `PATCH` | `/api/admins/:id` | Edit role/permissions |
| `PATCH` | `/api/admins/:id/password` | Reset another admin's password |
| `DELETE` | `/api/admins/:id` | Delete an admin (the last `super_admin` can't be deleted) |

---

## WebSocket

| Room | Auth | Join event | Purpose |
|---|---|---|---|
| `status` | Public | `join:status` (also `leave:status`) | Live server status broadcasts to every client |
| `logs:<id>` | JWT | `join:logs` (also `leave:logs`) | Live container log stream — also the Console tab's output feed |
| `build:<id>` | JWT | `join:build` (also `leave:build`) | Docker image build output |
| `stats:<id>` | JWT | `join:stats` (also `leave:stats`) | Live CPU/memory/network stats for one server |

**Client → server:** `join:status`/`leave:status`, `join:logs`/`leave:logs`, `join:build`/`leave:build`, `join:stats`/`leave:stats`, `console:input` (`{ id, input }`, requires `console:write`).

**On `status`:**

| Event | Payload | Fires when |
|---|---|---|
| `status:all` | full snapshot | sent to a socket right after `join:status` |
| `status:update` | `{ id, status, players }` | a server's status or player count changes |
| `players:update` | `{ id, players, playerList }` | the A2S count or RCON player-list text changes, independent of a status change |
| `pull:progress` | `{ id, phase, percent }` | during an image pull |
| `crash:alert` | `{ id, name, status, exitInfo }` | one-shot toast on an unexpected exit |
| `crash:update` | `{ id, info \| null }` | persistent counterpart to `crash:alert`; `null` once resolved |
| `resource:update` | `{ id, alert \| null }` | sustained high CPU/RAM crosses or clears the threshold |
| `action_failure:update` | `{ id, failure \| null }` | a start/restart attempt fails or later succeeds |
| `server:event` | `{ type, ... }` | `action_failed`, `schedule_failed`, `schedule_executed`, `build_failed`, `build_complete`, `restore_complete`, `restore_failed`, or `resource_high` |
| `disk:status` | `{ low }` | host free-disk crosses the low-space threshold |
| `docker:status` | `{ available }` | the Docker daemon becomes reachable/unreachable |

**On `logs:<id>`:** `log:line` (`{ id, ts, line, level }`), `log:history` (ring-buffer replay on join), `log:end`.

**On `build:<id>`:** `build:line` (`{ id, line }`), `build:complete` (`{ id, success: true }`), `build:failed` (`{ id, success: false, error }`).

**On `stats:<id>`:** `stats:update` (`{ id, cpu, memUsed, memLimit, netInRate, netOutRate }`).

See [CLAUDE.md](CLAUDE.md#websocket-rooms) for the invariants behind these events (e.g. why resolution re-checks every tick rather than only on the transition).
