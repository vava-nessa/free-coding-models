---
id: t12
title: Catalog Live mode (beta): dynamic provider discovery over static seed
status: Backlog
created: 2026-09-05
updated: 2026-09-05T01:56:06Z
---

## Goal

Add an opt-in `Catalog: Static | Live (beta)` setting so the app discovers new and
removed provider models dynamically at startup, merged OVER the static `sources.js`
seed instead of replacing it. Kills most of the manual catalog-scan upkeep without
losing the editorial layer (tiers, SWE-bench scores, EOL history).

## Context / decisions (with vava, 2026-09-05)

- Dynamic-only was rejected: no API exposes SWE scores, tiers, or a uniform
  free-vs-paid flag, and half the providers require a key even to list models.
- Live mode is therefore a discovery layer: static seed stays the base of truth.
- Opt-in beta first (settings toggle), never default, never blocking startup.

## Facts gathered (2026-09-05)

- Keyless `GET /v1/models` works on 6 of 23 providers: openrouter (431 models),
  kilo (371), orcarouter (193), opencode-zen (66), llm7 (46), ollama-cloud (19).
- All other providers return 401 without a key; discovery runs only when a key is
  configured (which the TUI user typically has for the providers they use).
- Free/paid signals are provider-specific: openrouter exposes pricing ($0),
  llm7 exposes `tier=turbo` + `usage_based_only`, NIM lists everything until 410.
  Per-provider filter logic required.

## Acceptance criteria

- [ ] Settings screen row `Catalog: Static | Live (beta)`, persisted in
  `config.settings.catalogMode` (default `static`).
- [ ] Discovery runs in the background for: the 6 keyless providers + every
  provider with a configured API key. Never blocks TUI/web/desktop startup.
- [ ] Merge policy: static seed entries always shown; live-only models appear
  with a `🌱 new (unverified)` badge; static models absent from the live list
  get `⚠️ possibly gone` (runtime auto-hide stays as-is).
- [ ] Unverified (live-only) models are excluded from `--best`, `--fiable`,
  `findBestModel` and Smart Recommend.
- [ ] 24h cache for discovery results (reuse probe-cache / models-dev-fetcher
  TTL patterns); network failure or empty list falls back to the static seed.
- [ ] Implemented in shared core so TUI, web daemon and desktop all get it
  (cross-surface mandate).
- [ ] Unit tests for the merge logic (pure function in `src/core/`, tested like
  `model-merger.test.js`).
- [ ] README + website docs updated; changelog entry at release time.

## Out of scope

- Replacing or deleting `sources.js` (stays the seed + metadata overlay).
- Auto-probing live-only models on discovery (decide after beta feedback).
- CI auto-drift PR (weekly keyless catalog diff against `sources.js`) — candidate
  follow-up task, shares the per-provider filter logic with this one.
