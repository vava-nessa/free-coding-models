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
 *   - Multi-provider support via sources.js (NIM/Groq/Cerebras/OpenRouter/Hugging Face/Replicate/DeepInfra/... — extensible)
 *   - Settings screen (P key) to manage API keys, provider toggles, manual updates, and provider-key diagnostics
 *   - Install Endpoints flow (Y key) to push provider catalogs into OpenCode, OpenClaw, Crush, and Goose
 *   - Favorites system: toggle with F, pin rows to top, persist between sessions
 *   - Uptime percentage tracking (successful pings / total pings)
 *   - Sortable columns (R/O/M/L/A/S/C/H/V/B/U/G keys)
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
 *   - Ping cadence: 2s startup burst for 60s, 10s steady state, 30s after 5m idle, forced 4s via `W`
 *   - Animation: 12 FPS with braille spinners
 *
 *   🚀 CLI flags:
 *   - (no flag): Start in OpenCode CLI mode
 *   - --opencode: OpenCode CLI mode (launch CLI with selected model)
 *   - --opencode-desktop: OpenCode Desktop mode (set model & open Desktop app)
 *   - --openclaw: OpenClaw mode (set selected model as default in OpenClaw)
 *   - --crush / --goose: launch the currently selected model in the supported external CLI
 *   - --best: Show only top-tier models (A+, S, S+)
 *   - --fiable: Analyze 10s and output the most reliable model
 *   - --json: Output results as JSON (for scripting/automation)
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
import { MODELS, sources } from '../sources.js'
import { getAvg, getVerdict, getUptime, getP95, getJitter, getStabilityScore, sortResults, filterByTier, findBestModel, parseArgs, TIER_ORDER, VERDICT_ORDER, TIER_LETTER_MAP, scoreModelForTask, getTopRecommendations, TASK_TYPES, PRIORITY_TYPES, CONTEXT_BUDGETS, formatCtxWindow, labelFromId, getProxyStatusInfo, formatResultsAsJSON } from '../src/utils.js'
import { loadConfig, saveConfig, getApiKey, getProxySettings, resolveApiKeys, addApiKey, removeApiKey, isProviderEnabled, saveAsProfile, loadProfile, listProfiles, deleteProfile, getActiveProfileName, setActiveProfile, _emptyProfileSettings } from '../src/config.js'
import { buildMergedModels } from '../src/model-merger.js'
import { ProxyServer } from '../src/proxy-server.js'
import { loadOpenCodeConfig, saveOpenCodeConfig, syncToOpenCode, restoreOpenCodeBackup, cleanupOpenCodeProxyConfig } from '../src/opencode-sync.js'
import { usageForRow as _usageForRow } from '../src/usage-reader.js'
import { loadRecentLogs } from '../src/log-reader.js'
import { buildProviderModelTokenKey, loadTokenUsageByProviderModel } from '../src/token-usage-reader.js'
import { parseOpenRouterResponse, fetchProviderQuota as _fetchProviderQuotaFromModule } from '../src/provider-quota-fetchers.js'
import { isKnownQuotaTelemetry } from '../src/quota-capabilities.js'
import { ALT_ENTER, ALT_LEAVE, ALT_HOME, PING_TIMEOUT, PING_INTERVAL, FPS, COL_MODEL, COL_MS, CELL_W, FRAMES, TIER_CYCLE, SETTINGS_OVERLAY_BG, HELP_OVERLAY_BG, RECOMMEND_OVERLAY_BG, LOG_OVERLAY_BG, OVERLAY_PANEL_WIDTH, TABLE_HEADER_LINES, TABLE_FOOTER_LINES, TABLE_FIXED_LINES, msCell, spinCell } from '../src/constants.js'
import { TIER_COLOR } from '../src/tier-colors.js'
import { resolveCloudflareUrl, buildPingRequest, ping, extractQuotaPercent, getProviderQuotaPercentCached, usagePlaceholderForProvider } from '../src/ping.js'
import { runFiableMode, filterByTierOrExit, fetchOpenRouterFreeModels } from '../src/analysis.js'
import { PROVIDER_METADATA, ENV_VAR_NAMES, isWindows, isMac } from '../src/provider-metadata.js'
import { parseTelemetryEnv, isTelemetryDebugEnabled, telemetryDebug, ensureTelemetryConfig, getTelemetryDistinctId, getTelemetrySystem, getTelemetryTerminal, isTelemetryEnabled, sendUsageTelemetry, sendFeatureRequest, sendBugReport } from '../src/telemetry.js'
import { ensureFavoritesConfig, toFavoriteKey, syncFavoriteFlags, toggleFavoriteModel } from '../src/favorites.js'
import { checkForUpdateDetailed, checkForUpdate, runUpdate, promptUpdateNotification } from '../src/updater.js'
import { promptApiKey } from '../src/setup.js'
import { stripAnsi, maskApiKey, displayWidth, padEndDisplay, tintOverlayLines, keepOverlayTargetVisible, sliceOverlayLines, calculateViewport, sortResultsWithPinnedFavorites, renderProxyStatusLine, adjustScrollOffset } from '../src/render-helpers.js'
import { renderTable, PROVIDER_COLOR } from '../src/render-table.js'
import { setOpenCodeModelData, startOpenCode, startOpenCodeDesktop, startProxyAndLaunch, autoStartProxyIfSynced, ensureProxyRunning, buildProxyTopologyFromConfig, isProxyEnabledForConfig } from '../src/opencode.js'
import { startOpenClaw } from '../src/openclaw.js'
import { createOverlayRenderers } from '../src/overlays.js'
import { createKeyHandler } from '../src/key-handler.js'
import { getToolModeOrder } from '../src/tool-metadata.js'
import { startExternalTool } from '../src/tool-launchers.js'
import { getConfiguredInstallableProviders, installProviderEndpoints, refreshInstalledEndpoints, getInstallTargetModes, getProviderCatalogModels } from '../src/endpoint-installer.js'
import { loadCache, saveCache, clearCache, getCacheAge } from '../src/cache.js'
import { checkConfigSecurity } from '../src/security.js'

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

// 📖 sendFeatureRequest, sendBugReport → imported from ../src/telemetry.js

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

  // 📖 Check config file security — warn and offer auto-fix if permissions are too open
  const securityCheck = checkConfigSecurity()
  if (!securityCheck.wasSecure && !securityCheck.wasFixed) {
    // 📖 User declined auto-fix or it failed — continue anyway, just warned
  }

  if (cliArgs.cleanProxyMode) {
    const cleaned = cleanupOpenCodeProxyConfig()
    console.log()
    console.log(chalk.green('  ✅ OpenCode proxy cleanup complete'))
    console.log(chalk.dim(`  Config: ${cleaned.path}`))
    console.log(chalk.dim(`  Removed provider: ${cleaned.removedProvider ? 'yes' : 'no'}  •  Removed default model: ${cleaned.removedModel ? 'yes' : 'no'}`))
    console.log()
    process.exit(0)
  }

  // 📖 If --profile <name> was passed, load that profile into the live config
  let startupProfileSettings = null
  if (cliArgs.profileName) {
    startupProfileSettings = loadProfile(config, cliArgs.profileName)
    if (!startupProfileSettings) {
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

  // 📖 Default mode: use the last persisted launcher choice when valid,
  // 📖 otherwise fall back to OpenCode CLI.
  let mode = getToolModeOrder().includes(config.settings?.preferredToolMode)
    ? config.settings.preferredToolMode
    : 'opencode'
  const requestedMode = getToolModeOrder().find((toolMode) => {
    const flagByMode = {
      opencode: cliArgs.openCodeMode,
      'opencode-desktop': cliArgs.openCodeDesktopMode,
      openclaw: cliArgs.openClawMode,
      aider: cliArgs.aiderMode,
      crush: cliArgs.crushMode,
      goose: cliArgs.gooseMode,
      'claude-code': cliArgs.claudeCodeMode,
      codex: cliArgs.codexMode,
      gemini: cliArgs.geminiMode,
      qwen: cliArgs.qwenMode,
      openhands: cliArgs.openHandsMode,
      amp: cliArgs.ampMode,
      pi: cliArgs.piMode,
    }
    return flagByMode[toolMode] === true
  })
  if (requestedMode) mode = requestedMode

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

  // 📖 Re-sync tracked external-tool catalogs after the live provider catalog has settled.
  // 📖 This keeps prior `Y` installs aligned with the current FCM model list.
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
    sortColumn: startupProfileSettings?.sortColumn || 'avg',
    sortDirection: startupProfileSettings?.sortAsc === false ? 'desc' : 'asc',
    pingInterval: PING_MODE_INTERVALS.speed, // 📖 Effective live interval derived from the active ping mode.
    pingMode: 'speed',            // 📖 Current ping mode: speed | normal | slow | forced.
    pingModeSource: 'startup',    // 📖 Why this mode is active: startup | manual | auto | idle | activity.
    speedModeUntil: now + SPEED_MODE_DURATION_MS, // 📖 Speed bursts auto-fall back to normal after 60 seconds.
    lastPingTime: now,            // 📖 Track when last ping cycle started
    lastUserActivityAt: now,      // 📖 Any keypress refreshes this timer; inactivity can force slow mode.
    resumeSpeedOnActivity: false, // 📖 Set after idle slowdown so the next activity restarts a 60s speed burst.
    mode,                         // 📖 'opencode' or 'openclaw' — controls Enter action
    tierFilterMode: 0,            // 📖 Index into TIER_CYCLE (0=All, 1=S+, 2=S, ...)
    originFilterMode: 0,          // 📖 Index into ORIGIN_CYCLE (0=All, then providers)
    hideUnconfiguredModels: startupProfileSettings?.hideUnconfiguredModels === true || config.settings?.hideUnconfiguredModels === true, // 📖 Hide providers with no configured API key when true.
    scrollOffset: 0,              // 📖 First visible model index in viewport
    terminalRows: process.stdout.rows || 24,  // 📖 Current terminal height
    terminalCols: process.stdout.columns || 80, // 📖 Current terminal width
    widthWarningStartedAt: (process.stdout.columns || 80) < 166 ? now : null, // 📖 Start the narrow-terminal countdown immediately when booting in a small viewport.
    widthWarningDismissed: false, // 📖 Esc hides the narrow-terminal warning early for the current narrow-width session.
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
    settingsProxyPortEditMode: false, // 📖 Whether Settings is editing the preferred proxy port field.
    settingsProxyPortBuffer: '',  // 📖 Inline input buffer for the preferred proxy port (0 = auto).
    config,                       // 📖 Live reference to the config object (updated on save)
    visibleSorted: [],            // 📖 Cached visible+sorted models — shared between render loop and key handlers
    helpVisible: false,           // 📖 Whether the help overlay (K key) is active
    settingsScrollOffset: 0,      // 📖 Vertical scroll offset for Settings overlay viewport
    helpScrollOffset: 0,          // 📖 Vertical scroll offset for Help overlay viewport
    // 📖 Install Endpoints overlay state (Y key opens it)
    installEndpointsOpen: false,  // 📖 Whether the install-endpoints overlay is active
    installEndpointsPhase: 'providers', // 📖 providers | tools | scope | models | result
    installEndpointsCursor: 0,    // 📖 Selected row within the current install phase
    installEndpointsScrollOffset: 0, // 📖 Vertical scroll offset for the install overlay viewport
    installEndpointsProviderKey: null, // 📖 Selected provider for endpoint installation
    installEndpointsToolMode: null, // 📖 Selected target tool mode
    installEndpointsScope: null,  // 📖 all | selected
    installEndpointsSelectedModelIds: new Set(), // 📖 Multi-select buffer for the selected-models phase
    installEndpointsErrorMsg: null, // 📖 Temporary validation/error message inside the install flow
    installEndpointsResult: null, // 📖 Final install result shown in the result phase
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
    const prevCols = state.terminalCols
    state.terminalRows = process.stdout.rows || 24
    state.terminalCols = process.stdout.columns || 80
    if (state.terminalCols < 166) {
      if (prevCols >= 166 || state.widthWarningDismissed) {
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

  // 📖 Auto-start proxy on launch if OpenCode config already has an fcm-proxy provider.
  // 📖 Fire-and-forget: does not block UI startup. state.proxyStartupStatus is updated async.
  if (mode === 'opencode' || mode === 'opencode-desktop') {
    void autoStartProxyIfSynced(config, state)
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

  // 📖 Ensure we always leave alt screen cleanly (Ctrl+C, crash, normal exit)
  const exit = (code = 0) => {
    // 📖 Save cache before exiting so next run starts faster
    saveCache(state.results, state.pingMode)
    clearInterval(ticker)
    clearTimeout(state.pingIntervalObj)
    process.stdout.write(ALT_LEAVE)
    process.exit(code)
  }
  process.on('SIGINT',  () => exit(0))
  process.on('SIGTERM', () => exit(0))

  // 📖 originFilterMode: index into ORIGIN_CYCLE, 0=All, then each provider key in order
  const ORIGIN_CYCLE = [null, ...Object.keys(sources)]
  state.tierFilterMode = startupProfileSettings?.tierFilter ? Math.max(0, TIER_CYCLE.indexOf(startupProfileSettings.tierFilter)) : 0
  state.originFilterMode = 0

  function applyTierFilter() {
    const activeTier = TIER_CYCLE[state.tierFilterMode]
    const activeOrigin = ORIGIN_CYCLE[state.originFilterMode]
    state.results.forEach(r => {
      const unconfiguredHide = state.hideUnconfiguredModels && !getApiKey(state.config, r.providerKey)
      if (unconfiguredHide) {
        r.hidden = true
        return
      }
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

  // 📖 Apply initial filters so configured-only mode works on first render
  applyTierFilter()

  // ─── Overlay renderers + key handler ─────────────────────────────────────
  const stopUi = ({ resetRawMode = false } = {}) => {
    if (ticker) clearInterval(ticker)
    clearTimeout(state.pingIntervalObj)
    if (onKeyPress) process.stdin.removeListener('keypress', onKeyPress)
    if (process.stdin.isTTY && resetRawMode) process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write(ALT_LEAVE)
  }

  const overlays = createOverlayRenderers(state, {
    chalk,
    sources,
    PROVIDER_METADATA,
    PROVIDER_COLOR,
    LOCAL_VERSION,
    getApiKey,
    getProxySettings,
    resolveApiKeys,
    isProviderEnabled,
    listProfiles,
    TIER_CYCLE,
    SETTINGS_OVERLAY_BG,
    HELP_OVERLAY_BG,
    RECOMMEND_OVERLAY_BG,
    LOG_OVERLAY_BG,
    OVERLAY_PANEL_WIDTH,
    keepOverlayTargetVisible,
    sliceOverlayLines,
    tintOverlayLines,
    loadRecentLogs,
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
  })

  onKeyPress = createKeyHandler({
    state,
    exit,
    cliArgs,
    MODELS,
    sources,
    getApiKey,
    getProxySettings,
    resolveApiKeys,
    addApiKey,
    removeApiKey,
    isProviderEnabled,
    listProfiles,
    loadProfile,
    deleteProfile,
    saveAsProfile,
    setActiveProfile,
    saveConfig,
    getConfiguredInstallableProviders,
    getInstallTargetModes,
    getProviderCatalogModels,
    installProviderEndpoints,
    syncFavoriteFlags,
    toggleFavoriteModel,
    sortResultsWithPinnedFavorites,
    adjustScrollOffset,
    applyTierFilter,
    PING_INTERVAL,
    TIER_CYCLE,
    ORIGIN_CYCLE,
    ENV_VAR_NAMES,
    ensureProxyRunning,
    syncToOpenCode,
    cleanupOpenCodeProxyConfig,
    restoreOpenCodeBackup,
    checkForUpdateDetailed,
    runUpdate,
    startOpenClaw,
    startOpenCodeDesktop,
    startOpenCode,
    startProxyAndLaunch,
    startExternalTool,
    buildProxyTopologyFromConfig,
    isProxyEnabledForConfig,
    getToolModeOrder,
    startRecommendAnalysis: overlays.startRecommendAnalysis,
    stopRecommendAnalysis: overlays.stopRecommendAnalysis,
    sendFeatureRequest,
    sendBugReport,
    stopUi,
    ping,
    TASK_TYPES,
    PRIORITY_TYPES,
    CONTEXT_BUDGETS,
    toFavoriteKey,
    mergedModels,
    apiKey,
    chalk,
    setPingMode,
    noteUserActivity,
    intervalToPingMode,
    PING_MODE_CYCLE,
    setResults: (next) => { results = next },
    readline,
  })

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

  // 📖 Enable keypress events on stdin
  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  process.stdin.on('keypress', onKeyPress)
  process.on('SIGCONT', noteUserActivity)

  // 📖 Animation loop: render settings overlay, recommend overlay, help overlay, feature request overlay, bug report overlay, OR main table
  ticker = setInterval(() => {
    refreshAutoPingMode()
    state.frame++
    // 📖 Cache visible+sorted models each frame so Enter handler always matches the display
    if (!state.settingsOpen && !state.installEndpointsOpen && !state.recommendOpen && !state.featureRequestOpen && !state.bugReportOpen) {
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
    }
    const content = state.settingsOpen
      ? overlays.renderSettings()
      : state.installEndpointsOpen
        ? overlays.renderInstallEndpoints()
      : state.recommendOpen
        ? overlays.renderRecommend()
        : state.featureRequestOpen
          ? overlays.renderFeatureRequest()
          : state.bugReportOpen
            ? overlays.renderBugReport()
              : state.helpVisible
                ? overlays.renderHelp()
              : state.logVisible
                ? overlays.renderLog()
                : renderTable(state.results, state.pendingPings, state.frame, state.cursor, state.sortColumn, state.sortDirection, state.pingInterval, state.lastPingTime, state.mode, state.tierFilterMode, state.scrollOffset, state.terminalRows, state.terminalCols, state.originFilterMode, state.activeProfile, state.profileSaveMode, state.profileSaveBuffer, state.proxyStartupStatus, state.pingMode, state.pingModeSource, state.hideUnconfiguredModels, state.widthWarningStartedAt, state.widthWarningDismissed, state.settingsUpdateState, state.settingsUpdateLatestVersion, getProxySettings(state.config).enabled === true)
    process.stdout.write(ALT_HOME + content)
  }, Math.round(1000 / FPS))

  // 📖 Populate visibleSorted before the first frame so Enter works immediately
  const initialVisible = state.results.filter(r => !r.hidden)
  state.visibleSorted = sortResultsWithPinnedFavorites(initialVisible, state.sortColumn, state.sortDirection)

  process.stdout.write(ALT_HOME + renderTable(state.results, state.pendingPings, state.frame, state.cursor, state.sortColumn, state.sortDirection, state.pingInterval, state.lastPingTime, state.mode, state.tierFilterMode, state.scrollOffset, state.terminalRows, state.terminalCols, state.originFilterMode, state.activeProfile, state.profileSaveMode, state.profileSaveBuffer, state.proxyStartupStatus, state.pingMode, state.pingModeSource, state.hideUnconfiguredModels, state.widthWarningStartedAt, state.widthWarningDismissed, state.settingsUpdateState, state.settingsUpdateLatestVersion, getProxySettings(state.config).enabled === true))

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

      // 📖 Store ping result as object with ms and code
      // 📖 ms = actual response time (even for errors like 429)
      // 📖 code = HTTP status code ('200', '429', '500', '000' for timeout)
      r.pings.push({ ms, code })

      // 📖 Update status based on latest ping
      if (code === '200') {
        r.status = 'up'
      } else if (code === '000') {
        r.status = 'timeout'
      } else if (code === '401' || code === '403') {
        // 📖 Distinguish "no key configured" from "configured key rejected" so the
        // 📖 Health column stays honest when Configured Only mode is enabled.
        r.status = providerApiKey ? 'auth_error' : 'noauth'
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
    } finally {
      r.isPinging = false
      state.pendingPings = Math.max(0, state.pendingPings - 1)
    }
  }

  // 📖 Initial ping of all models
  const initialPing = Promise.all(state.results.map(r => pingModel(r)))

  // 📖 Continuous ping loop with mode-driven cadence.
  const runPingCycle = async () => {
    refreshAutoPingMode()
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

    refreshAutoPingMode()
    scheduleNextPing()
  }

  // 📖 Start the ping loop
  state.pingIntervalObj = null
  scheduleNextPing()

  await initialPing

  // 📖 Save cache after initial pings complete for faster next startup
  saveCache(state.results, state.pingMode)

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
