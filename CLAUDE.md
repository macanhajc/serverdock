# CLAUDE.md — ServerDock

Self-hosted game server manager. Admin controls Docker game containers via a login-protected panel; friends see a read-only status dashboard. Runs on a single Ubuntu machine, VPN-gated, no public internet exposure.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (port 4000) |
| Frontend | React + Vite + Tailwind CSS dark theme (port 3000) |
| Docker control | `dockerode` via `/var/run/docker.sock` |
| Real-time | `socket.io` (same port as backend) |
| Auth | JWT (24h) + bcrypt |
| Game config | JSON files, one per game in `backend/games/<id>/` |
| No database | All state lives in Docker + filesystem |

---

## Directory Structure

```
/home/macanha/Desktop/Projects/ServerDock/   ← dev working directory
├── backend/
│   ├── src/
│   ├── games/                               ← one subfolder per game
│   │   └── <id>/
│   │       ├── <id>.json                    ← game definition
│   │       ├── data/                        ← game server data (world saves, configs)
│   │       └── Dockerfile                   ← Steam/custom games only
│   ├── auth.json                            ← bcrypt-hashed admin credentials
│   ├── setup-auth.js                        ← one-time credential setup script
│   └── .env                                 ← PORT, JWT_SECRET, SERVER_HOST
└── frontend/
    └── src/
        └── data/
            └── templates.js                 ← game preset templates (static)
```

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

- **No database.** Docker is the source of truth for container state. Game configs are JSON files on disk.
- **JWT in `sessionStorage` under key `sd_token`.** Never localStorage. Survives page reload within the same tab; cleared when tab/browser closes. Socket is reconnected on mount if a stored token exists.
- **`SERVER_HOST` env var.** The IP shown in friend connection info comes from `SERVER_HOST` in `backend/.env`. Must be set on install.
- **Data volumes at `backend/games/<id>/data/`** inside the project, mounted into containers at `/data` (path may vary per game image — check template). Absolute path resolved at runtime via `getDataPath(id)` in `gameLoader.js`.
- **Container naming: `serverdock-<id>`.** ID is a lowercase slug, no spaces.
- **`RestartPolicy: { Name: "no" }`** on all containers. Admin controls start/stop. No auto-start on machine reboot.
- **RCON / player management is deferred.** The `players` field always returns `null` for now.
- **No HTTPS.** VPN tunnel handles encryption. Plain HTTP is fine.

---

## Auth Rules

**Public endpoints (no JWT needed):**
- `GET /api/servers`
- `GET /api/servers/:id`
- `POST /api/auth/login`
- `GET /api/health`
- WebSocket `join:status` room

**Protected endpoints (require `Authorization: Bearer <token>`):**
- All `/api/games/*`
- All `/api/files/*`
- `POST /api/servers/:id/start|stop|restart|reset`
- `POST /api/auth/logout`
- WebSocket `join:logs` and `join:build` rooms (JWT passed on socket connection)

---

## WebSocket Rooms

| Room | Auth | Purpose |
|---|---|---|
| `status` | Public | Server status broadcasts to all clients |
| `logs:<id>` | JWT required | Live container log stream for one server |
| `build:<id>` | JWT required | Docker image build output for one game |

**Events on the `status` room:** `status:update` / `status:all` (statuses + players), `pull:progress` (`{id, phase, percent}` during image downloads), `crash:alert` (`{id, name, status, exitInfo}`), `server:event` (`{type: action_failed | schedule_failed | schedule_executed | build_failed | build_complete, …}`), `docker:status` (`{available}` daemon reachability). Emission lives in `backend/src/lib/statusBus.js` — the single owner of lastKnown/transient status and admin-stop marks; the admin frontend listens globally in `ServerEventsBridge` (mounted in the admin layout), which also keeps the socket joined to `status` across navigation/reconnects.

**Events on `logs:<id>`:** `log:line` (`{id, ts, line, level}` — `ts` is the Docker RFC3339 timestamp), `log:history` (ring-buffer replay sent to a socket when it joins; the client dedupes by `ts`), `log:end`. The backend keeps a ~300-line ring buffer per game in `socketHandlers.js`. Socket room cleanup must stay on the `disconnecting` event — `socket.rooms` is already empty in `disconnect`, which would leak attached Docker streams. Each stream's `end`/`error` handler must only evict its map slot if it's still the active one (`get(id) === slot`); otherwise a replaced stream's late `end` deletes its successor's slot, orphaning a live stream (double-emit + leak).

**Console = logs + stdin.** There is no separate console output stream/room. The merged Console tab reads output from `logs:<id>` and sends input via the `console:input` socket event, which writes one line through a short-lived **stdin-only** attach (`sendStdinCommand` in `containers.js`, also used by the scheduler's `command` action) — `stdout/stderr` stay off so output is never double-read. RCON is unrelated: `POST /api/servers/:id/rcon`, request/response only.

---

## File Manager Rules

- Sandbox: all paths are resolved against `backend/games/<id>/data/` (absolute path via `getDataPath(id)`) — anything that escapes returns 403.
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
- Do not add a relational database or any persistent session store.
- Do not expose any port to the public internet.
- Do not skip path traversal validation in the file manager.
- Do not change a game's `id` field after creation — it is tied to the container name, volume path, and all API routes.
- Do not set `RestartPolicy` to anything other than `"no"` unless explicitly requested.
- Do not implement RCON player management yet — it is deferred.

