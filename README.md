<p align="center">
  <img src="logo.webp" alt="free-coding-models logo" width="328">
</p>

<h1 align="center">free-coding-models</h1>

<p align="center">
  <strong>Find the fastest free coding model in seconds</strong><br>
  Track ~191 models across 20 trusted free or free-limited AI providers in real time<br><br>
  <strong>Install Free API endpoints to your favorite AI coding tools:</strong><br>
  OpenCode CLI / Desktop / WebUI, OpenClaw, Crush, Goose, Aider, Kilo CLI, Qwen Code, OpenHands, Amp, Hermes, Continue, Cline, Xcode, Pi, ZCode and more...<br><br>
  <strong>Use Kimi K2, DeepSeek V3, GPT-OSS, Qwen3, MiniMax M3, GLM, Llama 4, Gemma 4, Devstral and more — for free</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/free-coding-models?color=3d6b00&label=npm&logo=npm" alt="npm version" width="200"><br>
  <img src="https://img.shields.io/node/v/free-coding-models?color=3d6b00&logo=node.js" alt="node version" width="200"><br>
  <img src="https://img.shields.io/npm/l/free-coding-models?color=3d6b00" alt="license" width="200"><br>
  <img src="https://img.shields.io/badge/models-191-3d6b00?logo=nvidia" alt="models count" width="200"><br>
  <img src="https://img.shields.io/badge/providers-20-1a56db" alt="providers count" width="200">
</p>

```bash
npm install -g free-coding-models
free-coding-models
```

<p align="center">
  create a free account on one of the <a href="#-list-of-free-ai-providers">providers</a>
</p>

<p align="center">
  <a href="#-why-this-tool">💡 Why</a> •
  <a href="#-quick-start">⚡ Quick Start</a> •
  <a href="#-list-of-free-ai-providers">🟢 Providers</a> •
  <a href="#-usage">🚀 Usage</a> •
  <a href="#-tui-keys">⌨️ TUI Keys</a> •
  <a href="#-features">✨ Features</a> •
  <a href="#-contributing">📋 Contributing</a> •
  <a href="#️-model-licensing--commercial-use">⚖️ Licensing</a> •
  <a href="#-telemetry">📊 Telemetry</a> •
  <a href="#️-security--trust">🛡️ Security</a> •
  <a href="#-other-free-ai-resources">🆓 Other Free AI Resources</a>
</p>

<p align="center">
  <img src="demo.gif" alt="free-coding-models demo" width="100%">
</p>

<p align="center">
  <a href="https://discord.gg/ZTNFHvvCkU"><img src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Join our Discord"></a>
</p>

<p align="center">
  <sub>Made with ❤️ and ☕ by <a href="https://vanessadepraute.dev">Vanessa Depraute</a> (aka <a href="https://vavanessa.dev">Vava-Nessa</a>)</sub>
</p>

---

## 💡 Why this tool?

There are **~191 cataloged free or free-limited coding models** across 20 vetted providers. Which one is fastest right now? Which one is actually stable versus just lucky on the last ping?

This CLI pings them all in parallel, shows live latency, and calculates a **live Stability Score (0-100)**. Average latency alone is misleading if a model randomly spikes to 6 seconds; the stability score measures true reliability by combining **p95 latency** (30%), **jitter/variance** (30%), **spike rate** (20%), and **uptime** (20%). 

It then writes the model you pick directly into your coding tool's config — so you go from "which model?" to "coding" in under 10 seconds.

---

## ⚡ Quick Start

### 🟢 List of Free AI Providers

Create a free account on one provider below to get started. A few providers (`Kilo`, `LLM7`, OVHcloud sandbox) can also answer without a key, with tighter shared limits.

**~191 coding models** across 20 active providers, ranked by practical free-tier usefulness.

| # | Provider | Models | Tier range | Free tier | Env var |
|---|----------|--------|-----------|-----------|--------|
| 1 | [NVIDIA NIM](https://build.nvidia.com) | 27 | S+ → C | ~40 RPM (no credit card) | `NVIDIA_API_KEY` |
| 2 | [Groq](https://console.groq.com/keys) | 8 | S → B | 30 RPM, 1K‑14.4K req/day (no credit card) | `GROQ_API_KEY` |
| 3 | [Cerebras](https://cloud.cerebras.ai) | 2 | S+ → S | 30 RPM, 1M tokens/day (no credit card) | `CEREBRAS_API_KEY` |
| 4 | [Google AI Studio](https://aistudio.google.com/apikey) | 7 | S+ → A | Gemini free quotas vary by model/region | `GOOGLE_API_KEY` |
| 5 | [GitHub Models](https://models.github.ai) | 15 | S+ → C | Quota depends on GitHub/Copilot tier | `GITHUB_TOKEN` |
| 6 | [Mistral La Plateforme](https://console.mistral.ai/api-keys) | 5 | S+ → A | Experiment plan, free evaluation tier | `MISTRAL_API_KEY` |
| 7 | [Cloudflare Workers AI](https://dash.cloudflare.com) | 16 | S+ → B | 10K neurons/day, 300 RPM (no credit card) | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| 8 | [OpenRouter](https://openrouter.ai/keys) | 24 | S+ → C | 50 req/day free, 1K/day with $10 spend | `OPENROUTER_API_KEY` |
| 9 | [SambaNova](https://cloud.sambanova.ai/apis) | 7 | S+ → B+ | Small developer quota, useful for light usage | `SAMBANOVA_API_KEY` |
| 10 | [OVHcloud AI Endpoints](https://endpoints.ai.cloud.ovh.net) | 10 | S → B | 2 req/min/IP free, 400 RPM with key | `OVH_AI_ENDPOINTS_ACCESS_TOKEN` |
| 11 | [Codestral](https://console.mistral.ai/api-keys) | 1 | B+ | 30 RPM, 2K req/day | `MISTRAL_API_KEY` |
| 12 | [ZAI](https://z.ai) | 2 | S | Free Flash models only | `ZAI_API_KEY` |
| 13 | [Scaleway](https://console.scaleway.com/iam/api-keys) | 10 | S+ → B | 1M free tokens | `SCALEWAY_API_KEY` |
| 14 | [Alibaba DashScope](https://modelstudio.console.alibabacloud.com) | 11 | S+ → A+ | 1M free tokens/model, Singapore, 90 days | `DASHSCOPE_API_KEY` |
| 15 | [OpenCode Zen](https://opencode.ai/zen) | 5 | S+ → A | Free with OpenCode account | Zen models ✨ |
| 16 | [Kilo](https://kilo.ai) | 1 | A+ | Free auto-router works without a key | optional `KILO_API_KEY` |
| 17 | [LLM7](https://llm7.io) | 4 | S+ → B+ | Shared free tier, optional free token | optional `LLM7_API_KEY` |
| 18 | [Routeway](https://routeway.ai) | 15 | S+ → C | Explicit `:free` zero-price models | `ROUTEWAY_API_KEY` |
| 19 | [Novita AI](https://novita.ai) | 4 | S+ → S | Only zero-price live chat models included | `NOVITA_API_KEY` |
| 20 | [Ollama Cloud](https://ollama.com/pricing) | 17 | S+ → A | Free cloud usage with session/weekly limits | `OLLAMA_API_KEY` |

> 💡 One key is enough. Add more at any time with **`P`** inside the TUI.

> 🧹 Audit cleanup: `iFlow` was removed because it shut down on April 17, 2026. `Together AI`, `Perplexity API`, `DeepInfra`, `Replicate`, `Fireworks`, `Hyperbolic`, `Hugging Face`, `SiliconFlow`, `Chutes AI` were removed from the active free catalog because they are paid, trial-credit only, too tiny to be useful, unclear as a stable free API, or tool-specific rather than a generally usable free provider. `Rovo` and `Gemini CLI` were also wiped out as tool integrations (CLI-only, not generally usable free providers).

---

### Tier scale

| Tier | SWE-bench | Best for |
|------|-----------|----------|
| **S+** | ≥ 70% | Complex refactors, real-world GitHub issues |
| **S** | 60–70% | Most coding tasks, strong general use |
| **A+/A** | 40–60% | Solid alternatives, targeted programming |
| **A-/B+** | 30–40% | Smaller tasks, constrained infra |
| **B/C** | < 30% | Code completion, edge/minimal setups |

**① Install and run:**

```bash
npm install -g free-coding-models
free-coding-models
```

On first run, you'll be prompted to enter your API key(s). You can skip providers and add more later with **`P`**.

Use ⚡️ Command Palette! with **Ctrl+P**.

<p align="center">
  <img src="https://img.shields.io/badge/USE_%E2%9A%A1%EF%B8%8F%20COMMAND%20PALETTE-CTRL%2BP-22c55e?style=for-the-badge" alt="Use ⚡️ Command Palette with Ctrl+P">
</p>

---

## 🐳 Docker

Run FCM without installing Node.js using the official Docker image:

> **Note:** GHCR requires authentication even for public images. Login once with:
> ```bash
> echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
> ```
> Or use a [personal access token](https://github.com/settings/tokens) with `read:packages` scope.

```bash
# Quick start (daemon + web UI on port 19280)
docker run -p 19280:19280 ghcr.io/vava-nessa/free-coding-models:latest

# With an API key
docker run -p 19280:19280 -e OPENROUTER_API_KEY=your_key ghcr.io/vava-nessa/free-coding-models:latest
```

Access the daemon web dashboard at `http://localhost:19280/` and configure your coding tool to use `http://localhost:19280/v1` with model `fcm`.

For the full TUI-style catalog dashboard from an npm install, run:

```bash
free-coding-models web
```

This starts the realtime Web Dashboard locally, opens it in your browser, and uses `http://localhost:3333/` by default. Override the port with `FCM_WEB_PORT=3334 free-coding-models web`.

#### Web Dashboard features (M4 parity with TUI)

The local Web Dashboard is a real-time control center for the model catalog
— not just a static table. The header holds every navigation entry, the
model table uses **100% of the viewport width** (no left rail, no right rail),
and every TUI capability that's safe to port ships behind a button or chip.

| Area | What's there |
|---|---|
| **Header** | Logo + version · primary nav (Dashboard, Settings, Analytics, Recommend, Router) · kebab menu (Help, Changelog, Install Endpoints, Installed Models) · endpoint target picker · `⌘K` command palette · AI Latency · theme · export |
| **Model table** | Full-bleed (no left/right border, no margin) under the sticky header + filter bar · 17 columns, resizable widths persisted in localStorage, ⭐ star per row, 🔌 install-endpoint button per row, medal borders for top-3, dark-red row class for tool-incompatible models, click AI Lat. cell to run a per-row benchmark · table header row stays sticky while scrolling |
| **Filter bar** | Sticky right below the header (always visible) · Tier / Status / Verdict / Health chip rows · Visibility dropdown (Normal / Configured only / Usable only) · Provider select · custom text filter chip with `X` clear · Reset button (TUI `N`) · ping mode (Speed / Normal / Slow / Forced) · "next ping in Xs" countdown (TUI style, always shown) |
| **Stats bar** | Removed in M1 (users found it noisy; the table + chips carry the same info at a glance) |
| **Detail panel** | Slide-in from the right on row click · endpoint target indicator + install-endpoint button · per-row benchmark button (TUI `Ctrl+A`) · favorite toggle (TUI `F`) + up/down reorder (TUI `Shift+↑↓`) · latency trend chart · all stats |
| **Command palette** | `⌘K` / `Ctrl+P` (the only global keyboard shortcut) · fuzzy search across views, theme, ping mode, reset, export, **and the full TUI command registry** (every filter / sort / tool / page entry from `src/tui/command-palette.js`) |
| **Keyboard** | `Esc` closes any modal · `Cmd+K` toggles the palette — that's it. Everything else is mouse-first. |
| **URL deep-linking** | `?tier=S+&sort=verdict&origin=groq&toolMode=goose&q=…` hydrates the dashboard on load **and** every filter / sort / view / endpoint target change is reflected back in the URL (debounced 80ms, `history.replaceState`). CLI flags become shareable links. |
| **Favorites** | Shared with the TUI through `~/.free-coding-models.json` — a star in the Web is a star in the TUI. Includes pinned+sticky display mode (TUI `Y`). |
| **Help modal** | Header overflow menu → "Help" opens a full-screen modal with all the TUI's keyboard shortcuts, filter behavior, and parity notes. Live search bar. |
| **Changelog modal** | Header overflow menu → "Changelog" or Settings "Open Changelog" link. Two-phase (index of versions + per-version release notes). Deep-linkable to a specific version. |
| **Update flow** | Header `⬆ vX.Y.Z` chip + popover with "Update now" + "What's new" (jumps to the new version's changelog entry). Polls every 5 min. |
| **Settings parity** | Full Settings page: theme (auto/dark/light), favorites pinned mode, startup AI Speed Scan, shell env export, legacy proxy cleanup, per-provider **Test** key button (TUI `T` key), update row. All settings persisted to the same `~/.free-coding-models.json` the TUI uses. |
| **Theme** | Tri-state `auto / dark / light` cycle (TUI `G`) — auto follows the OS preference. |
| **Smart Recommend** | Header "Recommend" opens the 3-question wizard, runs the 10s analysis phase, then returns the Top 3 shared-score recommendations with Pin + install-endpoint actions. |
| **Endpoint installs** | The Web never starts external tools. It writes the selected provider/model endpoint into the chosen tool config (`/api/install-endpoint`), then users start their tool themselves. |
| **Router Dashboard** | Header "Router" opens a full modal with daemon start/stop, model health table with circuit breaker badges, request log, probe mode selector, quick-setup card (copy base URL + model to clipboard), **"Probe all" AI Latency/TPS benchmarking**, and a **"Test Router" mini playground** to live-route chats through the fallback chain. |
| **Token Usage** | Integrated inside Analytics: today + all-time summary cards, 7-day usage bar chart, top models and top providers breakdown. |
| **Installed Models** | Header overflow → "Installed Models" opens a modal that scans all tool configs (Goose, Crush, Aider, Kilo, Qwen, Pi, OpenHands, Amp) and shows configured models with soft-delete (backup saved). |
| **Install Endpoints wizard** | Header overflow → "Install Endpoints" opens a 4-step wizard: pick provider → pick tool → select models → install. Writes managed provider catalogs into tool configs using the same engine as the TUI. |

Roadmap items:
- **M5** — Polish, accessibility, mobile hamburger nav, Lighthouse a11y ≥ 95.

### Available Image Tags

| Tag | Description |
|-----|-------------|
| `latest` | Most recent release |
| `v{major}.{minor}.{patch}` | Specific version (e.g., `v0.3.70`) |
| `v{major}.{minor}` | Minor version (e.g., `v0.3`) |
| `v{major}` | Major version (e.g., `v0`) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FCM_HOST` | `0.0.0.0` | Host to bind to (set `127.0.0.1` for localhost-only) |
| `FCM_PORT` | `19280` | Port to listen on |
| `FREE_CODING_MODELS_TELEMETRY` | `0` | Disable telemetry |

Provider API keys (all optional):

```bash
docker run -p 19280:19280 \
  -e NVIDIA_API_KEY=your_key \
  -e GROQ_API_KEY=your_key \
  -e OPENROUTER_API_KEY=your_key \
  ghcr.io/vava-nessa/free-coding-models:latest
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  fcm:
    image: ghcr.io/vava-nessa/free-coding-models:latest
    container_name: fcm
    restart: unless-stopped
    ports:
      - "19280:19280"
    environment:
      FREE_CODING_MODELS_TELEMETRY: "0"
      FCM_HOST: "0.0.0.0"
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
    volumes:
      - fcm-data:/home/fcm
volumes:
  fcm-data:
```

Run with `docker-compose up -d`. API keys can be passed via a `.env` file or environment variables.

### Troubleshooting

**Container won't start:**
- Check logs: `docker logs fcm`
- Verify port 19280 is not in use: `docker ps | grep 19280`

**Health check fails:**
- Wait 30s for initial probe cycle
- Verify API keys are valid: `docker exec fcm curl http://localhost:19280/health`

**Cannot connect from host:**
- Ensure `FCM_HOST=0.0.0.0` (default)
- Check firewall allows localhost connections

**Data persistence:**
- Config is stored in Docker volume `fcm-data`
- Recreate the volume with `docker-compose down -v` to reset

---

Need to fix contrast because your terminal theme is fighting the TUI? Press **`G`** at any time to cycle **Auto → Dark → Light**. The switch recolors the full interface live: table, Settings, Help, Smart Recommend, Feedback, and Changelog.

**② Pick a model and launch your tool:**

```
↑↓ navigate   →   Enter to launch
```

The model you select is automatically written into your tool's config (📦 OpenCode, 🦞 OpenClaw, 💘 Crush, etc.) and the tool opens immediately. Done.

If the active CLI tool is missing, FCM now catches it before launch, offers a tiny Yes/No install prompt, installs the tool with its official global command, then resumes the same model launch automatically.

> 💡 You can also run `free-coding-models --goose --tier S` to pre-filter to S-tier models for Goose before the TUI even opens.

<p align="center">
  <img src="demo2.gif" alt="free-coding-models TUI demo" width="100%">
</p>

## 🚀 Usage

### Common scenarios

```bash
# "I want the local web dashboard"
free-coding-models --daemon

# "I want one local endpoint that fails over between free models"
free-coding-models --daemon-bg
free-coding-models --daemon-status

# "Start with an elite-focused preset, then adjust filters live"
free-coding-models --premium

# "I want to script this — give me JSON"
free-coding-models --tier S --json | jq -r '.[0].modelId'

# "I want to configure OpenClaw with Groq's fastest model"
free-coding-models --openclaw --origin groq
```

When launching the daemon (with `--daemon`), the web dashboard and router API are served from the same port. Configure tools with:

| Field | Value |
|-------|-------|
| Router Base URL | `http://localhost:19280/v1` |
| Dashboard URL | `http://localhost:19280/` |
| Model | `fcm` |
| API key | `fcm-local` |

### Smart Model Router

The **FCM Router** is a local OpenAI-compatible daemon that keeps running after the TUI closes. Point your coding tool at one localhost endpoint and let FCM route each request to the best available model in your active set.

```bash
# Start the router in the background
free-coding-models --daemon-bg

# Check the active port, set, model count, uptime, and request totals
free-coding-models --daemon-status

# Stop it cleanly
free-coding-models --daemon-stop

# Auto-discover and live-probe models into a named set
free-coding-models --sync-set
free-coding-models --sync-set my-coding-set
```

Configure tools with:

| Field | Value |
|-------|-------|
| Base URL | `http://localhost:19280/v1` |
| Model | `fcm` |
| API key | `fcm-local` |

The daemon auto-creates a `fast-coding` set from your configured providers on first start. It stores router settings in `~/.free-coding-models.json`, writes lifecycle logs to `~/.free-coding-models-daemon.log`, and tracks token metadata in `~/.free-coding-models-tokens.json`.

### Playground — chat with the router

Every chat that goes through the FCM router starts with a configurable **pre-prompt** that introduces the assistant as the free-coding-models routing agent. The Playground is the fastest way to try the router without configuring a coding tool.

```bash
# 1. Start the router (if it isn't already)
free-coding-models --daemon-bg

# 2. Open the Playground in the TUI
free-coding-models --playground
# ... or just press ; inside the TUI
# ... or click "Playground" in the web dashboard header
```

The Playground:

- Streams responses token-by-token (SSE).
- Shows the routed-via provider/model + latency + tokens on every reply.
- Lets you pin a specific model (`fcm` = auto-router, or `groq/<id>` / `cerebras/<id>` / etc.) for manual A/B testing.
- Lets you toggle the pre-prompt per session, so you can see what the model answers *with* and *without* the FCM persona.

The pre-prompt lives in the router config under `router.prePrompt` and can be edited from any surface (the daemon reloads it on its 10s config-refresh tick):

```json
{
  "router": {
    "prePrompt": {
      "enabled": true,
      "text": "You are free-coding-models, the free coding-model routing agent..."
    }
  }
}
```

Router endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/chat/completions` | Route through the active set |
| `POST /v1/sets/:name/chat/completions` | Route through a named set |
| `GET /v1/models` | Return virtual models (`fcm`, `fcm:set-name`) |
| `GET /health` | Daemon status JSON |
| `GET /stats` | Routing, health, request log, and token stats |
| `GET /stream/events` | Live SSE events for router updates |
| `POST /daemon/probe-mode` | Set probe mode with `{ "probeMode": "eco" | "balanced" | "aggressive" }` |

**Web Dashboard endpoints** (served from the same port in `--daemon` mode):

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Web dashboard HTML |
| `GET /api/models` | All model data with latency stats |
| `GET /api/config` | Provider config (keys masked) |
| `GET /api/events` | Live SSE events for dashboard |
| `GET /api/key/:provider` | Reveal full API key for provider |
| `POST /api/settings` | Save API keys and provider toggles |

Routing behavior:

- Priority order works immediately on cold start, then probes refine health scores over time.
- Transient failures (`429`, `500`, `502`, `503`, timeouts) fail over to the next model.
- Authentication problems (`401`, `403`, missing keys) are marked separately so bad credentials do not poison the circuit breaker; after one provider returns an auth error, the router skips the rest of that provider for the current request.
- Upstream HTML maintenance pages and malformed successful JSON are treated as retryable provider failures instead of being forwarded to your coding tool.
- Quota and rate-limit failures include retry headers in the final router `503` payload when providers expose them.
- If a coding tool disconnects mid-request, the daemon aborts the upstream request without counting it as a provider failure.
- Streaming requests retry before the first byte; after partial output starts, the daemon records the failure and lets the current stream finish as safely as possible.

### Tool launcher flags

| Flag | Launches |
|------|----------|
| `--opencode` | 📦 OpenCode CLI |
| `--opencode-desktop` | 📦 OpenCode Desktop |
| `--opencode-web` | 📦 OpenCode WebUI |
| `--openclaw` | 🦞 OpenClaw |
| `--crush` | 💘 Crush |
| `--goose` | 🪿 Goose |
| `--aider` | 🛠 Aider |
| `--kilo` | ⚡️ Kilo CLI |
| `--qwen` | 🐉 Qwen Code |
| `--openhands` | 🤲 OpenHands |
| `--amp` | ⚡ Amp |
| `--hermes` | 🔮 Hermes |
| `--continue` | ▶️ Continue CLI |
| `--cline` | 🧠 Cline |
| `--xcode` | 🛠️ Xcode Intelligence |
| `--pi` | π Pi |
| `--copilot` | 🤖 Copilot CLI |
| `--forgecode` | 🔥 ForgeCode |
| `--zcode` | 🧊 ZCode |

Press **`Z`** in the TUI to cycle between tools without restarting.

### CLI-Only Tools

**Note:** When launching these tools via `Z` key or command palette, if the current mode doesn't match the tool, you'll see a confirmation alert asking to switch to the correct tool before launching.

### OpenCode Zen Free Models

[OpenCode Zen](https://opencode.ai/zen) is a hosted AI gateway offering **5 free coding models** exclusively through OpenCode CLI and OpenCode Desktop. These models are **not** available through other tools.

| Model | Tier | SWE-bench | Context |
|-------|------|-----------|---------|
| Big Pickle | S+ | 72.0% | 200k |
| DeepSeek V4 Flash Free | S+ | 79.0% | 200k |
| MiMo-V2.5 Free | S+ | - | 200k |
| Nemotron 3 Super Free | A+ | 52.0% | 200k |
| MiniMax M3 Free | S+ | 59.0% | 1M |

To use Zen models: sign up at [opencode.ai/auth](https://opencode.ai/auth) and enter your Zen API key via `P` (Settings). Zen models appear in the main table and auto-switch to OpenCode CLI on launch.

### Tool Compatibility

When a tool mode is active (via `Z`), models incompatible with that tool are highlighted with a dark red background so you can instantly see which models work with your current tool.

| Model Type | Compatible Tools |
|------------|-----------------|
| Regular (NVIDIA, Groq, etc.) | All tools |
| OpenCode Zen | All tools (OpenAI-compatible endpoint) |

→ **[Full flags reference](./docs/flags.md)**

---

## π Pi Extension — FCM-Pi ⚠️ BETA

**FCM-Pi** is a native [Pi coding agent](https://pi.dev) extension that integrates `free-coding-models` directly into your Pi session. It stays silent by default, scans only when you run `/fcm`, and lets you explicitly hot-swap models mid-session.

> **BETA** — The extension is under active development and not yet published to npm. Install via local path only.
>
> **Requires**: Pi coding agent (pi.dev) + free-coding-models installed and configured with at least one API key.

### Installation

Add the extension path to `~/.pi/agent/settings.json` (the extension is **not yet on npm** — local path only for now):

```json
{
  "packages": [
    "/Users/yourname/Documents/GitHub/free-coding-models/pi-extension"
  ]
}
```

Then restart Pi. The extension loads automatically.

### What it does

| Feature | Description |
|---------|-------------|
| **Silent startup** | No scan, no footer noise, and no automatic model switch on Pi boot or `/resume` |
| **Manual scan** | `/fcm` pings ~30 candidate models in parallel and waits for your explicit selection |
| **Temporary progress scan** | The Pi status bar shows live scan progress only while probing/benchmarking, then hides again |
| **10-minute disk cache** | Results are cached to `~/.pi/agent/fcm-cache.json` for faster diagnostics and lists |
| **Error-triggered picker** | If a request fails (HTTP 4xx/5xx), FCM reopens the picker and marks the failed model `🔴 BUGGED` |
| **Daemon integration** | If the FCM router daemon is running (`free-coding-models --daemon-bg`), scan results are fetched instantly from its cache |

### Scan progress display

During `/fcm`, the Pi footer status shows:

```
⠸ Probing: Kimi K2.6 [Nvidia], Step 3.5 Flash [Stepfun] — 47% (14/30)
⠼ Benchmarking: GLM 4.7 [Cerebras] — 60% (3/5)
```

- **Spinner** — 10-frame Braille animation at 80ms
- **Phase label** — `Probing` (ping phase) or `Benchmarking` (AI latency phase)
- **Live model name + provider** — shows the last 2 models being probed, scrolling as results come in
- **Progress %** and counter always visible

### Commands

| Command | Description |
|---------|-------------|
| `/fcm` | Re-scan and pick a model interactively from the top 10 ranked |
| `/fcm-list` | Display a ranked table of top 20 available models (SWE / Latency / TPS / Provider) |
| `/fcm-router` | Explicitly connect Pi to the local FCM Smart Router daemon |
| `/fcm-status` | Show diagnostics: active model, last scan source, daemon state |

### Composite ranking

Models are ranked using a composite score:

| Weight | Metric | Description |
|--------|--------|-------------|
| **60%** | SWE-bench score | Coding capability |
| **20%** | Latency | Network round-trip response time |
| **10%** | TPS | Token throughput speed |
| **10%** | Stability | Uptime + success rate |

### Context window limits

Cerebras free-tier API has a strict **~8k total token limit** (prompt + tools + completion). Tiny-context models can pass a `hi` probe but fail real agent prompts, so FCM hides 8k Cerebras models from Pi/OpenCode pickers.

### Full documentation

The adapter lives in [`packages/fcm-pi`](./packages/fcm-pi); `pi-extension/` is kept as a thin compat wrapper so existing local-path installs keep loading. See [`packages/fcm-pi/README.md`](./packages/fcm-pi/README.md) for the complete architecture, config format, and the one-time `packages/` self-link setup.

---

## OpenCode Plugin — fcm-opencode ⚠️ BETA

`fcm-opencode` is the OpenCode adapter for the same FCM scanner/ranker used by FCM-Pi.

### Local install

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf /Users/vava/Documents/GitHub/free-coding-models/packages/fcm-opencode/index.js \
  ~/.config/opencode/plugins/fcm-opencode.js
```

(`opencode-plugin/` at the repo root is kept as a thin compat wrapper, so existing symlinks keep working.)

### Commands

| Command | Description |
|---------|-------------|
| `/fcm` | Run an explicit scan and list ranked choices without switching |
| `/fcm 1` | Switch OpenCode config to ranked model #1 |
| `/fcm best` | Switch OpenCode config to the best ranked model |
| `/fcm rescan` | Force a fresh scan |
| `/fcm status` or `/fcm-status` | Show plugin diagnostics |
| `/fcm router` or `/fcm-router` | Switch OpenCode config to the local FCM Smart Router daemon |

Startup is intentionally light: fresh cache first, daemon second, **no direct scan** unless you run `/fcm`.

See [`packages/fcm-opencode/README.md`](./packages/fcm-opencode/README.md) for details and limitations.

---

## 🧩 Agent extensions architecture

Both adapters share one core so scan/rank/cache/daemon/API-key/provider logic lives in exactly one place:

```
packages/
├── fcm-agent-core/   ← shared core (scan, rank, cache, daemon, keys, provider descriptors; no rendering)
├── fcm-pi/           ← Pi adapter (hooks, commands, status-bar renderer, ~/.pi/agent disk writer)
└── fcm-opencode/     ← OpenCode adapter (config mutation, commands, toasts, shell.env)
```

- The core emits **structured progress events**; each adapter renders them its own way (Pi status bar, OpenCode toast).
- API keys are never inlined into OpenCode config — they are referenced via `{env:FCM_<PROVIDER>_API_KEY}`.
- The cross-tool cache means a scan done in Pi benefits OpenCode (and vice-versa).

> The `packages/` tree needs a one-time self-link so `free-coding-models` resolves by name during local-path use:
> ```bash
> cd packages && mkdir -p node_modules && ln -s ../../ node_modules/free-coding-models
> ```

See [`packages/fcm-agent-core/README.md`](./packages/fcm-agent-core/README.md) for the public API and rationale. Tracked in [`.kandown/tasks/t2.md`](./.kandown/tasks/t2.md).

---

## ⌨️ TUI Keys

### Keyboard

| Key | Action |
|-----|--------|
| `↑↓` | Navigate models |
| `Enter` | Launch selected model in active tool |
| `Z` | Cycle target tool |
| `T` | Cycle tier filter |
| `D` | Cycle provider filter |
| `E` | Cycle visibility filter (`Active only → Configured only → Usable only`) |
| `F` | Favorite / unfavorite model |
| `Y` | Toggle favorites mode (`Normal filter/sort` default ↔ `Pinned + always visible`) |
| `X` | Clear active custom text filter |
| `G` | Cycle global theme (`Auto → Dark → Light`) |
| `Ctrl+P` | Open ⚡️ command palette (search + run actions) |
| `;` | Open the Playground chat overlay (chat with the FCM router) |
| `Ctrl+A` | Run AI Speed Test for the selected model |
| `Ctrl+U` | Run Global AI Speed Test (uses real provider requests) |
| `R/S/C/M/O/L/A/H/V/B/U` | Sort columns |
| `Shift+U` | Update to latest version (when update available) |
| `P` | Settings (API keys, providers, updates, theme) |
| `Q` | Smart Recommend overlay |
| `N` | Changelog |
| `W` | Cycle ping cadence |
| `I` | Feedback / bug report |
| `K` | Help overlay |
| `Ctrl+C` | Exit |

### Mouse

| Action | Result |
|--------|--------|
| **Click column header** | Sort by that column |
| **Click Tier header** | Cycle tier filter |
| **Click CLI Tools header** | Cycle tool mode |
| **Click model row** | Move cursor to model |
| **Double-click model row** | Select and launch model |
| **Right-click model row** | Toggle favorite |
| **Scroll wheel** | Navigate table / overlays / palette |
| **Click footer hotkey** | Trigger that action |
| **Click update banner** | Install latest version and relaunch |
| **Click command palette item** | Select item (double-click to confirm) |
| **Click recommend option** | Select option (double-click to confirm) |
| **Click outside modal** | Close command palette |

→ **[Stability score & column reference](./docs/stability.md)**

---

## ✨ Features

- **Parallel pings** — all ~191 API/Zen-callable models tested simultaneously via native `fetch`
- **AI benchmark columns** — `Ctrl+A` benchmarks the selected model, `Ctrl+U` benchmarks visible models, and results split cleanly into **AI Latency** plus **TPS**. Settings includes an opt-in **Startup AI Speed Scan** toggle to run the global benchmark automatically after launch.
- **Tiny verdict indicator** — the first `❔` column mirrors the full Verdict as a compact emoji (`🟩`, `🟢`, `🟡`, `🟠`, etc.) and sorts by the same verdict order.
- **Adaptive monitoring** — 2s burst for 60s → 10s normal → 30s idle
- **Stability score** — composite 0–100 (p95 latency, jitter, spike rate, uptime)
- **Smart ranking** — top 3 highlighted 🥇🥈🥉
- **Favorites** — star models with `F`, persisted across sessions, default to normal rows, and switch display mode with `Y` (pinned+sticky vs normal rows)
- **Configured-only default** — only shows providers you have keys for
- **Keyless latency** — models ping even without an API key (show 🔑 NO KEY)
- **Unusable row fade** — rows in `NO KEY` or `AUTH FAIL` state are rendered at 80% opacity (20% less opaque) on every surface (TUI + Web + Desktop), so the user can scan the table and instantly see which models they cannot actually use. Composes cleanly with the favorite/recommended/incompatible background tints.
- **Smart Recommend** — questionnaire picks the best model for your task type
- **Smart Model Router** — local OpenAI-compatible daemon with model sets, failover, circuit breakers, health probes, and token stats
- **Playground chat** — multi-turn chat with the router on every surface (TUI `;` / Web Playground nav / `free-coding-models --playground`). Streams responses and shows the routed-via provider/model on every reply.
- **Auto-heal on startup** — the daemon replaces broken models in the active set (`AUTH_ERROR` / `STALE`) with working alternatives from the same provider first, then cross-provider. The first manual edit disables auto-heal so user choices are preserved. A new user with a half-broken key set lands on a usable default set by the time the dashboard renders.
- **Web router set manager** — add, remove, drag-and-drop, and probe-sync the active router set from inside the Web Dashboard. The "Sync best models" button re-pings every candidate with the user's actual API keys and rebuilds the set with only models that return 2xx, so a new user lands on a working default set instead of a hardcoded one that 401s.
- **Router pre-prompt** — a configurable first-class system message injected by the daemon on every `/v1/chat/completions` request it proxies. Default persona introduces the assistant as the FCM routing agent; editable from any surface.
- **⚡️ Command Palette** — `Ctrl+P` opens a searchable action launcher for filters, sorting, overlays, and quick toggles
- **Install Endpoints** — push a full provider catalog into any tool's config (from Settings `P` or ⚡️ Command Palette)
- **Missing tool bootstrap** — detect absent CLIs, offer one-click install, then continue the selected launch automatically
- **Tool compatibility matrix** — incompatible rows highlighted in dark red when a tool mode is active
- **OpenCode Zen models** — 8 free models exclusive to OpenCode CLI/Desktop, powered by the Zen AI gateway
- **Width guardrail** — shows a warning instead of a broken table in narrow terminals
- **Readable everywhere** — semantic theme palette keeps table rows, overlays, badges, and help screens legible in dark and light terminals
- **Global theme switch** — `G` cycles `auto`, `dark`, + `light` live without restarting
- **Auto-retry** — timeout models keep getting retried
- **Mandatory self-update policy** — startup checks npm for a newer FCM and installs it automatically without a prompt. If the install fails twice in a row (offline, proxy, or permissions), FCM still starts but shows a red outdated-version warning until the user retries with `Shift+U` or runs the displayed install command.
- **Last release timestamp** — light pink footer shows `Last release: Mar 27, 2026, 09:42 PM` from npm so users know how fresh the data is

---

## 📋 Contributing

We welcome contributions — issues, PRs, new provider integrations.

**Q:** How accurate are the latency numbers?  
**A:** Real round-trip times measured by your machine. Results depend on your network and provider load at that moment.

**Q:** Can I add a new provider?  
**A:** Yes — see [`sources.js`](./sources.js) for the model catalog format.

→ **[Development guide](./docs/development.md)** · **[Config reference](./docs/config.md)** · **[Tool integrations](./docs/integrations.md)**

---

## ⚖️ Model Licensing & Commercial Use

**Short answer:** The ~170 cataloged models are API/CLI-served models where generated-output ownership is generally granted by the provider/model terms. Always verify current provider terms for high-stakes commercial use.

### Output Ownership

For every model in this tool, **you own the generated output** — code, text, or otherwise — and can use it commercially. The licenses below govern the *model weights themselves*, not your generated content.

### License Breakdown by Model Family

| License | Models | Commercial Output |
|---------|--------|:-----------------:|
| **Apache 2.0** | Qwen3/Qwen3.5/Qwen2.5 Coder, GPT-OSS 120B/20B, Devstral 2, Gemma 4 | ✅ Unrestricted |
| **MIT / permissive model terms** | GLM Flash, MiniMax M2.x, Devstral 2 | ✅ Provider/model terms apply |
| **Modified MIT** | Kimi K2/K2.6 (>100M MAU → display "Kimi K2" branding) | ✅ With attribution at scale |
| **Llama Community License** | Llama 3.3 70B, Llama 4 Scout/Maverick | ✅ Attribution required. >700M MAU → separate Meta license |
| **DeepSeek License** | DeepSeek V3/V3.1/V3.2/V4 family | ✅ Use restrictions on model (no military, no harm) — output is yours |
| **NVIDIA Nemotron License** | Nemotron Super/Ultra/Nano | ✅ Updated Mar 2026, now near-Apache 2.0 permissive |
| **MiniMax Model License** | MiniMax M2, M2.5, M3 | ✅ Royalty-free, non-exclusive. Prohibited uses policy applies to model |
| **Proprietary / hosted API terms** | Gemini, GitHub Models, Mistral/Codestral, OpenRouter-hosted models | ✅ Provider ToS applies |
| **OpenCode Zen** | Big Pickle, GPT 5 Nano, MiniMax M3 Free, Nemotron 3 Super Free, HY3/Ling/Trinity previews | ✅ Per OpenCode Zen ToS |

### Key Points

1. **Generated code is yours** — no model claims ownership of your output
2. **Apache 2.0 / permissive model families** (Qwen, GLM Flash, GPT-OSS, Devstral, Gemma) are the lowest-friction options
3. **Llama** requires "Built with Llama" attribution; >700M MAU needs a Meta license
4. **DeepSeek / MiniMax** have use-restriction policies (no military use) that govern the model, not your generated code
5. **API-served models** (Gemini, GitHub Models, OpenRouter, Mistral, etc.) grant output ownership under their current terms of service

> ⚠️ **Disclaimer:** This is a summary, not legal advice. License terms can change. Always verify the current license on the model's official page before making legal decisions.

---

## 📊 Telemetry

`free-coding-models` collects anonymous usage telemetry to help understand how the CLI is used and improve the product. No personal information, API keys, prompts, source code, file paths, or secrets are ever collected.

The telemetry payload is limited to anonymous product analytics such as the app version, selected tool mode, operating system, terminal family, and a random anonymous install ID stored locally on your machine. When a model is launched, telemetry can also include the selected tool, provider, model ID, model label, model tier, launch result, and a few product actions such as installing provider catalogs, saving/removing API keys, or toggling shell environment export.

Telemetry is enabled by default and can be disabled with any of the following:

| Method | How |
|--------|-----|
| CLI flag | Run `free-coding-models --no-telemetry` |
| Environment variable | Set `FREE_CODING_MODELS_TELEMETRY=0` (also supports `false` or `off`) |

---

## 🛡️ Security & Trust

<p align="center">
  <img src="https://img.shields.io/badge/dependencies-1-76b900?logo=npm" alt="1 dependency">
  <img src="https://img.shields.io/badge/provenance-sigstore-blueviolet?logo=signstore" alt="npm provenance">
  <img src="https://img.shields.io/badge/supply_chain-verified-brightgreen" alt="supply chain verified">
</p>

### Supply Chain

| Signal | Status |
|--------|--------|
| **npm Provenance** | ✅ Published with Sigstore-signed provenance |
| **SBOM** | ✅ Software Bill of Materials attached to every GitHub Release |
| **Dependencies** | ✅ 1 runtime dependency (`chalk`) |
| **Lockfile** | ✅ `pnpm-lock.yaml` committed and tracked |
| **Security Policy** | ✅ [`SECURITY.md`](SECURITY.md) |
| **Code Owners** | ✅ [`CODEOWNERS`](CODEOWNERS) — all changes require maintainer review |
| **Dependabot** | ✅ Weekly automated dependency + GitHub Actions updates |
| **Audit CI** | ✅ `npm audit` runs on every push/PR + weekly scheduled scan |
| **License** | ✅ MIT |

### What This Tool Does

- Pings public API endpoints to measure latency and check availability
- Reads your API keys from `.env` files (only if you configure them)
- Opens configuration files for editing (with your permission)
- Reports anonymous usage data (no personal information — see footer)

### What This Tool Does NOT Do

- ❌ Does **not** send your API keys, code, or personal data to any third party
- ❌ Does **not** install or execute arbitrary code beyond `chalk` (the only dependency)
- ❌ Does **not** modify any files outside its own config directory
- ❌ Does **not** require `sudo`, root, or elevated permissions

> To report a vulnerability, see [`SECURITY.md`](SECURITY.md).

---

## Star History

<a href="https://www.star-history.com/?repos=vava-nessa%2Ffree-coding-models&type=timeline&logscale=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=vava-nessa/free-coding-models&type=timeline&theme=dark&logscale&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=vava-nessa/free-coding-models&type=timeline&logscale&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=vava-nessa/free-coding-models&type=timeline&logscale&legend=top-left" />
 </picture>
</a>



## Special thanks to contributors

<table align="center">
  <tr>
    <td align="center" width="120"><a href="https://github.com/vava-nessa"><img src="https://avatars.githubusercontent.com/u/5466264?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="vava-nessa"></a></td>
    <td align="center" width="120"><a href="https://github.com/erwinh22"><img src="https://avatars.githubusercontent.com/u/6641858?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="erwinh22"></a></td>
    <td align="center" width="120"><a href="https://github.com/whit3rabbit"><img src="https://avatars.githubusercontent.com/u/12357518?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="whit3rabbit"></a></td>
    <td align="center" width="120"><a href="https://github.com/skylaweber"><img src="https://avatars.githubusercontent.com/u/172871734?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="skylaweber"></a></td>
    <td align="center" width="120"><a href="https://github.com/PhucTruong-ctrl"><img src="https://github.com/PhucTruong-ctrl.png?s=80" width="80" height="80" style="border-radius:50%" alt="PhucTruong-ctrl"></a></td>
    <td align="center" width="120"><a href="https://github.com/chindris-mihai-alexandru"><img src="https://avatars.githubusercontent.com/u/12643176?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="chindris-mihai-alexandru"></a></td>
    <td align="center" width="120"><a href="https://github.com/serajbaltu"><img src="https://avatars.githubusercontent.com/u/90699173?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="serajbaltu"></a></td>
    <td align="center" width="120"><a href="https://github.com/stgreenb"><img src="https://avatars.githubusercontent.com/u/18483964?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="stgreenb"></a></td>
    <td align="center" width="120"><a href="https://github.com/MoriDanWork"><img src="https://avatars.githubusercontent.com/u/55363096?v=4&s=80" width="80" height="80" style="border-radius:50%" alt="MoriDanWork"></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/vava-nessa"><sub><b>vava-nessa</b></sub></a></td>
    <td align="center"><a href="https://github.com/erwinh22"><sub><b>erwinh22</b></sub></a></td>
    <td align="center"><a href="https://github.com/whit3rabbit"><sub><b>whit3rabbit</b></sub></a></td>
    <td align="center"><a href="https://github.com/skylaweber"><sub><b>skylaweber</b></sub></a></td>
    <td align="center"><a href="https://github.com/PhucTruong-ctrl"><sub><b>PhucTruong-ctrl</b></sub></a></td>
    <td align="center"><a href="https://github.com/chindris-mihai-alexandru"><sub><b>chindris-mihai-alexandru</b></sub></a></td>
    <td align="center"><a href="https://github.com/serajbaltu"><sub><b>serajbaltu</b></sub></a></td>
    <td align="center"><a href="https://github.com/stgreenb"><sub><b>stgreenb</b></sub></a></td>
    <td align="center"><a href="https://github.com/MoriDanWork"><sub><b>MoriDanWork</b></sub></a></td>
  </tr>
</table>

---

## 🆓 Other Free AI Resources

**Curated resources outside the active CLI catalog** — IDE extensions, coding agents, GitHub lists, and providers that are useful but not clean enough for the core free-provider table.

### 📚 Awesome Lists (curated by the community)

| Resource | What it is |
|----------|------------|
| [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) (18.4k ⭐) | Comprehensive list of free LLM API providers with rate limits |
| [mnfst/awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis) (2.1k ⭐) | Permanent free LLM API tiers organized by provider |
| [inmve/free-ai-coding](https://github.com/inmve/free-ai-coding) (648 ⭐) | Pro-grade AI coding tools side-by-side — limits, models, CC requirements |
| [amardeeplakshkar/awesome-free-llm-apis](https://github.com/amardeeplakshkar/awesome-free-llm-apis) | Additional free LLM API resources |

### 🖥️ AI-Powered IDEs with Free Tiers

| IDE | Free tier | Credit card |
|-----|-----------|-------------|
| [Qwen Code](https://github.com/QwenLM/qwen-code) | 2,000 requests/day | No |
| [Jules](https://jules.google/) | 15 tasks/day | No |
| [AWS Kiro](https://kiro.dev/) | 50 credits/month | No |
| [Trae](https://trae.ai/) | 10 fast + 50 slow requests/month | No |
| [Codeium](https://codeium.com/) | Unlimited forever, basic models | No |
| [JetBrains AI Assistant](https://www.jetbrains.com/ai/) | Unlimited completions + local models | No |
| [Continue.dev](https://www.continue.dev/) | Free VS Code/JetBrains extension, local models via Ollama | No |
| [Warp](https://warp.dev/) | 150 credits/month (first 2 months), then 75/month | No |
| [Amazon Q Developer](https://aws.amazon.com/q/developer/) | 50 agentic requests/month | Required |
| [Windsurf](https://windsurf.com/) | 25 prompt credits/month | Required |
| [Kilo Code](https://kilocode.ai/) | Up to $25 signup credits (one-time) | Required |
| [Tabnine](https://www.tabnine.com/) | Basic completions + chat (limited) | Required |
| [SuperMaven](https://supermaven.com/) | Basic suggestions, 1M token context | Required |

### 🔑 API Providers with Permanent Free Tiers

| Provider | Free limits | Notable models |
|----------|-------------|----------------|
| [OpenRouter](https://openrouter.ai/keys) | 50 req/day, 1K/day with $10 purchase | Qwen3-Coder, Tencent HY3, Laguna, Gemma 4 |
| [Google AI Studio](https://aistudio.google.com/apikey) | Varies by Gemini model and region | Gemini 3.1 Pro Preview, Gemini 2.5 Flash |
| [NVIDIA NIM](https://build.nvidia.com) | ~40 RPM | MiniMax M2.7, GLM 5.1, Kimi K2.6 |
| [GitHub Models](https://models.github.ai) | Depends on GitHub/Copilot tier | GPT-4.1, DeepSeek V3, Llama 4 |
| [Groq](https://console.groq.com/keys) | 1K–14.4K req/day (model-dependent) | Llama 3.3 70B, Llama 4 Scout, GPT-OSS |
| [Cerebras](https://cloud.cerebras.ai/) | 30 RPM, 1M tokens/day | Qwen3-235B, Llama 3.1 70B, GPT-OSS 120B |
| [Cohere](https://cohere.com/) | 20 RPM, 1K/month | Command R+, Aya Expanse 32B |
| [Mistral La Plateforme](https://console.mistral.ai/) | 1 req/s, 1B tokens/month | Mistral Large, Devstral, Magistral |
| [Cloudflare Workers AI](https://dash.cloudflare.com) | 10K neurons/day | Llama 3.3 70B, QwQ 32B, 47+ models |
| [OVHcloud AI Endpoints](https://endpoints.ai.cloud.ovh.net) | 2 req/min/IP sandbox | GPT-OSS, Qwen3, Mistral |

### 🧪 Good Candidates Kept Outside the Core Catalog

| Provider | Why it is not core |
|----------|--------------------|
| [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) | Useful gateway with included credits, but it is a router/billing layer, not a provider of permanently free models. |
| [Cohere](https://cohere.com/) | Real evaluation key, but the allowance is small and the catalog is not coding-first enough for the default TUI. |
| [Ollama Cloud](https://ollama.com/pricing) | Interesting for light cloud usage, but it is closer to hosted Ollama capacity than a classic OpenAI-compatible free provider. |

### 💰 Providers with Trial Credits

| Provider | Credits | Duration |
|----------|---------|----------|
| [Hyperbolic](https://app.hyperbolic.ai/) | $1 | Trial/promo |
| [Fireworks](https://fireworks.ai/) | $1 | Trial/promo |
| [Nebius](https://tokenfactory.nebius.com/) | $1 | Permanent |
| [SambaNova Cloud](https://cloud.sambanova.ai/) | $5 | 3 months |
| [AI21](https://studio.ai21.com/) | $10 | 3 months |
| [Upstage](https://console.upstage.ai/) | $10 | 3 months |
| [NLP Cloud](https://nlpcloud.com/home) | $15 | Permanent |
| [Alibaba DashScope](https://bailian.console.alibabacloud.com/) | 1M tokens/model | 90 days |
| [Scaleway](https://console.scaleway.com/generative-api/models) | 1M tokens | Permanent |
| [Modal](https://modal.com) | $5/month | Monthly |
| [Inference.net](https://inference.net) | $1 (+ $25 on survey) | Permanent |
| [Novita](https://novita.ai/) | $0.5 | 1 year |

These trial-credit providers are deliberately not treated as core providers unless their free allowance is practical for recurring coding use. A $0.10/month or $1 one-time credit is useful for experimentation, not for this CLI's default promise.

### 🎓 Free with Education/Developer Programs

| Program | What you get |
|---------|--------------|
| [GitHub Student Pack](https://education.github.com/pack) | Free Copilot Pro for students (verify with .edu email) |
| [GitHub Copilot Free](https://code.visualstudio.com/blogs/2024/12/18/free-github-copilot) | 50 chat + 2,000 completions/month in VS Code |
| [Copilot Pro for teachers/maintainers](https://docs.github.com/en/copilot/how-tos/manage-your-account/get-free-access-to-copilot-pro) | Free Copilot Pro for open source maintainers & educators |
