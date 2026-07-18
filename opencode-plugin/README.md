# fcm-opencode (legacy compat wrapper)

> ⚠️ This folder is a **thin re-export wrapper** kept so existing `~/.config/opencode/plugins/fcm-opencode.js` symlinks (which point here) keep working after the shared-core extraction.

The real OpenCode adapter now lives in **[`packages/fcm-opencode`](../packages/fcm-opencode)**, and all shared scan/rank/cache/provider logic lives in **[`packages/fcm-agent-core`](../packages/fcm-agent-core)**.

## What's here

- `index.js` — re-exports the canonical adapter from `packages/fcm-opencode`.

## New installs

Symlink directly to the canonical package:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf /Users/<you>/Documents/GitHub/free-coding-models/packages/fcm-opencode/index.js \
  ~/.config/opencode/plugins/fcm-opencode.js
```

See [`packages/fcm-opencode/README.md`](../packages/fcm-opencode/README.md) for commands and limitations.
