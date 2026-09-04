# ServerDock

ServerDock is a self-hosted control panel for running game servers on your own machine, in Docker. One admin manages everything — creating servers, starting/stopping them, editing their files, scheduling restarts, watching logs — from a browser. Friends get a separate, read-only dashboard that shows who's online and how to connect, with no admin access and no account required beyond a display name.

It's built for the "I have a spare machine and some friends" use case: a home server, a mini PC, a cheap VPS. There's no public-facing login, no exposed ports, and no HTTPS to configure — access is gated entirely by joining a private VPN mesh (NetBird), so the whole thing is designed to be reachable only by people you've actually invited.

---

## Screenshots

| Admin Dashboard | Server Detail |
|--|--|
| <img width="1717" height="1320" alt="Screenshot From 2026-06-09 20-36-18" src="https://github.com/user-attachments/assets/127f3232-e9b7-44a9-a42d-3c9fdf435b81" /> | <img width="1717" height="1320" alt="Screenshot From 2026-06-09 20-36-47" src="https://github.com/user-attachments/assets/f10bca15-a5f7-4577-9f12-ec30a00a37c9" /> |

| Public Dashboard |
|--|
| <img width="1330" height="1320" alt="Screenshot From 2026-06-09 20-39-07" src="https://github.com/user-attachments/assets/6af40ec5-c192-4a67-9e40-1e6c74113848" /> |

---

## Getting Started

**→ See [DEPLOYMENT.md](DEPLOYMENT.md) for installation.** It covers the recommended Docker install on Linux, an advanced Node/PM2/systemd path without Docker, and running ServerDock on Windows for local development or testing.

Once it's running, using it looks like this:

1. **First boot** shows a one-time setup screen to create your admin account — no config file editing, no CLI step.
2. **Add a game** from the Dashboard using a built-in template (or start from a blank config for anything not templated) and click Start. Public-image games pull automatically; games with a Dockerfile build in-browser with a live log.
3. **Invite friends** to your NetBird network (see the in-app "How to connect" guide on the public dashboard) — once they're on the mesh, the public dashboard at your server's address shows them live status and a copy-pasteable connect address for each server.
4. **Manage from there**: console/RCON, live logs, file editing, backups, cron schedules, and — if you want help running things — additional admin accounts with hand-picked permissions.

---

## Features

### Server management
- Create, edit, start, stop, restart, and reset any game server; state-aware controls prevent invalid actions (e.g. no "start" on a server that's already running).
- Live status/CPU/RAM/disk/network table across all servers, with a global fleet summary card, host OS/uptime info, and live NetBird peer count.
- Add a game from a built-in template or a blank config; export any game's config (and Dockerfile, if it has one) as a portable JSON file, and import it on another instance.
- Two image sources per game: **public** (pulled from a registry on first start) or **local** (built from an in-editor Dockerfile with a live build log — used for anything SteamCMD-based or otherwise custom).
- On-demand image update check against the registry (no polling, to stay clear of Docker Hub rate limits) and a one-click rebuild for local images.
- Optional CPU-core and memory limits per server, shown alongside live usage.

### Console, RCON & files
- Live-streaming log/console tab (color-coded by level, filterable, searchable) with a command input that writes directly to the container's stdin, full history with arrow-key recall.
- A separate RCON mode in the same tab for games that support it — its own request/response history and a configurable quick-broadcast field — gated behind its own permission since it's equivalent to console access.
- Full in-browser file manager for each server's data directory: browse, create, rename, delete, upload, download, and edit (with syntax highlighting for JSON/YAML/properties-style files). Sandboxed to the data directory, path-traversal-proof, and only unlocked while the server is stopped.

### Backups & scheduling
- One-click `.tar.gz` backups with optional labels, download, restore (auto stop/restart around the swap), delete, and a configurable keep-last-N retention policy.
- Per-server cron schedules for start, stop, restart, backup, or an arbitrary console command, with per-schedule timezone, enable/disable, "run now," and last-run status.

### Multi-admin & permissions
- A first admin is created via the one-time setup screen; a `super_admin` can then create additional admins and grant each one a hand-picked set of permissions (server power, file writes, backups, console access, game management, visitor management, schedules, settings) rather than all-or-nothing access.
- Every mutating action is enforced server-side against the live permission set — the UI hides controls a given admin can't use, but the backend is the actual boundary.

### Visitors & VPN access
- Friends self-register a display name on the public dashboard (no password) and see live server status and connect info; the admin can view, block, or remove any visitor, and IP blocks persist even if the visitor row is later deleted.
- Built on [NetBird](https://netbird.io): the public dashboard walks new visitors through installing it, joining your mesh, and connecting — after that, joining a server is copy-paste. The host's own VPN IP is auto-detected and used as the connect address; a manual fallback IP is available in Settings for hosts without NetBird.

### Notifications
- Discord webhook and browser Web Push (VAPID) notifications for unexpected server exits (with crash detail), failed scheduled actions, sustained high CPU/RAM usage (2+ minutes over 90%, to avoid noise from brief spikes), and low host disk space.

### Setup & extensibility
- First-run web-based admin setup — no CLI, no manually generated secrets (a `JWT_SECRET` is auto-generated and persisted if you don't supply one).
- A raw Docker inventory page (images/containers on the host, including anything not managed by ServerDock) for cleanup.
- Two languages out of the box (English, Portuguese), a dark terminal-inspired UI, and toast notifications for action feedback.

---

## Games included out of the box

7 Days to Die · Abiotic Factor · Enshrouded · HumanitZ · Minecraft · Minecraft (Modded) · Palworld · Project Zomboid · Valheim · VintageStory · V Rising

Anything else can be added as a blank config with a public Docker image, or with a custom Dockerfile for SteamCMD-based servers — see [Game Config Format](#game-config-format) below.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express 5.2 (port 4000) |
| Frontend | React 19.2 + Vite 8 + Tailwind CSS 4.3 (dark theme) |
| Docker control | `dockerode` 5.0 via `/var/run/docker.sock` |
| Real-time | `socket.io` 4.8 (same port as the API) |
| Auth | JWT (24h) + bcrypt; roles & granular permissions in SQLite |
| App database | SQLite (`better-sqlite3` 13.0) — admins, permissions, visitors, IP blocklist, bounded event history |
| Game config | JSON files, one per game, under `backend/games/<id>/` |
| File editor | CodeMirror (`@uiw/react-codemirror`) |
| Scheduler | `node-cron` 4.2 |
| Images | `sharp` 0.35 (avatar processing) |
| Notifications | Web Push (`web-push` 3.6) + Discord webhooks |
| i18n | `i18next` / `react-i18next` — English + Portuguese |

---

## How it works

- **Docker is the source of truth for container/image state.** ServerDock never caches "is this server running" — it asks the Docker daemon. Game *configuration* (ports, env vars, images, schedules) lives in JSON files under `backend/games/<id>/`, one folder per game; only auth/permissions/visitors/blocklist and a small, capped table of resource/crash/action-failure events live in SQLite.
- **Roles are `super_admin` (everything, always) and `admin` (nothing until granted).** A plain admin has zero capabilities until a super_admin checks permissions for them from a fixed catalog. Every mutating API route checks permissions fresh on each request, so a revoked grant takes effect immediately — it's not baked into the login token.
- **Containers are named `serverdock-<id>`**, run with no restart policy (only explicit admin action starts/stops them), and get explicit DNS (`1.1.1.1`/`8.8.8.8` by default) so they resolve mod/update servers correctly even on hosts where the local resolver isn't reachable from inside a container.
- **No HTTPS by design.** The VPN tunnel is the security boundary — nothing is meant to be reachable from the open internet. Don't expose ServerDock's port publicly.
- **Real-time UI updates** ride on a handful of Socket.IO rooms rather than polling: live status for everyone, and JWT-gated log/build/stats streams for the admin panel. See [WebSocket Rooms](#websocket-rooms).

---

## Game Config Format

### Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique slug. Lowercase, no spaces. Used in container names, API routes, and the folder name — cannot be changed after creation. |
| `name` | ✅ | Display name |
| `description` | ❌ | Short text shown in the UI |
| `imageSource` | ✅ | `"public"` or `"local"` |
| `image` | ✅ | Registry image (public) or local tag `serverdock-<id>` (local) |
| `ports` | ✅ | Array of `{ host, container, protocol }` |
| `environment` | ❌ | Array of `{ key, value, pinned? }` — `pinned: true` surfaces the value on the server card in both dashboards |
| `dataMount` | ❌ | Container path where `backend/games/<id>/data/` is mounted (default `/data`) |
| `cpuLimit` | ❌ | CPU quota as a fractional core count (e.g. `2.0` = 2 full cores) |
| `memoryLimit` | ❌ | Memory limit in MB |
| `query` | ❌ | `{ type: "a2s", port: <n> }` — enables the live player count via the Valve Source Engine Query protocol |
| `rcon` | ❌ | `{ enabled, port, password, listCommand?, commands: { broadcast? } }` — enables the in-browser RCON console; `port` must also appear in `ports` |
| `schedules` | ❌ | Managed via the Schedule tab — don't hand-edit |

---

## API Reference

All protected routes take `Authorization: Bearer <token>`; most also require a specific permission (see [How it works](#how-it-works)). This is a summary — see the route files under `backend/src/routes/` for full request/response shapes.

### Public (no auth)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Docker connectivity + host info |
| `GET` | `/api/servers` | All servers — status, players, disk usage, uptime |
| `GET` | `/api/servers/:id` | Single server status |
| `GET` | `/api/servers/:id/avatar` | Server cover image |
| `POST` | `/api/auth/login` | Obtain a JWT |
| `GET` | `/api/auth/setup-status` | Whether first-run setup is still needed |
| `POST` | `/api/auth/setup` | One-time: create the first admin (fails once one exists) |
| `POST` | `/api/visitors/identify` | Register or re-identify a visitor |
| `GET` | `/api/settings/public` | Public settings (e.g. is registration open) |
| `GET` | `/api/push/vapid-public-key` | VAPID key for push subscription |

### Authenticated

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/logout` / `GET` `/api/auth/me` | Revoke session / who am I |
| `POST` | `/api/servers/:id/start` \| `/stop` \| `/restart` \| `/reset` | Lifecycle actions |
| `POST` | `/api/servers/:id/rcon` | Send an RCON command |
| `GET` | `/api/servers/:id/events` | Resource/crash/action-failure history |
| `GET`/`POST`/`PUT`/`DELETE` | `/api/games[/:id]` | List / create / update / delete a game |
| `GET` | `/api/games/:id/export` · `POST /api/games/import` | Portable config export/import |
| `POST` | `/api/games/:id/check-update` | Compare local image digest vs. registry |
| `GET`/`POST` | `/api/games/:id/dockerfile` | Read/save a custom Dockerfile |
| `POST` | `/api/games/:id/build` | Build the local image |
| `POST`/`DELETE` | `/api/games/:id/avatar` | Upload/remove cover image |
| `GET`/`GET`/`GET`/`POST`/`PUT`/`PATCH`/`DELETE` | `/api/files/:id[/read\|/download\|/mkdir\|/upload\|/write\|/rename\|/delete]` | File manager |
| `GET`/`POST`/`PUT`/`DELETE`/`POST` | `/api/schedules/:id[/:scheduleId][/run]` | Cron schedule CRUD + manual trigger |
| `GET`/`POST`/`PUT`/`POST`/`DELETE` | `/api/backups/:id[/retention][/:backupId][/download][/restore]` | Backup CRUD + restore |
| `GET`/`DELETE` | `/api/docker/images[/:id]` · `/api/docker/containers[/:id]` | Raw Docker inventory cleanup |
| `GET`/`DELETE`/`PATCH`/`DELETE` | `/api/visitors[/:id][/block\|/unblock]` · `/api/visitors/blocklist[/:ip]` | Visitor + blocklist management |
| `GET`/`PUT`/`POST`/`POST` | `/api/settings` · `/notify/test-discord` · `/wipe-all` | Settings, Discord test, factory reset |
| `POST`/`DELETE`/`POST` | `/api/push/subscribe` · `/test` | Push subscription management |
| `GET`/`GET`/`POST`/`PATCH`/`PATCH`/`DELETE` | `/api/admins[/permissions][/:id][/me/password][/:id/password]` | Admin roster & permissions — `super_admin` only, except self password change |
| `GET`/`GET`/`DELETE` | `/api/vpn/status` | VPN self/peer status |

### WebSocket Rooms

| Room | Auth | Purpose |
|---|---|---|
| `status` | Public | Live server status broadcasts |
| `logs:<id>` | JWT | Container log stream — also carries console output; input is sent via a `console:input` event, not a room |
| `build:<id>` | JWT | Docker image build output |
| `stats:<id>` | JWT | Live CPU/memory/network stats for one server |

---

## Security Notes

- Access is meant to be VPN-gated at the network level — don't expose ServerDock's port to the public internet.
- The JWT lives in `sessionStorage` (cleared when the tab closes), never `localStorage`.
- Login and first-run setup are both rate-limited.
- Granular permissions are checked fresh on every request, not baked into the login token — revoking one takes effect immediately.
- The file manager is sandboxed to each game's `data/` directory, rejects path traversal and binary files, caps edits at 512 KB, and writes atomically.
- No HTTPS — the VPN tunnel handles encryption.

---

For architecture notes aimed at contributors/AI coding agents (data model, invariants, "what not to do"), see [CLAUDE.md](CLAUDE.md).
