/**
 * @file index.js
 * @description COMPAT WRAPPER — the real OpenCode adapter now lives in packages/fcm-opencode.
 *
 * @details
 *   This file only exists so existing symlinks at
 *   `~/.config/opencode/plugins/fcm-opencode.js` (which point here) keep working
 *   after the shared-core extraction. It re-exports the canonical adapter.
 *
 *   New installs should symlink directly to `packages/fcm-opencode/index.js`.
 *
 * @see ../packages/fcm-opencode/index.js — the real adapter
 */
export { FcmOpenCode, default } from '../packages/fcm-opencode/index.js'
