# fcm-pi

Pi coding-agent extension for **free-coding-models**.

> ⚠️ **BETA** — Consumed via local path inside the `free-coding-models` repo for now.

A native extension for the **[Pi coding agent](https://pi.dev)** that wires **free-coding-models** into your Pi session. It stays silent by default, then `/fcm` scans ~30 candidate models in parallel, benchmarks the top survivors, and lets you explicitly pick the model to use.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Silent by default** | No startup scan, no footer noise, no automatic model switch on Pi boot or `/resume` |
| **Manual scan with `/fcm`** | Pings ~30 models in parallel only when you ask, then waits for your explicit selection |
| **Branded progress footer** | Live scan progress shows the `> free-coding-models` badge (exact TUI header colours) with a `%` counter, only while scanning |
| **Smart composite ranking** | SWE-bench (60%), latency (20%), TPS (10%), stability (10%) |
| **10-minute disk cache** | `~/.pi/agent/fcm-cache.json` for faster diagnostics and repeated scans |
| **Error-triggered picker** | On 4xx/5xx, FCM reopens the menu and marks the failed model `🔴 BUGGED` instead of auto-switching |
| **Pi context safety filter** | Tiny-context models (e.g. 8k Cerebras) pass probes but fail Pi agent prompts; FCM hides them |
| **Shared core** | Scan/rank/cache/daemon/key logic is shared with `fcm-opencode` via `fcm-agent-core` |

## Install (local path)

This package is the canonical home of the Pi adapter. For backwards compatibility, the legacy `pi-extension/` folder is kept as a thin re-export wrapper, so existing `~/.pi/agent/settings.json` paths keep working:

```jsonc
// ~/.pi/agent/settings.json
{
  "packages": [
    "/Users/<you>/Documents/GitHub/free-coding-models/pi-extension"
    // or point directly here:
    // "/Users/<you>/Documents/GitHub/free-coding-models/packages/fcm-pi"
  ]
}
```

> The `packages/` tree needs a one-time self-link so `free-coding-models` resolves by name. See [`fcm-agent-core/README.md`](../fcm-agent-core/README.md#local-setup-why-a-self-link-is-needed).

## Commands

| Command | Description |
|---------|-------------|
| `/fcm` | Re-scan and pick a model interactively from the top 10 ranked |
| `/fcm-list` | Ranked table of top 20 models (SWE / Latency / TPS / Provider) |
| `/fcm-router` | Explicitly connect Pi to the local FCM Smart Router daemon |
| `/fcm-status` | Diagnostics: best model, last scan source, daemon state |

## Architecture

```
packages/fcm-pi/
├── extensions/index.js        ← Pi extension factory (hooks + commands)
└── lib/
    ├── pi-config-writer.js    ← ~/.pi/agent/{models,settings,auth}.json writer
    └── pi-progress-renderer.js ← structured events → Pi footer (badge + spinner)
```

All shared logic (scan orchestrator, direct scanner, daemon client, ranker, model-config, cache, API keys, provider descriptors) lives in [`fcm-agent-core`](../fcm-agent-core).

## Provider notes

- **Cerebras** free-tier has a strict ~8k total token limit and 5 RPM. FCM hides 8k Cerebras models from the picker and disables Pi reasoning flags for FCM-managed OpenAI-compatible providers.
- **NVIDIA NIM** has ~40 RPM on the no-card tier; the first parallel scan may exhaust it temporarily — subsequent scans use the cache.
