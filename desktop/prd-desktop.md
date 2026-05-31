# Product Requirement Document (PRD) — free-coding-models Desktop (FCM-Desktop)

---

## 1. Overview & Objectives

The objective of **FCM-Desktop** is to transform the command-line interface (CLI) experience of the `free-coding-models` package into a lightweight, ultra-responsive, and accessible system utility residing in the system tray (Tray App / Menu Bar) on macOS, Windows, and Linux.

The application is designed for developers practicing *vibe coding* with autonomous agents (Cline, Aider, Goose, OpenCode, Pi, etc.). It acts as an **intelligent local HTTP proxy (`localhost:19280`)** capable of routing requests on the fly to the most performant and stable free API provider, eliminating failures at the start of generation (Pre-Stream Failover).

### Key Objectives

* **Raw Performance:** Maintain the responsiveness and detection speed of the original CLI.
* **Zero Friction:** No more background commands to launch; the application starts with the OS and exposes a single OpenAI-compatible endpoint.
* **Maximum Code Sharing:** Leverage the existing codebase — not just `sources.js`, but the **entire engine** (router daemon, scoring, ping, config, quota, telemetry) — ensuring that any fix, new model, or provider added instantly benefits the CLI, Docker/Web, and Desktop application with zero duplication.

---

## 2. Architecture & Code Sharing Strategy

### 2.1. Core Principle: One Engine, Three Surfaces

The CLI, the Docker/Web dashboard, and the Desktop app all share the **exact same Node.js engine**. There is no Rust rewrite, no parallel implementation. The business logic exists in one place and is consumed three ways:

```
┌─────────────────────────────────────────────────────────┐
│              📦 Shared Core Engine (src/core/)          │
│                                                          │
│  sources.js (root)                                       │
│  utils.js · ping.js · config.js · constants.js           │
│  router-daemon.js · benchmark.js · telemetry.js          │
│  provider-quota-fetchers.js · quota-capabilities.js      │
│  cache.js · ping-loop.js · model-merger.js               │
│  favorites.js · sync-set.js · provider-metadata.js       │
│                                                          │
│  → Scoring, sorting, filtering, verdict engine           │
│  → HTTP ping infrastructure                              │
│  → Router daemon (OpenAI-compatible failover proxy)      │
│  → Config management (~/.free-coding-models.json)        │
│  → Token tracking, quota management                      │
│  → Circuit breaker, health probes, model sets            │
│  → SSE live events, web dashboard API routes             │
└───────────┬──────────────────┬───────────────┬───────────┘
            │                  │               │
     ┌──────▼──────┐   ┌──────▼──────┐  ┌─────▼──────┐
     │  📟 CLI TUI  │   │ 🐳 Docker   │  │ 🖥️ Desktop │
     │  (terminal)  │   │   / Web     │  │  (Tauri)   │
     │              │   │             │  │            │
     │ chalk, ANSI  │   │ Browser at  │  │ Tauri      │
     │ key-handler  │   │ :19280      │  │ webview    │
     │ overlays     │   │             │  │ + tray     │
     └──────────────┘   └─────────────┘  └────────────┘
                              │               │
                              └───────┬───────┘
                                      │
                            ┌─────────▼──────────┐
                            │  🌐 Same React UI   │
                            │   (web/src/)        │
                            │                     │
                            │  Served by router   │
                            │  daemon in both     │
                            │  Docker and Desktop  │
                            └─────────────────────┘
```

### 2.2. Unified React UI for Web & Desktop

The React application in `web/src/` serves **both** the Docker/Web dashboard **and** the Desktop UI:

| Scenario | Who serves the UI | Who serves the API | User sees |
|----------|-------------------|-------------------|-----------|
| `--daemon` / Docker | router-daemon serves `web/dist/` | router-daemon serves `/api/*` | Browser → `localhost:19280` |
| Desktop (Tauri) | Tauri webview loads embedded `web/dist/` | Node.js sidecar = same router-daemon | Native window, tray icon |
| CLI only | No web UI | No server (or `--daemon-bg`) | Terminal TUI |

The React app communicates exclusively via HTTP (`fetch('/api/models')`, `fetch('/api/config')`, `EventSource('/api/events')`) — the same API whether accessed from a browser tab or a Tauri webview.

Desktop-specific UI features (tray controls, OS notifications, minimize-to-tray) are conditionally enabled:

```js
const isDesktop = window.__TAURI_INTERNALS__ !== undefined
```

This keeps 95%+ of the components identical across web and desktop.

### 2.3. Why Not Rust for the Engine

The original PRD proposed rewriting the engine in Rust (Axum + Reqwest). This approach was abandoned because:

1. **Double maintenance** — every new provider, scoring tweak, or bug fix would need to be ported to two languages
2. **Inevitable desync** — the CLI Node.js engine and the Desktop Rust engine would diverge over time
3. **Illusory performance gain** — the bottleneck is network I/O (HTTP pings to remote APIs), not local CPU. Node.js `fetch()` is perfectly suited for this I/O-bound workload
4. **The router daemon already exists** — `router-daemon.js` (~2,300 lines) already implements the full proxy, failover, circuit breaker, health probes, web dashboard, SSE events, and token tracking. Rewriting it in Rust is wasted effort
5. **Acceptable memory footprint** — the Node.js daemon runs at ~30-50 MB, which is fine for a tray application

---

## 3. Functional Specifications

### 3.1. Local HTTP Proxy & Intelligent Routing

* **Single Endpoint:** `POST http://localhost:19280/v1/chat/completions`
* **Format:** 100% compatible with the OpenAI standard (seamless handling of the `"stream": true` parameter).
* **Selection Algorithm:** Upon receiving an agent request, the proxy identifies the requested model, queries the routing table sorted by stability score, and selects the best provider available at instant $T$.
* **Model:** Point your coding tool at `model: "fcm"` and API key `fcm-local`.

> **Note:** The endpoint is `localhost:19280` (same as the existing `--daemon` mode), not `:4096`. This ensures a single consistent port across CLI daemon, Docker, and Desktop.

* **Port Conflict Detection & Resolution:** 
  * If the desktop app launches and port `19280` is already in use by a CLI/Docker daemon instance, the desktop app will **detect the running instance** via a quick `/api/ping` check.
  * If the existing daemon is running the same API/version, the desktop app will **re-use the existing background daemon** and act as a visual front-end for it, rather than throwing an address-in-use error or spawning a duplicate sidecar.
  * If the daemon is unresponsive or outdated, the desktop app will offer to restart the daemon on a fallback port range or terminate the conflicting CLI process (with user consent via notification prompt).

### 3.2. "Pre-Stream" Failover Mechanism

* **Aggressive Timeout:** When targeting provider $A$, if the response time to get the first HTTP headers (Time to First Token - TTFT) exceeds the configured `requestTimeoutMs` (default: **15 seconds**) or returns a direct error (`429 Too Many Requests`, `503 Service Unavailable`), the proxy aborts the attempt.
* **Transparent Routing:** The proxy immediately switches to provider $B$ (the second highest-ranked for this model) in a manner completely invisible to the user agent. Up to `maxRetries` (default: 3) failover attempts.
* **Stream Locking:** Once the first token is successfully received, the streaming flow is piped directly to the agent without interception or text processing to guarantee minimal network latency.
* **Auth Isolation:** Authentication failures (`401`, `403`) are isolated per-provider — a bad key on provider $A$ does not poison the circuit breaker or prevent failover to provider $B$.
* **Client Disconnect:** If the coding tool disconnects mid-request, the daemon aborts the upstream request immediately without counting it as a provider failure.

### 3.3. Background Benchmark Engine

* The shared Node.js engine runs health probes in the background, isolated from the UI and proxy request handling.
* It performs lightweight pings at regular intervals across provider endpoints to calculate the **Stability Score (0 to 100)** using the formula already implemented in `src/utils.js`:

$$\text{Stability} = 0.30 \times \text{p95\_score} + 0.30 \times \text{jitter\_score} + 0.20 \times \text{spike\_score} + 0.20 \times \text{reliability\_score}$$

Where each component is normalized to 0–100:
- **p95 score** = `max(0, 100 × (1 - p95 / 5000))`
- **Jitter score** = `max(0, 100 × (1 - σ / 2000))`
- **Spike score** = `100 × (1 - spike_rate)` (spikes = pings > 3000ms)
- **Reliability score** = uptime percentage (HTTP 200 pings / total pings)

* Adaptive probe cadence: **2s burst** for the first 60s → **10s normal** → **30s idle**.
* Configurable probe modes: `eco` (120s), `balanced` (30s), `aggressive` (10s).

### 3.4. User Interface (Tray Popover)

The visual interface is the **same React application** as the web dashboard (`web/src/`), displayed in a Tauri webview popover attached to the system tray:

* **Overview:** Proxy status (On/Off) and live ping monitoring represented by lightweight charts, received via SSE from the Node.js engine (`/api/events`).
* **Key Management:** A secure screen to store API keys for the various providers (NVIDIA NIM, Groq, Cerebras, etc.), saved locally in `~/.free-coding-models.json` with file permissions `0o600`.
* **Priority Selection:** A drag-and-drop interface to reorder backup models (preferred fallback order) within router sets.
* **Model Table:** Full model catalog with live latency, stability scores, tier, SWE-bench scores, verdict — identical to the web dashboard.
* **Settings:** Provider enable/disable toggles, theme switching, telemetry opt-out.

#### Desktop-Specific UI Features

These features are only available in the Desktop (Tauri) context, conditionally rendered:

| Feature | How |
|---------|-----|
| **Minimize to tray** | Window close → hide to tray (Tauri window API) |
| **OS notifications** | Alert when a model goes down or failover triggers (Tauri notification plugin) |
| **Auto-start on boot** | Register as login item (Tauri autostart plugin) |
| **Global hotkey** | Quick-open the popover from anywhere (Tauri global shortcut plugin) |
| **Native menu bar** | macOS menu bar / Windows system tray icon |

---

## 4. Technical Specifications & Chosen Stack

| Component | Technology | Role / Justification |
|-----------|------------|---------------------|
| **App Framework** | **Tauri v2** | Ultra-lightweight (~15 MB) cross-platform standalone binary. Provides native tray, window, autostart, notifications, and global shortcuts. |
| **Engine / Proxy** | **Node.js sidecar** | The modularized Node.js engine sidecar. Same code as CLI `--daemon` mode. Zero rewrite. |
| **Sidecar Packaging** | **Bun compile** (Primary) or **Node.js SEA** (Secondary) | The Node.js engine is compiled into a single executable binary bundled inside the Tauri app. **Bun compile** is the primary target due to its solid standalone binary generation, extremely fast startup, and native bundle compression. Node.js SEA serves as the secondary target. No platform Node.js installation is required. |
| **Graphical Interface** | **React** (from `web/src/`) | Same React app used by Docker/Web dashboard. Loaded in Tauri's webview. |
| **Communication** | **HTTP + SSE** | The webview communicates with the sidecar via `localhost:19280` — same API as the browser dashboard (`/api/models`, `/api/config`, `/api/events`, `/v1/chat/completions`). |
| **Desktop-only features** | **Tauri Plugins** | `@tauri-apps/plugin-autostart`, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-global-shortcut`, `@tauri-apps/plugin-shell` |

### Why Tauri + Node.js/Bun Sidecar (Not Electron)

| Criteria | Tauri + Sidecar (Node/Bun) | Electron |
|----------|----------------------------|----------|
| Bundle size | ~15-25 MB | ~80-120 MB |
| RAM idle | ~30-50 MB | ~80-120 MB |
| Code sharing | Sidecar imports `core/` | Main process imports `core/` directly |
| Dev complexity | Medium (sidecar setup) | Low (Node.js native) |
| Native feel | Excellent (OS webview) | Good (Chromium) |

Tauri + Bun/Node sidecar is preferred for its tiny footprint, which is essential for a tray utility that runs 24/7. If sidecar packaging via Bun/SEA proves too complex or fragile, Electron remains the designated fallback option since it offers direct ESM/Node.js imports without bundling steps.

> [!WARNING]
> **macOS Code Signing Risk (Bun Compile):** Bun-compiled binaries inject bytecode at the end of the executable, which can cause Apple's deep codesigning to fail or corrupt the signature. If codesigning issues arise in the CI/CD pipeline, **Node.js SEA (Single Executable Application)** should be promoted as the primary target since it utilizes standard Node.js injection structures compatible with Apple's signing requirements.

### 4.1. Sidecar Lifecycle & Zombie Process Prevention

To prevent the background sidecar process from becoming an orphaned "zombie" process running forever on port `19280` if the Tauri app crashes or is terminated abruptly, the following mechanisms are required:
* **Parent-Death Binding:** In the Tauri Rust main process (`src-tauri/src/main.rs`), the sidecar process must be spawned in a way that links its life to the parent (e.g., standard OS pipe closure detection or explicit child process termination hooks).
* **Heartbeat Check:** The Node.js/Bun sidecar should periodically verify the existence of the parent Tauri process via standard IPC or a lightweight port-based ping. If the parent process is no longer active, the sidecar must exit gracefully within 10 seconds.
* **Spawn Ownership Lifecycle Tracking:** The Desktop app tracks how it connected to the daemon:
  * **Daemon Owner (`isDaemonOwner = true`):** If the Desktop app spawned the sidecar daemon, it owns its lifecycle and will terminate the sidecar on exit.
  * **Visual Front-End (`isDaemonOwner = false`):** If the Desktop app attached to an already running CLI or Docker daemon on port `19280`, it does *not* kill the process on exit, ensuring CLI processes are not interrupted mid-run.

### 4.2. Pragmatic Security Model

* **Loopback Binding Only:** The API routes and local proxy bind exclusively to the loopback interface (`127.0.0.1`). This naturally blocks remote machines on the local network from accessing the API or configuration.
* **Pragmatic Simplicity:** Since the tool handles free-tier/limited AI keys and runs locally on the developer's machine (similar to standard CLI environment variables and local `.env` setups), heavy API gateways or complex cryptographic key exchanges are avoided to keep implementation simple and responsive.

---

## 5. File Structure and Git Workflow

The root `./docs/` directory serves as the **documentation source of truth** common to the entire project (CLI, Web, Desktop, and Backend). Any globally shared specs, filters, stable models, or integration documentation must reside in `./docs/`.

The project retains its current structure and integrates the `desktop` folder at the root:

```text
free-coding-models/ (Root)
├── docs/                         # Common documentation - Source of Truth for CLI, Web, Desktop, Backend
├── sources.js                    # Absolute source of truth (shared)
├── src/                          # Project Logic Segregation
│   ├── core/                     # ⚙️ Shared Core Engine (100% Shared with Desktop Sidecar)
│   │   ├── utils.js              # Scoring, sorting, filtering, verdicts
│   │   ├── ping.js               # HTTP ping infrastructure
│   │   ├── config.js             # Config management (~/.free-coding-models.json)
│   │   ├── router-daemon.js      # Router + proxy + web API
│   │   ├── constants.js          # Timeouts, limits, speed thresholds
│   │   ├── benchmark.js          # AI speed test engine
│   │   ├── telemetry.js          # Anonymous telemetry
│   │   └── ...                   # Other shared modules (cache.js, sync-set.js, etc.)
│   └── tui/                      # 📟 CLI Terminal User Interface (Excluded from Desktop Sidecar)
│       ├── app.js                # TUI main interactive loop
│       ├── key-handler.js        # Terminal stdin keyboard event handlers
│       ├── render-table.js       # ANSI visual grid rendering
│       ├── overlays.js           # Visual popups (Settings, Recommend questionnaire, Help)
│       └── ...                   # Other CLI-only assets (theme.js, mouse.js, etc.)
├── web/                          # React UI (shared between Web/Docker and Desktop)
│   ├── README.md                 # Web-specific documentation
│   ├── src/                      # React components, hooks, styles
│   ├── dist/                     # Built assets (embedded by Docker + Tauri)
│   └── index.html                # SPA entry point
├── bin/                          # CLI entry point
│   └── free-coding-models.js     # CLI main (imports from src/)
└── desktop/                      # Desktop-specific Tauri configuration
    ├── README.md                 # Desktop-specific documentation
    ├── prd-desktop.md            # This document
    ├── tauri.conf.json           # Tauri v2 configuration
    ├── package.json              # Desktop build scripts
    ├── src/                      # Desktop-specific React overrides (minimal)
    │   ├── desktop-bridge.js     # Tauri IPC helpers (notifications, tray, autostart)
    │   └── desktop-overrides.jsx # Conditional desktop UI features
    └── src-tauri/                # Minimal Tauri Rust code
        ├── Cargo.toml
        └── src/
            └── main.rs           # App lifecycle, tray menu, sidecar management
```

### 5.1. Sub-Project Documentation Mandates

To ensure that the new sub-projects remain modular, maintainable, and easily understandable for new contributors, dedicated `README.md` files **must** be created inside the `/web` and `/desktop` directories. 

#### 📦 Web Sub-Project (`/web/README.md`)
The `web` directory holds the shared React dashboard UI. Its README must document:
* **Architecture:** Explain that the single React SPA serves *both* the Docker/Web environment and the Tauri desktop webview.
* **API Integration:** Document the SSE stream endpoints (`/api/events`) and configuration endpoints (`/api/config`, `/api/settings`) used to feed data into the UI.
* **Development Flow:** Running Vite locally for UI-only changes (`pnpm dev` inside `/web`) and hot-reloading against a running daemon.
* **Build Targets:** Compiling Vite static files into `web/dist/` for consumption by the router-daemon and Tauri app bundler.

#### 🖥️ Desktop Sub-Project (`/desktop/README.md`)
The `desktop` directory contains the Tauri wrapper config. Its README must document:
* **Tauri v2 Shell:** Explain Tauri's role as a lightweight native tray app container.
* **Sidecar Engine:** Detail how the modularized Node.js `router-daemon.js` is built via Bun Compile and packaged as a Tauri sidecar executable.
* **Development Commands:** Launching the desktop app in dev mode (`pnpm tauri dev` or equivalent) with the JS engine sidecar running.
* **Installer Building:** Specific instructions for generating release builds (`.dmg`, `.msi`, `.AppImage`) and handling platform signing keys.

---

### Key Differences from Original PRD

| Original PRD | New Architecture |
|-------------|------------------|
| `proxy.rs` — Rust HTTP proxy server | ❌ Removed — `router-daemon.js` does this already |
| `bouncer.rs` — Rust ping/scoring engine | ❌ Removed — `utils.js` + `ping.js` do this already |
| Rust reads/embeds `sources.js` | ❌ Unnecessary — Node.js sidecar imports it natively |
| Desktop-specific React UI in `desktop/src/` | Minimal overrides only — 95% of UI is `web/src/` |
| Port 4096 | Port 19280 — consistent across CLI, Docker, Desktop |

### Sidecar Build Pipeline

The sidecar is compiled into a standalone binary before Tauri packaging using one of the following paths:

#### Option A: Bun Compile (Primary)
* **Compile** — `bun build --compile src/router-daemon.js --outfile binaries/fcm-engine`
* **Why** — Bun compiles the entire dependency tree and its JS runtime into a single, highly compressed native binary. It has extremely fast cold starts and robust cross-platform support.

#### Option B: Node.js SEA / pkg (Secondary)
1. **Bundle** — `esbuild` bundles `src/router-daemon.js` + all `src/` and `sources.js` dependencies into a single self-contained `.js` file.
2. **Compile** — Node.js SEA (`node --experimental-sea-config`) or `pkg` compiles the bundle into a native binary (`fcm-engine-darwin-arm64`, `fcm-engine-win-x64.exe`, etc.).

#### Common Packaging & Runtime:
* **Embed** — Tauri's `externalBin` configuration embeds the compiled binary as a sidecar.
* **Runtime** — On app launch, Tauri spawns the sidecar which starts the router daemon on `:19280`.

```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": ["binaries/fcm-engine"]
  }
}
```

---

## 6. Shared Code Inventory

### Modules shared 1:1 between CLI, Docker, and Desktop (~220 KB)

| Module | Size | What it does |
|--------|------|-------------|
| `sources.js` | 29 KB | Provider & model catalog — the single source of truth |
| `src/core/utils.js` | 39 KB | Scoring, sorting, filtering, verdict engine — pure functions |
| `src/core/ping.js` | 11 KB | HTTP ping infrastructure — provider-specific request building |
| `src/core/config.js` | 42 KB | Config management — `~/.free-coding-models.json` |
| `src/core/router-daemon.js` | 92 KB | Router proxy, failover, circuit breaker, web API, SSE |
| `src/core/constants.js` | 7 KB | Timeouts, limits, defaults |
| `src/core/benchmark.js` | 11 KB | AI speed test engine |
| `src/core/telemetry.js` | 16 KB | Anonymous usage telemetry |
| `src/core/ping-loop.js` | 4 KB | Adaptive ping cadence loop |
| `src/core/provider-quota-fetchers.js` | 12 KB | Per-provider quota fetching |
| `src/core/quota-capabilities.js` | 5 KB | Quota support detection |
| `src/core/security.js` | 7 KB | Config validation, security checks |
| `src/core/analysis.js` | 9 KB | Result analysis helpers |
| `src/core/provider-metadata.js` | 12 KB | Provider env vars, URLs |
| `src/core/cache.js` | 5 KB | TTL cache utility |
| `src/core/favorites.js` | 6 KB | Favorites management |
| `src/core/model-merger.js` | 2 KB | Dynamic model merging |
| `src/core/sync-set.js` | 16 KB | Router set auto-discovery |

### Modules that stay CLI-only (~340 KB)

| Module | Size | Why CLI-only |
|--------|------|-------------|
| `src/tui/key-handler.js` | 144 KB | Terminal stdin keypress handling |
| `src/tui/overlays.js` | 83 KB | TUI modals (chalk + ANSI) |
| `src/tui/render-table.js` | 53 KB | ANSI table rendering |
| `src/tui/command-palette.js` | 19 KB | TUI command palette |
| `src/tui/render-helpers.js` | 13 KB | chalk formatting helpers |
| `src/tui/theme.js` | 12 KB | ANSI terminal themes |
| `src/tui/tui-state.js` | 10 KB | TUI state machine |
| `src/tui/mouse.js` | 7 KB | Terminal mouse event parsing |
| `src/tui/tui-filters.js` | 6 KB | TUI filter cycling |
| `src/tui/tier-colors.js` | 2 KB | chalk color mappings |
*(Key-handler, Overlays, Table rendering, TUI state, theme, mouse, etc. under src/tui/)*

---

## 7. Performance Criteria & QA Verification

* **Memory Consumption:** Sidecar + Tauri shell combined must stay under **80 MB** RAM at idle.
* **Routing Latency (Overhead):** The Node.js proxy must not add more than **5 ms** of latency compared to a direct request.
* **Resilience:** If the primary provider fails, the app must reroute to the secondary in under **3.5 seconds**.
* **Startup Time:** From app launch to router listening on `:19280` — under **3 seconds**.
* **Parity:** Stability scores and verdicts must be **byte-identical** to those produced by `free-coding-models --daemon` in the CLI.

---

## 8. Development Phases

### Phase 1 — Shared Core Formalization (Pre-Desktop)

Before touching Desktop code, formalize the shared core:

1. Create `core/index.js` barrel export that re-exports all shared modules.
2. Verify `web/src/` React app works standalone with the daemon API.
3. Add integration tests: start daemon → hit API → verify React app renders.

### Phase 1.5 — Modularization of `router-daemon.js` (Decoupling)

To avoid a giant 92 KB "God Object" file that handles everything, we split `router-daemon.js` into clean, testable sub-modules under `src/daemon/`:

1. **`src/daemon/proxy.js`**: Pure HTTP proxy engine handling request interception, the failover mechanism, and stream piping.
2. **`src/daemon/server.js`**: Fastify/Express/HTTP server defining the `/api/*` endpoints and static file serving for `web/dist/`.
3. **`src/daemon/sse.js`**: Server-Sent Events broadcaster logic for push notifications and live ping/health updates.
4. **`src/daemon/token-tracker.js`**: Handles token estimation, consumption tracking, and provider quotas.
5. **`src/daemon/circuit-breaker.js`**: Tracks provider health states and manages temporary/permanent circuit-breaking of unresponsive backends.
6. **Verification**: Rewrite/adapt the unit and integration tests to ensure CLI daemon mode is unaffected. Keep `src/router-daemon.js` as a thin entry point wrapper.

### Phase 2 — Tauri Shell + Sidecar

2. Build Node.js sidecar from `router-daemon.js` entry point
3. Configure `tauri.conf.json` with `externalBin` sidecar
4. Webview loads `web/dist/` — verify dashboard renders
5. Add tray icon, minimize-to-tray, click-to-open behavior

### Phase 3 — Desktop-Specific Features

1. Auto-start on login (Tauri autostart plugin)
2. OS notifications on model failures / failover events
3. Global hotkey to toggle popover
4. Desktop-specific settings panel (autostart toggle, notification preferences)
5. Native installer builds (`.dmg` for macOS, `.msi` for Windows, `.AppImage` for Linux)

### Phase 4 — Polish & Release

1. Auto-update mechanism (Tauri updater plugin)
2. Code signing for macOS and Windows
3. Performance profiling and optimization
4. Beta testing with community
5. Public release