/**
 * @file index.js
 * @description Main Pi extension entry point for free-coding-models.
 *
 * @details
 *   Integrates the free-coding-models catalog and latency measurements into
 *   the Pi coding agent (pi.dev) lifecycle. Uses session start hooks,
 *   TUI status displays, interactive selection menus, and custom slash commands.
 *   Programmatically switches active models at startup or on user select.
 */

import { runFcmScan, handleModelSelection } from '../lib/scanner.js'
import { formatModelLine } from '../lib/model-ranker.js'
import { isDaemonRunning } from '../lib/daemon-client.js'
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
      return cache.data
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
 * 📖 Main factory function exported for the Pi extension loader.
 * 
 * @param {object} pi - Pi ExtensionAPI instance
 */
export default async function fcmPiExtension(pi) {
  // ─── Auto-failover / Error recovery logic ───────────────────────────────
  let lastRequestFailed = false

  pi.on('before_provider_request', () => {
    lastRequestFailed = false
  })

  pi.on('after_provider_response', async (event, ctx) => {
    if (event.status >= 400) {
      lastRequestFailed = true
    }
  })

  pi.on('agent_end', async (event, ctx) => {
    if (lastRequestFailed) {
      lastRequestFailed = false // Reset to avoid recursion/loops
      
      ctx.ui.notify('⚠️ Le modèle actif a renvoyé une erreur. Recherche d\'une alternative fonctionnelle...', 'warning')
      ctx.ui.setStatus('fcm', '🔍 Scan de secours en cours...')
      
      try {
        const result = await runFcmScan({
          onStatus: (msg) => ctx.ui.setStatus('fcm', msg),
          onNotify: (msg, type) => ctx.ui.notify(msg, type),
          registerProvider: (config) => pi.registerProvider(config.id, config)
        })

        if (result.bestModel) {
          writeCache(result)
          
          await handleModelSelection(result.bestModel, {
            registerProvider: (config) => pi.registerProvider(config.id, config),
            onNotify: (msg, type) => ctx.ui.notify(msg, type),
            pi,
            ctx
          })
          
          ctx.ui.notify(`🔄 FCM a basculé automatiquement sur ${result.bestModel.label} (${result.bestModel.tier})`, 'info')
          showResult(ctx, result)
        } else {
          ctx.ui.notify('❌ Aucun modèle de secours disponible.', 'error')
          ctx.ui.setStatus('fcm', '⚠️ Aucun modèle disponible')
        }
      } catch (err) {
        ctx.ui.notify(`FCM auto-recovery error: ${err.message}`, 'error')
        ctx.ui.setStatus('fcm', '❌ Auto-recovery failed')
      }
    }
  })

  // ─── Startup Hook: session_start ──────────────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    // 📖 Check for a valid, fresh scan in cache to avoid delay
    const cachedResult = readCache()
    if (cachedResult && cachedResult.bestModel) {
      // 📖 Apply cached provider config to runtime and select model
      try {
        await handleModelSelection(cachedResult.bestModel, {
          registerProvider: (config) => pi.registerProvider(config.id, config),
          onNotify: (msg, type) => ctx.ui.notify(msg, type),
          pi,
          ctx
        })
      } catch (err) {}
      
      setTimeout(() => showResult(ctx, cachedResult), 1500)
      return
    }

    // 📖 Cache expired or missing -> run full scan
    try {
      const result = await runFcmScan({
        onStatus: (msg) => ctx.ui.setStatus('fcm', msg),
        onNotify: (msg, type) => ctx.ui.notify(msg, type),
        registerProvider: (config) => pi.registerProvider(config.id, config)
      })

      if (result.bestModel) {
        // 📖 Cache the results on disk
        writeCache(result)

        // 📖 Install, register, and programmatically switch to the best model
        await handleModelSelection(result.bestModel, {
          registerProvider: (config) => pi.registerProvider(config.id, config),
          onNotify: (msg, type) => ctx.ui.notify(msg, type),
          pi,
          ctx
        })

        setTimeout(() => showResult(ctx, result), 1500)
      } else {
        ctx.ui.setStatus('fcm', '⚠️ No free models available')
        ctx.ui.notify('No usable free models found. Run `free-coding-models` to configure API keys.', 'warn')
      }
    } catch (err) {
      ctx.ui.setStatus('fcm', '❌ FCM scan failed')
      ctx.ui.notify(`FCM scan error: ${err.message}`, 'error')
    }
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
          ctx.ui.notify('No usable free models found.', 'warn')
          return
        }

        // 📖 Cache results
        writeCache(result)

        // 📖 Display top 10 models for user selection
        const options = result.ranked.slice(0, 10).map((m, i) => formatModelLine(m, i + 1))
        options.push('── Skip (keep current model) ──')

        const choice = await ctx.ui.select('Pick a free coding model:', options)
        if (choice && !choice.includes('Skip')) {
          const idx = options.indexOf(choice)
          if (idx >= 0 && idx < result.ranked.length) {
            const selected = result.ranked[idx]
            await handleModelSelection(selected, {
              registerProvider: (config) => pi.registerProvider(config.id, config),
              onNotify: (msg, type) => ctx.ui.notify(msg, type),
              pi,
              ctx
            })
            
            ctx.ui.notify(`✅ Switched to ${selected.label} (${selected.tier})`, 'info')
            
            const latStr = selected.latencyMs ? `${selected.latencyMs}ms` : '?'
            ctx.ui.setStatus('fcm', `✅ ${selected.label} (${selected.tier}) — ${latStr}`)
          }
        }
      } catch (err) {
        ctx.ui.notify(`FCM execution error: ${err.message}`, 'error')
      }
    }
  })

  // ─── Command: /fcm-list (Display table) ──────────────────────────────────
  pi.registerCommand('fcm-list', {
    description: 'List all available free coding models with latency and SWE scores',
    handler: async (args, ctx) => {
      // 📖 Reuse cache if fresh, otherwise trigger a quick scan
      let result = readCache()
      if (!result) {
        result = await runFcmScan({
          onStatus: (msg) => ctx.ui.setStatus('fcm', msg),
          onNotify: (msg, type) => ctx.ui.notify(msg, type)
        })
        if (result && result.ranked.length) {
          writeCache(result)
        }
      }

      if (!result || !result.ranked.length) {
        ctx.ui.notify('No models available.', 'warn')
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
        ctx.ui.notify('FCM daemon is not running. Start it with: free-coding-models --daemon-bg', 'warn')
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

      // 📖 Switch active model of running session to the router
      try {
        await pi.setModel({
          provider: 'fcm-router',
          modelId: 'fcm'
        })
      } catch (err) {}

      ctx.ui.notify('✅ Pi is now using FCM Smart Router with auto-failover!', 'info')
      ctx.ui.setStatus('fcm', '🔄 FCM Router active')
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
 * 📖 Helper: Display scan result summary in Pi status bar.
 * 
 * @param {object} ctx - Pi UIContext
 * @param {object} result - The scan results object
 */
function showResult(ctx, result) {
  if (!result.bestModel) return
  const m = result.bestModel
  const latStr = m.latencyMs ? `${m.latencyMs}ms` : '?'
  const tpsStr = m.tps ? `${Math.round(m.tps)} TPS` : ''
  const parts = [`${m.label} (${m.tier})`, latStr, tpsStr].filter(Boolean).join(' — ')
  
  ctx.ui.setStatus('fcm', `✅ ${parts}`)

  const top3 = result.ranked.slice(0, 3)
  if (top3.length > 1) {
    const summary = top3.map((m, i) => {
      const medal = ['🥇', '🥈', '🥉'][i]
      return `${medal} ${m.label} (${m.tier})`
    }).join('  ')
    ctx.ui.notify(summary, 'info')
  }
}
