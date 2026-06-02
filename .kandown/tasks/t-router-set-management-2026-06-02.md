---
id: t-router-set-management-2026-06-02
title: Web router set management (add models + drag-and-drop)
status: Done
priority: high
created: 2026-06-02
---

# Web router set management

## Goal
Replace the read-only "Model Health" section of the Web Router Dashboard
with a fully interactive set manager: add a model from the catalog to the
active set, remove it, and drag rows to reorder priorities.

## Sub-tasks

- [x] Daemon: `POST /sets/:name/models` to append a model
- [x] Daemon: `DELETE /sets/:name/models` to remove a model
- [x] Daemon: `POST /sets/:name/reorder` to accept a new order
- [x] Daemon: `POST /sets/:name/sync` to re-probe with real keys
- [x] Daemon: `GET /api/router/catalog` for the Add picker
- [x] Web: proxy all new endpoints
- [x] RouterView: replace static Model Health with Set Manager
- [x] Add model picker (search + provider filter)
- [x] Drag-and-drop reordering (HTML5 native)
- [x] Up/down buttons as accessible fallback
- [x] Save indicator
- [x] "Sync best" button (probe-driven rebuild)
- [x] Tests for new endpoints + proxy (6 new)
- [x] Update README + changelog v0.5.12
- [x] Run `pnpm test` + `pnpm start` (495/495 ✅)

## Notes
- Fixed a pre-existing routing bug: JS switch only matches literal cases,
  so the parameterized `/api/router/sets/:name/...` routes were silently
  404-ing inside the v0.5.11 web build. Moved them above the switch as
  `if (regex)` blocks.
- "Default to working models" is now real for new users too:
  `buildDefaultRouterSet` is async and accepts a probe fn that POSTs a
  1-token chat-completion to each candidate, so the default set is
  made of models that actually return 2xx with the user's keys.
- The probe budget for the Web sync is capped at 16 candidates (vs 50
  for the CLI) so the UI stays snappy under 60s.
