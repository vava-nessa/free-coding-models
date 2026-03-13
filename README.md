<p align="center">
  <img src="https://img.shields.io/npm/v/free-coding-models?color=76b900&label=npm&logo=npm" alt="npm version">
  <img src="https://img.shields.io/node/v/free-coding-models?color=76b900&logo=node.js" alt="node version">
  <img src="https://img.shields.io/npm/l/free-coding-models?color=76b900" alt="license">
  <img src="https://img.shields.io/badge/models-159-76b900?logo=nvidia" alt="models count">
  <img src="https://img.shields.io/badge/providers-20-blue" alt="providers count">
</p>

<h1 align="center">free-coding-models</h1>

<p align="center">
  <strong>Contributors</strong><br>
  <a href="https://github.com/vava-nessa"><img src="https://avatars.githubusercontent.com/u/5466264?v=4&s=60" width="60" height="60" style="border-radius:50%" alt="vava-nessa"></a>
  <a href="https://github.com/erwinh22"><img src="https://avatars.githubusercontent.com/u/6641858?v=4&s=60" width="60" height="60" style="border-radius:50%" alt="erwinh22"></a>
  <a href="https://github.com/whit3rabbit"><img src="https://avatars.githubusercontent.com/u/12357518?v=4&s=60" width="60" height="60" style="border-radius:50%" alt="whit3rabbit"></a>
  <a href="https://github.com/skylaweber"><img src="https://avatars.githubusercontent.com/u/172871734?v=4&s=60" width="60" height="60" style="border-radius:50%" alt="skylaweber"></a>
  <a href="https://github.com/PhucTruong-ctrl"><img src="https://github.com/PhucTruong-ctrl.png?s=60" width="60" height="60" style="border-radius:50%" alt="PhucTruong-ctrl"></a>
  <br>
  <sub>
    <a href="https://github.com/vava-nessa">vava-nessa</a> &middot;
    <a href="https://github.com/erwinh22">erwinh22</a> &middot;
    <a href="https://github.com/whit3rabbit">whit3rabbit</a> &middot;
    <a href="https://github.com/skylaweber">skylaweber</a> &middot;
    <a href="https://github.com/PhucTruong-ctrl">PhucTruong-ctrl</a>
  </sub>
</p>

<p align="center">
  💬 <a href="https://discord.gg/5MbTnDC3Md">Let's talk about the project on Discord</a>
</p>

<p align="center">

```
1. Create a free API key (NVIDIA, OpenRouter, Hugging Face, etc.)
2. npm i -g free-coding-models
3. free-coding-models
```

</p>

<p align="center">
  <strong>Find the fastest coding LLM models in seconds</strong><br>
  <sub>Ping free coding models from 20 providers in real-time — pick the best one for OpenCode, OpenClaw, or any AI coding assistant</sub>
</p>

<p align="center">
  <img src="demo.gif" alt="free-coding-models demo" width="100%">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-requirements">Requirements</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-tui-columns">Columns</a> •
  <a href="#-stability-score">Stability</a> •
  <a href="#-coding-models">Models</a> •
  <a href="#-opencode-integration">OpenCode</a> •
  <a href="#-openclaw-integration">OpenClaw</a> •
  <a href="#-how-it-works">How it works</a>
</p>

---

## ✨ Features

- **🎯 Coding-focused** — Only LLM models optimized for code generation, not chat or vision
- **🌐 Multi-provider** — Models from NVIDIA NIM, Groq, Cerebras, SambaNova, OpenRouter, Hugging Face Inference, Replicate, DeepInfra, Fireworks AI, Codestral, Hyperbolic, Scaleway, Google AI, SiliconFlow, Together AI, Cloudflare Workers AI, Perplexity API, Alibaba Cloud (DashScope), ZAI, and iFlow
- **⚙️ Settings screen** — Press `P` to manage provider API keys, enable/disable providers, configure the proxy, clean OpenCode proxy sync, and manually check/install updates
- **🔀 Multi-account Proxy (`fcm-proxy`)** — Automatically starts a local reverse proxy that groups all your accounts into a single provider in OpenCode; supports multi-account rotation and auto-detects usage limits to swap between providers.
- **🚀 Parallel pings** — All models tested simultaneously via native `fetch`
- **📊 Real-time animation** — Watch latency appear live in alternate screen buffer
- **🏆 Smart ranking** — Top 3 fastest models highlighted with medals 🥇🥈🥉
- **⏱ Adaptive monitoring** — Starts in a fast 2s cadence for 60s, settles to 10s, slows to 30s after 5 minutes idle, and supports a forced 4s mode
- **📈 Rolling averages** — Avg calculated from ALL successful pings since start
- **📊 Uptime tracking** — Percentage of successful pings shown in real-time
- **📐 Stability score** — Composite 0–100 score measuring consistency (p95, jitter, spikes, uptime)
- **📊 Usage tracking** — Monitor remaining quota for each exact provider/model pair when the provider exposes it; otherwise the TUI shows a green dot instead of a misleading percentage.
- **📜 Request Log Overlay** — Press `X` to inspect recent proxied requests and token usage for exact provider/model pairs.
- **🛠 MODEL_NOT_FOUND Rotation** — If a specific provider returns a 404 for a model, the TUI intelligently rotates through other available providers for the same model.
- **🔄 Auto-retry** — Timeout models keep getting retried, nothing is ever "given up on"
- **🎮 Interactive selection** — Navigate with arrow keys directly in the table, press Enter to act
- **💻 OpenCode integration** — Auto-detects NIM setup, sets model as default, launches OpenCode
- **🦞 OpenClaw integration** — Sets selected model as default provider in `~/.openclaw/openclaw.json`
- **🧰 Public tool launchers** — `Enter` can auto-configure and launch `OpenCode CLI`, `OpenCode Desktop`, `OpenClaw`, `Crush`, and `Goose`
- **🔌 Install Endpoints flow** — Press `Y` to install one configured provider directly into `OpenCode CLI`, `OpenCode Desktop`, `OpenClaw`, `Crush`, or `Goose`, either with the full provider catalog or a curated subset of models
- **📝 Feature Request (J key)** — Send anonymous feedback directly to the project team
- **🐛 Bug Report (I key)** — Send anonymous bug reports directly to the project team
 - **🎨 Clean output** — Zero scrollback pollution, interface stays open until Ctrl+C
 - **📶 Status indicators** — UP ✅ · No Key 🔑 · Timeout ⏳ · Overloaded 🔥 · Not Found 🚫
 - **🔍 Keyless latency** — Models are pinged even without an API key
 - **🏷 Tier filtering** — Filter models by tier letter (S, A, B, C)
- **⭐ Persistent favorites** — Press `F` on a selected row to pin/unpin it
- **🙈 Configured-only by default** — Press `E` to toggle showing only providers with configured API keys; the choice persists across sessions and profiles
- **🪟 Width guardrail** — If your terminal is too narrow, the TUI shows a centered warning instead of rendering a broken table

---

## 📋 Requirements

Before using `free-coding-models`, make sure you have:

1. **Node.js 18+** — Required for native `fetch` API
2. **At least one free API key** — pick any or all of:
   - **NVIDIA NIM** — [build.nvidia.com](https://build.nvidia.com) → Profile → API Keys → Generate – free tier: 40 req/min (no credit card)
   - **Groq** — [console.groq.com/keys](https://console.groq.com/keys) → Create API Key – free tier: 30‑50 RPM per model (varies)
   - **Cerebras** — [cloud.cerebras.ai](https://cloud.cerebras.ai) → API Keys → Create – free tier: generous (developer tier 10× higher limits)
   - **SambaNova** — [sambanova.ai/developers](https://sambanova.ai/developers) → Developers portal → API key (dev tier generous)
   - **OpenRouter** — [openrouter.ai/keys](https://openrouter.ai/keys) → Create key (free requests on `:free` models, see details below)

### OpenRouter Free Tier Details

OpenRouter provides free requests on free models (`:free`):

```
──────────────────────────────────────────────────
  OpenRouter — Free requests on free models (:free)
──────────────────────────────────────────────────

  No credits (or <$10)   →   50  requests / day   (20 req/min)
  ≥ $10 in credits      →  1000 requests / day   (20 req/min)

──────────────────────────────────────────────────
Key things to know:

  • Free models (:free) never consume your credits.
    Your $10 stays untouched if you only use :free models.

  • Failed requests still count toward your daily quota.

  • Quota resets every day at midnight UTC.

  • Free-tier popular models may be additionally rate-limited
    by the provider itself during peak hours.
──────────────────────────────────────────────────
```

   - **Hugging Face Inference** — [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → Access Tokens (free monthly credits)
   - **Replicate** — [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) → Create token – free tier: 6 req/min (no payment) – up to 3,000 RPM (API) / 600 RPM (predictions) with payment
   - **DeepInfra** — [deepinfra.com/login](https://deepinfra.com/login) → Login → API key – free tier: 200 concurrent requests (default)
   - **Fireworks AI** — [fireworks.ai](https://fireworks.ai) → Settings → Access Tokens – $1 free credits; 10 req/min without payment (full limits with payment)
   - **Mistral Codestral** — [codestral.mistral.ai](https://codestral.mistral.ai) → API Keys (30 req/min, 2000/day — phone required)
   - **Hyperbolic** — [app.hyperbolic.ai/settings](https://app.hyperbolic.ai/settings) → API Keys ($1 free trial)
   - **Scaleway** — [console.scaleway.com/iam/api-keys](https://console.scaleway.com/iam/api-keys) → IAM → API Keys (1M free tokens)
   - **Google AI Studio** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Get API key (free Gemma models, 14.4K req/day)
   - **SiliconFlow** — [cloud.siliconflow.cn/account/ak](https://cloud.siliconflow.cn/account/ak) → API Keys (free-model quotas vary by model)
   - **Together AI** — [api.together.ai/settings/api-keys](https://api.together.ai/settings/api-keys) → API Keys (credits/promotions vary)
   - **Cloudflare Workers AI** — [dash.cloudflare.com](https://dash.cloudflare.com) → Create API token + set `CLOUDFLARE_ACCOUNT_ID` (Free: 10k neurons/day)
   - **Perplexity API** — [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) → API Key (tiered limits by spend)
   - **ZAI** — [z.ai](https://z.ai) → Get API key (Coding Plan subscription)
3. **OpenCode** *(optional)* — [Install OpenCode](https://github.com/opencode-ai/opencode) to use the OpenCode integration
4. **OpenClaw** *(optional)* — [Install OpenClaw](https://openclaw.ai) to use the OpenClaw integration

 > 💡 **Tip:** You don't need all twenty providers. One key is enough to get started. Add more later via the Settings screen (`P` key). Models without a key still show real latency (`🔑 NO KEY`) so you can evaluate providers before signing up.

---

## 📦 Installation

```bash
# npm (global install — recommended)
npm install -g free-coding-models

# pnpm
pnpm add -g free-coding-models

# bun
bun add -g free-coding-models

# Or use directly with npx/pnpx/bunx
npx free-coding-models YOUR_API_KEY
pnpx free-coding-models YOUR_API_KEY
bunx free-coding-models YOUR_API_KEY
```

### 🆕 What's New

**Version 0.2.6 brings powerful new features:**

- **`--json` flag** — Output model results as JSON for scripting, CI/CD pipelines, and monitoring dashboards. Perfect for automation: `free-coding-models --tier S --json | jq '.[0].modelId'`

- **Persistent ping cache** — Results are cached for 5 minutes between runs. Startup is nearly instant when cache is fresh, and you save API rate limits. Cache file: `~/.free-coding-models.cache.json`

- **Config security check** — Automatically warns if your API key config file has insecure permissions and offers one-click auto-fix with `chmod 600`

- **Provider colors everywhere** — Provider names are now colored consistently in logs, settings, and the main table for better visual recognition

---

## 🚀 Usage

```bash
# Just run it — starts in OpenCode CLI mode, prompts for API key if not set
free-coding-models

# Explicitly target OpenCode CLI (TUI + Enter launches OpenCode CLI)
free-coding-models --opencode

# Explicitly target OpenCode Desktop (TUI + Enter sets model & opens Desktop app)
free-coding-models --opencode-desktop

# Explicitly target OpenClaw (TUI + Enter sets model as default in OpenClaw)
free-coding-models --openclaw

# Launch other supported public tools with the selected model
free-coding-models --crush
free-coding-models --goose

# Show only top-tier models (A+, S, S+)
free-coding-models --best

 # Analyze for 10 seconds and output the most reliable model
 free-coding-models --fiable

 # Output results as JSON (for scripting/automation)
free-coding-models --json
free-coding-models --tier S --json | jq '.[0].modelId'  # Get fastest S-tier model ID
free-coding-models --json | jq '.[] | select(.avgPing < 500)'  # Filter by latency

 # Filter models by tier letter
free-coding-models --tier S          # S+ and S only
free-coding-models --tier A          # A+, A, A- only
free-coding-models --tier B          # B+, B only
free-coding-models --tier C          # C only

# Combine flags freely
free-coding-models --openclaw --tier S
free-coding-models --opencode --best
free-coding-models --tier S --json
```

### Choosing the target tool

Running `free-coding-models` with no launcher flag starts in **OpenCode CLI** mode.

- Press **`Z`** in the TUI to cycle the public launch targets: `OpenCode CLI` → `OpenCode Desktop` → `OpenClaw` → `Crush` → `Goose`
- Or start directly in the target mode with a CLI flag such as `--opencode-desktop`, `--openclaw`, `--crush`, or `--goose`
- The active target is always visible in the header badge before you press `Enter`

**How it works:**
 1. **Ping phase** — All enabled models are pinged in parallel (up to 159 across 20 providers)
 2. **Continuous monitoring** — Models start at 2s re-pings for 60s, then fall back to 10s automatically, and slow to 30s after 5 minutes idle unless you force 4s mode with `W`
3. **Real-time updates** — Watch "Latest", "Avg", and "Up%" columns update live
4. **Select anytime** — Use ↑↓ arrows to navigate, press Enter on a model to act
5. **Smart detection** — Automatically detects if NVIDIA NIM is configured in OpenCode or OpenClaw

 Setup wizard (first run — walks through all 20 providers):

```
  🔑 First-time setup — API keys
  Enter keys for any provider you want to use. Press Enter to skip one.

  ● NVIDIA NIM
    Free key at: https://build.nvidia.com
    Profile → API Keys → Generate
  Enter key (or Enter to skip): nvapi-xxxx

  ● Groq
    Free key at: https://console.groq.com/keys
    API Keys → Create API Key
  Enter key (or Enter to skip): gsk_xxxx

  ● Cerebras
    Free key at: https://cloud.cerebras.ai
    API Keys → Create
  Enter key (or Enter to skip):

  ● SambaNova
    Free key at: https://cloud.sambanova.ai/apis
    API Keys → Create ($5 free trial, 3 months)
  Enter key (or Enter to skip):

  ✅ 2 key(s) saved to ~/.free-coding-models.json
  You can add or change keys anytime with the P key in the TUI.
```

You don't need all twenty providers — skip any provider by pressing Enter. At least one key is required.

### Adding or changing keys later

Press **`P`** to open the Settings screen at any time:

```
  ⚙  Settings

  Providers

  ❯ [ ✅ ] NVIDIA NIM              nvapi-••••••••••••3f9a  [Test ✅]  Free tier (provider quota by model)
    [ ✅ ] OpenRouter              (no key set)            [Test —]   Free on :free (50/day <$10, 1000/day ≥$10)
    [ ✅ ] Hugging Face Inference  (no key set)            [Test —]   Free monthly credits (~$0.10)

  Setup Instructions — NVIDIA NIM
  1) Create a NVIDIA NIM account: https://build.nvidia.com
  2) Profile → API Keys → Generate
  3) Press T to test your key

  ↑↓ Navigate  •  Enter Edit/Run  •  + Add key  •  - Remove key  •  Space Toggle  •  T Test key  •  S Sync→OpenCode  •  R Restore backup  •  U Updates  •  ⌫ Delete profile  •  Esc Close
```

- **↑↓** — navigate providers
- **Enter** — edit the selected key, run maintenance actions, or load the selected profile
- **+ / -** — add another key for the selected provider or remove one
- **Space** — toggle provider enabled/disabled
- **T** — fire a real test ping to verify the key works (shows ✅/❌)
- **S** — sync `fcm-proxy` into OpenCode when proxy mode + persistence are enabled
- **R** — restore the last OpenCode backup created by sync/cleanup flows
- **U** — manually check npm for a newer version
- **Backspace** — delete the selected saved profile
- **Esc** — close settings and reload models list

 Keys are saved to `~/.free-coding-models.json` (permissions `0600`).

 Manual update is in the same Settings screen (`P`) under **Maintenance** (Enter to check, Enter again to install when an update is available).
 Favorites are also persisted in the same config file and survive restarts.
 The main table now starts in `Configured Only` mode, so if nothing is set up yet you can press `P` and add your first API key immediately.

### Environment variable overrides

Env vars always take priority over the config file:

```bash
NVIDIA_API_KEY=nvapi-xxx free-coding-models
GROQ_API_KEY=gsk_xxx free-coding-models
CEREBRAS_API_KEY=csk_xxx free-coding-models
OPENROUTER_API_KEY=sk-or-xxx free-coding-models
HUGGINGFACE_API_KEY=hf_xxx free-coding-models
REPLICATE_API_TOKEN=r8_xxx free-coding-models
DEEPINFRA_API_KEY=di_xxx free-coding-models
FIREWORKS_API_KEY=fw_xxx free-coding-models
SILICONFLOW_API_KEY=sk_xxx free-coding-models
TOGETHER_API_KEY=together_xxx free-coding-models
 CLOUDFLARE_API_TOKEN=cf_xxx CLOUDFLARE_ACCOUNT_ID=your_account_id free-coding-models
 PERPLEXITY_API_KEY=pplx_xxx free-coding-models
 ZAI_API_KEY=zai-xxx free-coding-models
 DASHSCOPE_API_KEY=sk-xxx free-coding-models
 ```

 ### Get your free API keys

**NVIDIA NIM** (44 models, S+ → C tier):
1. Sign up at [build.nvidia.com](https://build.nvidia.com)
2. Go to Profile → API Keys → Generate API Key
3. Name it (e.g. "free-coding-models"), set expiry to "Never"
4. Copy — shown only once!

**Groq** (6 models, fast inference):
1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to API Keys → Create API Key

**Cerebras** (3 models, ultra-fast silicon):
1. Sign up at [cloud.cerebras.ai](https://cloud.cerebras.ai)
2. Go to API Keys → Create

**OpenRouter** (`:free` models):
1. Sign up at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create API key (`sk-or-...`)

**Hugging Face Inference**:
1. Sign up at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create Access Token (`hf_...`)

**Replicate**:
1. Sign up at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. Create API token (`r8_...`)

**DeepInfra**:
1. Sign up at [deepinfra.com/login](https://deepinfra.com/login)
2. Create API key from your account dashboard

**Fireworks AI**:
1. Sign up at [fireworks.ai](https://fireworks.ai)
2. Open Settings → Access Tokens and create a token

**Mistral Codestral**:
1. Sign up at [codestral.mistral.ai](https://codestral.mistral.ai)
2. Go to API Keys → Create

**Hyperbolic**:
1. Sign up at [app.hyperbolic.ai/settings](https://app.hyperbolic.ai/settings)
2. Create an API key in Settings

**Scaleway**:
1. Sign up at [console.scaleway.com/iam/api-keys](https://console.scaleway.com/iam/api-keys)
2. Go to IAM → API Keys

**Google AI Studio**:
1. Sign up at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create an API key for Gemini/Gemma endpoints

**SiliconFlow**:
1. Sign up at [cloud.siliconflow.cn/account/ak](https://cloud.siliconflow.cn/account/ak)
2. Create API key in Account → API Keys

**Together AI**:
1. Sign up at [api.together.ai/settings/api-keys](https://api.together.ai/settings/api-keys)
2. Create an API key in Settings

**Cloudflare Workers AI**:
1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Create an API token with Workers AI permissions
3. Export both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`

**Perplexity API**:
1. Sign up at [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. Create API key (`PERPLEXITY_API_KEY`)

**Alibaba Cloud (DashScope)** (8 models, Qwen3-Coder family):
1. Sign up at [modelstudio.console.alibabacloud.com](https://modelstudio.console.alibabacloud.com)
2. Activate Model Studio (1M free tokens per model, Singapore region, 90 days)
3. Create API key (`DASHSCOPE_API_KEY`)

**ZAI** (5 models, GLM family):
1. Sign up at [z.ai](https://z.ai)
2. Subscribe to Coding Plan
3. Get API key from dashboard

> 💡 **Free tiers** — each provider exposes a dev/free tier with its own quotas. ZAI requires a Coding Plan subscription.

---

## 🤖 Coding Models

**159 coding models** across 20 providers and 8 tiers, ranked by [SWE-bench Verified](https://www.swebench.com) — the industry-standard benchmark measuring real GitHub issue resolution. Scores are self-reported by providers unless noted.

### Alibaba Cloud (DashScope) (8 models)

| Tier | SWE-bench | Model |
|------|-----------|-------|
| **S+** ≥70% | Qwen3 Coder Plus (69.6%), Qwen3 Coder 480B (70.6%) |
| **S** 60–70% | Qwen3 Coder Max (67.0%), Qwen3 Coder Next (65.0%), Qwen3 235B (70.0%), Qwen3 80B Instruct (65.0%) |
| **A+** 50–60% | Qwen3 32B (50.0%) |
| **A** 40–50% | Qwen2.5 Coder 32B (46.0%) |

### ZAI Coding Plan (5 models)

| Tier | SWE-bench | Model |
|------|-----------|-------|
| **S+** ≥70% | GLM-5 (77.8%), GLM-4.5 (75.0%), GLM-4.7 (73.8%), GLM-4.5-Air (72.0%), GLM-4.6 (70.0%) |

### NVIDIA NIM (44 models)

| Tier | SWE-bench | Models |
|------|-----------|--------|
| **S+** ≥70% | GLM 5 (77.8%), Kimi K2.5 (76.8%), Step 3.5 Flash (74.4%), MiniMax M2.1 (74.0%), GLM 4.7 (73.8%), DeepSeek V3.2 (73.1%), Devstral 2 (72.2%), Kimi K2 Thinking (71.3%), Qwen3 Coder 480B (70.6%), Qwen3 235B (70.0%) |
| **S** 60–70% | MiniMax M2 (69.4%), DeepSeek V3.1 Terminus (68.4%), Qwen3 80B Thinking (68.0%), Qwen3.5 400B (68.0%), Kimi K2 Instruct (65.8%), Qwen3 80B Instruct (65.0%), DeepSeek V3.1 (62.0%), Llama 4 Maverick (62.0%), GPT OSS 120B (60.0%) |
| **A+** 50–60% | Mistral Large 675B (58.0%), Nemotron Ultra 253B (56.0%), Colosseum 355B (52.0%), QwQ 32B (50.0%) |
| **A** 40–50% | Nemotron Super 49B (49.0%), Mistral Medium 3 (48.0%), Qwen2.5 Coder 32B (46.0%), Magistral Small (45.0%), Llama 4 Scout (44.0%), Llama 3.1 405B (44.0%), Nemotron Nano 30B (43.0%), R1 Distill 32B (43.9%), GPT OSS 20B (42.0%) |
| **A-** 35–40% | Llama 3.3 70B (39.5%), Seed OSS 36B (38.0%), R1 Distill 14B (37.7%), Stockmark 100B (36.0%) |
| **B+** 30–35% | Ministral 14B (34.0%), Mixtral 8x22B (32.0%), Granite 34B Code (30.0%) |
| **B** 20–30% | R1 Distill 8B (28.2%), R1 Distill 7B (22.6%) |
| **C** <20% | Gemma 2 9B (18.0%), Phi 4 Mini (14.0%), Phi 3.5 Mini (12.0%) |

### Groq (10 models)

| Tier | SWE-bench | Model |
|------|-----------|-------|
| **S** 60–70% | Kimi K2 Instruct (65.8%), Llama 4 Maverick (62.0%) |
| **A+** 50–60% | QwQ 32B (50.0%) |
| **A** 40–50% | Llama 4 Scout (44.0%), R1 Distill 70B (43.9%) |
| **A-** 35–40% | Llama 3.3 70B (39.5%) |

### Cerebras (7 models)

| Tier | SWE-bench | Model |
|------|-----------|-------|
| **A+** 50–60% | Qwen3 32B (50.0%) |
| **A** 40–50% | Llama 4 Scout (44.0%) |
| **A-** 35–40% | Llama 3.3 70B (39.5%) |

### Tier scale

- **S+/S** — Elite frontier coders (≥60% SWE-bench), best for complex real-world tasks and refactors
- **A+/A** — Great alternatives, strong at most coding tasks
- **A-/B+** — Solid performers, good for targeted programming tasks
- **B/C** — Lightweight or older models, good for code completion on constrained infra

### Filtering by tier

Use `--tier` to focus on a specific capability band:

```bash
free-coding-models --tier S     # Only S+ and S (frontier models)
free-coding-models --tier A     # Only A+, A, A- (solid performers)
free-coding-models --tier B     # Only B+, B (lightweight options)
free-coding-models --tier C     # Only C (edge/minimal models)
```

## 📊 TUI Columns

The main table displays one row per model with the following columns:

| Column | Sort key | Description |
|--------|----------|-------------|
| **Rank** | `R` | Position based on current sort order (medals for top 3: 🥇🥈🥉) |
| **Tier** | — | SWE-bench tier (S+, S, A+, A, A-, B+, B, C) |
| **SWE%** | `S` | SWE-bench Verified score — industry-standard for coding |
| **CTX** | `C` | Context window size (e.g. `128k`) |
| **Model** | `M` | Model display name (favorites show ⭐ prefix) |
| **Provider** | `O` | Provider name (NIM, Groq, etc.) — press `D` to cycle provider filter |
| **Latest Ping** | `L` | Most recent round-trip latency in milliseconds |
| **Avg Ping** | `A` | Rolling average of ALL successful pings since launch |
| **Health** | `H` | Current status: UP ✅, NO KEY 🔑, Timeout ⏳, Overloaded 🔥, Not Found 🚫 |
| **Verdict** | `V` | Health verdict based on avg latency + stability analysis |
| **Stability** | `B` | Composite 0–100 consistency score (see [Stability Score](#-stability-score)) |
| **Up%** | `U` | Uptime — percentage of successful pings |
| **Used** | — | Total prompt+completion tokens consumed in logs for this exact provider/model pair, shown in `k` or `M` |
| **Usage** | `G` | Provider-scoped quota remaining when measurable; otherwise a green dot means usage % is not applicable/reliable for that provider |

### Verdict values

The Verdict column combines average latency with stability analysis:

| Verdict | Meaning |
|---------|---------|
| **Perfect** | Avg < 400ms with stable p95/jitter |
| **Normal** | Avg < 1000ms, consistent responses |
| **Slow** | Avg 1000–2000ms |
| **Spiky** | Good avg but erratic tail latency (p95 >> avg) |
| **Very Slow** | Avg 2000–5000ms |
| **Overloaded** | Server returned 429/503 (rate limited or capacity hit) |
| **Unstable** | Was previously up but now timing out, or avg > 5000ms |
| **Not Active** | No successful pings yet |
| **Pending** | First ping still in flight |

---

## 📐 Stability Score

The **Stability** column (sort with `B` key) shows a composite 0–100 score that answers: *"How consistent and predictable is this model?"*

Average latency alone is misleading — a model averaging 250ms that randomly spikes to 6 seconds *feels* slower in practice than a steady 400ms model. The stability score captures this.

### Formula

Four signals are normalized to 0–100 each, then combined with weights:

```
Stability = 0.30 × p95_score
          + 0.30 × jitter_score
          + 0.20 × spike_score
          + 0.20 × reliability_score
```

| Component | Weight | What it measures | How it's normalized |
|-----------|--------|-----------------|---------------------|
| **p95 latency** | 30% | Tail-latency spikes — the worst 5% of response times | `100 × (1 - p95 / 5000)`, clamped to 0–100 |
| **Jitter (σ)** | 30% | Erratic response times — standard deviation of ping times | `100 × (1 - jitter / 2000)`, clamped to 0–100 |
| **Spike rate** | 20% | Fraction of pings above 3000ms | `100 × (1 - spikes / total_pings)` |
| **Reliability** | 20% | Uptime — fraction of successful HTTP 200 pings | Direct uptime percentage (0–100) |

---

## 🔀 Multi-Account Proxy (`fcm-proxy`)

`free-coding-models` includes a built-in reverse proxy that can group all your provider accounts into a single virtual provider.

Important:
- **Disabled by default** — proxy mode is now opt-in from the Settings screen (`P`)
- **Direct OpenCode launch remains the default** when proxy mode is off
- **Token/request logs are only populated by proxied requests** today

### Why use the proxy?
- **Unified Provider**: Instead of managing 20+ providers in your coding assistant, just use `fcm-proxy`.
- **Automatic Rotation**: When one account hits its rate limit (429), the proxy automatically swaps to the next available account for that model.
- **Quota Awareness**: The proxy tracks usage in real-time and prioritizes accounts with the most remaining bandwidth.
- **Transparent Bridging**: Automatically handles non-standard API paths (like ZAI's `/api/coding/paas/v4/`) and converts them to standard OpenAI-compatible `/v1/` calls.

### How to use it
1. Open **Settings** with `P`
2. Enable **Proxy mode (opt-in)**
3. Optionally enable **Persist proxy in OpenCode** if you explicitly want `fcm-proxy` written to `~/.config/opencode/opencode.json`
4. Optionally set **Preferred proxy port** (`0` = auto)
5. Use `S` in Settings to sync the proxy catalog into OpenCode only when you actually want that persistent config

Cleanup:
- Use the Settings action **Clean OpenCode proxy config**
- Or run `free-coding-models --clean-proxy`

---

## 📜 Request Log Overlay

Press **`X`** at any time to open the dedicated request-log overlay.

- **Proxy-only accounting**: Entries are written when requests flow through the multi-account proxy.
- **Exact token totals**: The overlay aggregates prompt+completion usage per proxied request.
- **Per-request visibility**: You can inspect provider, model, status, token count, and latency for recent requests.
- **Startup table reuse**: The `Used` column in the main table is derived from the same request log file.

Use **↑↓** to scroll and **Esc** or **X** to return to the main table.

---

## 🔌 OpenCode Integration

**The easiest way** — let `free-coding-models` do everything:

1. **Run**: `free-coding-models --opencode` (or launch with no flag to use the default OpenCode CLI mode)
2. **Wait** for models to be pinged (green ✅ status)
3. **Navigate** with ↑↓ arrows to your preferred model
4. **Press Enter** — tool automatically:
   - Detects if NVIDIA NIM is configured in OpenCode
   - Sets your selected model as default in `~/.config/opencode/opencode.json`
   - Launches OpenCode with the model ready to use

### tmux sub-agent panes

When launched from an existing `tmux` session, `free-coding-models` now auto-adds an OpenCode `--port` argument so OpenCode/oh-my-opencode can spawn sub-agents in panes.

- Priority 1: reuse `OPENCODE_PORT` if it is valid and free
- Priority 2: auto-pick the first free port in `4096-5095`

You can force a specific port:

```bash
OPENCODE_PORT=4098 free-coding-models --opencode
```

### ZAI provider proxy

OpenCode doesn't natively support ZAI's API path format (`/api/coding/paas/v4/*`). When you select a ZAI model, `free-coding-models` automatically starts a local reverse proxy that translates OpenCode's standard `/v1/*` requests to ZAI's API. This is fully transparent -- just select a ZAI model and press Enter.

**How it works:**
1. A localhost HTTP proxy starts on a random available port
2. OpenCode is configured with a `zai` provider pointing at `http://localhost:<port>/v1`
3. The proxy rewrites `/v1/models` to `/api/coding/paas/v4/models` and `/v1/chat/completions` to `/api/coding/paas/v4/chat/completions`
4. When OpenCode exits, the proxy shuts down automatically

No manual configuration needed -- the proxy lifecycle is managed entirely by `free-coding-models`.

### Manual OpenCode Setup (Optional)

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "provider": {
    "nvidia": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NVIDIA NIM",
      "options": {
        "baseURL": "https://integrate.api.nvidia.com/v1",
        "apiKey": "{env:NVIDIA_API_KEY}"
      }
    }
  },
  "model": "nvidia/deepseek-ai/deepseek-v3.2"
}
```

Then set the environment variable:

```bash
export NVIDIA_API_KEY=nvapi-xxxx-your-key-here
# Add to ~/.bashrc or ~/.zshrc for persistence
```

Run `/models` in OpenCode and select **NVIDIA NIM** provider and your chosen model.

> ⚠️ **Note:** Free models have usage limits based on NVIDIA's tier — check [build.nvidia.com](https://build.nvidia.com) for quotas.

### Automatic Installation Fallback

If NVIDIA NIM is not yet configured in OpenCode, the tool:
- Shows installation instructions in your terminal
- Creates a `prompt` file in `$HOME/prompt` with the exact configuration
- Launches OpenCode, which will detect and display the prompt automatically

---

## 🦞 OpenClaw Integration

OpenClaw is an autonomous AI agent daemon. `free-coding-models` can configure it to use NVIDIA NIM models as its default provider — no download or local setup needed, everything runs via the NIM remote API.

### Quick Start

```bash
free-coding-models --openclaw
```

Or press **`Z`** in the TUI until the header shows **OpenClaw**, then press **Enter** on a model.

1. **Wait** for models to be pinged
2. **Navigate** with ↑↓ arrows to your preferred model
3. **Press Enter** — tool automatically:
   - Reads `~/.openclaw/openclaw.json`
   - Adds the `nvidia` provider block (NIM base URL + your API key) if missing
   - Sets `agents.defaults.model.primary` to `nvidia/<model-id>`
   - Saves config and prints next steps

### What gets written to OpenClaw config

```json
{
  "models": {
    "providers": {
      "nvidia": {
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "api": "openai-completions"
      }
    }
  },
  "env": {
    "NVIDIA_API_KEY": "nvapi-xxxx-your-key"
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "nvidia/deepseek-ai/deepseek-v3.2"
      },
      "models": {
        "nvidia/deepseek-ai/deepseek-v3.2": {}
      }
    }
  }
}
```

> ⚠️ **Note:** `providers` must be nested under `models.providers` — not at the config root. A root-level `providers` key is ignored by OpenClaw.

> ⚠️ **Note:** The model must also be listed in `agents.defaults.models` (the allowlist). Without this entry, OpenClaw rejects the model with *"not allowed"* even if it is set as primary.

### After updating OpenClaw config

OpenClaw's gateway **auto-reloads** config file changes (depending on `gateway.reload.mode`). To apply manually:

```bash
# Apply via CLI
openclaw models set nvidia/deepseek-ai/deepseek-v3.2

# Or re-run the interactive setup wizard
openclaw configure
```

> ⚠️ **Note:** `openclaw restart` does **not** exist as a CLI command. Kill and relaunch the process manually if you need a full restart.

> 💡 **Why use remote NIM models with OpenClaw?** NVIDIA NIM serves models via a fast API — no local GPU required, no VRAM limits, free credits for developers. You get frontier-class coding models (DeepSeek V3, Kimi K2, Qwen3 Coder) without downloading anything.

### Patching OpenClaw for full NVIDIA model support

**Problem:** By default, OpenClaw only allows a few specific NVIDIA models in its allowlist. If you try to use a model that's not in the list, you'll get this error:

```
Model "nvidia/mistralai/devstral-2-123b-instruct-2512" is not allowed. Use /models to list providers, or /models <provider> to list models.
```

**Solution:** Patch OpenClaw's configuration to add ALL 47 NVIDIA models from `free-coding-models` to the allowlist:

```bash
# From the free-coding-models package directory
node patch-openclaw.js
```

This script:
- Backs up `~/.openclaw/agents/main/agent/models.json` and `~/.openclaw/openclaw.json`
- Adds all 47 NVIDIA models with proper context window and token limits
- Preserves existing models and configuration
- Prints a summary of what was added

**After patching:**

1. Restart OpenClaw gateway:
   ```bash
   systemctl --user restart openclaw-gateway
   ```

2. Verify models are available:
   ```bash
   free-coding-models --openclaw
   ```

3. Select any model — no more "not allowed" errors!

**Why this is needed:** OpenClaw uses a strict allowlist system to prevent typos and invalid models. The `patch-openclaw.js` script populates the allowlist with all known working NVIDIA models, so you can freely switch between them without manually editing config files.

---

## ⚙️ How it works

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Enter alternate screen buffer (like vim/htop/less)           │
│  2. Ping ALL models in parallel                                  │
│  3. Display real-time table with Latest/Avg/Stability/Up%        │
│  4. Re-ping ALL models at 2s on startup, then 10s steady-state │
│     and 30s after 5m idle unless forced back to 4s with W      │
│  5. Update rolling averages + stability scores per model        │
│  6. User can navigate with ↑↓ and select with Enter            │
│  7. On Enter (OpenCode): set model, launch OpenCode             │
│  8. On Enter (OpenClaw): update ~/.openclaw/openclaw.json       │
└──────────────────────────────────────────────────────────────────┘
```

**Result:** Continuous monitoring interface that stays open until you select a model or press Ctrl+C. Rolling averages give you accurate long-term latency data, the stability score reveals which models are truly consistent vs. deceptively spikey, and you can configure your tool of choice with one keystroke. If the terminal is too narrow, the app shows a centered warning instead of a truncated table.

---

## 📋 API Reference

**Environment variables (override config file):**

| Variable | Description |
|----------|-------------|
| `NVIDIA_API_KEY` | NVIDIA NIM key |
| `GROQ_API_KEY` | Groq key |
| `CEREBRAS_API_KEY` | Cerebras key |
| `SAMBANOVA_API_KEY` | SambaNova key |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `HUGGINGFACE_API_KEY` / `HF_TOKEN` | Hugging Face token |
| `REPLICATE_API_TOKEN` | Replicate token |
| `DEEPINFRA_API_KEY` / `DEEPINFRA_TOKEN` | DeepInfra key |
| `CODESTRAL_API_KEY` | Mistral Codestral key |
| `HYPERBOLIC_API_KEY` | Hyperbolic key |
| `SCALEWAY_API_KEY` | Scaleway key |
| `GOOGLE_API_KEY` | Google AI Studio key |
| `SILICONFLOW_API_KEY` | SiliconFlow key |
| `TOGETHER_API_KEY` | Together AI key |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_API_KEY` | Cloudflare Workers AI token/key |
 | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (required for Workers AI endpoint URL) |
  | `PERPLEXITY_API_KEY` / `PPLX_API_KEY` | Perplexity API key |
  | `ZAI_API_KEY` | ZAI key |
  | `DASHSCOPE_API_KEY` | Alibaba Cloud (DashScope) API key |

**Config file:** `~/.free-coding-models.json` (created automatically, permissions `0600`)

```json
{
  "apiKeys": {
    "nvidia":   "nvapi-xxx",
    "groq":     "gsk_xxx",
    "cerebras": "csk_xxx",
    "openrouter": "sk-or-xxx",
    "huggingface": "hf_xxx",
    "replicate": "r8_xxx",
    "deepinfra": "di_xxx",
    "siliconflow": "sk_xxx",
    "together": "together_xxx",
    "cloudflare": "cf_xxx",
    "perplexity": "pplx_xxx",
    "zai":      "zai-xxx"
  },
  "providers": {
    "nvidia":   { "enabled": true },
    "groq":     { "enabled": true },
    "cerebras": { "enabled": true },
    "openrouter": { "enabled": true },
    "huggingface": { "enabled": true },
    "replicate": { "enabled": true },
    "deepinfra": { "enabled": true },
    "siliconflow": { "enabled": true },
    "together": { "enabled": true },
    "cloudflare": { "enabled": true },
    "perplexity": { "enabled": true },
    "zai":      { "enabled": true }
   },
   "settings": {
     "hideUnconfiguredModels": true
   },
   "favorites": [
     "nvidia/deepseek-ai/deepseek-v3.2"
   ]
 }
```

**Configuration:**
- **Ping timeout**: 15 seconds per attempt (slow models get more time)
- **Ping cadence**: startup burst at 2 seconds for 60s, then 10 seconds normally, 30 seconds when idle for 5 minutes, or forced 4 seconds via `W`
- **Monitor mode**: Interface stays open forever, press Ctrl+C to exit

**Flags:**

| Flag | Description |
|------|-------------|
| *(none)* | Start in OpenCode CLI mode |
| `--opencode` | OpenCode CLI mode — Enter launches OpenCode CLI with selected model |
| `--opencode-desktop` | OpenCode Desktop mode — Enter sets model and opens OpenCode Desktop |
| `--openclaw` | OpenClaw mode — Enter sets selected model as default in OpenClaw |
| `--crush` | Crush mode — Enter writes `crush.json` and launches Crush |
| `--goose` | Goose mode — Enter launches Goose with env-based provider config |
| `--best` | Show only top-tier models (A+, S, S+) |
| `--fiable` | Analyze 10 seconds, output the most reliable model as `provider/model_id` |
| `--json` | Output results as JSON (for scripting/automation, CI/CD, dashboards) |
| `--tier S` | Show only S+ and S tier models |
| `--tier A` | Show only A+, A, A- tier models |
| `--tier B` | Show only B+, B tier models |
| `--tier C` | Show only C tier models |
| `--profile <name>` | Load a saved config profile on startup |
| `--recommend` | Auto-open Smart Recommend overlay on start |
| `--clean-proxy` | Remove persisted `fcm-proxy` config from OpenCode |

**Keyboard shortcuts (main TUI):**
- **↑↓** — Navigate models
- **Enter** — Select model and launch the current target tool from the header badge
- **R/S/C/M/O/L/A/H/V/B/U/G** — Sort by Rank/SWE/Ctx/Model/Provider/Latest/Avg/Health/Verdict/Stability/Up%/Usage
- **F** — Toggle favorite on selected model (⭐ in Model column, pinned at top)
- **T** — Cycle tier filter (All → S+ → S → A+ → A → A- → B+ → B → C → All)
- **D** — Cycle provider filter (All → NIM → Groq → ...)
- **E** — Toggle configured-only mode (on by default, persisted across sessions and profiles)
- **Z** — Cycle target tool (OpenCode CLI → OpenCode Desktop → OpenClaw → Crush → Goose)
- **X** — Toggle request logs (recent proxied request/token usage logs, up to 500 entries)
- **A (in logs)** — Toggle between showing 500 entries or ALL logs
- **P** — Open Settings (manage API keys, toggles, updates, profiles)
- **Y** — Open Install Endpoints (`provider → tool → all models` or `selected models only`, no proxy)
- **Shift+P** — Cycle through saved profiles (switches live TUI settings)
- **Shift+S** — Save current TUI settings as a named profile (inline prompt)
- **Q** — Open Smart Recommend overlay (find the best model for your task)
- **W** — Cycle ping mode (`FAST` 2s → `NORMAL` 10s → `SLOW` 30s → `FORCED` 4s)
- **J / I** — Request feature / Report bug
- **K / Esc** — Show help overlay / Close overlay
- **Ctrl+C** — Exit

Pressing **K** now shows a full in-app reference: main hotkeys, settings hotkeys, and CLI flags with usage examples.

### 🔌 Install Endpoints (`Y`)

`Y` opens a dedicated install flow for configured providers. The flow is:

1. Pick one provider that already has an API key in Settings
2. Pick the target tool: `OpenCode CLI`, `OpenCode Desktop`, `OpenClaw`, `Crush`, or `Goose`
3. Choose either `Install all models` or `Install selected models only`

Important behavior:

- Installs are written directly into the target tool config as FCM-managed entries, without going through `fcm-proxy`
- `Install all models` is the recommended path because FCM can refresh that catalog automatically on later launches when the provider model list changes
- `Install selected models only` is useful when you want a smaller curated picker inside the target tool
- `OpenCode CLI` and `OpenCode Desktop` share the same `opencode.json`, so the managed provider appears in both

 **Keyboard shortcuts (Settings screen — `P` key):**
 - **↑↓** — Navigate providers, maintenance row, and profile rows
 - **Enter** — Edit API key inline, check/install update, or load a profile
 - **Space** — Toggle provider enabled/disabled
- **T** — Test current provider's API key (fires a live ping)
- **U** — Check for updates manually from settings
- **Backspace** — Delete the selected profile (only on profile rows)
- **Esc** — Close settings and return to main TUI

---

### 📋 Config Profiles

Profiles let you save and restore different TUI configurations — useful if you switch between work/personal setups, different tier preferences, or want to keep separate favorites lists.

**What's stored in a profile:**
- Favorites (starred models)
- Sort column and direction
- Tier filter
- Ping mode
- Configured-only filter
- API keys

**Saving a profile:**
1. Configure the TUI the way you want (favorites, sort, tier, etc.)
2. Press **Shift+S** — an inline prompt appears at the bottom
3. Type a name (e.g. `work`, `fast-only`, `presentation`) and press **Enter**
4. The profile is saved and becomes the active profile (shown as a purple badge in the header)

**Switching profiles:**
- **Shift+P** in the main table — cycles through saved profiles (or back to raw config)
- **`--profile <name>`** — load a specific profile on startup

**Managing profiles:**
- Open Settings (**P** key) — scroll down to the **Profiles** section
- **Enter** on a profile row to load it
- **Backspace** on a profile row to delete it

Profiles are stored inside `~/.free-coding-models.json` under the `profiles` key.

---

## 🔧 Development

```bash
git clone https://github.com/vava-nessa/free-coding-models
cd free-coding-models
npm install
npm start -- YOUR_API_KEY
```

### Releasing a new version

1. Make your changes and commit them with a descriptive message
2. Update `CHANGELOG.md` with the new version entry
3. Bump `"version"` in `package.json` (e.g. `0.1.3` → `0.1.4`)
4. Commit with **just the version number** as the message:

```bash
git add .
git commit -m "0.1.4"
git push
```

The GitHub Actions workflow automatically publishes to npm on every push to `main`.

---

## 📄 License

MIT © [vava](https://github.com/vava-nessa)

---

<p align="center">
  <sub>Built with ☕ and 🌹 by <a href="https://github.com/vava-nessa">vava</a></sub>
</p>

## 📬 Contribute
We welcome contributions! Feel free to open issues, submit pull requests, or get involved in the project.

**Q:** Can I use this with other providers?
**A:** Yes, the tool is designed to be extensible; see the source for examples of customizing endpoints.

**Q:** How accurate are the latency numbers?
**A:** They represent average round-trip times measured during testing; actual performance may vary based on network conditions.

**Q:** Do I need to download models locally for OpenClaw?
**A:** No — `free-coding-models` configures OpenClaw to use NVIDIA NIM's remote API, so models run on NVIDIA's infrastructure. No GPU or local setup required.

## 📧 Support

For questions or issues, open a [GitHub issue](https://github.com/vava-nessa/free-coding-models/issues).

 💬 Let's talk about the project on Discord: https://discord.gg/5MbTnDC3Md

---

<p align="center">
  <sub>We collect anonymous usage data to improve the tool and fix bugs. No personal information is ever collected.</sub>
</p>
