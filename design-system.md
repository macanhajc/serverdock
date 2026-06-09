# ServerDock — Design System

**Character:** dark, utilitarian, industrial. This is an operator's tool, not a product. Near-black surfaces, hairline borders, monospace for anything machine-readable, sharp corners everywhere, one accent colour over fixed traffic-light status colours, tight dense layout.

---

## Hard Rules — Never Break These

1. **Radius is always 0px.** Cards, buttons, inputs, badges, panels, tabs, the sidebar, form fields — all square. The **only** exception is the 7px circular status dot (`border-radius: 50%`). No border-radius anywhere else, ever.
2. **Borders over shadows.** Separation is done with 1px hairline borders and one-step surface brightness changes. No drop shadows.
3. **Mono for machine values.** IPs, ports, slugs, paths, engine/image strings, player counts, version strings — always JetBrains Mono. UI chrome (labels, button text, headings) uses system sans.
4. **Status colours are fixed and never themed.** Green `#22c55e` (online), red `#ef4444` (offline/error), yellow `#eab308` (transitional). Do not reuse them for anything non-status.
5. **No decorative emoji.** The only sanctioned emoji are 🌐 (Public Image) and 🎮 (Steam / Custom) on the image-source toggle where a glyph aids fast scanning.
6. **No icon library.** Visual signifiers come from Unicode glyphs (`←`, `×`, `+`, `▾`, `·`), tiny CSS squares (nav bullets, brand tile), and 2-letter mono monograms on card covers.
7. **Accent fills are always low-opacity.** Use `--accent-dim` (22% opacity) for tinted backgrounds and `--accent-edge` (55% opacity) for borders. Solid accent only on hover/active of the primary button.
8. **Copy is terse and operator-facing.** Labels are nouns or imperative verbs, never sentences. The UI addresses the system, not the user.

---

## CSS Tokens

All tokens are CSS custom properties defined on `:root`. Wire them in by adding the following to `frontend/src/index.css` (in addition to the Tailwind import):

```css
@import "tailwindcss";

/* ── Fonts ──────────────────────────────────────── */
@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap");

:root {
  /* ── Surfaces ──────────────────────────────────── */
  --bg:           #0f0f0f;   /* app background / deepest */
  --bg-1:         #141414;   /* cards, top bars, panels */
  --bg-2:         #181818;   /* raised controls, hover */
  --bg-terminal:  #0a0a0a;   /* log + code surfaces */

  /* ── Borders ───────────────────────────────────── */
  --line:         #2a2a2a;   /* default separators */
  --line-2:       #353535;   /* stronger, control borders */

  /* ── Ink (text) ────────────────────────────────── */
  --ink:          #e7e7e7;   /* primary */
  --ink-2:        #a3a3a3;   /* secondary / labels */
  --ink-3:        #6f6f6f;   /* muted / meta / placeholders */

  /* ── Accent (themeable) ────────────────────────── */
  --accent:       #3b82f6;
  --accent-dim:   color-mix(in oklab, var(--accent) 22%, transparent);
  --accent-edge:  color-mix(in oklab, var(--accent) 55%, transparent);

  /* ── Status (fixed — never theme) ─────────────── */
  --green:        #22c55e;
  --red:          #ef4444;
  --yellow:       #eab308;

  /* ── Semantic aliases ──────────────────────────── */
  --surface-app:     var(--bg);
  --surface-card:    var(--bg-1);
  --surface-raised:  var(--bg-2);
  --surface-code:    var(--bg-terminal);
  --border-default:  var(--line);
  --border-strong:   var(--line-2);
  --text-primary:    var(--ink);
  --text-secondary:  var(--ink-2);
  --text-muted:      var(--ink-3);
  --status-online:   var(--green);
  --status-offline:  var(--red);
  --status-pending:  var(--yellow);

  /* ── Log severity ──────────────────────────────── */
  --log-info:     #60a5fa;
  --log-warn:     var(--yellow);
  --log-error:    var(--red);
  --log-ok:       var(--green);
  --log-debug:    #8b8b8b;

  /* ── Typography ────────────────────────────────── */
  --font-sans:    "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-ui:      var(--font-sans);
  --font-code:    var(--font-mono);

  --fs-display:   18px;  /* detail title */
  --fs-h1:        17px;  /* page headings */
  --fs-card:      15px;  /* card titles */
  --fs-body:      14px;  /* base UI text */
  --fs-code:      13px;  /* logs / editor / values */
  --fs-small:     12px;  /* secondary text, buttons */
  --fs-micro:     11px;  /* badges, meta */
  --fs-label:     10px;  /* uppercase keys / tags */

  --fw-regular:   400;
  --fw-medium:    500;
  --fw-bold:      700;

  --tracking-label: 0.08em;
  --tracking-badge: 0.05em;
  --tracking-tight: 0.01em;

  /* ── Spacing (4px base) ────────────────────────── */
  --sp-0:  2px;   --sp-1:  4px;   --sp-2:  6px;
  --sp-3:  8px;   --sp-4:  10px;  --sp-5:  12px;
  --sp-6:  14px;  --sp-7:  16px;  --sp-8:  20px;
  --sp-9:  24px;  --sp-10: 32px;

  --pad-control:    7px 12px;
  --pad-control-sm: 6px 10px;
  --pad-card:       16px;
  --pad-page:       20px 24px;
  --gap-grid:       14px;
  --gap-actions:    6px;

  /* ── Layout ────────────────────────────────────── */
  --sidebar-w:    208px;
  --topbar-h:     56px;
  --thumb-h:      112px;     /* card cover strip */
  --row-pad:      16px;      /* density-driven card padding */
  --card-min:     300px;     /* card grid min-width */

  /* ── Effects ───────────────────────────────────── */
  --radius-none:    0px;
  --radius-dot:     50%;      /* status dots ONLY */

  --border-hairline: 1px solid var(--line);
  --border-control:  1px solid var(--line-2);
  --border-dashed:   1px dashed var(--line-2);
  --border-accent:   1px solid var(--accent-edge);

  --rail-accent:    inset 2px 0 0 var(--accent);  /* active sidebar row */

  --fill-online:    color-mix(in oklab, var(--green)  12%, transparent);
  --fill-offline:   color-mix(in oklab, var(--red)    10%, transparent);
  --fill-pending:   color-mix(in oklab, var(--yellow) 12%, transparent);
  --fill-accent:    var(--accent-dim);

  --focus-border:   var(--accent-edge);

  --ease:           cubic-bezier(.2,.6,.2,1);
  --dur-fast:       .15s;
  --dur-base:       .2s;

  --footer-blur:    blur(6px);   /* sticky form footer only */
}

[data-density="compact"] { --row-pad: 10px; --card-min: 260px; }
[data-density="roomy"]   { --row-pad: 22px; --card-min: 340px; }

/* Pulse animation for transitional status dots */
@keyframes ds-blink { 50% { opacity: .25; } }

/* Micro-label utility — mono, uppercase, tracked, muted */
.ds-label {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
```

---

## Colour Reference

### Surfaces (dark → less dark)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0f0f0f` | App background, deepest layer |
| `--bg-1` | `#141414` | Cards, top bars, panels |
| `--bg-2` | `#181818` | Raised controls, hover state |
| `--bg-terminal` | `#0a0a0a` | Log viewer, code editor |

### Borders

| Token | Value | Use |
|---|---|---|
| `--line` | `#2a2a2a` | Default separators, card edges |
| `--line-2` | `#353535` | Stronger edge, control borders |

### Text

| Token | Value | Use |
|---|---|---|
| `--ink` | `#e7e7e7` | Primary text, active labels |
| `--ink-2` | `#a3a3a3` | Secondary text, form labels |
| `--ink-3` | `#6f6f6f` | Muted, meta, placeholders |

### Status (fixed)

| Token | Value | Use |
|---|---|---|
| `--green` | `#22c55e` | Online, OK, success |
| `--red` | `#ef4444` | Offline, error, destructive |
| `--yellow` | `#eab308` | Starting, building, warning |

### Log Severity

| Token | Value |
|---|---|
| `--log-info` | `#60a5fa` (blue) |
| `--log-ok` | `#22c55e` (green) |
| `--log-warn` | `#eab308` (yellow) |
| `--log-error` | `#ef4444` (red) |
| `--log-debug` | `#8b8b8b` (grey) |

---

## Typography

Two font families. **Never mix them up.**

| Family | Token | Use |
|---|---|---|
| System sans | `--font-sans` | All UI chrome: headings, labels, button text, descriptions |
| JetBrains Mono | `--font-mono` | IPs, ports, slugs, paths, image names, player counts, version strings, log lines, uppercase micro-labels |

**The rule:** if a human typed it → sans. If a machine produced it or a human reads it to a machine → mono.

### Type Scale

| Token | Size | Use |
|---|---|---|
| `--fs-display` | 18px | Server detail title |
| `--fs-h1` | 17px | Page headings |
| `--fs-card` | 15px | Card game name |
| `--fs-body` | 14px | Base paragraph text |
| `--fs-code` | 13px | Log messages, editor, meta values |
| `--fs-small` | 12px | Button text, secondary labels |
| `--fs-micro` | 11px | Badge text, status labels |
| `--fs-label` | 10px | Uppercase section keys (PLAYERS, CONNECT) |

### Casing Rules

- **UI labels / buttons / nav:** Title or sentence case — `Add Game`, `Manage all containers`
- **Micro-labels and tags:** UPPERCASE mono, tracked — `PLAYERS`, `CONNECT`, `STEAM`, `PUBLIC STATUS`
- **Status badges:** UPPERCASE mono — `ONLINE`, `OFFLINE`, `STARTING`, `BUILDING…`
- **Buttons:** One or two words, no trailing punctuation — `Start`, `Stop`, `Restart`, `Reset`, `Build Image`, `Save & Build`

---

## Spacing

4px-based scale. Everything is tight on purpose — this is a dense tool.

| Token | Value | Use |
|---|---|---|
| `--pad-control` | `7px 12px` | Buttons, text inputs |
| `--pad-control-sm` | `6px 10px` | Small buttons, toolbar items |
| `--pad-card` | `16px` | Card body (density-driven via `--row-pad`) |
| `--pad-page` | `20px 24px` | Page-level outer padding |
| `--gap-grid` | `14px` | Card grid gap |
| `--gap-actions` | `6px` | Button row gap inside cards |

---

## Layout

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (208px)  │  Main content area               │
│  --sidebar-w      │  (flex-1)                        │
│                   │                                  │
│  [S] ServerDock   │  Page heading                    │
│  ─────────────    │  ─────────────────────────────   │
│  ● Dashboard      │  Card grid — auto-fill           │
│  ● Manage Games   │  minmax(--card-min, 1fr)         │
│  ─────────────    │  gap: --gap-grid (14px)          │
│  ● Logout         │                                  │
│                   │                                  │
│  footer meta      │                                  │
└──────────────────────────────────────────────────────┘
```

- **Sidebar:** 208px fixed (`--sidebar-w`), background `#0c0c0c`, right border `--line`
- **Card grid:** `grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr))`
- **Card cover strip:** 112px tall (`--thumb-h`), per-game radial gradient + monogram
- **Density:** Set `data-density="compact"` or `"roomy"` on a parent scope to retune padding

---

## Iconography

No icon library. Visual signifiers use:

| Type | Examples |
|---|---|
| Unicode glyphs | `←` back, `×` remove row, `+` add, `▾` dropdown, `·` separator, `⤓` upload |
| CSS square (7×7px) | Nav bullet, active dot, brand "S" tile |
| Status dot (7px circle) | The only round element — colour-coded by state |
| 2-letter mono monogram | `VH`, `MC`, `RS` on card covers — stand-in for game art |
| Emoji | 🌐 Public Image, 🎮 Steam / Custom on the image-source toggle **only** |

---

## Components

All components use inline styles against the CSS token variables. No Tailwind classes inside component files — Tailwind is for page-level layout only.

---

### Button

```jsx
import { Button } from './components/core/Button'

// Variants: default | primary | danger | warn | ghost
// Sizes:    md (default) | sm

<Button variant="primary" size="sm">Start</Button>
<Button variant="danger"  size="sm">Stop</Button>
<Button variant="warn"    size="sm">Restart</Button>
<Button variant="default" size="sm">Rebuild</Button>
<Button variant="ghost"   size="sm">Cancel</Button>
<Button variant="danger"  size="sm" disabled>Reset</Button>
```

**Rules:**
- `primary` — accent dim fill, goes solid on hover. One per action group.
- `danger` / `warn` — stay grey until hover, then blush red/yellow. They don't shout by default.
- `size="sm"` for in-card rows and toolbars; `md` for page-level actions.
- Disabled → 35% opacity, pointer-events blocked.
- Always `borderRadius: 0`.

---

### StatusBadge

```jsx
import { StatusBadge } from './components/core/StatusBadge'

// status: "online" | "offline" | "starting" | "built" | "building" | "none"

<StatusBadge status="online" />
<StatusBadge status="offline" />
<StatusBadge status="starting" />       // dot pulses
<StatusBadge status="building" />       // dot pulses
<StatusBadge status="built" />
<StatusBadge status="none" />           // dashed border
```

**Structure:** Leading 7px circle dot + UPPERCASE mono text. Square badge border. `starting` and `building` dots pulse via `ds-blink`. `online` dot has a soft halo.

---

### Toggle

```jsx
import { Toggle } from './components/core/Toggle'

<Toggle
  checked={autoScroll}
  onChange={setAutoScroll}
  label="Auto-scroll"
/>
```

Sharp-edged track (34×18px). Off → grey knob on dark track. On → accent knob on accent-dim track. No pill shape.

---

### TextField

```jsx
import { TextField } from './components/forms/TextField'

// prose input
<TextField label="Server name" placeholder="My Minecraft Server" />

// machine value — use mono + hint
<TextField label="Docker image" hint="docker hub" mono placeholder="itzg/minecraft-server" />

// code / Dockerfile
<TextField label="Dockerfile" textarea code />

// disabled
<TextField label="RCON port" disabled value="25575" />
```

**Rules:**
- `mono` for slugs, IPs, ports, image names, paths
- `code` for Dockerfiles and file editor (uses `--bg-terminal`, JetBrains Mono)
- Focus: accent border, surface lifts to `--bg-2`. No glow ring.
- Always `borderRadius: 0`.

---

### SegmentedControl

```jsx
import { SegmentedControl } from './components/forms/SegmentedControl'

<SegmentedControl
  options={[
    { label: '🌐 Public Image', value: 'public' },
    { label: '🎮 Steam / Custom', value: 'local' },
  ]}
  value={imageSource}
  onChange={setImageSource}
/>
```

Shared outer border, internal segment dividers, active segment gets `--accent-dim` fill. Square corners.

---

### Tabs

```jsx
import { Tabs } from './components/navigation/Tabs'

<Tabs
  tabs={[
    { label: 'Logs', value: 'logs', count: 'live' },
    { label: 'Files', value: 'files' },
  ]}
  value={activeTab}
  onChange={setActiveTab}
/>
```

Underline indicator in accent colour. Inactive tabs use `--ink-3`. Optional `count` suffix rendered in mono (e.g. `live`, `/server`).

---

### SidebarNav

```jsx
import { SidebarNav } from './components/navigation/SidebarNav'

<SidebarNav
  active={currentRoute}
  onSelect={navigate}
  items={[
    { label: 'Dashboard',    value: 'dashboard' },
    { label: 'Manage Games', value: 'games' },
    { divider: true },
    { label: 'Logout',       value: 'logout', danger: true },
  ]}
  footer={<>admin@localhost<br />v0.4.1 · docker 26.1</>}
/>
```

**Active row:** `--bg-2` surface + inset 2px accent rail (`--rail-accent`) + accent dot.
**Danger row:** muted by default, reddens on hover.
**Brand lockup:** accent "S" tile + "ServerDock" text — baked in, no extra code.
**Footer:** mono, `--ink-3`, version/host meta.

---

### ServerCard

```jsx
import { ServerCard } from './components/data/ServerCard'
import { Button } from './components/core/Button'

// Game hues (use consistently per game)
// Minecraft: 120 (green)  Valheim: 150 (teal)  CS2: 200 (blue)
// ARK: 30 (orange)        Rust: 18 (red-orange) Factorio: 48 (yellow)  Terraria: 160 (lime)

// Public dashboard (read-only — no actions prop)
<ServerCard
  name="Valheim"
  engine="lloesche/valheim-server"
  status="online"
  players="4 / 10"
  ip="192.168.1.50:2456"
  hue={150}
  mark="VH"
  source="Steam"
/>

// Admin dashboard (with action row)
<ServerCard
  name="Rust"
  engine="rust:latest"
  status="starting"
  players="0 / 100"
  ip="192.168.1.50:28015"
  hue={18}
  mark="RS"
  source="Steam"
  actions={<>
    <Button variant="primary" size="sm" disabled>Start</Button>
    <Button variant="danger"  size="sm">Stop</Button>
    <Button variant="warn"    size="sm">Restart</Button>
    <Button variant="default" size="sm">Reset</Button>
  </>}
/>
```

**Cover:** radial gradient in the game's hue, 2-letter mono monogram, source tag (Steam / Public).
**Meta grid:** PLAYERS and CONNECT labels in mono uppercase, values in mono.
**Children slot:** use for the Steam build strip (badge + Build Image button) above the action row.
**Players:** pass `null` while RCON is deferred — renders as `—`.

---

### LogLine / LogViewer

```jsx
import { LogLine, LogViewer } from './components/data/LogLine'

<LogViewer height={420}>
  <LogLine ts="12:04:02" level="INFO">Steam: validating app 258550</LogLine>
  <LogLine ts="12:04:05" level="OK">124 files validated, 0 missing</LogLine>
  <LogLine ts="12:04:24" level="WARN">Query port 28016 already in use</LogLine>
  <LogLine ts="12:04:26" level="ERROR">Failed to bind — retrying in 5s</LogLine>
  <LogLine ts="12:04:31" level="DEBUG">rcon handshake complete</LogLine>
</LogViewer>
```

**Levels:** `INFO` (blue) · `OK` (green) · `WARN` (yellow) · `ERROR` (red) · `DEBUG` (grey)

**Layout:** locked 3-column grid — `max-content` (timestamp) · `52px` (level) · `1fr` (message). Columns never overlap; long messages wrap under themselves.

**Auto-scroll:** after appending a line, set `containerRef.current.scrollTop = containerRef.current.scrollHeight`.

---

## Hover & Interaction States

| Element | Default | Hover | Active/Focus |
|---|---|---|---|
| Default button | `--bg-2` surface, `--ink-2` text | `--bg-3`, `--ink`, lighter border | — |
| Primary button | `--accent-dim` fill | Solid `--accent`, white text | — |
| Danger button | Grey (same as default) | Red tint, red border | — |
| Warn button | Grey | Yellow tint, yellow border | — |
| Nav item | Transparent | `--bg-1` surface | `--bg-2` + accent rail |
| Text input | `--bg-1` | — | `--bg-2`, accent border |
| Toggle off | `--bg-3` track, grey knob | — | `--accent-dim` track, accent knob |

---

## Voice & Copy

**Pattern:** terse, operator-facing, no filler.

| Context | Good | Bad |
|---|---|---|
| Button | `Start`, `Stop`, `Build Image` | `Start Server`, `Click to stop` |
| Page subtitle | `8 servers · 4 online · live status` | `Welcome to ServerDock!` |
| Empty state | `select a file to open it in the editor` | `No file selected yet` |
| Status | `accepting connections` | `Server is running great!` |
| Error | `image not built — run Build Image first` | `Oops! Something went wrong.` |
| Footer | `local session · 127.0.0.1 · TLS off (LAN)` | — |
| Separator | `·` (middot) | `|`, `-`, `/` |

---

## Integration Checklist

When building a new screen or component:

- [ ] Surface uses `--bg`, `--bg-1`, or `--bg-2` — not Tailwind `bg-gray-*`
- [ ] All borders are `1px solid var(--line)` or `var(--line-2)` — not Tailwind `border-*`
- [ ] `border-radius: 0` on every control and container
- [ ] Machine values (IPs, ports, slugs, counts) use `var(--font-mono)`
- [ ] UI labels use `var(--font-sans)`
- [ ] Status colours only on status — not repurposed for other semantics
- [ ] Buttons use the `Button` component — no ad-hoc `<button>` styling
- [ ] Status indicators use `StatusBadge` — no ad-hoc badge divs
- [ ] No drop shadows
- [ ] Log output uses `LogLine` + `LogViewer` — 3-column grid layout
- [ ] `players` value is `null` / `—` until RCON is implemented (Phase deferred)
