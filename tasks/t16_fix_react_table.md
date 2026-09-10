---
id: t16
title: Fix react-table v9 migration so dependabot PR 180 builds
status: Done
created: 2026-09-08
updated: 2026-09-10T15:51:46Z
assignee: zcode
---

## Checklist

- [x] Migrate web/src/components/dashboard/ModelTable.jsx to the v9 feature API (useTable + createCoreRowModel + columnSizingFeature + columnResizingFeature, pushed to the dependabot branch)
- [x] Verify PR 180 in an isolated worktree: pnpm install, pnpm test, pnpm build:web
- [x] Visual runtime check: table renders, header sort, drag resize, reset columns, zero console errors
- [x] Merge PR 180 (d8880e0)

## Evidence

- Worktree verification of pull/180/head: 1121/1121 tests pass after web build (the only red test, "serves static index.html for root path", is the expected 503 when web/dist is absent), clean vite build.
- Dashboard on port 3333 via Playwright: 19 headers, live rows painting, header click sets ?sort=label&dir=asc and re-sorts, column drag 200px to 260px persists in fcm.columnSizing.v1, Reset columns restores 200px and clears storage. 0 console errors/warnings.
- Migration reviewed against installed 9.2.4: no v8 leftovers in web/src (ModelTable.jsx is the only react-table consumer), SortIcon removal left no dangling refs, sorting is external via useFilter so rowSortingFeature is intentionally not registered.
- Follow-up found and fixed on main: DEFAULT_COLUMN_SIZING missed the 10 accessor columns (defs carry accessorKey, not id), making per-column double-click reset a no-op. Fixed in 9e13435, browser-verified (label 300 -> 200, storage entry removed). Full suite after merge: 1154/1154 pass.
