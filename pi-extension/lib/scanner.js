/**
 * @file scanner.js
 * @description Main model scanner orchestrator (Daemon first, direct fallback).
 *
 * @details
 *   Queries the running FCM daemon for pre-computed latency and health statistics.
 *   If the daemon is unavailable, triggers a direct parallel scan of candidate models.
 *   Also handles writing settings to disk and dynamically switching active session models.
 */

import { queryDaemon } from './daemon-client.js'
import { directScan } from './direct-scanner.js'
import { rankModels } from './model-ranker.js'
import { installModel } from './config-writer.js'
import { sources } from 'free-coding-models/sources.js'
import { getKeyForProvider } from './api-keys.js'

/**
 * ── runFcmScan ──────────────────────────────────────────────────────────────
 * 📖 Main entry point to scan and rank available free coding models.
 * 📖 Tries to use the daemon for speed (~1s), then falls back to direct scan.
 * 
 * @param {object} options - Progress & notification hooks
 * @param {function} options.onStatus - UI status updater
 * @param {function} [options.onNotify] - Transient notification helper
 * @returns {Promise<object>} `{ ranked: Array, bestModel: object|null, source: string }`
 */
export async function runFcmScan(options = {}) {
  options.onStatus('🔍 Checking FCM daemon...')

  try {
    const daemonData = await queryDaemon()
    if (daemonData && Array.isArray(daemonData.models)) {
      options.onStatus('📡 Mapping daemon models...')
      
      const mapped = daemonData.models.map(m => {
        const providerKey = m.providerKey
        const sourceUrl = sources[providerKey]?.url || ''
        const apiKey = getKeyForProvider(providerKey)

        // 📖 Map daemon status values ('up', 'down', 'pending')
        let status = m.status
        if (status === 'pending') status = 'down'

        return {
          modelId: m.modelId,
          label: m.label,
          tier: m.tier,
          sweScore: m.sweScore,
          ctxWindow: m.ctx,
          providerKey,
          providerName: m.origin || providerKey,
          providerUrl: sourceUrl,
          apiKey,
          status,
          latencyMs: typeof m.avg === 'number' ? m.avg : null,
          tps: m.benchmark?.tokensPerSecond || null,
          totalBenchMs: m.benchmark?.totalMs || null,
          stabilityScore: typeof m.stability === 'number' ? Math.round(m.stability * 100) : 100,
          hasKey: m.hasApiKey
        }
      })

      const ranked = rankModels(mapped)
      return {
        ranked,
        bestModel: ranked[0] || null,
        source: 'daemon'
      }
    }
  } catch (err) {
    if (options.onNotify) {
      options.onNotify(`Daemon query failed: ${err.message}`, 'warn')
    }
  }

  // ── Direct Scan Fallback ───────────────────────────────────────────────────
  options.onStatus('🔌 Direct scan starting...')
  
  const results = await directScan({
    onProgress: (msg) => options.onStatus(msg)
  })

  const ranked = rankModels(results)
  return {
    ranked,
    bestModel: ranked[0] || null,
    source: 'direct'
  }
}

/**
 * ── handleModelSelection ─────────────────────────────────────────────────────
 * 📖 Write the selected model configuration to Pi config files on disk,
 * 📖 and dynamically switch the active session model in the running Pi agent.
 * 
 * @param {object} model - The model payload to install
 * @param {object} options - Runtime helper functions
 * @param {function} [options.registerProvider] - Function to register provider in active Pi session
 * @param {object} [options.pi] - The active Pi ExtensionAPI instance
 * @param {object} [options.ctx] - The active Pi Session context containing the model registry
 * @param {function} [options.onNotify] - Function to show UI notification
 * @returns {Promise<object>} Config installation result
 */
export async function handleModelSelection(model, options = {}) {
  const result = installModel(model)

  const providerId = model.providerKey

  // 📖 Clean the base URL by stripping trailing completions path
  let baseUrl = model.providerUrl || ''
  if (baseUrl.endsWith('/chat/completions')) {
    baseUrl = baseUrl.slice(0, -'/chat/completions'.length)
  } else if (baseUrl.endsWith('/completions')) {
    baseUrl = baseUrl.slice(0, -'/completions'.length)
  }

  // 📖 Parse context window (e.g. '128k' -> 128000)
  let contextWindow = 128000
  if (model.ctxWindow) {
    const val = parseInt(model.ctxWindow)
    if (!isNaN(val)) {
      contextWindow = model.ctxWindow.toLowerCase().endsWith('k') ? val * 1000 : val
    }
  }

  // ── 1. Register the provider in Pi runtime if not already present
  if (typeof options.registerProvider === 'function') {
    options.registerProvider({
      id: providerId,
      name: `FCM ${model.providerName}`,
      baseUrl,
      apiKey: model.apiKey || '',
      api: 'openai-completions',
      models: [{
        id: model.modelId,
        name: `${model.label} [FCM ${model.tier}]`,
        contextWindow,
        maxTokens: 8192,
        reasoning: model.tier === 'S+' || model.tier === 'S',
        input: ['text'], // 📖 Critical fix: prevents Pi from throwing "Cannot read properties of undefined (reading 'includes')"
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0
        }
      }]
    })
  }

  // ── 2. Switch the active model of the CURRENT running session of Pi
  if (options.pi && typeof options.pi.setModel === 'function' && options.ctx) {
    try {
      // 📖 Retrieve the Model object from Pi's modelRegistry using providerId and modelId
      const registry = options.ctx.modelRegistry
      if (registry && typeof registry.find === 'function') {
        const piModel = registry.find(providerId, model.modelId)
        if (piModel) {
          const success = await options.pi.setModel(piModel)
          if (!success && typeof options.onNotify === 'function') {
            options.onNotify(`Failed to switch active session model to ${model.label}`, 'warn')
          }
        } else {
          if (typeof options.onNotify === 'function') {
            options.onNotify(`Model ${model.modelId} not found in Pi registry`, 'warn')
          }
        }
      }
    } catch (err) {
      if (typeof options.onNotify === 'function') {
        options.onNotify(`Failed to set model: ${err.message}`, 'error')
      }
    }
  }

  return result
}
