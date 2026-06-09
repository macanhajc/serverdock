# Future Feature: Docker Compose Support

**Status:** Deferred — not yet implemented  
**Motivation:** Some game servers (e.g. OpenMU) require multiple cooperating containers (app + database + proxy) that can't be managed as a single Docker container.

---

## Problem

ServerDock currently manages one Docker container per game. Multi-service games that ship a `docker-compose.yml` cannot be fully managed — only the main app container can be added, leaving the database and other dependencies to be run manually outside ServerDock.

---

## Proposed Solution

Add a `"compose"` image source type alongside the existing `"public"` and `"local"` types. Compose games would delegate start/stop/restart/build to `docker compose` instead of dockerode.

### Game config change

```json
{
  "id": "openmu",
  "name": "OpenMU",
  "imageSource": "compose",
  "composeFile": "games/openmu/docker-compose.yml",
  "primaryService": "openmu-startup"
}
```

The `primaryService` field identifies which service to use for status, log streaming, and A2S queries.

---

## Scope of Changes

### Backend

- `containers.js` — add a compose execution path (shell out to `docker compose up/down/restart/build`) alongside the existing dockerode path; route based on `imageSource`
- `gameLoader.js` — handle `"compose"` type; validate that `composeFile` exists
- Status detection — inspect only the `primaryService` container for aggregate state
- Build — run `docker compose build` instead of dockerode `buildImage`
- Reset — run `docker compose down -v` then wipe `data/`

### Log streaming

The `logs:<id>` WebSocket room currently streams one container. For compose games, options are:

- **Merged stream** — pipe `docker compose logs -f` with `[service]` prefix on each line (simplest)
- **Per-service selector** — UI lets the user pick which service to tail (more flexible, more work)

Merged stream is recommended for the initial implementation.

### File manager

The sandbox is anchored to `backend/games/<id>/data/`. Compose stacks may store data in named volumes or multiple bind-mount paths. For the first version, the file manager can be **disabled** for compose games (show a "Not available for compose-based servers" message) until a per-service path configuration is designed.

### Frontend

- `GameForm` — add a third source type ("Compose") with a YAML editor in place of the Dockerfile editor
- Log viewer — handle merged multi-service output (service prefix already visible in the line text)
- Templates — add compose-based game presets (OpenMU at minimum)

---

## Security Considerations

Compose files are more powerful than Dockerfiles — they can bind-mount arbitrary host paths, use `network_mode: host`, or define privileged containers. If the compose file is editable in the UI (as Dockerfiles currently are), the implications should be reviewed before shipping. At minimum, consider read-only display with upload-only editing for compose files.

---

## What to Leave Alone

- Single-container games (`"public"` and `"local"`) — no changes to their path
- A2S player query — unchanged, still queries a port on the host
- Visitor tracking, settings, VPN — unaffected
- Auth, JWT, file manager for non-compose games — unaffected
