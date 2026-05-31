/**
 * @file src/kilo-config.js
 * @description Small filesystem helpers for the shared Kilo config file (OpenCode fork).
 *
 * @details
 *   📖 Kilo is a fork of OpenCode and uses the same config structure,
 *   📖 but stored in a different directory: ~/.config/kilo/opencode.json
 *
 * @functions
 *   → `loadKiloConfig` — read `~/.config/kilo/opencode.json` safely
 *   → `saveKiloConfig` — write `opencode.json` with a simple backup
 *
 * @exports loadKiloConfig, saveKiloConfig
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const KILO_CONFIG_DIR = join(homedir(), '.config', 'kilo')
const KILO_CONFIG_PATH = join(KILO_CONFIG_DIR, 'opencode.json')
const KILO_BACKUP_PATH = join(KILO_CONFIG_DIR, 'opencode.json.bak')

export function loadKiloConfig() {
  try {
    if (existsSync(KILO_CONFIG_PATH)) {
      return JSON.parse(readFileSync(KILO_CONFIG_PATH, 'utf8'))
    }
  } catch {}
  return {}
}

export function saveKiloConfig(config) {
  mkdirSync(KILO_CONFIG_DIR, { recursive: true })
  if (existsSync(KILO_CONFIG_PATH)) {
    copyFileSync(KILO_CONFIG_PATH, KILO_BACKUP_PATH)
  }
  writeFileSync(KILO_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

export function getKiloConfigPath() {
  return KILO_CONFIG_PATH
}
