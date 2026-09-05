# ServerDock — Networking & VPN Providers

ServerDock is never meant to be reachable from the public internet. Access is gated by putting the host and its admin/friends on the same private network mesh — a **network provider** answers two questions for the rest of the app: *what's this host's own address on the mesh* (shown to friends as the connect IP) and *who else is on the mesh* (shown to the admin on the Network page).

Game containers are never joined to any of these networks — every provider below is host-level only, used solely to resolve the host's own address.

---

## Supported providers

Set in **Settings → Network** (also asked once during first-run setup). Stored as `settings.networkProvider`; default is `netbird` (preserves the behavior of installs that predate this setting).

| Provider | Mechanism | Peer directory | Notes |
|---|---|---|---|
| **NetBird** (default) | `netbird status --json` | Name, IP, OS, online, last seen, latency, direct/relayed | Requires the `netbird` CLI reachable from wherever the backend runs, and its daemon connected. |
| **Tailscale** | `tailscale status --json` | Name, IP, OS, online, last seen, direct/relayed | No true round-trip latency — that would need an extra `tailscale ping` subprocess per peer, so it's left out. |
| **WireGuard** | `wg show <iface> dump` + `ip addr show <iface>` | Public key (truncated), IP, inferred online state | No built-in peer directory (no names, no OS) — "online" is inferred from a handshake within the last 3 minutes, not a real connection state. Interface name comes from `settings.wireguardInterface` (default `wg0`), validated against `^[a-zA-Z0-9_.-]{1,15}$` before it's ever used as a process argument. |
| **ZeroTier** | `zerotier-cli -j status\|listnetworks\|listpeers` | Address, active path, latency | No friendly peer names or OS — that data lives on my.zerotier.com, out of scope here. |
| **Manual** | — | none | The explicit "I'm not using a mesh VPN" choice. Always returns no self-IP and no peers, which forces the `serverHost` fallback below. |

Each provider module lives at `backend/src/lib/vpn/providers/<id>.js` and exports `id`, `label`, and `async getStatus(settings) -> { self, peers }`. `backend/src/lib/vpn/index.js` is the single dispatch point (`PROVIDER_IDS` is the source of truth for valid `networkProvider` values).

## How the connect address is resolved

`resolveHost()` (`backend/src/routes/servers.js`) tries, in order:

1. The active provider's `getSelfIp()` (its `self.ip`, if the provider reports one)
2. `settings.serverHost` — the manual fallback IP set in Settings
3. the `SERVER_HOST` environment variable
4. `127.0.0.1`

This chain is provider-agnostic — switching providers in Settings never requires touching `serverHost` or `SERVER_HOST` unless auto-detection isn't working.

## Caching

`getVpnStatus()` caches results for 30 seconds, keyed by provider id, so polling the Network page doesn't shell out on every request but also never serves stale peers left over from a *different* provider after a switch. `PUT /api/settings` calls `invalidateVpnCache()` whenever `networkProvider` or `wireguardInterface` changes, so a switch takes effect on the next request rather than waiting out the cache window.

## Docker deployment caveat

The shipped `Dockerfile` is a plain `node:24-bookworm-slim` image — it does **not** bundle the `netbird`, `tailscale`, `wg`, or `zerotier-cli` binaries. Under the recommended Docker install, every non-`manual` provider's `getStatus()` will find its binary missing, catch the error, and safely fall back to `{ self: null, peers: [] }`. In practice this means:

- Auto-detected self-IP and the Network page's live peer list are effectively a **non-Docker-install feature only**, unless you customize the image to add the relevant CLI and give it a way to reach the host's VPN daemon/socket.
- For a Docker install, always set `SERVER_HOST` explicitly (see [DEPLOYMENT.md](DEPLOYMENT.md#environment-variables)) so friends still get a working connect address even though auto-detection can't cross the container boundary.

## Adding a new provider

1. Create `backend/src/lib/vpn/providers/<name>.js` exporting `id`, `label`, and `async getStatus(settings)`.
2. Register it in the `PROVIDERS` map in `backend/src/lib/vpn/index.js`.
3. Add an entry to `frontend/src/data/networkProviders.ts` (id, label, an i18n description key used in both Settings and the setup wizard).
4. Use `execFile()` with an argument array — never `exec()` with string interpolation — and validate any settings-derived value (like an interface name) against a strict pattern before it ever reaches a process argument, the same way `wireguard.js` does for `wireguardInterface`.
5. Fail closed: on any error (binary missing, daemon down, bad permissions), return `{ self: null, peers: [] }` rather than throwing — the rest of the app expects `getStatus()` to always resolve.
