---
id: t-favicons-2026-06-01
title: Web favicon — generate all variants from /icon.png
status: Done
priority: high
created: 2026-06-01
---

# Web favicon: full icon set

## Goal
Use the project root `icon.png` (1254x1254) as the single source of truth
and generate a complete favicon set for the `/web` dashboard: classic `.ico`,
PNG sizes (16/32/48/96/192/512), Apple touch icon, Android Chrome,
Microsoft tiles, and a PWA webmanifest. Wire them into `web/index.html`
and the Vite build pipeline so the dashboard serves them on every surface.

## Sub-tasks
- [x] Create `scripts/build-favicons.mjs` (zero-dep, uses ImageMagick `magick` or `convert`)
- [x] Generate assets into `web/public/favicons/`
- [x] Generate `web/public/favicon.ico` (multi-size: 16/32/48)
- [x] Create `web/public/favicons/site.webmanifest`
- [x] Update `web/index.html` with all `<link rel>` tags
- [x] Hook script into `build:web` (prebuild)
- [x] Test: `pnpm build:web` succeeds, dist contains the assets
- [x] Add changelog entry under `v0.5.4`

## Completion report
- Generated and committed the full favicon/PWA asset set from the root `icon.png`.
- Hardened `scripts/build-favicons.mjs` for both ImageMagick v7 (`magick`) and v6 (`convert`) so local macOS, npm release CI, and Docker CI all work.
- Wired favicon metadata into `web/index.html` and included generated files under `web/public/` for Vite copy-through.
- Release note moved into `changelog/v0.5.4.md` because `0.5.2` never shipped and `0.5.3` failed.
