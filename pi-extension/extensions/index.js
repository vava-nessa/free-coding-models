/**
 * @file index.js
 * @description Main Pi extension entry point for free-coding-models.
 *
 * @details
 *   Integrates the free-coding-models catalog and latency measurements into
 *   the Pi coding agent (pi.dev) lifecycle. Uses session start hooks,
 *   temporary TUI status displays, interactive selection menus, and custom slash commands.
 *   Programmatically switches models only after an explicit user command/selection.
 */

import { runFcmScan, handleModelSelection } from '../lib/scanner.js'
import { formatModelLine } from '../lib/model-ranker.js'
import { isDaemonRunning } from '../lib/daemon-client.js'
import { isPiContextUsable } from '../lib/pi-model-config.js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CACHE_FILE = join(homedir(), '.pi', 'agent', 'fcm-cache.json')
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes cache expiration

/**
 * 📖 Helper: Read scan results from persistent disk cache.
 * 
 * @returns {object|null} Cached scan payload or null
 */
function readCache() {
  if (!existsSync(CACHE_FILE)) return null
  try {
    const raw = readFileSync(CACHE_FILE, 'utf8')
    const cache = JSON.parse(raw)
    if (cache && typeof cache === 'object' && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      const data = cache.data
      if (data && Array.isArray(data.ranked)) {
        const ranked = data.ranked.filter(isPiContextUsable)
        return {
          ...data,
          ranked,
          bestModel: ranked[0] || null
        }
      }
      return data
    }
  } catch (err) {
    // 📖 Catch file read/parse errors silently
  }
  return null
}

/**
 * 📖 Helper: Write scan results to persistent disk cache.
 * 
 * @param {object} data - Scan result payload
 */
function writeCache(data) {
  try {
    const payload = {
      timestamp: Date.now(),
      data
    }
    writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    // 📖 Catch file write errors silently
  }
}

/**
 * 📖 Helper: Hide the FCM footer slot. FCM must stay silent unless a scan is
 * 📖 actively running, so every command that probes models clears the status
 * 📖 in a finally block.
 *
 * @param {object} ctx - Pi command or event context
 */
function clearFcmStatus(ctx) {
  try {
    ctx?.ui?.setStatus?.('fcm', undefined)
  } catch (err) {
    // 📖 UI cleanup should never break the agent lifecycle.
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

  const missingBugged = result.ranked.find((model) => {
    return isBuggedModel(model, buggedModelKeys) && !entries.some((entry) => entry.model === model)
  })
  if (missingBugged) {
    entries.push({
      label: formatSelectableModelLine(missingBugged, entries.length + 1, buggedModelKeys),
      model: missingBugged,
    })
  }

  entries.push({ label: '── Skip (keep current model) ──', model: null })
  return entries
}

async function showModelPicker(pi, ctx, result, buggedModelKeys, title = 'Pick a free coding model:') {
  const entries = buildSelectionEntries(result, buggedModelKeys)
  const choice = await ctx.ui.select(title, entries.map((entry) => entry.label))
  const entry = entries.find((candidate) => candidate.label === choice)
  if (!entry?.model) return

  await handleModelSelection(entry.model, {
    registerProvider: (config) => pi.registerProvider(config.id, config),
    onNotify: (msg, type) => ctx.ui.notify(msg, type),
    pi,
    ctx
  })

  ctx.ui.notify(`✅ Switched to ${entry.model.label} (${entry.model.tier})`, 'info')
  return entry.model
}

/**
 * 📖 Main factory function exported for the Pi extension loader.
 * 
 * @param {object} pi - Pi ExtensionAPI instance
 */
export default async function fcmPiExtension(pi) {
  // ─── Error-triggered explicit picker ─────────────────────────────────────
  // 📖 FCM never switches models automatically. If the active provider fails,
  // 📖 it re-opens the picker and marks the failed model in red so vava can
  // 📖 choose another model herself.
  let lastRequestFailed = false
  let lastFailedModelKey = null
  let lastSelectedFcmModelKey = null
  const buggedModelKeys = new Set()

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
      const result = await runFcmScan({
        onStatus: (msg) => ctx.ui.setStatus('fcm', msg),
        onNotify: (msg, type) => ctx.ui.notify(msg, type),
        interactive: true,
        registerProvider: (config) => pi.registerProvider(config.id, config)
      })

      if (!result.ranked.length) {
        ctx.ui.notify('No usable free models found.', 'warning')
        return
      }

      writeCache(result)
      const selected = await showModelPicker(pi, ctx, result, buggedModelKeys, 'Model failed 🔴 — pick a replacement:')
      if (selected) lastSelectedFcmModelKey = `fcm-${selected.providerKey}/${selected.modelId}`
    } catch (err) {
      ctx.ui.notify(`FCM recovery menu error: ${err.message}`, 'error')
    } finally {
      clearFcmStatus(ctx)
    }
  })

  // ─── Startup Hook: session_start ──────────────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    // 📖 Silent by default: no startup scan, no cached auto-selection, no footer.
    clearFcmStatus(ctx)
  })

  // ─── Command: /fcm (Interactive Select) ──────────────────────────────────
  pi.registerCommand('fcm', {
    description: 'Re-scan free coding models and pick the best one',
    handler: async (args, ctx) => {
      try {
        const result = await runFcmScan({
          onStatus: (msg) => ctx.ui.setStatus('fcm', msg),
          onNotify: (msg, type) => ctx.ui.notify(msg, type),
          interactive: true,
          registerProvider: (config) => pi.registerProvider(config.id, config)
        })

        if (!result.ranked.length) {
          ctx.ui.notify('No usable free models found.', 'warning')
          return
        }

        // 📖 Cache results
        writeCache(result)

        const selected = await showModelPicker(pi, ctx, result, buggedModelKeys)
        if (selected) lastSelectedFcmModelKey = `fcm-${selected.providerKey}/${selected.modelId}`
      } catch (err) {
        ctx.ui.notify(`FCM execution error: ${err.message}`, 'error')
      } finally {
        clearFcmStatus(ctx)
      }
    }
  })

  // ─── Command: /fcm-list (Display table) ──────────────────────────────────
  pi.registerCommand('fcm-list', {
    description: 'List all available free coding models with latency and SWE scores',
    handler: async (args, ctx) => {
      // 📖 Reuse cache if fresh, otherwise trigger a quick scan.
      // 📖 The footer indicator is shown only during the live scan window.
      let result = readCache()
      if (!result) {
        try {
          result = await runFcmScan({
            onStatus: (msg) => ctx.ui.setStatus('fcm', msg),
            onNotify: (msg, type) => ctx.ui.notify(msg, type)
          })
          if (result && result.ranked.length) {
            writeCache(result)
          }
        } finally {
          clearFcmStatus(ctx)
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

  // ─── Command: /fcm-router (Connect to local gateway) ───────────────────
  pi.registerCommand('fcm-router', {
    description: 'Configure Pi to use the FCM Smart Router (auto-failover)',
    handler: async (args, ctx) => {
      const running = await isDaemonRunning()
      
      if (!running) {
        ctx.ui.notify('FCM daemon is not running. Start it with: free-coding-models --daemon-bg', 'warning')
        return
      }

      pi.registerProvider('fcm-router', {
        name: 'FCM Smart Router',
        baseUrl: 'http://localhost:19280/v1',
        apiKey: 'fcm-local',
        api: 'openai-completions',
        models: [{
          id: 'fcm',
          name: 'FCM Auto-Router (best available)',
          contextWindow: 200000,
          maxTokens: 8192,
          reasoning: false,
          input: ['text'],
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0
          }
        }]
      })

      // 📖 Switch active model of running session to the router.
      // 📖 Pi expects a registry Model object, not a plain provider/model tuple.
      try {
        const routerModel = ctx.modelRegistry?.find?.('fcm-router', 'fcm')
        if (routerModel) {
          await pi.setModel(routerModel)
        }
      } catch (err) {}

      ctx.ui.notify('✅ Pi is now using FCM Smart Router with auto-failover!', 'info')
      clearFcmStatus(ctx)
    }
  })

  // ─── Command: /fcm-status (Diagnostics) ──────────────────────────────────
  pi.registerCommand('fcm-status', {
    description: 'Show FCM extension status and daemon info',
    handler: async (args, ctx) => {
      const active = await isDaemonRunning()
      const cached = readCache()

      const lines = ['── FCM Pi Extension Status ──']
      
      if (cached && cached.bestModel) {
        lines.push(`Last Scan: Successful (source: ${cached.source || 'cache'})`)
        lines.push(`Active Model: ${cached.bestModel.label} [${cached.bestModel.tier}]`)
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

/**
 * 📖 Helper: Display a transient scan summary without occupying the Pi footer.
 * 
 * @param {object} ctx - Pi UIContext
 * @param {object} result - The scan results object
 */
function showResult(ctx, result) {
  if (!result.bestModel) return
  clearFcmStatus(ctx)

  const top3 = result.ranked.slice(0, 3)
  if (top3.length > 1) {
    const summary = top3.map((m, i) => {
      const medal = ['🥇', '🥈', '🥉'][i]
      return `${medal} ${m.label} (${m.tier})`
    }).join('  ')
    ctx.ui.notify(summary, 'info')
  }
}
