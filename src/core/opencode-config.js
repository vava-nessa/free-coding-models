/**
 * @file src/opencode-config.js
 * @description Small filesystem helpers for the shared OpenCode config file.
 *
 * @details
 *   📖 The app still needs a stable way to read and write `opencode.json`
 *   📖 for direct OpenCode CLI and Desktop launches.
 *   📖 This module deliberately stays tiny so OpenCode launch code is not
 *   📖 coupled to old bridge-specific sync behavior anymore.
 *
 * @functions
 *   → `loadOpenCodeConfig` — read `~/.config/opencode/opencode.json` safely
 *   → `saveOpenCodeConfig` — write `opencode.json` with a simple backup
 *   → `restoreOpenCodeBackup` — restore the last `.bak` copy if needed
 *
 * @exports loadOpenCodeConfig, saveOpenCodeConfig, restoreOpenCodeBackup
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const OPENCODE_CONFIG_DIR = join(homedir(), '.config', 'opencode')
const OPENCODE_CONFIG_PATH = join(OPENCODE_CONFIG_DIR, 'opencode.json')
const OPENCODE_BACKUP_PATH = join(OPENCODE_CONFIG_DIR, 'opencode.json.bak')

export function loadOpenCodeConfig() {
  try {
    if (existsSync(OPENCODE_CONFIG_PATH)) {
      return JSON.parse(readFileSync(OPENCODE_CONFIG_PATH, 'utf8'))
    }
  } catch {}
  return {}
}

export function saveOpenCodeConfig(config) {
  mkdirSync(OPENCODE_CONFIG_DIR, { recursive: true })
  if (existsSync(OPENCODE_CONFIG_PATH)) {
    copyFileSync(OPENCODE_CONFIG_PATH, OPENCODE_BACKUP_PATH)
  }
  writeFileSync(OPENCODE_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

export function restoreOpenCodeBackup() {
  if (!existsSync(OPENCODE_BACKUP_PATH)) return false
  copyFileSync(OPENCODE_BACKUP_PATH, OPENCODE_CONFIG_PATH)
  return true
}
