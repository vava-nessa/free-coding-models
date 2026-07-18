# fcm-opencode

OpenCode plugin for **free-coding-models**.

> ⚠️ **BETA** — Consumed via local symlink inside the `free-coding-models` repo for now.

The OpenCode adapter for the same FCM scanner/ranker used by [`fcm-pi`](../fcm-pi). All shared logic (scan, rank, cache, daemon, API keys, provider descriptors) lives in [`fcm-agent-core`](../fcm-agent-core); this plugin owns only OpenCode config mutation, command hooks, toasts, and shell env.

## What it does

- **Light startup** — cache first, daemon second, no direct probe unless requested. OpenCode boot never freezes.
- Adds `/fcm`, `/fcm-status`, and `/fcm-router` commands.
- Injects FCM providers into OpenCode config using `fcm-*` provider IDs.
- **Never switches on startup** — switching requires `/fcm 1`, `/fcm best`, or `/fcm router`.

## Commands

| Command | Description |
|---------|-------------|
| `/fcm` | Scan and list ranked choices **without switching** |
| `/fcm 1` / `/fcm 2` / … | Explicitly switch OpenCode config to ranked model #N |
| `/fcm best` | Explicitly switch to the best ranked model |
| `/fcm rescan` | Force a fresh scan |
| `/fcm status` (or `/fcm-status`) | Diagnostics (cache, daemon, active model) |
| `/fcm router` (or `/fcm-router`) | Switch to the local FCM Smart Router daemon |

## Local install (symlink)

Symlink the plugin so relative imports still resolve back into this repo:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf /Users/<you>/Documents/GitHub/free-coding-models/packages/fcm-opencode/index.js \
  ~/.config/opencode/plugins/fcm-opencode.js
```

> The legacy `opencode-plugin/` folder at the repo root is kept as a thin re-export wrapper, so existing symlinks keep working. The `packages/` tree also needs a one-time self-link — see [`fcm-agent-core/README.md`](../fcm-agent-core/README.md#local-setup-why-a-self-link-is-needed).

## Notes & limitations

- OpenCode plugins cannot currently show a Pi-style interactive picker from the public API, so model selection is rank-number based. It is still explicit: listing does not switch; `/fcm 1` or `/fcm best` does.
- API keys are never inlined into config — they are referenced via `{env:FCM_<PROVIDER>_API_KEY}` and exported through the `shell.env` hook.
- Cross-tool cache: this plugin reads its own cache first, then falls back to the Pi cache (`~/.pi/agent/fcm-cache.json`), so a scan in one tool benefits the other.
