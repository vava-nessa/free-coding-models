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
 *   - Instant OpenCode / OpenClaw / external-tool action on Enter key press
 *   - Direct mode flags plus an in-app Z-cycle for the public launcher set
 *   - Automatic config detection and model setup for both tools
 *   - JSON config stored in ~/.free-coding-models.json (auto-migrates from old plain-text)
 *   - Multi-provider support via sources.js (NIM/Groq/Cerebras/GitHub Models/Mistral/OpenRouter/... — extensible)
 *   - Settings screen (P key) to manage API keys, provider toggles, manual updates, and provider-key diagnostics
 *   - Install Endpoints flow (Settings / Command Palette) to push provider catalogs into OpenCode, OpenClaw, Crush, and Goose
 *   - Favorites system: toggle with F, switch pinning mode with Y, persist between sessions
 *   - Uptime percentage tracking (successful pings / total pings)
 *   - Sortable columns (R/O/M/L/A/S/C/H/V/B/U/G keys)
 *   - Tier filtering via T key (cycles S+→S→A+→A→A-→B+→B→C→All)
 *
 *   → Functions:
 *   - `loadConfig` / `saveConfig` / `getApiKey`: Multi-provider JSON config via lib/config.js
 *   - `getTelemetryDistinctId`: Generate/reuse a stable anonymous ID for telemetry
 *   - `getTelemetryTerminal`: Infer terminal family (Terminal.app, iTerm2, kitty, etc.)
 *   - `isTelemetryDebugEnabled` / `telemetryDebug`: Optional runtime telemetry diagnostics via env
 *   - `sendUsageTelemetry`: Fire-and-forget anonymous app-start, launch, and action events
 *   - `ensureFavoritesConfig` / `toggleFavoriteModel`: Persist and toggle pinned favorites
 *   - `promptApiKey`: Interactive wizard for first-time multi-provider API key setup
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
 *   - Env vars override config: NVIDIA_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY, GITHUB_TOKEN, MISTRAL_API_KEY, SCALEWAY_API_KEY, GOOGLE_API_KEY, CLOUDFLARE_API_TOKEN, DASHSCOPE_API_KEY, ZAI_API_KEY, etc.
 *   - ZAI (z.ai) uses a non-standard base path; cloudflare needs CLOUDFLARE_ACCOUNT_ID in env.
 *   - Cloudflare Workers AI requires both CLOUDFLARE_API_TOKEN (or CLOUDFLARE_API_KEY) and CLOUDFLARE_ACCOUNT_ID
 *   - Models loaded from sources.js — all provider/model definitions are centralized there
 *   - OpenCode config: ~/.config/opencode/opencode.json
 *   - OpenClaw config: ~/.openclaw/openclaw.json
 *   - Ping timeout: 15s per attempt
 *   - Ping cadence: 2s startup burst for 60s, 10s steady state, 30s after 5m idle, forced 4s via `W`
 *   - Animation: 12 FPS with braille spinners
 *
 *   🚀 CLI flags:
 *   - (no flag): Start in OpenCode CLI mode
 *   - --opencode: OpenCode CLI mode (launch CLI with selected model)
 *   - --opencode-desktop: OpenCode Desktop mode (set model & open Desktop app)
 *   - --openclaw: OpenClaw mode (set selected model as default in OpenClaw)
 *   - --crush / --goose / --pi: launch the currently selected model in the supported external CLI
 *   - --best: Show only top-tier models (A+, S, S+)
 *   - --fiable: Analyze 10s and output the most reliable model
 *   - --json: Output results as JSON (for scripting/automation)
 *   - --recommend: Open Smart Recommend immediately on startup
 *   - --profile <name>: Load a saved config profile before entering the TUI
 *   - --no-telemetry: Disable anonymous usage analytics for this run
 *   - --help / -h: Print the full CLI help and exit
 *   - --tier S/A/B/C: Filter models by tier letter (S=S+/S, A=A+/A/A-, B=B+/B, C=C)
 *
 *   @see {@link https://build.nvidia.com} NVIDIA API key generation
 *   @see {@link https://github.com/opencode-ai/opencode} OpenCode repository
 *   @see {@link https://openclaw.ai} OpenClaw documentation
 */

import chalk from 'chalk'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { MODELS, sources } from '../sources.js'
import { getAvg, getVerdict, getUptime, getP95, getJitter, getStabilityScore, sortResults, filterByTier, findBestModel, parseArgs, TIER_ORDER, VERDICT_ORDER, TIER_LETTER_MAP, scoreModelForTask, getTopRecommendations, TASK_TYPES, PRIORITY_TYPES, CONTEXT_BUDGETS, formatCtxWindow, labelFromId, formatResultsAsJSON } from '../src/utils.js'
import { loadConfig, saveConfig, getApiKey, resolveApiKeys, addApiKey, removeApiKey, isProviderEnabled, persistApiKeysForProvider } from '../src/config.js'
import { buildMergedModels } from '../src/model-merger.js'
import { loadOpenCodeConfig, saveOpenCodeConfig } from '../src/opencode-config.js'
import { usageForRow as _usageForRow } from '../src/usage-reader.js'
import { buildProviderModelTokenKey, loadTokenUsageByProviderModel } from '../src/token-usage-reader.js'
import { parseOpenRouterResponse, fetchProviderQuota as _fetchProviderQuotaFromModule } from '../src/provider-quota-fetchers.js'
import { isKnownQuotaTelemetry } from '../src/quota-capabilities.js'
import { ALT_ENTER, ALT_LEAVE, ALT_HOME, PING_TIMEOUT, PING_INTERVAL, FPS, COL_MODEL, COL_MS, CELL_W, FRAMES, TIER_CYCLE, VERDICT_CYCLE, HEALTH_CYCLE, SETTINGS_OVERLAY_BG, HELP_OVERLAY_BG, RECOMMEND_OVERLAY_BG, OVERLAY_PANEL_WIDTH, TABLE_HEADER_LINES, TABLE_FOOTER_LINES, TABLE_FIXED_LINES, WIDTH_WARNING_MIN_COLS, msCell, spinCell } from '../src/constants.js'
import { TIER_COLOR } from '../src/tier-colors.js'
import { resolveCloudflareUrl, buildPingRequest, ping, extractQuotaPercent, getProviderQuotaPercentCached, usagePlaceholderForProvider } from '../src/ping.js'
import { runFiableMode, filterByTierOrExit, fetchOpenRouterFreeModels } from '../src/analysis.js'
import { PROVIDER_METADATA, ENV_VAR_NAMES, isWindows, isMac } from '../src/provider-metadata.js'
import { parseTelemetryEnv, isTelemetryDebugEnabled, telemetryDebug, ensureTelemetryConfig, getTelemetryDistinctId, getTelemetrySystem, getTelemetryTerminal, isTelemetryEnabled, sendUsageTelemetry } from '../src/telemetry.js'
import { ensureFavoritesConfig, toFavoriteKey, syncFavoriteFlags, toggleFavoriteModel, reorderFavorite } from '../src/favorites.js'
import { checkForUpdateDetailed, checkForUpdate, runUpdate, promptUpdateNotification, fetchLastReleaseDate } from './updater.js'
import { promptApiKey } from '../src/setup.js'
import { syncShellEnv, ensureShellRcSource, promptShellEnvMigration, removeShellEnv } from '../src/shell-env.js'
import { stripAnsi, maskApiKey, displayWidth, padEndDisplay, tintOverlayLines, keepOverlayTargetVisible, sliceOverlayLines, calculateViewport, sortResultsWithPinnedFavorites, adjustScrollOffset } from '../src/render-helpers.js'
import { renderTable, PROVIDER_COLOR } from '../src/render-table.js'
import { setOpenCodeModelData, startOpenCode, startOpenCodeDesktop, startOpenCodeWeb } from '../src/opencode.js'
import { startKilo } from '../src/kilo.js'
import { startOpenClaw } from '../src/openclaw.js'
import { createOverlayRenderers } from '../src/overlays.js'
import { createKeyHandler, createMouseEventHandler } from '../src/key-handler.js'
import { createMouseHandler, containsMouseSequence } from '../src/mouse.js'
import { stopRouterDashboardClient } from '../src/router-dashboard.js'
import { getToolModeOrder, getToolMeta } from '../src/tool-metadata.js'
import { startExternalTool } from '../src/tool-launchers.js'
import { getToolInstallPlan, installToolWithPlan, isToolInstalled } from '../src/tool-bootstrap.js'
import { getConfiguredInstallableProviders, installProviderEndpoints, refreshInstalledEndpoints, getInstallTargetModes, getProviderCatalogModels } from '../src/endpoint-installer.js'
import { loadCache, saveCache, clearCache, getCacheAge } from '../src/cache.js'
import { checkConfigSecurity } from '../src/security.js'
import { buildCliHelpText } from '../src/cli-help.js'
import { detectActiveTheme } from '../src/theme.js'

// 📖 mergedModels: cross-provider grouped model list (one entry per label, N providers each)
// 📖 mergedModelByLabel: fast lookup map from display label → merged model entry
const mergedModels = buildMergedModels(MODELS)
const mergedModelByLabel = new Map(mergedModels.map(m => [m.label, m]))
setOpenCodeModelData(mergedModels, mergedModelByLabel)

// 📖 Provider quota cache is managed by lib/provider-quota-fetchers.js (TTL + backoff).
// 📖 Usage placeholder logic uses isKnownQuotaTelemetry() from lib/quota-capabilities.js.

const require = createRequire(import.meta.url)
const readline = require('readline')

// ─── Version check ────────────────────────────────────────────────────────────
const pkg = require('../package.json')
const LOCAL_VERSION = pkg.version

// 📖 sendBugReport → imported from ../src/telemetry.js

// 📖 parseTelemetryEnv, isTelemetryDebugEnabled, telemetryDebug, ensureTelemetryConfig → imported from ../src/telemetry.js

// 📖 ensureFavoritesConfig, toFavoriteKey, syncFavoriteFlags, toggleFavoriteModel → imported from ../src/favorites.js

// ─── Alternate screen control ─────────────────────────────────────────────────
// 📖 \x1b[?1049h = enter alt screen  \x1b[?1049l = leave alt screen
// 📖 \x1b[?25l   = hide cursor       \x1b[?25h   = show cursor
// 📖 \x1b[H      = cursor to top
// 📖 NOTE: We avoid \x1b[2J (clear screen) because Ghostty scrolls cleared
// 📖 content into the scrollback on the alt screen, pushing the header off-screen.
// 📖 Instead we overwrite in place: cursor home, then \x1b[K (erase to EOL) per line.
// 📖 \x1b[?7l disables auto-wrap so wide rows clip at the right edge instead of
// 📖 wrapping to the next line (which would double the row height and overflow).
// NOTE: All constants (ALT_ENTER, PING_TIMEOUT, etc.) are imported from ../src/constants.js

// ─── Styling ──────────────────────────────────────────────────────────────────
// 📖 Tier colors (TIER_COLOR) are imported from ../src/tier-colors.js
// 📖 All TUI constants (ALT_ENTER, PING_TIMEOUT, etc.) are imported from ../src/constants.js

// 📖 renderTable is now extracted to ../src/render-table.js

// ─── OpenCode integration ──────────────────────────────────────────────────────
// 📖 OpenCode helpers are imported from ../src/opencode.js

// ─── OpenCode integration ──────────────────────────────────────────────────────
// 📖 OpenCode helpers are imported from ../src/opencode.js

export async function runApp(cliArgs, config) {

  // 📖 Detect user active terminal theme
  detectActiveTheme(config.settings?.theme || 'auto')

  // 📖 Check config file security — warn and offer auto-fix if permissions are too open
  const securityCheck = checkConfigSecurity()
  if (!securityCheck.wasSecure && !securityCheck.wasFixed) {
    // 📖 User declined auto-fix or it failed — continue anyway, just warned
  }

  // 📖 Apply CLI overrides for settings
  if (cliArgs.sortColumn) config.settings.sortColumn = cliArgs.sortColumn
  if (cliArgs.sortDirection) config.settings.sortAsc = cliArgs.sortDirection === 'asc'
  if (cliArgs.originFilter) config.settings.originFilter = cliArgs.originFilter
  if (cliArgs.pingInterval) config.settings.pingInterval = cliArgs.pingInterval
  if (cliArgs.hideUnconfigured) config.settings.hideUnconfiguredModels = true
  if (cliArgs.showUnconfigured) config.settings.hideUnconfiguredModels = false

  // 📖 Apply premium mode as an initial, user-resettable view preset.
  if (cliArgs.premiumMode) {
    config.settings.tierFilter = 'S'
    config.settings.sortColumn = 'verdict'
    config.settings.sortAsc = true
  }

  // 📖 Profile system removed - API keys now persist permanently across all sessions

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
    // 📖 New users get shell env enabled by default
    if (config.settings.shellEnvEnabled === undefined) {
      config.settings.shellEnvEnabled = true
      saveConfig(config)
      syncShellEnv(config)
      ensureShellRcSource()
    }
  }

  // 📖 Shell env migration popup for existing users who haven't been asked yet
  // 📖 Only show when user has keys but shellEnvEnabled is still undefined (never prompted)
  // 📖 shellEnvPromptSeen flag ensures it only shows ONCE even after adding new keys
  if (hasAnyKey && config.settings.shellEnvEnabled === undefined && config.settings.shellEnvPromptSeen !== true) {
    const choice = await promptShellEnvMigration(config)
    if (!config.settings) config.settings = {}
    config.settings.shellEnvPromptSeen = true
    if (choice === 'enable') {
      config.settings.shellEnvEnabled = true
      saveConfig(config)
      syncShellEnv(config)
      ensureShellRcSource()
    } else if (choice === 'never') {
      config.settings.shellEnvEnabled = false
      saveConfig(config)
    }
    if (choice === 'skip') {
      config.settings.shellEnvEnabled = false
      saveConfig(config)
    }
  }

  // 📖 Default mode: use the last persisted launcher choice when valid,
  // 📖 otherwise fall back to OpenCode CLI.
  let mode = getToolModeOrder().includes(config.settings?.preferredToolMode)
    ? config.settings.preferredToolMode
    : 'opencode'
  const requestedMode = getToolModeOrder().find((toolMode) => {
    const flagByMode = {
      opencode: cliArgs.openCodeMode,
      'opencode-desktop': cliArgs.openCodeDesktopMode,
      'opencode-web': cliArgs.openCodeWebMode,
      openclaw: cliArgs.openClawMode,
      aider: cliArgs.aiderMode,
      crush: cliArgs.crushMode,
      goose: cliArgs.gooseMode,
      kilo: cliArgs.kiloMode,
      qwen: cliArgs.qwenMode,
      openhands: cliArgs.openHandsMode,
      amp: cliArgs.ampMode,
      hermes: cliArgs.hermesMode,
      'continue': cliArgs.continueMode,
      cline: cliArgs.clineMode,
      xcode: cliArgs.xcodeMode,
      pi: cliArgs.piMode,
      rovo: cliArgs.rovoMode,
      gemini: cliArgs.geminiMode,
    }
    return flagByMode[toolMode] === true
  })
  if (requestedMode) mode = requestedMode

  const sessionId = `session_${randomUUID()}`

  // 📖 Track app opening early so fast exits are still counted.
  // 📖 Must run before update checks because npm registry lookups can add startup delay.
  void sendUsageTelemetry(config, cliArgs, {
    event: 'app_start',
    version: LOCAL_VERSION,
    mode,
    ts: new Date().toISOString(),
    properties: {
      session_id: sessionId,
      event_version: 1,
    },
  })

  // 📖 Auto-update detection: check npm registry for new versions at startup.
  // 📖 If a new version is available, show an interactive prompt (Update / Changelogs / Skip).
  // 📖 Dev mode (git checkout) skips auto-update to avoid infinite relaunch loops.
  let latestVersion = null
  const isDevMode = existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.git'))
  try {
    latestVersion = await checkForUpdate()
    // 📖 Reset failure counter on successful check
    if (config.settings?.updateCheckFailures) {
      config.settings.updateCheckFailures = 0
      saveConfig(config)
    }
  } catch (err) {
    const failures = (config.settings?.updateCheckFailures || 0) + 1
    if (!config.settings) config.settings = {}
    config.settings.updateCheckFailures = Math.min(failures, 3)
    saveConfig(config)
  }

  // 📖 Show interactive update prompt if a new version is available (skip in dev mode)
  if (latestVersion && !isDevMode) {
    const choice = await promptUpdateNotification(latestVersion)
    if (choice === 'update') {
      runUpdate(latestVersion)
      return // 📖 runUpdate relaunches the process — this line is a safety guard
    } else if (choice === 'changelogs') {
      const { execSync: _exec } = await import('child_process')
      const url = 'https://github.com/vava-nessa/free-coding-models/releases'
      try {
        if (process.platform === 'darwin') _exec(`open ${url}`)
        else if (process.platform === 'linux') _exec(`xdg-open ${url}`)
        else console.log(chalk.dim(`  📋 ${url}`))
      } catch { console.log(chalk.dim(`  📋 ${url}`)) }
      // 📖 After opening changelogs, re-prompt so user can still update or continue
      const choice2 = await promptUpdateNotification(latestVersion)
      if (choice2 === 'update') {
        runUpdate(latestVersion)
        return
      }
    }
  }

  // 📖 Dynamic OpenRouter free model discovery — fetch live free models from API
  // 📖 Replaces static openrouter entries in MODELS with fresh data.
  // 📖 Fallback: if fetch fails, the static list from sources.js stays intact + warning shown.
  const lastReleaseDate = await fetchLastReleaseDate()
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

  // 📖 Re-sync tracked external-tool catalogs after the live provider catalog has settled.
  // 📖 This keeps prior endpoint installs aligned with the current FCM model list.
  refreshInstalledEndpoints(config)

  // 📖 Build results from MODELS — only include enabled providers
  // 📖 Each result gets providerKey so ping() knows which URL + API key to use

  let results = MODELS
    .filter(([,,,,,providerKey]) => isProviderEnabled(config, providerKey))
    .map(([modelId, label, tier, sweScore, ctx, providerKey], i) => ({
      idx: i + 1, modelId, label, tier, sweScore, ctx, providerKey,
      status: 'pending',
      pings: [],  // 📖 All ping results (ms or 'TIMEOUT')
      httpCode: null,
      isPinging: false, // 📖 Per-row live flag so Latest Ping can keep last value and show a spinner during refresh.
      hidden: false,  // 📖 Simple flag to hide/show models
    }))
  syncFavoriteFlags(results, config)

  // 📖 Load usage data from token-stats.json and attach usagePercent to each result row.
  // 📖 usagePercent is the quota percent remaining (0–100). undefined = no data available.
  // 📖 Freshness-aware: snapshots older than 30 minutes are excluded (shown as N/A in UI).
  const tokenTotalsByProviderModel = loadTokenUsageByProviderModel()
  for (const r of results) {
    const pct = _usageForRow(r.providerKey, r.modelId)
    r.usagePercent = typeof pct === 'number' ? pct : undefined
    r.totalTokens = tokenTotalsByProviderModel[buildProviderModelTokenKey(r.providerKey, r.modelId)] || 0
  }

  // 📖 Add interactive selection state - cursor index and user's choice
  // 📖 sortColumn: 'rank'|'tier'|'origin'|'model'|'ping'|'avg'|'status'|'verdict'|'uptime'
  // 📖 sortDirection: 'asc' (default) or 'desc'
  // 📖 ping cadence is now mode-driven:
  // 📖 speed  = 2s for 1 minute bursts
  // 📖 normal = 10s steady state
  // 📖 slow   = 30s after 5 minutes of inactivity
  // 📖 forced = 4s and ignores inactivity / auto slowdowns
  const PING_MODE_INTERVALS = {
    speed: 2_000,
    normal: 10_000,
    slow: 30_000,
    forced: 4_000,
  }
  const PING_MODE_CYCLE = ['speed', 'normal', 'slow', 'forced']
  const SPEED_MODE_DURATION_MS = 60_000
  const IDLE_SLOW_AFTER_MS = 5 * 60_000
  const now = Date.now()

  const intervalToPingMode = (intervalMs) => {
    if (intervalMs <= 3000) return 'speed'
    if (intervalMs <= 5000) return 'forced'
    if (intervalMs >= 30000) return 'slow'
    return 'normal'
  }

   // 📖 tierFilter: current tier filter letter (null = all, 'S' = S+/S, 'A' = A+/A/A-, etc.)
  const state = {
    results,
    pendingPings: 0,
    frame: 0,
    cursor: 0,
    selectedModel: null,
    sortColumn: config.settings?.sortColumn ?? 'avg',
    sortDirection: (config.settings?.sortAsc ?? true) ? 'asc' : 'desc',
    pingInterval: PING_MODE_INTERVALS.speed, // 📖 Effective live interval derived from the active ping mode.
    pingMode: 'speed',            // 📖 Current ping mode: speed | normal | slow | forced.
    pingModeSource: 'startup',    // 📖 Why this mode is active: startup | manual | auto | idle | activity.
    speedModeUntil: now + SPEED_MODE_DURATION_MS, // 📖 Speed bursts auto-fall back to normal after 60 seconds.
    lastPingTime: now,            // 📖 Track when last ping cycle started
    lastUserActivityAt: now,      // 📖 Any keypress refreshes this timer; inactivity can force slow mode.
    resumeSpeedOnActivity: false, // 📖 Set after idle slowdown so the next activity restarts a 60s speed burst.
    startupLatestVersion: latestVersion, // 📖 Startup auto-check result reused by the footer banner after "skip update".
    lastReleaseDate: null,               // 📖 Human-readable last npm publish date (fetched asynchronously).
    versionAlertsEnabled: !isDevMode, // 📖 Dev checkouts should not tell contributors to upgrade the global npm package.
    mode,                         // 📖 'opencode' or 'openclaw' — controls Enter action
    tierFilterMode: 0,            // 📖 Index into TIER_CYCLE (0=All, 1=S+, 2=S, ...)
    originFilterMode: 0,          // 📖 Index into ORIGIN_CYCLE (0=All, then providers)
    verdictFilterMode: 0,        // 📖 Index into VERDICT_CYCLE (0=All, then verdicts)
    healthFilterMode: 0,          // 📖 Index into HEALTH_CYCLE (0=All, then health states)
    hideUnconfiguredModels: config.settings?.hideUnconfiguredModels === true, // 📖 Hide providers with no configured API key when true.
    favoritesPinnedAndSticky: config.settings?.favoritesPinnedAndSticky === true, // 📖 false by default: favorites follow normal sort/filter rules until Y enables pinned+sticky mode.
      scrollOffset: 0,              // 📖 First visible model index in viewport
      terminalRows: process.stdout.rows || 24,  // 📖 Current terminal height
      terminalCols: process.stdout.columns || 80, // 📖 Current terminal width
      widthWarningStartedAt: (process.stdout.columns || 80) < WIDTH_WARNING_MIN_COLS ? now : null, // 📖 Start immediately in very narrow viewports.
    widthWarningDismissed: false, // 📖 Esc hides the narrow-terminal warning early for the current narrow-width session.
    widthWarningShowCount: 0, // 📖 No longer used — kept for backward compatibility. Warning now shows every time terminal is too small.
    // 📖 Settings screen state (P key opens it)
    settingsOpen: false,          // 📖 Whether settings overlay is active
    settingsCursor: 0,            // 📖 Which provider row is selected in settings
    settingsEditMode: false,      // 📖 Whether we're in inline key editing mode (edit primary key)
    settingsAddKeyMode: false,    // 📖 Whether we're in add-key mode (append a new key to provider)
    settingsEditBuffer: '',       // 📖 Typed characters for the API key being edited
    settingsErrorMsg: null,       // 📖 Temporary error message to display in settings
    settingsTestResults: {},      // 📖 { providerKey: 'pending'|'ok'|'auth_error'|'rate_limited'|'no_callable_model'|'fail'|'missing_key'|null }
    settingsTestDetails: {},      // 📖 Long-form diagnostics shown under Setup Instructions after a Settings key test.
    settingsUpdateState: 'idle',  // 📖 'idle'|'checking'|'available'|'up-to-date'|'error'|'installing'
    settingsUpdateLatestVersion: null, // 📖 Latest npm version discovered from manual check
    settingsUpdateError: null,    // 📖 Last update-check error message for maintenance row
    config,                       // 📖 Live reference to the config object (updated on save)
    sessionId,                    // 📖 Per-process analytics link between app_start and later app_use/app_action events.
    visibleSorted: [],            // 📖 Cached visible+sorted models — shared between render loop and key handlers
    commandPaletteOpen: false,    // 📖 Whether the Ctrl+P command palette overlay is active.
    commandPaletteQuery: '',      // 📖 Current command palette search query.
    commandPaletteCursor: 0,      // 📖 Selected command index in the filtered command list.
    commandPaletteScrollOffset: 0, // 📖 Vertical scroll offset for the command palette result viewport.
    commandPaletteResults: [],    // 📖 Cached fuzzy-filtered command entries for the command palette.
    commandPaletteFrozenTable: null, // 📖 Frozen table snapshot rendered behind the command palette overlay.
    commandPaletteExpandedIds: new Set(['filters', 'actions']), // 📖 Expanded category IDs (filters + actions open by default for quick access).
    helpVisible: false,           // 📖 Whether the help overlay (K key) is active
    settingsScrollOffset: 0,      // 📖 Vertical scroll offset for Settings overlay viewport
    helpScrollOffset: 0,          // 📖 Vertical scroll offset for Help overlay viewport
    // 📖 Install Endpoints overlay state (opened from Settings or Command Palette)
    installEndpointsOpen: false,  // 📖 Whether the install-endpoints overlay is active
    installEndpointsPhase: 'providers', // 📖 providers | tools | scope | models | result
    installEndpointsCursor: 0,    // 📖 Selected row within the current install phase
    installEndpointsScrollOffset: 0, // 📖 Vertical scroll offset for the install overlay viewport
    installEndpointsProviderKey: null, // 📖 Selected provider for endpoint installation
    installEndpointsToolMode: null, // 📖 Selected target tool mode
    installEndpointsConnectionMode: null, // 📖 Direct provider path retained for future install flow state.
    installEndpointsScope: null,  // 📖 all | selected
    installEndpointsSelectedModelIds: new Set(), // 📖 Multi-select buffer for the selected-models phase
    installEndpointsErrorMsg: null, // 📖 Temporary validation/error message inside the install flow
    installEndpointsResult: null, // 📖 Final install result shown in the result phase
    // 📖 Missing-tool bootstrap overlay — confirms a one-click install before retrying the launch.
    toolInstallPromptOpen: false,
    toolInstallPromptCursor: 0,
    toolInstallPromptScrollOffset: 0,
    toolInstallPromptMode: null,
    toolInstallPromptModel: null,
    toolInstallPromptPlan: null,
    toolInstallPromptErrorMsg: null,
    // 📖 Incompatible model fallback overlay — shown when user presses Enter on a red-highlighted model.
    // 📖 Offers two options: switch to a compatible tool, or pick a similar SWE-scored model.
    incompatibleFallbackOpen: false,
    incompatibleFallbackCursor: 0,
    incompatibleFallbackScrollOffset: 0,
    incompatibleFallbackModel: null,        // 📖 The incompatible model the user tried to launch
    incompatibleFallbackTools: [],           // 📖 Compatible tools for the selected model
    incompatibleFallbackSimilarModels: [],   // 📖 Similar SWE models compatible with current tool
    incompatibleFallbackSection: 'tools',    // 📖 'tools' or 'models' — which section cursor is in
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

    // 📖 OpenCode sync status (S key in settings)
    settingsSyncStatus: null,     // 📖 { type: 'success'|'error', msg: string } — shown in settings footer
    // 📖 Changelog overlay state (N key opens it)
    changelogOpen: false,         // 📖 Whether the changelog overlay is active
    changelogScrollOffset: 0,     // 📖 Vertical scroll offset for changelog overlay viewport
    changelogPhase: 'index',      // 📖 'index' (all versions) | 'details' (specific version)
    changelogCursor: 0,           // 📖 Selected row in index phase
    changelogSelectedVersion: null, // 📖 Which version to show details for
    // 📖 Installed Models overlay state (Command Palette → Installed models)
    installedModelsOpen: false,   // 📖 Whether the installed models overlay is active
    installedModelsCursor: 0,     // 📖 Selected row (tool or model)
    installedModelsScrollOffset: 0, // 📖 Vertical scroll offset for overlay viewport
    installedModelsData: [],       // 📖 Cached scan results
    installedModelsErrorMsg: null, // 📖 Error or status message
    // 📖 Router Dashboard overlay state (Shift+R opens it).
    routerDashboardOpen: false,
    routerDashboardStatus: 'idle', // 📖 idle | loading | ready | partial | stopped | stale | unreachable | malformed
    routerDashboardBaseUrl: null,
    routerDashboardPort: null,
    routerDashboardHealth: null,
    routerDashboardStats: null,
    routerDashboardError: null,
    routerDashboardScrollOffset: 0,
    routerDashboardEvents: [],
    routerDashboardLiveRequests: [],
    routerDashboardClearedAt: 0,
    routerDashboardLastUpdatedAt: null,
    routerDashboardLastRefreshStartedAt: null,
    routerDashboardPollTimer: null,
    routerDashboardEventAbort: null,
    routerDashboardEventStatus: 'idle',
    routerDashboardEventError: null,
    routerDashboardNotice: null,
    routerDashboardNoticeTimer: null,
    routerOnboardingScrollOffset: 0,
    routerDashboardEverOpened: false, // 📖 Set to true the first time dashboard opens (used for upgrade-path telemetry)
    // 📖 Custom text filter (Ctrl+P palette → type text → Enter). Ephemeral — not saved to config.
    customTextFilter: null,       // 📖 Active free-text filter string (null = off). Matches model name, ctx, provider key/name.
  }

  // 📖 Apply the pre-fetched last release date now that state is initialized
  state.lastReleaseDate = lastReleaseDate

  // 📖 Re-clamp viewport on terminal resize
  process.stdout.on('resize', () => {
    const prevCols = state.terminalCols
    state.terminalRows = process.stdout.rows || 24
    state.terminalCols = process.stdout.columns || 80
    if (state.terminalCols < WIDTH_WARNING_MIN_COLS) {
      if (prevCols >= WIDTH_WARNING_MIN_COLS || state.widthWarningDismissed) {
        state.widthWarningStartedAt = Date.now()
        state.widthWarningDismissed = false
      } else if (!state.widthWarningStartedAt) {
        state.widthWarningStartedAt = Date.now()
      }
    } else {
      state.widthWarningStartedAt = null
      state.widthWarningDismissed = false
    }
    adjustScrollOffset(state)
  })

  let ticker = null
  let onKeyPress = null
  let onMouseData = null  // 📖 Mouse data listener — set after createMouseEventHandler
  let pingModel = null

  const scheduleNextPing = () => {
    clearTimeout(state.pingIntervalObj)
    const elapsed = Date.now() - state.lastPingTime
    const delay = Math.max(0, state.pingInterval - elapsed)
    state.pingIntervalObj = setTimeout(runPingCycle, delay)
  }

  const setPingMode = (nextMode, source = 'manual') => {
    const modeInterval = PING_MODE_INTERVALS[nextMode] ?? PING_MODE_INTERVALS.normal
    state.pingMode = nextMode
    state.pingModeSource = source
    state.pingInterval = modeInterval
    state.speedModeUntil = nextMode === 'speed' ? Date.now() + SPEED_MODE_DURATION_MS : null
    state.resumeSpeedOnActivity = source === 'idle'
    if (state.pingIntervalObj) scheduleNextPing()
  }

  const noteUserActivity = () => {
    state.lastUserActivityAt = Date.now()
    if (state.pingMode === 'forced') return
    if (state.resumeSpeedOnActivity) {
      setPingMode('speed', 'activity')
    }
  }

  const refreshAutoPingMode = () => {
    const currentTime = Date.now()
    if (state.pingMode === 'forced') return

    if (state.speedModeUntil && currentTime >= state.speedModeUntil) {
      setPingMode('normal', 'auto')
      return
    }

    if (currentTime - state.lastUserActivityAt >= IDLE_SLOW_AFTER_MS) {
      if (state.pingMode !== 'slow' || state.pingModeSource !== 'idle') {
        setPingMode('slow', 'idle')
      } else {
        state.resumeSpeedOnActivity = true
      }
    }
  }

  // 📖 Load cache if available (for faster startup with cached ping results)
  const cached = loadCache()
  if (cached && cached.models) {
    // 📖 Apply cached values to results
    for (const r of state.results) {
      const cachedModel = cached.models[r.modelId]
      if (cachedModel) {
        r.avg = cachedModel.avg
        r.p95 = cachedModel.p95
        r.jitter = cachedModel.jitter
        r.stability = cachedModel.stability
        r.uptime = cachedModel.uptime
        r.verdict = cachedModel.verdict
        r.status = cachedModel.status
        r.httpCode = cachedModel.httpCode
        r.pings = cachedModel.pings || []
      }
    }
  }

  // 📖 Define pingModel before JSON mode so `--json` can reuse the same provider-aware
  // 📖 ping path as the interactive TUI without waiting for the PTY/render loop setup.
  pingModel = async (r) => {
    state.pendingPings += 1
    r.isPinging = true

    try {
      const providerApiKey = getApiKey(state.config, r.providerKey) ?? null
      const providerUrl = sources[r.providerKey]?.url ?? sources.nvidia.url
      let { code, ms, quotaPercent } = await ping(providerApiKey, r.modelId, r.providerKey, providerUrl)

      if ((quotaPercent === null || quotaPercent === undefined) && providerApiKey) {
        const providerQuota = await getProviderQuotaPercentCached(r.providerKey, providerApiKey)
        if (typeof providerQuota === 'number' && Number.isFinite(providerQuota)) {
          quotaPercent = providerQuota
        }
      }

      r.pings.push({ ms, code })

      if (code === '200') {
        r.status = 'up'
      } else if (code === '000') {
        r.status = 'timeout'
      } else if (code === '401' || code === '403') {
        r.status = providerApiKey ? 'auth_error' : 'noauth'
        r.httpCode = code
      } else {
        r.status = 'down'
        r.httpCode = code
      }

      if (typeof quotaPercent === 'number' && Number.isFinite(quotaPercent)) {
        r.usagePercent = quotaPercent
        for (const sibling of state.results) {
          if (sibling.providerKey === r.providerKey && (sibling.usagePercent === undefined || sibling.usagePercent === null)) {
            sibling.usagePercent = quotaPercent
          }
        }
      }
    } finally {
      r.isPinging = false
      state.pendingPings = Math.max(0, state.pendingPings - 1)
    }
  }

  // 📖 JSON output mode: skip TUI, output results as JSON after initial pings
  if (cliArgs.jsonMode) {
    console.log(chalk.cyan('  ⚡ Pinging models for JSON output...'))
    console.log()

    // 📖 Run initial pings
    const initialPing = Promise.all(state.results.map(r => pingModel(r)))
    await initialPing

    // 📖 Calculate final stats
    state.results.forEach(r => {
      r.avg = getAvg(r)
      r.p95 = getP95(r)
      r.jitter = getJitter(r)
      r.stability = getStabilityScore(r)
      r.uptime = getUptime(r)
      r.verdict = getVerdict(r)
    })

    // 📖 Apply tier filter if specified
    let outputResults = state.results
    if (cliArgs.tierFilter) {
      const filteredTier = TIER_LETTER_MAP[cliArgs.tierFilter]
      if (filteredTier) {
        outputResults = state.results.filter(r => filteredTier.includes(r.tier))
      }
    }

    // 📖 Apply best mode filter if specified
    if (cliArgs.bestMode) {
      outputResults = outputResults.filter(r => ['S+', 'S', 'A+'].includes(r.tier))
    }

    // 📖 Apply premium mode as a preselected tier family in JSON mode as well.
    if (cliArgs.premiumMode) {
      const premiumTiers = TIER_LETTER_MAP.S || ['S+', 'S']
      outputResults = outputResults.filter(r => premiumTiers.includes(r.tier))
    }

    // 📖 Sort by avg ping (ascending)
    outputResults = sortResults(outputResults, 'avg', 'asc')

    // 📖 Output JSON
    console.log(formatResultsAsJSON(outputResults))

    // 📖 Save cache before exiting
    saveCache(state.results, state.pingMode)

    process.exit(0)
  }

  // 📖 Enter alternate screen — animation runs here, zero scrollback pollution
  process.stdout.write(ALT_ENTER)
  if (process.stdout.isTTY) {
    process.stdout.flush && process.stdout.flush()
  }

  // 📖 Ensure we always leave alt screen cleanly (Ctrl+C, crash, normal exit)
  const exit = (code = 0) => {
    saveCache(state.results, state.pingMode)
    clearInterval(ticker)
    clearTimeout(state.pingIntervalObj)
    clearInterval(state.versionRecheckTimer)
    stopRouterDashboardClient(state)
    process.stdout.write(ALT_LEAVE)
    if (process.stdout.isTTY) {
      process.stdout.flush && process.stdout.flush()
    }
    process.exit(code)
  }
  process.on('SIGINT',  () => exit(0))
  process.on('SIGTERM', () => exit(0))

  // 📖 originFilterMode: index into ORIGIN_CYCLE, 0=All, then each provider key in order
  const ORIGIN_CYCLE = [null, ...Object.keys(sources)]
  const resolvedTierFilter = config.settings?.tierFilter
  state.tierFilterMode = resolvedTierFilter ? Math.max(0, TIER_CYCLE.indexOf(resolvedTierFilter)) : 0
  const resolvedOriginFilter = config.settings?.originFilter
  state.originFilterMode = resolvedOriginFilter ? Math.max(0, ORIGIN_CYCLE.indexOf(resolvedOriginFilter)) : 0

  function applyTierFilter() {
    const activeTier = TIER_CYCLE[state.tierFilterMode]
    const activeOrigin = ORIGIN_CYCLE[state.originFilterMode]
    const activeVerdict = VERDICT_CYCLE[state.verdictFilterMode]
    const activeHealth = HEALTH_CYCLE[state.healthFilterMode]
    state.results.forEach(r => {
      // 📖 Sticky-favorites mode keeps favorites visible regardless of configured-only, tier, or provider filters.
      if (state.favoritesPinnedAndSticky && r.isFavorite) {
        r.hidden = false
        return
      }
      // 📖 CLI-only tools (rovo, gemini) and Zen models don't need traditional API keys —
      // 📖 they authenticate via their own CLI login flow, so "configured only" should never hide them.
      const providerMeta = PROVIDER_METADATA[r.providerKey]
      const noKeyNeeded = providerMeta?.cliOnly || providerMeta?.zenOnly
      const unconfiguredHide = state.hideUnconfiguredModels && !noKeyNeeded && !getApiKey(state.config, r.providerKey)
      if (unconfiguredHide) {
        r.hidden = true
        return
      }
      // 📖 Apply tier, origin, verdict, and health filters — model is hidden if it fails any
      const allowedTiers = (activeTier && TIER_LETTER_MAP[activeTier]) ? TIER_LETTER_MAP[activeTier] : [activeTier]
      const tierHide = activeTier !== null && !allowedTiers.includes(r.tier)
      const originHide = activeOrigin !== null && r.providerKey !== activeOrigin
      // 📖 Verdict filter: match against getVerdict(r) when active
      const rVerdict = getVerdict(r)
      const verdictHide = activeVerdict !== null && rVerdict !== activeVerdict
      // 📖 Health filter: match against r.status when active
      const healthHide = activeHealth !== null && r.status !== activeHealth
      if (tierHide || originHide || verdictHide || healthHide) {
        r.hidden = true
        return
      }
      // 📖 Custom text filter — case-insensitive includes match against model name, ctx, provider key, and provider display name.
      if (state.customTextFilter) {
        const q = state.customTextFilter.toLowerCase()
        const providerName = (sources[r.providerKey]?.name || '').toLowerCase()
        const match = (r.label || '').toLowerCase().includes(q)
          || (r.ctx || '').toLowerCase().includes(q)
          || (r.providerKey || '').toLowerCase().includes(q)
          || providerName.includes(q)
        r.hidden = !match
        return
      }
      r.hidden = false
    })
    return state.results
  }

  // 📖 Apply initial filters so configured-only mode works on first render
  applyTierFilter()

  // ─── Overlay renderers + key handler ─────────────────────────────────────
  const stopUi = ({ resetRawMode = false } = {}) => {
    if (ticker) clearInterval(ticker)
    clearTimeout(state.pingIntervalObj)
    clearInterval(state.versionRecheckTimer)
    stopRouterDashboardClient(state)
    if (onKeyPress) process.stdin.removeListener('keypress', onKeyPress)
    if (onMouseData) process.stdin.removeListener('data', onMouseData)
    if (process.stdin.isTTY && resetRawMode) process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write(ALT_LEAVE)
    if (process.stdout.isTTY) {
      process.stdout.flush && process.stdout.flush()
    }
  }

  const overlays = createOverlayRenderers(state, {
    chalk,
    sources,
    PROVIDER_METADATA,
    PROVIDER_COLOR,
    LOCAL_VERSION,
    getApiKey,
    resolveApiKeys,
    isProviderEnabled,
    TIER_CYCLE,
    SETTINGS_OVERLAY_BG,
    HELP_OVERLAY_BG,
    RECOMMEND_OVERLAY_BG,
    OVERLAY_PANEL_WIDTH,
    keepOverlayTargetVisible,
    sliceOverlayLines,
    tintOverlayLines,
    TASK_TYPES,
    PRIORITY_TYPES,
    CONTEXT_BUDGETS,
    FRAMES,
    TIER_COLOR,
    getAvg,
    getStabilityScore,
    toFavoriteKey,
    getTopRecommendations,
    adjustScrollOffset,
    getPingModel: () => pingModel,
    getConfiguredInstallableProviders,
    getInstallTargetModes,
    getProviderCatalogModels,
    getToolMeta,
    getToolInstallPlan,
    padEndDisplay,
    displayWidth,
  })

  onKeyPress = createKeyHandler({
    state,
    exit,
    cliArgs,
    MODELS,
    sources,
    getApiKey,
    resolveApiKeys,
    addApiKey,
    removeApiKey,
    persistApiKeysForProvider,
    isProviderEnabled,
    saveConfig,
    getConfiguredInstallableProviders,
    getInstallTargetModes,
    getProviderCatalogModels,
    installProviderEndpoints,
    syncFavoriteFlags,
    toggleFavoriteModel,
    reorderFavorite,
    sortResultsWithPinnedFavorites,
    adjustScrollOffset,
    applyTierFilter,
    PING_INTERVAL,
    TIER_CYCLE,
    ORIGIN_CYCLE,
    ENV_VAR_NAMES,
    checkForUpdateDetailed,
    runUpdate,
    startOpenClaw,
    startOpenCodeDesktop,
    startOpenCodeWeb,
    startKilo,
    startOpenCode,
    startExternalTool,
    getToolModeOrder,
    getToolMeta,
    getToolInstallPlan,
    isToolInstalled,
    installToolWithPlan,
    sendUsageTelemetry,
    startRecommendAnalysis: overlays.startRecommendAnalysis,
    stopRecommendAnalysis: overlays.stopRecommendAnalysis,
    stopUi,
    ping,
    TASK_TYPES,
    PRIORITY_TYPES,
    CONTEXT_BUDGETS,
    toFavoriteKey,
    mergedModels,
    chalk,
    setPingMode,
    noteUserActivity,
    intervalToPingMode,
    PING_MODE_CYCLE,
    setResults: (next) => { results = next },
    readline,
  })

  // 📖 Mouse event handler: translates parsed mouse events into TUI actions (sort, cursor, scroll).
  const onMouseEvent = createMouseEventHandler({
    state,
    adjustScrollOffset,
    applyTierFilter,
    TIER_CYCLE,
    ORIGIN_CYCLE,
    noteUserActivity,
    sortResultsWithPinnedFavorites,
    saveConfig,
    overlayLayout: overlays.overlayLayout, // 📖 Overlay cursor-to-line maps for click handling
    // 📖 Favorite toggle — right-click on model rows
    toggleFavoriteModel,
    syncFavoriteFlags,
    toFavoriteKey,
    // 📖 Tool mode cycling — compat header click
    cycleToolMode: () => {
      // 📖 Inline cycle matching the Z-key handler in createKeyHandler
      const modeOrder = getToolModeOrder()
      const currentIndex = modeOrder.indexOf(state.mode)
      const nextIndex = (currentIndex + 1) % modeOrder.length
      state.mode = modeOrder[nextIndex]
      if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
      state.config.settings.preferredToolMode = state.mode
      saveConfig(state.config)
    },
  })

  // 📖 Wire the raw stdin data listener for mouse events.
  // 📖 createMouseHandler returns a function that parses SGR sequences and calls onMouseEvent.
  onMouseData = createMouseHandler({ onMouseEvent })

  // Apply CLI --tier filter if provided
  if (cliArgs.tierFilter) {
    const allowed = TIER_LETTER_MAP[cliArgs.tierFilter]
    state.results.forEach(r => {
      r.hidden = (state.favoritesPinnedAndSticky && r.isFavorite) ? false : !allowed.includes(r.tier)
    })
  }

  // 📖 Setup keyboard input for interactive selection during pings
  // 📖 Use readline with keypress event for arrow key handling
  process.stdin.setEncoding('utf8')
  process.stdin.resume()

  let userSelected = null

  // 📖 Enable keypress events on stdin
  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  // 📖 Mouse sequence suppression: readline.emitKeypressEvents() registers its own
  // 📖 internal `data` listener that parses bytes and fires `keypress` events.
  // 📖 When a mouse SGR sequence like \x1b[<0;35;20m arrives, readline fragments it
  // 📖 and emits individual keypress events for chars like 'm', '0', ';' etc.
  // 📖 The 'm' at the end of a release event maps to the Model sort hotkey!
  // 📖
  // 📖 Fix: use prependListener to register a `data` handler BEFORE readline's,
  // 📖 so we can set a suppression flag before any keypress events fire.
  // 📖 The flag is cleared on the next tick via setImmediate after all synchronous
  // 📖 keypress emissions from readline have completed.
  let _suppressMouseKeypresses = false

  process.stdin.prependListener('data', (data) => {
    const str = typeof data === 'string' ? data : data.toString('utf8')
    if (str.includes('\x1b[<')) {
      _suppressMouseKeypresses = true
      // 📖 Reset after current tick — all synchronous keypress events from this data
      // 📖 chunk will have fired by then.
      setImmediate(() => { _suppressMouseKeypresses = false })
    }
  })

  process.stdin.on('keypress', async (str, key) => {
    try {
      // 📖 Skip keypress events that originate from mouse escape sequences.
      // 📖 readline may partially parse SGR mouse sequences as garbage keypresses.
      if (str && containsMouseSequence(str)) return
      // 📖 Suppress fragmented mouse bytes that readline emits as individual keypresses.
      if (_suppressMouseKeypresses) return
      await onKeyPress(str, key);
    } catch (err) {
      process.stdout.write(ALT_LEAVE);
      console.error(chalk.red('\n[TUI Error] An error occurred while handling a keypress.'));
      console.error(err);
      console.error(chalk.yellow('\nPlease file an issue at https://github.com/vava-nessa/free-coding-models/issues or join the Discord to report this to the author.'));
      process.exit(1);
    }
  })

  // 📖 Mouse data listener: parses SGR mouse escape sequences from raw stdin
  // 📖 and dispatches structured events (click, scroll, double-click) to the mouse handler.
  process.stdin.on('data', (data) => {
    try {
      if (onMouseData) onMouseData(data)
    } catch (err) {
      // 📖 Mouse errors are non-fatal — log and continue so the TUI doesn't crash.
      // 📖 This could happen on terminals that send unexpected mouse sequences.
    }
  })

  process.on('SIGCONT', noteUserActivity)

  // 📖 Animation loop: render settings overlay, recommend overlay, help overlay, feature request overlay, bug report overlay, changelog overlay, OR main table
  ticker = setInterval(() => {
    try {
    refreshAutoPingMode()
    state.frame++
    // 📖 Cache visible+sorted models each frame so Enter handler always matches the display
    if (!state.settingsOpen && !state.installEndpointsOpen && !state.toolInstallPromptOpen && !state.incompatibleFallbackOpen && !state.recommendOpen && !state.changelogOpen && !state.installedModelsOpen && !state.routerDashboardOpen && !state.commandPaletteOpen) {
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection, {
        pinFavorites: state.favoritesPinnedAndSticky,
      })
    }
    const tableTerminalRows = state.terminalRows

    let tableContent = null
    if (state.commandPaletteOpen) {
      if (!state.commandPaletteFrozenTable) {
        // 📖 Freeze the full table (including countdown and spinner glyphs) while
        // 📖 the command palette is open so the background remains perfectly static.
        state.commandPaletteFrozenTable = renderTable(
          state.results,
          state.pendingPings,
          state.frame,
          state.cursor,
          state.sortColumn,
          state.sortDirection,
          state.pingInterval,
          state.lastPingTime,
          state.mode,
          state.tierFilterMode,
          state.scrollOffset,
          tableTerminalRows,
          state.terminalCols,
          state.originFilterMode,
          null,
          state.pingMode,
          state.pingModeSource,
          state.hideUnconfiguredModels,
          state.widthWarningStartedAt,
          state.widthWarningDismissed,
          state.widthWarningShowCount,
          state.settingsUpdateState,
          state.settingsUpdateLatestVersion,
          false,
          state.startupLatestVersion,
          state.versionAlertsEnabled,
          state.favoritesPinnedAndSticky,
          state.customTextFilter,
          state.lastReleaseDate,
          false,
          state.verdictFilterMode,
          state.healthFilterMode
        )
      }
      tableContent = state.commandPaletteFrozenTable
    } else {
      state.commandPaletteFrozenTable = null
      tableContent = renderTable(
        state.results,
        state.pendingPings,
        state.frame,
        state.cursor,
        state.sortColumn,
        state.sortDirection,
        state.pingInterval,
        state.lastPingTime,
        state.mode,
        state.tierFilterMode,
        state.scrollOffset,
        tableTerminalRows,
        state.terminalCols,
        state.originFilterMode,
        null,
        state.pingMode,
        state.pingModeSource,
        state.hideUnconfiguredModels,
        state.widthWarningStartedAt,
        state.widthWarningDismissed,
        state.widthWarningShowCount,
        state.settingsUpdateState,
        state.settingsUpdateLatestVersion,
        false,
        state.startupLatestVersion,
        state.versionAlertsEnabled,
        state.favoritesPinnedAndSticky,
        state.customTextFilter,
        state.lastReleaseDate,
        false,
        state.verdictFilterMode,
        state.healthFilterMode
      )
    }

    const content = state.settingsOpen
      ? overlays.renderSettings()
      : state.installEndpointsOpen
        ? overlays.renderInstallEndpoints()
      : state.toolInstallPromptOpen
        ? overlays.renderToolInstallPrompt()
      : state.installedModelsOpen
        ? overlays.renderInstalledModels()
      : state.routerDashboardOpen
        ? overlays.renderRouterDashboard()
      : state.tokenUsageOpen
        ? overlays.renderTokenUsage()
      : state.routerOnboardingOpen
        ? overlays.renderRouterOnboarding()
      : state.incompatibleFallbackOpen
        ? overlays.renderIncompatibleFallback()
      : state.commandPaletteOpen
        ? tableContent + overlays.renderCommandPalette()
      : state.recommendOpen
        ? overlays.renderRecommend()
        : state.helpVisible
                ? overlays.renderHelp()
              : state.changelogOpen
                ? overlays.renderChangelog()
                 : tableContent
    process.stdout.write(ALT_HOME + content)
    if (process.stdout.isTTY) {
      process.stdout.flush && process.stdout.flush()
    }
    } catch (err) {
      process.stdout.write(ALT_LEAVE);
      console.error(chalk.red('\n[TUI Render Error] An error occurred during UI rendering.'));
      console.error(err);
      console.error(chalk.yellow('\nPlease file an issue at https://github.com/vava-nessa/free-coding-models/issues or join the Discord to report this to the author.'));
      process.exit(1);
    }
  }, Math.round(1000 / FPS))

  // 📖 Populate visibleSorted before the first frame so Enter works immediately
  const initialVisible = state.results.filter(r => !r.hidden)
  state.visibleSorted = sortResultsWithPinnedFavorites(initialVisible, state.sortColumn, state.sortDirection, {
    pinFavorites: state.favoritesPinnedAndSticky,
  })

      process.stdout.write(ALT_HOME + renderTable(state.results, state.pendingPings, state.frame, state.cursor, state.sortColumn, state.sortDirection, state.pingInterval, state.lastPingTime, state.mode, state.tierFilterMode, state.scrollOffset, state.terminalRows, state.terminalCols, state.originFilterMode, null, state.pingMode, state.pingModeSource, state.hideUnconfiguredModels, state.widthWarningStartedAt, state.widthWarningDismissed, state.widthWarningShowCount, state.settingsUpdateState, state.settingsUpdateLatestVersion, false, state.startupLatestVersion, state.versionAlertsEnabled, state.favoritesPinnedAndSticky, state.customTextFilter, state.lastReleaseDate, false, state.verdictFilterMode, state.healthFilterMode))
  if (process.stdout.isTTY) {
    process.stdout.flush && process.stdout.flush()
  }

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

  // 📖 Initial ping of all models
  const initialPing = Promise.all(state.results.map(r => pingModel(r)))

  // 📖 Continuous ping loop with mode-driven cadence.
  const runPingCycle = async () => {
    try {
    refreshAutoPingMode()

    // 📖 Command palette intentionally pauses background ping bursts to avoid
    // 📖 visible row jitter while users type and navigate commands.
    if (state.commandPaletteOpen) {
      state.lastPingTime = Date.now()
      scheduleNextPing()
      return
    }

    state.lastPingTime = Date.now()

    // 📖 Refresh persisted usage snapshots each cycle so background usage data appears live in table.
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

    refreshAutoPingMode()
    scheduleNextPing()
    } catch (err) {
      process.stdout.write(ALT_LEAVE);
      console.error(chalk.red('\n[TUI Error] An error occurred in the ping loop.'));
      console.error(err);
      console.error(chalk.yellow('\nPlease file an issue at https://github.com/vava-nessa/free-coding-models/issues or join the Discord to report this to the author.'));
      process.exit(1);
    }
  }

  // 📖 Start the ping loop
  state.pingIntervalObj = null
  scheduleNextPing()

  await initialPing

  // 📖 Save cache after initial pings complete for faster next startup
  saveCache(state.results, state.pingMode)

  // 📖 Background version re-check: poll npm registry every 5 minutes.
  // 📖 If a new version appears (wasn't there at startup), update the banner live.
  const VERSION_RECHECK_INTERVAL_MS = 5 * 60 * 1000
  state.versionRecheckTimer = setInterval(async () => {
    if (isDevMode || !state.versionAlertsEnabled) return
    try {
      const fresh = await checkForUpdate()
      if (fresh) {
        state.startupLatestVersion = fresh
      }
    } catch {}
  }, VERSION_RECHECK_INTERVAL_MS)

  // 📖 Router ON by default — no onboarding prompt, just auto-enable silently.
  const routerCfg = state.config?.router
  if (!routerCfg || routerCfg.onboardingSeen !== true || routerCfg.enabled !== true) {
    if (!state.config.router) state.config.router = {}
    state.config.router.enabled = true
    state.config.router.onboardingSeen = true
    saveConfig(state.config)
  }

  // 📖 Keep interface running forever - user can select anytime or Ctrl+C to exit
  // 📖 The pings continue running in background with dynamic interval
  // 📖 User can press W to decrease interval (faster pings) or = to increase (slower)
  // 📖 Current interval shown in header: "next ping Xs"
}
