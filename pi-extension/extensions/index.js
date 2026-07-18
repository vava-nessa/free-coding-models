/**
 * @file index.js
 * @description COMPAT WRAPPER — the real Pi adapter now lives in packages/fcm-pi.
 *
 * @details
 *   This file only exists so existing `~/.pi/agent/settings.json` entries that
 *   point at the `pi-extension/` local path keep loading after the shared-core
 *   extraction. It re-exports the canonical adapter from packages/fcm-pi.
 *
 *   New installs should point directly at `packages/fcm-pi`.
 *
 * @see ../../packages/fcm-pi/extensions/index.js — the real adapter
 */
export { default } from '../../packages/fcm-pi/extensions/index.js'
