# Deploying ServerDock

ServerDock's supported production target is a single **Linux (Ubuntu) machine** — it uses `network_mode: host` for the Docker deployment and shells out to Docker/NetBird directly, both of which are Linux-specific. **Windows is documented below for local development and testing only**, not for running a real instance for friends to connect to.

- [Linux — Docker (recommended)](#linux--docker-recommended)
- [Linux — Advanced: without Docker](#linux--advanced-without-docker)
- [Windows — development & testing](#windows--development--testing)
- [Environment variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Linux — Docker (recommended)

Nothing to install on the host except Docker itself — no Node/npm, no nginx, no PM2.

### Prerequisites

An Ubuntu machine with [Docker Engine](https://docs.docker.com/engine/install/) and the Compose plugin installed, and (optionally, for friends to connect) a mesh VPN set up — [NetBird](https://netbird.io) by default, or [Tailscale](https://tailscale.com)/WireGuard/[ZeroTier](https://www.zerotier.com)/a manual static IP. See [NETWORKING.md](NETWORKING.md) for the full comparison — whichever you pick, note the [Docker deployment caveat](NETWORKING.md#docker-deployment-caveat) below before assuming auto-detection will work.

### Install

```bash
git clone <repo-url> /opt/serverdock
cd /opt/serverdock

# Persistent, host-visible storage — game configs/data, and the app's own state
mkdir -p /opt/serverdock/backend/games /opt/serverdock/backend/state

docker compose up -d --build
```

Open `http://<this-machine's-IP>:4000`. The first load shows a one-time setup screen to create your admin account and pick a network provider — no `setup-auth.js`, no manually generated `JWT_SECRET`/VAPID keys, all handled for you (see [Environment variables](#environment-variables)). Friends use the same URL for the read-only public dashboard once they're on your mesh.

### What the deployment actually does

- **`network_mode: host`** — the container binds directly to the host's network instead of getting its own. This is required for RCON and the player-count poll to reach the ports game containers publish on the host (exactly like a non-Docker install) — without it, those features would silently stop working. It also means `ports:` in `docker-compose.yml` does nothing; change `PORT` in the `environment:` block instead if you don't want 4000.
- **`/var/run/docker.sock` is bind-mounted in** so ServerDock can create/control game containers on the host's own Docker daemon — the same "Docker-outside-of-Docker" access model tools like Portainer use. This is a deliberate, broad grant: anything with access to this container effectively has root-equivalent control of the host's Docker.
- **Two bind mounts hold everything persistent:**
  - `/opt/serverdock/backend/games` — every game's config, avatar, Dockerfile, and data (world saves, etc). This one is mounted at the **exact same absolute path** inside the container as on the host, on purpose (see the callout below) — don't change the left-hand side.
  - `/opt/serverdock/backend/state` — `serverdock.db` (admins, permissions, visitors, event history) and `settings.json`.
  
  Back up `/opt/serverdock` and you have the entire install; there are no other volumes.

> **Why the games mount can't be remapped.** ServerDock doesn't just serve a UI — it asks the Docker daemon to create *other* containers with a data-volume bind mount, and it computes that bind path from *its own* filesystem view. Since the daemon it's talking to is the host's real daemon, that path has to be real *on the host too*, or the daemon quietly creates an empty directory there instead of finding your actual data — the game would start, but write into nothing you can find or back up. Keeping the container-side path identical to the host-side path is what avoids that. This is purely a Docker-outside-of-Docker mechanic, not something you need to think about day-to-day — just don't edit that one line in `docker-compose.yml`.

### Updating

```bash
cd /opt/serverdock
git pull
docker compose up -d --build
```

### Backing up / moving to a new machine

Everything persistent lives under `/opt/serverdock/backend/{games,state}`. Stop the container, `tar` that directory, copy it to the new host at the same path, `docker compose up -d --build`.

### Uninstalling

```bash
docker compose down
# /opt/serverdock/backend/{games,state} still has your data — remove it manually if you want it gone too
```

---

## Linux — Advanced: without Docker

More moving parts (a process manager, optionally nginx), no Docker dependency for running ServerDock itself (Docker Engine is still required for it to manage game containers).

### Prerequisites

- **Node.js 18+** (tested on 24 LTS)
- **Docker Engine**, with the user running the backend able to reach `/var/run/docker.sock`:
  ```bash
  sudo usermod -aG docker $USER
  newgrp docker
  ```
- **A mesh VPN** (optional, but needed for friends to connect) — NetBird, Tailscale, WireGuard, or ZeroTier; see [NETWORKING.md](NETWORKING.md)

### Install

```bash
git clone <repo-url> /opt/serverdock
cd /opt/serverdock

cd backend && npm install
cd ../frontend && npm install
```

### Configure

Create `backend/.env` (see [Environment variables](#environment-variables) for the full list — everything here is optional except in the ways noted):

```env
PORT=4000
SERVER_HOST=192.168.1.10      # fallback IP shown to friends if the network provider isn't detected
CORS_ORIGIN=http://192.168.1.10:3000
```

`JWT_SECRET` is deliberately absent — leave it unset and the backend generates one on first boot and persists it in `backend/settings.json`. Only set it explicitly if you want a fixed value (e.g. to keep sessions valid across a database wipe). VAPID keys (for browser push notifications) are generated and persisted the same way — nothing to configure.

Which network provider to use (NetBird/Tailscale/WireGuard/ZeroTier/manual) is chosen from the app itself (first-run setup, or Settings → Network later), not an environment variable — see [NETWORKING.md](NETWORKING.md).

**Admin account:** the first time the app boots with no admins configured, the frontend shows a one-time setup screen — no CLI step needed. `node setup-auth.js --username admin --password <your-password>` (run from `backend/`) still works as a scripted alternative and doubles as the recovery path if every admin account gets locked out (creates the account, or resets its password, directly in `backend/serverdock.db`).

### Run — development

```bash
# From the repo root — runs both with one command (waits for the API before starting Vite)
npm run dev
```

or in two terminals:

```bash
# Terminal 1 — backend (auto-reloads with nodemon)
cd backend && npm run dev

# Terminal 2 — frontend (Vite dev server)
cd frontend && npm run dev
```

Open `http://localhost:5173` for the public dashboard, `http://localhost:5173/auth` for admin login.

### Run — production with PM2

```bash
cd frontend && npm run build
# Serve frontend/dist/ via nginx or any static file server, then:
cd /opt/serverdock
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # follow the printed command to enable auto-start on boot
```

### Run — production with systemd

```bash
sudo cp serverdock.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now serverdock
sudo journalctl -u serverdock -f   # follow logs
```

(This path serves the API only — same as PM2, you still need to build the frontend and serve `frontend/dist/` yourself, e.g. via nginx.)

---

## Windows — development & testing

Windows isn't a production target (see the top of this doc) — this section is for working on ServerDock's code, or trying it out locally before deploying to a real Ubuntu box.

### Local development (no Docker)

Same commands as the Linux dev path, from PowerShell:

```powershell
cd backend; npm install; npm run dev
```
```powershell
# separate terminal
cd frontend; npm install; npm run dev
```

Open `http://localhost:5173`. Docker Desktop still needs to be running for game-container management to work — Docker Engine access is required regardless of platform.

### Local testing with Docker Desktop

You can build and run the real image locally, but two things need a Windows-specific override, both of which only work correctly on a real Linux host:

- `network_mode: host` isn't meaningfully supported by Docker Desktop — swap it for a published port.
- Bind-mounting `/opt/serverdock/backend/games` to itself doesn't work the way it does on Linux: Docker Desktop runs the daemon inside its own hidden VM, and a Windows-side bind mount only exists for *that specific mount instruction* — when ServerDock's own container later asks the daemon to bind-mount that same path for a *new* game container, the daemon resolves it against its own VM's filesystem, not the Windows folder you mounted. The practical effect: game servers start and run fine, but their data is invisible from Windows Explorer, and ServerDock's own Files/Backups tabs will show that data as empty too, since they read through the same broken indirection. This was confirmed hands-on (`docker inspect`/`docker exec` on a running game container showed real world-save data sitting outside the Windows-visible mount), not theoretical.

There's no clean fix for that second point on Docker Desktop — it's a platform limitation, not a ServerDock bug. Treat this setup as good enough for exercising the UI, server lifecycle, and general workflow, but not for validating backups, the file manager, or RCON/player-count polling. For that, use a real Ubuntu box/VM, or Docker Engine installed natively inside a WSL2 Ubuntu distro (not Docker Desktop's integration) — either has no translation layer in between and behaves exactly like the production target.

```powershell
mkdir .local-docker-test\games, .local-docker-test\state

docker compose -f docker-compose.yml -f docker-compose.windows-test.yml up -d --build
```

Open `http://localhost:4000`. `docker-compose.windows-test.yml` (repo root) holds the two overrides described above — it's gitignored test tooling, not part of the shipped deployment.

```powershell
# tail logs
docker compose -f docker-compose.yml -f docker-compose.windows-test.yml logs -f

# stop (keeps .local-docker-test/ data)
docker compose -f docker-compose.yml -f docker-compose.windows-test.yml down

# full reset
docker compose -f docker-compose.yml -f docker-compose.windows-test.yml down
Remove-Item -Recurse -Force .local-docker-test
```

---

## Environment variables

All optional unless noted. Set via `backend/.env` (non-Docker) or `docker-compose.yml`'s `environment:` block (Docker).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP/WebSocket port |
| `JWT_SECRET` | auto-generated on first boot, persisted in `settings.json` | Signs admin session tokens — set explicitly to pin a fixed value |
| `SERVER_HOST` | *(none)* | Fallback connect IP shown to friends when the configured network provider isn't detected — always set this for a Docker install, since provider auto-detection doesn't cross the container boundary (see [NETWORKING.md](NETWORKING.md#docker-deployment-caveat)) |
| `CORS_ORIGIN` | `http://localhost:5174` | Allowed origin for the API — irrelevant once the frontend is served from the same origin (the Docker image), matters for a split dev/PM2 setup |
| `CONTAINER_DNS` | `1.1.1.1,8.8.8.8` | DNS servers handed to every game container, so they can resolve mod/update servers even when the host's own resolver isn't reachable from inside a container |
| `DOCKER_HOST` | *(platform default socket/pipe)* | Override the Docker daemon endpoint — rarely needed |
| `DB_PATH` | `backend/serverdock.db` | SQLite database location — the Docker image points this at the mounted state directory |
| `SETTINGS_PATH` | `backend/settings.json` | Settings file location — same idea |

---

## Troubleshooting

- **`docker: unavailable` on `/api/health`, or "Docker daemon unreachable" banner** — the backend (or container) can't reach `/var/run/docker.sock`. Non-Docker install: confirm your user is in the `docker` group and you've re-logged-in (`newgrp docker`). Docker install: confirm the socket volume mount is present in `docker-compose.yml`.
- **Port already in use** — set `PORT` to something else (`.env` for the non-Docker path, `environment:` in `docker-compose.yml` for Docker).
- **Friends' connect address is wrong or missing** — set `SERVER_HOST` explicitly. Provider auto-detection needs that provider's CLI reachable from wherever the backend runs, which the Docker image doesn't have by default (see [NETWORKING.md](NETWORKING.md#docker-deployment-caveat)).
- **First-run setup screen doesn't appear on a fresh install** — check `GET /api/auth/setup-status`; if it reports `needsSetup: false` unexpectedly, an admin already exists (check `backend/serverdock.db`, or `state/serverdock.db` for Docker).
- **A game's image pull is rate-limited** — Docker Hub anonymous pulls are rate-limited per IP; wait, or authenticate the host's Docker daemon (`docker login`) against a Docker Hub account.
