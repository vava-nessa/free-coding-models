/**
 * @file api-keys.js
 * @description API Key loader and resolver for FCM Pi extension.
 *
 * @details
 *   Loads API keys from both process.env (highest priority) and
 *   the free-coding-models config file (~/.free-coding-models.json).
 */

import { loadConfig, getApiKey } from 'free-coding-models/src/core/config.js'
import { ENV_VAR_NAMES } from 'free-coding-models/src/core/provider-metadata.js'
import { sources } from 'free-coding-models/sources.js'

/**
 * 📖 Resolve the effective API key for a given provider key.
 * 📖 Env overrides take precedence over the ~/.free-coding-models.json config file.
 * 
 * @param {string} providerKey - Key of the provider (e.g., 'groq', 'nvidia')
 * @returns {string|null} The resolved API key, or null if none found
 */
export function getKeyForProvider(providerKey) {
  // 📖 Check environment variables first
  const envVarName = ENV_VAR_NAMES[providerKey]
  if (envVarName && process.env[envVarName]) {
    const key = process.env[envVarName].trim()
    if (key) return key
  }

  // 📖 Fall back to configuration file
  try {
    const config = loadConfig()
    if (config) {
      const key = getApiKey(config, providerKey)
      if (key) return key
    }
  } catch (err) {
    // 📖 Silently catch load errors to avoid disrupting session startup
  }

  return null
}

/**
 * 📖 Load all available API keys across all cataloged providers.
 * 
 * @returns {Map<string, string>} A map of providerKey -> apiKey
 */
export function loadAllApiKeys() {
  const keyMap = new Map()
  
  for (const providerKey of Object.keys(sources)) {
    const key = getKeyForProvider(providerKey)
    if (key) {
      keyMap.set(providerKey, key)
    }
  }
  
  return keyMap
}
