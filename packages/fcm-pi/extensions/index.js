/**
 * @file index.js
 * @description Pi coding-agent extension adapter for free-coding-models.
 *
 * @details
 *   This is the Pi host adapter. It is silent by default: no startup scan, no
 *   footer noise, no automatic model switch on Pi boot or `/resume`. `/fcm`
 *   scans on demand and waits for an explicit pick. On a provider HTTP 4xx/5xx,
 *   it reopens the picker and marks the failing model `🔴 BUGGED` instead of
 *   switching automatically.
 *
 *   All scan/rank/cache/key/daemon/provider-descriptor logic comes from the
 *   shared `fcm-agent-core`. This file owns only Pi-specific concerns: the
 *   status-bar renderer, `pi.registerProvider` / `pi.setModel`, and Pi's disk
 *   config files. Pi reasoning flags and the 16k context floor live in the core.
 *
 * @exports default — Pi extension factory `(pi) => { … }`
 */

import {
  scanBestFcmModel,
  createCacheStore,
  formatModelLine,
  isContextUsable,
  isDaemonRunning,
  buildPiProviderDescriptor,
  buildSmartRouterDescriptor,
} from '../../fcm-agent-core/src/index.js'
import { installModelToDisk } from '../lib/pi-config-writer.js'
import { createPiStatusRenderer } from '../lib/pi-progress-renderer.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CACHE_FILE = join(homedir(), '.pi', 'agent', 'fcm-cache.json')

/**
 * 📖 One shared cache store for this Pi adapter. Reads/writes ~/.pi/agent/fcm-cache.json.
 */
const cache = createCacheStore({ filePath: CACHE_FILE })

/**
 * 📖 Run a scan with a live Pi status-bar renderer, return the ranked result.
 *
 * @param {object} opts - { ctx, interactive, registerProvider, mode }
 * @returns {Promise<object>} Scan result
 */
async function scanWithPiStatus({ ctx, mode = 'auto' }) {
  const renderer = createPiStatusRenderer({
    setStatus: (msg) => ctx?.ui?.setStatus?.('fcm', msg)
  })
  renderer.start()
  try {
    return await scanBestFcmModel({
      mode,
      target: 'pi',
      onProgress: (event) => renderer.update(event),
      onNotify: (msg, type) => ctx?.ui?.notify?.(msg, type),
    })
  } finally {
    renderer.stop()
  }
}

function normalizeProviderId(providerId) {
  if (typeof providerId !== 'string') return ''
  return providerId.startsWith('fcm-') ? providerId.slice('fcm-'.length) : providerId
}

function getActiveModelKey(ctx) {
  const model = ctx?.model
  if (!model || typeof model !== 'object') return null
  const provider = model.provider || model.providerId || model.providerKey
  const modelId = model.id || model.modelId
  if (typeof provider === 'string' && typeof modelId === 'string') {
    return `${provider}/${modelId}`
  }
  return null
}

function doesScanModelMatchKey(model, key) {
  if (!model || typeof key !== 'string') return false
  const slashIndex = key.indexOf('/')
  if (slashIndex <= 0) return false
  const provider = normalizeProviderId(key.slice(0, slashIndex))
  const modelId = key.slice(slashIndex + 1)
  return normalizeProviderId(model.providerKey) === provider && model.modelId === modelId
}

function isBuggedModel(model, buggedModelKeys) {
  return [...buggedModelKeys].some((key) => doesScanModelMatchKey(model, key))
}

function formatSelectableModelLine(model, rank, buggedModelKeys) {
  const line = formatModelLine(model, rank)
  return isBuggedModel(model, buggedModelKeys) ? `🔴 BUGGED — ${line}` : line
}

function buildSelectionEntries(result, buggedModelKeys) {
  const entries = result.ranked.slice(0, 10).map((model, index) => ({
    label: formatSelectableModelLine(model, index + 1, buggedModelKeys),
    model,
  }))

  const missingBugged = result.ranked.find((model) =>
    isBuggedModel(model, buggedModelKeys) && !entries.some((entry) => entry.model === model)
  )
  if (missingBugged) {
    entries.push({
      label: formatSelectableModelLine(missingBugged, entries.length + 1, buggedModelKeys),
      model: missingBugged,
    })
  }

  entries.push({ label: '── Skip (keep current model) ──', model: null })
  return entries
}

/**
 * 📖 Install a model: write Pi disk config, register the provider at runtime,
 * 📖 and switch the active session model via the Pi model registry.
 *
 * @param {object} model - Scanned model payload
 * @param {object} options - { pi, ctx, registerProvider, onNotify, persist }
 */
async function selectModel(model, options = {}) {
  const { pi, ctx, registerProvider, onNotify } = options

  // 📖 1. Disk write (skippable for dry-run)
  if (options.persist !== false) {
    try {
      installModelToDisk(model)
    } catch (err) {
      onNotify?.(`FCM disk config write failed: ${err.message}`, 'warning')
    }
  }

  const { providerId, provider } = buildPiProviderDescriptor(model)

  // 📖 2. Register the provider in the running Pi session
  if (typeof registerProvider === 'function') {
    registerProvider({ id: providerId, ...provider })
  }

  // 📖 3. Switch the active model of the current session via the model registry
  if (pi && typeof pi.setModel === 'function' && ctx) {
    try {
      const registry = ctx.modelRegistry
      if (registry && typeof registry.find === 'function') {
        const piModel = registry.find(providerId, model.modelId)
        if (piModel) {
          const success = await pi.setModel(piModel)
          if (!success) onNotify?.(`Failed to switch active session model to ${model.label}`, 'warning')
        } else {
          onNotify?.(`Model ${model.modelId} not found in Pi registry`, 'warning')
        }
      }
    } catch (err) {
      onNotify?.(`Failed to set model: ${err.message}`, 'error')
    }
  }
}

async function showModelPicker(pi, ctx, result, buggedModelKeys, title = 'Pick a free coding model:') {
  const entries = buildSelectionEntries(result, buggedModelKeys)
  const choice = await ctx.ui.select(title, entries.map((entry) => entry.label))
  const entry = entries.find((candidate) => candidate.label === choice)
  if (!entry?.model) return

  await selectModel(entry.model, {
    registerProvider: (config) => pi.registerProvider(config.id, config),
    onNotify: (msg, type) => ctx.ui.notify(msg, type),
    pi,
    ctx,
  })

  ctx.ui.notify(`✅ Switched to ${entry.model.label} (${entry.model.tier})`, 'info')
  return entry.model
}

/**
 * 📖 Pi extension factory exported for the Pi extension loader.
 *
 * @param {object} pi - Pi ExtensionAPI instance
 */
export default async function fcmPiExtension(pi) {
  let lastRequestFailed = false
  let lastFailedModelKey = null
  let lastSelectedFcmModelKey = null
  const buggedModelKeys = new Set()

  // ─── Error-triggered explicit picker ─────────────────────────────────────
  pi.on('before_provider_request', (_event, ctx) => {
    lastRequestFailed = false
    lastFailedModelKey = getActiveModelKey(ctx) || lastSelectedFcmModelKey
  })

  pi.on('after_provider_response', async (event, ctx) => {
    if (event.status >= 400) {
      lastRequestFailed = true
      lastFailedModelKey = getActiveModelKey(ctx) || lastFailedModelKey
      if (lastFailedModelKey) buggedModelKeys.add(lastFailedModelKey)
    }
  })

  pi.on('agent_end', async (_event, ctx) => {
    if (!lastRequestFailed) return
    lastRequestFailed = false
    if (lastFailedModelKey) buggedModelKeys.add(lastFailedModelKey)

    try {
      ctx.ui.notify('⚠️ Modèle en erreur. Je réouvre FCM pour choisir.', 'warning')
      const result = await scanWithPiStatus({ ctx, mode: 'auto' })

      if (!result.ranked.length) {
        ctx.ui.notify('No usable free models found.', 'warning')
        return
      }

      cache.write(result)
      const selected = await showModelPicker(pi, ctx, result, buggedModelKeys, 'Model failed 🔴 — pick a replacement:')
      if (selected) lastSelectedFcmModelKey = `fcm-${selected.providerKey}/${selected.modelId}`
    } catch (err) {
      ctx.ui.notify(`FCM recovery menu error: ${err.message}`, 'error')
    }
  })

  // ─── Startup Hook: silent by default ─────────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    try { ctx?.ui?.setStatus?.('fcm', undefined) } catch (err) {}
  })

  // ─── Command: /fcm (Interactive Select) ──────────────────────────────────
  pi.registerCommand('fcm', {
    description: 'Re-scan free coding models and pick the best one',
    handler: async (args, ctx) => {
      try {
        const result = await scanWithPiStatus({ ctx, mode: 'auto' })

        if (!result.ranked.length) {
          ctx.ui.notify('No usable free models found.', 'warning')
          return
        }

        cache.write(result)
        const selected = await showModelPicker(pi, ctx, result, buggedModelKeys)
        if (selected) lastSelectedFcmModelKey = `fcm-${selected.providerKey}/${selected.modelId}`
      } catch (err) {
        ctx.ui.notify(`FCM execution error: ${err.message}`, 'error')
      }
    }
  })

  // ─── Command: /fcm-list (Display table) ──────────────────────────────────
  pi.registerCommand('fcm-list', {
    description: 'List all available free coding models with latency and SWE scores',
    handler: async (args, ctx) => {
      let result = cache.read()
      if (!result) {
        try {
          result = await scanWithPiStatus({ ctx, mode: 'auto' })
          if (result?.ranked.length) cache.write(result)
        } catch (err) {
          ctx.ui.notify(`FCM scan error: ${err.message}`, 'error')
        }
      }

      if (!result || !result.ranked.length) {
        ctx.ui.notify('No models available.', 'warning')
        return
      }

      const lines = [
        '┌─────┬────────────────────────┬──────┬───────┬─────────┬─────┬──────────┐',
        '│  #  │ Model                  │ Tier │  SWE  │ Latency │ TPS │ Provider │',
        '├─────┼────────────────────────┼──────┼───────┼─────────┼─────┼──────────┤',
      ]

      for (const [i, m] of result.ranked.slice(0, 20).entries()) {
        const num = String(i + 1).padStart(3)
        const name = m.label.padEnd(22).slice(0, 22)
        const tier = m.tier.padEnd(4)
        const swe = m.sweScore.padStart(5)
        const lat = m.latencyMs ? `${m.latencyMs}ms`.padStart(7) : '   n/a '.padStart(7)
        const tps = m.tps ? String(Math.round(m.tps)).padStart(3) : ' - '
        const prov = (m.providerName || m.providerKey).padEnd(8).slice(0, 8)
        lines.push(`│ ${num} │ ${name} │ ${tier} │ ${swe} │ ${lat} │ ${tps} │ ${prov} │`)
      }
      lines.push('└─────┴────────────────────────┴──────┴───────┴─────────┴─────┴──────────┘')

      ctx.ui.setWidget('fcm-models', lines)
    }
  })

  // ─── Command: /fcm-router (Connect to local gateway) ─────────────────────
  pi.registerCommand('fcm-router', {
    description: 'Configure Pi to use the FCM Smart Router (auto-failover)',
    handler: async (args, ctx) => {
      const running = await isDaemonRunning()
      if (!running) {
        ctx.ui.notify('FCM daemon is not running. Start it with: free-coding-models --daemon-bg', 'warning')
        return
      }

      const { providerId, provider } = buildSmartRouterDescriptor({ target: 'pi' })
      pi.registerProvider(providerId, provider)

      // 📖 Switch active model via the registry (Pi expects a real Model object)
      try {
        const routerModel = ctx.modelRegistry?.find?.(providerId, 'fcm')
        if (routerModel) await pi.setModel(routerModel)
      } catch (err) {}

      ctx.ui.notify('✅ Pi is now using FCM Smart Router with auto-failover!', 'info')
    }
  })

  // ─── Command: /fcm-status (Diagnostics) ──────────────────────────────────
  pi.registerCommand('fcm-status', {
    description: 'Show FCM extension status and daemon info',
    handler: async (args, ctx) => {
      const active = await isDaemonRunning()
      const cached = cache.read()

      const lines = ['── FCM Pi Extension Status ──']

      if (cached && cached.bestModel) {
        lines.push(`Last Scan: Successful (source: ${cached.source || 'cache'})`)
        lines.push(`Best Model: ${cached.bestModel.label} [${cached.bestModel.tier}]`)
        lines.push(`Average Latency: ${cached.bestModel.latencyMs ? `${cached.bestModel.latencyMs}ms` : 'n/a'}`)
        lines.push(`Estimated Throughput: ${cached.bestModel.tps ? `${Math.round(cached.bestModel.tps)} TPS` : 'n/a'}`)
        lines.push(`Models Ranked: ${cached.ranked.length}`)
      } else {
        lines.push('No scan cached. Run /fcm to perform a diagnostic scan.')
      }

      lines.push('')
      lines.push(active ? '🟢 FCM Daemon: Connected (localhost:19280)' : '🔴 FCM Daemon: Offline')

      ctx.ui.setWidget('fcm-status', lines)
    }
  })
}
