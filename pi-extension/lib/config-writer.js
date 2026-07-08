/**
 * @file config-writer.js
 * @description Configuration writer for the Pi agent.
 *
 * @details
 *   Writes the selected model credentials and setup into Pi's config files:
 *   - ~/.pi/agent/models.json (endpoints & credentials)
 *   - ~/.pi/agent/settings.json (defaults selection)
 *   - ~/.pi/agent/auth.json (credentials store for boot authentication)
 *   Writes FCM-managed providers under `fcm-*` namespaces so built-in Pi
 *   providers stay untouched and stale scan winners can be cleaned safely.
 *   Cleans the base URL by stripping trailing completions paths to prevent 404s.
 *   Ensures all required model properties (like input: ['text']) are written
 *   to models.json and credentials are saved in auth.json so Pi doesn't reject
 *   the model on boot.
 *   Creates atomic backups before making changes.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { getPiMaxTokens, getPiReasoningFlag, parseContextWindow } from './pi-model-config.js'

const PI_DIR = join(homedir(), '.pi', 'agent')
const MODELS_FILE = join(PI_DIR, 'models.json')
const SETTINGS_FILE = join(PI_DIR, 'settings.json')
const AUTH_FILE = join(PI_DIR, 'auth.json')

/**
 * 📖 Create a backup of a file if it exists.
 * 
 * @param {string} filePath - Path of the file to backup
 * @returns {string|null} The path of the backup file, or null if file didn't exist
 */
function backupIfExists(filePath) {
  if (!existsSync(filePath)) return null
  const backupPath = `${filePath}.backup-${Date.now()}`
  try {
    const data = readFileSync(filePath)
    writeFileSync(backupPath, data)
    return backupPath
  } catch (err) {
    return null
  }
}

/**
 * 📖 Read and parse JSON from a file, returning fallback on failure.
 * 
 * @param {string} filePath - Path to read
 * @param {object} fallback - Fallback object
 * @returns {object} Parsed JSON or fallback
 */
function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback
  try {
    const raw = readFileSync(filePath, 'utf8').trim()
    return raw ? JSON.parse(raw) : fallback
  } catch (err) {
    return fallback
  }
}

/**
 * 📖 Write an object to a file as formatted JSON.
 * 
 * @param {string} filePath - Path to write to
 * @param {object} data - Object to write
 */
function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * 📖 Install the selected model into Pi's configurations.
 * 📖 Backs up the files, registers/updates the provider, and sets the default model.
 * 
 * @param {object} model - The model configuration object
 * @param {string} model.modelId - Unique model ID
 * @param {string} model.label - Display label
 * @param {string} model.providerKey - The provider key
 * @param {string} model.providerUrl - Endpoints base URL
 * @param {string} model.apiKey - The resolved API key for this provider
 * @param {string} [model.ctxWindow] - Context window
 * @param {string} [model.tier] - Tier rating (e.g. S+, S)
 * @returns {object} Object describing the written files and backups
 */
export function installModel(model) {
  const modelsBackup = backupIfExists(MODELS_FILE)
  const settingsBackup = backupIfExists(SETTINGS_FILE)
  const authBackup = backupIfExists(AUTH_FILE)

  const providerId = model.providerKey.startsWith('fcm-') ? model.providerKey : `fcm-${model.providerKey}`

  // 📖 Clean the base URL by stripping trailing chat/completions suffix
  let baseUrl = model.providerUrl || ''
  if (baseUrl.endsWith('/chat/completions')) {
    baseUrl = baseUrl.slice(0, -'/chat/completions'.length)
  } else if (baseUrl.endsWith('/completions')) {
    baseUrl = baseUrl.slice(0, -'/completions'.length)
  }

  const contextWindow = parseContextWindow(model.ctxWindow)
  const maxTokens = getPiMaxTokens(contextWindow)

  // ── 1. Update ~/.pi/agent/models.json ────────────────────────────────────
  const modelsConfig = readJson(MODELS_FILE, { providers: {} })
  if (!modelsConfig.providers || typeof modelsConfig.providers !== 'object') {
    modelsConfig.providers = {}
  }

  // 📖 Write the provider config with all details required by Pi's model schema
  modelsConfig.providers[providerId] = {
    name: `FCM ${model.providerName || model.providerKey}`,
    baseUrl,
    api: 'openai-completions',
    apiKey: model.apiKey || '',
    models: [{
      id: model.modelId,
      name: `${model.label} (${model.providerName || model.providerKey}) [FCM ${model.tier || '?'}]`,
      contextWindow,
      maxTokens,
      reasoning: getPiReasoningFlag(),
      input: ['text'], // 📖 Critical fix: ensures Pi recognizes the model as text-capable on startup
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0
      }
    }]
  }

  // 📖 Defensive migration check: ensure all custom models in models.json have input and cost to avoid runtime crashes
  for (const [pKey, pVal] of Object.entries(modelsConfig.providers)) {
    if (pVal && Array.isArray(pVal.models)) {
      for (const m of pVal.models) {
        if (!m.input) {
          m.input = ['text'];
        }
        if (!m.cost) {
          m.cost = {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0
          };
        }
      }
    }
  }

  writeJson(MODELS_FILE, modelsConfig)

  // ── 2. Update ~/.pi/agent/settings.json ──────────────────────────────────
  const settingsConfig = readJson(SETTINGS_FILE, {})
  settingsConfig.defaultProvider = providerId
  settingsConfig.defaultModel = model.modelId

  // 📖 Ensure enabledModels array is initialized and model is added
  if (!Array.isArray(settingsConfig.enabledModels)) {
    settingsConfig.enabledModels = []
  }

  // 📖 Format is "providerId/modelId" in settings.json's enabledModels.
  // 📖 Keep only the currently managed FCM model for this provider so Pi never
  // 📖 tries to restore stale scan winners that disappeared from models.json.
  const enabledKey = `${providerId}/${model.modelId}`
  settingsConfig.enabledModels = settingsConfig.enabledModels.filter((entry) => {
    return typeof entry === 'string' &&
      !entry.startsWith(`${providerId}/`) &&
      entry !== `${model.providerKey}/${model.modelId}`
  })
  settingsConfig.enabledModels.push(enabledKey)

  writeJson(SETTINGS_FILE, settingsConfig)

  // ── 3. Update ~/.pi/agent/auth.json ──────────────────────────────────────
  const authConfig = readJson(AUTH_FILE, {})
  authConfig[providerId] = {
    type: 'api_key',
    key: model.apiKey || ''
  }
  writeJson(AUTH_FILE, authConfig)

  return {
    modelsFile: MODELS_FILE,
    modelsBackup,
    settingsFile: SETTINGS_FILE,
    settingsBackup,
    authFile: AUTH_FILE,
    authBackup
  }
}
