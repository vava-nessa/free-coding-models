---
id: t21
title: Fix GH #208: dashboard Delete key persistence
status: Done
created: 2026-11-22
updated: 2026-11-22T16:32:05Z
---

# GH #208 - "Delete key" in Settings does not remove the stored API key

## Goal

Pressing `Delete key` in the Web Dashboard Settings must remove the provider key from
the config file and from the live in-memory credentials, on every surface that serves
the dashboard (`web/server.js` dev/npm mode and `src/core/router-daemon.js` Docker mode).

## Constraints

- Preserve env-var precedence in `getApiKey` (env > config apiKeys > customProviders).
- Never touch unrelated providers, favorites, router settings, or other config keys.
- Same-origin protection on `POST /api/settings` stays untouched.
- No public API shape change: the dashboard keeps sending `{ apiKeys: { <provider>: '' } }`.

## Acceptance criteria

1. `POST /api/settings { apiKeys: { groq: '' } }` deletes `apiKeys.groq` from disk and from the live config object.
2. Unrelated keys in the config file survive the delete (no merge resurrection).
3. Env-var-only providers stay authenticated after a delete, and a stored key never overrides env.
4. Regression tests cover both server surfaces.
5. Dashboard UI refreshes to the "no key" state after a successful delete.

## Checklist

- [x] Read issue #208, repo AGENTS.md, kandown work
- [x] Trace SettingsView POST /api/settings into core config (web/server.js, router-daemon.js)
- [x] Reproduce the delete failure with an isolated config dir
- [x] Fix the surface that resurrected the deleted key
- [x] Regression tests (4, both surfaces)
- [x] Focused then full checks, smoke start with isolated config
- [x] Commit locally

## Root cause

`SettingsView.deleteKey()` posts `{ apiKeys: { <provider>: '' } }`.

- `web/server.js` (dev/npm dashboard, `--web`, port 3333) already routes this through
  `persistApiKeysForProvider()` since v0.5.96 (PR #195). Verified working end to end.
- `src/core/router-daemon.js` (Web Dashboard / Docker on :19280) deleted the key from
  the in-memory config and then called a plain `saveConfig(this.config)`.
  `buildPersistedConfig()` merges apiKeys as `{...disk, ...incoming}` to protect against
  stale writers, so the key that had just been deleted came straight back from the disk
  snapshot. Reproduced: POST returned `{ success: true }`, disk kept `groq`, `/api/config`
  still reported `hasKey: true`. That is exactly the report: field keeps the old value,
  provider stays authenticated.

Secondary issues found in the same handler:

- `saveConfig()` returns `{ success: false }` on failure instead of throwing, and the
  handler ignored the return value inside a `try/catch`, so a failed write was reported
  as success.
- The handler bypassed the runtime's `persistConfig: false` test guard, so unit tests
  rewrote the developer's real `~/.free-coding-models.json`.

## Changes

- `src/core/router-daemon.js`
  - New `persistApiKeyForProvider(providerKey)` and `persistSettings()` runtime methods:
    single write paths that honor `persistConfig: false` and log failures.
  - `POST /api/settings` now mutates one provider at a time and persists through
    `persistApiKeysForProvider()` (replaceApiKeys on disk + live config refresh), then
    saves provider toggles through `persistSettings()` and returns HTTP 500 with the real
    error when a write fails. Keys are trimmed; empty string / empty array / null deletes.
  - `createRouterRuntimeForTest()` accepts `persistConfig` (default still false) so a test
    can exercise the real disk round-trip against a throwaway `FCM_CONFIG_DIR`.
- `web/src/components/settings/SettingsView.jsx`
  - `deleteKey()` also clears the local draft input and the stale per-provider test badge
    so no stale state lingers after a delete.
- `test/settings-delete-key.test.js` + `test/fixtures/{daemon,web}-settings-delete-key.mjs`
  - 4 regression tests: config helper delete/add, daemon HTTP surface (delete + unrelated
    provider + provider toggle + env precedence), web dashboard surface.
- `docs/router.md`, `web/README.md`: document the empty-string delete contract.

## Evidence (reproducible)

- Before fix (daemon surface, isolated `FCM_CONFIG_DIR`):
  `POST { apiKeys: { groq: '' } }` -> `200 {"success":true}`,
  `/api/config` `groq.hasKey: true`, disk `apiKeys: { groq, nvidia }`.
- After fix, `node --test test/settings-delete-key.test.js` -> 4/4 pass; on the pre-fix
  handler the same test fails with `deleted key must disappear from /api/config`.
- `pnpm test` -> 1209 tests, 246 suites, all pass.
- Smoke, real daemon on :19280 with isolated config: `GET /` 200 (dashboard HTML),
  delete removes `groq` from disk and `/api/config`, `nvidia` key + favorites intact,
  provider toggle persisted.
- Dashboard UI click-through on that daemon surface: Settings -> filter `groq` ->
  `Delete Key` -> card flips from "Working / ••••••••1234" to "No key", toast
  "API key for groq deleted", disk keeps only the nvidia key.
- TUI smoke (`pnpm start` equivalent in tmux, isolated config): starts and renders.

## Known limitations

- The TUI and `web/server.js` delete paths were already correct and are now covered by
  tests; no behavior change there.
- `getApiKey()` env precedence is untouched, so a provider whose key comes from an env
  var still shows as configured after a delete. That is intended.
- No version bump / npm release / push: out of scope for this ticket.
- No changelog entry yet: `changelog/vX.Y.Z.md` belongs to the release step and several
  agents are working in parallel, so the release owner should add the line.
- Pre-existing, unrelated: the repo test suite writes `~/.free-coding-models.json` from
  checkouts that predate this fix (the `/api/settings` tests plus router fixture tests).
  With this fix, two consecutive full runs left the file byte-identical.

## Combined release
Integrated and published with catalog audit in0.6.2 at373ae64. Combined suite1254passes, dashboard/site builds pass; actual npm package globally installed and help verified. See tasks/t20_audit_all_24.md for release evidence.
