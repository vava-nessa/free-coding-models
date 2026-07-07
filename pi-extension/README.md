# FCM-Pi — Pi Extension for free-coding-models

A lightweight JavaScript extension for the **Pi coding agent (pi.dev)** that connects to **free-coding-models** (FCM). It runs round-trip pings and real-answer AI latency benchmarks on your configured free models, and automatically activates the most performant, usable model before your coding session starts.

---

## ✨ Features

- **Auto-scan on session startup**: Runs a quick scan when Pi boots up, updating status dynamically in the terminal footer.
- **Smart model selection**: Auto-configures Pi to use the highest-performing model based on a composite score:
  - **60% SWE-bench score** (Coding capability)
  - **20% Latency** (Network round-trip response speed)
  - **10% TPS** (Throughput token speed)
  - **10% Stability** (Success rates / uptime)
- **Interactive selection (`/fcm`)**: Allows manually selecting from the top 10 best-performing models in real-time.
- **Diagnostics (`/fcm-list` / `/fcm-status`)**: Displays ranked models in clean, structured terminal tables, and checks local daemon status.
- **Smart Router Integration (`/fcm-router`)**: Routes requests through a local model-routing daemon with automatic failover fallback chains.

---

## 🚀 Quick Start

### Prerequisites

1. **free-coding-models** must be installed and configured:
   ```bash
   npm install -g free-coding-models
   
   # Run once to configure your API keys (Groq, Google AI Studio, Nvidia NIM, etc.)
   free-coding-models
   ```

2. **Pi coding agent (pi.dev)** must be installed on your system.

### Installation

Install the extension directly inside the Pi shell or terminal:

```bash
pi install /Users/vava/Documents/GitHub/free-coding-models/pi-extension
```

*Or, if published to npm:*

```bash
pi install npm:fcm-pi
```

---

## 📐 Architecture & Scan Strategies

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
     Query cache & stats      Ping 30 candidate models
     directly from daemon     Benchmark top 5 candidates
             \                      /
              \                    /
             Filter: status === 'up'
             Rank: Compute composite scores
             Select: Write Pi configurations
                         │
                         ▼
             [Pi Session Ready to Code!]
```

- **Daemon Mode**: Checks if the FCM background daemon is active. If so, fetches pre-cached latency and stats in under 1 second.
- **Direct Mode (Fallback)**: Performs a parallel ping of the top 30 models from the FCM registry, then benchmarks the top 5 smartest models, completing in ~8-15 seconds.
- **Config Persistence**: Modifies `~/.pi/agent/models.json` and `~/.pi/agent/settings.json` to store provider URLs and default model choices.

---

## ⌨️ Command Reference

| Command | Action |
|---------|--------|
| `/fcm` | Re-runs diagnostic scan and presents interactive top 10 model list |
| `/fcm-list` | Renders a styled table of the top 20 available models with SWE/Latency/TPS |
| `/fcm-router` | Configures Pi to route completions through the FCM Smart Router daemon |
| `/fcm-status` | Shows status diagnostics (active model, scan latency, daemon state) |

---

## 🧹 Telemetry & Security

This extension does not collect or transmit API keys, source code, or personal data. It works entirely offline or connects only to your configured AI providers and local loopback address (`http://localhost:19280`).
