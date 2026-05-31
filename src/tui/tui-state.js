/**
 * @file tui-state.js
 * @description Factory for the TUI state object — extracted from src/app.js for maintainability.
 *
 * @details
 *   The state object is the single source of truth for the interactive TUI.
 *   It holds all mutable UI state: cursor position, filter modes, overlay flags,
 *   ping cadence timing, settings editing buffers, and live result data.
 *
 *   🎯 Why a factory instead of inline in app.js?
 *   - Reduces runApp() from 1,300+ lines — state initialization alone was 250+ lines.
 *   - Makes state shape inspectable and testable in isolation.
 *   - Future: could generate TypeScript types from the default values.
 *
 *   📖 Ping cadence constants (PING_MODE_INTERVALS, PING_MODE_CYCLE, etc.) live here
 *   because they are tightly coupled to the state fields they initialize.
 *
 * @functions
 *   → createTuiState(opts) — Build the full initial state object with computed defaults
 *
 * @exports createTuiState, PING_MODE_INTERVALS, PING_MODE_CYCLE, SPEED_MODE_DURATION_MS, IDLE_SLOW_AFTER_MS
 *
 * @see src/app.js — calls createTuiState() once at startup
 * @see src/ping-loop.js — reads ping mode fields from the state
 */

import { WIDTH_WARNING_MIN_COLS } from '../core/constants.js'

// 📖 Ping cadence intervals per mode (ms). Speed = startup burst, normal = steady,
// 📖 slow = idle throttle, forced = user-triggered fast burst.
export const PING_MODE_INTERVALS = {
  speed: 2_000,
  normal: 10_000,
  slow: 30_000,
  forced: 4_000,
}

// 📖 Ping mode cycle order — used by keyboard handler to cycle through modes.
export const PING_MODE_CYCLE = ['speed', 'normal', 'slow', 'forced']

// 📖 Speed mode auto-falls back to normal after this duration.
export const SPEED_MODE_DURATION_MS = 60_000

// 📖 After this much inactivity, the ping loop slows down to save quota.
export const IDLE_SLOW_AFTER_MS = 5 * 60_000

/**
 * 📖 intervalToPingMode: Map a raw interval (ms) to the closest ping mode label.
 * @param {number} intervalMs
 * @returns {string}
 */
export function intervalToPingMode(intervalMs) {
  if (intervalMs <= 3000) return 'speed'
  if (intervalMs <= 5000) return 'forced'
  if (intervalMs >= 30000) return 'slow'
  return 'normal'
}

/**
 * 📖 createTuiState: Build the full initial TUI state object.
 *
 * 📖 Accepts pre-computed values (results, config, mode, etc.) that come from runApp's
 * 📖 startup logic (OpenRouter discovery, key setup, etc.) and fills in all the
 * 📖 default overlay/ping/filter state that the TUI needs on frame 1.
 *
 * @param {{
 *   results: Array,
 *   config: object,
 *   mode: string,
 *   sessionId: string,
 *   latestVersion: string|null,
 *   isDevMode: boolean,
 * }} opts
 * @returns {object} The complete TUI state (mutable)
 */
export function createTuiState({
  results,
  config,
  mode,
  sessionId,
  latestVersion,
  isDevMode,
}) {
  const now = Date.now()

  return {
    // 📖 Core data: model results (mutated in-place by ping loop)
    results,
    pendingPings: 0,

    // 📖 Animation frame counter — incremented each render tick
    frame: 0,

    // 📖 Cursor position in the visible sorted table
    cursor: 0,
    selectedModel: null,

    // 📖 Sorting preferences
    sortColumn: config.settings?.sortColumn ?? 'avg',
    sortDirection: (config.settings?.sortAsc ?? true) ? 'asc' : 'desc',

    // 📖 Ping cadence — drives the interval between background ping cycles
    pingInterval: PING_MODE_INTERVALS.speed,
    pingMode: 'speed',
    pingModeSource: 'startup',
    speedModeUntil: now + SPEED_MODE_DURATION_MS,
    lastPingTime: now,
    lastUserActivityAt: now,
    resumeSpeedOnActivity: false,

    // 📖 Version tracking — startup auto-check + periodic re-check
    startupLatestVersion: latestVersion,
    lastReleaseDate: null,
    versionAlertsEnabled: !isDevMode,

    // 📖 Tool mode — determines which external CLI opens on Enter (opencode, openclaw, crush, etc.)
    mode,

    // 📖 Filter mode indices — each cycles through a predefined sequence
    tierFilterMode: 0,
    originFilterMode: 0,
    verdictFilterMode: 0,
    healthFilterMode: 0,

    // 📖 E-key toggle: Normal → Configured only → Usable only
    hideUnconfiguredModels: config.settings?.hideUnconfiguredModels === true,
    bestModeOnly: false,

    // 📖 Favorites pinning — Y key toggles pinned+sticky mode
    favoritesPinnedAndSticky: config.settings?.favoritesPinnedAndSticky === true,

    // 📖 Viewport scroll + terminal dimensions
    scrollOffset: 0,
    terminalRows: process.stdout.rows || 24,
    terminalCols: process.stdout.columns || 80,
    widthWarningStartedAt: (process.stdout.columns || 80) < WIDTH_WARNING_MIN_COLS ? now : null,
    widthWarningDismissed: false,
    widthWarningShowCount: 0, // 📖 No longer used — kept for backward compatibility.

    // 📖 Settings screen state (P key opens it)
    settingsOpen: false,
    settingsCursor: 0,
    settingsEditMode: false,
    settingsAddKeyMode: false,
    settingsEditBuffer: '',
    settingsErrorMsg: null,
    settingsTestResults: {},
    settingsTestDetails: {},
    settingsUpdateState: 'idle',
    settingsUpdateLatestVersion: null,
    settingsUpdateError: null,

    // 📖 Live config reference — mutated in-place by save/restore
    config,
    sessionId,

    // 📖 Cached visible+sorted models — recomputed each frame by the render loop
    visibleSorted: [],

    // 📖 Command palette (Ctrl+P)
    commandPaletteOpen: false,
    commandPaletteQuery: '',
    commandPaletteCursor: 0,
    commandPaletteScrollOffset: 0,
    commandPaletteResults: [],
    commandPaletteFrozenTable: null,
    commandPaletteExpandedIds: new Set(['filters', 'actions']),

    // 📖 Help overlay (K key)
    helpVisible: false,
    settingsScrollOffset: 0,
    helpScrollOffset: 0,

    // 📖 Install Endpoints overlay (opened from Settings or Command Palette)
    installEndpointsOpen: false,
    installEndpointsPhase: 'providers',
    installEndpointsCursor: 0,
    installEndpointsScrollOffset: 0,
    installEndpointsProviderKey: null,
    installEndpointsToolMode: null,
    installEndpointsConnectionMode: null,
    installEndpointsScope: null,
    installEndpointsSelectedModelIds: new Set(),
    installEndpointsErrorMsg: null,
    installEndpointsResult: null,

    // 📖 Missing-tool bootstrap overlay
    toolInstallPromptOpen: false,
    toolInstallPromptCursor: 0,
    toolInstallPromptScrollOffset: 0,
    toolInstallPromptMode: null,
    toolInstallPromptModel: null,
    toolInstallPromptPlan: null,
    toolInstallPromptErrorMsg: null,

    // 📖 Incompatible model fallback overlay
    incompatibleFallbackOpen: false,
    incompatibleFallbackCursor: 0,
    incompatibleFallbackScrollOffset: 0,
    incompatibleFallbackModel: null,
    incompatibleFallbackTools: [],
    incompatibleFallbackSimilarModels: [],
    incompatibleFallbackSection: 'tools',

    // 📖 Smart Recommend overlay (Q key)
    recommendOpen: false,
    recommendPhase: 'questionnaire',
    recommendCursor: 0,
    recommendQuestion: 0,
    recommendAnswers: { taskType: null, priority: null, contextBudget: null },
    recommendProgress: 0,
    recommendResults: [],
    recommendScrollOffset: 0,
    recommendAnalysisTimer: null,
    recommendPingTimer: null,
    recommendedKeys: new Set(),

    // 📖 OpenCode sync status (S key in settings)
    settingsSyncStatus: null,

    // 📖 Changelog overlay (N key)
    changelogOpen: false,
    changelogScrollOffset: 0,
    changelogPhase: 'index',
    changelogCursor: 0,
    changelogSelectedVersion: null,

    // 📖 Installed Models overlay (Command Palette → Installed models)
    installedModelsOpen: false,
    installedModelsCursor: 0,
    installedModelsScrollOffset: 0,
    installedModelsData: [],
    installedModelsErrorMsg: null,

    // 📖 Router Dashboard overlay (Shift+R)
    routerDashboardOpen: false,
    routerDashboardStatus: 'idle',
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
    routerDashboardEverOpened: false,
    routerDashboardCursorIndex: 0,

    // 📖 Custom text filter (Ctrl+P → type text → Enter). Ephemeral — not saved to config.
    customTextFilter: null,

    // 📖 Token usage overlay scroll state (used when overlay opens from footer)
    tokenUsageOpen: false,

    // 📖 Benchmark results: keyed by `${providerKey}/${modelId}`
    // 📖 Each entry is the raw result object from benchmarkModel() or null.
    benchmarkResults: {},

    // 📖 Set of benchmark keys currently running (for spinner display)
    benchmarkRunning: new Set(),

    // 📖 Global benchmark state (Ctrl+U)
    globalBenchmarkRunning: false,
    globalBenchmarkTotal: 0,
    globalBenchmarkCompleted: 0,

    // 📖 Header click flash animation: briefly highlights the clicked column header
    // 📖 with an inverse/bright style for ~250ms (3 frames at 12 FPS).
    headerFlashColumn: null,       // 📖 Column name being flashed (null = no flash active)
    headerFlashUntilFrame: 0,      // 📖 Frame number when flash expires
  }
}
