---
id: t19
title: Custom OpenAI-compatible providers in config (GH #197)
status: Backlog
created: 2026-09-29
updated: 2026-09-29T11:15:49Z
---

# t19 - Custom OpenAI-compatible providers in config

Source: GitHub issue #197 (karneaud, Docker user with local providers).

## Goal

Let users declare their own OpenAI-compatible endpoints (Ollama, llama.cpp, LM Studio, vLLM, corporate gateways) in `~/.free-coding-models.json` and have them behave like first-class providers.

## Constraints

- Must work on all three surfaces: TUI, web dashboard/daemon, router `/v1` proxy.
- Needs base URL, quota model, rate limits, health probe metadata, not just a URL string.
- Must not break the static `sources.js` catalog (custom providers are additive).

## Acceptance criteria

- [ ] `customProviders` config section parsed + validated in `src/core/config.js`
- [ ] Custom providers appear in TUI, dashboard, and router candidate lists
- [ ] Health probes work against custom base URLs
- [ ] Docs + changelog + tests

## Out of scope

- Non-OpenAI-compatible APIs (GraphQL, native SDKs).
