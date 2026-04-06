# Changelog
---

## [0.3.35] - 2026-04-07

### Added
- **Web Dashboard / GUI Mode** — Launch a premium graphical interface using \`--web\` or \`--gui\` flag.
- **Glassmorphism Design** — Real-time ping visualization, 🥇🥈🥉 medals, live stability scores, and sparklines.
- **Background SSE Streaming** — The built-in Node.js server streams live data to the browser with zero dependencies.
- **Quick Search & Filters** — Sort by any column, filter by tiers, or use the real-time search box (Ctrl+K).
- **Detail Panel** — Slide-out side panel showing P95 latency, jitter (σ), and historical trends.

## [0.3.34] - 2026-04-06

### Added
- **Chutes AI** — new decentralized free provider (4 models: DeepSeek R1, Llama 3.1 70B, Qwen 2.5 72B, Qwen2.5 Coder 32B)
- **Google Gemini 3.1 Pro** — replaced dead Gemini 3 Pro (shut down March 9)
- **Google Gemma 4 family** — Gemma 4 31B, Gemma 4 26B MoE, Gemma 4 E4B added to Google AI Studio
- **Qwen3.6 Plus** and **Qwen3.5 Plus** added to Alibaba DashScope
- **NVIDIA NIM: Kimi K2 Instruct 0905** added
- **SambaNova: Qwen3-235B-A22B-Instruct-2507** added
- **OpenRouter: ~10 new free models** (arcee trinity, mimo-v2-flash, etc.) — 25 total
- **Together AI: expanded to 19 free models** (DeepSeek V3.2, MiniMax M2.1, etc.)
- **Cloudflare: 4 new models** (gemma-4-26b, mistral-small-3.1, qwq-32b, granite-4.0) — 15 total
- **Scaleway: gpt-oss-120b and holo2-30b-a3b** added
- **Hyperbolic: gpt-oss-20b and Qwen3-235B-Instruct-2507** added
- **Rovo: GPT-5.2, GPT-5.2-Codex, Claude Haiku 4.5** added
- **OpenCode Zen: mimo-v2-pro-free, mimo-v2-omni-free** added; fixed context windows (gpt-5-nano: 128k→400k, nemotron-3-super-free: 128k→1M)

### Changed
- **Groq scout model renamed** — `llama-4-scout-17b-16e-preview` → `llama-4-scout-17b-16e-instruct`
- **Now 230 models across 24 providers** (was 174/23)
- **README provider table fully updated** with accurate per-provider counts

### Fixed
- Removed 3 deprecated Cerebras models (llama3.3-70b, qwen-3-32b, llama-4-scout-17b-16e-instruct) — 4 remain
- Fixed missing comma in googleai array causing undefined model entry
- Replaced all `??%` placeholder SWE scores with reasonable estimates

## [0.3.33] - 2026-04-01

### Changed
- **X badge darker fuchsia background** (`rgb(140,0,80)`) for better readability
- **Updated text** → "Follow me on X: @vavanessadev to check my other projects! 💖"

## [0.3.32] - 2026-04-01

### Fixed
- **Corrected X/Twitter username to @vavanessadev** — link and display text now point to the right profile

### Changed
- **X support badge now on fuchsia background** — bold white-on-fuchsia with yellow username, impossible to miss
- **Discord moved to the very bottom line** of the TUI footer
- **X follow link added to top of README**

## [0.3.31] - 2026-04-01

### Changed
- **Footer layout reorganized** — Discord link moved to the very bottom line of the TUI for better visibility
- **X/Twitter support message** — added 🐦 "Support me on X: @vavanessadev 💖" with clickable link in the last release footer line

## [0.3.29] - 2026-03-27

### Added
- **Fluorescent green UPDATE AVAILABLE banner** — impossible-to-miss fluo green (🚀⬆️) banner at the bottom of the TUI when a new version is detected; click it to update instantly
- **Command Palette update entry** — `⬆️ UPDATE NOW` is always the first result in Ctrl+P when an update is available
- **Shift+U hotkey** — press Shift+U from the main table to trigger an immediate update
- **Mouse-clickable update banner** — click the fluo green banner to install the latest version and relaunch
- **Background version re-check every 5 minutes** — if a new version is published while the TUI is open, the banner appears live without restarting
- **Aggressive pre-TUI update prompt** — fluorescent green header, and "Continue without update" warns that reminders will follow
- **Last release date in footer** — light pink `Last release: Mar 27, 2026, 09:42 PM` shows when the package was last published to npm, so users know how fresh the model data is
- **Demo2 GIF** — added `demo2.gif` to README for visual showcase of the TUI

### Fixed
- **Auto-update now detects the correct package manager** — bun, pnpm, and yarn users no longer get duplicate npm installs (fixes #46)
- Update banner in footer shows the correct install command for your package manager

## [0.3.28] - 2026-03-27

_(Skipped — published as 0.3.28 without changelog in commit message, all changes are in 0.3.29)_

## [0.3.27] - 2026-03-27

## [0.3.26] - 2026-03-27

### Added
- **Groq**: Added Compound + Compound Mini; fixed Llama 4 Scout context (10M)
- **OpenRouter**: Added MiniMax M2.5, Nemotron 3 Super, Hermes 3 405B, Gemma 3n E4B
- **HuggingFace**: Replaced invalid DeepSeek-V3-Coder + outdated starcoder2-15b with DeepSeek V3 0324 + Qwen2.5 Coder 32B
- **Replicate**: Replaced CodeLlama 70B (2023) with DeepSeek V3 0324 + Llama 3.3 70B
- **Cloudflare**: Added Kimi K2.5, GLM-4.7-Flash, Llama 4 Scout, Nemotron 3 Super, Qwen3 30B MoE
- **Scaleway**: Added Qwen3.5 400B VLM + Mistral Large 675B
- **DeepInfra**: Replaced Mixtral Code with Nemotron 3 Super + DeepSeek V3 0324 + Qwen3 235B
- **Fireworks**: Added Llama 4 Maverick + Qwen3 235B
- **Hyperbolic**: Added Qwen3 80B Thinking variant
- **Together AI**: Added Qwen3.5 400B VLM, MiniMax M2.5, GLM-5

### Changed
- **Rovo Dev CLI**: Updated Sonnet 4 → Sonnet 4.6, added Opus 4.6
- **Groq**: Removed 4 deprecated models (R1 Distill 70B, QwQ 32B, Kimi K2, Maverick)
- **OpenRouter**: Updated context sizes for multiple models

## [0.3.25] - 2026-03-19

### Added
- **Installed Models Manager** — View, launch, and disable models configured in external tools (Goose, Crush, Aider, Qwen, Pi, OpenHands, Amp)
  - Access via Command Palette (Ctrl+P) → "Installed models"
  - Scans all supported tool configs automatically on opening
  - Displays all models per tool (e.g., Crush shows both large and small models)
  - Actions: Launch (Enter), Disable (D) with backup, Reinstall (R)
  - Soft delete: Comments out model entries and saves backups to ~/.free-coding-models-backups.json
- **Full mouse support for the TUI** — Click, right-click, double-click, and scroll work throughout the interface
  - **Click column headers** — Sort by any column (click Rank, Tier, SWE%, CTX, Model, Provider, etc.)
  - **Click model rows** — Move cursor to any model (left-click)
  - **Right-click model rows** — Toggle favorite (same as F key)
  - **Double-click model rows** — Select model and launch (same as Enter)
  - **Mouse wheel** — Scroll through the main table, overlays (Settings, Help, Changelog), and command palette results
  - **Click CLI Tools header** — Cycle through tool modes (same as Z key)
  - **Click Tier header** — Cycle through tier filters (same as T key)
  - **Click footer hotkeys** — Trigger any visible hotkey from the footer
  - **Command palette click** — Click inside to select items, double-click to confirm; click outside to close
  - **Recommend questionnaire click** — Click on option rows to select, double-click to confirm
- **Mouse unit tests** — 46 new tests covering SGR sequence parsing, double-click detection, modifiers, and COLUMN_SORT_MAP validation

### Changed
- **CLI Tools column redesigned** — Renamed from "Compatible with" to "CLI Tools", with left-aligned emoji display (compatible tools packed left instead of fixed slot positions)
- **Sort arrow overflow fixed** — SWE%, CTX, Stability, and Uptime columns now properly fit within their widths when sorted (arrow now `↑SWE%` instead of `↑ SWE%`)
- **Mouse sequence suppression** — SGR mouse sequences no longer leak into keypress handlers (prevents spurious sort/filter triggers when clicking)

### Fixed
- **Command palette scroll leak** — Mouse wheel no longer injects raw SGR sequence bytes into the command palette text input
- **Double-action on model click** — Clicking a model row now only moves the cursor; it no longer simultaneously triggers column sorting
- **Mouse event listener order** — Fixed race condition where readline emitted keypress events before mouse data was processed

## [0.3.24] - 2026-03-19

### Added
- **Unique emoji per tool** — Every CLI tool now has a dedicated emoji shown in the Compatible column, Z-cycle badge, command palette, help overlay, and README (📦 OpenCode, 🦞 OpenClaw, 💘 Crush, 🪿 Goose, π Pi, 🛠 Aider, 🐉 Qwen, 🤲 OpenHands, ⚡ Amp, 🦘 Rovo, ♊ Gemini)
- **Merged compat column** — OpenCode CLI and Desktop share 📦 in a single slot (11 slots instead of 12 separate initials)
- **COMPAT_COLUMN_SLOTS** — New export in tool-metadata.js for merged compatible-column rendering
- **Width warning now always shows** - Terminal width warning displays every time terminal is resized below 80 columns (previously limited to 2 shows per session)
- **Gemini CLI integration** - New CLI-only tool provider with 3 models (Gemini 3 Pro 🆕, Gemini 2.5 Pro, Gemini 2.5 Flash)
- **Rovo Dev CLI integration** - New CLI-only tool provider with Claude Sonnet 4 🆕
- **Tool compatibility alerts** - When trying to launch Rovo/Gemini models with wrong tool, shows alert and offers to switch
- **Auto-install detection** - Prompt to install CLI tools when binary not found (Rovo/Gemini)
- **OpenAI-compatible API support for Gemini** - Gemini CLI can use custom providers via environment variables
- **New CLI flags** - Added `--rovo` and `--gemini` launch options
- **"🆕" badges** - Mark newly added models in the table (Claude Sonnet 4, Gemini 3 Pro)
- **OpenCode Zen free models** - 5 new free models (Big Pickle, GPT 5 Nano, MiMo V2 Flash Free, MiniMax M2.5 Free, Nemotron 3 Super Free) exclusive to OpenCode CLI/Desktop via `opencode-zen` provider
- **"Compatible with" column** - New TUI column showing colored emojis for each tool a model supports; incompatible tools show dim spaces
- **Tool color system** - Each of the 12 supported tools now has a unique RGB color and emoji used in the Z-cycle badge and compatibility column
- **Incompatible model highlighting** - When a tool mode is active (via Z), models that can't run with that tool get a dark red background for instant visibility — they stay in their normal sorted position (not pushed to the bottom)
- **Tool compatibility functions** - `getCompatibleTools()` and `isModelCompatibleWithTool()` in tool-metadata.js for programmatic compatibility checks
- **Incompatible model fallback overlay** - When pressing Enter on a model that can't run on the active tool (red-highlighted row), an in-TUI overlay appears with two options: (1) switch to a compatible tool, or (2) pick a similar model by SWE score that works with the current tool
- **findSimilarCompatibleModels()** - New function in tool-metadata.js that finds models with closest SWE scores compatible with the active tool
- **Updated provider/model counts** - Now 23 providers with 171 models (was 20/160)

### Changed
- **Z key cycle** - Rovo and Gemini added to tool mode cycle (last in order)
- **Tool metadata** - Removed `initial` field (replaced by emojis), added `cliOnly` flag for CLI-only tools, `emoji` and `color` properties for all 12 tools
- **Provider metadata** - Added Rovo, Gemini, and OpenCode Zen provider information
- **Responsive column hiding** - Compatible column hides first (before Rank) on narrow terminals
- **Key handler** - Zen models auto-switch to OpenCode CLI on launch; API key warnings skip Zen models
- **Documentation** - Updated README with CLI-only tools section, Zen models, compatibility matrix

### Fixed
- **Missing import error** - Fixed `getToolMeta` not defined in key-handler.js
- **CLI-only tools API key requirement** - Gemini CLI and Rovo Dev CLI no longer require API keys to be configured before launching; these tools manage their own authentication

## 0.3.23

### Added
- **Favorites display mode (`Y`)**: Added a global toggle to switch favorites between `pinned + always visible` and `normal rows` (starred only, fully obeying active filters/sort).
- **Favorites mode row in Settings**: Added a dedicated Settings row to inspect/toggle favorites display behavior without leaving the maintenance screen.
- **Expanded command palette action menus**: Added nested menus for Ping Mode (speed/normal/slow/forced with explanations), Target Tool (all supported tools with explanations), and Favorites Mode (including the new `Y` flow).
- **Active text-filter footer alert**: When a custom search filter is active (for example `deep`), the last TUI footer line now shows a high-visibility inline badge (between `N Changelog` and `Ctrl+C Exit`) with the exact query and an `X` shortcut to clear it instantly.

### Changed
- **Favorites sorting/filtering behavior**: Sort/filter logic now respects the selected favorites mode across the table refresh loop, hotkeys, and renderer so non-pinned mode behaves consistently everywhere.
- **Favorites default mode**: New/legacy configs now default to `Normal filter/sort` favorites mode (not pinned) until users press `Y` to opt into pinned+sticky behavior.
- **Footer/help/docs shortcut hints**: Surfaced `Y` in the TUI footer, Help overlay, and README so the new favorites mode is discoverable.

## 0.3.22

### Added
- **Hierarchical command palette navigation**: Ctrl+P now opens an improved command palette with expandable/collapsible categories and subcategories for better organization.
- **Arrow key navigation in command palette**: Use left/right arrows to expand and collapse categories, up/down to navigate, Enter to execute or toggle.
- **Rich color scheme for command palette**: Categories use bold blue headers, subcategories use bold text, commands show keyboard shortcuts.
- **Visual expand/collapse indicators**: ▼ shows expanded categories, ▶ shows collapsed, • marks individual commands.
- **Concise default view**: Categories are collapsed by default (except Filters) showing less detail on first open.
- **Colored tier filters**: Tier filters (S+, S, A+, A, A-, B+, B, C) now display with their corresponding TUI colors for quick identification.
- **Specific provider filters**: Added 13 individual provider filters (NVIDIA NIM, Groq, Cerebras, SambaNova, OpenRouter, Together AI, DeepInfra, Fireworks, Hyperbolic, Google AI, Hugging Face) with their signature provider colors.
- **Filter by model category**: New "Filter by model" category with autocomplete that dynamically shows top 20 visible models, complete with provider icons and colored model names.
- **Improved search cursor**: Cursor placement fixed to appear right after the `>` prompt instead of after placeholder text for natural typing flow.
- **Lightning bolt in title**: Command Palette title now shows ⚡ emoji for better visibility and visual appeal.

### Changed
- **Footer layout cleanup**: Added consistent spacing before `F Toggle Favorite`, moved `N Changelog • Ctrl+C Exit` to a dedicated final footer line for better readability.
- **Removed Y key binding**: Install Endpoints is no longer a direct hotkey — accessible only via Settings (`P`) or Command Palette (`Ctrl+P`). The `Y` key is now free/unbound.
- **Removed proxy notice from footer**: The "Proxy is temporarily disabled" banner has been fully retired from the TUI footer and its backing constant removed.
- **Command palette fuzzy search fix**: `buildCommandPaletteEntries()` now expands all categories so child commands are visible to fuzzy search.
- **Flat Pages + Actions in ⚡️ Command Palette**: page entries and action entries are now listed directly at root level (no extra submenu depth) for faster access.
- **Command explanations after shortcuts**: command palette rows now show concise English hints after hotkeys (example: `(Z) — Change target AI Coding CLI Tool.`).
- **⚡️ emoji consistency**: user-facing Command Palette mentions now consistently render as `⚡️ Command Palette` in TUI and docs.
- **README Quick Start flow**: install section now explicitly adds “create a free account on one of the providers” with a direct anchor link.
- **Provider section renamed for clarity**: Quick Start provider table now lives under `List of Free AI Providers`.
- **Quick Start CTA highlight**: added a large green `USE ⚡️ COMMAND PALETTE / CTRL+P` badge right after the command palette instruction.

### Fixed
- **Double emoji display bug**: Fixed duplicate emoji icons in command palette entries (was showing `▶ 🔍 🔍 Filters` instead of `▶ 🔍 Filters`).
- **Provider cycle command behavior**: `Cycle provider` in ⚡️ Command Palette now correctly cycles providers again instead of resetting to `All`.

## 0.3.21

### Changed
- **Responsive table layout**: the TUI now adapts to narrow terminals by progressively shrinking columns and hiding least-useful ones. Compact mode shortens headers (`Lat. P`, `Avg. P`, `StaB.`, `PrOD…`) and tightens Provider (10 cols), Health (13 cols), Latest Ping (10 cols), and Avg Ping (8 cols). Below compact, Rank → Up% → Tier → Stability are hidden one by one. Minimum usable width: ~116 cols.
- **SWE% column tightened**: reduced from 9 to 6 columns wide — trims excess right padding without losing data.
- **Provider truncation in compact mode**: provider names longer than 5 chars are truncated to 4 chars + `…` (e.g. `Cere…`).
- **Health truncation in compact mode**: status text longer than 6 chars is truncated with `…` (e.g. `🔥 429 TR…`).
- **Removed "Used" column from TUI**: the token usage column has been removed from the main table as it was outdated.
- **Width guardrail threshold tightened**: the narrow-terminal warning now triggers only below 80 columns (instead of broader widths) and keeps the same 2-second auto-hide behavior.
- **Width warning is always enforced in narrow terminals**: removed the `Small Width Warnings` Settings toggle and the `--disable-widths-warning` runtime flag so the startup guardrail stays consistent.

### Fixed
- **`--premium` filter lock-in**: premium now applies a resettable startup preset (S-tier + verdict sort) instead of hard-locking an extra hidden elite-only filter.

## 0.3.19

### Added
- **Command palette overlay (`Ctrl+P`)**: Added a searchable floating palette with fuzzy matching so users can quickly run filters, sorts, overlays, and global actions.

### Changed
- **Main footer and help discoverability**: surfaced `Ctrl+P` in table hints and Help overlay so the new command launcher is visible immediately.
- **Command palette spacing polish**: added two-character inner padding around the floating palette so the overlay feels less cramped and visually cleaner.

### Fixed
- **Command palette visual jitter**: background ping cycles now pause while the command palette is open so table rows stop reshuffling during command search.
- **Command palette background freeze**: while the palette is open, the full table behind it is now frozen (spinner glyphs, ping countdown, and dynamic row updates) and resumes instantly on close.

## 0.3.18

### Added
- **Missing tool bootstrap flow**: FCM now detects when a target CLI is absent, offers a minimal in-TUI install confirmation, runs the official global install command, then resumes the selected model launch automatically.

### Changed
- **TUI readability overhaul across every screen**: the main table, Settings, Help, Smart Recommend, Feedback, and Changelog overlays now share a semantic high-contrast theme system instead of a patchwork of hardcoded colors.
- **Global theme switching now works for real**: press `G` to cycle `auto → dark → light` live, and the Settings screen now exposes a visible `Global Theme` row for the same control.
- **Launcher binary resolution**: direct tool launches now search PATH plus common user bin directories so a freshly installed CLI can be reused immediately in the same FCM session.

### Fixed
- **Theme repaint bugs**: provider colors, tier colors, separators, badges, cursor highlights, and overlay backgrounds now update immediately when the theme changes instead of keeping stale import-time colors.

## 0.3.17

### Added
- **Auto Light/Dark Theme**: Implemented automatic detection of the user's terminal theme (dark or light) so that the TUI is always readable. Added semantic color tokens, and users can override the theme as `dark`, `light`, or `auto` via the Settings interface.

## 0.3.16

### Added
- **iFlow free coding models**: Added the iFlow provider to the README and TUI, supporting `deepseek-v3`, `mini-max-m2.5`, etc.

## 0.3.15

### Added
- **GLM-4.7-Flash and GLM-4.5-Flash models**: Added ZAI's free coding models GLM-4.7-Flash and GLM-4.5-Flash to the ZAI provider. Both models are rated S tier with 59.2% SWE-bench scores and are completely free with unlimited API access.

### Changed
- Added vertical column separators (gentle dark orange) for clearer column separation and removed the horizontal separator line in the main TUI.

## 0.3.14

### Changed
- **Massive TUI Controller Extraction:** Extracted the main UI event loop and state machine out of `bin/free-coding-models.js` into a dedicated `src/app.js` controller. This cuts the main executable size drastically and makes the TUI architecture more modular and testable.
- **Robust Error Boundaries:** Wrapped all critical asynchronous operations, keypress handlers, UI render timers, and polling cycles with comprehensive `try/catch` blocks. Instead of the TUI crashing and destroying the terminal scrollback on unexpected errors, it will now gracefully exit the alternate screen buffer, print a formatted stack trace, and point users to the GitHub issue tracker and feedback form.
- **Global Crash Resiliency:** Added `uncaughtException` and `unhandledRejection` listeners at the entry point to guarantee terminal restoration even if a library fails catastrophically.

## 0.3.13

### Fixed
- **Small Width Warnings toggle actually works again**: the Settings row now shows `Small Width Warnings` with clear enabled/disabled status, the startup overlay reacts immediately to the toggle, and the narrow-terminal warning now auto-hides after 2 seconds instead of 4.

## 0.3.12

> **Proxy / bridge update:** the current legacy proxy stack is now officially discontinued while we rebuild that whole layer from zero. This cleanup is intentional: Claude Code support, a smarter router, and a much more reliable external-tools bridge are being reworked as a separate, cleaner system and will come back in a future release. In the meantime, FCM has been cleaned up and narrowed to the stable direct-launch surface so the app stays solid for day-to-day usage.

### Added
- **Legacy proxy cleanup action**: Settings now includes a one-shot cleanup that removes discontinued proxy leftovers from older installs and explains that a more stable replacement is in progress.

### Changed
- **Stable direct-launch surface**: The app now documents and exposes only the supported direct-provider launcher workflow while the old bridge is rebuilt.
- **README reset**: Rewrote the documentation to match the real product surface, current tools, and current test commands.
- **Footer transparency**: The main TUI now shows an explicit magenta notice that the old proxy is disabled while the replacement bridge is being rebuilt.

### Fixed
- **Selected model now really becomes the launched tool default**: external tool launch prep now writes the chosen model into each tool config before spawn, and OpenClaw no longer hardcodes `nvidia/*` when another provider was selected.

### Removed
- **Global proxy stack**: Deleted the old proxy runtime, daemon flow, request-log flow, and related orphaned helpers/tests.
- **Hidden launcher bridges**: Claude Code, Codex, and Gemini are no longer exposed in the app while their integrations are being rewritten.

## 0.3.11

### Fixed
- Added early 404 response when a requested model has no registered accounts, ensuring clear error handling.

### Removed
- **Profile system**: Entire profile system removed to ensure API keys persist permanently across all sessions. No more profile switching causing API key loss.

### Added
- **`--proxy` foreground mode**: New `--proxy` flag starts FCM Proxy V2 in the current terminal with a live dashboard showing status, accounts, provider breakdown, and real-time request log. No daemon install needed — works from dev checkout too.

### Fixed
- **Claude Code proxy auth**: Proxy now accepts `x-api-key` header (used by Anthropic SDK / Claude Code) in addition to `Authorization: Bearer`
- **Claude model fallback**: When `anthropicRouting` is all null, Claude model names now fall back to the first available account instead of returning "Model not found"
- **Proxy sync for Claude Code**: Added `claude-code` to `PROXY_SYNCABLE_TOOLS` so the env file is properly written/updated by proxy sync
- **Correct env var name**: Claude Code env file now exports `ANTHROPIC_API_KEY` (SDK standard) instead of `ANTHROPIC_AUTH_TOKEN`
- **Auto-source shell profile**: Claude Code env file is now automatically sourced in `.zshrc` / `.bashrc` / `.bash_profile`
- **Removed deleted profile functions from tests**: Cleaned up test imports after profile system removal from config.js

---

## 0.3.9

### Improved
- **Enhanced `--premium` flag**: Now applies strict elite-only constraints. Shows only **S/S+** tier models with perfect health (**UP**) and a good verdict (**Perfect**, **Normal**, or **Slow**). Models with 429 errors, auth failures, or poor performance are automatically hidden.
- **Accurate Token Usage Tracking**: The "Used" column now uses the persistent `token-stats.json` file as the source of truth, providing accurate historical totals instead of only the most recent logs.
- **Enhanced Log Transparency**: The request log page now always shows the requested model and the actual upstream model (e.g., `llama-3.1-405b → meta/llama-3.1-405b-instruct`) whenever they differ.
- **Pretty Provider Labels**: The request log page now uses human-readable provider labels (e.g., "NVIDIA NIM", "SambaNova") instead of raw internal keys.
- **Fixed Tier Filtering Family Logic**: Updated `--tier S` behavior to correctly include both **S** and **S+** models (matching documentation).

---

## 0.3.6

### Added
- **AI `/testfcm` workflow**: Added a repo-local PTY runner, workflow doc, slash-command prompts, and artifact/report directories so an agent can drive the real TUI, launch a tool, send `hi`, and write a Markdown bug report with evidence.
- **Mock tool verification path**: Added a tiny fake `crush` binary plus `test:fcm:mock` so maintainers can validate the TUI → launcher → prompt plumbing even when a real coding tool is not installed locally.

### Fixed
- **`--json` startup crash**: JSON mode now reuses the same provider-aware ping function as the TUI without crashing on `pingModel is not a function`.
- **Managed endpoint installs no longer resurrect stale disk entries**: install/refresh saves now replace the tracked `endpointInstalls` snapshot so old provider-tool records from another config state do not leak back into the current catalog set.
- **Favorites persistence is now much harder to break**: favorite toggles now reload the latest disk config before saving, keep the active profile snapshot in sync, and use atomic config writes so pinned rows no longer disappear after unrelated saves or updates.
- **API key saves no longer clobber the rest of the config**: editing one provider now persists only that provider against the latest on-disk snapshot, preserves rotated extra keys, and stops stale config writes from wiping other saved keys.
- **Configured Only no longer hides favorites**: starred rows now stay visible and pinned at the top even when the provider has no currently configured key.

## 0.3.5

### Fixed
- **Claude Code beta-route compatibility**: FCM Proxy V2 now matches routes on the URL pathname, so Anthropic requests like `/v1/messages?beta=true` and `/v1/messages/count_tokens?beta=true` resolve correctly instead of failing with a fake “selected model may not exist” error.
- **Claude proxy parity with `free-claude-code`**: The Claude integration was revalidated against the real `claude` binary, and the proxy-side Claude alias mapping now reaches the upstream provider again in the exact `free-claude-code` style flow.

## 0.3.4

### Added
- **Proxy root landing JSON**: `GET /` on FCM Proxy V2 now returns a small unauthenticated status payload, so browser checks no longer fail with `{"error":"Unauthorized"}`.
- **`daemon stop` CLI command**: The public CLI now supports `free-coding-models daemon stop`, matching the existing daemon manager capability and the documented workflow.

### Fixed
- **README/UI parity restored**: The docs now match the current product surface, including `160` models, the `Used` token-history column, and the current launcher/proxy behavior.
- **Malformed config sections are normalized on load**: Invalid `apiKeys`, `providers`, or `settings` values are now coerced back to safe empty objects instead of leaking broken runtime shapes into the app.

## 0.3.3

### Fixed
- **Claude Code now uses the real `free-claude-code` proxy contract**: FCM stopped injecting proxy slugs into `claude --model` / `ANTHROPIC_MODEL` and now launches Claude Code with only `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`.
- **Claude routing is now proxy-side `MODEL` / `MODEL_*` mapping**: The selected FCM model is persisted into the proxy's Anthropic routing config and hot-reloaded by the daemon, so fake Claude model ids resolve to the chosen free backend exactly like `free-claude-code`.
- **Claude launch now forces a real Claude alias**: FCM starts Claude Code with `--model sonnet`, which overrides stale broken local selections like `gpt-oss-120b` that Claude rejects before the proxy is even contacted.
- **Claude proxy sync leftovers were removed**: Claude Code is no longer treated as a persisted proxy-sync target, avoiding stale `ANTHROPIC_MODEL=<fcm-slug>` env files that broke the integration.

### Added
- **Terminal width warning progress bar and toggle**: Added visual progress bar to the terminal width warning overlay and a Settings toggle “Disable Widths Warning” to permanently suppress it.
- **Config setting `disableWidthsWarning`**: New boolean setting stored in profile and global config, default false.

## 0.3.2

### Fixed
- **Claude Code model-family routing now mirrors `free-claude-code`**: The proxy remaps Claude's internal model ids like `claude-3-5-sonnet-*`, `claude-3-haiku-*`, `claude-3-opus-*`, `sonnet`, `haiku`, and `default` back to the selected FCM proxy model instead of rejecting them as missing.
- **Claude Code helper/background requests stay on the selected model**: Launches now pin the Anthropic helper model env vars and encode the selected proxy model inside `ANTHROPIC_AUTH_TOKEN`, so Claude Code has a stable fallback even when it emits internal aliases.

## 0.3.1

### Added
- **CLI `--help` output**: `free-coding-models --help` now prints the full launcher, analysis, config, and daemon command matrix in a non-interactive format.

### Fixed
- **Outdated-version footer alert**: The main TUI now shows a full-width red footer line with manual `npm install -g free-coding-models@latest` recovery instructions, but only when a newer npm version is actually known.
- **Claude Code proxy auth conflict**: Proxy launches now sanitize inherited env vars and use only `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL`, matching the `free-claude-code` contract instead of mixing Anthropic auth modes.
- **Codex CLI proxy routing**: Codex launches now force an explicit custom provider config and the proxy now supports `POST /v1/responses`, so `codex-cli 0.114.0` no longer depends on the broken built-in OAuth/base-url path.
- **Anthropic token counting**: Added `POST /v1/messages/count_tokens` with a fast local estimate so Claude-compatible clients keep their budgeting flow through FCM Proxy V2.
- **Gemini proxy failure mode**: Gemini launch now preflights the installed CLI/config, blocks incompatible builds like `0.33.0`, and surfaces `~/.gemini/settings.json` schema errors instead of pretending proxy mode works.

### Changed
- **Proxy auto-sync now follows the current tool**: The proxy overlay no longer asks for a separate active tool; cleanup and auto-sync now target the current `Z` mode whenever that tool supports persisted proxy config.
- **Install Endpoints (`Y`) is narrower on purpose**: `Claude Code`, `Codex`, and `Gemini` were removed from the install-target menu so the flow only lists tools with a stable persisted-config contract.
- **Proxy model listing is more Codex-friendly**: `GET /v1/models` now returns both the usual OpenAI `data` array and a `models` array with `slug` fields for clients that expect a richer catalog shape.
- **Launcher diagnostics now mention the beta state clearly**: Proxy-backed external tools now remind users that the integration is still stabilizing when a launch is blocked.

## 0.3.0

### Added
- **Always-on background proxy service**: FCM Proxy V2 can run as a persistent background service via `launchd` (macOS) or `systemd` (Linux). All tools get free model access 24/7 — no need to keep the TUI open.
- **Anthropic wire format translation**: Native bidirectional translation between Anthropic Messages API (`POST /v1/messages`) and OpenAI Chat Completions. Claude Code works natively through FCM Proxy V2.
- **Dedicated FCM Proxy V2 overlay**: New full-page overlay (from Settings → "FCM Proxy V2 settings →" or `J` key) with proxy config, service status, restart, stop, force-kill, and log viewer.
- **`J` key — FCM Proxy V2 shortcut**: Opens the proxy settings directly from the main view. Footer shows a green `📡 FCM Proxy V2 On` badge when active, red `📡 FCM Proxy V2 Off` when disabled.
- **CLI daemon subcommand**: `free-coding-models daemon [status|install|uninstall|restart|stop|logs]` for headless service control.
- **Stable proxy identity**: Persistent token and preferred port (`18045`) survive daemon restarts — env files and tool configs remain valid across reboots.
- **Health endpoint**: `GET /v1/health` returns uptime, version, and account/model counts for liveness probes.
- **`GET /v1/stats` endpoint**: Authenticated endpoint returning per-account health, token stats, totals, and proxy uptime for monitoring and debugging.
- **Hot-reload**: FCM Proxy V2 watches `~/.free-coding-models.json` and reloads proxy topology automatically when config changes.
- **Version mismatch detection**: The overlay warns when the running service version differs from the installed FCM version.
- **Dev environment guard**: `installDaemon()` is blocked when running from a git checkout to prevent hardcoding local repo paths in OS service files.
- **Generalized proxy sync module** (`src/proxy-sync.js`): Single-endpoint proxy config sync for 12 tools (OpenCode, OpenClaw, Crush, Goose, Pi, Aider, Amp, Qwen, Claude Code, Codex, OpenHands). Writes one `fcm-proxy` provider with all models, cleans up old per-provider `fcm-*` vestiges.
- **Retry backoff with jitter**: Progressive delays between retries (0ms, 300ms, 800ms + random jitter) to avoid re-hitting the same rate-limit window on 429s.
- **Automatic account cooldown on consecutive failures**: When an account accumulates 3+ consecutive non-429 failures, it enters graduated cooldown (30s → 60s → 120s). Proxy routes around failing accounts automatically. Resets on success.

### Changed
- **Rebranded to FCM Proxy V2**: All user-facing references to "daemon", "FCM Proxy", and "Proxy & Daemon" renamed to "FCM Proxy V2" across CLI messages, TUI overlays, endpoint installer, and service descriptions.
- **Proxy overlay generalized for all tools**: "Persist proxy in OpenCode" → "Auto-sync proxy to {tool}", "Clean OpenCode proxy config" → "Clean {tool} proxy config". New "Active tool" selector row cycles through all 12 proxy-syncable tools.
- **Feedback overlay redesigned**: Renamed "Report bug" to "Feedback, bugs & requests", input is now left-aligned with a visible cursor, framed by horizontal separator lines. `I` key now covers all feedback types.
- **Proxy settings moved to dedicated overlay**: The 5 proxy rows in Settings are replaced by a single entry that opens a full-page manager.
- **Proxy topology extracted to shared module**: `src/proxy-topology.js` is now used by both TUI and daemon, eliminating code duplication.
- **TUI delegates to background service**: `ensureProxyRunning()` checks for a running service first and reuses its port/token instead of starting an in-process proxy.
- **Endpoint installer supports proxy mode**: When installing endpoints (Y key) with "FCM Proxy V2" connection mode, env files point to the service's stable token/port.
- **Claude Code / Codex / Gemini require proxy**: These tools now refuse to launch without FCM Proxy V2 enabled, showing clear instructions to enable it. When proxy is on, they route through it automatically.
- **Goose launcher rewritten**: Now writes proper custom provider JSON + updates `config.yaml` with `GOOSE_PROVIDER`/`GOOSE_MODEL` for guaranteed auto-selection (replaces obsolete `OPENAI_HOST`/`OPENAI_MODEL` env vars).
- **Crush launcher improved**: Removed `disable_default_providers` flag, sets both `models.large` and `models.small` defaults for reliable auto-selection.
- **Pi launcher improved**: Now passes `--provider` and `--model` CLI flags for guaranteed model pre-selection.

### Fixed
- **Terminal width warning behavior**: Warning now shows max 2 times per session with emojis and double spacing.
- **Body size limit** (security): `readBody()` now enforces a 10 MB limit. Oversized payloads receive 413.
- **Stack trace leak prevention** (security): Error responses no longer include `err.message`.
- **SSE buffer overflow guard** (security): Anthropic SSE transformer limits buffer to 1 MB.
- **`new URL()` crash protection**: Malformed upstream URLs caught instead of crashing.
- **`execSync` timeout safety**: All `execSync` calls in daemon-manager use a 15-second timeout via `execSyncSafe()`.
- **Daemon startup crash protection**: `loadConfig()`, `buildMergedModelsForDaemon()`, and `buildProxyTopologyFromConfig()` wrapped in try/catch.
- **`resolveCloudflareUrl()` null guard**: Empty provider URLs skipped instead of crashing.
- **Health check buffer limit**: Responses capped at 64 KB.
- **SSE line buffering**: SSE tap now correctly handles lines split across chunk boundaries.
- **Empty choices fallback**: `translateOpenAIToAnthropic` returns fallback content block when OpenAI response has empty choices.
- **Tool calls streaming index tracking**: Proper `nextBlockIndex`/`currentBlockIndex` counters for correct indexing across multiple tool calls.
- **Pipe error propagation**: Error handlers on both sides of SSE pipes to prevent uncaught errors on mid-stream disconnects.
- **Input validation**: `translateAnthropicToOpenAI` guards against null/undefined/non-object input.
- **Hot-reload race condition**: Config watcher uses `reloadInProgress` flag to prevent concurrent reloads.
- **Fake response stubs**: Added `destroy()`, `removeListener()`, and `socket: null` for better compatibility.
- **API key trimming**: Whitespace-trimmed and empty keys filtered out in topology builder.
- **`writeFileSync` error messages**: Plist and systemd service file write failures now throw clear error messages.

---

## 0.2.17

### Added
- **All coding tools re-enabled in Z-cycle**: Aider, Claude Code, Codex CLI, Gemini CLI, Qwen Code, OpenHands, and Amp are now back in the public tool mode cycle alongside OpenCode, OpenClaw, Crush, Goose, and Pi — 13 tools total.
- **All coding tools available in Install Endpoints (Y key)**: The endpoint installer now supports all 13 tools as install targets, not just the original 5. Each tool gets its proper config format (JSON, YAML, or env file).
- **Connection mode choice in Install flow**: When installing endpoints (Y key), users now choose between **Direct Provider** (pure API connection) or **FCM Proxy** (local proxy with key rotation and usage tracking) — new Step 3 in the 5-step flow.
- **Install support for new tools**: Pi (models.json + settings.json), Aider (.aider.conf.yml), Amp (settings.json), Gemini (settings.json), Qwen (modelProviders config), Claude Code/Codex/OpenHands (sourceable env files at ~/.fcm-*-env).

### Changed
- **Install Endpoints flow is now 5 steps**: Provider → Tool → Connection Mode → Scope → Models (was 4 steps without connection mode choice).
- **Tool labels in install overlay use metadata**: Tool names and emojis in the Y overlay now come from `tool-metadata.js` instead of hard-coded ternary chains — easier to maintain and always in sync.
- **Help overlay updated**: Z-cycle hint and CLI flag examples now list all 13 tools.

---

## 0.2.16

### Fixed
- **Changelog index viewport scrolling**: Cursor in changelog version list (N key) now scrolls the viewport to follow selection — previously scrolling past the last visible row would move the cursor off-screen into empty space.

### Added
- **Changelog version summaries**: Each version in the changelog index now shows a short summary (first change title, ~15 words) after the change count, displayed in dim for readability.

---

## 0.2.15

### Changed
- **Changelog scrolling experience**: Circular wrap-around scrolling in changelog details (N key) — up at the top now wraps to the bottom, down at the bottom wraps to the top. PageUp/PageDown also wrap for seamless infinite browsing, just like the main TUI list navigation. Home/End still jump to absolute first/last positions for quick access.

---

## 0.2.14

### Fixed
- **Changelog scrolling viewport**: Scrolling in changelog details (N key) now respects viewport boundaries — content no longer scrolls beyond visible area. Down/PageDown/End keys now properly clamp to max scroll offset so you can view all content without it disappearing off screen.

---

## 0.2.13

### Added
- **Persist UI view settings**: Tier filter (T key), provider filter (D key), and sort order now persist across session restarts — settings are saved to `~/.free-coding-models.json` under `config.settings` and automatically restored on next startup. Settings also mirror into active profiles so profile switching captures live view preferences.
  - When T cycles tier: S+ tier is now remembered for next session
  - When D cycles provider: Filtered provider is now remembered
  - When sort keys (R/O/M/L/A/S/C/H/V/B/U) change order: Sort column and direction are now remembered
  - Profile loading has priority over global `config.settings` so saved profiles override global defaults
- **Reset view settings (Shift+R)**: New keyboard shortcut to instantly reset tier filter, provider filter, and sort order to defaults (All tier, no provider filter, avg sort ascending). Also clears persisted settings from `config.settings` so next restart returns to factory defaults.
  - Useful when you've customized your view but want a fresh start
  - Does not affect favorites, API keys, or other settings — only view state

### Changed
- **Help overlay (K key)**: Updated to document new Shift+R keybinding for resetting view settings

---

## 0.2.12

### Added
- **Auto-select models for all external tools**: All 10 supported tools (Aider, Crush, Goose, Claude Code, Codex, Gemini, Qwen, OpenHands, Amp, Pi) now automatically configure and pre-select the chosen model on launch — no manual model selection needed after pressing Enter.
- **Changelog loader utility**: New `src/changelog-loader.js` module parses CHANGELOG.md for future TUI integration to display changes directly in the app instead of opening a browser.

### Fixed
- **Infinite update loop on startup**: Disabled forced auto-update that caused the app to detect the same update repeatedly after restarting. The app now checks for updates in the background without forcing installation.
- **Removed disruptive browser window**: The auto-update process no longer opens a browser window to show the changelog — it now shows update information in the terminal only.
- **Update failure tracking**: If update checks fail 3+ times, the app displays a prominent red footer warning: `⚠ OUTDATED version, please update` with manual update instructions instead of crashing.

### Changed
- **OpenHands integration improved**: Now sets `LLM_MODEL` and `LLM_API_KEY` environment variables for proper model pre-selection on launch.
- **Amp integration improved**: Now writes `amp.model` to config file with the selected model ID.

---

## 0.2.11

### Added
- **Pi Coding Agent support**: Enabled Pi (pi.dev) as a launchable mode in the Z key cycle. Select a model and press Enter to auto-configure Pi's model config and settings, then spawn the PI coding agent CLI with the chosen model pre-selected as the default.

---

## 0.2.10

### Changed
- **Discord invite link**: Updated to permanent non-expiring link `https://discord.gg/ZTNFHvvCkU` in README and TUI footer
- **NVIDIA NIM**: Added MiniMax M2.5 (S+ tier) to model list

---

## 0.2.9

### Fixed
- **Discord link**: Updated expired invite URL to `https://discord.gg/f2AjwV2AN` in README and TUI footer

### Added
- **Discord link health-check workflow**: New GitHub Actions workflow (`check-discord-link.yml`) runs every 12 hours, validates the Discord invite via the Discord API, and auto-opens an issue labeled `discord-link` if the link becomes invalid
- **Pi provider metadata**: Added `pi` provider entry to `src/provider-metadata.js` with light blue color, pi.dev signup URL, and setup hint for `@mariozechner/pi-coding-agent` integration

---

## 0.2.8

### Updated

- 📊 **Provider quota information refreshed** – Updated free‑tier request limits for NVIDIA NIM, Groq, Cerebras, Replicate, DeepInfra, and Fireworks AI in `src/provider-metadata.js` and the README.
- 📖 **README requirements section** – Added the latest quota details for each provider (40 req/min for NVIDIA, 30‑50 RPM for Groq, generous dev tier for Cerebras, 6 req/min free Replicate, 200 concurrent DeepInfra, 10 req/min free Fireworks) and clarified payment‑method dependent limits.
- 🛠️ **No functional code changes** – Metadata updates only; all tests continue to pass.

### Added

- 📊 **Added `--json` flag for scriptable output** - Output model results as JSON for automation, CI/CD, and monitoring dashboards. Example: `free-coding-models --tier S --json | jq '.[0].modelId'`

- 💾 **Added persistent ping cache** - Cache ping results for 5 minutes to speed up subsequent runs:
  - Cache stored in `~/.free-coding-models.cache.json`
  - Automatic cache refresh on startup if stale
  - Saves API rate limits and reduces wait time
  - Cache is saved on exit for next run

- 🔐 **Added config file security check with auto-fix** - Warns if `~/.free-coding-models.json` has insecure permissions:
  - Checks file permissions on startup
  - Warns if file is readable by others (security risk)
  - Offers one-click auto-fix with `chmod 600`
  - Shows manual fix command if auto-fix fails or is declined

- 🎨 **Added provider colors to logs and settings** - Provider names are now colored the same way as in the main table:
  - Settings overlay (P) shows colored provider names
  - Fiable mode output uses colored provider names
  - Tool launcher messages use colored provider names
  - Request log overlay (X) shows colored provider names
  - Consistent visual experience across all UI elements

### Changed

- 📝 **Increased default log limit from 200 to 500 entries** - Request log overlay now shows up to 500 entries by default (previously 200)
- 🔀 **Added toggle for unlimited logs** - Press `A` in request log overlay to toggle between showing 500 entries or ALL logs
- ❌ **Enhanced visual failure indication in logs** - Failed requests with zero tokens now have:
  - Dark red background (`rgb(40, 0, 0)`) on the entire row
  - Model name in red
  - Token column shows red cross emoji (✗) instead of token count
  - Quick visual identification of errors vs successful requests
- 📝 **Updated documentation** - Added `--json` flag to CLI flags table in README.md with usage examples

- 🔌 Added `terminalcp` MCP server configuration for Claude Code to spawn and interact with the TUI headlessly. Agents can now visually test the terminal interface by capturing output and sending keystrokes programmatically. See AGENTS.md → "Testing the TUI with terminalcp" for usage.
- 🎨 **Added consistent branding header to all overlays** - Each overlay (Settings, Help, Log, Install Endpoints, Recommend, Feature Request, Bug Report) now displays:
  - Free-coding-models logo with rocket emoji (🚀)
  - Version number display
  - Clean title on a separate line
  - Consistent visual styling across all screens
  - **Main table title now uses rocket emoji (🚀) and cyanBright color** for consistency with overlays

### Changed

- 📝 **Updated documentation** - Added `--json` flag to CLI flags table in README.md with usage examples

- 📊 **Improved ping progress visibility** - Moved ping completion counter from the W badge to the main status bar:
  - Now shows as `📦 49/59` next to model status counts (up/timeout/down)
  - More prominent placement makes it easier to see ping progress at a glance
  - W badge still shows interval, mode, and countdown to next ping

- 🧹 **Removed unnecessary blank line** - Overlays (Settings P, Help K, Log X) no longer have a blank line at the top, giving more vertical space for content

- 🔽 **Removed duplicate "CONFIGURED ONLY" badge** - The header no longer shows the "CONFIGURED ONLY" indicator since it's already displayed in the footer hints. This reduces header clutter while keeping the information visible.

- 🎨 **Enhanced Request Log (X) with colors and visual indicators**:
  - **Latency gradient**: Green (<500ms) → Orange (<1000ms) → Yellow (<1500ms) → Red (≥1500ms) for quick performance assessment
  - **Token opacity**: Light green (low usage) → Medium green → Bright green (high usage, >30k tokens)
  - **Model coloring**: Matches status color for visual consistency
  - **Status colors** - Distinct colors for each HTTP code:
    - `200` ✅ → Bright green
    - `400` → Dark magenta (#8B008B)
    - `401` → Dark orchid (#9932CC)
    - `403` → Medium orchid (#BA55D3)
    - `404` → Dark red (crimson)
    - `413` → Tomato red (#FF6347)
    - `429` → Dark orange (#FFB90F)
    - `500` → Crimson (#DC143C)
    - `502` → Medium violet red (#C71585)
    - `503` → Medium purple (#9370DB)
    - `5xx` → Magenta (other 5xx errors)
    - `0` → Dim gray (timeout/unknown)
  - **Fixed token display bug**: Corrected chalk function calls that were showing JavaScript code instead of token counts

- 💖 **Added "Buy me a coffee" link to footer**:
  - Added in main TUI footer next to Contributors link (buymeacoffee.com/vavanessadev)
  - Added in Settings overlay (P) footer with credits "Made with 💖 & ☕ by vava-nessa"
  - Warm orange color for the coffee link to match the cozy theme

### Fixed

- 🖥️ **Overlays now use 100% terminal width** - All overlays (Settings P, Help K, Log X, Recommend Q, Feature J, Bug I) now dynamically adapt to full terminal width instead of fixed 116-column panels:
  - Rate limits text is no longer truncated (full descriptions visible)
  - Diagnostic messages wrap using available terminal width
  - Separator lines extend to full terminal width
  - Better readability on wider terminals

- 🔒 **Fixed profile loading to preserve API keys** - Loading a profile now MERGES apiKeys instead of replacing them:
  - Keys in the profile override existing keys (allows profile-specific overrides)
  - Keys NOT in the profile are preserved (prevents key loss when switching profiles)
  - Fixes bug where switching profiles would cause API keys disappear
  - Added test to verify merge behavior

- 📝 **Updated OpenRouter rate limits information**:
  - README now includes detailed explanation of free tier quotas (50/day <$10 credits, 1000/day ≥$10)
  - Settings overlay displays accurate rate limit text
  - Added note about failed requests counting toward daily quota

---

## 0.2.5

### Fixed

- 🔒 **Improved config save reliability** - API keys are now much safer from corruption and loss:
  - Automatic backups before each save (keeps last 5 versions in `~/.free-coding-models.backups/`)
  - Post-write verification confirms file was written correctly and data wasn't lost
  - Explicit error handling instead of silent failures
  - Auto-repair on startup if config is corrupted (restores from latest backup)
  - Console notifications when backup is used or config is repaired

---

## 0.2.4

### Fixed

- 🔧 Fixed Configured Only filter (E key) not being applied at startup. The flag was initialized correctly but the filter function was never called on first render, causing all models to appear visible even when Configured Only mode was enabled.

---

## 0.2.3

### Fixed

- 🔧 Fixed Codestral API endpoint URL from `codestral.mistral.ai/v1` to `api.mistral.ai/v1` to align with Mistral AI's unified API platform. This resolves authentication failures when testing Codestral API keys in Settings.

---

## 0.2.2

### Added

- 🔌 Added a new `Y` install flow that pushes one configured provider directly into `OpenCode CLI`, `OpenCode Desktop`, `OpenClaw`, `Crush`, or `Goose`, with either the full catalog or a curated model subset.

### Changed

- 🔄 Tracked endpoint installs are now refreshed automatically on future launches so managed tool catalogs stay aligned when provider model lists evolve.

### Fixed

- 🔐 Clarified provider auth failures in the main table so configured keys rejected by a provider no longer appear as `NO KEY`.
- 🔁 Hardened Settings key tests with multi-model retries plus detailed diagnostics under Setup Instructions when a provider probe fails.
- 🏷️ Fixed Settings provider badges so configured keys show `Test` before the first probe, while providers without a key now show `Missing Key`.
- 🤗 Clarified the Hugging Face setup hint in Settings to require a fine-grained token with `Make calls to Inference Providers`.

## 0.2.1

### Added

- 🚨 Added a footer warning that highlights outdated installs with a red banner and the message `This version is outdated .` once a newer npm version is detected.

### Changed

- 💾 The `Z` launcher choice is now persisted in config, so the app restarts on the last tool used instead of always falling back to OpenCode CLI.
- 📋 The request log overlay now highlights proxy fallback reroutes with a dedicated `SWITCHED ↻` route badge and shows `requested → actual` model transitions inline.

### Fixed

- 🔀 Fixed the footer proxy status so an active proxy now renders as running instead of incorrectly showing `Proxy not configured`.
- ⚙️ Fixed the footer proxy status so a proxy enabled in Settings now shows as configured even before the local proxy process is started.
- 🧭 Fixed the main TUI footer so the outdated-version warning appears directly under the proxy status line where users can see it immediately.
- 🧠 Fixed proxy-backed launcher model selection so `Crush` and `Goose` now use the universal `fcm-proxy` model slug instead of stale provider-specific ids when proxy mode is enabled.

## 0.2.0

### Added

- 🧰 Added direct launch modes for `Crush` and `Goose` as hardened public launchers, with additional internal support for `Aider`, `Claude Code`, `Codex CLI`, `Gemini CLI`, `Qwen Code`, `OpenHands`, `Amp`, and `Pi` (temporarily disabled from public cycle pending hardening).
- 🧹 Added OpenCode proxy cleanup in Settings plus a `--clean-proxy` CLI command to remove persisted `fcm-proxy` config safely.
- 🎨 Dynamic color coding for active Tier and Provider filter badges — each tier/provider now displays with its signature color directly in the header and footer pills for better visual feedback.
- 📖 Comprehensive documentation refresh across JSDoc headers in `bin/free-coding-models.js` to clarify the new default startup behavior, ping cadence states, and removal of the startup menu.

### Changed

- 🧭 Extended the `Z` tool cycle, CLI flag parser, help overlay, and header mode badge so the active target tool is visible and switchable across all supported launchers.
- 🔀 Made the multi-account proxy opt-in and disabled by default, added Settings controls for proxy enablement, OpenCode persistence, and preferred port, and restored direct OpenCode launch as the default path.
- 🎛 Active Tier and Provider filters now show their current value directly inside the highlighted pills, while Crush now writes a real default selected model into `crush.json` and uses either direct provider config or the local FCM proxy depending on the current proxy setting.
- 📚 Audited and synchronized the public documentation, in-app help, and footer hints so they now describe the hardened launcher set (`OpenCode CLI`, `OpenCode Desktop`, `OpenClaw`, `Crush`, `Goose`), the real default startup behavior, the current ping cadence, the Settings shortcuts, and the proxy-only request log semantics.
- 🛡️ **Hardened public launcher set** — Narrowed the Z-cycle to only the stable, tested integrations: `OpenCode CLI` → `OpenCode Desktop` → `OpenClaw` → `Crush` → `Goose`. Aider, Claude Code, Codex CLI, Gemini CLI, Qwen Code, OpenHands, Amp, and Pi are now temporarily disabled pending flow hardening.
- 🎯 **Improved Crush configuration** — Now writes proper `config.models.large` default selection (instead of relying on CLI args), respects proxy enablement state, and uses `disable_default_providers` to rely on FCM's provider configuration.
- 🔧 **Crush launcher robustness** — Spawn call simplified to not pass `--model` argument; model selection now driven entirely through `crush.json` to avoid CLI parsing conflicts.
- 📚 **Synchronized in-app help** — Removed references to temporarily disabled launchers from the Z-cycle hint and CLI flag examples to reduce user confusion and match the hardened set.
- ✅ **Refined filter UI responsiveness** — Active Tier and Provider filter values now visually highlight in the main table footer hotkeys with tier-matched or provider-matched colors for instant recognition.

### Fixed

- 🪫 Temporarily removed unstable external launchers (`Aider`, `Claude Code`, `Codex CLI`, `Gemini CLI`, `Qwen Code`, `OpenHands`, `Amp`, `Pi`) from the public mode cycle/help so only the currently hardened integrations remain exposed.
- 🧭 Corrected stale docs that still advertised the removed startup picker, mislabeled the `X` overlay as a live activity/error log viewer, and listed public commands or tips that no longer matched the current UI.
- 🪪 **Crush proxy support** — Crush now correctly detects when proxy mode is enabled and routes through the local FCM proxy (`http://127.0.0.1:<port>/v1`) with appropriate token/URL substitution instead of attempting direct provider connection.
- 📖 **Shell compatibility** — Fixed spawning command for external tools to use `shell: true` only on Windows; Linux/macOS now spawn without shell wrapper for cleaner process trees.
- 🎛 **Filter state persistence** — Tier and Provider filter badges in the footer now correctly calculate and display their active state across all state transitions.

---

## 0.1.89 (merged into 0.2.0)

### Added

- 🎨 Dynamic color coding for active Tier and Provider filter badges — each tier/provider now displays with its signature color directly in the header and footer pills for better visual feedback.
- 📖 Comprehensive documentation refresh across JSDoc headers in `bin/free-coding-models.js` to clarify the new default startup behavior, ping cadence states, and removal of the startup menu.

### Changed

- 🛡️ **Hardened public launcher set** — Narrowed the Z-cycle to only the stable, tested integrations: `OpenCode CLI` → `OpenCode Desktop` → `OpenClaw` → `Crush` → `Goose`. Aider, Claude Code, Codex CLI, Gemini CLI, Qwen Code, OpenHands, Amp, and Pi are now temporarily disabled pending flow hardening.
- 🎯 **Improved Crush configuration** — Now writes proper `config.models.large` default selection (instead of relying on CLI args), respects proxy enablement state, and uses `disable_default_providers` to rely on FCM's provider configuration.
- 🔧 **Crush launcher robustness** — Spawn call simplified to not pass `--model` argument; model selection now driven entirely through `crush.json` to avoid CLI parsing conflicts.
- 📚 **Synchronized in-app help** — Removed references to temporarily disabled launchers from the Z-cycle hint and CLI flag examples to reduce user confusion and match the hardened set.
- ✅ **Refined filter UI responsiveness** — Active Tier and Provider filter values now visually highlight in the main table footer hotkeys with tier-matched or provider-matched colors for instant recognition.

### Fixed

- 🪪 **Crush proxy support** — Crush now correctly detects when proxy mode is enabled and routes through the local FCM proxy (`http://127.0.0.1:<port>/v1`) with appropriate token/URL substitution instead of attempting direct provider connection.
- 📖 **Shell compatibility** — Fixed spawning command for external tools to use `shell: true` only on Windows; Linux/macOS now spawn without shell wrapper for cleaner process trees.
- 🎛 **Filter state persistence** — Tier and Provider filter badges in the footer now correctly calculate and display their active state across all state transitions.

---

## 0.1.88

### Added

- 🧰 Added direct launch modes for `Aider`, `Crush`, `Goose`, `Claude Code`, `Codex CLI`, `Gemini CLI`, `Qwen Code`, `OpenHands`, `Amp`, and `Pi`, so pressing `Enter` can now auto-configure and start more than just OpenCode/OpenClaw.
- 🧹 Added OpenCode proxy cleanup in Settings plus a `--clean-proxy` CLI command to remove persisted `fcm-proxy` config safely.

### Changed

- 🧭 Extended the `Z` tool cycle, CLI flag parser, help overlay, and header mode badge so the active target tool is visible and switchable across all supported launchers.
- 🔀 Made the multi-account proxy opt-in and disabled by default, added Settings controls for proxy enablement, OpenCode persistence, and preferred port, and restored direct OpenCode launch as the default path.
- 🎛 Active Tier and Provider filters now show their current value directly inside the highlighted pills, while Crush now writes a real default selected model into `crush.json` and uses either direct provider config or the local FCM proxy depending on the current proxy setting.
- 📚 Audited and synchronized the public documentation, in-app help, and footer hints so they now describe the hardened launcher set (`OpenCode CLI`, `OpenCode Desktop`, `OpenClaw`, `Crush`, `Goose`), the real default startup behavior, the current ping cadence, the Settings shortcuts, and the proxy-only request log semantics.

### Fixed

- 🪫 Temporarily removed unstable external launchers (`Aider`, `Claude Code`, `Codex CLI`, `Gemini CLI`, `Qwen Code`, `OpenHands`, `Amp`, `Pi`) from the public mode cycle/help so only the currently hardened integrations remain exposed.
- 🧭 Corrected stale docs that still advertised the removed startup picker, mislabeled the `X` overlay as a live activity/error log viewer, and listed public commands or tips that no longer matched the current UI.

---

## 0.1.87

### Fixed

- 🎨 Rebalanced `Perplexity`, `Hyperbolic`, and `Together AI` provider colors so they are more visually distinct from `NIM` and from each other in the TUI.

---

## 0.1.86

### Fixed

- 🔑 Provider key tests in the `P` settings screen now discover `/models` when available and probe multiple candidate model IDs, fixing false failures on SambaNova and NVIDIA NIM when a listed model is not actually callable.
- 📚 Refreshed provider catalogs with confirmed public updates for OpenRouter, SambaNova, and Cerebras so outdated model IDs are less likely to appear in the TUI.
- 🧭 Settings key tests now show distinct `Rate limit` and `No model` states instead of collapsing every non-success into a generic failure badge.
- 🎨 Reworked provider colors into a soft pastel rainbow palette so each provider is easier to distinguish across the TUI without aggressive saturation.
- 🧼 Simplified the TUI header/footer by merging ping controls into one badge, moving the active tool mode into a `Z Tool` header badge, and removing redundant footer hints for tool mode and Enter actions.
- 🙈 Added an `E` shortcut to hide models from providers without configured API keys, with persistence across sessions and inside saved profiles.
- 🖌 Refined the TUI visuals: provider-colored model names, header title now shows the current app version, footer version removed, favorites use a lighter pastel yellow, and the selected row uses a punchier pink-violet highlight.
- 🌑 Made favorite rows darker for better contrast and changed Scaleway to a cooler blue so it no longer blends with OpenRouter.
- 🚪 `Configured Only` is now enabled by default, and the empty state tells users to press `P` when no configured API key can surface any model.
- 🪟 Added a centered terminal-width warning instead of rendering a broken table when the shell is too narrow.
- 📝 Updated the README to match the current model count, default filters, and latest TUI behavior.

---

## 0.1.85

### Added

- 🌀 Added an inline spinner beside `Latest Ping` so each row shows when a fresh ping is still in flight without hiding the previous latency.
- 🏎 Added ping mode badges next to `FCM` so the active cadence is always visible in the header.

### Fixed

- 🔑 `Avg Ping` and latency-derived metrics now also use `401` responses, so rows without an API key still accumulate real latency samples.
- 🎨 Unified footer shortcut colors so every hotkey uses the same visual treatment.

### Changed

- ⏱ Reworked ping scheduling: startup now runs a 60s `FAST` burst at 2s, steady state uses `NORMAL` at 10s, idle sessions auto-drop to `SLOW` at 30s after 5 minutes, and `FORCED` stays at 4s without auto slowdowns.
- 🎛 `W` now cycles ping modes (`FAST` / `NORMAL` / `SLOW` / `FORCED`) instead of tweaking raw intervals.
- 🧾 Updated the main footer, in-app help, README, and profile defaults to match the new ping mode system and token log wording.

---

## 0.1.84

### Added

- ✅ Added a new `Used` column showing total consumed prompt+completion tokens per exact `provider + model`, formatted in compact `k` / `M` units from startup log aggregation.
- 🌀 Added an inline spinner beside `Latest Ping` so each row shows when a fresh ping is still in flight without hiding the previous latency.
- 🏎 Added ping mode badges in the header plus adaptive ping cadence states: `FAST`, `NORMAL`, `SLOW`, and `FORCED`.

### Fixed

- 🎯 Aligned TUI header shortcut highlights with live bindings: `Up%` uses the correct shortcut color, and `G` now sorts the `UsaGe` column directly.
- 🧭 Renamed the `Origin` column to `Provider`, switched the provider filter key from `N` to `D`, and updated the highlighted header shortcuts to `PrOviDer`.
- 🟢 Fixed provider usage contamination by scoping quota snapshots to exact `provider + model`, so shared model IDs no longer leak usage percentages across providers.
- 🟢 Show a green dot in `Usage` when quota telemetry is not applicable or not reliable for a provider instead of displaying misleading percentages.
- 🔤 Shortened Alibaba Cloud (DashScope) to `Alibaba` in the main TUI table to avoid layout drift while keeping the full name in Settings.
- 🩺 Expanded `Health` labels for common errors: `429 TRY LATER`, `410 GONE`, `404 NOT FOUND`, `500 ERROR`.
- 🔑 `Avg Ping` and latency-derived metrics now also use `401` responses, so rows without an API key still accumulate real latency samples.

### Changed

- 🧱 Refactored TUI overlays and key handling into `src/overlays.js` and `src/key-handler.js` to keep `bin/free-coding-models.js` lean.
- 🔌 Extracted OpenClaw integration into `src/openclaw.js` and aligned OpenCode flow with shared helpers.
- 🗂️ Moved tier/provider filter modes into shared runtime state for clearer ownership.
- ✅ Renamed the app header to `✅ FCM`, moved the version next to `Ctrl+C Exit`, and added subtle blue color variations per provider in the `Provider` column.
- 🧹 Cleaned the footer hints by removing the duplicate `Ctrl+C Exit` entry while keeping the proxy status directly under the shortcut line.
- 📚 Updated README and in-app help to match the new `Provider`, `Used`, `Usage`, and current hotkey behaviors.
- ⏱ Reworked ping scheduling: app startup now runs a 60s fast burst at 2s, steady-state defaults to 10s, idle sessions auto-drop to 30s after 5 minutes, and `W` now cycles ping modes instead of tweaking raw intervals.

---

## 0.1.83

### Added

- **Multi-Account Proxy Server** -- automatically starts a local reverse proxy (`fcm-proxy`) that groups all accounts into a single provider in OpenCode; supports multi-account rotation and auto-detects usage limits to swap between providers.
- **Transparent ZAI Proxy** -- bridges ZAI's non-standard API format to OpenAI-compatible `/v1/` for OpenCode CLI mode.
- **Quota & Usage Tracking** -- new `Usage` column in TUI shows remaining quota percentage for each model; persists across sessions via `token-stats.json`.
- **Dedicated Log Viewer** -- press `X` to view real-time activity and error logs in a focused TUI overlay; includes auto-pruning to keep log history concise.
- **Usage Sort (`Shift+G`)** -- new hotkey to sort models by remaining quota percentage, helping you pick models with the most bandwidth left.
- **Ping Interval Increase (`=`)** -- reassigned interval increase to the `=` key to free up `X` for logs; `W` still decreases the interval.
- **Model Catalogue Merging** -- groups identical models across different providers into a single "merged" view while retaining the ability to probe specific endpoints.
- **MODEL_NOT_FOUND Rotation** -- if a specific provider returns a 404 for a model, the TUI intelligently rotates through other available providers for the same model.
- **Sticky Health-break** -- UI improvement that prevents the TUI from jumping when a model's status changes from UP to TIMEOUT/DOWN.
- **Telemetry Opt-out** -- users can now explicitly disable anonymous telemetry in their config file (opt-in by default for improved bug tracking).

### Changed

- **Masked API Keys in Settings** -- hides middle parts of API keys in the `P` menu to prevent accidental exposure during screen sharing.
- **Enhanced tmux support** -- auto-discovery of available ports for OpenCode sub-agent panes when running in a tmux session.
- **Hardened Test Suite** -- expanded to 13 suites and 62+ verified test cases covering proxy logic, usage reading, and hotkey behavior.

## 0.1.82

### Fixed

- **Alibaba Cloud URL** -- updated from deprecated `dashscope.console.alibabacloud.com` to active `modelstudio.console.alibabacloud.com` (rebranded to Model Studio).
- **SambaNova URL** -- updated from broken `sambanova.ai/developers` to active `cloud.sambanova.ai/apis` (SambaCloud portal).
- **OpenRouter key corruption** -- added validation to detect and prevent saving OpenRouter keys that don't start with `sk-or-` prefix. Shows error message and cancels save if corruption detected.

---

## 0.1.81

### Added

- **Dynamic OpenRouter free model discovery** -- fetches live free models from OpenRouter API at startup; replaces static list with fresh data so new free models appear automatically without code updates. Falls back to cached static list with a yellow warning on network failure.
- **`formatCtxWindow` and `labelFromId` utility functions** -- extracted to `lib/utils.js` for testability; used by dynamic OpenRouter discovery to convert API data to display format.
- **16 new unit tests** -- covering `formatCtxWindow`, `labelFromId`, and MODELS array mutation logic (147 total tests across 23 suites).
- **NVIDIA NIM auto-configuration** -- selecting a NIM model in OpenCode now auto-creates the nvidia provider block in `opencode.json` if missing, eliminating the manual install prompt.

### Fixed

- **Auto-update infinite loop** -- when running from source (dev mode with `.git` directory), auto-update is now skipped to prevent the restart loop where LOCAL_VERSION never changes.
- **NVIDIA model double-prefix bug** -- model IDs in `sources.js` already include `nvidia/` prefix; `getOpenCodeModelId()` now strips it for nvidia provider (like it does for zai), preventing `nvidia/nvidia/...` in OpenCode config.

### Removed

- **`checkNvidiaNimConfig()` function** -- replaced by auto-create pattern; dead code removed.

---

## 0.1.80

### Fixed

- **Settings menu crash** -- fixed `ReferenceError: telemetryRowIdx is not defined` error when opening Settings (P key). Removed lingering reference to the deleted telemetry row index.

---

## 0.1.79

### Added

- **Alibaba Cloud (DashScope) provider** -- added support for Qwen3-Coder models via Alibaba Cloud Model Studio. 8 new models including Qwen3 Coder Plus (69.6% SWE-bench), Qwen3 Coder Max (67.0%), Qwen3 Coder Next (65.0%), Qwen3 Coder 480B (70.6%), Qwen3 235B (70.0%), Qwen3 80B Instruct (65.0%), Qwen3 32B (50.0%), and Qwen2.5 Coder 32B (46.0%). OpenAI-compatible API with 1M free tokens per model (Singapore region, 90 days). Use `DASHSCOPE_API_KEY` environment variable or configure via Settings (P key).
- **Model count increased** -- now supporting 158 models across 20 providers (up from 150 models / 19 providers).

---

## 0.1.78

### Added

- **Auto-update system** — removed manual update popup; now automatically installs updates and opens changelog in browser. Update proceeds immediately after opening changelog.

---

## 0.1.77

### Added

- **Bug Report system (I key)** — added anonymous bug report overlay that sends bug reports directly to the project team via Discord webhook. Press **I** to open a multi-line input box, describe the bug, and press Enter to send. Uses the same infrastructure as Feature Request (J key) with a separate webhook and distinct red color theme. Includes automatic collection of anonymous metadata (OS, terminal, Node version, architecture, timezone) sent only in the Discord message footer (not visible in UI). Shows success confirmation with 3-second auto-close.
- **Full-screen overlay** — Bug Report overlay hides the main TUI completely (like Settings, Help, and Feature Request), with a bordered multi-line input box supporting up to 500 characters with real-time character counter.
- **Help documentation** — added I key entry in help overlay (K) and navigation hints.

### Changed

- **Footer hints** — added `I Report bug` to line 2 of navigation hints for discoverability.

---

## 0.1.76

### Added

- **Feature Request system (J key)** — added anonymous feedback overlay that sends feature requests directly to the project team via Discord webhook. Press **J** to open a multi-line input box, type your request, and press Enter to send. Includes automatic collection of anonymous metadata (OS, terminal, Node version, architecture, timezone) sent only in the Discord message footer (not visible in UI). Shows success confirmation with 3-second auto-close.
- **Full-screen overlay** — Feature Request overlay now hides the main TUI completely (like Settings and Help), with a bordered multi-line input box supporting up to 500 characters with real-time character counter.
- **Help documentation** — added J key entry in help overlay (K) and navigation hints.

### Changed

- **Footer hints** — added `J Request feature` to line 2 of navigation hints for discoverability.

---

## 0.1.75

### Fixed

- **TUI header disappeared** — fixed `TABLE_FOOTER_LINES` constant (was 7, now 5) to match the actual footer line count after contributors line was removed in 0.1.73. The mismatch caused `calculateViewport()` to over-reserve vertical space, pushing the header off-screen.
- **Missing spacer line** — restored the `else { lines.push('') }` branch that adds a blank line between model rows and navigation hints when the profile-save message is not shown.
- **Stray debug line** — removed accidental `lines.push('____________________')` left in the Smart Recommend section.

---

## 0.1.74

### Changed

- **TUI footer spacing** — removed an empty separator line between the “... more below …” indicator and the navigation hints, freeing up vertical space in the main UI.

## 0.1.73

### Fixed

- **iFlow OpenCode integration** — added missing iFlow provider configuration for OpenCode launch. Selecting iFlow models and pressing Enter now correctly configures OpenCode to use iFlow's API.

---

## 0.1.72

### Changed

- **TUI footer spacing** — added extra empty line before contributors line for better readability in terminals.

---

## 0.1.71

### Changed

- **TUI footer contributors** — moved contributor names to their own line at the bottom for cleaner layout.

---

## 0.1.70

### Changed

- **Default ping interval 60s -> 3s** -- Changed default re-ping frequency from every 60 seconds back to every 3 seconds for faster model monitoring feedback. Still adjustable with W/X keys.

---

## 0.1.69

### Added

- **iFlow provider** — new provider with 11 free coding models (TBStars2 200B, DeepSeek V3/V3.2/R1, Qwen3 Coder Plus/235B/32B/Max, Kimi K2, GLM-4.6). Free for individual users with no request limits. API key expires every 7 days.
- **TUI footer contributors** — added contributor names directly in footer line (vava-nessa • erwinh22 • whit3rabbit • skylaweber).

### Changed

- **README updates** — updated model/provider counts to 150 models across 19 providers; updated provider count references throughout.

### Fixed

- **JSDoc in lib/config.js** — fixed broken JSON structure in config example (removed duplicate lines, fixed array/object brackets).
- **CHANGELOG cleanup** — removed `[fork]` prefixes from 0.1.68 entries for cleaner presentation.

---

## 0.1.68

### Added

- **ZAI reverse proxy for OpenCode** -- When selecting a ZAI model, a local HTTP proxy automatically starts to translate OpenCode's `/v1/*` requests to ZAI's `/api/coding/paas/v4/*` API format. Proxy lifecycle is fully managed (starts on Enter, stops on OpenCode exit).
- **Stale config cleanup on OpenCode exit** -- The `spawnOpenCode` exit handler now removes the ZAI provider block from `opencode.json` so leftover config does not cause "model not valid" errors on the next manual OpenCode launch.
- **Smart Recommend (Q key)** — new modal overlay with a 3-question wizard (task type, priority, context budget) that runs a 10-second targeted analysis (2 pings/sec) and recommends the Top 3 models for your use case. Recommended models are pinned above favorites with 🎯 prefix and green row highlight.
- **Config Profiles** — save/load named configuration profiles (`--profile work`, `--profile fast`, etc.). Each profile stores API keys, enabled providers, favorites, tier filters, ping interval, and default sort. **Shift+P** cycles through profiles live in the TUI.
- **`--recommend` CLI flag** — auto-opens the Smart Recommend overlay on startup.
- **`--profile <name>` CLI flag** — loads a saved profile at startup; errors if profile doesn't exist.
- **Scoring engine** (`lib/utils.js`) — `TASK_TYPES`, `PRIORITY_TYPES`, `CONTEXT_BUDGETS`, `parseCtxToK()`, `parseSweToNum()`, `scoreModelForTask()`, `getTopRecommendations()` for the recommendation algorithm.
- **Profile management** (`lib/config.js`) — `saveAsProfile()`, `loadProfile()`, `listProfiles()`, `deleteProfile()`, `getActiveProfileName()`, `setActiveProfile()`.
- 43 new unit tests (131 total) covering scoring constants, `scoreModelForTask`, `getTopRecommendations`, `--profile`/`--recommend` arg parsing, and config profile CRUD.

### Fixed

- **OpenCode config path on Windows** -- OpenCode uses `xdg-basedir` which resolves to `%USERPROFILE%\.config` on all platforms. We were writing to `%APPDATA%\Roaming\opencode\` on Windows, so OpenCode never saw the ZAI provider config. Config path is now `~/.config/opencode/opencode.json` on all platforms.
- **`apiKey` field for ZAI provider** -- Changed from `{env:ZAI_API_KEY}` template string to the actual resolved key so OpenCode's `@ai-sdk/openai-compatible` provider can authenticate immediately.
- **`--profile` arg parsing** -- the profile value (e.g. `work` in `--profile work`) was incorrectly captured as `apiKey`; fixed with `skipIndices` Set in `parseArgs()`.
- **`recommendScore` undefined** -- `sortResultsWithPinnedFavorites()` referenced `recommendScore` but it was never set on result objects; now set during `startRecommendAnalysis()`.

### Changed

- **Default ping interval 3s -> 60s** -- Reduced re-ping frequency from every 3 seconds to every 60 seconds for a calmer monitoring experience (still adjustable with W/X keys).
- **Suppress MaxListeners warning** -- Set `NODE_NO_WARNINGS=1` in the OpenCode child process environment to suppress Node.js EventEmitter warnings.
- **ZAI models synced to 5** -- Updated `sources.js` to 5 ZAI API models with SWE-bench scores: GLM-5 (77.8%), GLM-4.5 (75.0%), GLM-4.7 (73.8%), GLM-4.5-Air (72.0%), GLM-4.6 (70.0%).
- **README updates** -- Updated model/provider counts (139 models, 18 providers), ZAI model table with SWE-bench scores, ping interval references (60s), added ZAI proxy documentation.
- **Help overlay (K)** — removed the Filters section; moved `T` (Cycle tier) and `N` (Cycle origin) shortcuts into their respective column description rows. Added `Q` (Smart Recommend) and `Shift+P` (Cycle profile) shortcuts. Added `--recommend` and `--profile` to the CLI flags section.
- **Sort/pin order** — `sortResultsWithPinnedFavorites()` now pins recommended+favorite models first, then recommended-only, then favorite-only, then normal sorted models.
- **Animation loop priority** — Settings > Recommend > Help > Table.

---

## 0.1.68

### Added

- **ZAI reverse proxy for OpenCode** -- When selecting a ZAI model, a local HTTP proxy automatically starts to translate OpenCode's `/v1/*` requests to ZAI's `/api/coding/paas/v4/*` API format. Proxy lifecycle is fully managed (starts on Enter, stops on OpenCode exit).
- **Stale config cleanup on OpenCode exit** -- The `spawnOpenCode` exit handler now removes the ZAI provider block from `opencode.json` so leftover config does not cause "model not valid" errors on the next manual OpenCode launch.

### Fixed

- **OpenCode config path on Windows** -- OpenCode uses `xdg-basedir` which resolves to `%USERPROFILE%\.config` on all platforms. We were writing to `%APPDATA%\Roaming\opencode\` on Windows, so OpenCode never saw the ZAI provider config. Config path is now `~/.config/opencode/opencode.json` on all platforms.
- **`apiKey` field for ZAI provider** -- Changed from `{env:ZAI_API_KEY}` template string to the actual resolved key so OpenCode's `@ai-sdk/openai-compatible` provider can authenticate immediately.

### Changed

- **Default ping interval 3s -> 60s** -- Reduced re-ping frequency from every 3 seconds to every 60 seconds for a calmer monitoring experience (still adjustable with W/X keys).
- **Suppress MaxListeners warning** -- Set `NODE_NO_WARNINGS=1` in the OpenCode child process environment to suppress Node.js EventEmitter warnings.
- **ZAI models synced to 5** -- Updated `sources.js` to 5 ZAI API models with SWE-bench scores: GLM-5 (77.8%), GLM-4.5 (75.0%), GLM-4.7 (73.8%), GLM-4.5-Air (72.0%), GLM-4.6 (70.0%).
- **README updates** -- Updated model/provider counts (139 models, 18 providers), ZAI model table with SWE-bench scores, ping interval references (60s), added ZAI proxy documentation.
- **Smart Recommend (Q key)** — new modal overlay with a 3-question wizard (task type, priority, context budget) that runs a 10-second targeted analysis (2 pings/sec) and recommends the Top 3 models for your use case. Recommended models are pinned above favorites with 🎯 prefix and green row highlight.
- **Config Profiles** — save/load named configuration profiles (`--profile work`, `--profile fast`, etc.). Each profile stores API keys, enabled providers, favorites, tier filters, ping interval, and default sort. **Shift+P** cycles through profiles live in the TUI.
- **`--recommend` CLI flag** — auto-opens the Smart Recommend overlay on startup.
- **`--profile <name>` CLI flag** — loads a saved profile at startup; errors if profile doesn't exist.
- **Scoring engine** (`lib/utils.js`) — `TASK_TYPES`, `PRIORITY_TYPES`, `CONTEXT_BUDGETS`, `parseCtxToK()`, `parseSweToNum()`, `scoreModelForTask()`, `getTopRecommendations()` for the recommendation algorithm.
- **Profile management** (`lib/config.js`) — `saveAsProfile()`, `loadProfile()`, `listProfiles()`, `deleteProfile()`, `getActiveProfileName()`, `setActiveProfile()`.
- 43 new unit tests (131 total) covering scoring constants, `scoreModelForTask`, `getTopRecommendations`, `--profile`/`--recommend` arg parsing, and config profile CRUD.
- **iFlow provider** — new provider with 11 free coding models (TBStars2, DeepSeek V3/V3.2/R1, Qwen3 Coder Plus/235B/32B/Max, Kimi K2, GLM-4.6). Free for individual users with no request limits. API key expires every 7 days.
- **TUI footer contributors** — added contributor names directly in footer line (vava-nessa • erwinh22 • whit3rabbit • skylaweber).

### Changed

- **Help overlay (K)** — removed the Filters section; moved `T` (Cycle tier) and `N` (Cycle origin) shortcuts into their respective column description rows. Added `Q` (Smart Recommend) and `Shift+P` (Cycle profile) shortcuts. Added `--recommend` and `--profile` to the CLI flags section.
- **Sort/pin order** — `sortResultsWithPinnedFavorites()` now pins recommended+favorite models first, then recommended-only, then favorite-only, then normal sorted models.
- **Animation loop priority** — Settings > Recommend > Help > Table.

### Fixed

- **`--profile` arg parsing** — the profile value (e.g. `work` in `--profile work`) was incorrectly captured as `apiKey`; fixed with `skipIndices` Set in `parseArgs()`.
- **`recommendScore` undefined** — `sortResultsWithPinnedFavorites()` referenced `recommendScore` but it was never set on result objects; now set during `startRecommendAnalysis()`.
- **JSDoc in lib/config.js** — fixed broken JSON structure in config example (duplicate lines, incorrect brackets).
- **CHANGELOG cleanup** — removed `[fork]` prefixes from entries for cleaner presentation.
- **Smart Recommend (Q key)** — new modal overlay with a 3-question wizard (task type, priority, context budget) that runs a 10-second targeted analysis (2 pings/sec) and recommends the Top 3 models for your use case. Recommended models are pinned above favorites with 🎯 prefix and green row highlight.
- **Config Profiles** — save/load named configuration profiles (`--profile work`, `--profile fast`, etc.). Each profile stores API keys, enabled providers, favorites, tier filters, ping interval, and default sort. **Shift+P** cycles through profiles live in the TUI.
- **`--recommend` CLI flag** — auto-opens the Smart Recommend overlay on startup.
- **`--profile <name>` CLI flag** — loads a saved profile at startup; errors if profile doesn't exist.
- **Scoring engine** (`lib/utils.js`) — `TASK_TYPES`, `PRIORITY_TYPES`, `CONTEXT_BUDGETS`, `parseCtxToK()`, `parseSweToNum()`, `scoreModelForTask()`, `getTopRecommendations()` for the recommendation algorithm.
- **Profile management** (`lib/config.js`) — `saveAsProfile()`, `loadProfile()`, `listProfiles()`, `deleteProfile()`, `getActiveProfileName()`, `setActiveProfile()`.
- 43 new unit tests (131 total) covering scoring constants, `scoreModelForTask`, `getTopRecommendations`, `--profile`/`--recommend` arg parsing, and config profile CRUD.

### Changed

- **Help overlay (K)** — removed the Filters section; moved `T` (Cycle tier) and `N` (Cycle origin) shortcuts into their respective column description rows. Added `Q` (Smart Recommend) and `Shift+P` (Cycle profile) shortcuts. Added `--recommend` and `--profile` to the CLI flags section.
- **Sort/pin order** — `sortResultsWithPinnedFavorites()` now pins recommended+favorite models first, then recommended-only, then favorite-only, then normal sorted models.
- **Animation loop priority** — Settings > Recommend > Help > Table.

### Fixed

- **`--profile` arg parsing** — the profile value (e.g. `work` in `--profile work`) was incorrectly captured as `apiKey`; fixed with `skipIndices` Set in `parseArgs()`.
- **`recommendScore` undefined** — `sortResultsWithPinnedFavorites()` referenced `recommendScore` but it was never set on result objects; now set during `startRecommendAnalysis()`.

---

## 0.1.67

### Added

- **ZAI provider preserved** — merged upstream v0.1.67 while retaining ZAI (z.ai) provider with 5 GLM models (GLM-5, GLM-4.5, GLM-4.7, GLM-4.5-Air, GLM-4.6). ZAI prefix stripping, OpenCode/Desktop integration, and provider metadata all carried forward.
- **Stability Score** — new composite 0–100 metric combining p95 latency (30%), jitter/σ (30%), spike rate (20%), and uptime (20%). Displayed as a color-coded column in the TUI (green ≥80, cyan ≥60, yellow ≥40, red <40).
- **p95 latency** (`getP95`) — 95th percentile latency from successful pings. Answers "95% of requests are faster than X ms."
- **Jitter** (`getJitter`) — standard deviation of latency. Low jitter = predictable, high jitter = erratic/spiky.
- **"Spiky" verdict** — new verdict that catches models with good average latency but terrible tail latency (p95 spikes). A model with avg 250ms but p95 6000ms now gets flagged as "Spiky 📈" instead of "Perfect 🚀".
- **Stability sorting** — press `B` to sort by stability score. Most stable models rise to the top. `B` key now listed in the footer bar sort keys.
- 24 new unit tests covering p95, jitter, stability score, Spiky verdict, and stability sorting.
- **README: TUI Columns reference table** — full 12-column table documenting every column (Rank, Tier, SWE%, Model, Origin, Latest, Avg, Health, Verdict, Stability, Context, Up%).
- **README: Stability Score section** — documents the formula, weights, color thresholds, and an example calculation.
- **README: Verdict values table** — lists all 7 verdict categories with their emoji, meaning, and criteria.

### Changed

- **"Stab" column renamed to "Stability"** — column header widened from 6 to 11 characters; header text now reads `StaBility` with the `B` sort-key letter in uppercase bold yellow.
- **SWE% column: 8-band color gradient** — replaced the old 3-band color scheme (green ≥50, yellow ≥30, dim otherwise) with an 8-band gradient matching `TIER_COLOR`: ≥70% bright neon green, ≥60% green, ≥50% yellow-green, ≥40% yellow, ≥35% amber, ≥30% orange-red, ≥20% red, <20% dark red.
- `getVerdict()` is now stability-aware: models in "Perfect" or "Normal" avg range get downgraded to "Spiky" when p95 shows extreme tail latency (requires ≥3 pings to avoid false positives).
- `findBestModel()` now uses a 4-key sort: status → avg latency → stability score → uptime (was 3-key: status → avg → uptime).
- `sortResults()` supports new `'stability'` column.
- `VERDICT_ORDER` updated to include "Spiky" between "Slow" and "Very Slow".
- **README: keyboard shortcuts** updated to include `B` for Stability sort; "How it works" diagram updated.
- **Default ping interval → 3 seconds** (was 2s) for a calmer default pace; still adjustable with W/X keys.
- **Verdict colors unified with TIER_COLOR gradient** — Perfect (cyan-green) → Normal (lime) → Spiky (yellow-green) → Slow (orange) → Very Slow (red-orange) → Overloaded (red) → Unstable (dark red) → Unusable (darkest red). Best→worst ordering in code.
- **Footer cleanup** — Removed the BETA TUI warning line. Renamed "Join our Discord" to just "Discord" and placed it next to Contributors on the "Made with love" line.
- **Footer link colors** — Star on GitHub: yellow, Contributors: orange, Discord: light purple. Ctrl+C Exit moved to end of "Made with love" line.
- **Discord plain URL** — Shows `Discord → https://discord.gg/5MbTnDC3Md` so terminals without OSC 8 link support can still see the URL.
- **K Help styling** — Changed from green background badge to neon green text (`rgb(0,255,80)`) with no background.
- **Z Mode styling** — Red-orange color (`rgb(255,100,50)`) matching OpenClaw branding.
- **Selection row styling** — Darker backgrounds: favorite rows `bgRgb(35,20,0)`, cursor rows `bgRgb(50,0,60)`. Model name and Origin rendered in white bold when selected.
- **README** — Updated all ping interval references from 2s to 3s; removed BETA warning line.

### Fixed

- **Column alignment: Health/Status emoji width** — Health column used `.padEnd()` which miscounted emoji width (✅, 🔥, ⏳ etc. are 2 terminal columns but counted as fewer). Switched to `padEndDisplay()` so Verdict, Stability, and Up% columns now align correctly.
- **Verdict emojis moved to end of text** — emojis now appear after the word (e.g., `Perfect 🚀` instead of `🚀 Perfect`) for cleaner left-alignment.
- **Empty cell placeholders** — changed from single `—` to `———` in Latest Ping, Avg Ping, and Stability columns so empty cells have more visual weight and don't look like blank space.

---

## 0.1.66

### Added

- Added 4 new providers: SiliconFlow, Together AI, Cloudflare Workers AI, and Perplexity API.
- Added 23 provider models across these new integrations (OpenAI-compatible endpoints + settings onboarding metadata).
- Added Cloudflare-specific setup guidance in Settings, including explicit `CLOUDFLARE_ACCOUNT_ID` requirement.

### Changed

- Extended provider/env support in config and runtime (`SILICONFLOW_API_KEY`, `TOGETHER_API_KEY`, `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_API_KEY`, `PERPLEXITY_API_KEY`/`PPLX_API_KEY`).
- Extended OpenCode Desktop provider auto-configuration for SiliconFlow, Together AI, Cloudflare Workers AI, and Perplexity API.
- Updated README to reflect current provider/model totals (17 providers / 134 models) and expanded key setup + env variable documentation.
- Updated `P` (Settings) and `K` (Help) overlays with dedicated dark background panels (distinct from the main table) for clearer visual separation.

### Fixed

- Fixed model list scrolling and favorite toggle UX regression introduced after `0.1.65` (cursor/scroll stability when unpinning favorites, last rows reachable).
- Fixed overlay usability on small terminals: `K` (Help) and `P` (Settings) now use viewport scrolling so all content and top rows remain reachable.
- Fixed main table keyboard navigation to wrap around: pressing Up on the first row jumps to the last row, and pressing Down on the last row jumps to the first row.

---

## 0.1.65

### Added

- Added persistent model favorites with `F` key toggle, star marker in Model column, dark-orange favorite highlighting, and pinned-at-top behavior.
- Added manual update maintenance flow in Settings (`P`): check npm updates on demand and install directly from the settings screen.
- Expanded `K` help overlay with complete keybindings (main TUI + settings) and CLI flags usage examples.

### Changed

- Favorites now remain visible and pinned regardless of active sort or tier/origin filters.
- Extended config schema (`~/.free-coding-models.json`) with a persisted `favorites` array (`providerKey/modelId` entries).
- Updated README documentation for favorites, manual updates, settings shortcuts, and config structure.

---

## 0.1.64

### Added

- Added 4 new free providers: Hugging Face Inference, Replicate, DeepInfra, and Fireworks AI (models, key handling, healthchecks, Settings integration).
- Added richer Settings (`P`) provider rows with inline rate-limit summary and live API key test status.

### Changed

- OpenCode launch now detects `tmux` and auto-injects `--port` (`OPENCODE_PORT` if free, otherwise first available `4096-5095`) so sub-agent panes work reliably.
- Updated OpenRouter free model set to include `qwen/qwen3-coder:480b-free`, `mistralai/devstral-2-free`, and `mimo-v2-flash-free`.
- Added SambaNova `Llama3-Groq` coding-tuned entry.
- Updated setup/config docs and env var support for new providers (`HUGGINGFACE_API_KEY`/`HF_TOKEN`, `REPLICATE_API_TOKEN`, `DEEPINFRA_API_KEY`/`DEEPINFRA_TOKEN`).
- Replicate pings now use `/v1/predictions` request format; OpenCode launch for Replicate is guarded with a clear monitor-only message.
- Settings bottom panel now shows provider onboarding steps (signup URL + key creation/test flow) instead of model list details.
- Documented in `AGENTS.md` that top changelog entries must stay clean for direct reuse in GitHub Release notes.

### Fixed

- Settings/onboarding disabled state now uses an explicit red cross (`❌`) instead of a gray square glyph for better terminal font compatibility.

---

## 0.1.63

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
