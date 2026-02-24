# Changelog

---

## 0.1.63

### Added

- **Fireworks AI provider**: added new provider with 11 models including Llama 4 Maverick, DeepSeek V3, QwQ 32B, Qwen2.5 Coder 32B, Llama 3.1 405B, R1 Distill 70B, Llama 3.3 70B, Mixtral 8x22B, Llama 3.1 8B, R1 Distill 7B, and Gemma 3 27B. API key available via `FIREWORKS_API_KEY` env var or config file.
- **Fallback model suggestions**: when a model shows "Overloaded" (HTTP 429 rate limit), the TUI now displays a suggestion line below it with the best alternative model from the same tier or lower. Includes model name, tier, provider, and average latency.

### Changed

- Replaced webhook telemetry with PostHog capture API (`/i/v0/e/`) and kept explicit consent + `--no-telemetry` opt-out.
- Added persistent anonymous telemetry identity in config (`telemetry.anonymousId`) for stable anonymous usage counts.
- Added telemetry consent screen UX: custom ASCII onboarding, explicit privacy messaging, and “Accept & Continue” default action.
- Added telemetry toggle in Settings (`P`) and documented env controls: `FREE_CODING_MODELS_TELEMETRY`, `FREE_CODING_MODELS_POSTHOG_KEY`, `FREE_CODING_MODELS_POSTHOG_HOST`.
- Added telemetry metadata fields: `app_version`, `system` (`macOS`/`Windows`/`Linux`), and `terminal` (Terminal.app/iTerm2/kitty/etc. with fallback).
- Added telemetry debug mode with `FREE_CODING_MODELS_TELEMETRY_DEBUG=1` (stderr traces for sent/skip/error states).
- Hardened telemetry safety behavior: analytics failures stay non-blocking and non-TTY runs no longer overwrite stored consent.
- Fixed consent renderer to avoid full-screen clear side effects and preserve header visibility across terminals.
- Updated TUI footer contributors link to point to the repository contributors graph.

---

## 0.1.61

### Changed — TUI Footer & UX

- **"Made with" line is now pink**: the entire "Made with 💖 & ☕ by vava-nessa" sentence is now rendered in soft pink (`chalk.rgb(255,150,200)`) including the clickable author name link, making it visually distinct from the rest of the footer
- **`K Help` badge is now ultra-visible**: changed from plain green background to bright green (`bgGreenBright`) with **black bold text** — high contrast, stands out immediately at a glance in the footer hint line
- **`P` key closes Settings**: pressing `P` again while inside the Settings screen now closes it (same behavior as `Esc`). Previously only `Esc` worked. Both keys now trigger the same close + provider rebuild logic

---

## 0.1.60

### Changed — TUI Footer

- **Discord URL now shown in plain text**: after the clickable "Join our Discord" hyperlink, the raw URL `https://discord.gg/5MbTnDC3Md` is now printed in cyan, separated by `→`. This helps users on terminals that don't support OSC 8 clickable links to still see and copy-paste the URL.

---

## 0.1.59

### Changed — TUI Footer

- **`K Help` badge in footer is now bright green**: previously plain text, now rendered as `chalk.bgGreen.black.bold(' K Help ')` so it's immediately visible in the footer hint line

---

## 0.1.58

### Changed — TUI

- **Timeout emoji updated**: replaced `⏱` with `⏳` everywhere in the TUI (ping timeout display)

---

## 0.1.57

### Changed — TUI Footer

- **Discord link text shortened**: "Join our Discord" replaces the longer previous label — cleaner footer, same clickable OSC 8 hyperlink

---

## 0.1.56

### Changed — TUI Footer

- **Footer cleaned up and restructured**: removed duplicate/messy lines left by the 0.1.54 agent; consolidated into two clean footer lines:
  - Line 1: `Made with 💖 & ☕ by vava-nessa  •  ⭐ Star on GitHub` (clickable links)
  - Line 2: `💬 Join our Discord  •  ⚠ BETA TUI — might crash or have problems`
- **BETA warning added to TUI footer**: `⚠ BETA TUI` badge in yellow with a plain-text disclaimer, always visible at the bottom of the TUI app
- **Discord invite in TUI footer**: clickable OSC 8 hyperlink added directly in the footer (was only in README before)

---

## 0.1.55

### Changed — README & Documentation

- **README updated for 9 providers / 101 models**: badges, provider list, Support section, and Requirements section all updated to reflect the new state after 0.1.54
- **Discord header block reformatted**: replaced the join banner with a plain `💬 Let's talk about the project on Discord` link
- **BETA warning added to README**: inline `⚠️ free-coding-models is a BETA TUI — expect rough edges and occasional crashes` added to the docs link line in the Support section

---

## 0.1.54

### Added — Providers & Models

**5 new providers** (9 total, 101 models):

- **OpenRouter** — 8 free coding models via the `:free` quota tier (20 req/min, 50 req/day shared). Includes Qwen3 Coder, Step 3.5 Flash, DeepSeek R1 0528, GPT OSS 120B/20B, Nemotron Nano 30B, Llama 3.3 70B. Key prefix: `sk-or-`
- **Mistral Codestral** — dedicated coding endpoint (`codestral.mistral.ai`), `codestral-latest` model, 30 req/min / 2 000 req/day. Separate API key from the main Mistral platform. Key prefix: `csk-`
- **Hyperbolic** — $1 free trial credits. 10 models: Qwen3 Coder 480B, DeepSeek R1 0528, Kimi K2, GPT OSS 120B, Qwen3 235B, Qwen3 80B Instruct, DeepSeek V3 0324, Qwen2.5 Coder 32B, Llama 3.3 70B, Llama 3.1 405B. Key prefix: `eyJ`
- **Scaleway** — 1 million free tokens. 7 models: Devstral 2 123B, Qwen3 235B, GPT OSS 120B, Qwen3 Coder 30B, Llama 3.3 70B, R1 Distill 70B, Mistral Small 3.2. Key prefix: `scw-`
- **Google AI Studio** — free Gemma 3 models (14 400 req/day, 30 req/min). Gemma 3 27B / 12B / 4B via the OpenAI-compatible `generativelanguage.googleapis.com/v1beta/openai` endpoint. Key prefix: `AIza`

**New models in existing providers:**

- **Groq**: GPT OSS 120B (`openai/gpt-oss-120b`), GPT OSS 20B (`openai/gpt-oss-20b`), Qwen3 32B (`qwen/qwen3-32b`)
- **Cerebras**: GLM 4.6 (`glm-4.6`) from Z.ai — 10 req/min, 100 req/day
- **SambaNova**: DeepSeek V3.1 Terminus (`deepseek-ai/DeepSeek-V3.1-Terminus`, S tier 68.4%)

### Added — TUI Features

- **`N` key — Origin/provider filter**: cycles through All → NIM → Groq → Cerebras → SambaNova → OpenRouter → Codestral → Hyperbolic → Scaleway → Google AI → All, mirroring how `T` cycles tiers. The active provider is shown as a badge in the header. The Origin column header now reads `Origin(N)` and highlights in blue when a filter is active.
- **`C` key — Sort by context window**: the context-window sort was previously on `N`; moved to `C` (mnemonic: Context) to free up `N` for the origin filter.
- **`K` key — Help overlay**: press `K` (or `Esc`) to open/close a full keyboard shortcut reference listing every key and what it does, rendered in the alt-screen buffer without leaving the TUI.
- **`Esc` closes help and settings**: pressing Escape now dismisses both the `K` help overlay and the `P` settings screen. The help overlay intercepts Esc before the settings handler so there is no key conflict.

### Changed — README & UI

- Provider count badge updated: **4 → 9 providers**
- Model count badge updated: **67 → 101 models**
- Requirements section lists all 9 providers with their signup URLs
- Discord header block replaced with a plain `💬 Let's talk about the project on Discord` link
- Support section reformatted: GitHub issues link + Discord link on separate lines + docs link with inline BETA warning (`⚠️ free-coding-models is a BETA TUI — expect rough edges and occasional crashes`)
- Footer hint line updated: `T Tier  •  N Origin  •  … C` replaces old `N` in sort hint; `K Help` added

### Technical

- `sources.js`: 5 new named exports; `sources` object extended to 9 entries; `@exports` JSDoc updated
- `lib/config.js`: `ENV_VARS` extended with `openrouter`, `codestral`, `hyperbolic`, `scaleway`, `googleai`; JSDoc config structure comment updated
- `bin/free-coding-models.js`: first-run wizard extended to 9 providers; `ENV_VAR_NAMES` extended; OpenCode/OpenCode-Desktop provider blocks added for all 5 new providers (all use `@ai-sdk/openai-compatible` + baseURL); `ORIGIN_CYCLE` + `originFilterMode` state; `renderTable` signature gains `originFilterMode` parameter; `renderHelp()` function added; all `renderTable` call sites updated

---

## 0.1.53

### Added

- **SambaNova Cloud** as a new provider ($5 free trial, 3 months). 10 coding models: Qwen3 235B, DeepSeek R1 0528, DeepSeek V3.1, DeepSeek V3 0324, Llama 4 Maverick, GPT OSS 120B, Qwen3 32B, R1 Distill 70B, Llama 3.3 70B, Llama 3.1 8B. OpenAI-compatible endpoint at `api.sambanova.ai`. Key prefix: `sn-`
- **Cerebras**: Qwen3 235B (`qwen-3-235b-a22b`), GPT OSS 120B (`gpt-oss-120b`), Llama 3.1 8B (`llama3.1-8b`)
- **Groq**: Llama 3.1 8B (`llama-3.1-8b-instant`, 14 400 req/day)
- Full OpenCode + OpenCode Desktop integration for SambaNova (`@ai-sdk/openai-compatible` provider block injected automatically on model select)
- SambaNova added to first-run API key wizard and Settings screen (`P` key)

---

## 0.1.52

### Fixed
- **OpenCode model handoff** (PR #14 by @whit3rabbit): API keys from `~/.free-coding-models.json` were not passed to the OpenCode child process, causing silent fallback to the previous model. Also fixes Groq model ID mismatches (e.g. `kimi-k2-instruct` → `kimi-k2-instruct-0905`) via a new `OPENCODE_MODEL_MAP`
- **OpenClaw nvidia provider missing models array** (PR #13 by @whit3rabbit): `startOpenClaw()` created the nvidia provider block without a `models` property, causing Zod schema validation to reject the config

### Improved
- **Discord link in TUI footer**: the invite URL is now displayed in plain text on a separate line so it's visible and copiable on terminals that don't support clickable links

---

## 0.1.51

### Fixed
- **Groq/Cerebras models selected for OpenCode had no provider block**: even with the correct `groq/model-id` prefix, OpenCode couldn't use the model because no `provider.groq` block existed in `opencode.json` — now automatically creates the provider block (Groq: built-in with `apiKey: {env:GROQ_API_KEY}`; Cerebras: `@ai-sdk/openai-compatible` with baseURL) and registers the model in `provider.<key>.models`

## 0.1.50

### Fixed
- **Groq/Cerebras models selected for OpenCode were launched as NVIDIA models**: `providerKey` was not passed in `userSelected` on Enter, causing all models to be prefixed with `nvidia/` regardless of their actual provider — now correctly uses `groq/model-id` and `cerebras/model-id`
- **`startOpenCode` and `startOpenCodeDesktop`**: both functions now handle all 3 providers; Groq and Cerebras use OpenCode's built-in provider support (no custom config block needed, just `GROQ_API_KEY`/`CEREBRAS_API_KEY` env vars); NVIDIA retains its existing custom provider config flow

---

## 0.1.49

### Fixed
- **Cerebras / Groq without API key**: models were being pinged with the fallback NVIDIA key, causing misleading `❌ 401` — now pings without auth header; 401 is treated as `🔑 NO KEY` (server reachable, latency shown dimly)
- **Settings: entering an API key had no immediate effect**: after saving a key and closing Settings (Escape), models previously in `noauth` state are now immediately re-pinged with the new key

### Changed
- Ping without API key is now always attempted — a 401 response confirms the server is UP and shows real latency; `🔑 NO KEY` replaces the old `❌ 401` misleading error

---

## 0.1.48

### Fixed
- **`--tier` CLI flag**: `parseArgs()` was never called in `main()`, so `--tier S` was silently ignored — now wired in and applied on TUI startup (thanks @whit3rabbit, PR #11)
- **`--tier` value leaking into `apiKey`**: `parseArgs()` for-loop was capturing the tier value as the API key — fixed by skipping the value arg after `--tier`
- **Ctrl+C not exiting**: sort key handler was intercepting all single-letter keypresses including ctrl-modified ones — added `!key.ctrl` guard so Ctrl+C reaches the exit handler (PR #11)

### Added
- Test verifying `--tier` value does not leak into `apiKey` (63 tests total)

---

## 0.1.47

### Fixed
- **`--tier` CLI flag**: `parseArgs()` was never called in `main()`, so `--tier S` was silently ignored — now wired in and applied on TUI startup (thanks @whit3rabbit, PR #11)
- **`--tier` value leaking into `apiKey`**: `parseArgs()` for-loop was capturing the tier value as the API key — fixed by skipping the value arg after `--tier`
- **Ctrl+C not exiting**: sort key handler was intercepting all single-letter keypresses including ctrl-modified ones — added `!key.ctrl` guard so Ctrl+C reaches the exit handler (PR #11)

### Added
- Test verifying `--tier` value does not leak into `apiKey` (63 tests total)

---

## 0.1.46

### Fixed
- **Discord notification**: Fixed ECONNRESET error — drain response body with `res.resume()` and call `process.exit(0)` immediately after success so the Node process closes cleanly

### Changed
- **Discord link**: Updated invite URL to `https://discord.gg/5MbTnDC3Md` everywhere (README, TUI footer)

---

## 0.1.45

### Fixed
- **Discord notification**: Fixed GitHub Actions workflow crash (secrets context not allowed in step `if` conditions — now handled in the Node script directly)

---

## 0.1.44

### Added
- **Multi-provider support** — Groq (6 models) and Cerebras (3 models) added alongside NVIDIA NIM, for 53 total models
- **Multi-provider first-run wizard** — Steps through all 3 providers (NIM, Groq, Cerebras) on first launch; each is optional, Enter to skip; requires at least one key
- **Settings screen (`P` key)** — New TUI overlay to manage API keys per provider, toggle providers on/off, and test keys with a live ping
- **`lib/config.js`** — New JSON config system (`~/.free-coding-models.json`) replacing the old plain-text file
  - Auto-migrates old `~/.free-coding-models` (plain nvidia key) on first run
  - Stores keys per provider + per-provider enabled/disabled state
  - `NVIDIA_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY` env vars override config
- **Per-provider ping URLs** — `ping()` now accepts explicit endpoint URL; each provider has its own API endpoint in `sources.js`
- **Provider name in Origin column** — Shows `NIM` / `Groq` / `Cerebras` instead of always `NIM`

### Changed
- `MODELS` flat array now includes `providerKey` as 6th element
- State init filters models from disabled providers; rebuilds on settings close
- Config file path changed from `~/.free-coding-models` to `~/.free-coding-models.json` (migration is automatic)

---

## 0.1.41 — 2026-02-22

### Changed
- **sources.js data audit** — verified and corrected SWE-bench scores, tiers, and context windows across all NIM models:
  - Devstral 2 123B: `S, 62.0%, 128k` → `S+, 72.2%, 256k` (official Mistral announcement)
  - Mistral Large 675B: ctx `128k` → `256k`
  - QwQ 32B: ctx `32k` → `131k`
  - Llama 4 Maverick: ctx `128k` → `1M` (NVIDIA NIM confirmed)
  - Llama 4 Scout: ctx `128k` → `10M` (NVIDIA NIM confirmed)
  - GPT OSS 20B: ctx `32k` → `128k`

---

## 0.1.38 — 2026-02-22

### Fixed
- **Cross-platform OpenCode integration**: Fixed OpenCode CLI and Desktop installation issues on Windows and Linux
  - **Windows**: Fixed config path to use %APPDATA%\opencode\opencode.json with fallback to ~/.config
  - **Linux**: Added support for snap, flatpak, and xdg-open to launch OpenCode Desktop
  - **All platforms**: Properly detects OS and uses correct commands and paths
  - **OpenCode Desktop**: Platform-specific launch commands (macOS: `open -a`, Windows: `start`, Linux: multiple methods)

---

## 0.1.37 — 2026-02-22

### Added
- **Auto-update with sudo fallback**: When npm update fails due to permissions, automatically retries with sudo to complete the update

---

## 0.1.36 — 2026-02-22

### Added
- **SWE-bench Verified column**: Shows real SWE-bench Verified scores for all 44 models from official benchmarks
- **Color-coded keyboard shortcuts**: First letter of each column header colored in yellow to indicate sorting key
- **Heart and Coffee in footer**: "Made with 💖 & ☕ by vava-nessa"

### Changed
- **Column organization**: Reordered columns for better logical flow: Rank / Tier / SWE% / Model / Origin / Latest Ping / Avg Ping / Health / Verdict / Up%
- **Health column**: Renamed from "Status" to "Health" with H key for sorting
- **SWE-bench sorting**: S key now sorts by SWE-bench score
- **Latest ping shortcut**: L key (instead of P) for sorting by latest ping
- **Source name**: Simplified "NVIDIA NIM" to "NIM"

### Fixed
- **Column header alignment**: Fixed misalignment caused by ANSI color codes in headers
- **Discord link**: Updated to permanent invite link https://discord.gg/WKA3TwYVuZ

---

## 0.1.35 — 2026-02-22

### Changed
- **Column reorganization**: Reordered columns for better logical flow: Rank / Tier / SWE% / Model / Origin / Latest Ping / Avg Ping / Health / Verdict / Up%

---

## 0.1.34 — 2026-02-22

### Changed
- **Condition renamed to Health**: Renamed "Condition" column to "Health" for better clarity
- **Keyboard shortcut update**: H key now sorts by Health (instead of C for Condition)

---

## 0.1.33 — 2026-02-22

### Fixed
- **Column header alignment**: Fixed column headers misalignment issue caused by ANSI color codes interfering with text padding

---

## 0.1.32 — 2026-02-22

### Changed
- **Column header improvements**: Fixed column alignment issues for better visual appearance
- **Status renamed to Condition**: "Status" column renamed to "Condition" for clarity
- **Keyboard shortcut updates**: S key now sorts by SWE-bench score, C key sorts by Condition
- **Footer Discord text update**: Changed "Join our Discord!" to "Join Free-Coding-Models Discord!"

---

## 0.1.31 — 2026-02-22

### Added
- **SWE-bench column**: Added new SWE-bench Verified score column showing coding performance for each model
- **Color-coded column headers**: First letter of each column header is now colored (yellow) to indicate keyboard shortcut for sorting
- **Keyboard shortcut improvements**: Changed P to L for latest ping sorting, added E for SWE-bench sorting

### Changed
- **Source name simplification**: Renamed "NVIDIA NIM" to "NIM" throughout the codebase
- **Enhanced footer Discord link**: Discord link now displays in bright cyan color with "(link fixed)" indicator

---

## 0.1.29 — 2026-02-22

### Fixed
- **Discord link correction**: Updated all Discord invite URLs to use permanent link https://discord.gg/WKA3TwYVuZ

---

## 0.1.28 — 2026-02-22

### Added
- **Footer emojis**: Added 💬 emoji before Discord link and ⭐ emoji before GitHub link for better visual appeal

---

## 0.1.27 — 2026-02-22

### Changed
- **Footer redesign**: All links now on one line with clickable text: "Join our Discord!" and "Read the docs on GitHub"
- **Improved UX**: Links use same clickable format as author name for consistent user experience

---

## 0.1.26 — 2026-02-22

### Changed
- **Footer improvements**: Replaced "Repository GitHub" with "GitHub", "love" with 💖 emoji, and simplified Discord text
- **README enhancement**: Added GitHub link section below Discord invite

---

## 0.1.25 — 2026-02-22

### Added
- **Discord community link**: Added Discord invite to README and TUI footer
- **Enhanced footer layout**: Improved footer with multi-line layout showing GitHub repo and Discord links
- **Clickable author name**: "vava-nessa" is now clickable in terminal (opens GitHub profile)
- **Release notes automation**: GitHub Actions now uses CHANGELOG.md content for release notes instead of auto-generated notes

### Changed
- **Tier filtering system**: Replaced E/D keys with T key that cycles through tier filters: all → S+/S → A+/A/A- → B+/B → C → all
- **Footer text**: "Made with love by vava-nessa" with clickable links

### Fixed
- **Release workflow**: GitHub Releases now display proper changelog content instead of generic commit summaries

---

## 0.1.24 — 2026-02-22

### Fixed
- **Viewport scrolling for TUI overflow**: Fixed Ghostty and narrow terminal issues where content would scroll past alternate screen
- **Terminal wrapping**: Wide rows now clip at terminal edge instead of wrapping to next line
- **Scrollback pollution**: Replaced `\x1b[2J` with `\x1b[H` + per-line `\x1b[K` to avoid Ghostty scrollback issues
- **Viewport calculation**: Added smart scrolling with "N more above/below" indicators when models exceed screen height
- **Scroll offset adjustment**: Cursor stays within visible window during navigation and terminal resize

### Changed
- **DECAWM off**: Disabled auto-wrap in alternate screen to prevent row height doubling
- **Terminal resize handling**: Viewport automatically adjusts when terminal size changes

---

## 0.1.23 — 2026-02-22

### Refactored
- **Removed startup menu**: No more blocking mode selection menu at startup
- **Default to OpenCode CLI**: App starts directly in CLI mode when no flags given
- **Mode toggle in TUI**: Added Z key to cycle between CLI → Desktop → OpenClaw → CLI
- **GitHub changelogs**: "Read Changelogs" option now opens GitHub URL instead of local file
- **Auto-update by default**: When new version available without flags, auto-updates and relaunches
- **Centered update menu**: Update notification appears only when needed, with clean centered layout

### Changed
- **Header display**: Shows `[💻 CLI] (Z to toggle)` with mode toggle hint
- **Footer instructions**: Added "M Mode" to key bindings
- **Update workflow**: Flags (`--opencode` etc.) still show update menu for compatibility

---

## 0.1.22 — 2026-02-22

### Changed
- **Local changelogs**: "Read Changelogs" menu option now opens local `CHANGELOG.md` file instead of GitHub releases

---

## 0.1.21 — 2026-02-22

### Refactored
- **Simplified tier filtering architecture**: Replaced complex object recreation with simple `hidden` flag system
- **Flags as shortcuts**: `--tier S` now just sets initial state instead of blocking dynamic filtering
- **Dynamic filtering preserved**: E/D keys work seamlessly even when starting with `--tier` flag

### Fixed
- **Ping loop bug**: Fixed issue where filtered models weren't pinged due to using wrong results array
- **Initial ping bug**: Fixed issue where initial ping used wrong results array

---

## 0.1.20 — 2026-02-22

### Added
- **Dynamic tier filtering**: Use E/D keys to filter models by tier during runtime
- Tier filter badge shown in header (e.g., `[Tier S]`)
- E key elevates filter (show fewer, higher-tier models)
- D key descends filter (show more, lower-tier models)
- Preserves ping history when changing filters

### Fixed
- **Error 401 with --tier flag**: Fixed issue where using `--tier` alone would show selection menu instead of proceeding directly to TUI
- Improved flag combination handling for better user experience

---

## 0.1.16

### Added
- OpenCode Desktop support: new `--opencode-desktop` flag and menu option to set model & open the Desktop app
- "Read Changelogs" menu option when an update is available (opens GitHub releases page)
- `startOpenCodeDesktop()` function — same config logic as CLI, launches via `open -a OpenCode`

### Changed
- Startup menu: "OpenCode" renamed to "OpenCode CLI", new "OpenCode Desktop" entry added
- TUI mode badge: shows `[💻 CLI]` or `[🖥 Desktop]` or `[🦞 OpenClaw]`
- Footer action hint adapts to desktop mode (`Enter→OpenDesktop`)

---

## 0.1.12 — 2026-02-22

### Added
- Unit test suite: 59 tests across 11 suites using `node:test` (zero dependencies)
- Tests cover: sources data integrity, core logic (getAvg, getVerdict, getUptime, filterByTier, sortResults, findBestModel), CLI arg parsing, package.json sanity
- `lib/utils.js`: extracted pure logic functions from the monolithic CLI for testability
- `pnpm test` script in package.json

### Fixed
- GitHub Actions release workflow: removed broken `npm version patch` loop, added version detection via git tags
- GitHub Actions now creates a GitHub Release with auto-generated notes for each new version

### Changed
- AGENTS.md updated with test-first workflow: agents must run `pnpm test` before `pnpm start`

---

## 0.1.9 — 2026-02-22

### Fixed
- **OpenCode spawn ENOENT**: Use `shell: true` when spawning `opencode` so the command resolves correctly on Windows (`.cmd`/`.bat` wrappers). Added friendly error message when `opencode` is not installed.
### Added
- Update available warning: red message shown above selection menu when a new npm version exists
- "Update now" menu choice in startup mode selection to install the latest version

---

## 0.1.4 — 2026-02-22

### Fixed
- **OpenClaw config structure**: `providers` was incorrectly written at the config root. Moved to `models.providers` per official OpenClaw docs (`docs.openclaw.ai/providers/nvidia`).
- **OpenClaw API key storage**: Removed `apiKey` from provider block (not a recognized field). API key is now stored under `env.NVIDIA_API_KEY` in the config.
- **OpenClaw models array**: Removed the `models: []` array from the provider block (OpenCode format, not valid in OpenClaw).
- **`openclaw restart` CLI command doesn't exist**: Replaced hint with correct commands — `openclaw models set` / `openclaw configure`. Gateway auto-reloads on config file changes.
- **OpenClaw model not allowed**: Model must be explicitly listed in `agents.defaults.models` allowlist — without this, OpenClaw rejects the model with "not allowed" even when set as primary.
- **README**: Updated OpenClaw integration section with correct JSON structure and correct CLI commands.

---

## 0.1.3 — 2026-02-22

### Added
- OpenClaw integration: set selected NIM model as default provider in `~/.openclaw/openclaw.json`
- Startup mode menu (no flags needed): interactive choice between OpenCode and OpenClaw at launch
- `--openclaw` flag: skip menu, go straight to OpenClaw mode
- `--tier` flag: filter models by tier letter (S, A, B, C)
- Tier badges shown next to model names in the TUI
- 44 models listed, ranked by Aider Polyglot benchmark

### Fixed
- CI permissions for git push in release workflow

---

## 0.1.2 — 2026-02-22

### Added
- `--fiable` flag: analyze 10 seconds, output the single most reliable model as `provider/model_id`
- `--best` flag: show only top-tier models (A+, S, S+)
- `--opencode` flag: explicit OpenCode mode
- Refactored CLI entry point, cleaner flag handling
- Updated release workflow

---

## 0.1.1 — 2026-02-21

### Added
- Continuous monitoring mode: re-pings all models every 2 seconds forever
- Rolling averages calculated from all successful pings since start
- Uptime percentage tracking per model
- Dynamic ping interval: W key to speed up, X key to slow down
- Sortable columns: R/T/O/M/P/A/S/V/U keys
- Verdict column with quality rating per model
- Interactive model selection with arrow keys + Enter
- OpenCode integration: auto-detects NIM setup, sets model as default, launches OpenCode
- `sources.js`: extensible architecture for adding new providers
- Demo GIF added to README
- Renamed CLI to `free-coding-models`

---

## 0.1.0 — 2026-02-21

### Added
- Initial release as `nimping` then renamed to `free-coding-models`
- Parallel pings of NVIDIA NIM coding models via native `fetch`
- Real-time terminal table with latency display
- Alternate screen buffer (no scrollback pollution)
- Top 3 fastest models highlighted with medals 🥇🥈🥉
- ASCII banner and clean UI
- OpenCode installer and interactive model selector
- npm publish workflow via GitHub Actions
