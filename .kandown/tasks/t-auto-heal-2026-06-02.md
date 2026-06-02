---
id: t-auto-heal-2026-06-02
title: Auto-heal broken router set on startup
status: Done
priority: high
created: 2026-06-02
---

# Auto-heal broken router set on startup

## Goal

On daemon startup, the active set is checked for models that are in
AUTH_ERROR / TIMEOUT / 5xx state. Any broken model is swapped for a
working alternative from the same provider (or any provider if no
same-provider candidate works). The set stays healed until the user
manually edits it.

## Sub-tasks

- [x] Add `autoHealActiveSet()` in router-daemon
- [x] Run after the initial probe burst (3 passes at 8s/24s/40s)
- [x] Add `router.autoHeal` config flag (default: true)
- [x] Add `router.userCustomized` flag (set on first manual edit)
- [x] Log each replacement clearly
- [x] Broadcast `set_change` so the UI refreshes
- [x] Detect "the user's whole <provider> is dead" and skip it
- [x] Surface `autoHeal`, `userCustomized`, `brokenModelCount` in /api/router/status
- [x] Amber banner in Web Router Dashboard with "Fix now" button
- [x] Tests for the heal logic (4 new)
- [x] Update changelog v0.5.13
- [x] Update README
- [x] Run pnpm test (515/515 ✅)
