# FCM-Pi — Pi Extension for free-coding-models

A native JavaScript extension for the **[Pi coding agent](https://pi.dev)** that wires **free-coding-models** directly into your Pi session. It pings ~30 candidate models in parallel, benchmarks the top 5, auto-selects the best one on startup, and displays a real-time animated progress scan in the Pi status bar.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Auto-scan on session start** | Pings ~30 models in parallel on every Pi boot. Selects and activates the best one before your first prompt |
| **Animated status bar** | Live magenta Braille spinner with scrolling model + provider names and real-time % progress |
| **Provider visible in Pi TUI** | Active model shown as `GLM 4.7 (Cerebras) [FCM S+]` — model, provider, tier, all at a glance |
| **Smart composite ranking** | Scores models on SWE-bench (60%), latency (20%), TPS (10%), stability (10%) |
| **10-minute disk cache** | Results cached to `~/.pi/agent/fcm-cache.json`. Subsequent session starts are instant (< 100ms) |
| **Auto-failover on error** | When a request fails (4xx/5xx), FCM automatically re-scans and switches to the next best working model |
| **Daemon integration** | If the FCM daemon is running (`free-coding-models --daemon-bg`), fetches pre-cached stats in < 1s instead of scanning |
| **Interactive model picker** | `/fcm` re-scans live and presents an interactive selection of the top 10 models |

---

## 🚀 Quick Start

### Prerequisites

1. **free-coding-models** must be installed globally and configured:
   ```bash
   npm install -g free-coding-models

   # Run once to configure your API keys (Groq, Nvidia NIM, Cerebras, etc.)
   free-coding-models
   ```

2. **Pi coding agent (pi.dev)** must be installed on your system.

### Installation (local path)

Add the extension to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "../../Documents/GitHub/free-coding-models/pi-extension"
  ]
}
```

Adjust the path to match where you cloned `free-coding-models` on your machine.

### Installation (npm — when published)

```bash
pi install npm:fcm-pi
```

---

## 📊 Scan Progress Display

While scanning during `/fcm` or session start, the Pi footer status bar shows a live animated readout:

```
⠸ Probing: Kimi K2.6 [Nvidia], Step 3.5 Flash [Stepfun] — 47% (14/30)
⠼ Benchmarking: GLM 4.7 [Cerebras] — 60% (3/5)
```

- **Magenta Braille spinner** — 10-frame animation at 80ms refresh rate
- **Yellow phase label** — `Probing` during the ping phase, `Benchmarking` during the AI latency phase
- **Cyan model + provider** — the last 2 actively probed models scroll in real time
- **Progress %** and `(completed/total)` counter always shown

Once complete, the status bar settles on:

```
✅ GLM 4.7 (Cerebras) [FCM S+] — 340ms
```

---

## 🏗️ Architecture & Scan Strategies

```
               [Pi Session Starting]
                         │
                         ▼
             Check: Is FCM Daemon active?
             (http://localhost:19280)
               /                  \
             YES                  NO
             /                      \
    [Daemon Scan (~1s)]      [Direct Scan (~8-15s)]
     Query cache & stats      Ping top 30 models in parallel
     directly from daemon     Benchmark top 5 survivors
             \                      /
              \                    /
             Filter: status === 'up'
             Rank: Compute composite scores
             Select: Write Pi config + switch session
                         │
                         ▼
             [Pi Session Ready to Code!]
```

### Daemon Mode (fast path)
When `free-coding-models --daemon-bg` is running, the extension queries `localhost:19280/api/models` and `/stats` directly. Scan completes in under 1 second using pre-cached latency data.

### Direct Mode (fallback)
If the daemon is not running, the extension:
1. Loads the FCM model catalog (~191 models across 20 providers)
2. Filters to models with a configured API key
3. Sorts by SWE-bench score and takes top 30 candidates
4. Pings all 30 in parallel (15s timeout each)
5. Filters to models that returned HTTP 200
6. Benchmarks top 5 by SWE score (measures real AI output latency + TPS)
7. Ranks and selects the winner

---

## ⌨️ Command Reference

| Command | Description |
|---------|-------------|
| `/fcm` | Re-scan live and pick a model interactively from the top 10 ranked results |
| `/fcm-list` | Render a styled ASCII table of the top 20 models (SWE / Latency / TPS / Provider) |
| `/fcm-router` | Route Pi completions through the FCM Smart Router daemon (auto-failover across providers) |
| `/fcm-status` | Show diagnostics: active model, last scan source, scan cache age, daemon state |

---

## 🧠 Composite Ranking

| Weight | Metric | Details |
|--------|--------|---------|
| **60%** | SWE-bench score | Coding task success rate from `sources.js` catalog |
| **20%** | Latency (ms) | Normalized: lower is better. 100ms = perfect, 5000ms = worst |
| **10%** | TPS | Tokens per second from AI latency benchmark |
| **10%** | Stability | Model stability score from FCM ping history (0-100) |

---

## 🗂️ Config Files Modified

| File | What's stored |
|------|---------------|
| `~/.pi/agent/models.json` | Provider URL, API key, model ID and capabilities |
| `~/.pi/agent/settings.json` | Default provider and model selection |
| `~/.pi/agent/fcm-cache.json` | Last scan results with 10-minute TTL |

---

## ⚠️ Provider-Specific Notes

### Cerebras
Cerebras free-tier has a **strict 8192 total token limit** (prompt + tools + completion combined). The FCM catalog reflects this accurately — Pi allocates a smaller context budget when using Cerebras models, preventing silent overflow errors.

Cerebras also enforces **5 RPM** on the free tier. FCM uses a single ping per model scan (no thinking parameters that trigger double-requests) to stay within quota.

### NVIDIA NIM
NIM has ~40 RPM on the no-credit-card tier. The parallel ping scan may exhaust this temporarily on the first scan; subsequent scans use the cache.

---

## 🔄 Auto-Failover

When the active model returns an HTTP 4xx or 5xx error, FCM automatically:

1. Detects the failure via the `agent_end` hook
2. Notifies you with a banner: `⚠️ Le modèle actif a renvoyé une erreur. Recherche d'une alternative...`
3. Triggers a fresh full scan
4. Switches to the next best working model
5. Shows a confirmation notification

This runs silently — you don't need to manually `/fcm` when a model goes down.

---

## 📁 File Structure

```
pi-extension/
├── package.json           — Extension manifest (fcm-pi)
├── extensions/
│   └── index.js           — Pi extension entry point (hooks + commands)
└── lib/
    ├── scanner.js          — Orchestrator (daemon → direct fallback)
    ├── direct-scanner.js   — Parallel ping + benchmark with animated progress
    ├── model-ranker.js     — Composite score + ranking logic
    ├── config-writer.js    — Writes ~/.pi/agent/models.json + settings.json
    ├── daemon-client.js    — HTTP client for FCM daemon (localhost:19280)
    └── api-keys.js         — Loads API keys from FCM config + env vars
```

---

## 🧹 Telemetry & Security

This extension does **not** collect or transmit:
- API keys
- Source code or project files
- Personal data or usage patterns

It operates entirely offline or connects only to:
- Your configured AI provider APIs (Cerebras, Nvidia, Groq, etc.)
- The local FCM daemon at `http://localhost:19280` (optional)
