## [0.3.57] - 2026-05-04

### Added

- **Major free-model catalog refresh** — Rebuilt the active catalog to **180 models across 16 vetted free or free-limited providers**.
- **GitHub Models provider** — Added GitHub Models with 15 API models and `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_MODELS_TOKEN` support.
- **Mistral La Plateforme provider** — Added a general Mistral provider for Experiment-plan usage, separate from the existing Codestral shortcut provider for backward compatibility.
- **OpenRouter live free-model coverage** — Added current free models such as `tencent/hy3-preview:free`, Poolside Laguna, Ling 2.6, Nemotron 3, OpenRouter Free, Owl Alpha, Gemma 4, and LFM free models.
- **Smart Router Daemon** — Added a local OpenAI-compatible daemon with model failover, health tracking, daemon status, dashboard integration, and router set persistence.
- **`--sync-set` router discovery** — Added automatic model discovery and live probing for configured providers so router sets can be rebuilt from working models.
- **Router Dashboard** — Added a local web dashboard for router health, latency heatmaps, failover activity, and quota visibility.
- **Kilo CLI integration** — Added Kilo as a launch target and endpoint install target.
- **Discord commit log webhook** — Added `DISCORD_WEBHOOK_URL` support for compact push notifications.
- **Graphify integration** — Added codebase graph analysis artifacts and tracking support for architecture inspection.

### Changed

- **Free-provider policy tightened** — Removed paid-only, trial-credit-only, shutdown, extremely tiny-credit, unclear, and tool-specific providers from the active catalog.
- **Providers removed from active core** — `iFlow`, `Together AI`, `Perplexity API`, `DeepInfra`, `Replicate`, `Fireworks`, `Hyperbolic`, `Hugging Face`, `SiliconFlow`, `Chutes AI`, and `Rovo` are now documented outside the core free-provider list when useful.
- **Provider catalogs refreshed** — Updated NVIDIA NIM, OpenRouter, Google AI Studio, Gemini CLI, Cloudflare Workers AI, OVHcloud AI Endpoints, ZAI, SambaNova, Scaleway, Qwen DashScope, and OpenCode Zen model IDs.
- **SambaNova catalog corrected** — Reduced the provider to the current public model set and restored `DeepSeek-V3.2` after verifying it is present in the live `/v1/models` endpoint.
- **Google/Gemini IDs corrected** — Replaced stale Gemma-style IDs with current Gemini API model IDs for Google AI Studio and Gemini CLI.
- **ZAI catalog reduced** — Kept only free Flash models in the active provider list.
- **Scaleway EOL cleanup** — Removed EOL entries from the active Scaleway list and kept only useful current text models.
- **Codestral key handling normalized** — `MISTRAL_API_KEY` is now the primary environment variable; `CODESTRAL_API_KEY` remains accepted as an alias.
- **OpenRouter free detection improved** — Live OpenRouter discovery now treats zero-priced public models as free even when their ID does not end in `:free`.
- **Provider filters now derive from the catalog** — Command Palette provider filters are generated from `sources`, so new providers do not need a hardcoded UI update.
- **Router model set expanded** — Default router candidate selection now supports up to 8 models and uses refreshed high-ranking defaults.
- **External tool configs generalized** — OpenCode and Kilo can now auto-configure newly added OpenAI-compatible providers through shared provider metadata.
- **Footer collapse removed** — The main TUI table now always keeps the full footer visible, matching the sticky header behavior and avoiding hidden navigation hints.
- **Main table header simplified** — Removed the extra `Search / Tier / Provider / Verdict / Health` filter row from the primary TUI table. Active tier/provider state still appears in the title row, and the column header now sits directly under the app/version row.
- **Router UI hidden from the main flow** — Removed the visible Smart Router upgrade banner, footer daemon status, help entry, command palette entry, and README TUI shortcut documentation. The router implementation stays available, but the main table no longer advertises it.
- **Footer now sticks to the terminal bottom** — The footer is padded into the bottom rows even when only a few models are visible, while the header remains fixed at the top.
- **Release docs narrowed for router** — README now documents router CLI commands without promoting the in-TUI dashboard path to normal users.

### Fixed

- **Sticky TUI header visibility** — Fixed the main table line budget so the app/version row, column headers, model rows, and footer are all reserved before rows are rendered. This prevents the alternate screen from scrolling the header out of view.
- **Shift+R router shortcut restored** — Re-enabled `Shift+R` as an unadvertised tester shortcut after it had been temporarily disabled.
- **Footer line budgeting hardened** — Optional update, custom-filter, and release-date footer rows are now included in viewport calculations so temporary footer rows cannot push the table header off-screen.
- **Router upstream hardening** — Fixed unsupported request parameter stripping, retryable failover behavior, content-type canonicalization, and long-stream timeout handling.
- **Router auth/quota semantics** — Router now returns 401/429 when all candidates fail because of auth or quota instead of masking those cases as 503.
- **OpenRouter sync-set filtering** — Router discovery no longer drops `openrouter/free` and `openrouter/owl-alpha` just because their IDs do not end with `:free`.
- **Provider key probes** — Updated probe model priorities for NVIDIA, SambaNova, GitHub Models, and Mistral to avoid stale or slow first-choice checks.
- **OpenCode Desktop launcher** — Fixed launcher setup for newly added OpenAI-compatible providers such as GitHub Models and Mistral.
- **pnpm lock conflict** — Regenerated the lockfile from `package.json` to resolve the merge conflict state.

### Docs

- **README provider table updated** — Updated badges, provider count, model count, free-tier descriptions, environment variables, audit cleanup notes, and caveats.
- **Provider inclusion policy documented** — Added explicit notes explaining why Vercel AI Gateway, Cohere, Ollama Cloud, trial-credit providers, and tiny-credit providers are not treated as core free providers.
- **Other Free AI Resources reorganized** — Moved curated external resources to the bottom of the README and separated permanent free tiers from trial-credit providers.
- **Router PRD and sync-set docs** — Added and updated router design notes and `--sync-set` documentation.
- **Contributors updated** — Added new contributor acknowledgements.

### Dependencies

- **react** bumped to 19.2.5.
- **vite** bumped to 8.0.10.
- **vite-plus** bumped to 0.1.20.
- **pnpm/action-setup** bumped to 6.
