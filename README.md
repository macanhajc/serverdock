# ServerDock

ServerDock is a self-hosted control panel for running game servers on your own machine, in Docker. One admin manages everything — creating servers, starting/stopping them, editing their files, scheduling restarts, watching logs — from a browser. Friends get a separate, read-only dashboard that shows who's online and how to connect, with no admin access and no account required beyond a display name.

It's built for the "I have a spare machine and some friends" use case: a home server, a mini PC, a cheap VPS. There's no public-facing login, no exposed ports, and no HTTPS to configure — access is gated entirely by joining a private VPN mesh (NetBird, Tailscale, WireGuard, or ZeroTier — pick one in Settings), so the whole thing is designed to be reachable only by people you've actually invited.

---

## Screenshots

---

## Getting Started

**→ See [DEPLOYMENT.md](DEPLOYMENT.md) for installation.** It covers the recommended Docker install on Linux, an advanced Node/PM2/systemd path without Docker, and running ServerDock on Windows for local development or testing.

Once it's running, using it looks like this:

1. **First boot** shows a one-time setup screen to create your admin account and pick a network provider — no config file editing, no CLI step.
2. **Add a game** from the Dashboard using a built-in template (or start from a blank config for anything not templated) and click Start. Public-image games pull automatically; games with a Dockerfile build in-browser with a live log. See [GAME_CONFIG.md](GAME_CONFIG.md).
3. **Invite friends** to your mesh (see the in-app "How to connect" guide on the public dashboard) — once they're on it, the public dashboard at your server's address shows them live status and a copy-pasteable connect address for each server. See [NETWORKING.md](NETWORKING.md).
4. **Manage from there**: console/RCON, live logs, file editing, backups, cron schedules, and — if you want help running things — additional admin accounts with hand-picked permissions.

---

## Features

### Server management
- Create, edit, start, stop, restart, and reset any game server; state-aware controls prevent invalid actions (e.g. no "start" on a server that's already running).
- Live status/CPU/RAM/disk/network table across all servers, with a global fleet summary card, host OS/uptime info, and a live peer count from your configured network provider.
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
- Pluggable network provider — [NetBird](https://netbird.io), [Tailscale](https://tailscale.com), WireGuard, [ZeroTier](https://www.zerotier.com), or a manual static IP — chosen once in Settings. The public dashboard walks new visitors through joining whichever mesh is active; the host's own VPN IP is auto-detected and used as the connect address where possible. See [NETWORKING.md](NETWORKING.md).

### Notifications
- Discord webhook and browser Web Push (VAPID) notifications for unexpected server exits (with crash detail), failed scheduled actions, sustained high CPU/RAM usage (2+ minutes over 90%, to avoid noise from brief spikes), and low host disk space.

### Setup & extensibility
- First-run web-based admin setup — no CLI, no manually generated secrets (`JWT_SECRET` and VAPID push keys are auto-generated and persisted if you don't supply them).
- A raw Docker inventory page (images/containers on the host, including anything not managed by ServerDock) for cleanup.
- Two languages out of the box (English, Portuguese), a dark terminal-inspired UI, and toast notifications for action feedback.

---

## Games included out of the box

7 Days to Die · Abiotic Factor · Enshrouded · HumanitZ · Minecraft · Minecraft (Modded) · Palworld · Project Zomboid · Valheim · VintageStory · V Rising

Anything else can be added as a blank config with a public Docker image, or with a custom Dockerfile for SteamCMD-based servers — see [GAME_CONFIG.md](GAME_CONFIG.md).

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

- **Docker is the source of truth for container/image state.** ServerDock never caches "is this server running" — it asks the Docker daemon. Game *configuration* lives in JSON files under `backend/games/<id>/`, one folder per game (see [GAME_CONFIG.md](GAME_CONFIG.md)); only auth/permissions/visitors/blocklist and a small, capped table of resource/crash/action-failure events live in SQLite.
- **Roles are `super_admin` (everything, always) and `admin` (nothing until granted)** from a fixed permission catalog, enforced server-side on every request — see [API.md](API.md#permission-gated).
- **Containers are named `serverdock-<id>`**, run with no restart policy (only explicit admin action starts/stops them), and get explicit DNS by default so they resolve mod/update servers correctly regardless of the host's own resolver setup.
- **Real-time UI updates** ride on a handful of Socket.IO rooms rather than polling — see [API.md](API.md#websocket).
- **No public exposure, no HTTPS.** Access is VPN-gated at the network level — see [NETWORKING.md](NETWORKING.md) and [SECURITY.md](SECURITY.md).

---

## Documentation

| Doc | Covers |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Installing on Linux (Docker or bare Node/PM2/systemd), local dev/testing on Windows, environment variables, troubleshooting |
| [NETWORKING.md](NETWORKING.md) | The pluggable network-provider system (NetBird/Tailscale/WireGuard/ZeroTier/manual), how the friend-facing connect address is resolved, the Docker-install auto-detection caveat |
| [GAME_CONFIG.md](GAME_CONFIG.md) | The `<id>.json` field reference, built-in templates, public vs. local (Dockerfile) images, export/import |
| [API.md](API.md) | Full REST endpoint reference by auth/permission level, and every WebSocket room and event |
| [SECURITY.md](SECURITY.md) | Threat model, auth/session details, file-manager sandboxing, what's deliberately out of scope |
| [CLAUDE.md](CLAUDE.md) | Architecture notes and invariants aimed at contributors/AI coding agents — the deepest reference for *why* things work the way they do |
| [design-system.md](design-system.md) | The UI's visual language, if you're touching the frontend |
