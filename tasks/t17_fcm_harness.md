---
id: t17
title: fcm-harness
status: In Progress
created: 2026-09-08
updated: 2026-09-08T21:52:43Z
---

# fcm-harness - Living Spec

> **Status: SPEC PHASE.** This file is the single source of truth for the fcm-harness idea while we refine it with vava (grill rounds). Nothing is final until the open questions close. Keep everything in this one task for now (vava's call).

## Pitch

Download the app, create your free API keys through the wizard, work. The thing that works everywhere in two seconds. fcm-harness is a standalone cross-platform desktop GUI client (macOS / Windows / Linux) that embeds pi and the free-coding-models Smart Router: 100% free models, best SWE-scored model picked automatically, zero config beyond pasting keys.

## Settled decisions (grill round 1, 2026-09-08)

- **D1 - Own shell.** We build our own client, no fork. Tauri v2 per `desktop/prd-desktop.md`. Forking T3 Code rejected (MIT, but 6 hardcoded agents, no custom-provider API, upstream takes no feature PRs: we would carry a whole app to rip out its heart). BB is not the host either (not our shell, no shippable wizard, 3 manual installs for the user).
- **D2 - Engine locked to pi.** No engine picker, ever. The only user-facing model settings are a max context window and capability toggles (vision, etc.). A selector would recreate the complexity this product exists to kill.
- **D3 - All model traffic goes through the local router.** pi is configured with exactly ONE custom provider: the fcm Smart Router daemon at `localhost:19280` (OpenAI-compatible + Anthropic `/v1/messages`), model `fcm`, key `fcm-local`. Router v2 does best-SWE selection, pre-stream failover, garbage-output detection, quota-aware pauses, circuit breakers. We do not reimplement any of it.
- **D4 - UI foundation: beautifului.dev.** Shadcn-style copy-paste components built specifically for AI-native interfaces (chat agents, thinking states, human-in-the-loop approvals). Used inside the Tauri webview, consistent with the React/Tailwind conventions of `web/src/`.
- **D5 - 100% free, forever.** Only free-tier providers from the fcm catalog. No paid fallback, no paid tier, no upsell.

## Architecture (extends desktop/prd-desktop.md)

**Reused from the existing PRD** (do not re-decide these):
- Shared core engine in `src/core/` (sources, scoring, ping, config, router-daemon).
- Node sidecar packaging: Bun compile primary, Node SEA fallback (see PRD §4 for the codesigning caveat).
- The same React dashboard (`web/src/`) for keys, catalog, router dashboard, token stats.
- Port 19280 consistency, sidecar lifecycle / zombie prevention, daemon-ownership tracking (PRD §4.1).

**New layers the harness adds on top:**

1. **Onboarding wizard (this IS the product).**
   - First launch: checklist of free providers ordered by free value, deep links to each key-creation page, paste field, live probe validation (reuse the ping infrastructure), Save.
   - Writes `~/.free-coding-models.json` (0o600) like the CLI does, so CLI and harness share one config.
   - Recommends 3+ keys minimum for real failover; shows live "coverage" (how many models the entered keys unlock).
2. **pi embedded over its official RPC mode.**
   - pi has a headless JSON-over-stdio RPC mode (`pi --mode rpc`, `packages/coding-agent/docs/rpc.md`) designed exactly for embedding. The harness spawns pi as a child process and renders everything natively: no fork, upstream updates come free.
   - pi binary bundled with the app; provider config written once (the router); `fcm-pi` extension preinstalled.
   - GUI renders threads, streaming, tool calls, diffs, approval prompts using beautifului.dev components.
3. **Harness presets (capability filters).**
   - Default policy: "best SWE available, always". User may cap max context window and toggle capabilities (vision...).
   - Implemented as generated router sets, logic in `src/core` (extends `sync-set`) so TUI, web dashboard and desktop share the exact same behavior (cross-surface mandate).
4. **App shell.**
   - Single-window GUI first. Tray-only mode, autostart, global hotkey stay PRD Phase 3 concerns. Signing + auto-update before any public release.

## Constraints

- **Cross-surface mandate:** all routing/selection/filter logic lives in `src/core`; the harness is the desktop surface and must not break TUI or web/Docker.
- **Zero AI slop:** real catalog data only, no placeholder chips or fake cards.
- **pi upstream, not fork:** the RPC contract is the integration boundary; track upstream, report bugs upstream.

## Out of scope (for now)

- Forking T3 Code; BB as the product host.
- Multi-engine GUI (opencode, openclaw...) behind the harness.
- Paid models or paid fallbacks.
- BB-style plugins, automations, remote/mobile access (v2+ candidates, see open questions).

## Open questions (grill frontier)

- **OQ1 - v0 GUI scope:** mono-session (open folder → one thread, composer, streaming, diffs, approvals) vs multi-session with threads sidebar from day one. vava leaning GUI (beautifului.dev chosen); recommendation: mono-session v0, sidebar v1.
- **OQ2 - "Evolutive like bb":** which bb traits to copy and in what order (sessions sidebar, multi-project, remote/mobile access, plugins, automations). Recommendation: sessions + multi-project first, remote later.
- **OQ3 - Repo placement:** `desktop/` inside the main repo (PRD's choice, shares `web/dist` + core, one CI) vs standalone `fcm-harness` repo consuming fcm via npm (own branding, duplicated dashboard, version sync). Recommendation: main repo, brand as fcm-harness at release.
- **OQ4 - Wizard provider shortlist:** propose from `sources.js` ordered by free value (NVIDIA NIM, Groq, Cerebras, Mistral, Gemini, OpenRouter...). Default decided from catalog facts, vava amends.
- **OQ5 - beautifului.dev fit:** verify license, React/Tailwind versions, compat with `web/src` stack before committing.
- **OQ6 - Name, icon, signing/notarization, auto-update:** block only the public release, not development.

## Notes / facts found (2026-09-08)

- T3 Code (pingdotgg/t3code): MIT, Electron, "agent harness control surface", agents hardcoded (Claude Code, Codex, Cursor, Grok Build, OpenCode, Antigravity), no plugin/provider API, upstream "mostly" not accepting contributions.
- BB (getbb.app): full agent host (threads, projects, machines, plugins, mobile via connect). Pi is a natively supported provider. Could host fcm via a custom model pointing at the router, but that is a dogfood recipe, not the product.
- pi RPC mode: headless JSON over stdin/stdout, officially "useful for embedding the agent in other applications".
- beautifului.dev: "crafted primitives for AI-native interfaces": copy-paste components for chat agents, thinking states, human-in-the-loop approvals.

## Spec-phase checklist

- [ ] Round 2 decisions recorded (OQ1, OQ2, OQ3)
- [ ] pi RPC surface documented (commands, events, approvals, sessions)
- [ ] beautifului.dev license + stack fit confirmed
- [ ] Wizard provider shortlist drafted from catalog
- [ ] v0 milestone list drafted
- [ ] vava sign-off on the spec, then promote to a real PRD (desktop/ or dedicated)
