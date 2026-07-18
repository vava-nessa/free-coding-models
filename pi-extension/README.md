# fcm-pi (legacy compat wrapper)

> ⚠️ This folder is a **thin re-export wrapper** kept so existing `~/.pi/agent/settings.json` local-path installs keep loading after the shared-core extraction.

The real Pi adapter now lives in **[`packages/fcm-pi`](../packages/fcm-pi)**, and all shared scan/rank/cache/provider logic lives in **[`packages/fcm-agent-core`](../packages/fcm-agent-core)**.

## What's here

- `extensions/index.js` — re-exports the canonical adapter from `packages/fcm-pi`.
- `test-cerebras-error.js` + `request-params.json` — standalone dev artifacts (a captured Cerebras error payload), unrelated to the adapter runtime.

## New installs

Point Pi directly at the canonical package:

```jsonc
// ~/.pi/agent/settings.json
{
  "packages": ["/Users/<you>/Documents/GitHub/free-coding-models/packages/fcm-pi"]
}
```

See [`packages/fcm-pi/README.md`](../packages/fcm-pi/README.md) for features, commands, and the one-time `packages/` self-link setup.
