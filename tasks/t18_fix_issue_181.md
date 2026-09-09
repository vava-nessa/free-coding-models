---
id: t18
title: Fix issue #181: opencode-zen session header + cloudflare account URL + nvidia catalog
status: Done
created: 2026-09-09
updated: 2026-09-09T17:08:03Z
---

## Checklist

- [x] Part 1: send x-opencode-session on every path reaching the Zen gateway (commit 04bb14c)
- [x] Part 3: resolve Cloudflare account-scoped URL on every request path + zero-setup discovery (commit a5785bf)
- [x] Part 2: live NIM audit, MiniMax M3 removal, audit comment, counts synced (commit ff000e8)
- [x] Review-agent pass: verdict BUMP-READY, 0 blockers (nits fixed in 71f939b)
- [x] Full verification: pnpm test 1154/1154 pass, TUI boots and probes live in tmux
- [x] Version bump + npm publish verification

## Evidence

- Zen end-to-end: ping() on big-pickle without key returned 401 (auth gate) instead of 400 MissingSessionID; direct API check: 400 without header, 200 with header.
- Cloudflare end-to-end: resolveCloudflareUrl emits /accounts/<id>/ai/v1/chat/completions; Cloudflare answers 7003 for a fake id (routing reached), literal placeholder answered 401 auth error; reporter confirmed 200 with a real id.
- NIM audit: all 33 untracked chat-capable candidates 404 (stale public catalog); 9/13 tracked models 200, MiniMax M3 410 Gone (EOL 2026-09-09). Raw probes in /tmp/nim-audit/.
- npm release: v0.5.90 published and verified via global install (see changelog/v0.5.90.md).
