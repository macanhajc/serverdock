# ServerDock

Self-hosted game server manager. Admins control Docker game containers via a login-protected panel; friends see a read-only status dashboard. Runs on a single Ubuntu machine, VPN-gated, with no public internet exposure required.

---

## Screenshots

| AdminDashboard | ServerDetails |
|--|--|
| <img width="1717" height="1320" alt="Screenshot From 2026-06-09 20-36-18" src="https://github.com/user-attachments/assets/127f3232-e9b7-44a9-a42d-3c9fdf435b81" /> | <img width="1717" height="1320" alt="Screenshot From 2026-06-09 20-36-47" src="https://github.com/user-attachments/assets/f10bca15-a5f7-4577-9f12-ec30a00a37c9" /> |

| PublicDashboard |
|--|
| <img width="1330" height="1320" alt="Screenshot From 2026-06-09 20-39-07" src="https://github.com/user-attachments/assets/6af40ec5-c192-4a67-9e40-1e6c74113848" /> |


## Features

- **Admin dashboard** — monitoring table with live CPU, RAM, network I/O, disk usage, and player count per server; global stats summary card at the top
- **Server controls** — start, stop, restart, and reset any game server with one click; state-aware buttons prevent invalid actions
- **Public dashboard** — friends see live server status and connection info without logging in
- **Game templates** — built-in presets for Minecraft, Valheim, Terraria, Factorio, CS2, ARK, and Rust
- **Custom Dockerfiles** — Steam-based games (CS2, ARK, Rust) build local images with SteamCMD; public images (Minecraft, Valheim, etc.) are pulled automatically on first start
- **Live log streaming** — real-time container logs in the browser via WebSocket, with log-level color coding and level filter
- **Interactive console** — send commands directly to a running container's stdin; full command history with arrow-key navigation
- **RCON** — send RCON commands to supported game servers directly from the browser; switchable terminal/RCON mode in the console tab
- **File manager** — browse and edit server data files (world saves, configs) directly in the UI
- **Resource monitoring** — per-container CPU %, memory usage, and network I/O streamed live via Docker stats API; CPU sparklines on the server detail page
- **Disk usage** — per-server game data size and host filesystem totals reported in both the dashboard and server detail view
- **Backups** — create, download, restore, and delete compressed `.tar.gz` snapshots of a server's data directory from the Backups tab; a restore automatically stops and restarts the container if it was running
- **Docker manager** — browse all Docker images and containers on the host; remove unused images or orphaned containers directly from the admin panel
- **Scheduled actions** — cron-based scheduler per server: auto-start, stop, restart, or send RCON commands on a schedule; configurable timezone; enable/disable without deleting; manual "run now" button; last-run status shown inline
- **A2S player count** — live player/max-player display for games that support the Valve Source Engine Query protocol (Valheim, CS2, ARK, Rust); configured via the `query` field in each game's JSON
- **Pinned env vars** — mark any environment variable as pinned to surface its current value on the server card in both the admin and public dashboards
- **Resource limits** — optional `cpuLimit` and `memoryLimit` fields in game JSON; limits shown alongside live usage in the dashboard and detail view
- **VPN integration** — NetBird and WireGuard support; VPN IP is auto-detected and shown to friends as the connection address
- **Visitor tracking** — friends register a username on the public dashboard; admin can see who has visited and remove access
- **Settings panel** — admin can update `SERVER_HOST`, data root path, and toggle visitor self-registration without editing `.env`
- **Discord notifications** — crash alerts posted to a Discord channel via webhook; configurable in the settings panel
- **Browser push notifications** — Web Push (VAPID) crash alerts to any browser that has granted notification permission; admin subscribes/unsubscribes from the settings panel
- **Toast notifications** — transient success/error toasts shown after actions
- **i18n** — UI available in English and Portuguese (pt-BR)
- **No database** — Docker is the source of truth for container state; game configs are JSON files on disk

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express 5 (port 4000) |
| Frontend | React 19 + Vite + Tailwind CSS v4 (dark theme, port 3000) |
| Docker control | `dockerode` via `/var/run/docker.sock` |
| Real-time | `socket.io` (same port as backend) |
| Auth | JWT (24 h) + bcrypt |
| Game config | JSON files in `backend/games/<id>/` |
| VPN | NetBird (default) or WireGuard |
| Notifications | Web Push (VAPID) + Discord webhooks |

---

## Prerequisites

- **Node.js 18+** (tested on 24 LTS)
- **Docker Engine** — the user running the backend must have access to `/var/run/docker.sock`
- **NetBird** (or WireGuard) for VPN-gated friend access — optional, but required for friends to connect

```bash
# Add your user to the docker group so the backend can reach the socket
sudo usermod -aG docker $USER
newgrp docker
```

---

## Installation

```bash
git clone <repo-url> /opt/serverdock
cd /opt/serverdock

cd backend && npm install
cd ../frontend && npm install
```

---

## Configuration

### Backend `.env`

Create `backend/.env`:

```env
PORT=4000
JWT_SECRET=<generate a strong random secret>
SERVER_HOST=192.168.1.10      # fallback IP shown to friends if VPN is not active
CORS_ORIGIN=http://192.168.1.10:3000
VPN_PROVIDER=netbird          # or 'wireguard'
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Admin credentials

Run once to set the admin username and password:

```bash
cd backend
node setup-auth.js --username admin --password <your-password>
```

This writes a bcrypt hash to `backend/auth.json`. Re-run at any time to change credentials.

---

## Running

### Development

```bash
# Terminal 1 — backend (auto-reloads with nodemon)
cd backend && npm run dev

# Terminal 2 — frontend (Vite dev server)
cd frontend && npm run dev
```

Open `http://localhost:5173` for the public dashboard or `http://localhost:5173/auth` for the admin login.

### Production with PM2

```bash
# Build the frontend
cd frontend && npm run build

# Serve frontend/dist/ via nginx or any static file server, then:
cd /opt/serverdock
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # follow the printed command to enable auto-start on boot
```

### Production with systemd

```bash
sudo cp serverdock.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now serverdock
sudo journalctl -u serverdock -f   # follow logs
```

---

## Adding a game server

1. Open the admin panel → **Dashboard** → click **+ Add Game** or navigate to `/admin/servers/new`
2. Pick a template (Minecraft, Valheim, CS2, ARK, Rust, Terraria, Factorio) or start blank
3. Set a name, ports, and environment variables
4. For Steam/custom games: the Dockerfile is pre-filled — click **Save & Build** and wait for the build to finish
5. For public-image games (Minecraft, Valheim, etc.) the image is pulled automatically on first start
6. Click **Start**

Game data is persisted in `backend/games/<id>/data/` and mounted into the container at the path specified by the `dataMount` field in each game's JSON (e.g. `/data`, `/config`, `/palworld` — check the template for the correct value).

---

## Directory Structure

```
serverdock/
├── backend/
│   ├── src/
│   │   ├── index.js               # Express + Socket.IO entry point
│   │   ├── middleware/auth.js      # JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.js            # POST /api/auth/login|logout
│   │   │   ├── servers.js         # GET|POST /api/servers
│   │   │   ├── games.js           # CRUD /api/games (admin only)
│   │   │   ├── files.js           # File manager /api/files (admin only)
│   │   │   ├── schedules.js       # Cron schedules /api/schedules (admin only)
│   │   │   ├── backups.js         # Backup CRUD /api/backups (admin only)
│   │   │   ├── docker.js          # Docker image/container management /api/docker
│   │   │   ├── visitors.js        # Visitor tracking /api/visitors
│   │   │   ├── push.js            # Web Push subscriptions /api/push
│   │   │   ├── vpn.js             # VPN status /api/vpn/status
│   │   │   └── settings.js        # Admin settings /api/settings
│   │   └── lib/
│   │       ├── backupManager.js   # tar.gz backup creation, restore, list, and delete
│   │       ├── containers.js      # Docker start/stop/restart/reset helpers
│   │       ├── diskUtils.js       # Directory size + host filesystem info
│   │       ├── docker.js          # Dockerode client singleton + availability check
│   │       ├── gameLoader.js      # Loads game JSON configs from disk
│   │       ├── logger.js          # Pino structured logger
│   │       ├── notifier.js        # Discord webhook + Web Push crash notifications
│   │       ├── playerQuery.js     # A2S (Valve Source Engine Query) player count
│   │       ├── rcon.js            # RCON command sender (rcon-client)
│   │       ├── scheduler.js       # node-cron job runner for per-game schedules
│   │       ├── settingsStore.js   # Persistent settings (settings.json)
│   │       ├── socket.js          # Socket.io server setup
│   │       ├── socketHandlers.js  # WebSocket rooms (logs, build, stats, console, status)
│   │       ├── statsStreams.js     # Docker stats stream manager (CPU/mem/net)
│   │       ├── visitorStore.js    # Visitor persistence (visitors.json)
│   │       └── vpn/               # NetBird + WireGuard adapters
│   ├── games/                     # One subfolder per game
│   │   └── <id>/
│   │       ├── <id>.json          # Game definition (image, ports, env vars, schedules)
│   │       ├── data/              # Server data volume (world saves, configs)
│   │       └── Dockerfile         # Only for local/Steam-based games
│   ├── auth.json                  # Bcrypt-hashed admin credentials
│   ├── setup-auth.js              # One-time credential setup script
│   └── .env
└── frontend/
    └── src/
        ├── pages/
        │   ├── public/
        │   │   ├── Dashboard/         # Read-only status view for friends
        │   │   └── Blocked/           # Shown when visitor registration is closed
        │   ├── auth/                  # Login page
        │   └── private/
        │       ├── Dashboard/         # Admin monitoring table + global stats card
        │       ├── ServerDetail/      # Per-server detail with tabs:
        │       │   ├── InfoTab        #   Info, connection, ports, uptime, resources
        │       │   ├── LogsTab        #   Live log stream with level filter
        │       │   ├── ConsoleTab     #   Interactive terminal + RCON mode
        │       │   ├── FilesTab       #   File browser and editor
        │       │   ├── ScheduleTab    #   Cron schedule management
        │       │   └── BackupTab      #   Backup create, restore, download, delete
        │       ├── GameForm/          # Create / edit game config + Dockerfile
        │       ├── DockerPage/        # Docker image and container manager
        │       ├── NetworkPage/       # VPN status and connected peers
        │       ├── VisitorsPage/      # Visitor management
        │       └── SettingsPage/      # Admin settings (host, data root, registration,
        │                              #   Discord webhook, push notifications)
        ├── components/
        │   ├── core/                  # Button, ConfirmModal, CopyButton, LangSwitcher,
        │   │                          #   PageHeader, StatusBadge, Toggle
        │   ├── forms/                 # TextField, SegmentedControl
        │   ├── navigation/            # SidebarNav, Tabs
        │   └── data/                  # AdminServerCard, ServerCard, LogLine
        ├── context/
        │   ├── AuthContext.tsx        # JWT state + sessionStorage (key: sd_token)
        │   └── ToastContext.tsx       # App-wide toast notifications
        ├── data/templates.ts          # Built-in game presets
        ├── socket.ts                  # Socket.io client singleton
        ├── i18n.ts                    # i18next setup
        └── locales/
            ├── en.json
            └── pt-BR.json
```

---

## Game Config Format

### Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique slug. Lowercase, no spaces. Used in container names, API routes, folder names. |
| `name` | ✅ | Display name |
| `description` | ❌ | Short text shown in UI |
| `imageSource` | ✅ | `"public"` or `"local"` |
| `image` | ✅ | Docker Hub image (public) or local tag `serverdock-<id>` (local) |
| `buildContext` | ✅ if local | Path to Dockerfile folder, relative to backend root |
| `imageBuilt` | ✅ if local | `true` once built successfully; `false` otherwise |
| `ports` | ✅ | Array of `{ host, container, protocol }` |
| `environment` | ❌ | Array of `{ key, value, pinned? }` — set `pinned: true` to surface the value on server cards |
| `dataMount` | ❌ | Container path where `backend/games/<id>/data/` is mounted (default `/data`) |
| `cpuLimit` | ❌ | CPU quota as a fractional number of cores (e.g. `2.0` = 2 full cores) |
| `memoryLimit` | ❌ | Memory limit in MB (e.g. `4096` = 4 GB). Shown alongside live usage in dashboard. |
| `query` | ❌ | `{ type: "a2s", port: <n> }` — enables live player count via Valve Source Engine Query |
| `rcon` | ❌ | `{ enabled, port, password }` — enables in-browser RCON console |
| `schedules` | ❌ | Array of schedule objects (managed via the UI; do not edit by hand) |

---

## API Reference

### Public endpoints (no auth required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Docker connectivity check + host info |
| `GET` | `/api/servers` | All servers with live status, disk usage, and uptime |
| `GET` | `/api/servers/:id` | Single server status + connection info |
| `POST` | `/api/auth/login` | Obtain JWT |
| `POST` | `/api/visitors/identify` | Register or re-identify a visitor |
| `GET` | `/api/settings/public` | Public settings (e.g. `registrationOpen` flag) |
| `GET` | `/api/push/vapid-public-key` | VAPID public key for push subscription |

### Protected endpoints (`Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/servers/:id/start` | Start server |
| `POST` | `/api/servers/:id/stop` | Stop server |
| `POST` | `/api/servers/:id/restart` | Restart server |
| `POST` | `/api/servers/:id/reset` | Wipe data and remove container |
| `POST` | `/api/servers/:id/rcon` | Send an RCON command; returns `{ response }` |
| `GET` | `/api/games` | List all game configs |
| `POST` | `/api/games` | Create a new game |
| `PUT` | `/api/games/:id` | Update a game config |
| `DELETE` | `/api/games/:id` | Delete a game (must be stopped) |
| `POST` | `/api/games/:id/dockerfile` | Save a custom Dockerfile |
| `POST` | `/api/games/:id/build` | Trigger a Docker image build |
| `GET` | `/api/files/:id` | List directory entries |
| `GET` | `/api/files/:id/read` | Read a file |
| `PUT` | `/api/files/:id/write` | Write a file |
| `GET` | `/api/schedules/:id` | List cron schedules for a game |
| `POST` | `/api/schedules/:id` | Create a schedule |
| `PUT` | `/api/schedules/:id/:scheduleId` | Update a schedule |
| `DELETE` | `/api/schedules/:id/:scheduleId` | Delete a schedule |
| `POST` | `/api/schedules/:id/:scheduleId/run` | Trigger a schedule immediately |
| `GET` | `/api/backups/:id` | List backups for a server |
| `POST` | `/api/backups/:id` | Create a backup |
| `GET` | `/api/backups/:id/:backupId/download` | Download backup archive (also accepts `?token=` for direct browser links) |
| `POST` | `/api/backups/:id/:backupId/restore` | Restore a backup (stops/restarts container if running) |
| `DELETE` | `/api/backups/:id/:backupId` | Delete a backup |
| `GET` | `/api/docker/images` | List all Docker images on the host |
| `DELETE` | `/api/docker/images/:id` | Remove a Docker image |
| `GET` | `/api/docker/containers` | List all Docker containers on the host |
| `DELETE` | `/api/docker/containers/:id` | Force-remove a Docker container |
| `GET` | `/api/vpn/status` | VPN status and peer list |
| `GET` | `/api/visitors` | List all visitors |
| `DELETE` | `/api/visitors/:id` | Remove a visitor |
| `GET` | `/api/settings` | Get admin settings |
| `PUT` | `/api/settings` | Update settings |
| `POST` | `/api/push/subscribe` | Register a browser push subscription |
| `DELETE` | `/api/push/subscribe` | Remove a push subscription |
| `POST` | `/api/push/test` | Send a test push notification |

### WebSocket rooms

| Room | Auth | Purpose |
|---|---|---|
| `status` | Public | Live server status broadcasts |
| `logs:<id>` | JWT | Container log stream |
| `console:<id>` | JWT | Interactive console (stdin/stdout) |
| `build:<id>` | JWT | Docker image build output |
| `stats:<id>` | JWT | Live CPU, memory, and network I/O stats |

---

## Container Lifecycle

Containers are named `serverdock-<id>` and use `RestartPolicy: no` — they only start or stop on explicit admin action. When the backend shuts down (`SIGINT`/`SIGTERM`), it gracefully stops all running managed containers. If a container stops unexpectedly (detected by the 30-second polling loop), a crash notification is sent via Discord webhook and/or browser push.

**States:** `not_created` · `running` · `stopped` · `starting` · `restarting` · `pulling` · `building`

---

## Scheduler

Each game can have multiple cron schedules, stored in the game's JSON file under a `schedules` array. Schedules are managed via the **Schedule** tab on the server detail page.

**Actions:** `start` · `stop` · `restart` · `command` (sends to container stdin or RCON)

**Fields per schedule:**

| Field | Description |
|---|---|
| `label` | Human-readable name shown in the UI |
| `action` | `start`, `stop`, `restart`, or `command` |
| `command` | Command string (required when action is `command`) |
| `cron` | Standard 5-field cron expression (e.g. `0 4 * * *`) |
| `timezone` | IANA timezone (e.g. `America/Sao_Paulo`); optional, defaults to server local time |
| `enabled` | Toggle without deleting |
| `lastRun` | Set automatically: `{ at: <iso>, ok: <bool> }` |

---

## Notifications

### Discord

Set `discordWebhookUrl` in the settings panel. A crash embed is posted whenever a managed container stops unexpectedly.

### Browser Push (Web Push / VAPID)

VAPID keys are generated automatically on first backend start and stored in `settings.json`. The admin enables push in the settings panel; the browser prompts for notification permission. Crash notifications are sent to all subscribed browsers. Expired subscriptions are pruned automatically.

---

## Security Notes

- Access is VPN-gated at the network level. Do not expose ports 3000 or 4000 to the public internet.
- The JWT is stored in `sessionStorage` (cleared when the tab closes) — never `localStorage`.
- Login attempts are rate-limited to prevent brute-force.
- The file manager is sandboxed to each game's `data/` directory. Path traversal attempts return 403. Binary files are rejected. Max editable file size is 512 KB. Writes are atomic (`.tmp` → rename).
- No HTTPS — the VPN tunnel handles encryption.
