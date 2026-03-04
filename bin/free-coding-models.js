#!/usr/bin/env node
/**
 * @file free-coding-models.js
 * @description Live terminal availability checker for coding LLM models with OpenCode & OpenClaw integration.
 *
 * @details
 *   This CLI tool discovers and benchmarks language models optimized for coding.
 *   It runs in an alternate screen buffer, pings all models in parallel, re-pings successful ones
 *   multiple times for reliable latency measurements, and prints a clean final table.
 *   During benchmarking, users can navigate with arrow keys and press Enter to act on the selected model.
 *
 *   🎯 Key features:
 *   - Parallel pings across all models with animated real-time updates (multi-provider)
 *   - Continuous monitoring with 60-second ping intervals (never stops)
 *   - Rolling averages calculated from ALL successful pings since start
 *   - Best-per-tier highlighting with medals (🥇🥈🥉)
 *   - Interactive navigation with arrow keys directly in the table
 *   - Instant OpenCode OR OpenClaw action on Enter key press
 *   - Startup mode menu (OpenCode CLI vs OpenCode Desktop vs OpenClaw) when no flag is given
 *   - Automatic config detection and model setup for both tools
 *   - JSON config stored in ~/.free-coding-models.json (auto-migrates from old plain-text)
 *   - Multi-provider support via sources.js (NIM/Groq/Cerebras/OpenRouter/Hugging Face/Replicate/DeepInfra/... — extensible)
 *   - Settings screen (P key) to manage API keys, provider toggles, and manual updates
 *   - Favorites system: toggle with F, pin rows to top, persist between sessions
 *   - Uptime percentage tracking (successful pings / total pings)
 *   - Sortable columns (R/Y/O/M/L/A/S/N/H/V/B/U keys)
 *   - Tier filtering via T key (cycles S+→S→A+→A→A-→B+→B→C→All)
 *
 *   → Functions:
 *   - `loadConfig` / `saveConfig` / `getApiKey`: Multi-provider JSON config via lib/config.js
 *   - `getTelemetryDistinctId`: Generate/reuse a stable anonymous ID for telemetry
 *   - `getTelemetryTerminal`: Infer terminal family (Terminal.app, iTerm2, kitty, etc.)
 *   - `isTelemetryDebugEnabled` / `telemetryDebug`: Optional runtime telemetry diagnostics via env
 *   - `sendUsageTelemetry`: Fire-and-forget anonymous app-start event
 *   - `ensureFavoritesConfig` / `toggleFavoriteModel`: Persist and toggle pinned favorites
 *   - `promptApiKey`: Interactive wizard for first-time multi-provider API key setup
 *   - `promptModeSelection`: Startup menu to choose OpenCode vs OpenClaw
 *   - `buildPingRequest` / `ping`: Build provider-specific probe requests and measure latency
 *   - `renderTable`: Generate ASCII table with colored latency indicators and status emojis
 *   - `getAvg`: Calculate average latency from all successful pings
 *   - `getVerdict`: Determine verdict string based on average latency (Overloaded for 429)
 *   - `getUptime`: Calculate uptime percentage from ping history
 *   - `sortResults`: Sort models by various columns
 *   - `checkNvidiaNimConfig`: Check if NVIDIA NIM provider is configured in OpenCode
 *   - `isTcpPortAvailable` / `resolveOpenCodeTmuxPort`: Pick a safe OpenCode port when running in tmux
 *   - `startOpenCode`: Launch OpenCode CLI with selected model (configures if needed)
 *   - `startOpenCodeDesktop`: Set model in shared config & open OpenCode Desktop app
 *   - `loadOpenClawConfig` / `saveOpenClawConfig`: Manage ~/.openclaw/openclaw.json
 *   - `startOpenClaw`: Set selected model as default in OpenClaw config (remote, no launch)
 *   - `filterByTier`: Filter models by tier letter prefix (S, A, B, C)
 *   - `main`: Orchestrates CLI flow, wizard, ping loops, animation, and output
 *
 *   📦 Dependencies:
 *   - Node.js 18+ (native fetch)
 *   - chalk: Terminal styling and colors
 *   - readline: Interactive input handling
 *   - sources.js: Model definitions from all providers
 *
 *   ⚙️ Configuration:
 *   - API keys stored per-provider in ~/.free-coding-models.json (0600 perms)
 *   - Old ~/.free-coding-models plain-text auto-migrated as nvidia key on first run
 *   - Env vars override config: NVIDIA_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY, HUGGINGFACE_API_KEY/HF_TOKEN, REPLICATE_API_TOKEN, DEEPINFRA_API_KEY/DEEPINFRA_TOKEN, FIREWORKS_API_KEY, SILICONFLOW_API_KEY, TOGETHER_API_KEY, PERPLEXITY_API_KEY, ZAI_API_KEY, etc.
 *   - ZAI (z.ai) uses a non-standard base path; cloudflare needs CLOUDFLARE_ACCOUNT_ID in env.
 *   - Cloudflare Workers AI requires both CLOUDFLARE_API_TOKEN (or CLOUDFLARE_API_KEY) and CLOUDFLARE_ACCOUNT_ID
 *   - Models loaded from sources.js — all provider/model definitions are centralized there
 *   - OpenCode config: ~/.config/opencode/opencode.json
 *   - OpenClaw config: ~/.openclaw/openclaw.json
 *   - Ping timeout: 15s per attempt
 *   - Ping interval: 60 seconds (continuous monitoring mode)
 *   - Animation: 12 FPS with braille spinners
 *
 *   🚀 CLI flags:
 *   - (no flag): Show startup menu → choose OpenCode or OpenClaw
 *   - --opencode: OpenCode CLI mode (launch CLI with selected model)
 *   - --opencode-desktop: OpenCode Desktop mode (set model & open Desktop app)
 *   - --openclaw: OpenClaw mode (set selected model as default in OpenClaw)
 *   - --best: Show only top-tier models (A+, S, S+)
 *   - --fiable: Analyze 10s and output the most reliable model
 *   - --no-telemetry: Disable anonymous usage analytics for this run
 *   - --tier S/A/B/C: Filter models by tier letter (S=S+/S, A=A+/A/A-, B=B+/B, C=C)
 *
 *   @see {@link https://build.nvidia.com} NVIDIA API key generation
 *   @see {@link https://github.com/opencode-ai/opencode} OpenCode repository
 *   @see {@link https://openclaw.ai} OpenClaw documentation
 */

import chalk from 'chalk'
import { createRequire } from 'module'
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { createServer } from 'net'
import { createServer as createHttpServer } from 'http'
import { request as httpsRequest } from 'https'
import { MODELS, sources } from '../sources.js'
import { patchOpenClawModelsJson } from '../patch-openclaw-models.js'
import { getAvg, getVerdict, getUptime, getP95, getJitter, getStabilityScore, sortResults, filterByTier, findBestModel, parseArgs, TIER_ORDER, VERDICT_ORDER, TIER_LETTER_MAP, scoreModelForTask, getTopRecommendations, TASK_TYPES, PRIORITY_TYPES, CONTEXT_BUDGETS, formatCtxWindow, labelFromId, getProxyStatusInfo } from '../lib/utils.js'
import { loadConfig, saveConfig, getApiKey, resolveApiKeys, addApiKey, removeApiKey, isProviderEnabled, saveAsProfile, loadProfile, listProfiles, deleteProfile, getActiveProfileName, setActiveProfile, _emptyProfileSettings } from '../lib/config.js'
import { buildMergedModels } from '../lib/model-merger.js'
import { ProxyServer } from '../lib/proxy-server.js'
import { loadOpenCodeConfig, saveOpenCodeConfig, syncToOpenCode, restoreOpenCodeBackup } from '../lib/opencode-sync.js'
import { usageForRow as _usageForRow } from '../lib/usage-reader.js'
import { loadRecentLogs } from '../lib/log-reader.js'
import { parseOpenRouterResponse, fetchProviderQuota as _fetchProviderQuotaFromModule } from '../lib/provider-quota-fetchers.js'
import { isKnownQuotaTelemetry } from '../lib/quota-capabilities.js'

// 📖 mergedModels: cross-provider grouped model list (one entry per label, N providers each)
// 📖 mergedModelByLabel: fast lookup map from display label → merged model entry
const mergedModels = buildMergedModels(MODELS)
const mergedModelByLabel = new Map(mergedModels.map(m => [m.label, m]))

// 📖 Provider quota cache is managed by lib/provider-quota-fetchers.js (TTL + backoff).
// 📖 Usage placeholder logic uses isKnownQuotaTelemetry() from lib/quota-capabilities.js.

const require = createRequire(import.meta.url)
const readline = require('readline')

// ─── Version check ────────────────────────────────────────────────────────────
const pkg = require('../package.json')
const LOCAL_VERSION = pkg.version
const TELEMETRY_TIMEOUT = 1_200
const POSTHOG_CAPTURE_PATH = '/i/v0/e/'
const POSTHOG_DEFAULT_HOST = 'https://eu.i.posthog.com'
// 📖 Maintainer defaults for global npm telemetry (safe to publish: project key is a public ingest token).
const POSTHOG_PROJECT_KEY_DEFAULT = 'phc_5P1n8HaLof6nHM0tKJYt4bV5pj2XPb272fLVigwf1YQ'
const POSTHOG_HOST_DEFAULT = 'https://eu.i.posthog.com'

// 📖 Discord feature request webhook configuration (anonymous feedback system)
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1476709155992764427/hmnHNtpducvi5LClhv8DynENjUmmg9q8HI1Bx1lNix56UHqrqZf55rW95LGvNJ2W4j7D'
const DISCORD_BOT_NAME = 'TUI - Feature Requests'
const DISCORD_EMBED_COLOR = 0x39FF14 // Vert fluo (RGB: 57, 255, 20)

// 📖 sendFeatureRequest: Send anonymous feature request to Discord via webhook
// 📖 Called when user presses J key, types message, and presses Enter
// 📖 Returns success/error status for UI feedback
async function sendFeatureRequest(message) {
  try {
    // 📖 Collect anonymous telemetry for context (no personal data)
    const system = getTelemetrySystem()
    const terminal = getTelemetryTerminal()
    const nodeVersion = process.version
    const arch = process.arch
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
    
    // 📖 Build Discord embed with rich metadata in footer (compact format)
    const embed = {
      description: message,
      color: DISCORD_EMBED_COLOR,
      timestamp: new Date().toISOString(),
      footer: { 
        text: `v${LOCAL_VERSION} • ${system} • ${terminal} • ${nodeVersion} • ${arch} • ${timezone}`
      }
    }

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: DISCORD_BOT_NAME,
        embeds: [embed]
      }),
      signal: AbortSignal.timeout(10000) // 📖 10s timeout for webhook
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return { success: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// 📖 Discord bug report webhook configuration (anonymous bug reports)
const DISCORD_BUG_WEBHOOK_URL = 'https://discord.com/api/webhooks/1476715954409963743/5cOLf7U_891f1jwxRBLIp2RIP9xYhr4rWtOhipzKKwVdFVl1Bj89X_fB6I_uGXZiGT9E'
const DISCORD_BUG_BOT_NAME = 'TUI Bug Report'
const DISCORD_BUG_EMBED_COLOR = 0xFF5733 // Rouge (RGB: 255, 87, 51)

// 📖 sendBugReport: Send anonymous bug report to Discord via webhook
// 📖 Called when user presses I key, types message, and presses Enter
// 📖 Returns success/error status for UI feedback
async function sendBugReport(message) {
  try {
    // 📖 Collect anonymous telemetry for context (no personal data)
    const system = getTelemetrySystem()
    const terminal = getTelemetryTerminal()
    const nodeVersion = process.version
    const arch = process.arch
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
    
    // 📖 Build Discord embed with rich metadata in footer (compact format)
    const embed = {
      description: message,
      color: DISCORD_BUG_EMBED_COLOR,
      timestamp: new Date().toISOString(),
      footer: { 
        text: `v${LOCAL_VERSION} • ${system} • ${terminal} • ${nodeVersion} • ${arch} • ${timezone}`
      }
    }

    const response = await fetch(DISCORD_BUG_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: DISCORD_BUG_BOT_NAME,
        embeds: [embed]
      }),
      signal: AbortSignal.timeout(10000) // 📖 10s timeout for webhook
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return { success: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// 📖 parseTelemetryEnv: Convert env var strings into booleans.
// 📖 Returns true/false when value is recognized, otherwise null.
function parseTelemetryEnv(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return null
}

// 📖 Optional debug switch for telemetry troubleshooting (disabled by default).
function isTelemetryDebugEnabled() {
  return parseTelemetryEnv(process.env.FREE_CODING_MODELS_TELEMETRY_DEBUG) === true
}

// 📖 Writes telemetry debug traces to stderr only when explicitly enabled.
function telemetryDebug(message, meta = null) {
  if (!isTelemetryDebugEnabled()) return
  const prefix = '[telemetry-debug]'
  if (meta === null) {
    process.stderr.write(`${prefix} ${message}\n`)
    return
  }
  try {
    process.stderr.write(`${prefix} ${message} ${JSON.stringify(meta)}\n`)
  } catch {
    process.stderr.write(`${prefix} ${message}\n`)
  }
}

// 📖 Ensure telemetry config shape exists even on old config files.
function ensureTelemetryConfig(config) {
  if (!config.telemetry || typeof config.telemetry !== 'object') {
    config.telemetry = { enabled: true, anonymousId: null }
  }
  // 📖 Only default enabled when unset; do not override a user's explicit opt-out
  if (typeof config.telemetry.enabled !== 'boolean') {
    config.telemetry.enabled = true
  }
  if (typeof config.telemetry.anonymousId !== 'string' || !config.telemetry.anonymousId.trim()) {
    config.telemetry.anonymousId = null
  }
}

// 📖 Ensure favorites config shape exists and remains clean.
// 📖 Stored format: ["providerKey/modelId", ...] in insertion order.
function ensureFavoritesConfig(config) {
  if (!Array.isArray(config.favorites)) config.favorites = []
  const seen = new Set()
  config.favorites = config.favorites.filter((entry) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) return false
    if (seen.has(entry)) return false
    seen.add(entry)
    return true
  })
}

// 📖 Build deterministic key used to persist one favorite model row.
function toFavoriteKey(providerKey, modelId) {
  return `${providerKey}/${modelId}`
}

// 📖 Sync per-row favorite metadata from config (used by renderer and sorter).
function syncFavoriteFlags(results, config) {
  ensureFavoritesConfig(config)
  const favoriteRankMap = new Map(config.favorites.map((entry, index) => [entry, index]))
  for (const row of results) {
    const favoriteKey = toFavoriteKey(row.providerKey, row.modelId)
    const rank = favoriteRankMap.get(favoriteKey)
    row.favoriteKey = favoriteKey
    row.isFavorite = rank !== undefined
    row.favoriteRank = rank !== undefined ? rank : Number.MAX_SAFE_INTEGER
  }
}

// 📖 Toggle favorite state and persist immediately.
// 📖 Returns true when row is now favorite, false when removed.
function toggleFavoriteModel(config, providerKey, modelId) {
  ensureFavoritesConfig(config)
  const favoriteKey = toFavoriteKey(providerKey, modelId)
  const existingIndex = config.favorites.indexOf(favoriteKey)
  if (existingIndex >= 0) {
    config.favorites.splice(existingIndex, 1)
    saveConfig(config)
    return false
  }
  config.favorites.push(favoriteKey)
  saveConfig(config)
  return true
}

// 📖 Create or reuse a persistent anonymous distinct_id for PostHog.
// 📖 Stored locally in config so one user is stable over time without personal data.
function getTelemetryDistinctId(config) {
  ensureTelemetryConfig(config)
  if (config.telemetry.anonymousId) return config.telemetry.anonymousId

  config.telemetry.anonymousId = `anon_${randomUUID()}`
  saveConfig(config)
  return config.telemetry.anonymousId
}

// 📖 Convert Node platform to human-readable system name for analytics segmentation.
function getTelemetrySystem() {
  if (process.platform === 'darwin') return 'macOS'
  if (process.platform === 'win32') return 'Windows'
  if (process.platform === 'linux') return 'Linux'
  return process.platform
}

// 📖 Infer terminal family from environment hints for coarse usage segmentation.
// 📖 Never sends full env dumps; only a normalized terminal label is emitted.
function getTelemetryTerminal() {
  const termProgramRaw = (process.env.TERM_PROGRAM || '').trim()
  const termProgram = termProgramRaw.toLowerCase()
  const term = (process.env.TERM || '').toLowerCase()

  if (termProgram === 'apple_terminal') return 'Terminal.app'
  if (termProgram === 'iterm.app') return 'iTerm2'
  if (termProgram === 'warpterminal' || process.env.WARP_IS_LOCAL_SHELL_SESSION) return 'Warp'
  if (process.env.WT_SESSION) return 'Windows Terminal'
  if (process.env.KITTY_WINDOW_ID || term.includes('kitty')) return 'kitty'
  if (process.env.GHOSTTY_RESOURCES_DIR || term.includes('ghostty')) return 'Ghostty'
  if (process.env.WEZTERM_PANE || termProgram === 'wezterm') return 'WezTerm'
  if (process.env.KONSOLE_VERSION || termProgram === 'konsole') return 'Konsole'
  if (process.env.GNOME_TERMINAL_SCREEN || termProgram === 'gnome-terminal') return 'GNOME Terminal'
  if (process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') return 'JetBrains Terminal'
  if (process.env.TABBY_CONFIG_DIRECTORY || termProgram === 'tabby') return 'Tabby'
  if (termProgram === 'vscode' || process.env.VSCODE_GIT_IPC_HANDLE) return 'VS Code Terminal'
  if (process.env.ALACRITTY_SOCKET || term.includes('alacritty') || termProgram === 'alacritty') return 'Alacritty'
  if (term.includes('foot') || termProgram === 'foot') return 'foot'
  if (termProgram === 'hyper' || process.env.HYPER) return 'Hyper'
  if (process.env.TMUX) return 'tmux'
  if (process.env.STY) return 'screen'
  // 📖 Generic fallback for many terminals exposing TERM_PROGRAM (e.g., Rio, Contour, etc.).
  if (termProgramRaw) return termProgramRaw
  if (term) return term

  return 'unknown'
}

// 📖 Resolve telemetry effective state with clear precedence:
// 📖 CLI flag > env var > enabled by default (forced for all users).
function isTelemetryEnabled(config, cliArgs) {
  if (cliArgs.noTelemetry) return false
  const envTelemetry = parseTelemetryEnv(process.env.FREE_CODING_MODELS_TELEMETRY)
  if (envTelemetry !== null) return envTelemetry
  ensureTelemetryConfig(config)
  return true
}

// 📖 Fire-and-forget analytics ping: never blocks UX, never throws.
async function sendUsageTelemetry(config, cliArgs, payload) {
  if (!isTelemetryEnabled(config, cliArgs)) {
    telemetryDebug('skip: telemetry disabled', {
      cliNoTelemetry: cliArgs.noTelemetry === true,
      envTelemetry: process.env.FREE_CODING_MODELS_TELEMETRY || null,
      configEnabled: config?.telemetry?.enabled ?? null,
    })
    return
  }

  const apiKey = (
    process.env.FREE_CODING_MODELS_POSTHOG_KEY ||
    process.env.POSTHOG_PROJECT_API_KEY ||
    POSTHOG_PROJECT_KEY_DEFAULT ||
    ''
  ).trim()
  if (!apiKey) {
    telemetryDebug('skip: missing api key')
    return
  }

  const host = (
    process.env.FREE_CODING_MODELS_POSTHOG_HOST ||
    process.env.POSTHOG_HOST ||
    POSTHOG_HOST_DEFAULT ||
    POSTHOG_DEFAULT_HOST
  ).trim().replace(/\/+$/, '')
  if (!host) {
    telemetryDebug('skip: missing host')
    return
  }

  try {
    const endpoint = `${host}${POSTHOG_CAPTURE_PATH}`
    const distinctId = getTelemetryDistinctId(config)
    const timestamp = typeof payload?.ts === 'string' ? payload.ts : new Date().toISOString()
    const signal = (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
      ? AbortSignal.timeout(TELEMETRY_TIMEOUT)
      : undefined

    const posthogBody = {
      api_key: apiKey,
      event: payload?.event || 'app_start',
      distinct_id: distinctId,
      timestamp,
      properties: {
        $process_person_profile: false,
        source: 'cli',
        app: 'free-coding-models',
        version: payload?.version || LOCAL_VERSION,
        app_version: payload?.version || LOCAL_VERSION,
        mode: payload?.mode || 'opencode',
        system: getTelemetrySystem(),
        terminal: getTelemetryTerminal(),
      },
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(posthogBody),
      signal,
    })
    telemetryDebug('sent', {
      event: posthogBody.event,
      endpoint,
      mode: posthogBody.properties.mode,
      system: posthogBody.properties.system,
      terminal: posthogBody.properties.terminal,
    })
  } catch {
    // 📖 Ignore failures silently: analytics must never break the CLI.
    telemetryDebug('error: send failed')
  }
}

// 📖 checkForUpdateDetailed: Fetch npm latest version with explicit error details.
// 📖 Used by settings manual-check flow to display meaningful status in the UI.
async function checkForUpdateDetailed() {
  try {
    const res = await fetch('https://registry.npmjs.org/free-coding-models/latest', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { latestVersion: null, error: `HTTP ${res.status}` }
    const data = await res.json()
    if (data.version && data.version !== LOCAL_VERSION) return { latestVersion: data.version, error: null }
    return { latestVersion: null, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { latestVersion: null, error: message }
  }
}

// 📖 checkForUpdate: Backward-compatible wrapper for startup update prompt.
async function checkForUpdate() {
  const { latestVersion } = await checkForUpdateDetailed()
  return latestVersion
}

function runUpdate(latestVersion) {
  const { execSync } = require('child_process')
  console.log()
  console.log(chalk.bold.cyan('  ⬆ Updating free-coding-models to v' + latestVersion + '...'))
  console.log()
  
  try {
    // 📖 Force install from npm registry (ignore local cache)
    // 📖 Use --prefer-online to ensure we get the latest published version
    execSync(`npm i -g free-coding-models@${latestVersion} --prefer-online`, { stdio: 'inherit' })
    console.log()
    console.log(chalk.green('  ✅ Update complete! Version ' + latestVersion + ' installed.'))
    console.log()
    console.log(chalk.dim('  🔄 Restarting with new version...'))
    console.log()
    
    // 📖 Relaunch automatically with the same arguments
    const args = process.argv.slice(2)
    execSync(`node ${process.argv[1]} ${args.join(' ')}`, { stdio: 'inherit' })
    process.exit(0)
  } catch (err) {
    console.log()
    // 📖 Check if error is permission-related (EACCES or EPERM)
    const isPermissionError = err.code === 'EACCES' || err.code === 'EPERM' || 
                             (err.stderr && (err.stderr.includes('EACCES') || err.stderr.includes('permission') || 
                                              err.stderr.includes('EACCES'))) ||
                             (err.message && (err.message.includes('EACCES') || err.message.includes('permission')))
    
    if (isPermissionError) {
      console.log(chalk.yellow('  ⚠️ Permission denied. Retrying with sudo...'))
      console.log()
      try {
        execSync(`sudo npm i -g free-coding-models@${latestVersion} --prefer-online`, { stdio: 'inherit' })
        console.log()
        console.log(chalk.green('  ✅ Update complete with sudo! Version ' + latestVersion + ' installed.'))
        console.log()
        console.log(chalk.dim('  🔄 Restarting with new version...'))
        console.log()
        
        // 📖 Relaunch automatically with the same arguments
        const args = process.argv.slice(2)
        execSync(`node ${process.argv[1]} ${args.join(' ')}`, { stdio: 'inherit' })
        process.exit(0)
      } catch (sudoErr) {
        console.log()
        console.log(chalk.red('  ✖ Update failed even with sudo. Try manually:'))
        console.log(chalk.dim('    sudo npm i -g free-coding-models@' + latestVersion))
        console.log()
      }
    } else {
      console.log(chalk.red('  ✖ Update failed. Try manually: npm i -g free-coding-models@' + latestVersion))
      console.log()
    }
  }
  process.exit(1)
}

// 📖 Config is now managed via lib/config.js (JSON format ~/.free-coding-models.json)
// 📖 loadConfig/saveConfig/getApiKey are imported above

// ─── First-run wizard ─────────────────────────────────────────────────────────
// 📖 Shown when NO provider has a key configured yet.
// 📖 Steps through all configured providers sequentially — each is optional (Enter to skip).
// 📖 At least one key must be entered to proceed. Keys saved to ~/.free-coding-models.json.
// 📖 Returns the nvidia key (or null) for backward-compat with the rest of main().
async function promptApiKey(config) {
  console.log()
  console.log(chalk.bold('  🔑 First-time setup — API keys'))
  console.log(chalk.dim('  Enter keys for any provider you want to use. Press Enter to skip one.'))
  console.log()

  // 📖 Build providers from sources to keep setup in sync with actual supported providers.
  const providers = Object.keys(sources).map((key) => {
    const meta = PROVIDER_METADATA[key] || {}
    return {
      key,
      label: meta.label || sources[key]?.name || key,
      color: meta.color || chalk.white,
      url: meta.signupUrl || 'https://example.com',
      hint: meta.signupHint || 'Create API key',
    }
  })

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  // 📖 Ask a single question — returns trimmed string or '' for skip
  const ask = (question) => new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })

  for (const p of providers) {
    console.log(`  ${p.color('●')} ${chalk.bold(p.label)}`)
    console.log(chalk.dim(`    Free key at: `) + chalk.cyanBright(p.url))
    console.log(chalk.dim(`    ${p.hint}`))
    const answer = await ask(chalk.dim(`  Enter key (or Enter to skip): `))
    console.log()
    if (answer) {
      config.apiKeys[p.key] = answer
    }
  }

  rl.close()

  // 📖 Check at least one key was entered
  const anyKey = Object.values(config.apiKeys).some(v => v)
  if (!anyKey) {
    return null
  }

  saveConfig(config)
  const savedCount = Object.values(config.apiKeys).filter(v => v).length
  console.log(chalk.green(`  ✅ ${savedCount} key(s) saved to ~/.free-coding-models.json`))
  console.log(chalk.dim('  You can add or change keys anytime with the ') + chalk.yellow('P') + chalk.dim(' key in the TUI.'))
  console.log()

  // 📖 Return nvidia key for backward-compat (main() checks it exists before continuing)
  return config.apiKeys.nvidia || Object.values(config.apiKeys).find(v => v) || null
}

// ─── Update notification menu ──────────────────────────────────────────────
// 📖 Shown ONLY when a new version is available, to prompt user to update
// 📖 Centered, clean presentation that doesn't block normal usage
// 📖 Returns 'update', 'changelogs', or null to continue without update
async function promptUpdateNotification(latestVersion) {
  if (!latestVersion) return null

  return new Promise((resolve) => {
    let selected = 0
    const options = [
      {
        label: 'Update now',
        icon: '⬆',
        description: `Update free-coding-models to v${latestVersion}`,
      },
      {
        label: 'Read Changelogs',
        icon: '📋',
        description: 'Open GitHub changelog',
      },
      {
        label: 'Continue without update',
        icon: '▶',
        description: 'Use current version',
      },
    ]

    // 📖 Centered render function
    const render = () => {
      process.stdout.write('\x1b[2J\x1b[H') // clear screen + cursor home
      
      // 📖 Calculate centering
      const terminalWidth = process.stdout.columns || 80
      const maxWidth = Math.min(terminalWidth - 4, 70)
      const centerPad = ' '.repeat(Math.max(0, Math.floor((terminalWidth - maxWidth) / 2)))
      
      console.log()
      console.log(centerPad + chalk.bold.red('  ⚠ UPDATE AVAILABLE'))
      console.log(centerPad + chalk.red(`  Version ${latestVersion} is ready to install`))
      console.log()
      console.log(centerPad + chalk.bold('  ⚡ Free Coding Models') + chalk.dim(` v${LOCAL_VERSION}`))
      console.log()
      
      for (let i = 0; i < options.length; i++) {
        const isSelected = i === selected
        const bullet = isSelected ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
        const label = isSelected
          ? chalk.bold.white(options[i].icon + ' ' + options[i].label)
          : chalk.dim(options[i].icon + ' ' + options[i].label)
        
        console.log(centerPad + bullet + label)
        console.log(centerPad + chalk.dim('       ' + options[i].description))
        console.log()
      }
      
      console.log(centerPad + chalk.dim('  ↑↓ Navigate  •  Enter Select  •  Ctrl+C Continue'))
      console.log()
    }

    render()

    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) process.stdin.setRawMode(true)

    const onKey = (_str, key) => {
      if (!key) return
      if (key.ctrl && key.name === 'c') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
        resolve(null) // Continue without update
        return
      }
      if (key.name === 'up' && selected > 0) {
        selected--
        render()
      } else if (key.name === 'down' && selected < options.length - 1) {
        selected++
        render()
      } else if (key.name === 'return') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.removeListener('keypress', onKey)
        process.stdin.pause()
        
        if (selected === 0) resolve('update')
        else if (selected === 1) resolve('changelogs')
        else resolve(null) // Continue without update
      }
    }

    process.stdin.on('keypress', onKey)
  })
}

// ─── Alternate screen control ─────────────────────────────────────────────────
// 📖 \x1b[?1049h = enter alt screen  \x1b[?1049l = leave alt screen
// 📖 \x1b[?25l   = hide cursor       \x1b[?25h   = show cursor
// 📖 \x1b[H      = cursor to top
// 📖 NOTE: We avoid \x1b[2J (clear screen) because Ghostty scrolls cleared
// 📖 content into the scrollback on the alt screen, pushing the header off-screen.
// 📖 Instead we overwrite in place: cursor home, then \x1b[K (erase to EOL) per line.
// 📖 \x1b[?7l disables auto-wrap so wide rows clip at the right edge instead of
// 📖 wrapping to the next line (which would double the row height and overflow).
const ALT_ENTER  = '\x1b[?1049h\x1b[?25l\x1b[?7l'
const ALT_LEAVE  = '\x1b[?7h\x1b[?1049l\x1b[?25h'
const ALT_HOME   = '\x1b[H'

// ─── API Configuration ───────────────────────────────────────────────────────────
// 📖 Models are now loaded from sources.js to support multiple providers
// 📖 This allows easy addition of new model sources beyond NVIDIA NIM

const PING_TIMEOUT  = 15_000   // 📖 15s per attempt before abort - slow models get more time
const PING_INTERVAL = 3_000    // 📖 3s between pings — faster feedback for model selection

const FPS          = 12
const COL_MODEL    = 22
// 📖 COL_MS = dashes in hline per ping column = visual width including 2 padding spaces
// 📖 Max value: 12001ms = 7 chars. padStart(COL_MS-2) fits content, +2 spaces = COL_MS dashes
// 📖 COL_MS 11 → content padded to 9 → handles up to "12001ms" (7 chars) with room
const COL_MS       = 11

// ─── Styling ──────────────────────────────────────────────────────────────────
// 📖 Tier colors: green gradient (best) → yellow → orange → red (worst)
// 📖 Uses chalk.rgb() for fine-grained color control across 8 tier levels
const TIER_COLOR = {
  'S+': t => chalk.bold.rgb(0,   255,  80)(t),   // 🟢 bright neon green  — elite
  'S':  t => chalk.bold.rgb(80,  220,   0)(t),   // 🟢 green              — excellent
  'A+': t => chalk.bold.rgb(170, 210,   0)(t),   // 🟡 yellow-green       — great
  'A':  t => chalk.bold.rgb(240, 190,   0)(t),   // 🟡 yellow             — good
  'A-': t => chalk.bold.rgb(255, 130,   0)(t),   // 🟠 amber              — decent
  'B+': t => chalk.bold.rgb(255,  70,   0)(t),   // 🟠 orange-red         — average
  'B':  t => chalk.bold.rgb(210,  20,   0)(t),   // 🔴 red                — below avg
  'C':  t => chalk.bold.rgb(140,   0,   0)(t),   // 🔴 dark red           — lightweight
}

// 📖 COL_MS - 2 = visual content width (the 2 padding spaces are handled by │ x │ template)
const CELL_W = COL_MS - 2  // 9 chars of content per ms cell

const msCell = (ms) => {
  if (ms === null) return chalk.dim('—'.padStart(CELL_W))
  const str = String(ms).padStart(CELL_W)
  if (ms === 'TIMEOUT') return chalk.red(str)
  if (ms < 500)  return chalk.greenBright(str)
  if (ms < 1500) return chalk.yellow(str)
  return chalk.red(str)
}

const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']
// 📖 Spinner cell: braille (1-wide) + padding to fill CELL_W visual chars
const spinCell = (f, o = 0) => chalk.dim.yellow(FRAMES[(f + o) % FRAMES.length].padEnd(CELL_W))

// 📖 Overlay-specific backgrounds so Settings (P) and Help (K) are visually distinct
// 📖 from the main table and from each other.
const SETTINGS_OVERLAY_BG = chalk.bgRgb(14, 20, 30)
const HELP_OVERLAY_BG = chalk.bgRgb(24, 16, 32)
const RECOMMEND_OVERLAY_BG = chalk.bgRgb(10, 25, 15)  // 📖 Green tint for Smart Recommend
const LOG_OVERLAY_BG = chalk.bgRgb(10, 20, 26)        // 📖 Dark blue-green tint for Log page
const OVERLAY_PANEL_WIDTH = 116

// 📖 Strip ANSI color/control sequences to estimate visible text width before padding.
function stripAnsi(input) {
  return String(input).replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\][^\x1b]*\x1b\\/g, '')
}

// 📖 maskApiKey: Mask all but first 4 and last 3 characters of an API key.
// 📖 Prevents accidental disclosure of secrets in TUI display.
function maskApiKey(key) {
  if (!key || key.length < 10) return '***'
  return key.slice(0, 4) + '***' + key.slice(-3)
}

// 📖 Calculate display width of a string in terminal columns.
// 📖 Emojis and other wide characters occupy 2 columns, variation selectors (U+FE0F) are zero-width.
// 📖 This avoids pulling in a full `string-width` dependency for a lightweight CLI tool.
function displayWidth(str) {
  const plain = stripAnsi(String(str))
  let w = 0
  for (const ch of plain) {
    const cp = ch.codePointAt(0)
    // Zero-width: variation selectors (FE00-FE0F), zero-width joiner/non-joiner, combining marks
    if ((cp >= 0xFE00 && cp <= 0xFE0F) || cp === 0x200D || cp === 0x200C || cp === 0x20E3) continue
    // Wide: CJK, emoji (most above U+1F000), fullwidth forms
    if (
      cp > 0x1F000 ||                              // emoji & symbols
      (cp >= 0x2600 && cp <= 0x27BF) ||             // misc symbols, dingbats
      (cp >= 0x2300 && cp <= 0x23FF) ||             // misc technical (⏳, ⏰, etc.)
      (cp >= 0x2700 && cp <= 0x27BF) ||             // dingbats
      (cp >= 0xFE10 && cp <= 0xFE19) ||             // vertical forms
      (cp >= 0xFF01 && cp <= 0xFF60) ||             // fullwidth ASCII
      (cp >= 0xFFE0 && cp <= 0xFFE6) ||             // fullwidth signs
      (cp >= 0x4E00 && cp <= 0x9FFF) ||             // CJK unified
      (cp >= 0x3000 && cp <= 0x303F) ||             // CJK symbols
      (cp >= 0x2B50 && cp <= 0x2B55) ||             // stars, circles
      cp === 0x2705 || cp === 0x2714 || cp === 0x2716 || // check/cross marks
      cp === 0x26A0                                  // ⚠ warning sign
    ) {
      w += 2
    } else {
      w += 1
    }
  }
  return w
}

// 📖 Left-pad (padEnd equivalent) using display width instead of string length.
// 📖 Ensures columns with emoji text align correctly in the terminal.
function padEndDisplay(str, width) {
  const dw = displayWidth(str)
  const need = Math.max(0, width - dw)
  return str + ' '.repeat(need)
}

// 📖 Tint overlay lines with a fixed dark panel width so the background is clearly visible.
function tintOverlayLines(lines, bgColor) {
  return lines.map((line) => {
    const text = String(line)
    const visibleWidth = stripAnsi(text).length
    const padding = ' '.repeat(Math.max(0, OVERLAY_PANEL_WIDTH - visibleWidth))
    return bgColor(text + padding)
  })
}

// 📖 Clamp overlay scroll to valid bounds for the current terminal height.
function clampOverlayOffset(offset, totalLines, terminalRows) {
  const viewportRows = Math.max(1, terminalRows || 1)
  const maxOffset = Math.max(0, totalLines - viewportRows)
  return Math.max(0, Math.min(maxOffset, offset))
}

// 📖 Ensure a target line is visible inside overlay viewport (used by Settings cursor).
function keepOverlayTargetVisible(offset, targetLine, totalLines, terminalRows) {
  const viewportRows = Math.max(1, terminalRows || 1)
  let next = clampOverlayOffset(offset, totalLines, terminalRows)
  if (targetLine < next) next = targetLine
  else if (targetLine >= next + viewportRows) next = targetLine - viewportRows + 1
  return clampOverlayOffset(next, totalLines, terminalRows)
}

// 📖 Slice overlay lines to terminal viewport and pad with blanks to avoid stale frames.
function sliceOverlayLines(lines, offset, terminalRows) {
  const viewportRows = Math.max(1, terminalRows || 1)
  const nextOffset = clampOverlayOffset(offset, lines.length, terminalRows)
  const visible = lines.slice(nextOffset, nextOffset + viewportRows)
  while (visible.length < viewportRows) visible.push('')
  return { visible, offset: nextOffset }
}

// ─── Table renderer ───────────────────────────────────────────────────────────

// 📖 Core logic functions (getAvg, getVerdict, getUptime, sortResults, etc.)
// 📖 are imported from lib/utils.js for testability

// ─── Viewport calculation ────────────────────────────────────────────────────
// 📖 Keep these constants in sync with renderTable() fixed shell lines.
// 📖 If this drifts, model rows overflow and can push the title row out of view.
const TABLE_HEADER_LINES = 4 // 📖 title, spacer, column headers, separator
const TABLE_FOOTER_LINES = 5 // 📖 spacer, hints line 1, hints line 2, spacer, credit+links
const TABLE_FIXED_LINES = TABLE_HEADER_LINES + TABLE_FOOTER_LINES

// 📖 Computes the visible slice of model rows that fits in the terminal.
// 📖 When scroll indicators are needed, they each consume 1 line from the model budget.
function calculateViewport(terminalRows, scrollOffset, totalModels) {
  if (terminalRows <= 0) return { startIdx: 0, endIdx: totalModels, hasAbove: false, hasBelow: false }
  let maxSlots = terminalRows - TABLE_FIXED_LINES
  if (maxSlots < 1) maxSlots = 1
  if (totalModels <= maxSlots) return { startIdx: 0, endIdx: totalModels, hasAbove: false, hasBelow: false }

  const hasAbove = scrollOffset > 0
  const hasBelow = scrollOffset + maxSlots - (hasAbove ? 1 : 0) < totalModels
  // Recalculate with indicator lines accounted for
  const modelSlots = maxSlots - (hasAbove ? 1 : 0) - (hasBelow ? 1 : 0)
  const endIdx = Math.min(scrollOffset + modelSlots, totalModels)
  return { startIdx: scrollOffset, endIdx, hasAbove, hasBelow }
}

// 📖 Recommended models are pinned above favorites, favorites above non-favorites.
// 📖 Recommended: sorted by recommendation score (highest first).
// 📖 Favorites: keep insertion order (favoriteRank).
// 📖 Non-favorites: active sort column/direction.
function sortResultsWithPinnedFavorites(results, sortColumn, sortDirection) {
  const recommendedRows = results
    .filter((r) => r.isRecommended && !r.isFavorite)
    .sort((a, b) => (b.recommendScore || 0) - (a.recommendScore || 0))
  const favoriteRows = results
    .filter((r) => r.isFavorite && !r.isRecommended)
    .sort((a, b) => a.favoriteRank - b.favoriteRank)
  // 📖 Models that are both recommended AND favorite — show in recommended section
  const bothRows = results
    .filter((r) => r.isRecommended && r.isFavorite)
    .sort((a, b) => (b.recommendScore || 0) - (a.recommendScore || 0))
  const nonSpecialRows = sortResults(results.filter((r) => !r.isFavorite && !r.isRecommended), sortColumn, sortDirection)
  return [...bothRows, ...recommendedRows, ...favoriteRows, ...nonSpecialRows]
}

// 📖 renderProxyStatusLine: Maps proxyStartupStatus + active proxy into a chalk-coloured footer line.
// 📖 Always returns a non-empty string (no hidden states) so the footer row is always present.
// 📖 Delegates state classification to the pure getProxyStatusInfo helper (testable in utils.js).
function renderProxyStatusLine(proxyStartupStatus, proxyInstance) {
  const info = getProxyStatusInfo(proxyStartupStatus, !!proxyInstance)
  switch (info.state) {
    case 'starting':
      return chalk.dim('  ') + chalk.yellow('⟳ Proxy') + chalk.dim(' starting…')
    case 'running': {
      const portPart  = info.port        ? chalk.dim(` :${info.port}`) : ''
      const acctPart  = info.accountCount != null ? chalk.dim(` · ${info.accountCount} account${info.accountCount === 1 ? '' : 's'}`) : ''
      return chalk.dim('  ') + chalk.rgb(57, 255, 20)('🔀 Proxy') + chalk.rgb(57, 255, 20)(' running') + portPart + acctPart
    }
    case 'failed':
      return chalk.dim('  ') + chalk.red('✗ Proxy failed') + chalk.dim(` — ${info.reason}`)
    default:
      // stopped / not configured — dim but always present
      return chalk.dim('  🔀 Proxy not configured')
  }
}

// 📖 renderTable: mode param controls footer hint text (opencode vs openclaw)
function renderTable(results, pendingPings, frame, cursor = null, sortColumn = 'avg', sortDirection = 'asc', pingInterval = PING_INTERVAL, lastPingTime = Date.now(), mode = 'opencode', tierFilterMode = 0, scrollOffset = 0, terminalRows = 0, originFilterMode = 0, activeProfile = null, profileSaveMode = false, profileSaveBuffer = '', proxyStartupStatus = null) {
  // 📖 Filter out hidden models for display
  const visibleResults = results.filter(r => !r.hidden)

  const up      = visibleResults.filter(r => r.status === 'up').length
  const down    = visibleResults.filter(r => r.status === 'down').length
  const timeout = visibleResults.filter(r => r.status === 'timeout').length
  const pending = visibleResults.filter(r => r.status === 'pending').length

  // 📖 Calculate seconds until next ping
  const timeSinceLastPing = Date.now() - lastPingTime
  const timeUntilNextPing = Math.max(0, pingInterval - timeSinceLastPing)
  const secondsUntilNext = Math.ceil(timeUntilNextPing / 1000)

  const phase = pending > 0
    ? chalk.dim(`discovering — ${pending} remaining…`)
    : pendingPings > 0
      ? chalk.dim(`pinging — ${pendingPings} in flight…`)
      : chalk.dim(`next ping ${secondsUntilNext}s`)

  // 📖 Mode badge shown in header so user knows what Enter will do
  // 📖 Now includes key hint for mode toggle
  let modeBadge
  if (mode === 'openclaw') {
    modeBadge = chalk.bold.rgb(255, 100, 50)(' [🦞 OpenClaw]')
  } else if (mode === 'opencode-desktop') {
    modeBadge = chalk.bold.rgb(0, 200, 255)(' [🖥  Desktop]')
  } else {
    modeBadge = chalk.bold.rgb(0, 200, 255)(' [💻 CLI]')
  }
  
  // 📖 Add mode toggle hint
  const modeHint = chalk.dim.yellow(' (Z to toggle)')

  // 📖 Tier filter badge shown when filtering is active (shows exact tier name)
  const TIER_CYCLE_NAMES = [null, 'S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']
  let tierBadge = ''
  if (tierFilterMode > 0) {
    tierBadge = chalk.bold.rgb(255, 200, 0)(` [${TIER_CYCLE_NAMES[tierFilterMode]}]`)
  }

  // 📖 Origin filter badge — shown when filtering by provider is active
  let originBadge = ''
  if (originFilterMode > 0) {
    const originKeys = [null, ...Object.keys(sources)]
    const activeOriginKey = originKeys[originFilterMode]
    const activeOriginName = activeOriginKey ? sources[activeOriginKey]?.name ?? activeOriginKey : null
    if (activeOriginName) {
      originBadge = chalk.bold.rgb(100, 200, 255)(` [${activeOriginName}]`)
    }
  }

  // 📖 Profile badge — shown when a named profile is active (Shift+P to cycle, Shift+S to save)
  let profileBadge = ''
  if (activeProfile) {
    profileBadge = chalk.bold.rgb(200, 150, 255)(` [📋 ${activeProfile}]`)
  }

  // 📖 Column widths (generous spacing with margins)
  const W_RANK = 6
  const W_TIER = 6
  const W_CTX = 6
  const W_SOURCE = 14
  const W_MODEL = 26
  const W_SWE = 9
  const W_PING = 14
  const W_AVG = 11
  const W_STATUS = 18
  const W_VERDICT = 14
  const W_STAB = 11
  const W_UPTIME = 6
  const W_USAGE = 7

  // 📖 Sort models using the shared helper
  const sorted = sortResultsWithPinnedFavorites(visibleResults, sortColumn, sortDirection)

  const lines = [
    `  ${chalk.bold('⚡ Free Coding Models')} ${chalk.dim('v' + LOCAL_VERSION)}${modeBadge}${modeHint}${tierBadge}${originBadge}${profileBadge}   ` +
      chalk.greenBright(`✅ ${up}`) + chalk.dim(' up  ') +
      chalk.yellow(`⏳ ${timeout}`) + chalk.dim(' timeout  ') +
      chalk.red(`❌ ${down}`) + chalk.dim(' down  ') +
      phase,
    '',
  ]

  // 📖 Header row with sorting indicators
  // 📖 NOTE: padEnd on chalk strings counts ANSI codes, breaking alignment
  // 📖 Solution: build plain text first, then colorize
  const dir = sortDirection === 'asc' ? '↑' : '↓'

  const rankH    = 'Rank'
  const tierH    = 'Tier'
  const originH  = 'Origin'
  const modelH   = 'Model'
  const sweH     = sortColumn === 'swe' ? dir + ' SWE%' : 'SWE%'
  const ctxH     = sortColumn === 'ctx' ? dir + ' CTX' : 'CTX'
  const pingH    = sortColumn === 'ping' ? dir + ' Latest Ping' : 'Latest Ping'
  const avgH     = sortColumn === 'avg' ? dir + ' Avg Ping' : 'Avg Ping'
  const healthH  = sortColumn === 'condition' ? dir + ' Health' : 'Health'
  const verdictH = sortColumn === 'verdict' ? dir + ' Verdict' : 'Verdict'
  const stabH    = sortColumn === 'stability' ? dir + ' Stability' : 'Stability'
  const uptimeH  = sortColumn === 'uptime' ? dir + ' Up%' : 'Up%'
  const usageH   = sortColumn === 'usage' ? dir + ' Usage' : 'Usage'

  // 📖 Helper to colorize first letter for keyboard shortcuts
  // 📖 IMPORTANT: Pad PLAIN TEXT first, then apply colors to avoid alignment issues
  const colorFirst = (text, width, colorFn = chalk.yellow) => {
    const first = text[0]
    const rest = text.slice(1)
    const plainText = first + rest
    const padding = ' '.repeat(Math.max(0, width - plainText.length))
    return colorFn(first) + chalk.dim(rest + padding)
  }

  // 📖 Now colorize after padding is calculated on plain text
  const rankH_c    = colorFirst(rankH, W_RANK)
  const tierH_c    = colorFirst('Tier', W_TIER)
  const originLabel = 'Origin'
  const originH_c  = sortColumn === 'origin'
    ? chalk.bold.cyan(originLabel.padEnd(W_SOURCE))
    : (originFilterMode > 0 ? chalk.bold.rgb(100, 200, 255)(originLabel.padEnd(W_SOURCE)) : (() => {
      // 📖 Custom colorization for Origin: highlight 'O' (the sort key) at start
      const first = originLabel[0]
      const rest = originLabel.slice(1)
      const padding = ' '.repeat(Math.max(0, W_SOURCE - originLabel.length))
      return chalk.yellow(first) + chalk.dim(rest + padding)
    })())
  const modelH_c   = colorFirst(modelH, W_MODEL)
  const sweH_c     = sortColumn === 'swe' ? chalk.bold.cyan(sweH.padEnd(W_SWE)) : colorFirst(sweH, W_SWE)
  const ctxH_c     = sortColumn === 'ctx' ? chalk.bold.cyan(ctxH.padEnd(W_CTX)) : colorFirst(ctxH, W_CTX)
  const pingH_c    = sortColumn === 'ping' ? chalk.bold.cyan(pingH.padEnd(W_PING)) : colorFirst('Latest Ping', W_PING)
  const avgH_c     = sortColumn === 'avg' ? chalk.bold.cyan(avgH.padEnd(W_AVG)) : colorFirst('Avg Ping', W_AVG)
  const healthH_c  = sortColumn === 'condition' ? chalk.bold.cyan(healthH.padEnd(W_STATUS)) : colorFirst('Health', W_STATUS)
  const verdictH_c = sortColumn === 'verdict' ? chalk.bold.cyan(verdictH.padEnd(W_VERDICT)) : colorFirst(verdictH, W_VERDICT)
  // 📖 Custom colorization for Stability: highlight 'B' (the sort key) since 'S' is taken by SWE
  const stabH_c    = sortColumn === 'stability' ? chalk.bold.cyan(stabH.padEnd(W_STAB)) : (() => {
    const plain = 'Stability'
    const padding = ' '.repeat(Math.max(0, W_STAB - plain.length))
    return chalk.dim('Sta') + chalk.yellow.bold('B') + chalk.dim('ility' + padding)
  })()
  const uptimeH_c  = sortColumn === 'uptime' ? chalk.bold.cyan(uptimeH.padEnd(W_UPTIME)) : colorFirst(uptimeH, W_UPTIME, chalk.green)
  // 📖 Custom colorization for Usage: highlight 'G' (Shift+G = sort key)
  const usageH_c   = sortColumn === 'usage' ? chalk.bold.cyan(usageH.padEnd(W_USAGE)) : (() => {
    const plain = 'Usage'
    const padding = ' '.repeat(Math.max(0, W_USAGE - plain.length))
    return chalk.dim('Usa') + chalk.yellow.bold('G') + chalk.dim('e' + padding)
  })()

  // 📖 Header with proper spacing (column order: Rank, Tier, SWE%, CTX, Model, Origin, Latest Ping, Avg Ping, Health, Verdict, Stability, Up%, Usage)
  lines.push('  ' + rankH_c + '  ' + tierH_c + '  ' + sweH_c + '  ' + ctxH_c + '  ' + modelH_c + '  ' + originH_c + '  ' + pingH_c + '  ' + avgH_c + '  ' + healthH_c + '  ' + verdictH_c + '  ' + stabH_c + '  ' + uptimeH_c + '  ' + usageH_c)

  // 📖 Separator line
  lines.push(
    '  ' +
    chalk.dim('─'.repeat(W_RANK)) + '  ' +
    chalk.dim('─'.repeat(W_TIER)) + '  ' +
    chalk.dim('─'.repeat(W_SWE)) + '  ' +
    chalk.dim('─'.repeat(W_CTX)) + '  ' +
    '─'.repeat(W_MODEL) + '  ' +
    '─'.repeat(W_SOURCE) + '  ' +
    chalk.dim('─'.repeat(W_PING)) + '  ' +
    chalk.dim('─'.repeat(W_AVG)) + '  ' +
    chalk.dim('─'.repeat(W_STATUS)) + '  ' +
    chalk.dim('─'.repeat(W_VERDICT)) + '  ' +
    chalk.dim('─'.repeat(W_STAB)) + '  ' +
    chalk.dim('─'.repeat(W_UPTIME)) + '  ' +
    chalk.dim('─'.repeat(W_USAGE))
  )

  // 📖 Viewport clipping: only render models that fit on screen
  const vp = calculateViewport(terminalRows, scrollOffset, sorted.length)

  if (vp.hasAbove) {
    lines.push(chalk.dim(`  ... ${vp.startIdx} more above ...`))
  }

  for (let i = vp.startIdx; i < vp.endIdx; i++) {
    const r = sorted[i]
    const tierFn = TIER_COLOR[r.tier] ?? (t => chalk.white(t))

    const isCursor = cursor !== null && i === cursor

    // 📖 Left-aligned columns - pad plain text first, then colorize
    const num = chalk.dim(String(r.idx).padEnd(W_RANK))
    const tier = tierFn(r.tier.padEnd(W_TIER))
    // 📖 Keep terminal view provider-specific so each row is monitorable per provider
    const providerName = sources[r.providerKey]?.name ?? r.providerKey ?? 'NIM'
    const source = chalk.green(providerName.padEnd(W_SOURCE))
    // 📖 Favorites: always reserve 2 display columns at the start of Model column.
    // 📖 🎯 (2 cols) for recommended, ⭐ (2 cols) for favorites, '  ' (2 spaces) for non-favorites — keeps alignment stable.
    const favoritePrefix = r.isRecommended ? '🎯' : r.isFavorite ? '⭐' : '  '
    const prefixDisplayWidth = 2
    const nameWidth = Math.max(0, W_MODEL - prefixDisplayWidth)
    const name = favoritePrefix + r.label.slice(0, nameWidth).padEnd(nameWidth)
    const sweScore = r.sweScore ?? '—'
    // 📖 SWE% colorized on the same gradient as Tier:
    //   ≥70% bright neon green (S+), ≥60% green (S), ≥50% yellow-green (A+),
    //   ≥40% yellow (A), ≥35% amber (A-), ≥30% orange-red (B+),
    //   ≥20% red (B), <20% dark red (C), '—' dim
    let sweCell
    if (sweScore === '—') {
      sweCell = chalk.dim(sweScore.padEnd(W_SWE))
    } else {
      const sweVal = parseFloat(sweScore)
      const swePadded = sweScore.padEnd(W_SWE)
      if (sweVal >= 70)      sweCell = chalk.bold.rgb(0,   255,  80)(swePadded)
      else if (sweVal >= 60) sweCell = chalk.bold.rgb(80,  220,   0)(swePadded)
      else if (sweVal >= 50) sweCell = chalk.bold.rgb(170, 210,   0)(swePadded)
      else if (sweVal >= 40) sweCell = chalk.rgb(240, 190,   0)(swePadded)
      else if (sweVal >= 35) sweCell = chalk.rgb(255, 130,   0)(swePadded)
      else if (sweVal >= 30) sweCell = chalk.rgb(255,  70,   0)(swePadded)
      else if (sweVal >= 20) sweCell = chalk.rgb(210,  20,   0)(swePadded)
      else                   sweCell = chalk.rgb(140,   0,   0)(swePadded)
    }
    
    // 📖 Context window column - colorized by size (larger = better)
    const ctxRaw = r.ctx ?? '—'
    const ctxCell = ctxRaw !== '—' && (ctxRaw.includes('128k') || ctxRaw.includes('200k') || ctxRaw.includes('1m'))
      ? chalk.greenBright(ctxRaw.padEnd(W_CTX))
      : ctxRaw !== '—' && (ctxRaw.includes('32k') || ctxRaw.includes('64k'))
      ? chalk.cyan(ctxRaw.padEnd(W_CTX))
      : chalk.dim(ctxRaw.padEnd(W_CTX))

    // 📖 Latest ping - pings are objects: { ms, code }
    // 📖 Show response time for 200 (success) and 401 (no-auth but server is reachable)
    const latestPing = r.pings.length > 0 ? r.pings[r.pings.length - 1] : null
    let pingCell
    if (!latestPing) {
      pingCell = chalk.dim('———'.padEnd(W_PING))
    } else if (latestPing.code === '200') {
      // 📖 Success - show response time
      const str = String(latestPing.ms).padEnd(W_PING)
      pingCell = latestPing.ms < 500 ? chalk.greenBright(str) : latestPing.ms < 1500 ? chalk.yellow(str) : chalk.red(str)
    } else if (latestPing.code === '401') {
      // 📖 401 = no API key but server IS reachable — still show latency in dim
      pingCell = chalk.dim(String(latestPing.ms).padEnd(W_PING))
    } else {
      // 📖 Error or timeout - show "———" (error code is already in Status column)
      pingCell = chalk.dim('———'.padEnd(W_PING))
    }

    // 📖 Avg ping (just number, no "ms")
    const avg = getAvg(r)
    let avgCell
    if (avg !== Infinity) {
      const str = String(avg).padEnd(W_AVG)
      avgCell = avg < 500 ? chalk.greenBright(str) : avg < 1500 ? chalk.yellow(str) : chalk.red(str)
    } else {
      avgCell = chalk.dim('———'.padEnd(W_AVG))
    }

    // 📖 Status column - build plain text with emoji, pad, then colorize
    // 📖 Different emojis for different error codes
    let statusText, statusColor
    if (r.status === 'noauth') {
      // 📖 Server responded but needs an API key — shown dimly since it IS reachable
      statusText = `🔑 NO KEY`
      statusColor = (s) => chalk.dim(s)
    } else if (r.status === 'pending') {
      statusText = `${FRAMES[frame % FRAMES.length]} wait`
      statusColor = (s) => chalk.dim.yellow(s)
    } else if (r.status === 'up') {
      statusText = `✅ UP`
      statusColor = (s) => s
    } else if (r.status === 'timeout') {
      statusText = `⏳ TIMEOUT`
      statusColor = (s) => chalk.yellow(s)
    } else if (r.status === 'down') {
      const code = r.httpCode ?? 'ERR'
      // 📖 Different emojis for different error codes
      const errorEmojis = {
        '429': '🔥',  // Rate limited / overloaded
        '404': '🚫',  // Not found
        '500': '💥',  // Internal server error
        '502': '🔌',  // Bad gateway
        '503': '🔒',  // Service unavailable
        '504': '⏰',  // Gateway timeout
      }
      const emoji = errorEmojis[code] || '❌'
      statusText = `${emoji} ${code}`
      statusColor = (s) => chalk.red(s)
    } else {
      statusText = '?'
      statusColor = (s) => chalk.dim(s)
    }
    const status = statusColor(padEndDisplay(statusText, W_STATUS))

    // 📖 Verdict column - use getVerdict() for stability-aware verdicts, then render with emoji
    const verdict = getVerdict(r)
    let verdictText, verdictColor
    // 📖 Verdict colors follow the same green→red gradient as TIER_COLOR / SWE%
    switch (verdict) {
      case 'Perfect':
        verdictText = 'Perfect 🚀'
        verdictColor = (s) => chalk.bold.rgb(0, 255, 180)(s)    // bright cyan-green — stands out from Normal
        break
      case 'Normal':
        verdictText = 'Normal ✅'
        verdictColor = (s) => chalk.bold.rgb(140, 200, 0)(s)    // lime-yellow — clearly warmer than Perfect
        break
      case 'Spiky':
        verdictText = 'Spiky 📈'
        verdictColor = (s) => chalk.bold.rgb(170, 210, 0)(s)    // A+ yellow-green
        break
      case 'Slow':
        verdictText = 'Slow 🐢'
        verdictColor = (s) => chalk.bold.rgb(255, 130, 0)(s)    // A- amber
        break
      case 'Very Slow':
        verdictText = 'Very Slow 🐌'
        verdictColor = (s) => chalk.bold.rgb(255, 70, 0)(s)     // B+ orange-red
        break
      case 'Overloaded':
        verdictText = 'Overloaded 🔥'
        verdictColor = (s) => chalk.bold.rgb(210, 20, 0)(s)     // B red
        break
      case 'Unstable':
        verdictText = 'Unstable ⚠️'
        verdictColor = (s) => chalk.bold.rgb(175, 10, 0)(s)     // between B and C
        break
      case 'Not Active':
        verdictText = 'Not Active 👻'
        verdictColor = (s) => chalk.dim(s)
        break
      case 'Pending':
        verdictText = 'Pending ⏳'
        verdictColor = (s) => chalk.dim(s)
        break
      default:
        verdictText = 'Unusable 💀'
        verdictColor = (s) => chalk.bold.rgb(140, 0, 0)(s)      // C dark red
        break
    }
    // 📖 Use padEndDisplay to account for emoji display width (2 cols each) so all rows align
    const speedCell = verdictColor(padEndDisplay(verdictText, W_VERDICT))

    // 📖 Stability column - composite score (0–100) from p95 + jitter + spikes + uptime
    // 📖 Left-aligned to sit flush under the column header
    const stabScore = getStabilityScore(r)
    let stabCell
    if (stabScore < 0) {
      stabCell = chalk.dim('———'.padEnd(W_STAB))
    } else if (stabScore >= 80) {
      stabCell = chalk.greenBright(String(stabScore).padEnd(W_STAB))
    } else if (stabScore >= 60) {
      stabCell = chalk.cyan(String(stabScore).padEnd(W_STAB))
    } else if (stabScore >= 40) {
      stabCell = chalk.yellow(String(stabScore).padEnd(W_STAB))
    } else {
      stabCell = chalk.red(String(stabScore).padEnd(W_STAB))
    }

    // 📖 Uptime column - percentage of successful pings
    // 📖 Left-aligned to sit flush under the column header
    const uptimePercent = getUptime(r)
    const uptimeStr = uptimePercent + '%'
    let uptimeCell
    if (uptimePercent >= 90) {
      uptimeCell = chalk.greenBright(uptimeStr.padEnd(W_UPTIME))
    } else if (uptimePercent >= 70) {
      uptimeCell = chalk.yellow(uptimeStr.padEnd(W_UPTIME))
    } else if (uptimePercent >= 50) {
      uptimeCell = chalk.rgb(255, 165, 0)(uptimeStr.padEnd(W_UPTIME)) // orange
    } else {
      uptimeCell = chalk.red(uptimeStr.padEnd(W_UPTIME))
    }

    // 📖 When cursor is on this row, render Model and Origin in bright white for readability
    const nameCell = isCursor ? chalk.white.bold(favoritePrefix + r.label.slice(0, nameWidth).padEnd(nameWidth)) : name
    const sourceCursorText = providerName.padEnd(W_SOURCE)
    const sourceCell = isCursor ? chalk.white.bold(sourceCursorText) : source

    // 📖 Usage column — quota percent remaining from token-stats.json (higher = more quota left)
    let usageCell
    if (r.usagePercent !== undefined && r.usagePercent !== null) {
      const usageStr = Math.round(r.usagePercent) + '%'
      if (r.usagePercent >= 80) {
        usageCell = chalk.greenBright(usageStr.padEnd(W_USAGE))
      } else if (r.usagePercent >= 50) {
        usageCell = chalk.yellow(usageStr.padEnd(W_USAGE))
      } else if (r.usagePercent >= 20) {
        usageCell = chalk.rgb(255, 165, 0)(usageStr.padEnd(W_USAGE)) // orange
      } else {
        usageCell = chalk.red(usageStr.padEnd(W_USAGE))
      }
    } else {
      usageCell = chalk.dim(usagePlaceholderForProvider(r.providerKey).padEnd(W_USAGE))
    }

    // 📖 Build row with double space between columns (order: Rank, Tier, SWE%, CTX, Model, Origin, Latest Ping, Avg Ping, Health, Verdict, Stability, Up%, Usage)
    const row = '  ' + num + '  ' + tier + '  ' + sweCell + '  ' + ctxCell + '  ' + nameCell + '  ' + sourceCell + '  ' + pingCell + '  ' + avgCell + '  ' + status + '  ' + speedCell + '  ' + stabCell + '  ' + uptimeCell + '  ' + usageCell

    if (isCursor) {
      lines.push(chalk.bgRgb(50, 0, 60)(row))
    } else if (r.isRecommended) {
      // 📖 Medium green background for recommended models (distinguishable from favorites)
      lines.push(chalk.bgRgb(15, 40, 15)(row))
    } else if (r.isFavorite) {
      lines.push(chalk.bgRgb(35, 20, 0)(row))
    } else {
      lines.push(row)
    }
  }

  if (vp.hasBelow) {
    lines.push(chalk.dim(`  ... ${sorted.length - vp.endIdx} more below ...`))
  }

   // 📖 Profile save inline prompt — shown when Shift+S is pressed, replaces spacer line
   if (profileSaveMode) {
     lines.push(chalk.bgRgb(40, 20, 60)(`  📋 Save profile as: ${chalk.cyanBright(profileSaveBuffer + '▏')}  ${chalk.dim('Enter save  •  Esc cancel')}`))
   } else {
     lines.push('')
   }
  const intervalSec = Math.round(pingInterval / 1000)

  // 📖 Footer hints adapt based on active mode
  const actionHint = mode === 'openclaw'
    ? chalk.rgb(255, 100, 50)('Enter→SetOpenClaw')
    : mode === 'opencode-desktop'
      ? chalk.rgb(0, 200, 255)('Enter→OpenDesktop')
      : chalk.rgb(0, 200, 255)('Enter→OpenCode')
  // 📖 Line 1: core navigation + sorting shortcuts
  lines.push(chalk.dim(`  ↑↓ Navigate  •  `) + actionHint + chalk.dim(`  •  `) + chalk.yellow('F') + chalk.dim(` Favorite  •  R/Y/O/M/L/A/S/C/H/V/B/U/`) + chalk.yellow('G') + chalk.dim(` Sort  •  `) + chalk.yellow('T') + chalk.dim(` Tier  •  `) + chalk.yellow('N') + chalk.dim(` Origin  •  W↓/=↑ (${intervalSec}s)  •  `) + chalk.rgb(255, 100, 50).bold('Z') + chalk.dim(` Mode  •  `) + chalk.yellow('X') + chalk.dim(` Logs  •  `) + chalk.yellow('P') + chalk.dim(` Settings  •  `) + chalk.rgb(0, 255, 80).bold('K') + chalk.dim(` Help`))
  // 📖 Line 2: profiles, recommend, feature request, bug report, and extended hints — gives visibility to less-obvious features
  lines.push(chalk.dim(`  `) + chalk.rgb(200, 150, 255).bold('⇧P') + chalk.dim(` Cycle profile  •  `) + chalk.rgb(200, 150, 255).bold('⇧S') + chalk.dim(` Save profile  •  `) + chalk.rgb(0, 200, 180).bold('Q') + chalk.dim(` Smart Recommend  •  `) + chalk.rgb(57, 255, 20).bold('J') + chalk.dim(` Request feature  •  `) + chalk.rgb(255, 87, 51).bold('I') + chalk.dim(` Report bug  •  `) + chalk.yellow('E') + chalk.dim(`/`) + chalk.yellow('D') + chalk.dim(` Tier ↑↓  •  `) + chalk.yellow('Esc') + chalk.dim(` Close overlay  •  Ctrl+C Exit`))
  // 📖 Proxy status line — always rendered with explicit state (starting/running/failed/stopped)
  lines.push(renderProxyStatusLine(proxyStartupStatus, activeProxy))
  lines.push(
    chalk.rgb(255, 150, 200)('  Made with 💖 & ☕ by \x1b]8;;https://github.com/vava-nessa\x1b\\vava-nessa\x1b]8;;\x1b\\') +
    chalk.dim('  •  ') +
    '⭐ ' +
    chalk.yellow('\x1b]8;;https://github.com/vava-nessa/free-coding-models\x1b\\Star on GitHub\x1b]8;;\x1b\\') +
    chalk.dim('  •  ') +
    '🤝 ' +
    chalk.rgb(255, 165, 0)('\x1b]8;;https://github.com/vava-nessa/free-coding-models/graphs/contributors\x1b\\Contributors\x1b]8;;\x1b\\') +
    chalk.dim('  •  ') +
    '💬 ' +
    chalk.rgb(200, 150, 255)('\x1b]8;;https://discord.gg/5MbTnDC3Md\x1b\\Discord\x1b]8;;\x1b\\') +
    chalk.dim(' → ') +
    chalk.rgb(200, 150, 255)('https://discord.gg/5MbTnDC3Md') +
    chalk.dim('  •  ') +
    chalk.dim('Ctrl+C Exit')
  )

  // 📖 Append \x1b[K (erase to EOL) to each line so leftover chars from previous
  // 📖 frames are cleared. Then pad with blank cleared lines to fill the terminal,
  // 📖 preventing stale content from lingering at the bottom after resize.
  const EL = '\x1b[K'
  const cleared = lines.map(l => l + EL)
  const remaining = terminalRows > 0 ? Math.max(0, terminalRows - cleared.length) : 0
  for (let i = 0; i < remaining; i++) cleared.push(EL)
  return cleared.join('\n')
}

// ─── HTTP ping ────────────────────────────────────────────────────────────────

// 📖 ping: Send a single chat completion request to measure model availability and latency.
// 📖 providerKey and url determine provider-specific request format.
// 📖 apiKey can be null — in that case no Authorization header is sent.
// 📖 A 401 response still tells us the server is UP and gives us real latency.
function resolveCloudflareUrl(url) {
  // 📖 Cloudflare's OpenAI-compatible endpoint is account-scoped.
  // 📖 We resolve {account_id} from env so provider setup can stay simple in config.
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  if (!url.includes('{account_id}')) return url
  if (!accountId) return url.replace('{account_id}', 'missing-account-id')
  return url.replace('{account_id}', encodeURIComponent(accountId))
}

function buildPingRequest(apiKey, modelId, providerKey, url) {
  // 📖 ZAI models are stored as "zai/glm-..." in sources.js but the API expects just "glm-..."
  const apiModelId = providerKey === 'zai' ? modelId.replace(/^zai\//, '') : modelId

  if (providerKey === 'replicate') {
    // 📖 Replicate uses /v1/predictions with a different payload than OpenAI chat-completions.
    const replicateHeaders = { 'Content-Type': 'application/json', Prefer: 'wait=4' }
    if (apiKey) replicateHeaders.Authorization = `Token ${apiKey}`
    return {
      url,
      headers: replicateHeaders,
      body: { version: modelId, input: { prompt: 'hi' } },
    }
  }

  if (providerKey === 'cloudflare') {
    // 📖 Cloudflare Workers AI uses OpenAI-compatible payload but needs account_id in URL.
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    return {
      url: resolveCloudflareUrl(url),
      headers,
      body: { model: apiModelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (providerKey === 'openrouter') {
    // 📖 OpenRouter recommends optional app identification headers.
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }

  return {
    url,
    headers,
    body: { model: apiModelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
  }
}

async function ping(apiKey, modelId, providerKey, url) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT)
  const t0    = performance.now()
  try {
    const req = buildPingRequest(apiKey, modelId, providerKey, url)
    const resp = await fetch(req.url, {
      method: 'POST', signal: ctrl.signal,
      headers: req.headers,
      body: JSON.stringify(req.body),
    })
    // 📖 Normalize all HTTP 2xx statuses to "200" so existing verdict/avg logic still works.
    const code = resp.status >= 200 && resp.status < 300 ? '200' : String(resp.status)
    return {
      code,
      ms: Math.round(performance.now() - t0),
      quotaPercent: extractQuotaPercent(resp.headers),
    }
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    return {
      code: isTimeout ? '000' : 'ERR',
      ms: isTimeout ? 'TIMEOUT' : Math.round(performance.now() - t0),
      quotaPercent: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

function getHeaderValue(headers, key) {
  if (!headers) return null
  if (typeof headers.get === 'function') return headers.get(key)
  return headers[key] ?? headers[key.toLowerCase()] ?? null
}

function extractQuotaPercent(headers) {
  const variants = [
    ['x-ratelimit-remaining', 'x-ratelimit-limit'],
    ['x-ratelimit-remaining-requests', 'x-ratelimit-limit-requests'],
    ['ratelimit-remaining', 'ratelimit-limit'],
    ['ratelimit-remaining-requests', 'ratelimit-limit-requests'],
  ]

  for (const [remainingKey, limitKey] of variants) {
    const remainingRaw = getHeaderValue(headers, remainingKey)
    const limitRaw = getHeaderValue(headers, limitKey)
    const remaining = parseFloat(remainingRaw)
    const limit = parseFloat(limitRaw)
    if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) {
      const pct = Math.round((remaining / limit) * 100)
      return Math.max(0, Math.min(100, pct))
    }
  }

  return null
}

// ─── Provider endpoint quota polling ─────────────────────────────────────────
// 📖 Moved to lib/provider-quota-fetchers.js for modularity + SiliconFlow support.
// 📖 parseOpenRouterResponse re-exported here for extractQuotaPercent usage.

async function fetchOpenRouterQuotaPercent(apiKey) {
  // Delegate to module; uses module-level cache + error backoff
  return _fetchProviderQuotaFromModule('openrouter', apiKey)
}

async function fetchProviderQuotaPercent(providerKey, apiKey) {
  // Delegate to unified module entrypoint (handles openrouter + siliconflow)
  return _fetchProviderQuotaFromModule(providerKey, apiKey)
}

async function getProviderQuotaPercentCached(providerKey, apiKey) {
  // The module already implements TTL cache and error backoff internally.
  // This wrapper preserves the existing call-site API.
  return fetchProviderQuotaPercent(providerKey, apiKey)
}

function usagePlaceholderForProvider(providerKey) {
  // 📖 'N/A' for providers with no reliable quota signal (unknown telemetry type),
  // 📖 '--' for providers that expose quota via headers or a dedicated endpoint.
  return isKnownQuotaTelemetry(providerKey) ? '--' : 'N/A'
}

// ─── OpenCode integration ──────────────────────────────────────────────────────
// 📖 Platform-specific config path
const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

// ─── OpenCode model ID mapping ─────────────────────────────────────────────────
// 📖 Source model IDs -> OpenCode built-in model IDs (only where they differ)
// 📖 Groq's API aliases short names to full names, but OpenCode does exact ID matching
// 📖 against its built-in model list. Unmapped models pass through as-is.
const OPENCODE_MODEL_MAP = {
  groq: {
    'moonshotai/kimi-k2-instruct': 'moonshotai/kimi-k2-instruct-0905',
    'meta-llama/llama-4-scout-17b-16e-preview': 'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-preview': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  }
}

function getOpenCodeModelId(providerKey, modelId) {
  // 📖 Model IDs in sources.js include the provider prefix (e.g. "nvidia/llama-3.1-...")
  // 📖 but OpenCode expects just the model part after provider/ since we build
  // 📖 the full ref as `${providerKey}/${ocModelId}` in startOpenCode
  if (providerKey === 'nvidia') return modelId.replace(/^nvidia\//, '')
  if (providerKey === 'zai') return modelId.replace(/^zai\//, '')
  return OPENCODE_MODEL_MAP[providerKey]?.[modelId] || modelId
}

// 📖 Env var names per provider -- used for passing resolved keys to child processes
const ENV_VAR_NAMES = {
  nvidia:     'NVIDIA_API_KEY',
  groq:       'GROQ_API_KEY',
  cerebras:   'CEREBRAS_API_KEY',
  sambanova:  'SAMBANOVA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  huggingface:'HUGGINGFACE_API_KEY',
  replicate:  'REPLICATE_API_TOKEN',
  deepinfra:  'DEEPINFRA_API_KEY',
  fireworks:  'FIREWORKS_API_KEY',
  codestral:  'CODESTRAL_API_KEY',
  hyperbolic: 'HYPERBOLIC_API_KEY',
  scaleway:   'SCALEWAY_API_KEY',
  googleai:   'GOOGLE_API_KEY',
  siliconflow:'SILICONFLOW_API_KEY',
  together:   'TOGETHER_API_KEY',
  cloudflare: 'CLOUDFLARE_API_TOKEN',
  perplexity: 'PERPLEXITY_API_KEY',
  zai:        'ZAI_API_KEY',
}

// 📖 Provider metadata used by the setup wizard and Settings details panel.
// 📖 Keeps signup links + rate limits centralized so UI stays consistent.
const PROVIDER_METADATA = {
  nvidia: {
    label: 'NVIDIA NIM',
    color: chalk.rgb(118, 185, 0),
    signupUrl: 'https://build.nvidia.com',
    signupHint: 'Profile → API Keys → Generate',
    rateLimits: 'Free tier (provider quota by model)',
  },
  groq: {
    label: 'Groq',
    color: chalk.rgb(249, 103, 20),
    signupUrl: 'https://console.groq.com/keys',
    signupHint: 'API Keys → Create API Key',
    rateLimits: 'Free dev tier (provider quota)',
  },
  cerebras: {
    label: 'Cerebras',
    color: chalk.rgb(0, 180, 255),
    signupUrl: 'https://cloud.cerebras.ai',
    signupHint: 'API Keys → Create',
    rateLimits: 'Free dev tier (provider quota)',
  },
  sambanova: {
    label: 'SambaNova',
    color: chalk.rgb(255, 165, 0),
    signupUrl: 'https://cloud.sambanova.ai/apis',
    signupHint: 'SambaCloud portal → Create API key',
    rateLimits: 'Dev tier generous quota',
  },
  openrouter: {
    label: 'OpenRouter',
    color: chalk.rgb(120, 80, 255),
    signupUrl: 'https://openrouter.ai/keys',
    signupHint: 'API Keys → Create',
    rateLimits: '50 req/day, 20/min (:free shared quota)',
  },
  huggingface: {
    label: 'Hugging Face Inference',
    color: chalk.rgb(255, 182, 0),
    signupUrl: 'https://huggingface.co/settings/tokens',
    signupHint: 'Settings → Access Tokens',
    rateLimits: 'Free monthly credits (~$0.10)',
  },
  replicate: {
    label: 'Replicate',
    color: chalk.rgb(120, 160, 255),
    signupUrl: 'https://replicate.com/account/api-tokens',
    signupHint: 'Account → API Tokens',
    rateLimits: 'Developer free quota',
  },
  deepinfra: {
    label: 'DeepInfra',
    color: chalk.rgb(0, 180, 140),
    signupUrl: 'https://deepinfra.com/login',
    signupHint: 'Login → API keys',
    rateLimits: 'Free dev tier (low-latency quota)',
  },
  fireworks: {
    label: 'Fireworks AI',
    color: chalk.rgb(255, 80, 50),
    signupUrl: 'https://fireworks.ai',
    signupHint: 'Create account → Generate API key',
    rateLimits: '$1 free credits (new dev accounts)',
  },
  codestral: {
    label: 'Mistral Codestral',
    color: chalk.rgb(255, 100, 100),
    signupUrl: 'https://codestral.mistral.ai',
    signupHint: 'API Keys → Create',
    rateLimits: '30 req/min, 2000/day',
  },
  hyperbolic: {
    label: 'Hyperbolic',
    color: chalk.rgb(0, 200, 150),
    signupUrl: 'https://app.hyperbolic.ai/settings',
    signupHint: 'Settings → API Keys',
    rateLimits: '$1 free trial credits',
  },
  scaleway: {
    label: 'Scaleway',
    color: chalk.rgb(130, 0, 250),
    signupUrl: 'https://console.scaleway.com/iam/api-keys',
    signupHint: 'IAM → API Keys',
    rateLimits: '1M free tokens',
  },
  googleai: {
    label: 'Google AI Studio',
    color: chalk.rgb(66, 133, 244),
    signupUrl: 'https://aistudio.google.com/apikey',
    signupHint: 'Get API key',
    rateLimits: '14.4K req/day, 30/min',
  },
  siliconflow: {
    label: 'SiliconFlow',
    color: chalk.rgb(255, 120, 30),
    signupUrl: 'https://cloud.siliconflow.cn/account/ak',
    signupHint: 'API Keys → Create',
    rateLimits: 'Free models: usually 100 RPM, varies by model',
  },
  together: {
    label: 'Together AI',
    color: chalk.rgb(0, 180, 255),
    signupUrl: 'https://api.together.ai/settings/api-keys',
    signupHint: 'Settings → API keys',
    rateLimits: 'Credits/promos vary by account (check console)',
  },
  cloudflare: {
    label: 'Cloudflare Workers AI',
    color: chalk.rgb(242, 119, 36),
    signupUrl: 'https://dash.cloudflare.com',
    signupHint: 'Create AI API token + set CLOUDFLARE_ACCOUNT_ID',
    rateLimits: 'Free: 10k neurons/day, text-gen 300 RPM',
  },
  perplexity: {
    label: 'Perplexity API',
    color: chalk.rgb(0, 210, 190),
    signupUrl: 'https://www.perplexity.ai/settings/api',
    signupHint: 'Generate API key (billing may be required)',
    rateLimits: 'Tiered limits by spend (default ~50 RPM)',
  },
  qwen: {
    label: 'Alibaba Cloud (DashScope)',
    color: chalk.rgb(255, 140, 0),
    signupUrl: 'https://modelstudio.console.alibabacloud.com',
    signupHint: 'Model Studio → API Key → Create (1M free tokens, 90 days)',
    rateLimits: '1M free tokens per model (Singapore region, 90 days)',
  },
  zai: {
    label: 'ZAI (z.ai)',
    color: chalk.rgb(0, 150, 255),
    signupUrl: 'https://z.ai',
    signupHint: 'Sign up and generate an API key',
    rateLimits: 'Free tier (generous quota)',
  },
  iflow: {
    label: 'iFlow',
    color: chalk.rgb(100, 200, 255),
    signupUrl: 'https://platform.iflow.cn',
    signupHint: 'Register → Personal Information → Generate API Key (7-day expiry)',
    rateLimits: 'Free for individuals (no request limits)',
  },
}

// 📖 OpenCode config location: ~/.config/opencode/opencode.json on ALL platforms.
// 📖 OpenCode uses xdg-basedir which resolves to %USERPROFILE%\.config on Windows.
const OPENCODE_CONFIG = join(homedir(), '.config', 'opencode', 'opencode.json')
const OPENCODE_PORT_RANGE_START = 4096
const OPENCODE_PORT_RANGE_END = 5096

// 📖 isTcpPortAvailable: checks if a local TCP port is free for OpenCode.
// 📖 Used to avoid tmux sub-agent port conflicts when multiple projects run in parallel.
function isTcpPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port)
  })
}

// 📖 resolveOpenCodeTmuxPort: selects a safe port for OpenCode when inside tmux.
// 📖 Priority:
// 📖 1) OPENCODE_PORT from env (if valid and available)
// 📖 2) First available port in 4096-5095
async function resolveOpenCodeTmuxPort() {
  const envPortRaw = process.env.OPENCODE_PORT
  const envPort = Number.parseInt(envPortRaw || '', 10)

  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
    if (await isTcpPortAvailable(envPort)) {
      return { port: envPort, source: 'env' }
    }
    console.log(chalk.yellow(`  ⚠ OPENCODE_PORT=${envPort} is already in use; selecting another port for this run.`))
  }

  for (let port = OPENCODE_PORT_RANGE_START; port < OPENCODE_PORT_RANGE_END; port++) {
    if (await isTcpPortAvailable(port)) {
      return { port, source: 'auto' }
    }
  }

  return null
}

function getOpenCodeConfigPath() {
  return OPENCODE_CONFIG
}

// ─── Shared OpenCode spawn helper ──────────────────────────────────────────────
// 📖 Resolves the actual API key from config/env and passes it as an env var
// 📖 to the child process so OpenCode's {env:GROQ_API_KEY} references work
// 📖 even when the key is only in ~/.free-coding-models.json (not in shell env).
// 📖 createZaiProxy: Localhost reverse proxy that bridges ZAI's non-standard API paths
// 📖 to OpenCode's expected /v1/* OpenAI-compatible format.
// 📖 OpenCode's local provider calls GET /v1/models for discovery and POST /v1/chat/completions
// 📖 for inference. ZAI's API lives at /api/coding/paas/v4/* instead — this proxy rewrites.
// 📖 Returns { server, port } — caller must server.close() when done.
async function createZaiProxy(apiKey) {
  const server = createHttpServer((req, res) => {
    let targetPath = req.url
    // 📖 Rewrite /v1/* → /api/coding/paas/v4/*
    if (targetPath.startsWith('/v1/')) {
      targetPath = '/api/coding/paas/v4/' + targetPath.slice(4)
    } else if (targetPath.startsWith('/v1')) {
      targetPath = '/api/coding/paas/v4' + targetPath.slice(3)
    } else {
      // 📖 Non /v1 paths (e.g. /api/v0/ health checks) — reject
      res.writeHead(404)
      res.end()
      return
    }
    const headers = { ...req.headers, host: 'api.z.ai' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    // 📖 Remove transfer-encoding to avoid chunked encoding issues with https.request
    delete headers['transfer-encoding']
    const proxyReq = httpsRequest({
      hostname: 'api.z.ai',
      port: 443,
      path: targetPath,
      method: req.method,
      headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', () => { res.writeHead(502); res.end() })
    req.pipe(proxyReq)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return { server, port: server.address().port }
}

async function spawnOpenCode(args, providerKey, fcmConfig, existingZaiProxy = null) {
  const envVarName = ENV_VAR_NAMES[providerKey]
  const resolvedKey = getApiKey(fcmConfig, providerKey)
  const childEnv = { ...process.env }
  // 📖 Suppress MaxListenersExceededWarning from @modelcontextprotocol/sdk
  // 📖 when 7+ MCP servers cause drain listener count to exceed default 10
  childEnv.NODE_NO_WARNINGS = '1'
  const finalArgs = [...args]
  const hasExplicitPortArg = finalArgs.includes('--port')
  if (envVarName && resolvedKey) childEnv[envVarName] = resolvedKey

  // 📖 ZAI proxy: OpenCode's Go binary doesn't know about ZAI as a provider.
  // 📖 We spin up a localhost proxy that rewrites /v1/* → /api/coding/paas/v4/*
  // 📖 and register ZAI as a custom openai-compatible provider in opencode.json.
  // 📖 If startOpenCode already started the proxy, reuse it (existingZaiProxy).
  let zaiProxy = existingZaiProxy
  if (providerKey === 'zai' && resolvedKey && !zaiProxy) {
    const { server, port } = await createZaiProxy(resolvedKey)
    zaiProxy = server
    console.log(chalk.dim(`  🔀 ZAI proxy listening on port ${port} (rewrites /v1/* → ZAI API)`))
  }

  // 📖 In tmux, OpenCode sub-agents need a listening port to open extra panes.
  // 📖 We auto-pick one if the user did not provide --port explicitly.
  if (process.env.TMUX && !hasExplicitPortArg) {
    const tmuxPort = await resolveOpenCodeTmuxPort()
    if (tmuxPort) {
      const portValue = String(tmuxPort.port)
      childEnv.OPENCODE_PORT = portValue
      finalArgs.push('--port', portValue)
      if (tmuxPort.source === 'env') {
        console.log(chalk.dim(`  📺 tmux detected — using OPENCODE_PORT=${portValue}.`))
      } else {
        console.log(chalk.dim(`  📺 tmux detected — using OpenCode port ${portValue} for sub-agent panes.`))
      }
    } else {
      console.log(chalk.yellow(`  ⚠ tmux detected but no free OpenCode port found in ${OPENCODE_PORT_RANGE_START}-${OPENCODE_PORT_RANGE_END - 1}; launching without --port.`))
    }
  }

  const { spawn } = await import('child_process')
  const child = spawn('opencode', finalArgs, {
    stdio: 'inherit',
    shell: true,
    detached: false,
    env: childEnv
  })

  return new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (zaiProxy) zaiProxy.close()
      // 📖 ZAI cleanup: remove the ephemeral proxy provider from opencode.json
      // 📖 so a stale baseURL doesn't cause "Model zai/… is not valid" on next launch
      if (providerKey === 'zai') {
        try {
          const cfg = loadOpenCodeConfig()
          if (cfg.provider?.zai) delete cfg.provider.zai
          if (typeof cfg.model === 'string' && cfg.model.startsWith('zai/')) delete cfg.model
          saveOpenCodeConfig(cfg)
        } catch { /* best-effort cleanup */ }
      }
      resolve(code)
    })
    child.on('error', (err) => {
      if (zaiProxy) zaiProxy.close()
      if (err.code === 'ENOENT') {
        console.error(chalk.red('\n  X Could not find "opencode" -- is it installed and in your PATH?'))
        console.error(chalk.dim('    Install: npm i -g opencode   or see https://opencode.ai'))
        resolve(1)
      } else {
        reject(err)
      }
    })
  })
}

// ─── Start OpenCode ────────────────────────────────────────────────────────────
// 📖 Launches OpenCode with the selected model.
// 📖 Handles nvidia + all OpenAI-compatible providers defined in sources.js.
// 📖 For nvidia: checks if NIM is configured, sets provider.models entry, spawns with nvidia/model-id.
// 📖 For groq/cerebras: OpenCode has built-in support -- just sets model in config and spawns.
// 📖 Model format: { modelId, label, tier, providerKey }
// 📖 fcmConfig: the free-coding-models config (for resolving API keys)
async function startOpenCode(model, fcmConfig) {
  const providerKey = model.providerKey ?? 'nvidia'
  // 📖 Map model ID to OpenCode's built-in ID if it differs from our source ID
  const ocModelId = getOpenCodeModelId(providerKey, model.modelId)
  const modelRef = `${providerKey}/${ocModelId}`

  if (providerKey === 'nvidia') {
    // 📖 NVIDIA NIM needs a custom provider block in OpenCode config (not built-in)
    // 📖 Auto-create it if missing — same pattern as all other providers
    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    // 📖 Ensure nvidia provider block exists — auto-create if missing
    if (!config.provider) config.provider = {}
    if (!config.provider.nvidia) {
      config.provider.nvidia = {
        npm: '@ai-sdk/openai-compatible',
        name: 'NVIDIA NIM',
        options: {
          baseURL: 'https://integrate.api.nvidia.com/v1',
          apiKey: '{env:NVIDIA_API_KEY}'
        },
        models: {}
      }
      console.log(chalk.green('  + Auto-configured NVIDIA NIM provider in OpenCode'))
    }

    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    config.model = modelRef

    // 📖 Register the model in the nvidia provider's models section
    if (!config.provider.nvidia.models) config.provider.nvidia.models = {}
    config.provider.nvidia.models[ocModelId] = { name: model.label }

    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Starting OpenCode...'))
    console.log()

    await spawnOpenCode(['--model', modelRef], providerKey, fcmConfig)
  } else {
    if (providerKey === 'replicate') {
      console.log(chalk.yellow('  Replicate models are monitor-only for now in OpenCode mode.'))
      console.log(chalk.dim('    Reason: Replicate uses /v1/predictions instead of OpenAI chat-completions.'))
      console.log(chalk.dim('    You can still benchmark this model in the TUI and use other providers for OpenCode launch.'))
      console.log()
      return
    }

    // 📖 ZAI: OpenCode's Go binary has no built-in ZAI provider.
    // 📖 We start a localhost proxy that rewrites /v1/* → /api/coding/paas/v4/*
    // 📖 and register ZAI as a custom openai-compatible provider pointing to the proxy.
    // 📖 This gives OpenCode a standard provider/model format (zai/glm-5) it understands.
    if (providerKey === 'zai') {
      const resolvedKey = getApiKey(fcmConfig, providerKey)
      if (!resolvedKey) {
        console.log(chalk.yellow('  ZAI API key not found. Set ZAI_API_KEY environment variable.'))
        console.log()
        return
      }

      // 📖 Start proxy FIRST to get the port for config
      const { server: zaiProxyServer, port: zaiProxyPort } = await createZaiProxy(resolvedKey)
      console.log(chalk.dim(`  ZAI proxy listening on port ${zaiProxyPort} (rewrites /v1/* -> ZAI API)`))

      console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default...`))
      console.log(chalk.dim(`  Model: ${modelRef}`))
      console.log()

      const config = loadOpenCodeConfig()
      const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

      if (existsSync(getOpenCodeConfigPath())) {
        copyFileSync(getOpenCodeConfigPath(), backupPath)
        console.log(chalk.dim(`  Backup: ${backupPath}`))
      }

      // 📖 Register ZAI as an openai-compatible provider pointing to our localhost proxy
      // 📖 apiKey is required by @ai-sdk/openai-compatible SDK — the proxy handles real auth internally
      if (!config.provider) config.provider = {}
      config.provider.zai = {
        npm: '@ai-sdk/openai-compatible',
        name: 'ZAI',
        options: {
          baseURL: `http://127.0.0.1:${zaiProxyPort}/v1`,
          apiKey: 'zai-proxy',
        },
        models: {}
      }
      config.provider.zai.models[ocModelId] = { name: model.label }
      config.model = modelRef

      saveOpenCodeConfig(config)

      const savedConfig = loadOpenCodeConfig()
      console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
      console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
      console.log()

      if (savedConfig.model === config.model) {
        console.log(chalk.green(`  Default model set to: ${modelRef}`))
      } else {
        console.log(chalk.yellow(`  Config might not have been saved correctly`))
      }
      console.log()
      console.log(chalk.dim('  Starting OpenCode...'))
      console.log()

      // 📖 Pass existing proxy to spawnOpenCode so it doesn't start a second one
      await spawnOpenCode(['--model', modelRef], providerKey, fcmConfig, zaiProxyServer)
      return
    }

    // 📖 Groq: built-in OpenCode provider — needs provider block with apiKey in opencode.json.
    // 📖 Cerebras: NOT built-in — needs @ai-sdk/openai-compatible + baseURL, like NVIDIA.
    // 📖 Both need the model registered in provider.<key>.models so OpenCode can find it.
    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    // 📖 Ensure the provider block exists in config — create it if missing
    if (!config.provider) config.provider = {}
    if (!config.provider[providerKey]) {
      if (providerKey === 'groq') {
        // 📖 Groq is a built-in OpenCode provider — just needs apiKey options, no npm package
        config.provider.groq = {
          options: { apiKey: '{env:GROQ_API_KEY}' },
          models: {}
        }
      } else if (providerKey === 'cerebras') {
        // 📖 Cerebras is OpenAI-compatible — needs npm package and baseURL like NVIDIA
        config.provider.cerebras = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Cerebras',
          options: {
            baseURL: 'https://api.cerebras.ai/v1',
            apiKey: '{env:CEREBRAS_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'sambanova') {
        // 📖 SambaNova is OpenAI-compatible — uses @ai-sdk/openai-compatible with their base URL
        config.provider.sambanova = {
          npm: '@ai-sdk/openai-compatible',
          name: 'SambaNova',
          options: {
            baseURL: 'https://api.sambanova.ai/v1',
            apiKey: '{env:SAMBANOVA_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'openrouter') {
        config.provider.openrouter = {
          npm: '@ai-sdk/openai-compatible',
          name: 'OpenRouter',
          options: {
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: '{env:OPENROUTER_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'huggingface') {
        config.provider.huggingface = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Hugging Face Inference',
          options: {
            baseURL: 'https://router.huggingface.co/v1',
            apiKey: '{env:HUGGINGFACE_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'deepinfra') {
        config.provider.deepinfra = {
          npm: '@ai-sdk/openai-compatible',
          name: 'DeepInfra',
          options: {
            baseURL: 'https://api.deepinfra.com/v1/openai',
            apiKey: '{env:DEEPINFRA_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'fireworks') {
        config.provider.fireworks = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Fireworks AI',
          options: {
            baseURL: 'https://api.fireworks.ai/inference/v1',
            apiKey: '{env:FIREWORKS_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'codestral') {
        config.provider.codestral = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Mistral Codestral',
          options: {
            baseURL: 'https://codestral.mistral.ai/v1',
            apiKey: '{env:CODESTRAL_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'hyperbolic') {
        config.provider.hyperbolic = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Hyperbolic',
          options: {
            baseURL: 'https://api.hyperbolic.xyz/v1',
            apiKey: '{env:HYPERBOLIC_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'scaleway') {
        config.provider.scaleway = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Scaleway',
          options: {
            baseURL: 'https://api.scaleway.ai/v1',
            apiKey: '{env:SCALEWAY_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'googleai') {
        config.provider.googleai = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Google AI Studio',
          options: {
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: '{env:GOOGLE_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'siliconflow') {
        config.provider.siliconflow = {
          npm: '@ai-sdk/openai-compatible',
          name: 'SiliconFlow',
          options: {
            baseURL: 'https://api.siliconflow.com/v1',
            apiKey: '{env:SILICONFLOW_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'together') {
        config.provider.together = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Together AI',
          options: {
            baseURL: 'https://api.together.xyz/v1',
            apiKey: '{env:TOGETHER_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'cloudflare') {
        const cloudflareAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
        if (!cloudflareAccountId) {
          console.log(chalk.yellow('  Cloudflare Workers AI requires CLOUDFLARE_ACCOUNT_ID for OpenCode integration.'))
          console.log(chalk.dim('    Export CLOUDFLARE_ACCOUNT_ID and retry this selection.'))
          console.log()
          return
        }
        config.provider.cloudflare = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Cloudflare Workers AI',
          options: {
            baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`,
            apiKey: '{env:CLOUDFLARE_API_TOKEN}'
          },
          models: {}
        }
      } else if (providerKey === 'perplexity') {
        config.provider.perplexity = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Perplexity API',
          options: {
            baseURL: 'https://api.perplexity.ai',
            apiKey: '{env:PERPLEXITY_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'iflow') {
        config.provider.iflow = {
          npm: '@ai-sdk/openai-compatible',
          name: 'iFlow',
          options: {
            baseURL: 'https://apis.iflow.cn/v1',
            apiKey: '{env:IFLOW_API_KEY}'
          },
          models: {}
        }
      }
    }

    // 📖 Register the model in the provider's models section
    // 📖 Only register custom models -- skip if the model maps to a built-in OpenCode ID
    const isBuiltinMapped = OPENCODE_MODEL_MAP[providerKey]?.[model.modelId]
    if (!isBuiltinMapped) {
      if (!config.provider[providerKey].models) config.provider[providerKey].models = {}
      config.provider[providerKey].models[ocModelId] = { name: model.label }
    }

    config.model = modelRef
    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Starting OpenCode...'))
    console.log()

    await spawnOpenCode(['--model', modelRef], providerKey, fcmConfig)
  }
}

// ─── Proxy lifecycle (multi-account rotation) ─────────────────────────────────
// 📖 Module-level proxy state — shared between startProxyAndLaunch, cleanupProxy, and renderTable.
let activeProxy = null         // 📖 ProxyServer instance while proxy is running, null otherwise
let proxyCleanedUp = false     // 📖 Guards against double-cleanup on concurrent exit signals
let exitHandlersRegistered = false // 📖 Guards against registering handlers multiple times

// 📖 cleanupProxy: Gracefully stops the active proxy server if one is running.
// 📖 Called on OpenCode exit and on process exit signals.
async function cleanupProxy() {
  if (proxyCleanedUp || !activeProxy) return
  proxyCleanedUp = true
  const proxy = activeProxy
  activeProxy = null
  try {
    await proxy.stop()
  } catch { /* best-effort */ }
}

// 📖 registerExitHandlers: Ensures SIGINT/SIGTERM/exit handlers are registered exactly once.
// 📖 Cleans up the proxy before the process exits so we don't leave a dangling HTTP server.
function registerExitHandlers() {
  if (exitHandlersRegistered) return
  exitHandlersRegistered = true
  const cleanup = () => { cleanupProxy().catch(() => {}) }
  process.once('SIGINT',  cleanup)
  process.once('SIGTERM', cleanup)
  process.once('exit',    cleanup)
}

// 📖 startProxyAndLaunch: Starts ProxyServer with N accounts and launches OpenCode via fcm-proxy.
// 📖 Falls back to the normal direct flow if the proxy cannot start.
function buildProxyTopologyFromConfig(fcmConfig) {
  const accounts = []
  const proxyModels = {}

  for (const merged of mergedModels) {
    proxyModels[merged.slug] = { name: merged.label }

    for (const providerEntry of merged.providers) {
      const keys = resolveApiKeys(fcmConfig, providerEntry.providerKey)
      const providerSource = sources[providerEntry.providerKey]
      if (!providerSource) continue

      const rawUrl = resolveCloudflareUrl(providerSource.url)
      const baseUrl = rawUrl.replace(/\/chat\/completions$/, '')

      keys.forEach((apiKey, keyIdx) => {
        accounts.push({
          id: `${providerEntry.providerKey}/${merged.slug}/${keyIdx}`,
          providerKey: providerEntry.providerKey,
          proxyModelId: merged.slug,
          modelId: providerEntry.modelId,
          url: baseUrl,
          apiKey,
        })
      })
    }
  }

  return { accounts, proxyModels }
}

async function ensureProxyRunning(fcmConfig, { forceRestart = false } = {}) {
  registerExitHandlers()
  proxyCleanedUp = false

  if (forceRestart && activeProxy) {
    await cleanupProxy()
  }

  const existingStatus = activeProxy?.getStatus?.()
  if (existingStatus?.running === true) {
    // Derive available slugs from the running proxy's accounts
    const availableModelSlugs = new Set(
      (activeProxy._accounts || []).map(a => a.proxyModelId).filter(Boolean)
    )
    return {
      port: existingStatus.port,
      accountCount: existingStatus.accountCount,
      proxyToken: activeProxy?._proxyApiKey,
      proxyModels: null,
      availableModelSlugs,
    }
  }

  const { accounts, proxyModels } = buildProxyTopologyFromConfig(fcmConfig)
  if (accounts.length === 0) {
    throw new Error('No API keys found for proxy-capable models')
  }

  const proxyToken = `fcm_${randomUUID().replace(/-/g, '')}`
  const proxy = new ProxyServer({ accounts, proxyApiKey: proxyToken })
  const { port } = await proxy.start()
  activeProxy = proxy

  const availableModelSlugs = new Set(accounts.map(a => a.proxyModelId).filter(Boolean))
  return { port, accountCount: accounts.length, proxyToken, proxyModels, availableModelSlugs }
}

// 📖 autoStartProxyIfSynced: Fire-and-forget startup orchestrator.
// 📖 Reads OpenCode config; if fcm-proxy provider is present, starts the proxy.
// 📖 Updates state.proxyStartupStatus with explicit transitions:
// 📖   'starting' → 'running' (with port/accountCount) or 'failed' (with reason).
// 📖 After the proxy starts, rewrites opencode.json with the runtime port/token so
// 📖 OpenCode immediately points to the live proxy (not a stale persisted value).
// 📖 Non-FCM providers and other top-level keys are preserved by mergeOcConfig.
// 📖 Never throws — must not crash startup.
async function autoStartProxyIfSynced(fcmConfig, state) {
  try {
    const ocConfig = loadOpenCodeConfig()
    if (!ocConfig?.provider?.['fcm-proxy']) {
      // 📖 No synced fcm-proxy entry — nothing to auto-start.
      return
    }

    state.proxyStartupStatus = { phase: 'starting' }

    const started = await ensureProxyRunning(fcmConfig)

    // 📖 Rewrite opencode.json with the runtime port/token assigned by the OS.
    // 📖 This is safe: mergeOcConfig (called inside syncToOpenCode) preserves all
    // 📖 non-FCM providers (anthropic, openai, google, etc.) and other top-level
    // 📖 keys ($schema, mcp, plugin, command, model).
    syncToOpenCode(fcmConfig, sources, mergedModels, {
      proxyPort: started.port,
      proxyToken: started.proxyToken,
      availableModelSlugs: started.availableModelSlugs,
    })

    state.proxyStartupStatus = {
      phase: 'running',
      port: started.port,
      accountCount: started.accountCount,
    }
  } catch (err) {
    state.proxyStartupStatus = {
      phase: 'failed',
      reason: err?.message ?? String(err),
    }
  }
}

async function startProxyAndLaunch(model, fcmConfig) {
  try {
    const started = await ensureProxyRunning(fcmConfig, { forceRestart: true })
    const merged = mergedModelByLabel.get(model.label)
    const defaultProxyModelId = merged?.slug ?? model.modelId

    if (!started.proxyModels || Object.keys(started.proxyModels).length === 0) {
      throw new Error('Proxy model catalog is empty')
    }

    console.log(chalk.dim(`  🔀 Multi-account proxy listening on port ${started.port} (${started.accountCount} accounts)`))
    await startOpenCodeWithProxy(model, started.port, defaultProxyModelId, started.proxyModels, fcmConfig, started.proxyToken)
  } catch (err) {
    console.error(chalk.red(`  ✗ Proxy failed to start: ${err.message}`))
    console.log(chalk.dim('  Falling back to direct single-account flow…'))
    await cleanupProxy()
    await startOpenCode(model, fcmConfig)
  }
}

// 📖 startOpenCodeWithProxy: Registers fcm-proxy provider in OpenCode config,
// 📖 spawns OpenCode with that provider, then removes the ephemeral config after exit.
async function startOpenCodeWithProxy(model, port, proxyModelId, proxyModels, fcmConfig, proxyToken) {
  const config = loadOpenCodeConfig()
  if (!config.provider) config.provider = {}
  const previousProxyProvider = config.provider['fcm-proxy']
  const previousModel = config.model

  const fallbackModelId = Object.keys(proxyModels)[0]
  const selectedProxyModelId = proxyModels[proxyModelId] ? proxyModelId : fallbackModelId

  // 📖 Register ephemeral fcm-proxy provider pointing to our local proxy server
  config.provider['fcm-proxy'] = {
    npm: '@ai-sdk/openai-compatible',
    name: 'FCM Proxy',
    options: {
      baseURL: `http://127.0.0.1:${port}/v1`,
      apiKey: proxyToken
    },
    models: proxyModels
  }
  config.model = `fcm-proxy/${selectedProxyModelId}`
  saveOpenCodeConfig(config)

  console.log(chalk.green(`  Setting ${chalk.bold(model.label)} via proxy as default for OpenCode…`))
  console.log(chalk.dim(`  Model: fcm-proxy/${selectedProxyModelId}  •  Proxy: http://127.0.0.1:${port}/v1`))
  console.log(chalk.dim(`  Catalog: ${Object.keys(proxyModels).length} models available via fcm-proxy`))
  console.log()

  try {
    await spawnOpenCode(['--model', `fcm-proxy/${selectedProxyModelId}`], 'fcm-proxy', fcmConfig)
  } finally {
    // 📖 Best-effort cleanup: restore previous fcm-proxy/model values if they existed
    try {
      const savedCfg = loadOpenCodeConfig()
      if (!savedCfg.provider) savedCfg.provider = {}

      if (previousProxyProvider) {
        savedCfg.provider['fcm-proxy'] = previousProxyProvider
      } else if (savedCfg.provider['fcm-proxy']) {
        delete savedCfg.provider['fcm-proxy']
      }

      if (typeof previousModel === 'string' && previousModel.length > 0) {
        savedCfg.model = previousModel
      } else if (typeof savedCfg.model === 'string' && savedCfg.model.startsWith('fcm-proxy/')) {
        delete savedCfg.model
      }

      saveOpenCodeConfig(savedCfg)
    } catch { /* best-effort */ }
    await cleanupProxy()
  }
}

// ─── Start OpenCode Desktop ─────────────────────────────────────────────────────
// 📖 startOpenCodeDesktop: Same config logic as startOpenCode, but opens the Desktop app.
// 📖 OpenCode Desktop shares config at the same location as CLI.
// 📖 Handles nvidia + all OpenAI-compatible providers defined in sources.js.
// 📖 No need to wait for exit — Desktop app stays open independently.
async function startOpenCodeDesktop(model, fcmConfig) {
  const providerKey = model.providerKey ?? 'nvidia'
  // 📖 Map model ID to OpenCode's built-in ID if it differs from our source ID
  const ocModelId = getOpenCodeModelId(providerKey, model.modelId)
  const modelRef = `${providerKey}/${ocModelId}`

  // 📖 Helper to open the Desktop app based on platform
  const launchDesktop = async () => {
    const { exec } = await import('child_process')
    let command
    if (isMac) {
      command = 'open -a OpenCode'
    } else if (isWindows) {
      command = 'start "" "%LOCALAPPDATA%\\Programs\\OpenCode\\OpenCode.exe" 2>nul || start "" "%PROGRAMFILES%\\OpenCode\\OpenCode.exe" 2>nul || start OpenCode'
    } else if (isLinux) {
      command = `opencode-desktop --model ${modelRef} 2>/dev/null || flatpak run ai.opencode.OpenCode --model ${modelRef} 2>/dev/null || snap run opencode --model ${modelRef} 2>/dev/null || xdg-open /usr/share/applications/opencode.desktop 2>/dev/null || echo "OpenCode not found"`
    }
    exec(command, (err) => {
      if (err) {
        console.error(chalk.red('  Could not open OpenCode Desktop'))
        if (isWindows) {
          console.error(chalk.dim('    Make sure OpenCode is installed from https://opencode.ai'))
        } else if (isLinux) {
          console.error(chalk.dim('    Install via: snap install opencode OR flatpak install ai.opencode.OpenCode'))
          console.error(chalk.dim('    Or download from https://opencode.ai'))
        } else {
          console.error(chalk.dim('    Is it installed at /Applications/OpenCode.app?'))
        }
      }
    })
  }

  if (providerKey === 'nvidia') {
    // 📖 NVIDIA NIM needs a custom provider block in OpenCode config (not built-in)
    // 📖 Auto-create it if missing — same pattern as all other providers
    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    // 📖 Ensure nvidia provider block exists — auto-create if missing
    if (!config.provider) config.provider = {}
    if (!config.provider.nvidia) {
      config.provider.nvidia = {
        npm: '@ai-sdk/openai-compatible',
        name: 'NVIDIA NIM',
        options: {
          baseURL: 'https://integrate.api.nvidia.com/v1',
          apiKey: '{env:NVIDIA_API_KEY}'
        },
        models: {}
      }
      console.log(chalk.green('  + Auto-configured NVIDIA NIM provider in OpenCode'))
    }

    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default for OpenCode Desktop...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    config.model = modelRef

    // 📖 Register the model in the nvidia provider's models section
    if (!config.provider.nvidia.models) config.provider.nvidia.models = {}
    config.provider.nvidia.models[ocModelId] = { name: model.label }

    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Opening OpenCode Desktop...'))
    console.log()

    await launchDesktop()
  } else {
    if (providerKey === 'replicate') {
      console.log(chalk.yellow('  Replicate models are monitor-only for now in OpenCode Desktop mode.'))
      console.log(chalk.dim('    Reason: Replicate uses /v1/predictions instead of OpenAI chat-completions.'))
      console.log(chalk.dim('    You can still benchmark this model in the TUI and use other providers for Desktop launch.'))
      console.log()
      return
    }

    // 📖 ZAI: Desktop mode can't use the localhost proxy (Desktop is a standalone app).
    // 📖 Direct the user to use OpenCode CLI mode instead, which supports ZAI via proxy.
    if (providerKey === 'zai') {
      console.log(chalk.yellow('  ZAI models are supported in OpenCode CLI mode only (not Desktop).'))
      console.log(chalk.dim('    Reason: ZAI requires a localhost proxy that only works with the CLI spawn.'))
      console.log(chalk.dim('    Use OpenCode CLI mode (default) to launch ZAI models.'))
      console.log()
      return
    }

    // 📖 Groq: built-in OpenCode provider — needs provider block with apiKey in opencode.json.
    // 📖 Cerebras: NOT built-in — needs @ai-sdk/openai-compatible + baseURL, like NVIDIA.
    // 📖 Both need the model registered in provider.<key>.models so OpenCode can find it.
    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default for OpenCode Desktop...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    // 📖 Ensure the provider block exists in config — create it if missing
    if (!config.provider) config.provider = {}
    if (!config.provider[providerKey]) {
      if (providerKey === 'groq') {
        config.provider.groq = {
          options: { apiKey: '{env:GROQ_API_KEY}' },
          models: {}
        }
      } else if (providerKey === 'cerebras') {
        config.provider.cerebras = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Cerebras',
          options: {
            baseURL: 'https://api.cerebras.ai/v1',
            apiKey: '{env:CEREBRAS_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'sambanova') {
        // 📖 SambaNova is OpenAI-compatible — uses @ai-sdk/openai-compatible with their base URL
        config.provider.sambanova = {
          npm: '@ai-sdk/openai-compatible',
          name: 'SambaNova',
          options: {
            baseURL: 'https://api.sambanova.ai/v1',
            apiKey: '{env:SAMBANOVA_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'openrouter') {
        config.provider.openrouter = {
          npm: '@ai-sdk/openai-compatible',
          name: 'OpenRouter',
          options: {
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: '{env:OPENROUTER_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'huggingface') {
        config.provider.huggingface = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Hugging Face Inference',
          options: {
            baseURL: 'https://router.huggingface.co/v1',
            apiKey: '{env:HUGGINGFACE_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'deepinfra') {
        config.provider.deepinfra = {
          npm: '@ai-sdk/openai-compatible',
          name: 'DeepInfra',
          options: {
            baseURL: 'https://api.deepinfra.com/v1/openai',
            apiKey: '{env:DEEPINFRA_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'fireworks') {
        config.provider.fireworks = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Fireworks AI',
          options: {
            baseURL: 'https://api.fireworks.ai/inference/v1',
            apiKey: '{env:FIREWORKS_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'codestral') {
        config.provider.codestral = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Mistral Codestral',
          options: {
            baseURL: 'https://codestral.mistral.ai/v1',
            apiKey: '{env:CODESTRAL_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'hyperbolic') {
        config.provider.hyperbolic = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Hyperbolic',
          options: {
            baseURL: 'https://api.hyperbolic.xyz/v1',
            apiKey: '{env:HYPERBOLIC_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'scaleway') {
        config.provider.scaleway = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Scaleway',
          options: {
            baseURL: 'https://api.scaleway.ai/v1',
            apiKey: '{env:SCALEWAY_API_KEY}'
          },
          models: {}
        }
      } else if (providerKey === 'googleai') {
        config.provider.googleai = {
          npm: '@ai-sdk/openai-compatible',
          name: 'Google AI Studio',
          options: {
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
            apiKey: '{env:GOOGLE_API_KEY}'
          },
          models: {}
        }
      }
    }

    // 📖 Register the model in the provider's models section
    // 📖 Only register custom models -- skip if the model maps to a built-in OpenCode ID
    const isBuiltinMapped = OPENCODE_MODEL_MAP[providerKey]?.[model.modelId]
    if (!isBuiltinMapped) {
      if (!config.provider[providerKey].models) config.provider[providerKey].models = {}
      config.provider[providerKey].models[ocModelId] = { name: model.label }
    }

    config.model = modelRef
    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Opening OpenCode Desktop...'))
    console.log()

    await launchDesktop()
  }
}

// ─── OpenClaw integration ──────────────────────────────────────────────────────
// 📖 OpenClaw config: ~/.openclaw/openclaw.json (JSON format, may be JSON5 in newer versions)
// 📖 To set a model: set agents.defaults.model.primary = "nvidia/model-id"
// 📖 Providers section uses baseUrl + apiKey + api: "openai-completions" format
// 📖 See: https://docs.openclaw.ai/gateway/configuration
const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json')

function loadOpenClawConfig() {
  if (!existsSync(OPENCLAW_CONFIG)) return {}
  try {
    // 📖 JSON.parse works for standard JSON; OpenClaw may use JSON5 but base config is valid JSON
    return JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf8'))
  } catch {
    return {}
  }
}

function saveOpenClawConfig(config) {
  const dir = join(homedir(), '.openclaw')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2))
}

// 📖 startOpenClaw: sets the selected NVIDIA NIM model as default in OpenClaw config.
// 📖 Also ensures the nvidia provider block is present with the NIM base URL.
// 📖 Does NOT launch OpenClaw — OpenClaw runs as a daemon, so config changes are picked up on restart.
async function startOpenClaw(model, apiKey) {
  console.log(chalk.rgb(255, 100, 50)(`  🦞 Setting ${chalk.bold(model.label)} as OpenClaw default…`))
  console.log(chalk.dim(`  Model: nvidia/${model.modelId}`))
  console.log()

  const config = loadOpenClawConfig()

  // 📖 Backup existing config before touching it
  if (existsSync(OPENCLAW_CONFIG)) {
    const backupPath = `${OPENCLAW_CONFIG}.backup-${Date.now()}`
    copyFileSync(OPENCLAW_CONFIG, backupPath)
    console.log(chalk.dim(`  💾 Backup: ${backupPath}`))
  }

  // 📖 Patch models.json to add all NVIDIA models (fixes "not allowed" errors)
  const patchResult = patchOpenClawModelsJson()
  if (patchResult.wasPatched) {
    console.log(chalk.dim(`  ✨ Added ${patchResult.added} NVIDIA models to allowlist (${patchResult.total} total)`))
    if (patchResult.backup) {
      console.log(chalk.dim(`  💾 models.json backup: ${patchResult.backup}`))
    }
  }

  // 📖 Ensure models.providers section exists with nvidia NIM block.
  // 📖 Per OpenClaw docs (docs.openclaw.ai/providers/nvidia), providers MUST be nested under
  // 📖 "models.providers", NOT at the config root. Root-level "providers" is ignored by OpenClaw.
  // 📖 API key is NOT stored in the provider block — it's read from env var NVIDIA_API_KEY.
  // 📖 If needed, it can be stored under the root "env" key: { env: { NVIDIA_API_KEY: "nvapi-..." } }
  if (!config.models) config.models = {}
  if (!config.models.providers) config.models.providers = {}
  if (!config.models.providers.nvidia) {
    config.models.providers.nvidia = {
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      api: 'openai-completions',
      models: [],
    }
    console.log(chalk.dim('  ➕ Added nvidia provider block to OpenClaw config (models.providers.nvidia)'))
  }
  // 📖 Ensure models array exists even if the provider block was created by an older version
  if (!Array.isArray(config.models.providers.nvidia.models)) {
    config.models.providers.nvidia.models = []
  }

  // 📖 Store API key in the root "env" section so OpenClaw can read it as NVIDIA_API_KEY env var.
  // 📖 Only writes if not already set to avoid overwriting an existing key.
  const resolvedKey = apiKey || process.env.NVIDIA_API_KEY
  if (resolvedKey) {
    if (!config.env) config.env = {}
    if (!config.env.NVIDIA_API_KEY) {
      config.env.NVIDIA_API_KEY = resolvedKey
      console.log(chalk.dim('  🔑 Stored NVIDIA_API_KEY in config env section'))
    }
  }

  // 📖 Set as the default primary model for all agents.
  // 📖 Format: "provider/model-id" — e.g. "nvidia/deepseek-ai/deepseek-v3.2"
  // 📖 Set as the default primary model for all agents.
  // 📖 Format: "provider/model-id" — e.g. "nvidia/deepseek-ai/deepseek-v3.2"
  if (!config.agents) config.agents = {}
  if (!config.agents.defaults) config.agents.defaults = {}
  if (!config.agents.defaults.model) config.agents.defaults.model = {}
  config.agents.defaults.model.primary = `nvidia/${model.modelId}`

  // 📖 REQUIRED: OpenClaw requires the model to be explicitly listed in agents.defaults.models
  // 📖 (the allowlist). Without this entry, OpenClaw rejects the model with "not allowed".
  // 📖 See: https://docs.openclaw.ai/gateway/configuration-reference
  if (!config.agents.defaults.models) config.agents.defaults.models = {}
  config.agents.defaults.models[`nvidia/${model.modelId}`] = {}

  saveOpenClawConfig(config)

  console.log(chalk.rgb(255, 140, 0)(`  ✓ Default model set to: nvidia/${model.modelId}`))
  console.log()
  console.log(chalk.dim('  📄 Config updated: ' + OPENCLAW_CONFIG))
  console.log()
  // 📖 "openclaw restart" does NOT exist. The gateway auto-reloads on config file changes.
  // 📖 To apply manually: use "openclaw models set" or "openclaw configure"
  // 📖 See: https://docs.openclaw.ai/gateway/configuration
  console.log(chalk.dim('  💡 OpenClaw will reload config automatically (gateway.reload.mode).'))
  console.log(chalk.dim('     To apply manually: openclaw models set nvidia/' + model.modelId))
  console.log(chalk.dim('     Or run the setup wizard: openclaw configure'))
  console.log()
}

// ─── Helper function to find best model after analysis ────────────────────────
// 📖 findBestModel is imported from lib/utils.js

// ─── Function to run in fiable mode (10-second analysis then output best model) ──
async function runFiableMode(config) {
  console.log(chalk.cyan('  ⚡ Analyzing models for reliability (10 seconds)...'))
  console.log()

  // 📖 Only include models from enabled providers that have API keys
  let results = MODELS
    .filter(([,,,,,providerKey]) => {
      return isProviderEnabled(config, providerKey) && getApiKey(config, providerKey)
    })
    .map(([modelId, label, tier, sweScore, ctx, providerKey], i) => ({
      idx: i + 1, modelId, label, tier, sweScore, ctx, providerKey,
      status: 'pending',
      pings: [],
      httpCode: null,
    }))

  const startTime = Date.now()
  const analysisDuration = 10000 // 10 seconds

  // 📖 Run initial pings using per-provider API key and URL
  const pingPromises = results.map(r => {
    const rApiKey = getApiKey(config, r.providerKey)
    const url = sources[r.providerKey]?.url
    return ping(rApiKey, r.modelId, r.providerKey, url).then(({ code, ms }) => {
      r.pings.push({ ms, code })
      if (code === '200') {
        r.status = 'up'
      } else if (code === '000') {
        r.status = 'timeout'
      } else {
        r.status = 'down'
        r.httpCode = code
      }
    })
  })

  await Promise.allSettled(pingPromises)

  // 📖 Continue pinging for the remaining time
  const remainingTime = Math.max(0, analysisDuration - (Date.now() - startTime))
  if (remainingTime > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingTime))
  }

  // 📖 Find best model
  const best = findBestModel(results)

  if (!best) {
    console.log(chalk.red('  ✖ No reliable model found'))
    process.exit(1)
  }

  // 📖 Output in format: providerName/modelId
  const providerName = sources[best.providerKey]?.name ?? best.providerKey ?? 'nvidia'
  console.log(chalk.green(`  ✓ Most reliable model:`))
  console.log(chalk.bold(`    ${providerName}/${best.modelId}`))
  console.log()
  console.log(chalk.dim(`  📊 Stats:`))
  console.log(chalk.dim(`    Avg ping: ${getAvg(best)}ms`))
  console.log(chalk.dim(`    Uptime: ${getUptime(best)}%`))
  console.log(chalk.dim(`    Status: ${best.status === 'up' ? '✅ UP' : '❌ DOWN'}`))

  process.exit(0)
}

// 📖 filterByTier and TIER_LETTER_MAP are imported from lib/utils.js
// 📖 Wrapper that exits on invalid tier (utils version returns null instead)
function filterByTierOrExit(results, tierLetter) {
  const filtered = filterByTier(results, tierLetter)
  if (filtered === null) {
    console.error(chalk.red(`  ✖ Unknown tier "${tierLetter}". Valid tiers: S, A, B, C`))
    process.exit(1)
  }
  return filtered
}

// ─── Dynamic OpenRouter free model discovery ──────────────────────────────────
// 📖 Fetches the live list of free models from OpenRouter's public API at startup.
// 📖 Replaces the static openrouter entries in MODELS with fresh data so new free
// 📖 models appear automatically without a code update.
// 📖 Falls back silently to the static list on network failure.

// 📖 Known SWE-bench scores for OpenRouter free models.
// 📖 Keyed by base model ID (without the :free suffix).
// 📖 Unknown models default to tier 'B' / '25.0%'.
const OPENROUTER_TIER_MAP = {
  'qwen/qwen3-coder':                         ['S+', '70.6%'],
  'mistralai/devstral-2':                      ['S+', '72.2%'],
  'stepfun/step-3.5-flash':                    ['S+', '74.4%'],
  'deepseek/deepseek-r1-0528':                 ['S',  '61.0%'],
  'qwen/qwen3-next-80b-a3b-instruct':          ['S',  '65.0%'],
  'openai/gpt-oss-120b':                       ['S',  '60.0%'],
  'openai/gpt-oss-20b':                        ['A',  '42.0%'],
  'nvidia/nemotron-3-nano-30b-a3b':            ['A',  '43.0%'],
  'meta-llama/llama-3.3-70b-instruct':         ['A-', '39.5%'],
  'mimo-v2-flash':                             ['A',  '45.0%'],
  'google/gemma-3-27b-it':                     ['A-', '36.0%'],
  'google/gemma-3-12b-it':                     ['B+', '30.0%'],
  'google/gemma-3-4b-it':                      ['B',  '22.0%'],
  'google/gemma-3n-e4b-it':                    ['B',  '22.0%'],
  'google/gemma-3n-e2b-it':                    ['B',  '18.0%'],
  'meta-llama/llama-3.2-3b-instruct':          ['B',  '20.0%'],
  'mistralai/mistral-small-3.1-24b-instruct':  ['A-', '35.0%'],
  'qwen/qwen3-4b':                             ['B',  '22.0%'],
  'nousresearch/hermes-3-llama-3.1-405b':      ['A',  '40.0%'],
  'nvidia/nemotron-nano-9b-v2':                ['B+', '28.0%'],
  'nvidia/nemotron-nano-12b-v2-vl':            ['B+', '30.0%'],
  'z-ai/glm-4.5-air':                          ['A-', '38.0%'],
  'arcee-ai/trinity-large-preview':             ['A',  '40.0%'],
  'arcee-ai/trinity-mini':                      ['B+', '28.0%'],
  'upstage/solar-pro-3':                       ['A-', '35.0%'],
  'cognitivecomputations/dolphin-mistral-24b-venice-edition': ['B+', '28.0%'],
  'liquid/lfm-2.5-1.2b-thinking':              ['B',  '18.0%'],
  'liquid/lfm-2.5-1.2b-instruct':              ['B',  '18.0%'],
}

async function fetchOpenRouterFreeModels() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
      headers: {
        'HTTP-Referer': 'https://github.com/vava-nessa/free-coding-models',
        'X-Title': 'free-coding-models',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const json = await res.json()
    if (!json.data || !Array.isArray(json.data)) return null

    const freeModels = json.data.filter(m => m.id && m.id.endsWith(':free'))

    return freeModels.map(m => {
      const baseId = m.id.replace(/:free$/, '')
      const [tier, swe] = OPENROUTER_TIER_MAP[baseId] || ['B', '25.0%']
      const ctx = formatCtxWindow(m.context_length)
      const label = labelFromId(m.id)
      return [m.id, label, tier, swe, ctx]
    })
  } catch {
    return null
  }
}

async function main() {
  const cliArgs = parseArgs(process.argv)

  // Validate --tier early, before entering alternate screen
  if (cliArgs.tierFilter && !TIER_LETTER_MAP[cliArgs.tierFilter]) {
    console.error(chalk.red(`  Unknown tier "${cliArgs.tierFilter}". Valid tiers: S, A, B, C`))
    process.exit(1)
  }

  // 📖 Load JSON config (auto-migrates old plain-text ~/.free-coding-models if needed)
  const config = loadConfig()
  ensureTelemetryConfig(config)
  ensureFavoritesConfig(config)

  // 📖 If --profile <name> was passed, load that profile into the live config
  if (cliArgs.profileName) {
    const profileSettings = loadProfile(config, cliArgs.profileName)
    if (!profileSettings) {
      console.error(chalk.red(`  Unknown profile "${cliArgs.profileName}". Available: ${listProfiles(config).join(', ') || '(none)'}`))
      process.exit(1)
    }
    saveConfig(config)
  }

  // 📖 Check if any provider has a key — if not, run the first-time setup wizard
  const hasAnyKey = Object.keys(sources).some(pk => !!getApiKey(config, pk))

  if (!hasAnyKey) {
    const result = await promptApiKey(config)
    if (!result) {
      console.log()
      console.log(chalk.red('  ✖ No API key provided.'))
      console.log(chalk.dim('  Run `free-coding-models` again or set NVIDIA_API_KEY / GROQ_API_KEY / CEREBRAS_API_KEY.'))
      console.log()
      process.exit(1)
    }
  }

  // 📖 Backward-compat: keep apiKey var for startOpenClaw() which still needs it
  let apiKey = getApiKey(config, 'nvidia')

  // 📖 Default mode: OpenCode CLI
  let mode = 'opencode'
  if (cliArgs.openClawMode) mode = 'openclaw'
  else if (cliArgs.openCodeDesktopMode) mode = 'opencode-desktop'
  else if (cliArgs.openCodeMode) mode = 'opencode'

  // 📖 Track app opening early so fast exits are still counted.
  // 📖 Must run before update checks because npm registry lookups can add startup delay.
  void sendUsageTelemetry(config, cliArgs, {
    event: 'app_start',
    version: LOCAL_VERSION,
    mode,
    ts: new Date().toISOString(),
  })

  // 📖 Check for updates in the background
  let latestVersion = null
  try {
    latestVersion = await checkForUpdate()
  } catch {
    // Silently fail - don't block the app if npm registry is unreachable
  }

  // 📖 Auto-update system: force updates and handle changelog automatically
  // 📖 Skip when running from source (dev mode) — .git means we're in a repo checkout,
  // 📖 not a global npm install. Auto-update would overwrite the global copy but restart
  // 📖 the local one, causing an infinite update loop since LOCAL_VERSION never changes.
  const isDevMode = existsSync(join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '.git'))
  if (latestVersion && !isDevMode) {
    console.log()
    console.log(chalk.bold.red('  ⚠ AUTO-UPDATE AVAILABLE'))
    console.log(chalk.red(`  Version ${latestVersion} will be installed automatically`))
    console.log(chalk.dim('  Opening changelog in browser...'))
    console.log()
    
    // 📖 Open changelog automatically
    const { execSync } = require('child_process')
    const changelogUrl = 'https://github.com/vava-nessa/free-coding-models/releases'
    try {
      if (isMac) {
        execSync(`open "${changelogUrl}"`, { stdio: 'ignore' })
      } else if (isWindows) {
        execSync(`start "" "${changelogUrl}"`, { stdio: 'ignore' })
      } else {
        execSync(`xdg-open "${changelogUrl}"`, { stdio: 'ignore' })
      }
      console.log(chalk.green('  ✅ Changelog opened in browser'))
    } catch {
      console.log(chalk.yellow('  ⚠ Could not open browser automatically'))
      console.log(chalk.dim(`  Visit manually: ${changelogUrl}`))
    }
    
    // 📖 Force update immediately
    console.log(chalk.cyan('  🚀 Starting auto-update...'))
    runUpdate(latestVersion)
    return // runUpdate will restart the process
  }

  // 📖 Dynamic OpenRouter free model discovery — fetch live free models from API
  // 📖 Replaces static openrouter entries in MODELS with fresh data.
  // 📖 Fallback: if fetch fails, the static list from sources.js stays intact + warning shown.
  const dynamicModels = await fetchOpenRouterFreeModels()
  if (dynamicModels) {
    // 📖 Remove all existing openrouter entries from MODELS
    for (let i = MODELS.length - 1; i >= 0; i--) {
      if (MODELS[i][5] === 'openrouter') MODELS.splice(i, 1)
    }
    // 📖 Push fresh entries with 'openrouter' providerKey
    for (const [modelId, label, tier, swe, ctx] of dynamicModels) {
      MODELS.push([modelId, label, tier, swe, ctx, 'openrouter'])
    }
  } else {
    console.log(chalk.yellow('  OpenRouter: using cached model list (live fetch failed)'))
  }

  // 📖 Build results from MODELS — only include enabled providers
  // 📖 Each result gets providerKey so ping() knows which URL + API key to use

  let results = MODELS
    .filter(([,,,,,providerKey]) => isProviderEnabled(config, providerKey))
    .map(([modelId, label, tier, sweScore, ctx, providerKey], i) => ({
      idx: i + 1, modelId, label, tier, sweScore, ctx, providerKey,
      status: 'pending',
      pings: [],  // 📖 All ping results (ms or 'TIMEOUT')
      httpCode: null,
      hidden: false,  // 📖 Simple flag to hide/show models
    }))
  syncFavoriteFlags(results, config)

  // 📖 Load usage data from token-stats.json and attach usagePercent to each result row.
  // 📖 usagePercent is the quota percent remaining (0–100). undefined = no data available.
  // 📖 Freshness-aware: snapshots older than 30 minutes are excluded (shown as N/A in UI).
  for (const r of results) {
    const pct = _usageForRow(r.providerKey, r.modelId)
    r.usagePercent = typeof pct === 'number' ? pct : undefined
  }

  // 📖 Clamp scrollOffset so cursor is always within the visible viewport window.
  // 📖 Called after every cursor move, sort change, and terminal resize.
  const adjustScrollOffset = (st) => {
    const total = st.visibleSorted ? st.visibleSorted.length : st.results.filter(r => !r.hidden).length
    let maxSlots = st.terminalRows - TABLE_FIXED_LINES
    if (maxSlots < 1) maxSlots = 1
    if (total <= maxSlots) { st.scrollOffset = 0; return }
    // Ensure cursor is not above the visible window
    if (st.cursor < st.scrollOffset) {
      st.scrollOffset = st.cursor
    }
    // Ensure cursor is not below the visible window
    // Account for indicator lines eating into model slots
    const hasAbove = st.scrollOffset > 0
    const tentativeBelow = st.scrollOffset + maxSlots - (hasAbove ? 1 : 0) < total
    const modelSlots = maxSlots - (hasAbove ? 1 : 0) - (tentativeBelow ? 1 : 0)
    if (st.cursor >= st.scrollOffset + modelSlots) {
      st.scrollOffset = st.cursor - modelSlots + 1
    }
    // Final clamp
    // 📖 Keep one extra scroll step when top indicator is visible,
    // 📖 otherwise the last rows become unreachable at the bottom.
    const maxOffset = Math.max(0, total - maxSlots + 1)
    if (st.scrollOffset > maxOffset) st.scrollOffset = maxOffset
    if (st.scrollOffset < 0) st.scrollOffset = 0
  }

  // 📖 Add interactive selection state - cursor index and user's choice
  // 📖 sortColumn: 'rank'|'tier'|'origin'|'model'|'ping'|'avg'|'status'|'verdict'|'uptime'
  // 📖 sortDirection: 'asc' (default) or 'desc'
    // 📖 pingInterval: current interval in ms (default 2000, adjustable with W/= keys)
  // 📖 tierFilter: current tier filter letter (null = all, 'S' = S+/S, 'A' = A+/A/A-, etc.)
  const state = {
    results,
    pendingPings: 0,
    frame: 0,
    cursor: 0,
    selectedModel: null,
    sortColumn: 'avg',
    sortDirection: 'asc',
    pingInterval: PING_INTERVAL,  // 📖 Track current interval for W/= keys
    lastPingTime: Date.now(),     // 📖 Track when last ping cycle started
    mode,                         // 📖 'opencode' or 'openclaw' — controls Enter action
    scrollOffset: 0,              // 📖 First visible model index in viewport
    terminalRows: process.stdout.rows || 24,  // 📖 Current terminal height
    // 📖 Settings screen state (P key opens it)
    settingsOpen: false,          // 📖 Whether settings overlay is active
    settingsCursor: 0,            // 📖 Which provider row is selected in settings
    settingsEditMode: false,      // 📖 Whether we're in inline key editing mode (edit primary key)
    settingsAddKeyMode: false,    // 📖 Whether we're in add-key mode (append a new key to provider)
    settingsEditBuffer: '',       // 📖 Typed characters for the API key being edited
    settingsErrorMsg: null,       // 📖 Temporary error message to display in settings
    settingsTestResults: {},      // 📖 { providerKey: 'pending'|'ok'|'fail'|null }
    settingsUpdateState: 'idle',  // 📖 'idle'|'checking'|'available'|'up-to-date'|'error'|'installing'
    settingsUpdateLatestVersion: null, // 📖 Latest npm version discovered from manual check
    settingsUpdateError: null,    // 📖 Last update-check error message for maintenance row
    config,                       // 📖 Live reference to the config object (updated on save)
    visibleSorted: [],            // 📖 Cached visible+sorted models — shared between render loop and key handlers
    helpVisible: false,           // 📖 Whether the help overlay (K key) is active
    settingsScrollOffset: 0,      // 📖 Vertical scroll offset for Settings overlay viewport
    helpScrollOffset: 0,          // 📖 Vertical scroll offset for Help overlay viewport
    // 📖 Smart Recommend overlay state (Q key opens it)
    recommendOpen: false,         // 📖 Whether the recommend overlay is active
    recommendPhase: 'questionnaire', // 📖 'questionnaire'|'analyzing'|'results' — current phase
    recommendCursor: 0,           // 📖 Selected question option (0-based index within current question)
    recommendQuestion: 0,         // 📖 Which question we're on (0=task, 1=priority, 2=context)
    recommendAnswers: { taskType: null, priority: null, contextBudget: null }, // 📖 User's answers
    recommendProgress: 0,         // 📖 Analysis progress percentage (0–100)
    recommendResults: [],         // 📖 Top N recommendations from getTopRecommendations()
    recommendScrollOffset: 0,     // 📖 Vertical scroll offset for Recommend overlay viewport
    recommendAnalysisTimer: null, // 📖 setInterval handle for the 10s analysis phase
    recommendPingTimer: null,     // 📖 setInterval handle for 2 pings/sec during analysis
    recommendedKeys: new Set(),   // 📖 Set of "providerKey/modelId" for recommended models (shown in main table)
    // 📖 Config Profiles state
    activeProfile: getActiveProfileName(config), // 📖 Currently loaded profile name (or null)
    profileSaveMode: false,       // 📖 Whether the inline "Save profile" name input is active
    profileSaveBuffer: '',        // 📖 Typed characters for the profile name being saved
    // 📖 Feature Request state (J key opens it)
    featureRequestOpen: false,    // 📖 Whether the feature request overlay is active
    featureRequestBuffer: '',     // 📖 Typed characters for the feature request message
    featureRequestStatus: 'idle', // 📖 'idle'|'sending'|'success'|'error' — webhook send status
    featureRequestError: null,    // 📖 Last webhook error message
    // 📖 Bug Report state (I key opens it)
    bugReportOpen: false,         // 📖 Whether the bug report overlay is active
    bugReportBuffer: '',          // 📖 Typed characters for the bug report message
    bugReportStatus: 'idle',      // 📖 'idle'|'sending'|'success'|'error' — webhook send status
    bugReportError: null,         // 📖 Last webhook error message
    // 📖 OpenCode sync status (S key in settings)
    settingsSyncStatus: null,     // 📖 { type: 'success'|'error', msg: string } — shown in settings footer
    // 📖 Log page overlay state (X key opens it)
    logVisible: false,            // 📖 Whether the log page overlay is active
    logScrollOffset: 0,           // 📖 Vertical scroll offset for log overlay viewport
    // 📖 Proxy startup status — set by autoStartProxyIfSynced, consumed by Task 3 indicator
    // 📖 null = not configured/not attempted
    // 📖 { phase: 'starting' } — proxy start in progress
    // 📖 { phase: 'running', port, accountCount } — proxy is live
    // 📖 { phase: 'failed', reason } — proxy failed to start
    proxyStartupStatus: null,     // 📖 Startup-phase proxy status (null | { phase, ...details })
  }

  // 📖 Re-clamp viewport on terminal resize
  process.stdout.on('resize', () => {
    state.terminalRows = process.stdout.rows || 24
    adjustScrollOffset(state)
  })

  // 📖 Auto-start proxy on launch if OpenCode config already has an fcm-proxy provider.
  // 📖 Fire-and-forget: does not block UI startup. state.proxyStartupStatus is updated async.
  if (mode === 'opencode' || mode === 'opencode-desktop') {
    void autoStartProxyIfSynced(config, state)
  }

  // 📖 Enter alternate screen — animation runs here, zero scrollback pollution
  process.stdout.write(ALT_ENTER)

  // 📖 Ensure we always leave alt screen cleanly (Ctrl+C, crash, normal exit)
  const exit = (code = 0) => {
    clearInterval(ticker)
    clearTimeout(state.pingIntervalObj)
    process.stdout.write(ALT_LEAVE)
    process.exit(code)
  }
  process.on('SIGINT',  () => exit(0))
  process.on('SIGTERM', () => exit(0))

  // 📖 Tier filtering system - cycles through each individual tier one by one
  // 📖 0=All, 1=S+, 2=S, 3=A+, 4=A, 5=A-, 6=B+, 7=B, 8=C
  const TIER_CYCLE = [null, 'S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']
  let tierFilterMode = 0

  // 📖 originFilterMode: index into ORIGIN_CYCLE, 0=All, then each provider key in order
  const ORIGIN_CYCLE = [null, ...Object.keys(sources)]
  let originFilterMode = 0

  function applyTierFilter() {
    const activeTier = TIER_CYCLE[tierFilterMode]
    const activeOrigin = ORIGIN_CYCLE[originFilterMode]
    state.results.forEach(r => {
      // 📖 Favorites stay visible regardless of tier/origin filters.
      if (r.isFavorite) {
        r.hidden = false
        return
      }
      // 📖 Apply both tier and origin filters — model is hidden if it fails either
      const tierHide = activeTier !== null && r.tier !== activeTier
      const originHide = activeOrigin !== null && r.providerKey !== activeOrigin
      r.hidden = tierHide || originHide
    })
    return state.results
  }

  // ─── Settings screen renderer ─────────────────────────────────────────────
  // 📖 renderSettings: Draw the settings overlay in the alt screen buffer.
  // 📖 Shows all providers with their API key (masked) + enabled state.
  // 📖 When in edit mode (settingsEditMode=true), shows an inline input field.
  // 📖 Key "T" in settings = test API key for selected provider.
  function renderSettings() {
    const providerKeys = Object.keys(sources)
    const updateRowIdx = providerKeys.length
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}

    lines.push('')
    lines.push(`  ${chalk.bold('⚙  Settings')}  ${chalk.dim('— free-coding-models v' + LOCAL_VERSION)}`)
    if (state.settingsErrorMsg) {
      lines.push(`  ${chalk.red.bold(state.settingsErrorMsg)}`)
    }
    lines.push('')
    lines.push(`  ${chalk.bold('🧩 Providers')}`)
    lines.push(`  ${chalk.dim('  ' + '─'.repeat(112))}`)
    lines.push('')

    for (let i = 0; i < providerKeys.length; i++) {
      const pk = providerKeys[i]
      const src = sources[pk]
      const meta = PROVIDER_METADATA[pk] || {}
      const isCursor = i === state.settingsCursor
      const enabled = isProviderEnabled(state.config, pk)
      const keyVal = state.config.apiKeys?.[pk] ?? ''
      // 📖 Resolve all keys for this provider (for multi-key display)
      const allKeys = resolveApiKeys(state.config, pk)
      const keyCount = allKeys.length

      // 📖 Build API key display — mask most chars, show last 4
      let keyDisplay
      if ((state.settingsEditMode || state.settingsAddKeyMode) && isCursor) {
        // 📖 Inline editing/adding: show typed buffer with cursor indicator
        const modePrefix = state.settingsAddKeyMode ? chalk.dim('[+] ') : ''
        keyDisplay = chalk.cyanBright(`${modePrefix}${state.settingsEditBuffer || ''}▏`)
      } else if (keyCount > 0) {
        // 📖 Show the primary (first/string) key masked + count indicator for extras
        const primaryKey = allKeys[0]
        const visible = primaryKey.slice(-4)
        const masked = '•'.repeat(Math.min(16, Math.max(4, primaryKey.length - 4)))
        const keyMasked = chalk.dim(masked + visible)
        const extra = keyCount > 1 ? chalk.cyan(` (+${keyCount - 1} more)`) : ''
        keyDisplay = keyMasked + extra
      } else {
        keyDisplay = chalk.dim('(no key set)')
      }

      // 📖 Test result badge
      const testResult = state.settingsTestResults[pk]
      let testBadge = chalk.dim('[Test —]')
      if (testResult === 'pending') testBadge = chalk.yellow('[Testing…]')
      else if (testResult === 'ok')   testBadge = chalk.greenBright('[Test ✅]')
      else if (testResult === 'fail') testBadge = chalk.red('[Test ❌]')
      const rateSummary = chalk.dim((meta.rateLimits || 'No limit info').slice(0, 36))

      const enabledBadge = enabled ? chalk.greenBright('✅') : chalk.redBright('❌')
      const providerName = chalk.bold((meta.label || src.name || pk).slice(0, 22).padEnd(22))
      const bullet = isCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')

      const row = `${bullet}[ ${enabledBadge} ] ${providerName}  ${keyDisplay.padEnd(30)}  ${testBadge}  ${rateSummary}`
      cursorLineByRow[i] = lines.length
      lines.push(isCursor ? chalk.bgRgb(30, 30, 60)(row) : row)
    }

    lines.push('')
    const selectedProviderKey = providerKeys[Math.min(state.settingsCursor, providerKeys.length - 1)]
    const selectedSource = sources[selectedProviderKey]
    const selectedMeta = PROVIDER_METADATA[selectedProviderKey] || {}
    if (selectedSource && state.settingsCursor < providerKeys.length) {
      const selectedKey = getApiKey(state.config, selectedProviderKey)
      const setupStatus = selectedKey ? chalk.green('API key detected ✅') : chalk.yellow('API key missing ⚠')
      lines.push(`  ${chalk.bold('Setup Instructions')} — ${selectedMeta.label || selectedSource.name || selectedProviderKey}`)
      lines.push(chalk.dim(`  1) Create a ${selectedMeta.label || selectedSource.name} account: ${selectedMeta.signupUrl || 'signup link missing'}`))
      lines.push(chalk.dim(`  2) ${selectedMeta.signupHint || 'Generate an API key and paste it with Enter on this row'}`))
      lines.push(chalk.dim(`  3) Press ${chalk.yellow('T')} to test your key. Status: ${setupStatus}`))
      if (selectedProviderKey === 'cloudflare') {
        const hasAccountId = Boolean((process.env.CLOUDFLARE_ACCOUNT_ID || '').trim())
        const accountIdStatus = hasAccountId ? chalk.green('CLOUDFLARE_ACCOUNT_ID detected ✅') : chalk.yellow('Set CLOUDFLARE_ACCOUNT_ID ⚠')
        lines.push(chalk.dim(`  4) Export ${chalk.yellow('CLOUDFLARE_ACCOUNT_ID')} in your shell. Status: ${accountIdStatus}`))
      }
      lines.push('')
    }

    lines.push('')
    lines.push(`  ${chalk.bold('🛠 Maintenance')}`)
    lines.push(`  ${chalk.dim('  ' + '─'.repeat(112))}`)
    lines.push('')

    const updateCursor = state.settingsCursor === updateRowIdx
    const updateBullet = updateCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
    const updateState = state.settingsUpdateState
    const latestFound = state.settingsUpdateLatestVersion
    const updateActionLabel = updateState === 'available' && latestFound
      ? `Install update (v${latestFound})`
      : 'Check for updates manually'
    let updateStatus = chalk.dim('Press Enter or U to check npm registry')
    if (updateState === 'checking') updateStatus = chalk.yellow('Checking npm registry…')
    if (updateState === 'available' && latestFound) updateStatus = chalk.greenBright(`Update available: v${latestFound} (Enter to install)`)
    if (updateState === 'up-to-date') updateStatus = chalk.green('Already on latest version')
    if (updateState === 'error') updateStatus = chalk.red('Check failed (press U to retry)')
    if (updateState === 'installing') updateStatus = chalk.cyan('Installing update…')
    const updateRow = `${updateBullet}${chalk.bold(updateActionLabel).padEnd(44)} ${updateStatus}`
    cursorLineByRow[updateRowIdx] = lines.length
    lines.push(updateCursor ? chalk.bgRgb(30, 30, 60)(updateRow) : updateRow)
    if (updateState === 'error' && state.settingsUpdateError) {
      lines.push(chalk.red(`      ${state.settingsUpdateError}`))
    }

    // 📖 Profiles section — list saved profiles with active indicator + delete support
    const savedProfiles = listProfiles(state.config)
    const profileStartIdx = updateRowIdx + 1
    const maxRowIdx = savedProfiles.length > 0 ? profileStartIdx + savedProfiles.length - 1 : updateRowIdx

    lines.push('')
    lines.push(`  ${chalk.bold('📋 Profiles')}  ${chalk.dim(savedProfiles.length > 0 ? `(${savedProfiles.length} saved)` : '(none — press Shift+S in main view to save)')}`)
    lines.push(`  ${chalk.dim('  ' + '─'.repeat(112))}`)
    lines.push('')

    if (savedProfiles.length === 0) {
      lines.push(chalk.dim('    No saved profiles. Press Shift+S in the main table to save your current settings as a profile.'))
    } else {
      for (let i = 0; i < savedProfiles.length; i++) {
        const pName = savedProfiles[i]
        const rowIdx = profileStartIdx + i
        const isCursor = state.settingsCursor === rowIdx
        const isActive = state.activeProfile === pName
        const activeBadge = isActive ? chalk.greenBright(' ✅ active') : ''
        const bullet = isCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
        const profileLabel = chalk.rgb(200, 150, 255).bold(pName.padEnd(30))
        const deleteHint = isCursor ? chalk.dim('  Enter→Load  •  Backspace→Delete') : ''
        const row = `${bullet}${profileLabel}${activeBadge}${deleteHint}`
        cursorLineByRow[rowIdx] = lines.length
        lines.push(isCursor ? chalk.bgRgb(40, 20, 60)(row) : row)
      }
    }

    lines.push('')
    if (state.settingsEditMode) {
      lines.push(chalk.dim('  Type API key  •  Enter Save  •  Esc Cancel'))
    } else {
      lines.push(chalk.dim('  ↑↓ Navigate  •  Enter Edit key  •  + Add key  •  - Remove key  •  Space Toggle  •  T Test key  •  S Sync→OpenCode  •  R Restore backup  •  U Updates  •  ⌫ Delete profile  •  Esc Close'))
    }
    // 📖 Show sync/restore status message if set
    if (state.settingsSyncStatus) {
      const { type, msg } = state.settingsSyncStatus
      lines.push(type === 'success' ? chalk.greenBright(`  ${msg}`) : chalk.yellow(`  ${msg}`))
    }
    lines.push('')

    // 📖 Keep selected Settings row visible on small terminals by scrolling the overlay viewport.
    const targetLine = cursorLineByRow[state.settingsCursor] ?? 0
    state.settingsScrollOffset = keepOverlayTargetVisible(
      state.settingsScrollOffset,
      targetLine,
      lines.length,
      state.terminalRows
    )
    const { visible, offset } = sliceOverlayLines(lines, state.settingsScrollOffset, state.terminalRows)
    state.settingsScrollOffset = offset

    const tintedLines = tintOverlayLines(visible, SETTINGS_OVERLAY_BG)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }

  // ─── Help overlay renderer ────────────────────────────────────────────────
  // 📖 renderHelp: Draw the help overlay listing all key bindings.
  // 📖 Toggled with K key. Gives users a quick reference without leaving the TUI.
  function renderHelp() {
    const EL = '\x1b[K'
    const lines = []
    lines.push('')
    lines.push(`  ${chalk.bold('❓ Keyboard Shortcuts')}  ${chalk.dim('— ↑↓ / PgUp / PgDn / Home / End scroll • K or Esc close')}`)
    lines.push('')
    lines.push(`  ${chalk.bold('Columns')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Rank')}        SWE-bench rank (1 = best coding score)  ${chalk.dim('Sort:')} ${chalk.yellow('R')}`)
    lines.push(`              ${chalk.dim('Quick glance at which model is objectively the best coder right now.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Tier')}        S+ / S / A+ / A / A- / B+ / B / C based on SWE-bench score  ${chalk.dim('Sort:')} ${chalk.yellow('Y')}  ${chalk.dim('Cycle:')} ${chalk.yellow('T')}`)
    lines.push(`              ${chalk.dim('Skip the noise — S/S+ models solve real GitHub issues, C models are for light tasks.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('SWE%')}        SWE-bench score — coding ability benchmark (color-coded)  ${chalk.dim('Sort:')} ${chalk.yellow('S')}`)
    lines.push(`              ${chalk.dim('The raw number behind the tier. Higher = better at writing, fixing, and refactoring code.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('CTX')}         Context window size (128k, 200k, 256k, 1m, etc.)  ${chalk.dim('Sort:')} ${chalk.yellow('C')}`)
    lines.push(`              ${chalk.dim('Bigger context = the model can read more of your codebase at once without forgetting.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Model')}       Model name (⭐ = favorited, pinned at top)  ${chalk.dim('Sort:')} ${chalk.yellow('M')}  ${chalk.dim('Favorite:')} ${chalk.yellow('F')}`)
    lines.push(`              ${chalk.dim('Star the ones you like — they stay pinned at the top across restarts.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Origin')}      Provider source (NIM, Groq, Cerebras, etc.)  ${chalk.dim('Sort:')} ${chalk.yellow('O')}  ${chalk.dim('Cycle:')} ${chalk.yellow('N')}`)
    lines.push(`              ${chalk.dim('Same model on different providers can have very different speed and uptime.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Latest')}      Most recent ping response time (ms)  ${chalk.dim('Sort:')} ${chalk.yellow('L')}`)
    lines.push(`              ${chalk.dim('Shows how fast the server is responding right now — useful to catch live slowdowns.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Avg Ping')}    Average response time across all successful pings (ms)  ${chalk.dim('Sort:')} ${chalk.yellow('A')}`)
    lines.push(`              ${chalk.dim('The long-term truth. Ignore lucky one-off pings, this tells you real everyday speed.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Health')}      Live status: ✅ UP / 🔥 429 / ⏳ TIMEOUT / ❌ ERR / 🔑 NO KEY  ${chalk.dim('Sort:')} ${chalk.yellow('H')}`)
    lines.push(`              ${chalk.dim('Tells you instantly if a model is reachable or down — no guesswork needed.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Verdict')}     Overall assessment: Perfect / Normal / Spiky / Slow / Overloaded  ${chalk.dim('Sort:')} ${chalk.yellow('V')}`)
    lines.push(`              ${chalk.dim('One-word summary so you don\'t have to cross-check speed, health, and stability yourself.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Stability')}   Composite 0–100 score: p95 + jitter + spike rate + uptime  ${chalk.dim('Sort:')} ${chalk.yellow('B')}`)
    lines.push(`              ${chalk.dim('A fast model that randomly freezes is worse than a steady one. This catches that.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Up%')}         Uptime — ratio of successful pings to total pings  ${chalk.dim('Sort:')} ${chalk.yellow('U')}`)
    lines.push(`              ${chalk.dim('If a model only works half the time, you\'ll waste time retrying. Higher = more reliable.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Usage')}       Quota percent remaining (from token-stats.json)  ${chalk.dim('Sort:')} ${chalk.yellow('Shift+G')}`)
    lines.push(`              ${chalk.dim('Shows how much of your quota is still available. Green = plenty left, red = running low.')}`)

    lines.push('')
    lines.push(`  ${chalk.bold('Main TUI')}`)
    lines.push(`  ${chalk.bold('Navigation')}`)
    lines.push(`  ${chalk.yellow('↑↓')}           Navigate rows`)
    lines.push(`  ${chalk.yellow('Enter')}        Select model and launch`)
    lines.push('')
    lines.push(`  ${chalk.bold('Controls')}`)
    lines.push(`  ${chalk.yellow('W')}  Decrease ping interval (faster)`)
    lines.push(`  ${chalk.yellow('=')}  Increase ping interval (slower)  ${chalk.dim('(was X — X is now the log page)')}`)
    lines.push(`  ${chalk.yellow('X')}  Toggle request log page  ${chalk.dim('(shows recent requests from request-log.jsonl)')}`)
    lines.push(`  ${chalk.yellow('Z')}  Cycle launch mode  ${chalk.dim('(OpenCode CLI → OpenCode Desktop → OpenClaw)')}`)
    lines.push(`  ${chalk.yellow('F')}  Toggle favorite on selected row  ${chalk.dim('(⭐ pinned at top, persisted)')}`)
    lines.push(`  ${chalk.yellow('Q')}  Smart Recommend  ${chalk.dim('(🎯 find the best model for your task — questionnaire + live analysis)')}`)
    lines.push(`  ${chalk.rgb(57, 255, 20).bold('J')}  Request Feature  ${chalk.dim('(📝 send anonymous feedback to the project team)')}`)
    lines.push(`  ${chalk.rgb(255, 87, 51).bold('I')}  Report Bug  ${chalk.dim('(🐛 send anonymous bug report to the project team)')}`)
    lines.push(`  ${chalk.yellow('P')}  Open settings  ${chalk.dim('(manage API keys, provider toggles, manual update)')}`)
    lines.push(`  ${chalk.yellow('Shift+P')}  Cycle config profile  ${chalk.dim('(switch between saved profiles live)')}`)
    lines.push(`  ${chalk.yellow('Shift+S')}  Save current config as a named profile  ${chalk.dim('(inline prompt — type name + Enter)')}`)
    lines.push(`             ${chalk.dim('Profiles store: favorites, sort, tier filter, ping interval, API keys.')}`)
    lines.push(`             ${chalk.dim('Use --profile <name> to load a profile on startup.')}`)
    lines.push(`  ${chalk.yellow('K')} / ${chalk.yellow('Esc')}  Show/hide this help`)
    lines.push(`  ${chalk.yellow('Ctrl+C')}  Exit`)
    lines.push('')
    lines.push(`  ${chalk.bold('Settings (P)')}`)
    lines.push(`  ${chalk.yellow('↑↓')}           Navigate rows`)
    lines.push(`  ${chalk.yellow('PgUp/PgDn')}    Jump by page`)
    lines.push(`  ${chalk.yellow('Home/End')}     Jump first/last row`)
    lines.push(`  ${chalk.yellow('Enter')}        Edit key / check-install update`)
    lines.push(`  ${chalk.yellow('Space')}        Toggle provider enable/disable`)
    lines.push(`  ${chalk.yellow('T')}            Test selected provider key`)
    lines.push(`  ${chalk.yellow('U')}            Check updates manually`)
    lines.push(`  ${chalk.yellow('Esc')}          Close settings`)
    lines.push('')
    lines.push(`  ${chalk.bold('CLI Flags')}`)
    lines.push(`  ${chalk.dim('Usage: free-coding-models [options]')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --opencode')}           ${chalk.dim('OpenCode CLI mode')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --opencode-desktop')}   ${chalk.dim('OpenCode Desktop mode')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --openclaw')}           ${chalk.dim('OpenClaw mode')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --best')}               ${chalk.dim('Only top tiers (A+, S, S+)')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --fiable')}             ${chalk.dim('10s reliability analysis')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --tier S|A|B|C')}       ${chalk.dim('Filter by tier letter')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --no-telemetry')}       ${chalk.dim('Disable telemetry for this run')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --recommend')}          ${chalk.dim('Auto-open Smart Recommend on start')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --profile <name>')}     ${chalk.dim('Load a saved config profile')}`)
    lines.push(`  ${chalk.dim('Flags can be combined: --openclaw --tier S')}`)
    lines.push('')
    // 📖 Help overlay can be longer than viewport, so keep a dedicated scroll offset.
    const { visible, offset } = sliceOverlayLines(lines, state.helpScrollOffset, state.terminalRows)
    state.helpScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, HELP_OVERLAY_BG)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }

  // ─── Log page overlay renderer ────────────────────────────────────────────
  // 📖 renderLog: Draw the log page overlay showing recent requests from
  // 📖 ~/.free-coding-models/request-log.jsonl, newest-first.
  // 📖 Toggled with X key. Esc or X closes.
  function renderLog() {
    const EL = '\x1b[K'
    const lines = []
    lines.push('')
    lines.push(`  ${chalk.bold('📋 Request Log')}  ${chalk.dim('— recent requests • ↑↓ scroll • X or Esc close')}`)
    lines.push('')

    // 📖 Load recent log entries — bounded read, newest-first, malformed lines skipped.
    const logRows = loadRecentLogs({ limit: 200 })

    if (logRows.length === 0) {
      lines.push(chalk.dim('  No log entries found.'))
      lines.push(chalk.dim('  Logs are written to ~/.free-coding-models/request-log.jsonl'))
      lines.push(chalk.dim('  when requests are proxied through the multi-account rotation proxy.'))
    } else {
      // 📖 Column widths for the log table
      const W_TIME    = 19
      const W_TYPE    = 18
      const W_PROV    = 14
      const W_MODEL   = 36
      const W_STATUS  = 8
      const W_TOKENS  = 9
      const W_LAT     = 10

      // 📖 Header row
      const hTime   = chalk.dim('Time'.padEnd(W_TIME))
      const hType   = chalk.dim('Type'.padEnd(W_TYPE))
      const hProv   = chalk.dim('Provider'.padEnd(W_PROV))
      const hModel  = chalk.dim('Model'.padEnd(W_MODEL))
      const hStatus = chalk.dim('Status'.padEnd(W_STATUS))
      const hTok    = chalk.dim('Tokens'.padEnd(W_TOKENS))
      const hLat    = chalk.dim('Latency'.padEnd(W_LAT))
      lines.push(`  ${hTime}  ${hType}  ${hProv}  ${hModel}  ${hStatus}  ${hTok}  ${hLat}`)
      lines.push(chalk.dim('  ' + '─'.repeat(W_TIME + W_TYPE + W_PROV + W_MODEL + W_STATUS + W_TOKENS + W_LAT + 12)))

      for (const row of logRows) {
        // 📖 Format time as HH:MM:SS (strip the date part for compactness)
        let timeStr = row.time
        try {
          const d = new Date(row.time)
          if (!Number.isNaN(d.getTime())) {
            timeStr = d.toISOString().replace('T', ' ').slice(0, 19)
          }
        } catch { /* keep raw */ }

        // 📖 Color-code status
        let statusCell
        const sc = String(row.status)
        if (sc === '200') {
          statusCell = chalk.greenBright(sc.padEnd(W_STATUS))
        } else if (sc === '429') {
          statusCell = chalk.yellow(sc.padEnd(W_STATUS))
        } else if (sc.startsWith('5') || sc === 'error') {
          statusCell = chalk.red(sc.padEnd(W_STATUS))
        } else {
          statusCell = chalk.dim(sc.padEnd(W_STATUS))
        }

        const tokStr = row.tokens > 0 ? String(row.tokens) : '--'
        const latStr = row.latency > 0 ? `${row.latency}ms` : '--'

        const timeCell  = chalk.dim(timeStr.slice(0, W_TIME).padEnd(W_TIME))
        const typeCell  = chalk.magenta((row.requestType || '--').slice(0, W_TYPE).padEnd(W_TYPE))
        const provCell  = chalk.cyan(row.provider.slice(0, W_PROV).padEnd(W_PROV))
        const modelCell = chalk.white(row.model.slice(0, W_MODEL).padEnd(W_MODEL))
        const tokCell   = chalk.dim(tokStr.padEnd(W_TOKENS))
        const latCell   = chalk.dim(latStr.padEnd(W_LAT))

        lines.push(`  ${timeCell}  ${typeCell}  ${provCell}  ${modelCell}  ${statusCell}  ${tokCell}  ${latCell}`)
      }
    }

    lines.push('')
    lines.push(chalk.dim(`  Showing up to 200 most recent entries  •  X or Esc close`))
    lines.push('')

    const { visible, offset } = sliceOverlayLines(lines, state.logScrollOffset, state.terminalRows)
    state.logScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, LOG_OVERLAY_BG)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }


  // 📖 renderRecommend: Draw the Smart Recommend overlay with 3 phases:
  //   1. 'questionnaire' — ask 3 questions (task type, priority, context budget)
  //   2. 'analyzing' — loading screen with progress bar (10s, 2 pings/sec)
  //   3. 'results' — show Top 3 recommendations with scores
  function renderRecommend() {
    const EL = '\x1b[K'
    const lines = []

    lines.push('')
    lines.push(`  ${chalk.bold('🎯 Smart Recommend')}  ${chalk.dim('— find the best model for your task')}`)
    lines.push('')

    if (state.recommendPhase === 'questionnaire') {
      // 📖 Question definitions — each has a title, options array, and answer key
      const questions = [
        {
          title: 'What are you working on?',
          options: Object.entries(TASK_TYPES).map(([key, val]) => ({ key, label: val.label })),
          answerKey: 'taskType',
        },
        {
          title: 'What matters most?',
          options: Object.entries(PRIORITY_TYPES).map(([key, val]) => ({ key, label: val.label })),
          answerKey: 'priority',
        },
        {
          title: 'How big is your context?',
          options: Object.entries(CONTEXT_BUDGETS).map(([key, val]) => ({ key, label: val.label })),
          answerKey: 'contextBudget',
        },
      ]

      const q = questions[state.recommendQuestion]
      const qNum = state.recommendQuestion + 1
      const qTotal = questions.length

      // 📖 Progress breadcrumbs showing answered questions
      let breadcrumbs = ''
      for (let i = 0; i < questions.length; i++) {
        const answered = state.recommendAnswers[questions[i].answerKey]
        if (i < state.recommendQuestion && answered) {
          const answeredLabel = questions[i].options.find(o => o.key === answered)?.label || answered
          breadcrumbs += chalk.greenBright(`  ✓ ${questions[i].title} ${chalk.bold(answeredLabel)}`) + '\n'
        }
      }
      if (breadcrumbs) {
        lines.push(breadcrumbs.trimEnd())
        lines.push('')
      }

      lines.push(`  ${chalk.bold(`Question ${qNum}/${qTotal}:`)} ${chalk.cyan(q.title)}`)
      lines.push('')

      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i]
        const isCursor = i === state.recommendCursor
        const bullet = isCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
        const label = isCursor ? chalk.bold.white(opt.label) : chalk.white(opt.label)
        lines.push(`${bullet}${label}`)
      }

      lines.push('')
      lines.push(chalk.dim('  ↑↓ navigate  •  Enter select  •  Esc cancel'))

    } else if (state.recommendPhase === 'analyzing') {
      // 📖 Loading screen with progress bar
      const pct = Math.min(100, Math.round(state.recommendProgress))
      const barWidth = 40
      const filled = Math.round(barWidth * pct / 100)
      const empty = barWidth - filled
      const bar = chalk.greenBright('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))

      lines.push(`  ${chalk.bold('Analyzing models...')}`)
      lines.push('')
      lines.push(`  ${bar}  ${chalk.bold(String(pct) + '%')}`)
      lines.push('')

      // 📖 Show what we're doing
      const taskLabel = TASK_TYPES[state.recommendAnswers.taskType]?.label || '—'
      const prioLabel = PRIORITY_TYPES[state.recommendAnswers.priority]?.label || '—'
      const ctxLabel = CONTEXT_BUDGETS[state.recommendAnswers.contextBudget]?.label || '—'
      lines.push(chalk.dim(`  Task: ${taskLabel}  •  Priority: ${prioLabel}  •  Context: ${ctxLabel}`))
      lines.push('')

      // 📖 Spinning indicator
      const spinIdx = state.frame % FRAMES.length
      lines.push(`  ${chalk.yellow(FRAMES[spinIdx])} Pinging models at 2 pings/sec to gather fresh latency data...`)
      lines.push('')
      lines.push(chalk.dim('  Esc to cancel'))

    } else if (state.recommendPhase === 'results') {
      // 📖 Show Top 3 results with detailed info
      const taskLabel = TASK_TYPES[state.recommendAnswers.taskType]?.label || '—'
      const prioLabel = PRIORITY_TYPES[state.recommendAnswers.priority]?.label || '—'
      const ctxLabel = CONTEXT_BUDGETS[state.recommendAnswers.contextBudget]?.label || '—'
      lines.push(chalk.dim(`  Task: ${taskLabel}  •  Priority: ${prioLabel}  •  Context: ${ctxLabel}`))
      lines.push('')

      if (state.recommendResults.length === 0) {
        lines.push(`  ${chalk.yellow('No models could be scored. Try different criteria or wait for more pings.')}`)
      } else {
        lines.push(`  ${chalk.bold('Top Recommendations:')}`)
        lines.push('')

        for (let i = 0; i < state.recommendResults.length; i++) {
          const rec = state.recommendResults[i]
          const r = rec.result
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
          const providerName = sources[r.providerKey]?.name ?? r.providerKey
          const tierFn = TIER_COLOR[r.tier] ?? (t => chalk.white(t))
          const avg = getAvg(r)
          const avgStr = avg === Infinity ? '—' : Math.round(avg) + 'ms'
          const sweStr = r.sweScore ?? '—'
          const ctxStr = r.ctx ?? '—'
          const stability = getStabilityScore(r)
          const stabStr = stability === -1 ? '—' : String(stability)

          const isCursor = i === state.recommendCursor
          const highlight = isCursor ? chalk.bgRgb(20, 50, 25) : (s => s)

          lines.push(highlight(`  ${medal} ${chalk.bold('#' + (i + 1))}  ${chalk.bold.white(r.label)}  ${chalk.dim('(' + providerName + ')')}`))
          lines.push(highlight(`       Score: ${chalk.bold.greenBright(String(rec.score) + '/100')}  │  Tier: ${tierFn(r.tier)}  │  SWE: ${chalk.cyan(sweStr)}  │  Avg: ${chalk.yellow(avgStr)}  │  CTX: ${chalk.cyan(ctxStr)}  │  Stability: ${chalk.cyan(stabStr)}`))
          lines.push('')
        }
      }

      lines.push('')
      lines.push(`  ${chalk.dim('These models are now')} ${chalk.greenBright('highlighted')} ${chalk.dim('and')} 🎯 ${chalk.dim('pinned in the main table.')}`)
      lines.push('')
      lines.push(chalk.dim('  ↑↓ navigate  •  Enter select & close  •  Esc close  •  Q new search'))
    }

    lines.push('')
    const { visible, offset } = sliceOverlayLines(lines, state.recommendScrollOffset, state.terminalRows)
    state.recommendScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, RECOMMEND_OVERLAY_BG)
    const cleared2 = tintedLines.map(l => l + EL)
    return cleared2.join('\n')
  }

  // ─── Smart Recommend: analysis phase controller ────────────────────────────
  // 📖 startRecommendAnalysis: begins the 10-second analysis phase.
  // 📖 Pings a random subset of visible models at 2 pings/sec while advancing progress.
  // 📖 After 10 seconds, computes recommendations and transitions to results phase.
  function startRecommendAnalysis() {
    state.recommendPhase = 'analyzing'
    state.recommendProgress = 0
    state.recommendResults = []

    const startTime = Date.now()
    const ANALYSIS_DURATION = 10_000 // 📖 10 seconds
    const PING_RATE = 500            // 📖 2 pings per second (every 500ms)

    // 📖 Progress updater — runs every 200ms to update the progress bar
    state.recommendAnalysisTimer = setInterval(() => {
      const elapsed = Date.now() - startTime
      state.recommendProgress = Math.min(100, (elapsed / ANALYSIS_DURATION) * 100)

      if (elapsed >= ANALYSIS_DURATION) {
        // 📖 Analysis complete — compute recommendations
        clearInterval(state.recommendAnalysisTimer)
        clearInterval(state.recommendPingTimer)
        state.recommendAnalysisTimer = null
        state.recommendPingTimer = null

        const recs = getTopRecommendations(
          state.results,
          state.recommendAnswers.taskType,
          state.recommendAnswers.priority,
          state.recommendAnswers.contextBudget,
          3
        )
        state.recommendResults = recs
        state.recommendPhase = 'results'
        state.recommendCursor = 0

        // 📖 Mark recommended models so the main table can highlight them
        state.recommendedKeys = new Set(recs.map(rec => toFavoriteKey(rec.result.providerKey, rec.result.modelId)))
        // 📖 Tag each result object so sortResultsWithPinnedFavorites can pin them
        state.results.forEach(r => {
          const key = toFavoriteKey(r.providerKey, r.modelId)
          const rec = recs.find(rec => toFavoriteKey(rec.result.providerKey, rec.result.modelId) === key)
          r.isRecommended = !!rec
          r.recommendScore = rec ? rec.score : 0
        })
      }
    }, 200)

    // 📖 Targeted pinging — ping random visible models at 2/sec for fresh data
    state.recommendPingTimer = setInterval(() => {
      const visible = state.results.filter(r => !r.hidden && r.status !== 'noauth')
      if (visible.length === 0) return
      // 📖 Pick a random model to ping — spreads load across all models over 10s
      const target = visible[Math.floor(Math.random() * visible.length)]
      pingModel(target).catch(() => {})
    }, PING_RATE)
  }

  // ─── Feature Request overlay renderer ─────────────────────────────────────
  // 📖 renderFeatureRequest: Draw the overlay for anonymous Discord feedback.
  // 📖 Shows an input field where users can type feature requests, then sends to Discord webhook.
  function renderFeatureRequest() {
    const EL = '\x1b[K'
    const lines = []

    // 📖 Calculate available space for multi-line input
    const maxInputWidth = OVERLAY_PANEL_WIDTH - 8 // 8 = padding (4 spaces each side)
    const maxInputLines = 10 // Show up to 10 lines of input
    
    // 📖 Split buffer into lines for display (with wrapping)
    const wrapText = (text, width) => {
      const words = text.split(' ')
      const lines = []
      let currentLine = ''
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word
        if (testLine.length <= width) {
          currentLine = testLine
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines
    }

    const inputLines = wrapText(state.featureRequestBuffer, maxInputWidth)
    const displayLines = inputLines.slice(0, maxInputLines)
    
    // 📖 Header
    lines.push('')
    lines.push(`  ${chalk.bold.rgb(57, 255, 20)('📝 Feature Request')}  ${chalk.dim('— send anonymous feedback to the project team')}`)
    lines.push('')
    
    // 📖 Status messages (if any)
    if (state.featureRequestStatus === 'sending') {
      lines.push(`  ${chalk.yellow('⏳ Sending...')}`)
      lines.push('')
    } else if (state.featureRequestStatus === 'success') {
      lines.push(`  ${chalk.greenBright.bold('✅ Successfully sent!')} ${chalk.dim('Closing overlay in 3 seconds...')}`)
      lines.push('')
      lines.push(`  ${chalk.dim('Thank you for your feedback! Your feature request has been sent to the project team.')}`)
      lines.push('')
    } else if (state.featureRequestStatus === 'error') {
      lines.push(`  ${chalk.red('❌ Error:')} ${chalk.yellow(state.featureRequestError || 'Failed to send')}`)
      lines.push(`  ${chalk.dim('Press Backspace to edit, or Esc to close')}`)
      lines.push('')
    } else {
      lines.push(`  ${chalk.dim('Type your feature request below. Press Enter to send, Esc to cancel.')}`)
      lines.push(`  ${chalk.dim('Your message will be sent anonymously to the project team.')}`)
      lines.push('')
    }

    // 📖 Input box with border
    lines.push(chalk.dim(`  ┌─ ${chalk.cyan('Message')} ${chalk.dim(`(${state.featureRequestBuffer.length}/500 chars)`)} ─${'─'.repeat(maxInputWidth - 22)}┐`))
    
    // 📖 Display input lines (or placeholder if empty)
    if (displayLines.length === 0 && state.featureRequestStatus === 'idle') {
      lines.push(chalk.dim(`  │${' '.repeat(maxInputWidth)}│`))
      lines.push(chalk.dim(`  │  ${chalk.white.italic('Type your message here...')}${' '.repeat(Math.max(0, maxInputWidth - 28))}│`))
    } else {
      for (const line of displayLines) {
        const padded = line.padEnd(maxInputWidth)
        lines.push(`  │ ${chalk.white(padded)} │`)
      }
    }
    
    // 📖 Fill remaining space if needed
    const linesToFill = Math.max(0, maxInputLines - Math.max(displayLines.length, 1))
    for (let i = 0; i < linesToFill; i++) {
      lines.push(chalk.dim(`  │${' '.repeat(maxInputWidth)}│`))
    }
    
    // 📖 Cursor indicator (only when not sending/success)
    if (state.featureRequestStatus === 'idle' || state.featureRequestStatus === 'error') {
      const cursorLine = inputLines.length > 0 ? inputLines.length - 1 : 0
      const lastDisplayLine = displayLines.length - 1
      // Add cursor indicator to the last line
      if (lines.length > 0 && displayLines.length > 0) {
        const lastLineIdx = lines.findIndex(l => l.includes('│ ') && !l.includes('Message'))
        if (lastLineIdx >= 0 && lastLineIdx < lines.length) {
          // Add cursor blink
          const lastLine = lines[lastLineIdx]
          if (lastLine.includes('│')) {
            lines[lastLineIdx] = lastLine.replace(/\s+│$/, chalk.rgb(57, 255, 20).bold('▏') + ' │')
          }
        }
      }
    }
    
    lines.push(chalk.dim(`  └${'─'.repeat(maxInputWidth + 2)}┘`))
    
    lines.push('')
    lines.push(chalk.dim('  Enter Send  •  Esc Cancel  •  Backspace Delete'))

    // 📖 Apply overlay tint and return
    const FEATURE_REQUEST_OVERLAY_BG = chalk.bgRgb(26, 26, 46) // Dark blue-ish background (RGB: 26, 26, 46)
    const tintedLines = tintOverlayLines(lines, FEATURE_REQUEST_OVERLAY_BG)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }

  // ─── Bug Report overlay renderer ─────────────────────────────────────────
  // 📖 renderBugReport: Draw the overlay for anonymous Discord bug reports.
  // 📖 Shows an input field where users can type bug reports, then sends to Discord webhook.
  function renderBugReport() {
    const EL = '\x1b[K'
    const lines = []

    // 📖 Calculate available space for multi-line input
    const maxInputWidth = OVERLAY_PANEL_WIDTH - 8 // 8 = padding (4 spaces each side)
    const maxInputLines = 10 // Show up to 10 lines of input
    
    // 📖 Split buffer into lines for display (with wrapping)
    const wrapText = (text, width) => {
      const words = text.split(' ')
      const lines = []
      let currentLine = ''
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word
        if (testLine.length <= width) {
          currentLine = testLine
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines
    }

    const inputLines = wrapText(state.bugReportBuffer, maxInputWidth)
    const displayLines = inputLines.slice(0, maxInputLines)
    
    // 📖 Header
    lines.push('')
    lines.push(`  ${chalk.bold.rgb(255, 87, 51)('🐛 Bug Report')}  ${chalk.dim('— send anonymous bug reports to the project team')}`)
    lines.push('')
    
    // 📖 Status messages (if any)
    if (state.bugReportStatus === 'sending') {
      lines.push(`  ${chalk.yellow('⏳ Sending...')}`)
      lines.push('')
    } else if (state.bugReportStatus === 'success') {
      lines.push(`  ${chalk.greenBright.bold('✅ Successfully sent!')} ${chalk.dim('Closing overlay in 3 seconds...')}`)
      lines.push('')
      lines.push(`  ${chalk.dim('Thank you for your feedback! Your bug report has been sent to the project team.')}`)
      lines.push('')
    } else if (state.bugReportStatus === 'error') {
      lines.push(`  ${chalk.red('❌ Error:')} ${chalk.yellow(state.bugReportError || 'Failed to send')}`)
      lines.push(`  ${chalk.dim('Press Backspace to edit, or Esc to close')}`)
      lines.push('')
    } else {
      lines.push(`  ${chalk.dim('Describe the bug you encountered. Press Enter to send, Esc to cancel.')}`)
      lines.push(`  ${chalk.dim('Your message will be sent anonymously to the project team.')}`)
      lines.push('')
    }

    // 📖 Input box with border
    lines.push(chalk.dim(`  ┌─ ${chalk.cyan('Bug Details')} ${chalk.dim(`(${state.bugReportBuffer.length}/500 chars)`)} ─${'─'.repeat(maxInputWidth - 24)}┐`))
    
    // 📖 Display input lines (or placeholder if empty)
    if (displayLines.length === 0 && state.bugReportStatus === 'idle') {
      lines.push(chalk.dim(`  │${' '.repeat(maxInputWidth)}│`))
      lines.push(chalk.dim(`  │  ${chalk.white.italic('Describe what happened...')}${' '.repeat(Math.max(0, maxInputWidth - 31))}│`))
    } else {
      for (const line of displayLines) {
        const padded = line.padEnd(maxInputWidth)
        lines.push(`  │ ${chalk.white(padded)} │`)
      }
    }
    
    // 📖 Fill remaining space if needed
    const linesToFill = Math.max(0, maxInputLines - Math.max(displayLines.length, 1))
    for (let i = 0; i < linesToFill; i++) {
      lines.push(chalk.dim(`  │${' '.repeat(maxInputWidth)}│`))
    }
    
    // 📖 Cursor indicator (only when not sending/success)
    if (state.bugReportStatus === 'idle' || state.bugReportStatus === 'error') {
      const cursorLine = inputLines.length > 0 ? inputLines.length - 1 : 0
      const lastDisplayLine = displayLines.length - 1
      // Add cursor indicator to the last line
      if (lines.length > 0 && displayLines.length > 0) {
        const lastLineIdx = lines.findIndex(l => l.includes('│ ') && !l.includes('Bug Details'))
        if (lastLineIdx >= 0 && lastLineIdx < lines.length) {
          // Add cursor blink
          const lastLine = lines[lastLineIdx]
          if (lastLine.includes('│')) {
            lines[lastLineIdx] = lastLine.replace(/\s+│$/, chalk.rgb(255, 87, 51).bold('▏') + ' │')
          }
        }
      }
    }
    
    lines.push(chalk.dim(`  └${'─'.repeat(maxInputWidth + 2)}┘`))
    
    lines.push('')
    lines.push(chalk.dim('  Enter Send  •  Esc Cancel  •  Backspace Delete'))

    // 📖 Apply overlay tint and return
    const BUG_REPORT_OVERLAY_BG = chalk.bgRgb(46, 20, 20) // Dark red-ish background (RGB: 46, 20, 20)
    const tintedLines = tintOverlayLines(lines, BUG_REPORT_OVERLAY_BG)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }

  // 📖 stopRecommendAnalysis: cleanup timers if user cancels during analysis
  function stopRecommendAnalysis() {
    if (state.recommendAnalysisTimer) { clearInterval(state.recommendAnalysisTimer); state.recommendAnalysisTimer = null }
    if (state.recommendPingTimer) { clearInterval(state.recommendPingTimer); state.recommendPingTimer = null }
  }

  // ─── Settings key test helper ───────────────────────────────────────────────
  // 📖 Fires a single ping to the selected provider to verify the API key works.
  async function testProviderKey(providerKey) {
    const src = sources[providerKey]
    if (!src) return
    const testKey = getApiKey(state.config, providerKey)
    if (!testKey) { state.settingsTestResults[providerKey] = 'fail'; return }

    // 📖 Use the first model in the provider's list for the test ping
    const testModel = src.models[0]?.[0]
    if (!testModel) { state.settingsTestResults[providerKey] = 'fail'; return }

    state.settingsTestResults[providerKey] = 'pending'
    const { code } = await ping(testKey, testModel, providerKey, src.url)
    state.settingsTestResults[providerKey] = code === '200' ? 'ok' : 'fail'
  }

  // 📖 Manual update checker from settings; keeps status visible in maintenance row.
  async function checkUpdatesFromSettings() {
    if (state.settingsUpdateState === 'checking' || state.settingsUpdateState === 'installing') return
    state.settingsUpdateState = 'checking'
    state.settingsUpdateError = null
    const { latestVersion, error } = await checkForUpdateDetailed()
    if (error) {
      state.settingsUpdateState = 'error'
      state.settingsUpdateLatestVersion = null
      state.settingsUpdateError = error
      return
    }
    if (latestVersion) {
      state.settingsUpdateState = 'available'
      state.settingsUpdateLatestVersion = latestVersion
      state.settingsUpdateError = null
      return
    }
    state.settingsUpdateState = 'up-to-date'
    state.settingsUpdateLatestVersion = null
    state.settingsUpdateError = null
  }

  // 📖 Leaves TUI cleanly, then runs npm global update command.
  function launchUpdateFromSettings(latestVersion) {
    if (!latestVersion) return
    state.settingsUpdateState = 'installing'
    clearInterval(ticker)
    clearTimeout(state.pingIntervalObj)
    process.stdin.removeListener('keypress', onKeyPress)
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write(ALT_LEAVE)
    runUpdate(latestVersion)
  }

  // Apply CLI --tier filter if provided
  if (cliArgs.tierFilter) {
    const allowed = TIER_LETTER_MAP[cliArgs.tierFilter]
    state.results.forEach(r => {
      r.hidden = r.isFavorite ? false : !allowed.includes(r.tier)
    })
  }

  // 📖 Setup keyboard input for interactive selection during pings
  // 📖 Use readline with keypress event for arrow key handling
  process.stdin.setEncoding('utf8')
  process.stdin.resume()

  let userSelected = null

  const onKeyPress = async (str, key) => {
    if (!key) return

    // 📖 Profile save mode: intercept ALL keys while inline name input is active.
    // 📖 Enter → save, Esc → cancel, Backspace → delete char, printable → append to buffer.
    if (state.profileSaveMode) {
      if (key.ctrl && key.name === 'c') { exit(0); return }
      if (key.name === 'escape') {
        // 📖 Cancel profile save — discard typed name
        state.profileSaveMode = false
        state.profileSaveBuffer = ''
        return
      }
      if (key.name === 'return') {
        // 📖 Confirm profile save — persist current TUI settings under typed name
        const name = state.profileSaveBuffer.trim()
        if (name.length > 0) {
          saveAsProfile(state.config, name, {
            tierFilter: TIER_CYCLE[tierFilterMode],
            sortColumn: state.sortColumn,
            sortAsc: state.sortDirection === 'asc',
            pingInterval: state.pingInterval,
          })
          setActiveProfile(state.config, name)
          state.activeProfile = name
          saveConfig(state.config)
        }
        state.profileSaveMode = false
        state.profileSaveBuffer = ''
        return
      }
      if (key.name === 'backspace') {
        state.profileSaveBuffer = state.profileSaveBuffer.slice(0, -1)
        return
      }
      // 📖 Append printable characters (str is the raw character typed)
      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        state.profileSaveBuffer += str
      }
      return
    }

    // 📖 Feature Request overlay: intercept ALL keys while overlay is active.
    // 📖 Enter → send to Discord, Esc → cancel, Backspace → delete char, printable → append to buffer.
    if (state.featureRequestOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      if (key.name === 'escape') {
        // 📖 Cancel feature request — close overlay
        state.featureRequestOpen = false
        state.featureRequestBuffer = ''
        state.featureRequestStatus = 'idle'
        state.featureRequestError = null
        return
      }

      if (key.name === 'return') {
        // 📖 Send feature request to Discord webhook
        const message = state.featureRequestBuffer.trim()
        if (message.length > 0 && state.featureRequestStatus !== 'sending') {
          state.featureRequestStatus = 'sending'
          const result = await sendFeatureRequest(message)
          if (result.success) {
            // 📖 Success — show confirmation briefly, then close overlay after 3 seconds
            state.featureRequestStatus = 'success'
            setTimeout(() => {
              state.featureRequestOpen = false
              state.featureRequestBuffer = ''
              state.featureRequestStatus = 'idle'
              state.featureRequestError = null
            }, 3000)
          } else {
            // 📖 Error — show error message, keep overlay open
            state.featureRequestStatus = 'error'
            state.featureRequestError = result.error || 'Unknown error'
          }
        }
        return
      }

      if (key.name === 'backspace') {
        // 📖 Don't allow editing while sending or after success
        if (state.featureRequestStatus === 'sending' || state.featureRequestStatus === 'success') return
        state.featureRequestBuffer = state.featureRequestBuffer.slice(0, -1)
        // 📖 Clear error status when user starts editing again
        if (state.featureRequestStatus === 'error') {
          state.featureRequestStatus = 'idle'
          state.featureRequestError = null
        }
        return
      }

      // 📖 Append printable characters (str is the raw character typed)
      // 📖 Limit to 500 characters (Discord embed description limit)
      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        // 📖 Don't allow editing while sending or after success
        if (state.featureRequestStatus === 'sending' || state.featureRequestStatus === 'success') return
        if (state.featureRequestBuffer.length < 500) {
          state.featureRequestBuffer += str
          // 📖 Clear error status when user starts editing again
          if (state.featureRequestStatus === 'error') {
            state.featureRequestStatus = 'idle'
            state.featureRequestError = null
          }
        }
      }
      return
    }

    // 📖 Bug Report overlay: intercept ALL keys while overlay is active.
    // 📖 Enter → send to Discord, Esc → cancel, Backspace → delete char, printable → append to buffer.
    if (state.bugReportOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      if (key.name === 'escape') {
        // 📖 Cancel bug report — close overlay
        state.bugReportOpen = false
        state.bugReportBuffer = ''
        state.bugReportStatus = 'idle'
        state.bugReportError = null
        return
      }

      if (key.name === 'return') {
        // 📖 Send bug report to Discord webhook
        const message = state.bugReportBuffer.trim()
        if (message.length > 0 && state.bugReportStatus !== 'sending') {
          state.bugReportStatus = 'sending'
          const result = await sendBugReport(message)
          if (result.success) {
            // 📖 Success — show confirmation briefly, then close overlay after 3 seconds
            state.bugReportStatus = 'success'
            setTimeout(() => {
              state.bugReportOpen = false
              state.bugReportBuffer = ''
              state.bugReportStatus = 'idle'
              state.bugReportError = null
            }, 3000)
          } else {
            // 📖 Error — show error message, keep overlay open
            state.bugReportStatus = 'error'
            state.bugReportError = result.error || 'Unknown error'
          }
        }
        return
      }

      if (key.name === 'backspace') {
        // 📖 Don't allow editing while sending or after success
        if (state.bugReportStatus === 'sending' || state.bugReportStatus === 'success') return
        state.bugReportBuffer = state.bugReportBuffer.slice(0, -1)
        // 📖 Clear error status when user starts editing again
        if (state.bugReportStatus === 'error') {
          state.bugReportStatus = 'idle'
          state.bugReportError = null
        }
        return
      }

      // 📖 Append printable characters (str is the raw character typed)
      // 📖 Limit to 500 characters (Discord embed description limit)
      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        // 📖 Don't allow editing while sending or after success
        if (state.bugReportStatus === 'sending' || state.bugReportStatus === 'success') return
        if (state.bugReportBuffer.length < 500) {
          state.bugReportBuffer += str
          // 📖 Clear error status when user starts editing again
          if (state.bugReportStatus === 'error') {
            state.bugReportStatus = 'idle'
            state.bugReportError = null
          }
        }
      }
      return
    }

    // 📖 Help overlay: full keyboard navigation + key swallowing while overlay is open.
    if (state.helpVisible) {
      const pageStep = Math.max(1, (state.terminalRows || 1) - 2)
      if (key.name === 'escape' || key.name === 'k') {
        state.helpVisible = false
        return
      }
      if (key.name === 'up') { state.helpScrollOffset = Math.max(0, state.helpScrollOffset - 1); return }
      if (key.name === 'down') { state.helpScrollOffset += 1; return }
      if (key.name === 'pageup') { state.helpScrollOffset = Math.max(0, state.helpScrollOffset - pageStep); return }
      if (key.name === 'pagedown') { state.helpScrollOffset += pageStep; return }
      if (key.name === 'home') { state.helpScrollOffset = 0; return }
      if (key.name === 'end') { state.helpScrollOffset = Number.MAX_SAFE_INTEGER; return }
      if (key.ctrl && key.name === 'c') { exit(0); return }
      return
    }

    // 📖 Log page overlay: full keyboard navigation + key swallowing while overlay is open.
    if (state.logVisible) {
      const pageStep = Math.max(1, (state.terminalRows || 1) - 2)
      if (key.name === 'escape' || key.name === 'x') {
        state.logVisible = false
        return
      }
      if (key.name === 'up') { state.logScrollOffset = Math.max(0, state.logScrollOffset - 1); return }
      if (key.name === 'down') { state.logScrollOffset += 1; return }
      if (key.name === 'pageup') { state.logScrollOffset = Math.max(0, state.logScrollOffset - pageStep); return }
      if (key.name === 'pagedown') { state.logScrollOffset += pageStep; return }
      if (key.name === 'home') { state.logScrollOffset = 0; return }
      if (key.name === 'end') { state.logScrollOffset = Number.MAX_SAFE_INTEGER; return }
      if (key.ctrl && key.name === 'c') { exit(0); return }
      return
    }

    // 📖 Smart Recommend overlay: full keyboard handling while overlay is open.
    if (state.recommendOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      if (state.recommendPhase === 'questionnaire') {
        const questions = [
          { options: Object.keys(TASK_TYPES), answerKey: 'taskType' },
          { options: Object.keys(PRIORITY_TYPES), answerKey: 'priority' },
          { options: Object.keys(CONTEXT_BUDGETS), answerKey: 'contextBudget' },
        ]
        const q = questions[state.recommendQuestion]

        if (key.name === 'escape') {
          // 📖 Cancel recommend — close overlay
          state.recommendOpen = false
          state.recommendPhase = 'questionnaire'
          state.recommendQuestion = 0
          state.recommendCursor = 0
          state.recommendAnswers = { taskType: null, priority: null, contextBudget: null }
          return
        }
        if (key.name === 'up') {
          state.recommendCursor = state.recommendCursor > 0 ? state.recommendCursor - 1 : q.options.length - 1
          return
        }
        if (key.name === 'down') {
          state.recommendCursor = state.recommendCursor < q.options.length - 1 ? state.recommendCursor + 1 : 0
          return
        }
        if (key.name === 'return') {
          // 📖 Record answer and advance to next question or start analysis
          state.recommendAnswers[q.answerKey] = q.options[state.recommendCursor]
          if (state.recommendQuestion < questions.length - 1) {
            state.recommendQuestion++
            state.recommendCursor = 0
          } else {
            // 📖 All questions answered — start analysis phase
            startRecommendAnalysis()
          }
          return
        }
        return // 📖 Swallow all other keys
      }

      if (state.recommendPhase === 'analyzing') {
        if (key.name === 'escape') {
          // 📖 Cancel analysis — stop timers, return to questionnaire
          stopRecommendAnalysis()
          state.recommendOpen = false
          state.recommendPhase = 'questionnaire'
          state.recommendQuestion = 0
          state.recommendCursor = 0
          state.recommendAnswers = { taskType: null, priority: null, contextBudget: null }
          return
        }
        return // 📖 Swallow all keys during analysis (except Esc and Ctrl+C)
      }

      if (state.recommendPhase === 'results') {
        if (key.name === 'escape') {
          // 📖 Close results — recommendations stay highlighted in main table
          state.recommendOpen = false
          return
        }
        if (key.name === 'q') {
          // 📖 Start a new search
          state.recommendPhase = 'questionnaire'
          state.recommendQuestion = 0
          state.recommendCursor = 0
          state.recommendAnswers = { taskType: null, priority: null, contextBudget: null }
          state.recommendResults = []
          state.recommendScrollOffset = 0
          return
        }
        if (key.name === 'up') {
          const count = state.recommendResults.length
          if (count === 0) return
          state.recommendCursor = state.recommendCursor > 0 ? state.recommendCursor - 1 : count - 1
          return
        }
        if (key.name === 'down') {
          const count = state.recommendResults.length
          if (count === 0) return
          state.recommendCursor = state.recommendCursor < count - 1 ? state.recommendCursor + 1 : 0
          return
        }
        if (key.name === 'return') {
          // 📖 Select the highlighted recommendation — close overlay, jump cursor to it
          const rec = state.recommendResults[state.recommendCursor]
          if (rec) {
            const recKey = toFavoriteKey(rec.result.providerKey, rec.result.modelId)
            state.recommendOpen = false
            // 📖 Jump to the recommended model in the main table
            const idx = state.visibleSorted.findIndex(r => toFavoriteKey(r.providerKey, r.modelId) === recKey)
            if (idx >= 0) {
              state.cursor = idx
              adjustScrollOffset(state)
            }
          }
          return
        }
        return // 📖 Swallow all other keys
      }

      return // 📖 Catch-all swallow
    }

    // ─── Settings overlay keyboard handling ───────────────────────────────────
    if (state.settingsOpen) {
      const providerKeys = Object.keys(sources)
      const updateRowIdx = providerKeys.length
      // 📖 Profile rows start after update row — one row per saved profile
      const savedProfiles = listProfiles(state.config)
      const profileStartIdx = updateRowIdx + 1
      const maxRowIdx = savedProfiles.length > 0 ? profileStartIdx + savedProfiles.length - 1 : updateRowIdx

      // 📖 Edit/Add-key mode: capture typed characters for the API key
      if (state.settingsEditMode || state.settingsAddKeyMode) {
        if (key.name === 'return') {
          // 📖 Save the new key and exit edit/add mode
          const pk = providerKeys[state.settingsCursor]
          const newKey = state.settingsEditBuffer.trim()
          if (newKey) {
            // 📖 Validate OpenRouter keys start with "sk-or-" to detect corruption
            if (pk === 'openrouter' && !newKey.startsWith('sk-or-')) {
              // 📖 Don't save corrupted keys - show warning and cancel
              state.settingsEditMode = false
              state.settingsAddKeyMode = false
              state.settingsEditBuffer = ''
              state.settingsErrorMsg = '⚠️  OpenRouter keys must start with "sk-or-". Key not saved.'
              setTimeout(() => { state.settingsErrorMsg = null }, 3000)
              return
            }
            if (state.settingsAddKeyMode) {
              // 📖 Add-key mode: append new key (addApiKey handles duplicates/empty)
              addApiKey(state.config, pk, newKey)
            } else {
              // 📖 Edit mode: replace the primary key (string-level)
              state.config.apiKeys[pk] = newKey
            }
            saveConfig(state.config)
          }
          state.settingsEditMode = false
          state.settingsAddKeyMode = false
          state.settingsEditBuffer = ''
        } else if (key.name === 'escape') {
          // 📖 Cancel without saving
          state.settingsEditMode = false
          state.settingsAddKeyMode = false
          state.settingsEditBuffer = ''
        } else if (key.name === 'backspace') {
          state.settingsEditBuffer = state.settingsEditBuffer.slice(0, -1)
        } else if (str && !key.ctrl && !key.meta && str.length === 1) {
          // 📖 Append printable character to buffer
          state.settingsEditBuffer += str
        }
        return
      }

      // 📖 Normal settings navigation
      if (key.name === 'escape' || key.name === 'p') {
        // 📖 Close settings — rebuild results to reflect provider changes
        state.settingsOpen = false
        state.settingsEditMode = false
        state.settingsAddKeyMode = false
        state.settingsEditBuffer = ''
        state.settingsSyncStatus = null  // 📖 Clear sync status on close
        // 📖 Rebuild results: add models from newly enabled providers, remove disabled
        results = MODELS
          .filter(([,,,,,pk]) => isProviderEnabled(state.config, pk))
          .map(([modelId, label, tier, sweScore, ctx, providerKey], i) => {
            // 📖 Try to reuse existing result to keep ping history
            const existing = state.results.find(r => r.modelId === modelId && r.providerKey === providerKey)
            if (existing) return existing
            return { idx: i + 1, modelId, label, tier, sweScore, ctx, providerKey, status: 'pending', pings: [], httpCode: null, hidden: false }
          })
        // 📖 Re-index results
        results.forEach((r, i) => { r.idx = i + 1 })
        state.results = results
        syncFavoriteFlags(state.results, state.config)
        applyTierFilter()
        const visible = state.results.filter(r => !r.hidden)
        state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
        if (state.cursor >= state.visibleSorted.length) state.cursor = Math.max(0, state.visibleSorted.length - 1)
        adjustScrollOffset(state)
        // 📖 Re-ping all models that were 'noauth' (got 401 without key) but now have a key
        // 📖 This makes the TUI react immediately when a user adds an API key in settings
        state.results.forEach(r => {
          if (r.status === 'noauth' && getApiKey(state.config, r.providerKey)) {
            r.status = 'pending'
            r.pings = []
            r.httpCode = null
            pingModel(r).catch(() => {})
          }
        })
        return
      }

      if (key.name === 'up' && state.settingsCursor > 0) {
        state.settingsCursor--
        return
      }

      if (key.name === 'down' && state.settingsCursor < maxRowIdx) {
        state.settingsCursor++
        return
      }

      if (key.name === 'pageup') {
        const pageStep = Math.max(1, (state.terminalRows || 1) - 2)
        state.settingsCursor = Math.max(0, state.settingsCursor - pageStep)
        return
      }

      if (key.name === 'pagedown') {
        const pageStep = Math.max(1, (state.terminalRows || 1) - 2)
        state.settingsCursor = Math.min(maxRowIdx, state.settingsCursor + pageStep)
        return
      }

      if (key.name === 'home') {
        state.settingsCursor = 0
        return
      }

      if (key.name === 'end') {
        state.settingsCursor = maxRowIdx
        return
      }

      if (key.name === 'return') {
        if (state.settingsCursor === updateRowIdx) {
          if (state.settingsUpdateState === 'available' && state.settingsUpdateLatestVersion) {
            launchUpdateFromSettings(state.settingsUpdateLatestVersion)
            return
          }
          checkUpdatesFromSettings()
          return
        }

        // 📖 Profile row: Enter → load the selected profile (apply its settings live)
        if (state.settingsCursor >= profileStartIdx && savedProfiles.length > 0) {
          const profileIdx = state.settingsCursor - profileStartIdx
          const profileName = savedProfiles[profileIdx]
          if (profileName) {
            const settings = loadProfile(state.config, profileName)
            if (settings) {
              state.sortColumn = settings.sortColumn || 'avg'
              state.sortDirection = settings.sortAsc ? 'asc' : 'desc'
              state.pingInterval = settings.pingInterval || PING_INTERVAL
              if (settings.tierFilter) {
                const tierIdx = TIER_CYCLE.indexOf(settings.tierFilter)
                if (tierIdx >= 0) tierFilterMode = tierIdx
              } else {
                tierFilterMode = 0
              }
              state.activeProfile = profileName
              syncFavoriteFlags(state.results, state.config)
              applyTierFilter()
              const visible = state.results.filter(r => !r.hidden)
              state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
              saveConfig(state.config)
            }
          }
          return
        }

        // 📖 Enter edit mode for the selected provider's key
        const pk = providerKeys[state.settingsCursor]
        state.settingsEditBuffer = state.config.apiKeys?.[pk] ?? ''
        state.settingsEditMode = true
        return
      }

      if (key.name === 'space') {
        if (state.settingsCursor === updateRowIdx) return
        // 📖 Profile rows don't respond to Space
        if (state.settingsCursor >= profileStartIdx) return

        // 📖 Toggle enabled/disabled for selected provider
        const pk = providerKeys[state.settingsCursor]
        if (!state.config.providers) state.config.providers = {}
        if (!state.config.providers[pk]) state.config.providers[pk] = { enabled: true }
        state.config.providers[pk].enabled = !isProviderEnabled(state.config, pk)
        saveConfig(state.config)
        return
      }

      if (key.name === 't') {
        if (state.settingsCursor === updateRowIdx) return
        // 📖 Profile rows don't respond to T (test key)
        if (state.settingsCursor >= profileStartIdx) return

        // 📖 Test the selected provider's key (fires a real ping)
        const pk = providerKeys[state.settingsCursor]
        testProviderKey(pk)
        return
      }

      if (key.name === 'u') {
        checkUpdatesFromSettings()
        return
      }

      // 📖 Backspace on a profile row → delete that profile
      if (key.name === 'backspace' && state.settingsCursor >= profileStartIdx && savedProfiles.length > 0) {
        const profileIdx = state.settingsCursor - profileStartIdx
        const profileName = savedProfiles[profileIdx]
        if (profileName) {
          deleteProfile(state.config, profileName)
          // 📖 If the deleted profile was active, clear active state
          if (state.activeProfile === profileName) {
            setActiveProfile(state.config, null)
            state.activeProfile = null
          }
          saveConfig(state.config)
          // 📖 Re-clamp cursor after deletion (profile list just got shorter)
          const newProfiles = listProfiles(state.config)
          const newMaxRowIdx = newProfiles.length > 0 ? profileStartIdx + newProfiles.length - 1 : updateRowIdx
          if (state.settingsCursor > newMaxRowIdx) {
            state.settingsCursor = Math.max(0, newMaxRowIdx)
          }
        }
        return
      }

      if (key.ctrl && key.name === 'c') { exit(0); return }

       // 📖 S key: sync FCM provider entries to OpenCode config (merge, don't replace)
        if (key.name === 's' && !key.shift && !key.ctrl) {
          try {
            // 📖 Sync now also ensures proxy is running, so OpenCode can use fcm-proxy immediately.
            const started = await ensureProxyRunning(state.config)
            const result = syncToOpenCode(state.config, sources, mergedModels, {
              proxyPort: started.port,
              proxyToken: started.proxyToken,
              availableModelSlugs: started.availableModelSlugs,
            })
            state.settingsSyncStatus = {
              type: 'success',
              msg: `✅ Synced ${result.providerKey} (${result.modelCount} models), proxy running on :${started.port}`,
            }
        } catch (err) {
          state.settingsSyncStatus = { type: 'error', msg: `❌ Sync failed: ${err.message}` }
        }
        return
      }

      // 📖 R key: restore OpenCode config from backup (opencode.json.bak)
      if (key.name === 'r' && !key.shift && !key.ctrl) {
        try {
          const restored = restoreOpenCodeBackup()
          state.settingsSyncStatus = restored
            ? { type: 'success', msg: '✅ OpenCode config restored from backup' }
            : { type: 'error', msg: '⚠  No backup found (opencode.json.bak)' }
        } catch (err) {
          state.settingsSyncStatus = { type: 'error', msg: `❌ Restore failed: ${err.message}` }
        }
        return
      }

      // 📖 + key: open add-key input (empty buffer) — appends new key on Enter
      if ((str === '+' || key.name === '+') && state.settingsCursor < providerKeys.length) {
        state.settingsEditBuffer = ''      // 📖 Start with empty buffer (not existing key)
        state.settingsAddKeyMode = true    // 📖 Add mode: Enter will append, not replace
        state.settingsEditMode = false
        return
      }

      // 📖 - key: remove one key (last by default) instead of deleting entire provider
      if ((str === '-' || key.name === '-') && state.settingsCursor < providerKeys.length) {
        const pk = providerKeys[state.settingsCursor]
        const removed = removeApiKey(state.config, pk)  // removes last key; collapses array-of-1 to string
        if (removed) {
          saveConfig(state.config)
          const remaining = resolveApiKeys(state.config, pk).length
          const msg = remaining > 0
            ? `✅ Removed one key for ${pk} (${remaining} remaining)`
            : `✅ Removed last API key for ${pk}`
          state.settingsSyncStatus = { type: 'success', msg }
        }
        return
      }

      return // 📖 Swallow all other keys while settings is open
    }

    // 📖 P key: open settings screen
    if (key.name === 'p' && !key.shift) {
      state.settingsOpen = true
      state.settingsCursor = 0
      state.settingsEditMode = false
      state.settingsAddKeyMode = false
      state.settingsEditBuffer = ''
      state.settingsScrollOffset = 0
      return
    }

    // 📖 Q key: open Smart Recommend overlay
    if (key.name === 'q') {
      state.recommendOpen = true
      state.recommendPhase = 'questionnaire'
      state.recommendQuestion = 0
      state.recommendCursor = 0
      state.recommendAnswers = { taskType: null, priority: null, contextBudget: null }
      state.recommendResults = []
      state.recommendScrollOffset = 0
      return
    }

    // 📖 Shift+P: cycle through profiles (or show profile picker)
    if (key.name === 'p' && key.shift) {
      const profiles = listProfiles(state.config)
      if (profiles.length === 0) {
        // 📖 No profiles saved — save current config as 'default' profile
        saveAsProfile(state.config, 'default', {
          tierFilter: TIER_CYCLE[tierFilterMode],
          sortColumn: state.sortColumn,
          sortAsc: state.sortDirection === 'asc',
          pingInterval: state.pingInterval,
        })
        setActiveProfile(state.config, 'default')
        state.activeProfile = 'default'
        saveConfig(state.config)
      } else {
        // 📖 Cycle to next profile (or back to null = raw config)
        const currentIdx = state.activeProfile ? profiles.indexOf(state.activeProfile) : -1
        const nextIdx = (currentIdx + 1) % (profiles.length + 1) // +1 for "no profile"
        if (nextIdx === profiles.length) {
          // 📖 Back to raw config (no profile)
          setActiveProfile(state.config, null)
          state.activeProfile = null
          saveConfig(state.config)
        } else {
          const nextProfile = profiles[nextIdx]
          const settings = loadProfile(state.config, nextProfile)
          if (settings) {
            // 📖 Apply profile's TUI settings to live state
            state.sortColumn = settings.sortColumn || 'avg'
            state.sortDirection = settings.sortAsc ? 'asc' : 'desc'
            state.pingInterval = settings.pingInterval || PING_INTERVAL
            if (settings.tierFilter) {
              const tierIdx = TIER_CYCLE.indexOf(settings.tierFilter)
              if (tierIdx >= 0) tierFilterMode = tierIdx
            } else {
              tierFilterMode = 0
            }
            state.activeProfile = nextProfile
            // 📖 Rebuild favorites from profile data
            syncFavoriteFlags(state.results, state.config)
            applyTierFilter()
            const visible = state.results.filter(r => !r.hidden)
            state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
            state.cursor = 0
            state.scrollOffset = 0
            saveConfig(state.config)
          }
        }
      }
      return
    }

    // 📖 Shift+S: enter profile save mode — inline text prompt for typing a profile name
    if (key.name === 's' && key.shift) {
      state.profileSaveMode = true
      state.profileSaveBuffer = ''
      return
    }

    // 📖 Sorting keys: R=rank, Y=tier, O=origin, M=model, L=latest ping, A=avg ping, S=SWE-bench, C=context, H=health, V=verdict, B=stability, U=uptime
    // 📖 T is reserved for tier filter cycling — tier sort moved to Y
    // 📖 N is now reserved for origin filter cycling
    // 📖 G (Shift+G) is handled separately below for usage sort
    const sortKeys = {
      'r': 'rank', 'y': 'tier', 'o': 'origin', 'm': 'model',
      'l': 'ping', 'a': 'avg', 's': 'swe', 'c': 'ctx', 'h': 'condition', 'v': 'verdict', 'b': 'stability', 'u': 'uptime'
    }

    if (sortKeys[key.name] && !key.ctrl && !key.shift) {
      const col = sortKeys[key.name]
      // 📖 Toggle direction if same column, otherwise reset to asc
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        state.sortColumn = col
        state.sortDirection = 'asc'
      }
      // 📖 Recompute visible sorted list and reset cursor to top to avoid stale index
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    // 📖 Shift+G: sort by usage (quota percent remaining from token-stats.json)
    if (key.name === 'g' && key.shift && !key.ctrl) {
      const col = 'usage'
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        state.sortColumn = col
        state.sortDirection = 'asc'
      }
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    // 📖 F key: toggle favorite on the currently selected row and persist to config.
    if (key.name === 'f') {
      const selected = state.visibleSorted[state.cursor]
      if (!selected) return
      const wasFavorite = selected.isFavorite
      toggleFavoriteModel(state.config, selected.providerKey, selected.modelId)
      syncFavoriteFlags(state.results, state.config)
      applyTierFilter()
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)

      // 📖 UX rule: when unpinning a favorite, jump back to the top of the list.
      if (wasFavorite) {
        state.cursor = 0
        state.scrollOffset = 0
        return
      }

      const selectedKey = toFavoriteKey(selected.providerKey, selected.modelId)
      const newCursor = state.visibleSorted.findIndex(r => toFavoriteKey(r.providerKey, r.modelId) === selectedKey)
      if (newCursor >= 0) state.cursor = newCursor
      else if (state.cursor >= state.visibleSorted.length) state.cursor = Math.max(0, state.visibleSorted.length - 1)
      adjustScrollOffset(state)
      return
    }

    // 📖 J key: open Feature Request overlay (anonymous Discord feedback)
    if (key.name === 'j') {
      state.featureRequestOpen = true
      state.featureRequestBuffer = ''
      state.featureRequestStatus = 'idle'
      state.featureRequestError = null
      return
    }

    // 📖 I key: open Bug Report overlay (anonymous Discord bug reports)
    if (key.name === 'i') {
      state.bugReportOpen = true
      state.bugReportBuffer = ''
      state.bugReportStatus = 'idle'
      state.bugReportError = null
      return
    }

    // 📖 Interval adjustment keys: W=decrease (faster), ==increase (slower)
    // 📖 X was previously used for interval increase but is now reserved for the log page overlay.
    // 📖 Minimum 1s, maximum 60s
    if (key.name === 'w') {
      state.pingInterval = Math.max(1000, state.pingInterval - 1000)
    } else if (str === '=' || key.name === '=') {
      state.pingInterval = Math.min(60000, state.pingInterval + 1000)
    }

    // 📖 Tier toggle key: T = cycle through each individual tier (All → S+ → S → A+ → A → A- → B+ → B → C → All)
    if (key.name === 't') {
      tierFilterMode = (tierFilterMode + 1) % TIER_CYCLE.length
      applyTierFilter()
      // 📖 Recompute visible sorted list and reset cursor to avoid stale index into new filtered set
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    // 📖 Origin filter key: N = cycle through each provider (All → NIM → Groq → ... → All)
    if (key.name === 'n') {
      originFilterMode = (originFilterMode + 1) % ORIGIN_CYCLE.length
      applyTierFilter()
      // 📖 Recompute visible sorted list and reset cursor to avoid stale index into new filtered set
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    // 📖 Help overlay key: K = toggle help overlay
    if (key.name === 'k') {
      state.helpVisible = !state.helpVisible
      if (state.helpVisible) state.helpScrollOffset = 0
      return
    }

    // 📖 Mode toggle key: Z = cycle through modes (CLI → Desktop → OpenClaw)
    if (key.name === 'z') {
      const modeOrder = ['opencode', 'opencode-desktop', 'openclaw']
      const currentIndex = modeOrder.indexOf(state.mode)
      const nextIndex = (currentIndex + 1) % modeOrder.length
      state.mode = modeOrder[nextIndex]
      return
    }

    // 📖 X key: toggle the log page overlay (shows recent requests from request-log.jsonl).
    // 📖 NOTE: X was previously used for ping-interval increase; that binding moved to '='.
    if (key.name === 'x') {
      state.logVisible = !state.logVisible
      if (state.logVisible) state.logScrollOffset = 0
      return
    }

    if (key.name === 'up') {
      // 📖 Main list wrap navigation: top -> bottom on Up.
      const count = state.visibleSorted.length
      if (count === 0) return
      state.cursor = state.cursor > 0 ? state.cursor - 1 : count - 1
      adjustScrollOffset(state)
      return
    }

    if (key.name === 'down') {
      // 📖 Main list wrap navigation: bottom -> top on Down.
      const count = state.visibleSorted.length
      if (count === 0) return
      state.cursor = state.cursor < count - 1 ? state.cursor + 1 : 0
      adjustScrollOffset(state)
      return
    }

    if (key.name === 'c' && key.ctrl) { // Ctrl+C
      exit(0)
      return
    }

    if (key.name === 'return') { // Enter
      // 📖 Use the cached visible+sorted array — guaranteed to match what's on screen
      const selected = state.visibleSorted[state.cursor]
      if (!selected) return // 📖 Guard: empty visible list (all filtered out)
      // 📖 Allow selecting ANY model (even timeout/down) - user knows what they're doing
      userSelected = { modelId: selected.modelId, label: selected.label, tier: selected.tier, providerKey: selected.providerKey }

      // 📖 Stop everything and act on selection immediately
      clearInterval(ticker)
      clearTimeout(state.pingIntervalObj)
      readline.emitKeypressEvents(process.stdin)
      process.stdin.setRawMode(true)
      process.stdin.pause()
      process.stdin.removeListener('keypress', onKeyPress)
      process.stdout.write(ALT_LEAVE)

      // 📖 Show selection with status
      if (selected.status === 'timeout') {
        console.log(chalk.yellow(`  ⚠ Selected: ${selected.label} (currently timing out)`))
      } else if (selected.status === 'down') {
        console.log(chalk.red(`  ⚠ Selected: ${selected.label} (currently down)`))
      } else {
        console.log(chalk.cyan(`  ✓ Selected: ${selected.label}`))
      }
      console.log()

      // 📖 Warn if no API key is configured for the selected model's provider
      if (state.mode !== 'openclaw') {
        const selectedApiKey = getApiKey(state.config, selected.providerKey)
        if (!selectedApiKey) {
          console.log(chalk.yellow(`  Warning: No API key configured for ${selected.providerKey}.`))
          console.log(chalk.yellow(`  OpenCode may not be able to use ${selected.label}.`))
          console.log(chalk.dim(`  Set ${ENV_VAR_NAMES[selected.providerKey] || selected.providerKey.toUpperCase() + '_API_KEY'} or configure via settings (P key).`))
          console.log()
        }
      }

      // 📖 Dispatch to the correct integration based on active mode
      if (state.mode === 'openclaw') {
        await startOpenClaw(userSelected, apiKey)
      } else if (state.mode === 'opencode-desktop') {
        await startOpenCodeDesktop(userSelected, state.config)
      } else {
        const topology = buildProxyTopologyFromConfig(state.config)
        if (topology.accounts.length === 0) {
          console.log(chalk.yellow(`  No API keys found for proxy model catalog. Falling back to direct flow.`))
          console.log()
          await startOpenCode(userSelected, state.config)
        } else {
          await startProxyAndLaunch(userSelected, state.config)
        }
      }
      process.exit(0)
    }
  }

  // 📖 Enable keypress events on stdin
  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  process.stdin.on('keypress', onKeyPress)

  // 📖 Animation loop: render settings overlay, recommend overlay, help overlay, feature request overlay, bug report overlay, OR main table
  const ticker = setInterval(() => {
    state.frame++
    // 📖 Cache visible+sorted models each frame so Enter handler always matches the display
    if (!state.settingsOpen && !state.recommendOpen && !state.featureRequestOpen && !state.bugReportOpen) {
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
    }
    const content = state.settingsOpen
      ? renderSettings()
      : state.recommendOpen
        ? renderRecommend()
        : state.featureRequestOpen
          ? renderFeatureRequest()
          : state.bugReportOpen
            ? renderBugReport()
            : state.helpVisible
              ? renderHelp()
              : state.logVisible
                ? renderLog()
                : renderTable(state.results, state.pendingPings, state.frame, state.cursor, state.sortColumn, state.sortDirection, state.pingInterval, state.lastPingTime, state.mode, tierFilterMode, state.scrollOffset, state.terminalRows, originFilterMode, state.activeProfile, state.profileSaveMode, state.profileSaveBuffer, state.proxyStartupStatus)
    process.stdout.write(ALT_HOME + content)
  }, Math.round(1000 / FPS))

  // 📖 Populate visibleSorted before the first frame so Enter works immediately
  const initialVisible = state.results.filter(r => !r.hidden)
  state.visibleSorted = sortResultsWithPinnedFavorites(initialVisible, state.sortColumn, state.sortDirection)

  process.stdout.write(ALT_HOME + renderTable(state.results, state.pendingPings, state.frame, state.cursor, state.sortColumn, state.sortDirection, state.pingInterval, state.lastPingTime, state.mode, tierFilterMode, state.scrollOffset, state.terminalRows, originFilterMode, state.activeProfile, state.profileSaveMode, state.profileSaveBuffer, state.proxyStartupStatus))

  // 📖 If --recommend was passed, auto-open the Smart Recommend overlay on start
  if (cliArgs.recommendMode) {
    state.recommendOpen = true
    state.recommendPhase = 'questionnaire'
    state.recommendCursor = 0
    state.recommendQuestion = 0
    state.recommendAnswers = { taskType: null, priority: null, contextBudget: null }
    state.recommendProgress = 0
    state.recommendResults = []
    state.recommendScrollOffset = 0
  }

  // ── Continuous ping loop — ping all models every N seconds forever ──────────

  // 📖 Single ping function that updates result
  // 📖 Uses per-provider API key and URL from sources.js
  // 📖 If no API key is configured, pings without auth — a 401 still tells us latency + server is up
  const pingModel = async (r) => {
    const providerApiKey = getApiKey(state.config, r.providerKey) ?? null
    const providerUrl = sources[r.providerKey]?.url ?? sources.nvidia.url
    let { code, ms, quotaPercent } = await ping(providerApiKey, r.modelId, r.providerKey, providerUrl)

    if ((quotaPercent === null || quotaPercent === undefined) && providerApiKey) {
      const providerQuota = await getProviderQuotaPercentCached(r.providerKey, providerApiKey)
      if (typeof providerQuota === 'number' && Number.isFinite(providerQuota)) {
        quotaPercent = providerQuota
      }
    }

    // 📖 Store ping result as object with ms and code
    // 📖 ms = actual response time (even for errors like 429)
    // 📖 code = HTTP status code ('200', '429', '500', '000' for timeout)
    r.pings.push({ ms, code })

    // 📖 Update status based on latest ping
    if (code === '200') {
      r.status = 'up'
    } else if (code === '000') {
      r.status = 'timeout'
    } else if (code === '401') {
      // 📖 401 = server is reachable but no API key set (or wrong key)
      // 📖 Treated as 'noauth' — server is UP, latency is real, just needs a key
      r.status = 'noauth'
      r.httpCode = code
    } else {
      r.status = 'down'
      r.httpCode = code
    }

    if (typeof quotaPercent === 'number' && Number.isFinite(quotaPercent)) {
      r.usagePercent = quotaPercent
      // Provider-level fallback: apply latest known quota to sibling rows on same provider.
      for (const sibling of state.results) {
        if (sibling.providerKey === r.providerKey && (sibling.usagePercent === undefined || sibling.usagePercent === null)) {
          sibling.usagePercent = quotaPercent
        }
      }
    }
  }

  // 📖 Initial ping of all models
  const initialPing = Promise.all(state.results.map(r => pingModel(r)))

  // 📖 Continuous ping loop with dynamic interval (adjustable with W/= keys)
  const schedulePing = () => {
    state.pingIntervalObj = setTimeout(async () => {
      state.lastPingTime = Date.now()

      // 📖 Refresh persisted usage snapshots each cycle so proxy writes appear live in table.
      // 📖 Freshness-aware: stale snapshots (>30m) are excluded and row reverts to undefined.
      for (const r of state.results) {
        const pct = _usageForRow(r.providerKey, r.modelId)
        if (typeof pct === 'number' && Number.isFinite(pct)) {
          r.usagePercent = pct
        } else {
          // If snapshot is now stale or gone, clear the cached value so UI shows N/A.
          r.usagePercent = undefined
        }
      }

      state.results.forEach(r => {
        pingModel(r).catch(() => {
          // Individual ping failures don't crash the loop
        })
      })

      // 📖 Schedule next ping with current interval
      schedulePing()
    }, state.pingInterval)
  }

  // 📖 Start the ping loop
  state.pingIntervalObj = null
  schedulePing()

  await initialPing

  // 📖 Keep interface running forever - user can select anytime or Ctrl+C to exit
  // 📖 The pings continue running in background with dynamic interval
  // 📖 User can press W to decrease interval (faster pings) or = to increase (slower)
  // 📖 Current interval shown in header: "next ping Xs"
}

main().catch((err) => {
  process.stdout.write(ALT_LEAVE)
  console.error(err)
  process.exit(1)
})
