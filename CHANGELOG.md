# Changelog

---

## 0.2.6

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
  - Fixes bug where switching profiles would cause API keys to disappear
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
