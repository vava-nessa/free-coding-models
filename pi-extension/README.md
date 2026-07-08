# FCM-Pi — Pi Extension for free-coding-models

> ⚠️ **BETA** — This extension is under active development. Install via local path only (see below). It is not yet published to npm.

A native JavaScript extension for the **[Pi coding agent](https://pi.dev)** that wires **free-coding-models** directly into your Pi session. It stays silent by default, then `/fcm` pings ~30 candidate models in parallel, benchmarks the top 5, and lets you explicitly pick the model to use.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Silent by default** | No startup scan, no footer noise, and no automatic model switch on Pi boot or `/resume` |
| **Manual scan with `/fcm`** | Pings ~30 models in parallel only when you ask, then waits for your explicit selection |
| **Temporary animated status bar** | Live scan progress appears only while FCM is actively probing/benchmarking, then hides again |
| **Smart composite ranking** | Scores models on SWE-bench (60%), latency (20%), TPS (10%), stability (10%) |
| **10-minute disk cache** | Results cached to `~/.pi/agent/fcm-cache.json` for faster `/fcm-list` and repeated scans |
| **Error-triggered picker** | When a request fails (4xx/5xx), FCM reopens the menu and marks the failed model with `🔴 BUGGED` instead of switching automatically |
| **Pi context safety filter** | Tiny-context models such as 8k Cerebras probes can pass AI latency but still fail Pi; FCM hides them from the picker |
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

### Installation

The extension is **not yet published to npm** — install directly via local path.

Add the extension path to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "/absolute/path/to/free-coding-models/pi-extension"
  ]
}
```

Example on macOS:

```json
{
  "packages": [
    "/Users/yourname/Documents/GitHub/free-coding-models/pi-extension"
  ]
}
```

> 💡 You can also use a relative path from `~/.pi/agent/` — e.g. `"../../Documents/GitHub/free-coding-models/pi-extension"`

After editing `settings.json`, restart Pi. The extension loads automatically — no extra command needed.

---

## 📊 Scan Progress Display

While scanning during `/fcm`, the Pi footer status bar shows a live animated readout:

```
⠸ Probing: > free-coding-models — 47% (14/30)
⠼ Benchmarking: > free-coding-models — 60% (3/5)
```

- **Magenta Braille spinner** — 10-frame animation at 80ms refresh rate
- **Yellow phase label** — `Probing` during the ping phase, `Benchmarking` during the AI latency phase
- **Brand badge** — the `> free-coding-models` header logo, in the exact same green/white-on-black colours as the main FCM TUI header (instead of scrolling live model names)
- **Progress %** and `(completed/total)` counter always shown

Once complete, the status bar is cleared again. Results are shown in the picker, not kept permanently in the footer.

---

## 🏗️ Architecture & Scan Strategies

```
                 [User runs /fcm]
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
             Show picker, wait for user choice
                         │
                         ▼
             [Selected model is registered + switched]
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
7. Ranks candidates and shows the picker; no model changes until the user selects one

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
Cerebras free-tier has a **strict ~8k total token limit** for its FCM-listed models (prompt + tools + completion combined). A tiny `hi` ping or AI latency benchmark can pass, while a real Pi agent request still fails because Pi includes system prompts and tool schemas. FCM therefore hides 8k Cerebras models from the Pi picker.

Cerebras also enforces **5 RPM** on the free tier. FCM uses small probes and disables Pi reasoning flags for FCM-managed OpenAI-compatible providers to avoid incompatible thinking controls.

### NVIDIA NIM
NIM has ~40 RPM on the no-credit-card tier. The parallel ping scan may exhaust this temporarily on the first scan; subsequent scans use the cache.

---

## 🔄 Error-triggered picker

When the active model returns an HTTP 4xx or 5xx error, FCM:

1. Detects the failure via provider response hooks.
2. Marks the failed model as `🔴 BUGGED` in the next picker.
3. Runs a fresh scan so the alternatives are current.
4. Reopens the model picker.
5. Waits for the user to explicitly select a replacement.

FCM never switches models automatically after an error.

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
