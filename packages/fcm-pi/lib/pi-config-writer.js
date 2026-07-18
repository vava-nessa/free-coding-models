/**
 * @file pi-config-writer.js
 * @description Pi disk-config writer for the fcm-pi adapter.
 *
 * @details
 *   Writes the selected FCM model into Pi's on-disk config so it survives boot:
 *   - ~/.pi/agent/models.json  (endpoints + credentials)
 *   - ~/.pi/agent/settings.json (default provider/model + enabledModels)
 *   - ~/.pi/agent/auth.json     (api-key credentials store for boot auth)
 *
 *   FCM-managed providers are written under `fcm-*` IDs so built-in Pi providers
 *   stay untouched and stale scan winners can be cleaned safely. The provider
 *   shape comes from the shared `buildPiProviderDescriptor` so runtime
 *   registration and disk writes can never drift apart. Atomic backups are
 *   created before every change.
 *
 * @functions
 *   - installModelToDisk → Back up + write a model into the 3 Pi config files
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { buildPiProviderDescriptor } from '../../fcm-agent-core/src/index.js'

const PI_DIR = join(homedir(), '.pi', 'agent')
const MODELS_FILE = join(PI_DIR, 'models.json')
const SETTINGS_FILE = join(PI_DIR, 'settings.json')
const AUTH_FILE = join(PI_DIR, 'auth.json')

/**
 * 📖 Create a timestamped backup of a file if it exists.
 *
 * @param {string} filePath - Path of the file to back up
 * @returns {string|null} Backup path, or null if the file didn't exist
 */
function backupIfExists(filePath) {
  if (!existsSync(filePath)) return null
  const backupPath = `${filePath}.backup-${Date.now()}`
  try {
    writeFileSync(backupPath, readFileSync(filePath))
    return backupPath
  } catch (err) {
    return null
  }
}

function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback
  try {
    const raw = readFileSync(filePath, 'utf8').trim()
    return raw ? JSON.parse(raw) : fallback
  } catch (err) {
    return fallback
  }
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * 📖 Install the selected model into Pi's on-disk config.
 * 📖 Backs up all 3 files, registers the provider, and sets it as default.
 *
 * @param {object} model - Scanned model payload (needs modelId, providerKey, …)
 * @returns {object} The written file paths + backup paths
 */
export function installModelToDisk(model) {
  const modelsBackup = backupIfExists(MODELS_FILE)
  const settingsBackup = backupIfExists(SETTINGS_FILE)
  const authBackup = backupIfExists(AUTH_FILE)

  const { providerId, provider } = buildPiProviderDescriptor(model)

  // ── 1. ~/.pi/agent/models.json ───────────────────────────────────────────
  const modelsConfig = readJson(MODELS_FILE, { providers: {} })
  if (!modelsConfig.providers || typeof modelsConfig.providers !== 'object') {
    modelsConfig.providers = {}
  }

  modelsConfig.providers[providerId] = provider

  // 📖 Defensive migration: ensure every custom model has `input` and `cost`,
  // 📖 otherwise Pi can crash on boot reading undefined properties.
  for (const pVal of Object.values(modelsConfig.providers)) {
    if (pVal && Array.isArray(pVal.models)) {
      for (const m of pVal.models) {
        if (!m.input) m.input = ['text']
        if (!m.cost) m.cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
      }
    }
  }
  writeJson(MODELS_FILE, modelsConfig)

  // ── 2. ~/.pi/agent/settings.json ─────────────────────────────────────────
  const settingsConfig = readJson(SETTINGS_FILE, {})
  settingsConfig.defaultProvider = providerId
  settingsConfig.defaultModel = model.modelId

  if (!Array.isArray(settingsConfig.enabledModels)) settingsConfig.enabledModels = []

  // 📖 Keep only the currently managed FCM model for this provider, so Pi never
  // 📖 restores a stale scan winner that disappeared from models.json.
  const enabledKey = `${providerId}/${model.modelId}`
  settingsConfig.enabledModels = settingsConfig.enabledModels.filter((entry) => {
    return typeof entry === 'string' &&
      !entry.startsWith(`${providerId}/`) &&
      entry !== `${model.providerKey}/${model.modelId}`
  })
  settingsConfig.enabledModels.push(enabledKey)
  writeJson(SETTINGS_FILE, settingsConfig)

  // ── 3. ~/.pi/agent/auth.json ─────────────────────────────────────────────
  const authConfig = readJson(AUTH_FILE, {})
  authConfig[providerId] = { type: 'api_key', key: model.apiKey || '' }
  writeJson(AUTH_FILE, authConfig)

  return {
    modelsFile: MODELS_FILE, modelsBackup,
    settingsFile: SETTINGS_FILE, settingsBackup,
    authFile: AUTH_FILE, authBackup
  }
}
