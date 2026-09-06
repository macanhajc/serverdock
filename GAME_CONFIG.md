# ServerDock — Game Configuration

Each game is one folder under `backend/games/<id>/`:

```
backend/games/<id>/
├── <id>.json      ← game definition (see Field Reference below)
├── avatar.<ext>   ← optional cover image, set via the game edit form
├── data/          ← the game server's own data (world saves, configs) — mounted into the container
└── Dockerfile     ← only present for Steam/custom ("local" image source) games
```

`data/` and any `backups/` folder are gitignored (they're runtime/save data); the `<id>.json` config, avatar, and Dockerfile are ordinary tracked files.

---

## Field reference

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique slug. Lowercase, no spaces. Used in the container name (`serverdock-<id>`), API routes, and the folder name — **cannot be changed after creation.** |
| `name` | ✅ | Display name |
| `description` | ❌ | Short text shown in the UI |
| `imageSource` | ✅ | `"public"` or `"local"` — see [Public vs. local images](#public-vs-local-images) |
| `image` | ✅ | Registry image (public) or local tag `serverdock-<id>` (local) |
| `ports` | ✅ | Array of `{ host, container, protocol }` |
| `environment` | ❌ | Array of `{ key, value, pinned? }` — `pinned: true` surfaces the value on the server card in both dashboards |
| `dataMount` | ❌ | Container path where `backend/games/<id>/data/` is mounted (default `/data`) |
| `cpuLimit` | ❌ | CPU quota as a fractional core count (e.g. `2.0` = 2 full cores) |
| `memoryLimit` | ❌ | Memory limit in MB |
| `query` | ❌ | `{ type: "a2s", port: <n> }` — enables the live player count via the Valve Source Engine Query protocol |
| `rcon` | ❌ | `{ enabled, port, password, listCommand?, commands: { broadcast? } }` — enables the in-browser RCON console; `port` must also appear in `ports` so Docker actually publishes it |
| `storeUrl` | ❌ | Steam/GOG/Epic link shown on the game's card |
| `schedules` | ❌ | Managed via the Schedule tab in the UI — don't hand-edit this array |

## Built-in templates

The "Add Game" form offers a small set of quick-start templates (`frontend/src/data/templates.ts`) that pre-fill the form — this is a different, shorter list than whatever games happen to already be configured in a given ServerDock checkout:

| Template | Image source | Notes |
|---|---|---|
| Minecraft | public — `itzg/minecraft-server` | RCON enabled out of the box |
| Valheim | public — `lloesche/valheim-server` | A2S player-count query enabled |
| Terraria | public — `ryshe/terraria` | |
| Factorio | public — `factoriotools/factorio` | |
| CS2 | local (Dockerfile, SteamCMD) | Needs **Build** after creation before it can start |
| ARK: Survival Evolved | local (Dockerfile, SteamCMD) | Needs **Build** after creation |
| Rust | local (Dockerfile, SteamCMD) | Needs **Build** after creation |

Picking a template only pre-fills the create form — every field, including the Dockerfile for SteamCMD-based templates, can be edited afterward. For anything not templated, start from a blank config with a public Docker Hub image, or write a custom Dockerfile for any other SteamCMD-based server.

## Public vs. local images

- **`public`** — pulled from a registry (e.g. Docker Hub) the first time the server starts. Pull progress streams live to the UI.
- **`local`** — built in-browser from an editable Dockerfile (`POST /api/games/:id/build`, streamed to the `build:<id>` socket room), tagged `serverdock-<id>`. Used for anything SteamCMD-based or otherwise custom that isn't published as a ready-made image. A one-click rebuild is available any time the Dockerfile changes.

## Export / import

`GET /api/games/:id/export` returns a portable JSON bundle of the game's config (and its Dockerfile, if it has one) — not the avatar and not `data/`. `POST /api/games/import` recreates the game from that bundle on another instance; it fails if the `id` already exists there.

## Avatar & store link

The cover image and `storeUrl` live in `<id>.json` itself, not in `data/` — uploading, replacing, or removing the avatar never touches the data volume, so it never requires stopping the container (unlike the file manager — see [SECURITY.md](SECURITY.md#file-manager-sandboxing)).

## Resource limits

`cpuLimit`/`memoryLimit` are optional and enforced by Docker at the container level (CPU quota, hard memory limit) — they're shown alongside live usage on the server detail page and factor into the sustained-high-usage check that raises a `resource_high` event (see `server_events` in [CLAUDE.md](CLAUDE.md)).
