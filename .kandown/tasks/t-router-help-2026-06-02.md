---
id: t-router-help-2026-06-02
title: Human-friendly router health labels + How-it-works help
status: In Progress
priority: medium
created: 2026-06-02
---

# Router health: human-friendly labels + help modal section

## Goal

The router uses `CircuitBreaker` state names (CLOSED, OPEN,
HALF_OPEN, AUTH_ERROR, STALE) that are correct but jargon. A new user
looking at the Router Dashboard sees `state: CLOSED` and has no idea
what it means. The fix has two parts:

1. **Human-readable labels in the UI** — translate the raw state
   names into words a normal developer can scan in <1 second.
2. **"How the router works" section in the Web Help modal** — explain
   the circuit breaker, the probe mechanism, the failover order, and
   the pre-prompt, so the user doesn't have to dig through the README.

## Why it matters

The user asked "c'est quoi CLOSED" because the label is meaningless
without context. A new user looking at the dashboard should be able
to tell at a glance which models are healthy, which are dying, and
which have a broken key — without learning the FCM-specific
terminology.

## Sub-tasks

- [ ] Rename the `CircuitBadge` states in `web/src/components/router/RouterView.jsx`:
  - `CLOSED`      → "Healthy"     (green)
  - `OPEN`        → "Down"        (red)
  - `HALF_OPEN`   → "Recovering"  (yellow)
  - `AUTH_ERROR`  → "Auth error"  (orange)
  - `STALE`       → "Deprecated"  (gray)
- [ ] Same translation in `web/src/components/router/RouterView.jsx`
      for any other state badges (request log, etc.)
- [ ] Add a "How the router works" section to `web/src/components/help/HelpView.jsx`:
  - Circuit breaker states (Healthy / Down / Recovering / Auth error)
  - Probe mechanism (real chat-completion ping every 10s/30s/120s)
  - Failover order (priority 1 → 2 → 3, skip broken)
  - Auto-heal on startup
  - Pre-prompt (system message injected on every request)
  - Quick Setup block (Base URL + model = fcm)
- [ ] Add a small "(?) what is this" link next to the section title
      in the Router Dashboard that opens the Help modal
- [ ] Tests for the label translation
- [ ] Update changelog v0.5.14
- [ ] Run pnpm test
