# fcm-opencode

Beta OpenCode plugin for `free-coding-models`.

## What it does

- Stays light on OpenCode startup: cache/daemon only, no direct probe unless requested.
- Adds `/fcm`, `/fcm-status`, and `/fcm-router` commands.
- Reuses the same scan/ranking/safety code as `fcm-pi`.
- Injects FCM providers into OpenCode config using `fcm-*` provider IDs.
- Never switches model on startup; switching requires `/fcm 1`, `/fcm best`, or `/fcm router`.

## Local install while developing

Symlink the plugin file so relative imports still point back to this repository:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf /Users/vava/Documents/GitHub/free-coding-models/opencode-plugin/index.js \
  ~/.config/opencode/plugins/fcm-opencode.js
```

Restart OpenCode, then use:

```txt
/fcm           # scan and list top choices
/fcm 1         # switch to rank #1 explicitly
/fcm best      # switch to best explicitly
/fcm rescan    # force a fresh scan
/fcm status    # diagnostics
/fcm router    # switch to local FCM Smart Router daemon
```

## Notes

OpenCode plugins cannot currently show a Pi-style interactive picker from the public API, so the first implementation is rank-number based. It is still explicit: listing models does not switch; `/fcm 1` or `/fcm best` does.
