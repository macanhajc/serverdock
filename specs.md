# ServerDock — Technical Specification

**Version:** 2.0  
**Stack:** Node.js 24 LTS + Express v5 · React 19 + Vite + Tailwind CSS v4 · dockerode v4 · Socket.io v4 · JWT + bcrypt  
**Target OS:** Ubuntu/Debian (single dedicated machine)

---

## 1. Overview

ServerDock is a self-hosted web application for managing game servers running as Docker containers on a single Linux machine. It has two audiences:

- **Admin** — controls everything via a login-protected panel
- **Friends** — view a read-only dashboard showing which servers are online

Access is restricted by VPN at the network level. The app is never exposed to the public internet.

### Goals
- Start, stop, restart, and reset game server containers
- Add games via UI with preset templates (Minecraft, Valheim, CS2, ARK, Rust, Terraria, Factorio)
- Support public Docker Hub images and Steam/custom games built from Dockerfiles
- Stream live container logs and Docker build output to the browser
- Interactive terminal (stdin) and RCON console per server
- Browse and edit text files inside game data volumes
- Live resource monitoring: CPU, memory, network I/O, disk usage per container
- Per-game cron schedules: auto-start, stop, restart, or send commands
- Crash notifications via Discord webhook and browser push (Web Push / VAPID)
- Create, restore, download, and delete `.tar.gz` backups of server data directories
- Browse and manage Docker images and containers on the host
- Give friends a clean status page (no login required)

### Out of Scope
- Multi-machine / distributed hosting
- Public internet access
- HTTPS (VPN provides encryption)
- Auto-scaling, load balancing
- Automatic container restart on machine reboot
- Self-registration (single admin account only)

---

## 2. Users & Roles

| Role | Access requirement | Capabilities |
|---|---|---|
| Admin | VPN + username/password login | Full control: start, stop, restart, reset, logs, console, RCON, files, schedules, game management, notifications |
| Friend | VPN only (no login) | Read-only: server status, player count, connection info |

---

## 3. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Dedicated Linux Machine                │
│                                                         │
│  ┌─────────────┐        ┌─────────────────────────┐    │
│  │  React App  │◄──────►│   Node.js / Express API  │    │
│  │  (port 3000)│  HTTP  │       (port 4000)        │    │
│  │             │◄──────►│       + Socket.io        │    │
│  └─────────────┘  WS    └────────────┬─────────────┘    │
│                                      │ dockerode        │
│                         /var/run/docker.sock             │
│                                      │                  │
│              ┌───────────────────────┼────────────────┐ │
│   ┌──────────▼──────┐   ┌────────────▼──────┐        │ │
│   │ serverdock-mc   │   │ serverdock-valheim │  ...  │ │
│   │ port: 25565     │   │ port: 2456-2458    │        │ │
│   └──────────┬──────┘   └────────────┬──────┘        │ │
│   /data/minecraft/      /data/valheim/                │ │
│   (host volume)         (host volume)                 │ │
└─────────────────────────────────────────────────────────┘
          ▲                        ▲
          │   (VPN required)       │
    ┌─────┴──────┐          ┌──────┴─────┐
    │   Admin    │          │   Friend   │
    │  Browser   │          │  Browser   │
    └────────────┘          └────────────┘
```

### Components

| Component | Description |
|---|---|
| React frontend | SPA served from Vite dev server (dev) or Express static (prod). Dark theme. Two views: public dashboard and admin panel. |
| Express backend | REST API + Socket.io. Parses game configs on startup. Controls Docker via dockerode. Handles auth, scheduling, and notifications. |
| dockerode | Node.js library communicating with Docker via `/var/run/docker.sock`. |
| Game containers | Each game is an isolated Docker container. Named `serverdock-<id>`. |
| Data volumes | `backend/games/<id>/data/` inside the project, mounted into containers at the path specified by `dataMount` in each game's JSON. |
| Scheduler | `node-cron` job runner; schedules persisted in each game's JSON file under `schedules[]`. |
| Notifier | `web-push` (VAPID) for browser push; native `fetch` for Discord webhooks. |

### Port Map

| Service | Port | Protocol |
|---|---|---|
| React dev server | 3000 | HTTP |
| Express API + Socket.io | 4000 | HTTP + WS |
| Minecraft | 25565 | TCP |
| Valheim | 2456–2458 | UDP |
| CS2 | 27015 | TCP + UDP |
| ARK | 7777 | UDP |
| Rust | 28015 | UDP |
| Terraria | 7777 | TCP |
| Factorio | 34197 | UDP |

---

## 4. Directory Structure

```
/opt/serverdock/                  ← production root
├── backend/
│   ├── src/
│   │   ├── index.js              # Express + Socket.IO entry point; VAPID key bootstrap
│   │   ├── middleware/auth.js    # JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.js           # POST /api/auth/login|logout
│   │   │   ├── servers.js        # GET|POST /api/servers (+ RCON)
│   │   │   ├── games.js          # CRUD /api/games
│   │   │   ├── files.js          # File manager /api/files
│   │   │   ├── schedules.js      # Cron schedules /api/schedules
│   │   │   ├── backups.js        # Backup CRUD /api/backups
│   │   │   ├── docker.js         # Docker image/container management /api/docker
│   │   │   ├── visitors.js       # Visitor tracking /api/visitors
│   │   │   ├── push.js           # Web Push /api/push
│   │   │   ├── vpn.js            # VPN status /api/vpn/status
│   │   │   └── settings.js       # Admin settings /api/settings
│   │   └── lib/
│   │       ├── backupManager.js  # tar.gz backup creation, restore, list, and delete
│   │       ├── containers.js     # Docker start/stop/restart/reset helpers
│   │       ├── diskUtils.js      # getDirSize (du -sb), getHostDiskInfo (statfs)
│   │       ├── docker.js         # Dockerode client singleton + availability check
│   │       ├── gameLoader.js     # Load/save game JSON configs; getDataPath()
│   │       ├── logger.js         # Pino structured logger
│   │       ├── notifier.js       # Discord webhook + Web Push crash notifications
│   │       ├── playerQuery.js    # A2S (Valve Source Engine Query) player count
│   │       ├── rcon.js           # RCON command sender via rcon-client
│   │       ├── scheduler.js      # node-cron job registry; initScheduler, reloadGameSchedules
│   │       ├── settingsStore.js  # Read/write settings.json
│   │       ├── socket.js         # Socket.io server singleton
│   │       ├── socketHandlers.js # WebSocket rooms: status, logs, console, build, stats
│   │       ├── statsStreams.js   # Docker stats stream manager (CPU/mem/net per container)
│   │       ├── visitorStore.js   # Visitor persistence (visitors.json)
│   │       └── vpn/              # NetBird + WireGuard adapters
│   ├── games/
│   │   ├── minecraft/
│   │   │   ├── minecraft.json
│   │   │   └── data/             ← game server data (world saves, configs)
│   │   └── cs2/
│   │       ├── cs2.json
│   │       ├── data/
│   │       └── Dockerfile
│   ├── auth.json                 ← { username, passwordHash }
│   ├── settings.json             ← runtime settings (serverHost, VAPID keys, push subs, …)
│   ├── setup-auth.js             ← one-time credential setup CLI
│   └── .env                     ← PORT, JWT_SECRET, SERVER_HOST, CORS_ORIGIN, VPN_PROVIDER
└── frontend/
    └── src/
        ├── pages/
        │   ├── public/
        │   │   ├── Dashboard/    # Friend status view
        │   │   └── Blocked/      # Visitor registration closed
        │   ├── auth/             # Login page
        │   └── private/
        │       ├── Dashboard/    # Admin monitoring table + global stats card
        │       ├── ServerDetail/ # Per-server tabs: Info, Logs, Console, Files, Schedule, Backups
        │       ├── GameForm/     # Create/edit game config + Dockerfile
        │       ├── DockerPage/   # Docker image and container manager
        │       ├── NetworkPage/  # VPN status and peers
        │       ├── VisitorsPage/ # Visitor management
        │       └── SettingsPage/ # Admin settings + notifications
        ├── components/
        ├── context/
        ├── data/templates.ts
        ├── socket.ts
        ├── i18n.ts
        └── locales/
            ├── en.json
            └── pt-BR.json
```

### `.env` Variables

```
PORT=4000
JWT_SECRET=changeme
SERVER_HOST=192.168.1.10
CORS_ORIGIN=http://192.168.1.10:3000
VPN_PROVIDER=netbird          # or 'wireguard'
```

### `settings.json` Fields

Managed at runtime via `/api/settings`. Do not edit by hand while the backend is running.

| Key | Description |
|---|---|
| `serverHost` | Fallback IP shown to friends when VPN IP is unavailable |
| `dataRoot` | Override for the base path of game data directories |
| `registrationOpen` | Whether friends can self-register on the public dashboard |
| `discordWebhookUrl` | Discord webhook URL for crash notifications |
| `vapidPublicKey` | Auto-generated VAPID public key (do not change) |
| `vapidPrivateKey` | Auto-generated VAPID private key (do not change) |
| `pushSubscriptions` | Array of Web Push subscription objects |

---

## 5. Game Config Format

Game definitions are stored as individual JSON files: one folder per game under `backend/games/<id>/`.

### Public Image Game

```json
{
  "id": "minecraft",
  "name": "Minecraft",
  "description": "Java Edition survival server",
  "imageSource": "public",
  "image": "itzg/minecraft-server",
  "ports": [
    { "host": 25565, "container": 25565, "protocol": "tcp" }
  ],
  "environment": [
    { "key": "EULA", "value": "TRUE" },
    { "key": "MEMORY", "value": "4G", "pinned": true }
  ],
  "dataMount": "/data",
  "query": { "type": "a2s", "port": 25565 },
  "rcon": { "enabled": true, "port": 25575, "password": "changeme" }
}
```

### Steam / Custom (Local Build) Game

```json
{
  "id": "cs2",
  "name": "CS2",
  "description": "Counter-Strike 2 dedicated server",
  "imageSource": "local",
  "image": "serverdock-cs2",
  "buildContext": "./games/cs2",
  "imageBuilt": false,
  "ports": [
    { "host": 27015, "container": 27015, "protocol": "tcp" },
    { "host": 27015, "container": 27015, "protocol": "udp" }
  ],
  "environment": [
    { "key": "STEAM_APP_ID", "value": "730" }
  ],
  "cpuLimit": 2.0,
  "memoryLimit": 4096,
  "rcon": { "enabled": true, "port": 27015, "password": "changeme" }
}
```

### Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique slug. Lowercase, no spaces. Used in container name, API routes, folder name. Never change after creation. |
| `name` | ✅ | Display name |
| `description` | ❌ | Short text shown in UI |
| `imageSource` | ✅ | `"public"` or `"local"` |
| `image` | ✅ | Docker Hub image (public) or local tag `serverdock-<id>` (local) |
| `buildContext` | ✅ if local | Path to Dockerfile folder, relative to backend root |
| `imageBuilt` | ✅ if local | `true` once built; `false` otherwise |
| `ports` | ✅ | Array of `{ host, container, protocol }` |
| `environment` | ❌ | Array of `{ key, value, pinned? }` — `pinned: true` surfaces the value on server cards |
| `dataMount` | ❌ | Container path for `backend/games/<id>/data/` (default `/data`) |
| `cpuLimit` | ❌ | Fractional CPU cores (e.g. `2.0` = 200% of one core). Sets Docker `NanoCpus`. |
| `memoryLimit` | ❌ | Memory limit in MB. Sets Docker `Memory`. Shown alongside live usage. |
| `query` | ❌ | `{ type: "a2s", port: <n> }` — enables live player count via A2S protocol |
| `rcon` | ❌ | `{ enabled, port, password }` — enables RCON console in the UI |
| `schedules` | ❌ | Array of schedule objects (managed by the UI; see §10) |

### Game Templates (`frontend/src/data/templates.ts`)

| Template | Type | Image | Ports |
|---|---|---|---|
| Minecraft | Public | `itzg/minecraft-server` | 25565 TCP |
| Valheim | Public | `lloesche/valheim-server` | 2456–2458 UDP |
| Terraria | Public | `ryshe/terraria` | 7777 TCP |
| Factorio | Public | `factoriotools/factorio` | 34197 UDP |
| CS2 | Steam | SteamCMD Dockerfile | 27015 TCP+UDP |
| ARK | Steam | SteamCMD Dockerfile | 7777 UDP |
| Rust | Steam | SteamCMD Dockerfile | 28015 UDP |

---

## 6. Container Lifecycle

### States

| State | Meaning | Badge |
|---|---|---|
| `not_created` | No container exists yet | ⚫ Not Created |
| `running` | Container active | 🟢 Online |
| `stopped` | Container exists but not running | 🔴 Offline |
| `starting` | Just started, game initializing | 🟡 Starting |
| `restarting` | Docker restarting | 🟡 Restarting |
| `pulling` | Pulling Docker Hub image | 🟡 Pulling Image |
| `building` | Building local Dockerfile image | 🟡 Building Image |

State is always read from Docker — never stored in the app.

### Container Creation Config

```javascript
{
  name: "serverdock-<id>",
  Image: "<image>",
  Env: ["KEY=VALUE", ...],
  HostConfig: {
    PortBindings: { "<port>/tcp": [{ HostPort: "<port>" }] },
    Binds: [`${getDataPath(id)}:<dataMount>`],
    RestartPolicy: { Name: "no" },
    NanoCpus: cpuLimit ? cpuLimit * 1e9 : undefined,
    Memory: memoryLimit ? memoryLimit * 1024 * 1024 : undefined,
  }
}
```

### Operations

**Start** (`POST /api/servers/:id/start`)
1. If `imageSource: local` and `imageBuilt: false` → 400: "Build the image before starting"
2. If `imageSource: public` and image not present locally → pull (emit `pulling` status)
3. If container exists and stopped → start it
4. If container does not exist → create and start
5. Emit `status:update { status: "running" }`

**Stop** (`POST /api/servers/:id/stop`)
1. Mark as admin-initiated stop (suppresses crash notification)
2. `container.stop()` — SIGTERM, wait 10 s, then SIGKILL
3. Container remains on disk; data preserved
4. Emit `status:update { status: "stopped" }`

**Restart** (`POST /api/servers/:id/restart`)
1. `container.restart()`
2. Emit `restarting` → `running`

**Reset** (`POST /api/servers/:id/reset`) ⚠️ Destructive
1. Stop container if running
2. `container.remove()`
3. `rm -rf backend/games/<id>/data/*` (via `getDataPath(id)`)
4. Recreate empty data dir
5. Emit `status:update { status: "not_created" }`
6. Image is NOT removed

**Build Image** (`POST /api/games/:id/build`) — Steam/custom only
1. Locate `./games/<id>/Dockerfile`
2. `dockerode.buildImage()` with build context
3. Stream output line-by-line via `build:<id>` WebSocket room
4. On success: set `imageBuilt: true` in JSON, emit `build:complete`
5. On failure: `imageBuilt` stays `false`, emit `build:failed`

**RCON** (`POST /api/servers/:id/rcon`)
1. Inspect container to get its bridge network IP
2. Open TCP connection via `rcon-client` with game's `rcon.port` and `rcon.password`
3. Send command, return response
4. Connection closed after each command (stateless per request)

### Crash Detection

The 30-second polling loop (in `socketHandlers.js`) compares the current container state against the last known state. If a container transitions to `stopped` without being explicitly stopped by the admin, `sendCrashNotification(game)` is called.

### Error Handling

| Scenario | Response |
|---|---|
| Image not built (local game) | 400: "Build the image before starting" |
| Image pull fails | 500 with Docker error |
| Container already running on start | 409: "Server is already running" |
| Container not found on stop/restart | 404: "Server is not running" |
| Docker daemon unreachable | 503: "Docker unavailable" |
| Reset without `confirm: true` | 400: "Reset not confirmed" |
| Delete game while running | 409: "Stop the server before deleting the game" |
| File mutation (write/upload/rename/delete/mkdir) while server running | 409: "Stop the server before changing its files" |
| RCON not configured | 400: "RCON not configured" |
| RCON connection failed | 502 with error message |

---

## 7. Auth & Access

### Admin Credentials

Stored in `backend/auth.json`:
```json
{
  "username": "admin",
  "passwordHash": "$2b$12$..."
}
```

Created once via: `node setup-auth.js --username admin --password yourpassword`  
To change password: re-run the script (overwrites the file).

### Login Flow

```
POST /api/auth/login { username, password }
  → backend reads auth.json, bcrypt.compare()
  → success: return { token, expiresIn: 86400 }
  → failure: 401 { error: "Invalid credentials" }

Frontend stores token in sessionStorage (key: sd_token) and React context.
Socket reconnects on mount if a stored token is found.
```

### JWT Details

- Signed with `JWT_SECRET` from `.env`
- Expiry: 24 hours
- Passed as: `Authorization: Bearer <token>`
- For WebSocket auth: `io(url, { auth: { token } })`

### Endpoint Auth Table

| Endpoint | Auth |
|---|---|
| `GET /api/health` | Public |
| `GET /api/servers` | Public |
| `GET /api/servers/:id` | Public |
| `POST /api/auth/login` | Public |
| `GET /api/settings/public` | Public |
| `GET /api/push/vapid-public-key` | Public |
| `POST /api/visitors/identify` | Public |
| `POST /api/auth/logout` | JWT |
| `POST /api/servers/:id/start\|stop\|restart\|reset` | JWT |
| `POST /api/servers/:id/rcon` | JWT |
| `GET\|POST\|PUT\|DELETE /api/games/*` | JWT |
| `POST /api/games/:id/build\|dockerfile` | JWT |
| `GET /api/files/:id` · `/read` · `/download` | JWT |
| `POST /api/files/:id/mkdir\|upload` · `PUT /write` · `PATCH /rename` · `DELETE /delete` | JWT — server must be stopped (409 otherwise) |
| `GET\|POST\|PUT\|DELETE /api/schedules/:id/*` | JWT |
| `GET\|POST /api/backups/:id` | JWT |
| `GET /api/backups/:id/:backupId/download` | JWT or `?token=` |
| `POST\|DELETE /api/backups/:id/:backupId` | JWT |
| `GET\|DELETE /api/docker/images/*` | JWT |
| `GET\|DELETE /api/docker/containers/*` | JWT |
| `GET\|DELETE /api/visitors/*` | JWT |
| `GET\|PUT /api/settings` | JWT |
| `POST\|DELETE /api/push/subscribe` | JWT |
| `POST /api/push/test` | JWT |
| `GET /api/vpn/status` | JWT |
| WebSocket `join:status` | Public |
| WebSocket `join:logs`, `join:console`, `join:build`, `join:stats` | JWT on connect |

---

## 8. API Reference

### Auth

**`POST /api/auth/login`**
```json
// Request
{ "username": "admin", "password": "yourpassword" }
// 200
{ "token": "<jwt>", "expiresIn": 86400 }
// 401
{ "error": "Invalid credentials" }
```

**`POST /api/auth/logout`** — JWT  
`200 { "message": "Logged out" }`

---

### Servers

**`GET /api/servers`** — public
```json
[
  {
    "id": "minecraft",
    "name": "Minecraft",
    "description": "Java Edition survival server",
    "image": "itzg/minecraft-server",
    "status": "running",
    "players": 3,
    "connection": { "host": "100.x.x.x", "port": 25565, "protocol": "tcp" },
    "imageSource": "public",
    "imageBuilt": null,
    "ports": [{ "host": 25565, "container": 25565, "protocol": "tcp" }],
    "cpuLimit": null,
    "memoryLimit": null,
    "dataMount": "/data",
    "pinnedEnv": [{ "key": "MEMORY", "value": "4G" }],
    "diskUsed": 1073741824,
    "startedAt": "2026-06-09T10:00:00.000Z",
    "query": { "type": "a2s", "port": 25565 },
    "rcon": { "enabled": true, "port": 25575 }
  }
]
```

Notes:
- `players` is an integer for games with `query` configured and running; `null` otherwise.
- `imageBuilt` is `null` for public games, `true/false` for local builds.
- `connection.host` comes from VPN IP → `serverHost` setting → `SERVER_HOST` env var, in that priority order.
- `diskUsed` is bytes consumed by `backend/games/<id>/data/`.
- `startedAt` is the container start timestamp from Docker inspect; `null` if not running.
- `rcon.password` is never returned to the client.

**`POST /api/servers/:id/rcon`** — JWT  
Request: `{ "command": "say hello" }`  
`200 { "response": "..." }` | `400` RCON not configured | `502` connection error

---

### Games

**`GET /api/games`** — JWT  
Returns array of full game definition objects (including `schedules`).

**`POST /api/games`** — JWT  
Creates new game: writes JSON file + folder, reloads in-memory list.  
`201 { "id": "minecraft", "message": "Game created" }` | `409` ID already exists

**`PUT /api/games/:id`** — JWT  
Updates game JSON. Changes take effect on next container start.  
`200 { "message": "Game updated" }` — changing `id` is not supported.

**`DELETE /api/games/:id`** — JWT  
Removes game folder (JSON + Dockerfile). Container, image, and data NOT deleted.  
`200 { "message": "Game deleted" }` | `409` server must be stopped first

---

### Schedules

**`GET /api/schedules/:id`** — JWT  
Returns array of schedule objects for the game.

**`POST /api/schedules/:id`** — JWT
```json
// Request
{
  "label": "Daily restart",
  "action": "restart",
  "cron": "0 4 * * *",
  "timezone": "America/Sao_Paulo",
  "enabled": true
}
// 201 — returns the created schedule object with generated id
```

**`PUT /api/schedules/:id/:scheduleId`** — JWT  
Partial update; all fields optional. Validates cron expression and timezone.  
`200` — returns updated schedule object.

**`POST /api/schedules/:id/:scheduleId/run`** — JWT  
Triggers the schedule action immediately.  
`200` — returns updated schedule with `lastRun` set | `502` action failed.

**`DELETE /api/schedules/:id/:scheduleId`** — JWT  
`200 { "ok": true }`

#### Schedule Object

```json
{
  "id": "<uuid>",
  "label": "Daily restart",
  "action": "restart",
  "cron": "0 4 * * *",
  "timezone": "America/Sao_Paulo",
  "enabled": true,
  "lastRun": { "at": "2026-06-09T04:00:00.000Z", "ok": true }
}
```

| Field | Values | Notes |
|---|---|---|
| `action` | `start`, `stop`, `restart`, `command` | |
| `command` | string | Required when `action` is `command`; sent to container stdin |
| `cron` | 5-field cron expression | Validated with `node-cron` |
| `timezone` | IANA timezone string | Optional; defaults to server local time |
| `enabled` | boolean | Disabled schedules are not run |
| `lastRun` | `{ at, ok }` | Set automatically after each execution |

---

### Backups

Backups are stored as `.tar.gz` archives in `backend/games/<id>/backups/`. Each backup has a JSON sidecar with metadata.

**`GET /api/backups/:id`** — JWT  
Returns array of backup entries sorted newest-first.
```json
[
  {
    "id": "<uuid>",
    "label": "Before update",
    "createdAt": "2026-06-09T10:00:00.000Z",
    "size": 1073741824
  }
]
```
`label` is omitted if not provided at creation time.

**`POST /api/backups/:id`** — JWT  
Body: `{ "label": "optional label" }` (label is optional)  
`201` — returns the created backup entry | `500` if `tar` fails.

**`GET /api/backups/:id/:backupId/download`** — JWT or `?token=<jwt>`  
Streams the `.tar.gz` archive as `application/gzip`. Accepts the JWT via `Authorization: Bearer` header **or** a `?token=` query parameter (to support direct browser download links).  
`404` if archive not found.

**`POST /api/backups/:id/:backupId/restore`** — JWT  
Stops the container (if running), wipes the data directory, extracts the backup, then restarts (if it was running).  
`200 { "ok": true, "wasRunning": true }` | `404` backup not found.

**`DELETE /api/backups/:id/:backupId`** — JWT  
Removes the archive and sidecar. Silently succeeds if already gone.  
`200 { "ok": true }`

---

### Docker Management

**`GET /api/docker/images`** — JWT  
Returns all Docker images on the host (non-intermediate).
```json
[
  {
    "id": "sha256:abc123...",
    "shortId": "abc123def456",
    "tags": ["itzg/minecraft-server:latest"],
    "size": 524288000,
    "created": 1717920000
  }
]
```

**`DELETE /api/docker/images/:id`** — JWT  
Force-removes a Docker image by ID or tag.  
`200 { "message": "Image removed" }` | `404` not found | `409` image is in use.

**`GET /api/docker/containers`** — JWT  
Returns all Docker containers (running and stopped).
```json
[
  {
    "id": "abc123...",
    "shortId": "abc123def456",
    "names": ["serverdock-minecraft"],
    "image": "itzg/minecraft-server",
    "state": "running",
    "status": "Up 2 hours",
    "created": 1717920000
  }
]
```

**`DELETE /api/docker/containers/:id`** — JWT  
Force-removes a Docker container.  
`200 { "message": "Container removed" }` | `404` not found.

---

### Push Notifications

**`GET /api/push/vapid-public-key`** — public  
`200 { "publicKey": "<base64url>" }` | `503` push not configured

**`POST /api/push/subscribe`** — JWT  
Body: standard Web Push subscription object (`endpoint`, `keys.p256dh`, `keys.auth`).  
`200 { "ok": true }` — deduplicates by endpoint.

**`DELETE /api/push/subscribe`** — JWT  
Body: `{ "endpoint": "..." }`  
`200 { "ok": true }`

**`POST /api/push/test`** — JWT  
Sends a test push to the given endpoint (or all subscribed browsers if no endpoint given).  
`200 { "ok": true }` | `400` no matching subscription

---

### Files

**`GET /api/files/:id?path=<relative-path>`** — JWT
```json
{
  "path": "/",
  "entries": [
    { "name": "server.properties", "type": "file", "size": 1420, "modified": "2026-01-10T14:32:00Z" },
    { "name": "world", "type": "directory", "size": null, "modified": "2026-01-10T14:00:00Z" }
  ]
}
```
Sorted: directories first, then files, both alphabetical.

**`GET /api/files/:id/read?path=<file-path>`** — JWT  
`200 { "path": "server.properties", "content": "..." }` | `400` binary | `400` >512 KB | `403` path traversal

**`GET /api/files/:id/download?path=<file-path>`** — JWT  
Streams the raw file as `application/octet-stream` with a `Content-Disposition` attachment. `400` not a file | `403` path traversal | `404` not found.

> **The five mutation routes below require a stopped server.** A `requireStopped`
> guard returns `409 { "error": "Stop the server before changing its files" }`
> unless the effective container status is `stopped`, `not_created`, or `error`.
> For `upload` the guard runs before the file is buffered. The read/list/download
> routes above are available in any state.

**`POST /api/files/:id/mkdir`** — JWT · server stopped  
Body: `{ "path": "config/mods" }` — creates the directory recursively.  
`201 { "message": "Folder created" }` | `403` path traversal | `409` server running

**`POST /api/files/:id/upload?path=<dir>`** — JWT · server stopped  
`multipart/form-data` with one or more `files` fields (max 100 MB each). Filenames are stripped of path separators.  
`200 { "uploaded": [{ "name": "...", "size": 1234 }] }` | `400` no files | `409` server running

**`PUT /api/files/:id/write`** — JWT · server stopped  
Body: `{ "path": "server.properties", "content": "..." }`  
`200 { "message": "File saved" }` — written atomically (tmp → rename) | `409` server running

**`PATCH /api/files/:id/rename`** — JWT · server stopped  
Body: `{ "path": "old.txt", "newName": "new.txt" }` — `newName` may not contain path separators.  
`200 { "message": "Renamed" }` | `403` path traversal | `404` not found | `409` server running

**`DELETE /api/files/:id/delete`** — JWT · server stopped  
Body: `{ "path": "world" }` — removes a file or directory tree.  
`200 { "message": "Deleted" }` | `403` path traversal | `404` not found | `409` server running

---

### Health

**`GET /api/health`** — public
```json
{
  "status": "ok",
  "docker": "connected",
  "games": 2,
  "hostTotalMem": 17179869184,
  "hostCpuCount": 8,
  "hostCpuModel": "Intel Core i7-12700K",
  "hostDisk": { "total": 500107862016, "free": 320000000000, "used": 180107862016 },
  "hostOs": {
    "type": "Linux",
    "release": "6.8.0-60-generic",
    "arch": "x64",
    "hostname": "gameserver",
    "uptime": 86400
  }
}
```

`hostTotalMem` is bytes from `os.totalmem()`. `hostCpuCount` is `os.cpus().length`. `hostCpuModel` is the first CPU's model string. `hostDisk` uses `statfs('/')`. `hostOs.uptime` is seconds from `os.uptime()`.

---

### Error Format

All errors: `{ "error": "Human-readable message" }`

HTTP codes: `200` success · `201` created · `400` bad request · `401` unauthorized · `403` forbidden · `404` not found · `409` conflict · `502` upstream error · `503` service unavailable

---

## 9. WebSocket (Socket.io)

Single Socket.io server on port 4000 alongside Express.

### Connections

```javascript
// Public (status only)
const socket = io("http://<SERVER_HOST>:4000");

// Admin (logs, console, build, stats — JWT required)
const socket = io("http://<SERVER_HOST>:4000", {
  auth: { token: "<jwt>" }
});
```

Backend rejects authenticated connections with invalid JWT.

### Rooms

| Room | Auth | Purpose |
|---|---|---|
| `status` | Public | Server status broadcasts |
| `logs:<id>` | JWT | Container log stream (read-only) |
| `console:<id>` | JWT | Interactive stdin/stdout console |
| `build:<id>` | JWT | Docker image build output |
| `stats:<id>` | JWT | Live CPU, memory, and network I/O |

### Client → Server Events

| Event | Payload | Auth | Description |
|---|---|---|---|
| `join:status` | — | Public | Subscribe to status updates |
| `leave:status` | — | Public | Unsubscribe |
| `join:logs` | `{ id }` | JWT | Start receiving log lines |
| `leave:logs` | `{ id }` | JWT | Stop receiving log lines |
| `join:console` | `{ id }` | JWT | Start console stream |
| `leave:console` | `{ id }` | JWT | Stop console stream |
| `console:input` | `{ id, input }` | JWT | Send a command to container stdin |
| `join:build` | `{ id }` | JWT | Start receiving build output |
| `leave:build` | `{ id }` | JWT | Stop receiving build output |
| `join:stats` | `{ id }` | JWT | Subscribe to stats stream |
| `leave:stats` | `{ id }` | JWT | Unsubscribe from stats stream |

### Server → Client Events

| Event | Room | Payload | Description |
|---|---|---|---|
| `status:all` | `status` | `[{ id, status, players }]` | Full snapshot on join |
| `status:update` | `status` | `{ id, status, players }` | Fired after any state change |
| `log:line` | `logs:<id>` | `{ id, line, level }` | Single log line |
| `log:end` | `logs:<id>` | `{ id }` | Container stopped |
| `console:line` | `console:<id>` | `{ id, line, level }` | Single console line |
| `console:end` | `console:<id>` | `{ id }` | Console stream ended |
| `build:line` | `build:<id>` | `{ id, line }` | Single build output line |
| `build:complete` | `build:<id>` | `{ id, success: true }` | Build succeeded |
| `build:failed` | `build:<id>` | `{ id, success: false, error }` | Build failed |
| `stats:update` | `stats:<id>` | `{ id, cpu, memUsed, memLimit, netInRate, netOutRate }` | Live resource stats |
| `crash:alert` | `status` | `{ id, name }` | Broadcast to all `status` subscribers when a container crashes unexpectedly |

### Stats Payload

| Field | Type | Description |
|---|---|---|
| `cpu` | number | CPU usage % (0–100), normalised across all cores to match system monitor |
| `memUsed` | number | Bytes in use (excluding page cache) |
| `memLimit` | number \| null | Configured memory limit in bytes; `null` if unlimited |
| `netInRate` | number | Inbound bytes/sec (delta since last tick) |
| `netOutRate` | number | Outbound bytes/sec |

Stats streams are reference-counted: one Docker stats stream is opened per container and shared across all subscribers; destroyed when the last subscriber leaves.

### Log Level Detection

| Level | Detection pattern | UI color |
|---|---|---|
| `error` | `ERROR`, `FATAL`, `Exception` | Red |
| `warn` | `WARN`, `WARNING` | Yellow |
| `system` | Docker-emitted lines | Gray |
| `info` | Everything else | White |
| `CMD` | Lines sent by the user via console input | Accent |

### Periodic Backend Polling

Every 30 seconds: inspect all containers, emit `status:update` for any that changed state. Also queries A2S player counts and sends crash notifications for unexpected stops.

### Log / Console Streaming

- On `join:logs` or `join:console`: last 100 lines sent immediately as initial tail
- Multiple subscribers share one stream
- Stream detached when last subscriber leaves or disconnects
- On reconnect: client re-joins rooms, receives `status:all` snapshot and fresh tail

---

## 10. Scheduler

Schedules are stored in each game's JSON file under `schedules[]` and loaded at startup by `initScheduler()`. Changes via the API call `reloadGameSchedules(gameId)` to cancel and re-register affected jobs.

### Schedule Execution

```
cron tick fires
  → check schedule.enabled
  → load fresh game config
  → switch on action:
      start    → startContainer(game)
      stop     → stopContainer(gameId)
      restart  → restartContainer(gameId)
      command  → attach container stdin, write command + newline, end stream
  → update lastRun: { at: ISO timestamp, ok: true/false }
  → save game JSON
```

Commands are sent via Docker's attach API (stdin only), not RCON, so they work even for games without RCON configured.

---

## 11. Notifications

### Crash Detection

The 30-second polling loop marks admin-initiated stops using an in-memory set (`adminStops`). If a running container transitions to stopped and is not in `adminStops`, it is treated as a crash.

### Discord Webhook

If `discordWebhookUrl` is set in `settings.json`, a crash embed is posted:
```
Title:       Server Crashed
Description: **<game name>** stopped unexpectedly.
Color:       Red (#e74c3c)
```

A test embed can be sent via `POST /api/settings` with `testDiscord: true` (handled in `settings.js`).

### Web Push (VAPID)

VAPID keys are generated on first start and persisted in `settings.json`. The frontend fetches the public key from `/api/push/vapid-public-key`, requests browser notification permission, creates a `PushSubscription` via the Service Worker, and posts it to `/api/push/subscribe`.

On crash, `web-push.sendNotification()` is called for each stored subscription. Subscriptions that return HTTP 410 (Gone) are pruned from `settings.json` automatically.

---

## 12. Resource Monitoring

### Per-Container Stats (Docker Stats API)

`statsStreams.js` attaches a streaming Docker stats connection per container. One stream is shared across all WebSocket subscribers (reference-counted). Stats are parsed from the raw JSON lines Docker emits and re-broadcast as `stats:update` events.

**CPU calculation:**
```
cpuDelta = cpu_stats.cpu_usage.total_usage - precpu_stats.cpu_usage.total_usage
sysDelta = cpu_stats.system_cpu_usage - precpu_stats.system_cpu_usage
cpu% = (cpuDelta / sysDelta) * 100
```
This matches the display in `htop` / Ubuntu System Monitor.

**Memory:**
```
memUsed = memory_stats.usage - memory_stats.stats.cache
```
Page cache is excluded to show actual application memory.

**Network:**
```
netInRate  = (current rx_bytes - previous rx_bytes) / elapsed seconds
netOutRate = (current tx_bytes - previous tx_bytes) / elapsed seconds
```
Cumulative totals from all container networks, converted to a per-second rate.

### Disk Usage

`diskUtils.js` provides two helpers:
- `getDirSize(path)` — runs `du -sb <path>` to get bytes consumed by a directory tree
- `getHostDiskInfo(path = '/')` — uses `fs.statfs()` to get total/free/used bytes for the host filesystem

`diskUsed` is computed per request in `GET /api/servers` and `GET /api/servers/:id` by calling `getDirSize(getDataPath(id))`. Host disk info is returned in `GET /api/health` and fetched by the admin dashboard once on load.

---

## 13. File Manager

### Scope

- Browsing the directory tree under `backend/games/<id>/data/`
- Editing text config files in game data volumes (e.g. `server.properties`)
- Creating files and folders, uploading files (drag-and-drop), renaming, downloading, and deleting
- NOT for: binary editing, anything outside `backend/games/<id>/data/`

### Write Access — Server Must Be Stopped

Read operations (list, read, download) work in any state. **Every mutation
(create, write, upload, rename, delete, mkdir) requires the server to be
stopped** — a live container may hold files open or overwrite them mid-edit.
The `requireStopped` middleware resolves the effective status and returns
`409 "Stop the server before changing its files"` unless it is `stopped`,
`not_created`, or `error`. The Files tab enforces the same rule client-side: the
create/upload/rename/delete controls are hidden, the editor becomes read-only,
and a notice explains why.

### Security

All incoming paths are resolved against the game's data root before any operation:

```
Allowed:  backend/games/minecraft/data/server.properties
Blocked:  backend/games/minecraft/data/../../minecraft.json   (path traversal → 403)
Blocked:  /etc/passwd                                          (outside sandbox → 403)
```

Symlinks are followed and re-validated against the sandbox before access.

### Binary Detection

Read first 512 bytes; if any null bytes (`\x00`) found → binary. Binary files are listed but cannot be opened.

### Size Limit

Max editable file size: **512 KB**. Larger files shown in listing but cannot be opened.

### Atomic Writes

1. Write content to `<filename>.tmp`
2. Rename `.tmp` → target filename

---

## 14. UI Screens & Routes

### Route Map

| Route | View | Auth |
|---|---|---|
| `/` | Public Dashboard | None |
| `/auth` | Login Page | None |
| `/blocked` | Visitor registration closed | None |
| `/admin` | Admin Dashboard (monitoring table + server list) | JWT |
| `/admin/servers/:id` | Server Detail | JWT |
| `/admin/servers/new` | Add Game Form | JWT |
| `/admin/servers/:id/edit` | Edit Game Form | JWT |
| `/admin/visitors` | Visitor Management | JWT |
| `/admin/network` | VPN Status | JWT |
| `/admin/docker` | Docker Manager | JWT |
| `/admin/settings` | Admin Settings | JWT |

Unauthenticated access to `/admin/*` redirects to `/auth`.

### Screen Descriptions

#### `/` — Public Dashboard
- Grid of server cards (2 col desktop, 1 col mobile)
- Each card: name, status badge, player count (if A2S configured), connection info, pinned env vars
- No action buttons
- Status updates via Socket.io `status` room

#### `/auth` — Login Page
- Centered dark card, username + password, login button
- On success: JWT stored in `sessionStorage`, redirect to `/admin`
- On failure: "Invalid username or password"

#### `/admin` — Admin Dashboard
- OS info card: hostname, OS type/release/arch, uptime
- Global stats card: servers online, combined CPU %, total RAM used/total, total net I/O, host disk usage
- Monitoring table: one row per server with columns — name, status, players, CPU %, RAM used/limit, disk used, net I/O, connection, action buttons
- "Add Game" button navigates to `/admin/servers/new`
- Clicking a row navigates to `/admin/servers/:id`
- Action buttons (start/stop/restart/wipe) inline per row; stop propagation so click doesn't navigate

#### `/admin/servers/:id` — Server Detail
- Header: name, status badge, start/stop/restart/reset controls
- Collapsible resources panel: CPU bar + sparkline, RAM bar, net I/O, disk usage
- Tabs: **Info**, **Logs**, **Console**, **Files**, **Schedule**, **Backups**

**Info tab:**
- Connection info with copy button
- Configuration table: ID, container name, image, data mount
- Ports table: host/container/protocol
- Players and uptime blocks
- Pinned env vars, query/RCON config
- Resources section: CPU bar + sparkline, memory bar, disk usage, network rates
- "Edit Config" button navigates to `/admin/servers/:id/edit`

**Logs tab:**
- Scrollable terminal with color-coded log lines
- Level filter dropdown (ALL / INFO / WARN / ERROR)
- Auto-scroll toggle

**Console tab:**
- Segmented control to switch between Terminal and RCON modes (RCON mode only shown if `rcon.enabled`)
- Terminal mode: live container stdout; input field sends to stdin via `console:input` socket event; arrow-key command history (last 50 commands)
- RCON mode: sends command to `/api/servers/:id/rcon`; shows response or error inline; arrow-key command history

**Files tab:**
- Breadcrumb navigation
- Directory listing (dirs first, then files alphabetically)
- Click file to open in a monospace textarea editor with line gutter; Save/Revert; unsaved-changes (discard) warning when navigating away; Ctrl/Cmd+S to save
- New file / new folder buttons; drag-and-drop upload into the current folder; per-entry `···` menu with rename, download, and delete
- Binary files and files >512 KB cannot be opened in the editor
- **Read-only while the server is running:** create/upload/rename/delete controls are hidden, the editor is read-only, and a notice tells the user to stop the server first (the backend also enforces this with a 409)

**Schedule tab:**
- List of existing schedules with: enable/disable toggle, label, action badge, cron expression, human-readable preview, timezone, last-run status (✓/✗ with relative time)
- "Run now" button triggers immediately
- Edit inline; delete with confirmation
- "Add schedule" form: label, action (segmented control), optional command field, cron expression (with field reference and example picker), optional timezone

**Backups tab:**
- List of backups sorted newest-first: label (or creation timestamp), creation date, relative age, size
- "Create Backup" button opens an inline form with optional label field
- Per-backup actions: Download (streams `.tar.gz` via `?token=`), Restore (confirmation required), Delete (confirmation required)
- Restore stops the container if running and restarts it after extraction

#### `/admin/servers/new` and `/admin/servers/:id/edit` — Game Form
- Template picker (add mode only)
- Sections: Basic Info, Image Source toggle (Public/Steam), Ports list, Env Vars list (with pinned toggle), Resource Limits (CPU, memory), RCON (collapsible), Query (A2S port)
- Steam section: Dockerfile textarea, build status, Build / Rebuild button with inline build log
- Actions: Save, Save & Build (Steam only), Cancel

#### `/admin/docker` — Docker Manager
- Two tabs: **Images** and **Containers**
- Images tab: table of all Docker images with short ID, tags, size, created date, and Delete button
- Containers tab: table of all Docker containers with short ID, names, image, state/status, created date, and Delete button
- Delete requires confirmation; uses force-remove

#### `/admin/settings` — Settings
- Server host override, data root override, visitor registration toggle
- Discord webhook URL (with test button)
- Push notifications section: enable/disable browser push, test notification button
- Wipe all data (destructive, confirmation required)

### Shared Components

**core/**
| Component | Description |
|---|---|
| `Button` | Primary action button with loading state and size/variant props |
| `ConfirmModal` | Reusable confirmation dialog |
| `CopyButton` | Copies a value to clipboard with ✓ feedback |
| `LangSwitcher` | Language toggle (EN / PT-BR) |
| `PageHeader` | Page title + optional action slot |
| `StatusBadge` | Colored container-state indicator |
| `Toggle` | On/off toggle switch |

**forms/**
| Component | Description |
|---|---|
| `TextField` | Labeled text input |
| `SegmentedControl` | Mutually-exclusive option picker |

**navigation/**
| Component | Description |
|---|---|
| `SidebarNav` | Admin left nav with logout, socket status indicator |
| `Tabs` | Tab bar for switching between views |

**data/**
| Component | Description |
|---|---|
| `AdminServerCard` | Server card used in the game list (edit/delete) |
| `ServerCard` | Server status card for the public dashboard |
| `LogLine` | Single color-coded log line |

### Responsiveness

Primarily desktop (1280px+). Mobile-responsive for the public dashboard only.

---

## 15. Security

- Access is VPN-gated. Do not expose ports 3000 or 4000 to the public internet.
- JWT stored in `sessionStorage` (cleared when tab closes) — never `localStorage`.
- Login attempts are rate-limited (express-rate-limit).
- File manager: path traversal check on every operation; binary detection; 512 KB max edit; atomic writes; mutations require a stopped server (409 otherwise).
- RCON passwords are never returned to the client in API responses.
- Web Push: VAPID keys are auto-generated and stored server-side; only the public key is exposed.
- No HTTPS — VPN tunnel handles encryption.
