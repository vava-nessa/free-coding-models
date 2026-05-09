# CLI Flags Reference

Flags can be combined freely in any order. Run `free-coding-models --help` to print this list in-app.

---

## 🚀 Tool Launchers

Start the TUI pre-configured to a specific tool. Press `Enter` on a model to auto-configure and launch it.

| Flag | Tool | What happens on Enter |
|------|------|----------------------|
| *(none)* | OpenCode CLI | Writes model to `opencode.json` and launches `opencode` CLI |
| `--opencode` | OpenCode CLI | Same as above, explicit |
| `--opencode-desktop` | OpenCode Desktop | Writes model to `opencode.json` and opens desktop app |
| `--opencode-web` | OpenCode WebUI | Writes model to `opencode.json` and opens web dashboard |
| `--openclaw` | OpenClaw | Writes model as primary in `~/.openclaw/openclaw.json` |
| `--crush` | Crush | Writes model to `~/.config/crush/crush.json` and launches `crush` |
| `--goose` | Goose | Writes provider config to `~/.config/goose/` and launches `goose` |
| `--aider` | Aider | Writes model to `~/.aider.conf.yml` and launches `aider` |
| `--kilo` | Kilo CLI | Writes model to `~/.config/kilo/opencode.json` and launches `kilo` |
| `--qwen` | Qwen Code | Writes model to `~/.qwen/settings.json` and launches `qwen` |
| `--openhands` | OpenHands | Sets `LLM_MODEL` env var and launches OpenHands |
| `--amp` | Amp | Writes model to `~/.config/amp/settings.json` and launches `amp` |
| `--pi` | Pi | Writes model to `~/.pi/agent/settings.json` and launches `pi` |
| `--copilot` | GitHub Copilot CLI | Sets `COPILOT_*` env vars to use the selected provider/model via BYOK |

---

## 🔍 Filtering & Display

| Flag | Type | Description |
|------|------|-------------|
| `--best` | boolean | Show only top‑tier models (A+, S, S+). |
| `--premium` | boolean | Start with an elite-focused preset (tier filter `S` + `verdict` sort). This is fully resettable in the TUI. |
| `--tier <S\|A\|B\|C>` | value | Filter by tier family — `S` = S+/S, `A` = A+/A/A-, `B` = B+/B, `C` = C only. |
| `--origin <provider>` | value | Filter by provider name (e.g. `nvidia`, `groq`, `cerebras`). |
| `--hide-unconfigured` | boolean | Hide models whose provider has no API key configured. |
| `--show-unconfigured` | boolean | Show all models regardless of API key configuration (overrides default). |

---

## 📊 Sorting

| Flag | Type | Description |
|------|------|-------------|
| `--sort <column>` | value | Start sorted by a specific column. Valid values: `rank`, `tier`, `origin`, `model`, `ping`, `avg`, `swe`, `ctx`, `condition`, `verdict`, `uptime`, `stability`. |
| `--asc` | boolean | Sort ascending (smallest first). |
| `--desc` | boolean | Sort descending (largest first). |

---

## 📤 Output Modes

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Skip the TUI — print all model results as a JSON array and exit. Combine with `jq` for scripting. |
| `--fiable` | boolean | Wait 10 s, pick the most reliable model by avg + stability + uptime, print `provider/model_id` and exit. |
| `--recommend` | boolean | Open the Smart Recommend overlay immediately on startup (same as pressing `Q`). |

---

## ⚙️ Runtime Options

| Flag | Type | Description |
|------|------|-------------|
| `--ping-interval <ms>` | value | Override the ping interval in milliseconds (e.g. `--ping-interval 5000`). |
| `--daemon` | boolean | Start the Smart Model Router daemon in the foreground for service managers. |
| `--daemon-bg` | boolean | Start the Smart Model Router daemon detached in the background. |
| `--daemon-status` | boolean | Print router daemon status JSON and exit. |
| `--daemon-stop` | boolean | Gracefully stop the running router daemon. |
| `--no-telemetry` | boolean | Disable anonymous usage telemetry for this session. |
| `--help`, `-h` | boolean | Print the full help text with all flags and exit. |

---

## Examples

```bash
# Start in Crush mode filtered to S-tier only
free-coding-models --crush --tier S

# Get the fastest S-tier model ID (headless, for scripts)
free-coding-models --tier S --json | jq -r '.[0].modelId'

# Filter by latency
free-coding-models --json | jq '.[] | select(.avgPing < 500)'

# Most reliable model right now
free-coding-models --fiable

# Start the local Smart Model Router endpoint
free-coding-models --daemon-bg

# Inspect router port, active set, uptime, and request totals
free-coding-models --daemon-status

# Start with an elite-focused preset (resettable in-app)
free-coding-models --premium

# Sort by SWE score descending
free-coding-models --sort swe --desc

# Groq models only
free-coding-models --origin groq

# Configure Goose with an S-tier model
free-coding-models --goose --tier S
```
