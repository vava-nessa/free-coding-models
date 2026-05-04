/**
 * @file key-handler.js
 * @description Factory for the main TUI keypress handler and provider key-test model selection.
 *
 * @details
 *   This module encapsulates the full onKeyPress switch used by the TUI,
 *   including settings navigation, install-endpoint flow, overlays, and
 *   tool launch actions. It also keeps the live key bindings aligned with the
 *   highlighted letters shown in the table headers.
 *
 *   📖 Key I opens the changelog overlay.
 *
 *   It also owns the "test key" model selection used by the Settings overlay.
 *   Anonymous telemetry hooks for model launches and a few high-signal settings
 *   actions live here too, because this module already sees the final effective
 *   tool mode, provider, and selected model right before the app hands control
 *   to an external CLI.
 *   Some providers expose models in `/v1/models` that are not actually callable
 *   on the chat-completions endpoint. To avoid false negatives when a user
 *   presses `T` in Settings, the helpers below discover candidate model IDs,
 *   merge them with repo defaults, then probe several until one is accepted.
 *
 *   → Functions:
 *   - `buildProviderModelsUrl` — derive the matching `/models` endpoint when available
 *   - `parseProviderModelIds` — extract model ids from an OpenAI-style `/models` payload
 *   - `listProviderTestModels` — build an ordered candidate list for provider key verification
 *   - `classifyProviderTestOutcome` — convert attempted HTTP codes into a settings badge state
 *   - `buildProviderTestDetail` — turn probe attempts into a readable failure explanation
 *   - `createKeyHandler` — returns the async keypress handler
 *
 * @exports { buildProviderModelsUrl, parseProviderModelIds, listProviderTestModels, classifyProviderTestOutcome, buildProviderTestDetail, createKeyHandler }
 */

import { loadChangelog } from './changelog-loader.js'
import { getToolMeta, isModelCompatibleWithTool, getCompatibleTools, findSimilarCompatibleModels } from './tool-metadata.js'
import { loadConfig, saveConfig, replaceConfigContents } from './config.js'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { cleanupLegacyProxyArtifacts } from './legacy-proxy-cleanup.js'
import { getLastLayout, COLUMN_SORT_MAP } from './render-table.js'
import { cycleThemeSetting, detectActiveTheme } from './theme.js'
import { syncShellEnv, ensureShellRcSource, removeShellEnv } from './shell-env.js'
import { buildCommandPaletteTree, flattenCommandTree, filterCommandPaletteEntries } from './command-palette.js'
import { WIDTH_WARNING_MIN_COLS, VERDICT_CYCLE, HEALTH_CYCLE } from './constants.js'
import { scanAllToolConfigs, softDeleteModel } from './installed-models-manager.js'
import { startExternalTool } from './tool-launchers.js'
import {
  clearRouterDashboardRequestLog,
  closeRouterDashboardOverlay,
  cycleRouterDashboardActiveSet,
  cycleRouterDashboardProbeMode,
  openRouterDashboardOverlay,
  restartRouterDashboardDaemon,
  toggleRouterDashboardProbePause,
} from './router-dashboard.js'

// 📖 Some providers need an explicit probe model because the first catalog entry
// 📖 is not guaranteed to be accepted by their chat endpoint.
const PROVIDER_TEST_MODEL_OVERRIDES = {
  sambanova: ['MiniMax-M2.5', 'DeepSeek-V3.1', 'DeepSeek-V3.2'],
  nvidia: ['deepseek-ai/deepseek-v4-flash', 'openai/gpt-oss-120b'],
  'github-models': ['openai/gpt-4.1-mini'],
  mistral: ['mistral-small-latest', 'devstral-small-latest'],
}

// 📖 Settings key tests retry retryable failures across several models so a
// 📖 single stale catalog entry or transient timeout does not mark a valid key as dead.
const SETTINGS_TEST_MAX_ATTEMPTS = 10
const SETTINGS_TEST_RETRY_DELAY_MS = 4000

// 📖 PROVIDER_AUTH_ENDPOINTS maps provider keys to their auth-check URL + method.
// 📖 For most providers this is the /models endpoint (returns 200=valid, 401=invalid).
// 📖 Providers without an auth-check endpoint use null (falls back to chat completion ping).
// 📖 Special cases:
// 📖   - replicate: uses /v1/predictions (not /models) but needs a different payload
// 📖   - cloudflare: no auth endpoint — only has chat completions, always uses ping fallback
const PROVIDER_AUTH_ENDPOINTS = {
  nvidia:       { url: 'https://api.nvidia.com/v1/account',           method: 'GET' },
  groq:         { url: 'https://api.groq.com/v1/models',             method: 'GET' },
  cerebras:     { url: 'https://api.cerebras.ai/v1/models',          method: 'GET' },
  sambanova:    { url: 'https://api.sambanova.ai/v1/models',         method: 'GET' },
  openrouter:   { url: 'https://openrouter.ai/api/v1/models',        method: 'GET' },
  mistral:      { url: 'https://api.mistral.ai/v1/models',           method: 'GET' },
  huggingface:  { url: 'https://router.huggingface.co/v1/models',    method: 'GET' },
  deepinfra:    { url: 'https://api.deepinfra.com/v1/models',        method: 'GET' },
  fireworks:   { url: 'https://api.fireworks.ai/v1/models',         method: 'GET' },
  hyperbolic:   { url: 'https://api.hyperbolic.xyz/v1/models',       method: 'GET' },
  scaleway:     { url: 'https://api.scaleway.ai/v1/models',          method: 'GET' },
  siliconflow:  { url: 'https://api.siliconflow.com/v1/models',     method: 'GET' },
  together:     { url: 'https://api.together.xyz/v1/models',        method: 'GET' },
  perplexity:   { url: 'https://api.perplexity.ai/v1/models',       method: 'GET' },
  chutes:       { url: 'https://chutes.ai/v1/models',               method: 'GET' },
  ovhcloud:     { url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models', method: 'GET' },
  qwen:         { url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models', method: 'GET' },
  iflow:        { url: 'https://apis.iflow.cn/v1/models',            method: 'GET' },
  'github-models': null, // 📖 GitHub Models catalog is public; use chat ping to validate the token.
  replicate:    null, // 📖 Replicate has no /models endpoint; use chat completions ping
  cloudflare:   null, // 📖 Workers AI has no auth-check endpoint; use ping only
  zai:          null, // 📖 ZAI undocumented; use ping only
  googleai:     null, // 📖 Google AI Studio has no OpenAI-compatible /models; use ping
  'opencode-zen': null, // 📖 OpenCode Zen uses OpenCode auth only; use ping
  rovo:         null, // 📖 CLI tool — no API key
  gemini:       null, // 📖 CLI tool — no API key
}

// 📖 Sleep helper kept local to this module so the Settings key test flow can
// 📖 back off between retries without leaking timer logic into the rest of the TUI.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 📖 testProviderKeyDirect: Fast auth-only check using /v1/account or /v1/models.
// 📖 Fires 3 parallel probes to get a fast decisive result (auth error vs timeout vs 200).
// 📖 Returns { code, ms } from the first non-timeout response, or the best available.
async function testProviderKeyDirect(apiKey, providerKey) {
  const authConfig = PROVIDER_AUTH_ENDPOINTS[providerKey]
  if (!authConfig) return null

  const { url, method } = authConfig
  const headers = { Authorization: `Bearer ${apiKey}` }
  if (providerKey === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }

  const parallel = 3
  const promises = Array.from({ length: parallel }, async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const t0 = performance.now()
    try {
      const resp = await fetch(url, { method, headers, signal: ctrl.signal })
      return { code: resp.status, ms: Math.round(performance.now() - t0) }
    } catch (err) {
      const isTimeout = err.name === 'AbortError'
      return { code: isTimeout ? '000' : 'ERR', ms: isTimeout ? 'TIMEOUT' : Math.round(performance.now() - t0) }
    } finally {
      clearTimeout(timer)
    }
  })

  const results = await Promise.all(promises)
  const success = results.find(r => r.code === 200)
  if (success) return success
  const authFailure = results.find(r => r.code === 401 || r.code === 403)
  if (authFailure) return authFailure
  return results[0]
}

/**
 * 📖 buildProviderModelsUrl derives the matching `/models` endpoint for providers
 * 📖 that expose an OpenAI-compatible model list next to `/chat/completions`.
 * @param {string} url
 * @returns {string|null}
 */
export function buildProviderModelsUrl(url) {
  if (typeof url !== 'string' || !url.includes('/chat/completions')) return null
  return url.replace(/\/chat\/completions$/, '/models')
}

/**
 * 📖 parseProviderModelIds extracts ids from a standard OpenAI-style `/models` response.
 * 📖 Invalid payloads return an empty list so the key-test flow can safely fall back.
 * @param {unknown} data
 * @returns {string[]}
 */
export function parseProviderModelIds(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.data)) return []
  return data.data
    .map(entry => (entry && typeof entry.id === 'string') ? entry.id.trim() : '')
    .filter(Boolean)
}

/**
 * 📖 listProviderTestModels builds the ordered probe list used by the Settings `T` key.
 * 📖 Order matters:
 * 📖 1. provider-specific known-good overrides
 * 📖 2. discovered `/models` ids that also exist in this repo
 * 📖 3. all discovered `/models` ids
 * 📖 4. repo static model ids as final fallback
 * @param {string} providerKey
 * @param {{ models?: Array<[string, string, string, string, string]> } | undefined} src
 * @param {string[]} [discoveredModelIds=[]]
 * @returns {string[]}
 */
export function listProviderTestModels(providerKey, src, discoveredModelIds = []) {
  const staticModelIds = Array.isArray(src?.models) ? src.models.map(model => model[0]).filter(Boolean) : []
  const staticModelSet = new Set(staticModelIds)
  const preferredDiscoveredIds = discoveredModelIds.filter(modelId => staticModelSet.has(modelId))
  const orderedCandidates = [
    ...(PROVIDER_TEST_MODEL_OVERRIDES[providerKey] ?? []),
    ...preferredDiscoveredIds,
    ...discoveredModelIds,
    ...staticModelIds,
  ]
  return [...new Set(orderedCandidates)]
}

/**
 * 📖 classifyProviderTestOutcome maps attempted probe codes to a user-facing test result.
 * 📖 This keeps Settings more honest than a binary success/fail badge:
 * 📖 - `rate_limited` means the key is valid but the provider is currently throttling
 * 📖 - `no_callable_model` means the provider responded, but none of the attempted models were callable
 * @param {string[]} codes
 * @returns {'ok'|'auth_error'|'rate_limited'|'no_callable_model'|'fail'}
 */
export function classifyProviderTestOutcome(codes) {
  if (codes.includes('200')) return 'ok'
  if (codes.includes('401') || codes.includes('403')) return 'auth_error'
  if (codes.length > 0 && codes.every(code => code === '429')) return 'rate_limited'
  if (codes.length > 0 && codes.every(code => code === '404' || code === '410')) return 'no_callable_model'
  return 'fail'
}

// 📖 buildProviderTestDetail explains why the Settings `T` probe failed, with
// 📖 enough context for the user to know whether the key, model list, or provider
// 📖 quota is the problem.
export function buildProviderTestDetail(providerLabel, outcome, attempts = [], discoveryNote = '') {
  const introByOutcome = {
    missing_key: `${providerLabel} has no saved API key right now, so no authenticated test could be sent.`,
    ok: `${providerLabel} accepted the key.`,
    auth_error: `${providerLabel} rejected the configured key with an authentication error.`,
    rate_limited: `${providerLabel} throttled every probe, so the key may still be valid but is currently rate-limited.`,
    no_callable_model: `${providerLabel} answered the requests, but none of the probed models were callable on its chat endpoint.`,
    fail: `${providerLabel} never returned a successful probe during the retry window.`,
  }

  const hintsByOutcome = {
    missing_key: 'Save the key with Enter in Settings, then rerun T.',
    ok: attempts.length > 0 ? `Validated on ${attempts[attempts.length - 1].model}.` : 'The provider returned a success response.',
    auth_error: 'This usually means the saved key is invalid, expired, revoked, or truncated before it reached disk.',
    rate_limited: 'Wait for the provider quota window to reset, then rerun T.',
    no_callable_model: 'The provider catalog or repo defaults likely drifted; try another model family or refresh the catalog.',
    fail: 'This can be caused by timeouts, 5xx responses, or a provider-side outage.',
  }

  const attemptSummary = attempts.length > 0
    ? `Attempts: ${attempts.map(({ attempt, model, code }) => `#${attempt} ${model} -> ${code}`).join(' | ')}`
    : 'Attempts: none'

  const segments = [
    introByOutcome[outcome] || introByOutcome.fail,
    hintsByOutcome[outcome] || hintsByOutcome.fail,
    discoveryNote,
    attemptSummary,
  ].filter(Boolean)

  return segments.join(' ')
}

export function createKeyHandler(ctx) {
    const {
    state,
    exit,
    cliArgs,
    MODELS,
    sources,
    getApiKey,
    resolveApiKeys,
    addApiKey,
    removeApiKey,
    isProviderEnabled,
    saveConfig,
    persistApiKeysForProvider,
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
    checkForUpdateDetailed,
    runUpdate,
    startOpenClaw,
    startOpenCodeDesktop,
    startOpenCodeWeb,
    startKilo,
    startOpenCode,
    startExternalTool,
    getToolModeOrder,
    getToolInstallPlan,
    isToolInstalled,
    installToolWithPlan,
    sendUsageTelemetry,
    startRecommendAnalysis,
    stopRecommendAnalysis,
    stopUi,
    ping,
    getPingModel,
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
    themeRowIdx,
    setResults,
    readline,
  } = ctx

  let userSelected = null

  function resetToolInstallPrompt() {
    state.toolInstallPromptOpen = false
    state.toolInstallPromptCursor = 0
    state.toolInstallPromptScrollOffset = 0
    state.toolInstallPromptMode = null
    state.toolInstallPromptModel = null
    state.toolInstallPromptPlan = null
    state.toolInstallPromptErrorMsg = null
  }

  function shouldCheckMissingTool(mode) {
    // 📖 opencode-desktop doesn't have a binary check (it uses 'open -a').
    // 📖 opencode-web, opencode, and kilo manage their own ENOENT errors in spawn handlers.
    // 📖 xcode uses 'open -a Xcode' which doesn't need a binary path resolution.
    return !['opencode-desktop', 'opencode-web', 'opencode', 'kilo', 'xcode'].includes(mode)
  }

  function getModelTelemetryFamily(providerKey) {
    if (providerKey === 'rovo' || providerKey === 'gemini' || providerKey === 'opencode-zen') return providerKey
    return 'standard'
  }

  function trackTelemetryEvent(event, properties = {}) {
    if (typeof sendUsageTelemetry !== 'function') return
    void sendUsageTelemetry(state.config, cliArgs, {
      event,
      mode: state.mode,
      ts: new Date().toISOString(),
      properties: {
        session_id: state.sessionId,
        event_version: 1,
        ...properties,
      },
    })
  }

  function buildModelLaunchTelemetry(selected, extra = {}) {
    return {
      action_type: 'launch_model',
      tool_mode: state.mode,
      provider_key: selected.providerKey,
      model_id: selected.modelId,
      model_label: selected.label,
      model_tier: selected.tier,
      model_family: getModelTelemetryFamily(selected.providerKey),
      ...extra,
    }
  }

  function trackAppUse(selected, extra = {}) {
    trackTelemetryEvent('app_use', buildModelLaunchTelemetry(selected, extra))
  }

  function trackAppUseResult(selected, launchResult, extra = {}) {
    trackTelemetryEvent('app_use_result', buildModelLaunchTelemetry(selected, {
      launch_result: launchResult,
      ...extra,
    }))
  }

  function trackAppAction(actionType, properties = {}) {
    trackTelemetryEvent('app_action', {
      action_type: actionType,
      ...properties,
    })
  }

  async function syncFavoritesToRouter(selected) {
    if (state.config?.router?.enabled !== true) return
    const favorites = state.config.favorites || []
    const selKey = toFavoriteKey(selected.providerKey, selected.modelId)
    const chain = [selKey, ...favorites.filter((f) => f !== selKey)]
    const models = chain.map((f, i) => {
      const slashIdx = f.indexOf('/')
      const provider = slashIdx >= 0 ? f.slice(0, slashIdx) : '?'
      const model = slashIdx >= 0 ? f.slice(slashIdx + 1) : f
      return { provider, model, priority: i + 1 }
    })
    try {
      const port = await readDaemonPort()
      if (!port) return
      const baseUrl = `http://127.0.0.1:${port}`
      const setPayload = { name: 'fast-coding', models, created: new Date().toISOString() }
      await globalThis.fetch(`${baseUrl}/sets/fast-coding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setPayload),
      })
      await globalThis.fetch(`${baseUrl}/sets/fast-coding/activate`, { method: 'POST' })
    } catch {}
  }

  async function readDaemonPort() {
    try {
      const { readFileSync } = await import('node:fs')
      const raw = readFileSync(`${process.env.HOME}/.free-coding-models-daemon.port`, 'utf8').trim()
      if (/^\d+$/.test(raw)) return Number(raw)
    } catch {}
    return null
  }

  async function launchSelectedModel(selected, options = {}) {
    const { uiAlreadyStopped = false } = options
    userSelected = { modelId: selected.modelId, label: selected.label, tier: selected.tier, providerKey: selected.providerKey }

    if (!uiAlreadyStopped) {
      readline.emitKeypressEvents(process.stdin)
      if (process.stdin.isTTY) process.stdin.setRawMode(true)
      stopUi()
    }

    // 📖 If router is enabled, push [selected, ...favorites] to daemon as the active set
    await syncFavoritesToRouter(selected)

    if (selected.status === 'timeout') {
      console.log(chalk.yellow(`  ⚠ Selected: ${selected.label} (currently timing out)`))
    } else if (selected.status === 'down') {
      console.log(chalk.red(`  ⚠ Selected: ${selected.label} (currently down)`))
    } else {
      console.log(chalk.cyan(`  ✓ Selected: ${selected.label}`))
    }
    console.log()

    // 📖 CLI-only tool compatibility checks:
    // 📖 Case A: Active tool mode is CLI-only (rovo/gemini) but selected model doesn't belong to it
    // 📖 Case B: Selected model belongs to a CLI-only provider but active mode is something else
    // 📖 Case C: Selected model is from opencode-zen but active mode is not opencode/opencode-desktop
    const activeMeta = getToolMeta(state.mode)
    const isActiveModeCliOnly = activeMeta.cliOnly === true
    const isModelFromCliOnly = selected.providerKey === 'rovo' || selected.providerKey === 'gemini'
    const isModelFromZen = selected.providerKey === 'opencode-zen'
    const modelBelongsToActiveMode = selected.providerKey === state.mode

    // 📖 Case A: User is in Rovo/Gemini mode but selected a model from a different provider
    if (isActiveModeCliOnly && !modelBelongsToActiveMode) {
      trackAppUseResult(selected, 'blocked_incompatible_model', {
        blocked_by_tool_mode: state.mode,
      })
      const availableModels = MODELS.filter(m => m[5] === state.mode)
      console.log(chalk.yellow(`  ⚠ ${activeMeta.label} can only launch its own models.`))
      console.log(chalk.yellow(`  "${selected.label}" is not a ${activeMeta.label} model.`))
      console.log()
      if (availableModels.length > 0) {
        console.log(chalk.cyan(`  Available ${activeMeta.label} models:`))
        for (const m of availableModels) {
          console.log(chalk.white(`    • ${m[1]} (${m[2]} tier, ${m[3]} SWE, ${m[4]} ctx)`))
        }
        console.log()
      }
      console.log(chalk.dim(`  Switch to another tool mode with Z, or select a ${activeMeta.label} model.`))
      console.log()
      process.exit(0)
    }

    // 📖 Case B: Selected model is from a CLI-only provider but active mode is different
    if (isModelFromCliOnly && !modelBelongsToActiveMode) {
      const modelMeta = getToolMeta(selected.providerKey)
      console.log(chalk.yellow(`  ⚠ ${selected.label} is a ${modelMeta.label}-exclusive model.`))
      console.log(chalk.yellow(`  Your current tool is: ${activeMeta.label}`))
      console.log()
      console.log(chalk.cyan(`  Switching to ${modelMeta.label} and launching...`))
      setToolMode(selected.providerKey)
      console.log(chalk.green(`  ✓ Switched to ${modelMeta.label}`))
      console.log()
    }

    // 📖 Case C: Zen model selected but active mode is not OpenCode CLI / OpenCode Desktop
    // 📖 Auto-switch to OpenCode CLI since Zen models only run on OpenCode
    if (isModelFromZen && state.mode !== 'opencode' && state.mode !== 'opencode-desktop') {
      console.log(chalk.yellow(`  ⚠ ${selected.label} is an OpenCode Zen model.`))
      console.log(chalk.yellow(`  Zen models only run on OpenCode CLI or OpenCode Desktop.`))
      console.log(chalk.yellow(`  Your current tool is: ${activeMeta.label}`))
      console.log()
      console.log(chalk.cyan(`  Switching to OpenCode CLI and launching...`))
      setToolMode('opencode')
      console.log(chalk.green(`  ✓ Switched to OpenCode CLI`))
      console.log()
    }

    // 📖 OpenClaw, CLI-only tools, and Zen models manage auth differently — skip API key warning for them.
    if (state.mode !== 'openclaw' && !isModelFromCliOnly && !isModelFromZen) {
      const selectedApiKey = getApiKey(state.config, selected.providerKey)
      if (!selectedApiKey) {
        console.log(chalk.yellow(`  Warning: No API key configured for ${selected.providerKey}.`))
        console.log(chalk.yellow(`  The selected tool may not be able to use ${selected.label}.`))
        console.log(chalk.dim(`  Set ${ENV_VAR_NAMES[selected.providerKey] || selected.providerKey.toUpperCase() + '_API_KEY'} or configure via settings (P key).`))
        console.log()
      }
    }

    // 📖 CLI-only tool auto-install check — verify the CLI binary is available before launch.
    const toolModeForProvider = selected.providerKey
    if (isModelFromCliOnly && !isToolInstalled(toolModeForProvider)) {
      const installPlan = getToolInstallPlan(toolModeForProvider)
      if (installPlan.supported) {
        console.log()
        console.log(chalk.yellow(`  ⚠ ${getToolMeta(toolModeForProvider).label} is not installed.`))
        console.log(chalk.dim(`  ${installPlan.summary}`))
        if (installPlan.note) console.log(chalk.dim(`  Note: ${installPlan.note}`))
        console.log()
        console.log(chalk.cyan(`  📦 Auto-installing ${getToolMeta(toolModeForProvider).label}...`))
        console.log()

        const installResult = await installToolWithPlan(installPlan)
        if (!installResult.ok) {
          trackAppUseResult(selected, 'blocked_missing_tool', {
            required_tool_mode: toolModeForProvider,
          })
          console.log(chalk.red(`  X Tool installation failed with exit code ${installResult.exitCode}.`))
          if (installPlan.docsUrl) console.log(chalk.dim(`  Docs: ${installPlan.docsUrl}`))
          console.log()
          process.exit(installResult.exitCode || 1)
        }

        // 📖 Verify tool is now installed
        if (!isToolInstalled(toolModeForProvider)) {
          trackAppUseResult(selected, 'blocked_missing_tool', {
            required_tool_mode: toolModeForProvider,
          })
          console.log(chalk.yellow('  ⚠ The installer finished, but the tool is still not reachable from this terminal session.'))
          console.log(chalk.dim('  Restart your shell or add the tool bin directory to PATH, then retry the launch.'))
          if (installPlan.docsUrl) console.log(chalk.dim(`  Docs: ${installPlan.docsUrl}`))
          console.log()
          process.exit(1)
        }

        console.log(chalk.green('  ✓ Tool installed successfully. Continuing with the selected model...'))
        console.log()
      }
    }

    const launchSource = uiAlreadyStopped ? 'tool_install_retry' : 'tui_enter'
    trackAppUse(selected, { launch_source: launchSource })
    trackAppUseResult(selected, 'started', { launch_source: launchSource })

    let exitCode = 0
    if (state.mode === 'openclaw') {
      exitCode = await startOpenClaw(userSelected, state.config, { launchCli: true })
    } else if (state.mode === 'opencode-desktop') {
      exitCode = await startOpenCodeDesktop(userSelected, state.config)
    } else if (state.mode === 'opencode-web') {
      exitCode = await startOpenCodeWeb(userSelected, state.config)
    } else if (state.mode === 'kilo') {
      exitCode = await startKilo(userSelected, state.config)
    } else if (state.mode === 'opencode') {
      exitCode = await startOpenCode(userSelected, state.config)
    } else {
      exitCode = await startExternalTool(state.mode, userSelected, state.config)
    }

    process.exit(typeof exitCode === 'number' ? exitCode : 0)
  }

  async function installMissingToolAndLaunch(selected, installPlan) {
    const currentPlan = installPlan || getToolInstallPlan(state.mode)
    stopUi({ resetRawMode: true })

    console.log(chalk.cyan(`  📦 Installing missing tool for ${state.mode}...`))
    if (currentPlan?.summary) console.log(chalk.dim(`  ${currentPlan.summary}`))
    if (currentPlan?.shellCommand) console.log(chalk.dim(`  ${currentPlan.shellCommand}`))
    if (currentPlan?.note) console.log(chalk.dim(`  ${currentPlan.note}`))
    console.log()

    const installResult = await installToolWithPlan(currentPlan)
    if (!installResult.ok) {
      trackAppUseResult(selected, 'blocked_missing_tool', {
        required_tool_mode: state.mode,
      })
      console.log(chalk.red(`  X Tool installation failed with exit code ${installResult.exitCode}.`))
      if (currentPlan?.docsUrl) console.log(chalk.dim(`  Docs: ${currentPlan.docsUrl}`))
      console.log()
      process.exit(installResult.exitCode || 1)
    }

    if (shouldCheckMissingTool(state.mode) && !isToolInstalled(state.mode)) {
      trackAppUseResult(selected, 'blocked_missing_tool', {
        required_tool_mode: state.mode,
      })
      console.log(chalk.yellow('  ⚠ The installer finished, but the tool is still not reachable from this terminal session.'))
      console.log(chalk.dim('  Restart your shell or add the tool bin directory to PATH, then retry the launch.'))
      if (currentPlan?.docsUrl) console.log(chalk.dim(`  Docs: ${currentPlan.docsUrl}`))
      console.log()
      process.exit(1)
    }

    console.log(chalk.green('  ✓ Tool installed successfully. Continuing with the selected model...'))
    console.log()
    await launchSelectedModel(selected, { uiAlreadyStopped: true })
  }

  // ─── Settings key test helper ───────────────────────────────────────────────
  // 📖 Verifies an API key by first doing a fast parallel auth-only probe (3×8s)
  // 📖 to /v1/account or /v1/models, then falling back to chat completion pings.
  // 📖 Auth-only result is decisive (200=valid, 401/403=invalid); only timeouts or
  // 📖 providers without auth endpoints fall through to the ping-based approach.
  async function testProviderKey(providerKey) {
    const src = sources[providerKey]
    if (!src) return
    const testKey = getApiKey(state.config, providerKey)
    const providerLabel = src.name || providerKey
    if (!state.settingsTestDetails) state.settingsTestDetails = {}
    if (!testKey) {
      state.settingsTestResults[providerKey] = 'missing_key'
      state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'missing_key')
      return
    }

    // 📖 Fast path: parallel auth-only probes (3×8s) to /v1/account or /v1/models.
    // 📖 200 = key valid and accepted. 401/403 = key rejected. null = no auth endpoint.
    const authResult = await testProviderKeyDirect(testKey, providerKey)
    if (authResult) {
      if (authResult.code === 200) {
        state.settingsTestResults[providerKey] = 'ok'
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'ok', [], `Auth-only probe returned HTTP 200.`)
        return
      }
      if (authResult.code === 401 || authResult.code === 403) {
        state.settingsTestResults[providerKey] = 'auth_error'
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'auth_error', [], `Auth probe returned HTTP ${authResult.code}.`)
        return
      }
      // 📖 Timeout or ERR — fall through to ping-based approach below.
    }

    // 📖 Slow path: ping-based verification (providers without auth endpoint or timeouts).
    state.settingsTestResults[providerKey] = 'pending'
    state.settingsTestDetails[providerKey] = `Testing ${providerLabel} across up to ${SETTINGS_TEST_MAX_ATTEMPTS} probes...`
    const discoveredModelIds = []
    const modelsUrl = buildProviderModelsUrl(src.url)
    let discoveryNote = ''

    if (modelsUrl) {
      try {
        const headers = { Authorization: `Bearer ${testKey}` }
        if (providerKey === 'openrouter') {
          headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
          headers['X-Title'] = 'free-coding-models'
        }
        const modelsResp = await fetch(modelsUrl, { headers })
        if (modelsResp.ok) {
          const data = await modelsResp.json()
          discoveredModelIds.push(...parseProviderModelIds(data))
          discoveryNote = discoveredModelIds.length > 0
            ? `Live model discovery returned ${discoveredModelIds.length} ids.`
            : 'Live model discovery succeeded but returned no callable ids.'
        } else {
          discoveryNote = `Live model discovery returned HTTP ${modelsResp.status}; falling back to the repo catalog.`
        }
      } catch (err) {
        discoveryNote = `Live model discovery failed (${err?.name || 'error'}); falling back to the repo catalog.`
      }
    }

    const candidateModels = listProviderTestModels(providerKey, src, discoveredModelIds)
    if (candidateModels.length === 0) {
      state.settingsTestResults[providerKey] = 'fail'
      state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'fail', [], discoveryNote || 'No candidate model was available for probing.')
      return
    }

    // 📖 Parallel ping burst: fire up to 5 probes simultaneously to get fast feedback.
    const PARALLEL_PROBES = 5
    const attempts = []
    let settled = false

    while (!settled) {
      const batch = []
      for (let i = 0; i < PARALLEL_PROBES && attempts.length + batch.length < SETTINGS_TEST_MAX_ATTEMPTS; i++) {
        const testModel = candidateModels[(attempts.length + batch.length) % candidateModels.length]
        batch.push(ping(testKey, testModel, providerKey, src.url).then(({ code }) => ({ attempt: attempts.length + batch.length + 1, model: testModel, code })))
      }
      const batchResults = await Promise.all(batch)
      attempts.push(...batchResults)

      // 📖 Check outcome after each parallel batch.
      const outcome = classifyProviderTestOutcome(attempts.map(({ code }) => code))
      if (outcome === 'ok') {
        state.settingsTestResults[providerKey] = 'ok'
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'ok', attempts, discoveryNote)
        settled = true
        continue
      }
      if (outcome === 'auth_error') {
        state.settingsTestResults[providerKey] = 'auth_error'
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'auth_error', attempts, discoveryNote)
        settled = true
        continue
      }
      if (attempts.length >= SETTINGS_TEST_MAX_ATTEMPTS) {
        state.settingsTestResults[providerKey] = outcome
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, outcome, attempts, discoveryNote)
        settled = true
        continue
      }

      // 📖 Show progress between batches, then pause before next round.
      state.settingsTestDetails[providerKey] = `Testing ${providerLabel}... ${attempts.length}/${SETTINGS_TEST_MAX_ATTEMPTS} probes tried. Retrying in ${SETTINGS_TEST_RETRY_DELAY_MS / 1000}s.`
      await sleep(SETTINGS_TEST_RETRY_DELAY_MS)
    }
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
    stopUi({ resetRawMode: true })
    runUpdate(latestVersion)
  }

  // 📖 The old multi-tool proxy is discontinued. This maintenance action clears
  // 📖 stale config/env/service leftovers so users stay on the stable direct path.
  function runLegacyProxyCleanup() {
    const summary = cleanupLegacyProxyArtifacts()
    replaceConfigContents(state.config, loadConfig())

    if (summary.errors.length > 0) {
      const cleanedTargets = summary.removedFiles.length + summary.updatedFiles.length
      const partialDetail = summary.changed
        ? `Cleaned ${cleanedTargets} legacy paths, but ${summary.errors.length} items still need manual cleanup.`
        : `Cleanup hit ${summary.errors.length} file errors.`
      state.settingsSyncStatus = {
        type: 'error',
        msg: `⚠️ Proxy cleanup was partial. ${partialDetail} The old bridge is discontinued while a more stable replacement is being built.`,
      }
      return
    }

    if (summary.changed) {
      const cleanedTargets = summary.removedFiles.length + summary.updatedFiles.length
      state.settingsSyncStatus = {
        type: 'success',
        msg: `ℹ️ Removed discontinued proxy leftovers from ${cleanedTargets} path${cleanedTargets === 1 ? '' : 's'}. A much more stable replacement is coming soon.`,
      }
      return
    }

    state.settingsSyncStatus = {
      type: 'success',
      msg: 'ℹ️ No discontinued proxy config was found. You are already on the stable direct-provider setup.',
    }
  }

  // 📖 Theme switches need to update both persisted preference and the live
  // 📖 semantic palette immediately so every screen redraw adopts the new colors.
  function applyThemeSetting(nextTheme) {
    if (!state.config.settings) state.config.settings = {}
    state.config.settings.theme = nextTheme
    saveConfig(state.config)
    detectActiveTheme(nextTheme)
  }

  function cycleGlobalTheme() {
    const currentTheme = state.config.settings?.theme || 'auto'
    applyThemeSetting(cycleThemeSetting(currentTheme))
  }

  function toggleShellEnv() {
    if (!state.config.settings) state.config.settings = {}
    const currentlyEnabled = state.config.settings.shellEnvEnabled === true
    state.config.settings.shellEnvEnabled = !currentlyEnabled
    saveConfig(state.config)
    if (!currentlyEnabled) {
      syncShellEnv(state.config)
      ensureShellRcSource()
    } else {
      removeShellEnv()
    }
    trackAppAction('shell_env_export_toggled', {
      enabled: state.config.settings.shellEnvEnabled === true,
    })
  }

  function resetInstallEndpointsOverlay() {
    state.installEndpointsOpen = false
    state.installEndpointsPhase = 'providers'
    state.installEndpointsCursor = 0
    state.installEndpointsScrollOffset = 0
    state.installEndpointsProviderKey = null
    state.installEndpointsToolMode = null
    state.installEndpointsConnectionMode = null
    state.installEndpointsScope = null
    state.installEndpointsSelectedModelIds = new Set()
    state.installEndpointsErrorMsg = null
    state.installEndpointsResult = null
  }

  async function runInstallEndpointsFlow() {
    const selectedModelIds = [...state.installEndpointsSelectedModelIds]
    const result = installProviderEndpoints(
      state.config,
      state.installEndpointsProviderKey,
      state.installEndpointsToolMode,
      {
        scope: state.installEndpointsScope,
        modelIds: selectedModelIds,
        connectionMode: state.installEndpointsConnectionMode || 'direct',
      }
    )

    state.installEndpointsResult = {
      type: 'success',
      title: `${result.modelCount} models installed into ${result.toolLabel}`,
      lines: [
        chalk.bold(`Provider:`) + ` ${result.providerLabel}`,
        chalk.bold(`Scope:`) + ` ${result.scope === 'selected' ? 'Selected models' : 'All current models'}`,
        chalk.bold(`Managed Id:`) + ` ${result.providerId}`,
        chalk.bold(`Config:`) + ` ${result.path}`,
        ...(result.extraPath ? [chalk.bold(`Secrets:`) + ` ${result.extraPath}`] : []),
      ],
    }
    trackAppAction('install_provider_endpoints', {
      provider_key: result.providerKey,
      tool_mode: result.toolMode,
      install_scope: result.scope,
      connection_mode: state.installEndpointsConnectionMode || 'direct',
      model_count: result.modelCount,
      selected_model_count: selectedModelIds.length,
    })
    state.installEndpointsPhase = 'result'
    state.installEndpointsCursor = 0
    state.installEndpointsScrollOffset = 0
    state.installEndpointsErrorMsg = null
  }

  // 📖 Persist current table-view preferences so sort/filter state survives restarts.
  function persistUiSettings() {
    if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
    state.config.settings.tierFilter = TIER_CYCLE[state.tierFilterMode]
    state.config.settings.originFilter = ORIGIN_CYCLE[state.originFilterMode] ?? null
    state.config.settings.sortColumn = state.sortColumn
    state.config.settings.sortAsc = state.sortDirection === 'asc'
    saveConfig(state.config)
  }

  // 📖 Shared table refresh helper so command-palette and hotkeys keep identical behavior.
  function refreshVisibleSorted({ resetCursor = true } = {}) {
    const visible = state.results.filter(r => !r.hidden)
    state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection, {
      pinFavorites: state.favoritesPinnedAndSticky,
    })
    if (resetCursor) {
      state.cursor = 0
      state.scrollOffset = 0
      return
    }
    if (state.cursor >= state.visibleSorted.length) state.cursor = Math.max(0, state.visibleSorted.length - 1)
    adjustScrollOffset(state)
  }

  function setSortColumnFromCommand(col) {
    if (state.sortColumn === col) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      state.sortColumn = col
      state.sortDirection = 'asc'
    }
    refreshVisibleSorted({ resetCursor: true })
    persistUiSettings()
  }

  function setTierFilterFromCommand(tierLabel) {
    const nextMode = tierLabel === null ? 0 : TIER_CYCLE.indexOf(tierLabel)
    state.tierFilterMode = nextMode >= 0 ? nextMode : 0
    applyTierFilter()
    refreshVisibleSorted({ resetCursor: true })
    persistUiSettings()
  }

  function openSettingsOverlay() {
    state.settingsOpen = true
    state.settingsCursor = 0
    state.settingsEditMode = false
    state.settingsAddKeyMode = false
    state.settingsEditBuffer = ''
    state.settingsScrollOffset = 0

    // 📖 Auto-test all configured API keys in parallel on Settings open.
    // 📖 Each provider with a saved key fires a parallel auth probe batch immediately.
    // 📖 The T key re-triggers a focused test on the selected row without clearing others.
    const providerKeys = Object.keys(sources)
    for (const pk of providerKeys) {
      const testKey = getApiKey(state.config, pk)
      if (testKey) {
        // 📖 Fire and forget — update state as probes resolve.
        testProviderKey(pk)
      } else {
        state.settingsTestResults[pk] = 'missing_key'
      }
    }
  }

  function openRecommendOverlay() {
    state.recommendOpen = true
    state.recommendPhase = 'questionnaire'
    state.recommendQuestion = 0
    state.recommendCursor = 0
    state.recommendAnswers = { taskType: null, priority: null, contextBudget: null }
    state.recommendResults = []
    state.recommendScrollOffset = 0
  }

  function openInstallEndpointsOverlay() {
    state.installEndpointsOpen = true
    state.installEndpointsPhase = 'providers'
    state.installEndpointsCursor = 0
    state.installEndpointsScrollOffset = 0
    state.installEndpointsProviderKey = null
    state.installEndpointsToolMode = null
    state.installEndpointsConnectionMode = null
    state.installEndpointsScope = null
    state.installEndpointsSelectedModelIds = new Set()
    state.installEndpointsErrorMsg = null
    state.installEndpointsResult = null
  }



  function openChangelogOverlay() {
    state.changelogOpen = true
    state.changelogScrollOffset = 0
    state.changelogPhase = 'index'
    state.changelogCursor = 0
    state.changelogSelectedVersion = null
  }

  function openInstalledModelsOverlay() {
    state.installedModelsOpen = true
    state.installedModelsCursor = 0
    state.installedModelsScrollOffset = 0
    state.installedModelsErrorMsg = 'Scanning...'

    try {
      const results = scanAllToolConfigs()
      state.installedModelsData = results
      state.installedModelsErrorMsg = null
    } catch (err) {
      state.installedModelsErrorMsg = err.message || 'Failed to scan tool configs'
    }
  }


  // 📖 Token Usage screen — Shift+T from main table. Fetches daily token history
  // 📖 from the daemon and renders a 7-day chart plus today/all-time breakdowns.
  async function openTokenUsageOverlay() {
    state.tokenUsageOpen = true
    state.tokenUsageScrollOffset = 0
    state.tokenUsageError = null
    state.tokenUsageData = null
    // 📖 Discover daemon port
    let port = 19280
    try {
      const { readFileSync: rfs } = await import('node:fs')
      const portPath = `${process.env.HOME}/.free-coding-models-daemon.port`
      const savedPort = rfs(portPath, 'utf8').trim()
      if (/^\d+$/.test(savedPort)) port = Number(savedPort)
    } catch {}
    state.tokenUsageLastFetchAt = Date.now()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const res = await globalThis.fetch(`http://127.0.0.1:${port}/stats/tokens`, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) {
        state.tokenUsageError = `Daemon returned HTTP ${res.status} — is the router running?`
        return
      }
      // 📖 Guard: res.json() can throw on malformed response body
      const text = await res.text()
      try {
        state.tokenUsageData = JSON.parse(text)
      } catch {
        state.tokenUsageError = 'Daemon returned invalid JSON — try restarting the daemon'
      }
    } catch (err) {
      state.tokenUsageError = err?.name === 'AbortError' ? 'Request timed out — is the router daemon running?' : (err?.message || 'Failed to fetch token stats')
    }
  }

  function closeTokenUsageOverlay() {
    state.tokenUsageOpen = false
    state.tokenUsageScrollOffset = 0
    state.tokenUsageError = null
  }


  function cycleToolMode() {
    const modeOrder = getToolModeOrder()
    const currentIndex = modeOrder.indexOf(state.mode)
    const nextIndex = (currentIndex + 1) % modeOrder.length
    setToolMode(modeOrder[nextIndex])
  }

  // 📖 Keep tool-mode changes centralized so keyboard shortcuts and command palette
  // 📖 both persist to config exactly the same way.
  function setToolMode(nextMode) {
    if (!getToolModeOrder().includes(nextMode)) return
    state.mode = nextMode
    if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
    state.config.settings.preferredToolMode = state.mode
    saveConfig(state.config)
  }

  // 📖 Favorites display mode:
  // 📖 - true  => favorites stay pinned + always visible (legacy behavior)
  // 📖 - false => favorites are just starred rows and obey normal sort/filter rules
  function setFavoritesDisplayMode(nextPinned, { preserveSelection = true } = {}) {
    const normalizedNextPinned = nextPinned !== false
    if (state.favoritesPinnedAndSticky === normalizedNextPinned) return

    const selected = preserveSelection ? state.visibleSorted[state.cursor] : null
    const selectedKey = selected ? toFavoriteKey(selected.providerKey, selected.modelId) : null

    state.favoritesPinnedAndSticky = normalizedNextPinned
    if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
    state.config.settings.favoritesPinnedAndSticky = state.favoritesPinnedAndSticky
    saveConfig(state.config)

    applyTierFilter()
    refreshVisibleSorted({ resetCursor: false })

    if (selectedKey) {
      const selectedIdx = state.visibleSorted.findIndex((row) => toFavoriteKey(row.providerKey, row.modelId) === selectedKey)
      if (selectedIdx >= 0) state.cursor = selectedIdx
      adjustScrollOffset(state)
    }
  }

  function toggleFavoritesDisplayMode() {
    setFavoritesDisplayMode(!state.favoritesPinnedAndSticky)
  }

  function resetViewSettings() {
    state.tierFilterMode = 0
    state.originFilterMode = 0
    state.customTextFilter = null  // 📖 Clear ephemeral text filter on view reset
    state.sortColumn = 'avg'
    state.sortDirection = 'asc'
    if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
    delete state.config.settings.tierFilter
    delete state.config.settings.originFilter
    delete state.config.settings.sortColumn
    delete state.config.settings.sortAsc
    saveConfig(state.config)
    applyTierFilter()
    refreshVisibleSorted({ resetCursor: true })
  }

  function toggleFavoriteOnSelectedRow() {
    const selected = state.visibleSorted[state.cursor]
    if (!selected) return
    const wasFavorite = selected.isFavorite
    toggleFavoriteModel(state.config, selected.providerKey, selected.modelId)
    syncFavoriteFlags(state.results, state.config)
    applyTierFilter()
    refreshVisibleSorted({ resetCursor: false })

    if (wasFavorite && state.favoritesPinnedAndSticky) {
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    const selectedKey = toFavoriteKey(selected.providerKey, selected.modelId)
    const newCursor = state.visibleSorted.findIndex(r => toFavoriteKey(r.providerKey, r.modelId) === selectedKey)
    if (newCursor >= 0) state.cursor = newCursor
    adjustScrollOffset(state)
  }

  function commandPaletteHasBlockingOverlay() {
    return state.settingsOpen
      || state.installEndpointsOpen
      || state.toolInstallPromptOpen
      || state.installedModelsOpen
      || state.routerDashboardOpen
      || state.recommendOpen

      || state.helpVisible
      || state.changelogOpen
  }

  function refreshCommandPaletteResults() {
    const query = (state.commandPaletteQuery || '').trim()
    const tree = buildCommandPaletteTree(state.results || [])
    // 📖 Keep collapsed view clean when query is empty, but search across the
    // 📖 full tree when users type so hidden submenu commands still appear.
    let flat
    if (query.length > 0) {
      const expandedIds = new Set()
      const collectExpandedIds = (nodes) => {
        for (const node of nodes || []) {
          if (Array.isArray(node.children) && node.children.length > 0) {
            expandedIds.add(node.id)
            collectExpandedIds(node.children)
          }
        }
      }
      collectExpandedIds(tree)
      flat = flattenCommandTree(tree, expandedIds)
    } else {
      flat = flattenCommandTree(tree, state.commandPaletteExpandedIds)
    }
    state.commandPaletteResults = filterCommandPaletteEntries(flat, query)

    if (query.length > 0) {
      state.commandPaletteResults.unshift({
        id: 'filter-custom-text-apply',
        label: `🔍 Apply text filter: ${query}`,
        type: 'command',
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        filterQuery: query,
      })
    } else if (state.customTextFilter) {
      state.commandPaletteResults.unshift({
        id: 'filter-custom-text-remove',
        label: `❌ Remove custom filter: ${state.customTextFilter}`,
        type: 'command',
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        filterQuery: null,
      })
    }

    // 📖 Inject a high-priority update entry at the top when a newer version is known.
    const updateVersion = state.startupLatestVersion
    if (updateVersion && state.versionAlertsEnabled) {
      state.commandPaletteResults.unshift({
        id: 'action-update-now',
        label: `⬆️ UPDATE NOW — v${updateVersion} available (recommended!)`,
        type: 'command',
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        updateVersion,
        keywords: ['update', 'upgrade', 'version', 'install'],
      })
    }

    if (state.commandPaletteCursor >= state.commandPaletteResults.length) {
      state.commandPaletteCursor = Math.max(0, state.commandPaletteResults.length - 1)
    }
  }

  function openCommandPalette() {
    state.commandPaletteOpen = true
    state.commandPaletteFrozenTable = null
    state.commandPaletteQuery = ''
    state.commandPaletteCursor = 0
    state.commandPaletteScrollOffset = 0
    refreshCommandPaletteResults()
  }

  function closeCommandPalette() {
    state.commandPaletteOpen = false
    state.commandPaletteFrozenTable = null
    state.commandPaletteQuery = ''
    state.commandPaletteCursor = 0
    state.commandPaletteScrollOffset = 0
    state.commandPaletteResults = []
  }

  function executeCommandPaletteEntry(entry) {
    if (!entry?.id) return

    // 📖 Update action: stop TUI cleanly and run the npm update + relaunch.
    if (entry.id === 'action-update-now' && entry.updateVersion) {
      closeCommandPalette()
      stopUi({ resetRawMode: true })
      runUpdate(entry.updateVersion)
      return
    }

    if (entry.id.startsWith('action-set-ping-') && entry.pingMode) {
      setPingMode(entry.pingMode, 'manual')
      return
    }

    if (entry.id.startsWith('action-set-tool-') && entry.toolMode) {
      setToolMode(entry.toolMode)
      return
    }

    if (entry.id.startsWith('action-favorites-mode-') && typeof entry.favoritesPinned === 'boolean') {
      setFavoritesDisplayMode(entry.favoritesPinned)
      return
    }

    if (entry.id.startsWith('filter-tier-')) {
      setTierFilterFromCommand(entry.tier ?? null)
      return
    }

    if (entry.id.startsWith('filter-provider-') && entry.id !== 'filter-provider-cycle') {
      if (entry.providerKey === null || entry.providerKey === undefined) {
        state.originFilterMode = 0 // All
      } else {
        state.originFilterMode = ORIGIN_CYCLE.findIndex(key => key === entry.providerKey) + 1
        if (state.originFilterMode <= 0) state.originFilterMode = 0
      }
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      persistUiSettings()
      return
    }

    if (entry.id.startsWith('filter-model-')) {
      if (entry.modelId && entry.providerKey) {
        state.customTextFilter = `${entry.providerKey}/${entry.modelId}`
        applyTierFilter()
        refreshVisibleSorted({ resetCursor: true })
      }
      return
    }

    // 📖 Custom text filter — apply or remove the free-text filter from the command palette.
    if (entry.id === 'filter-custom-text-apply') {
      state.customTextFilter = entry.filterQuery || null
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      return
    }
    if (entry.id === 'filter-custom-text-remove') {
      state.customTextFilter = null
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      return
    }

    switch (entry.id) {
      case 'filter-provider-cycle':
        state.originFilterMode = (state.originFilterMode + 1) % ORIGIN_CYCLE.length
        applyTierFilter()
        refreshVisibleSorted({ resetCursor: true })
        persistUiSettings()
        return
      case 'filter-configured-toggle':
        state.hideUnconfiguredModels = !state.hideUnconfiguredModels
        if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
        state.config.settings.hideUnconfiguredModels = state.hideUnconfiguredModels
        saveConfig(state.config)
        applyTierFilter()
        refreshVisibleSorted({ resetCursor: true })
        return
      case 'sort-rank': return setSortColumnFromCommand('rank')
      case 'sort-tier': return setSortColumnFromCommand('tier')
      case 'sort-provider': return setSortColumnFromCommand('origin')
      case 'sort-model': return setSortColumnFromCommand('model')
      case 'sort-latest-ping': return setSortColumnFromCommand('ping')
      case 'sort-avg-ping': return setSortColumnFromCommand('avg')
      case 'sort-swe': return setSortColumnFromCommand('swe')
      case 'sort-ctx': return setSortColumnFromCommand('ctx')
      case 'sort-health': return setSortColumnFromCommand('condition')
      case 'sort-verdict': return setSortColumnFromCommand('verdict')
      case 'sort-stability': return setSortColumnFromCommand('stability')
      case 'sort-uptime': return setSortColumnFromCommand('uptime')
      case 'open-settings': return openSettingsOverlay()
      case 'open-help':
        state.helpVisible = true
        state.helpScrollOffset = 0
        return
      case 'open-changelog': return openChangelogOverlay()

      case 'open-recommend': return openRecommendOverlay()
      case 'open-router-dashboard': return openRouterDashboardOverlay(state)
      case 'open-token-usage': return openTokenUsageOverlay()
      case 'open-install-endpoints': return openInstallEndpointsOverlay()
      case 'open-installed-models': return openInstalledModelsOverlay()
      case 'action-cycle-theme': return cycleGlobalTheme()
      case 'action-cycle-tool-mode': return cycleToolMode()
      case 'action-cycle-ping-mode': {
        const currentIdx = PING_MODE_CYCLE.indexOf(state.pingMode)
        const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % PING_MODE_CYCLE.length : 0
        setPingMode(PING_MODE_CYCLE[nextIdx], 'manual')
        return
      }
      case 'action-toggle-favorite': return toggleFavoriteOnSelectedRow()
      case 'action-toggle-favorite-mode': return toggleFavoritesDisplayMode()
      case 'action-reset-view': return resetViewSettings()
      default:
        return
    }
  }

  return async (str, key) => {
    if (!key) return
    noteUserActivity()

    // 📖 Ctrl+C: always exit immediately, checked FIRST to prevent any other key binding from swallowing it.
    // 📖 Also handles the raw \x03 byte as a fallback for terminals where readline doesn't set key.ctrl properly.
    if ((key.ctrl && key.name === 'c') || str === '\x03') { exit(0); return }

    // 📖 Ctrl+P toggles the command palette from the main table only.
    if (key.ctrl && key.name === 'p') {
      if (state.commandPaletteOpen) {
        closeCommandPalette()
        return
      }
      if (!commandPaletteHasBlockingOverlay()) {
        openCommandPalette()
      }
      return
    }

    // 📖 Command palette captures the keyboard while active.
    if (state.commandPaletteOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      const pageStep = Math.max(1, (state.terminalRows || 1) - 10)
      const selected = state.commandPaletteResults[state.commandPaletteCursor]

      if (key.name === 'escape') {
        closeCommandPalette()
        return
      }
      if (key.name === 'up') {
        const count = state.commandPaletteResults.length
        if (count === 0) return
        state.commandPaletteCursor = state.commandPaletteCursor > 0 ? state.commandPaletteCursor - 1 : count - 1
        return
      }
      if (key.name === 'down') {
        const count = state.commandPaletteResults.length
        if (count === 0) return
        state.commandPaletteCursor = state.commandPaletteCursor < count - 1 ? state.commandPaletteCursor + 1 : 0
        return
      }
      if (key.name === 'left') {
        if (selected?.hasChildren && selected.isExpanded) {
          state.commandPaletteExpandedIds.delete(selected.id)
          refreshCommandPaletteResults()
        }
        return
      }
      if (key.name === 'right') {
        if (selected?.hasChildren && !selected.isExpanded) {
          state.commandPaletteExpandedIds.add(selected.id)
          refreshCommandPaletteResults()
        } else if (selected?.type === 'command') {
          closeCommandPalette()
          executeCommandPaletteEntry(selected)
        }
        return
      }
      if (key.name === 'pageup') {
        state.commandPaletteCursor = Math.max(0, state.commandPaletteCursor - pageStep)
        return
      }
      if (key.name === 'pagedown') {
        const max = Math.max(0, state.commandPaletteResults.length - 1)
        state.commandPaletteCursor = Math.min(max, state.commandPaletteCursor + pageStep)
        return
      }
      if (key.name === 'home') {
        state.commandPaletteCursor = 0
        return
      }
      if (key.name === 'end') {
        state.commandPaletteCursor = Math.max(0, state.commandPaletteResults.length - 1)
        return
      }
      if (key.name === 'backspace') {
        state.commandPaletteQuery = state.commandPaletteQuery.slice(0, -1)
        state.commandPaletteCursor = 0
        state.commandPaletteScrollOffset = 0
        refreshCommandPaletteResults()
        return
      }
      if (key.name === 'return') {
        if (selected?.hasChildren) {
          if (selected.isExpanded) {
            state.commandPaletteExpandedIds.delete(selected.id)
          } else {
            state.commandPaletteExpandedIds.add(selected.id)
          }
          refreshCommandPaletteResults()
        } else {
          closeCommandPalette()
          executeCommandPaletteEntry(selected)
        }
        return
      }
      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        state.commandPaletteQuery += str
        state.commandPaletteCursor = 0
        state.commandPaletteScrollOffset = 0
        refreshCommandPaletteResults()
        return
      }
      return
    }

    if (!state.settingsEditMode && !state.settingsAddKeyMode && key.name === 'g' && !key.ctrl && !key.meta) {
      cycleGlobalTheme()
      return
    }

    // 📖 Profile system removed - API keys now persist permanently across all sessions

    // 📖 Router Dashboard captures local dashboard controls while open so keys
    // 📖 like S/I/R/C do not leak through to sort/filter actions in the table.
    if (state.routerDashboardOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }
      const pageStep = Math.max(1, (state.terminalRows || 1) - 4)

      if (key.name === 'escape') {
        closeRouterDashboardOverlay(state)
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        state.routerDashboardScrollOffset = Math.max(0, (state.routerDashboardScrollOffset || 0) - 1)
        return
      }
      if (key.name === 'down' || key.name === 'j') {
        state.routerDashboardScrollOffset = (state.routerDashboardScrollOffset || 0) + 1
        return
      }
      if (key.name === 'pageup') {
        state.routerDashboardScrollOffset = Math.max(0, (state.routerDashboardScrollOffset || 0) - pageStep)
        return
      }
      if (key.name === 'pagedown') {
        state.routerDashboardScrollOffset = (state.routerDashboardScrollOffset || 0) + pageStep
        return
      }
      if (key.name === 'home') {
        state.routerDashboardScrollOffset = 0
        return
      }
      if (key.name === 's') {
        try { await cycleRouterDashboardActiveSet(state) } catch {}
        return
      }
      if (key.name === 'i') {
        try { await cycleRouterDashboardProbeMode(state) } catch {}
        return
      }
      if (key.name === 'r') {
        restartRouterDashboardDaemon(state)
        return
      }
      if (key.name === 'c') {
        clearRouterDashboardRequestLog(state)
        return
      }
      if (key.name === 'p') {
        toggleRouterDashboardProbePause(state)
        return
      }
      return
    }

    // 📖 Install Endpoints overlay: provider → tool → connection → scope → optional model subset.
    if (state.installEndpointsOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      const providerChoices = getConfiguredInstallableProviders(state.config)
      const toolChoices = getInstallTargetModes()
      const modelChoices = state.installEndpointsProviderKey
        ? getProviderCatalogModels(state.installEndpointsProviderKey)
        : []
      const pageStep = Math.max(1, (state.terminalRows || 1) - 4)

      const maxIndexByPhase = () => {
        if (state.installEndpointsPhase === 'providers') return Math.max(0, providerChoices.length - 1)
        if (state.installEndpointsPhase === 'tools') return Math.max(0, toolChoices.length - 1)
        if (state.installEndpointsPhase === 'scope') return 1
        if (state.installEndpointsPhase === 'models') return Math.max(0, modelChoices.length - 1)
        return 0
      }

      if (key.name === 'up') {
        state.installEndpointsCursor = Math.max(0, state.installEndpointsCursor - 1)
        return
      }
      if (key.name === 'down') {
        state.installEndpointsCursor = Math.min(maxIndexByPhase(), state.installEndpointsCursor + 1)
        return
      }
      if (key.name === 'pageup') {
        state.installEndpointsCursor = Math.max(0, state.installEndpointsCursor - pageStep)
        return
      }
      if (key.name === 'pagedown') {
        state.installEndpointsCursor = Math.min(maxIndexByPhase(), state.installEndpointsCursor + pageStep)
        return
      }
      if (key.name === 'home') {
        state.installEndpointsCursor = 0
        return
      }
      if (key.name === 'end') {
        state.installEndpointsCursor = maxIndexByPhase()
        return
      }

      if (key.name === 'escape') {
        state.installEndpointsErrorMsg = null
        if (state.installEndpointsPhase === 'providers' || state.installEndpointsPhase === 'result') {
          resetInstallEndpointsOverlay()
          return
        }
        if (state.installEndpointsPhase === 'tools') {
          state.installEndpointsPhase = 'providers'
          state.installEndpointsCursor = 0
          state.installEndpointsScrollOffset = 0
          return
        }
        if (state.installEndpointsPhase === 'scope') {
          state.installEndpointsPhase = 'tools'
          state.installEndpointsCursor = 0
          state.installEndpointsScrollOffset = 0
          return
        }
        if (state.installEndpointsPhase === 'models') {
          state.installEndpointsPhase = 'scope'
          state.installEndpointsCursor = state.installEndpointsScope === 'selected' ? 1 : 0
          state.installEndpointsScrollOffset = 0
          return
        }
      }

      if (state.installEndpointsPhase === 'providers') {
        if (key.name === 'return') {
          const selectedProvider = providerChoices[state.installEndpointsCursor]
          if (!selectedProvider) {
            state.installEndpointsErrorMsg = '⚠ No installable configured provider is available yet.'
            return
          }
          state.installEndpointsProviderKey = selectedProvider.providerKey
          state.installEndpointsToolMode = null
          state.installEndpointsScope = null
          state.installEndpointsSelectedModelIds = new Set()
          state.installEndpointsPhase = 'tools'
          state.installEndpointsCursor = 0
          state.installEndpointsScrollOffset = 0
          state.installEndpointsErrorMsg = null
        }
        return
      }

      if (state.installEndpointsPhase === 'tools') {
        if (key.name === 'return') {
          const selectedToolMode = toolChoices[state.installEndpointsCursor]
          if (!selectedToolMode) return
          state.installEndpointsToolMode = selectedToolMode
          state.installEndpointsConnectionMode = 'direct'
          state.installEndpointsPhase = 'scope'
          state.installEndpointsCursor = 0
          state.installEndpointsScrollOffset = 0
          state.installEndpointsErrorMsg = null
        }
        return
      }

      if (state.installEndpointsPhase === 'scope') {
        if (key.name === 'return') {
          state.installEndpointsScope = state.installEndpointsCursor === 1 ? 'selected' : 'all'
          state.installEndpointsScrollOffset = 0
          state.installEndpointsErrorMsg = null
          if (state.installEndpointsScope === 'all') {
            try {
              await runInstallEndpointsFlow()
            } catch (error) {
              state.installEndpointsResult = {
                type: 'error',
                title: 'Install failed',
                lines: [error instanceof Error ? error.message : String(error)],
              }
              state.installEndpointsPhase = 'result'
            }
            return
          }

          state.installEndpointsSelectedModelIds = new Set()
          state.installEndpointsPhase = 'models'
          state.installEndpointsCursor = 0
        }
        return
      }

      if (state.installEndpointsPhase === 'models') {
        if (key.name === 'a') {
          if (state.installEndpointsSelectedModelIds.size === modelChoices.length) {
            state.installEndpointsSelectedModelIds = new Set()
          } else {
            state.installEndpointsSelectedModelIds = new Set(modelChoices.map((model) => model.modelId))
          }
          state.installEndpointsErrorMsg = null
          return
        }

        if (key.name === 'space') {
          const selectedModel = modelChoices[state.installEndpointsCursor]
          if (!selectedModel) return
          const next = new Set(state.installEndpointsSelectedModelIds)
          if (next.has(selectedModel.modelId)) next.delete(selectedModel.modelId)
          else next.add(selectedModel.modelId)
          state.installEndpointsSelectedModelIds = next
          state.installEndpointsErrorMsg = null
          return
        }

        if (key.name === 'return') {
          if (state.installEndpointsSelectedModelIds.size === 0) {
            state.installEndpointsErrorMsg = '⚠ Select at least one model before installing.'
            return
          }

          try {
            await runInstallEndpointsFlow()
          } catch (error) {
            state.installEndpointsResult = {
              type: 'error',
              title: 'Install failed',
              lines: [error instanceof Error ? error.message : String(error)],
            }
            state.installEndpointsPhase = 'result'
          }
        }
        return
      }

      if (state.installEndpointsPhase === 'result') {
        if (key.name === 'return' || key.name === 'y') {
          resetInstallEndpointsOverlay()
        }
        return
      }

      return
    }

    if (state.toolInstallPromptOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      const installPlan = state.toolInstallPromptPlan || getToolInstallPlan(state.toolInstallPromptMode)
      const installSupported = Boolean(installPlan?.supported)

      if (key.name === 'escape') {
        resetToolInstallPrompt()
        return
      }

      if (installSupported && key.name === 'up') {
        state.toolInstallPromptCursor = Math.max(0, state.toolInstallPromptCursor - 1)
        return
      }

      if (installSupported && key.name === 'down') {
        state.toolInstallPromptCursor = Math.min(1, state.toolInstallPromptCursor + 1)
        return
      }

      if (key.name === 'return') {
        if (!installSupported) {
          resetToolInstallPrompt()
          return
        }

        const selectedModel = state.toolInstallPromptModel
        const shouldInstall = state.toolInstallPromptCursor === 0
        resetToolInstallPrompt()

        if (!shouldInstall || !selectedModel) return
        await installMissingToolAndLaunch(selectedModel, installPlan)
      }

      return
    }

    // ─── Installed Models overlay keyboard handling ───────────────────────────
    if (state.installedModelsOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      const scanResults = state.installedModelsData || []
      let maxIndex = 0
      for (const toolResult of scanResults) {
        maxIndex += 1
        maxIndex += toolResult.models.length
      }
      if (maxIndex > 0) maxIndex--

      const pageStep = Math.max(1, (state.terminalRows || 1) - 4)

      if (key.name === 'up' || (key.shift && key.name === 'tab')) {
        state.installedModelsCursor = Math.max(0, state.installedModelsCursor - 1)
        return
      }
      if (key.name === 'down' || key.name === 'tab') {
        state.installedModelsCursor = Math.min(maxIndex, state.installedModelsCursor + 1)
        return
      }
      if (key.name === 'pageup') {
        state.installedModelsCursor = Math.max(0, state.installedModelsCursor - pageStep)
        return
      }
      if (key.name === 'pagedown') {
        state.installedModelsCursor = Math.min(maxIndex, state.installedModelsCursor + pageStep)
        return
      }
      if (key.name === 'home') {
        state.installedModelsCursor = 0
        return
      }
      if (key.name === 'end') {
        state.installedModelsCursor = maxIndex
        return
      }

      if (key.name === 'escape') {
        state.installedModelsOpen = false
        state.installedModelsCursor = 0
        return
      }

      if (key.name === 'return') {
        let currentIdx = 0
        for (const toolResult of scanResults) {
          if (currentIdx === state.installedModelsCursor) {
            return
          }
          currentIdx++
          for (const model of toolResult.models) {
            if (currentIdx === state.installedModelsCursor) {
              const selectedModel = {
                modelId: model.modelId,
                providerKey: model.providerKey,
                label: model.label,
              }

              state.installedModelsOpen = false
              await startExternalTool(toolResult.toolMode, selectedModel, state.config)
              return
            }
            currentIdx++
          }
        }
      }

      if (key.name === 'd') {
        let currentIdx = 0
        for (const toolResult of scanResults) {
          currentIdx++
          for (const model of toolResult.models) {
            if (currentIdx === state.installedModelsCursor) {
              softDeleteModel(toolResult.toolMode, model.modelId)
                .then((result) => {
                  if (result.success) {
                    openInstalledModelsOverlay()
                  } else {
                    state.installedModelsErrorMsg = `Failed to disable: ${result.error}`
                    setTimeout(() => { state.installedModelsErrorMsg = null }, 3000)
                  }
                })
                .catch((err) => {
                  state.installedModelsErrorMsg = `Failed to disable: ${err.message}`
                  setTimeout(() => { state.installedModelsErrorMsg = null }, 3000)
                })
              return
            }
            currentIdx++
          }
        }
      }

      return
    }

    // 📖 Incompatible fallback overlay: ↑↓ navigate across tool + model sections, Enter confirms, Esc cancels.
    // 📖 Cursor is a flat index: 0..N-1 = compatible tools, N..N+M-1 = similar models.
    if (state.incompatibleFallbackOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }

      const tools = state.incompatibleFallbackTools || []
      const similarModels = state.incompatibleFallbackSimilarModels || []
      const totalItems = tools.length + similarModels.length

      if (key.name === 'escape') {
        // 📖 Close the overlay and go back to the main table
        state.incompatibleFallbackOpen = false
        state.incompatibleFallbackCursor = 0
        state.incompatibleFallbackScrollOffset = 0
        state.incompatibleFallbackModel = null
        state.incompatibleFallbackTools = []
        state.incompatibleFallbackSimilarModels = []
        state.incompatibleFallbackSection = 'tools'
        return
      }

      if (key.name === 'up' && totalItems > 0) {
        state.incompatibleFallbackCursor = state.incompatibleFallbackCursor > 0
          ? state.incompatibleFallbackCursor - 1
          : totalItems - 1
        state.incompatibleFallbackSection = state.incompatibleFallbackCursor < tools.length ? 'tools' : 'models'
        return
      }

      if (key.name === 'down' && totalItems > 0) {
        state.incompatibleFallbackCursor = state.incompatibleFallbackCursor < totalItems - 1
          ? state.incompatibleFallbackCursor + 1
          : 0
        state.incompatibleFallbackSection = state.incompatibleFallbackCursor < tools.length ? 'tools' : 'models'
        return
      }

      if (key.name === 'return' && totalItems > 0) {
        const cursor = state.incompatibleFallbackCursor
        const fallbackModel = state.incompatibleFallbackModel

        // 📖 Close overlay state first
        state.incompatibleFallbackOpen = false
        state.incompatibleFallbackCursor = 0
        state.incompatibleFallbackScrollOffset = 0
        state.incompatibleFallbackModel = null
        state.incompatibleFallbackTools = []
        state.incompatibleFallbackSimilarModels = []
        state.incompatibleFallbackSection = 'tools'

        if (cursor < tools.length) {
          // 📖 Section 1: Switch to the selected compatible tool, then launch the original model
          const selectedToolKey = tools[cursor]
          setToolMode(selectedToolKey)
          // 📖 Find the full result object for the original model to pass to launchSelectedModel
          const fullModel = state.results.find(
            r => r.providerKey === fallbackModel.providerKey && r.modelId === fallbackModel.modelId
          )
          if (fullModel) {
            await launchSelectedModel(fullModel)
          }
        } else {
          // 📖 Section 2: Launch the selected similar model instead
          const modelIdx = cursor - tools.length
          const selectedSimilar = similarModels[modelIdx]
          if (selectedSimilar) {
            const fullModel = state.results.find(
              r => r.providerKey === selectedSimilar.providerKey && r.modelId === selectedSimilar.modelId
            )
            if (fullModel) {
              await launchSelectedModel(fullModel)
            }
          }
        }
      }

      return
    }



    // 📖 Help overlay: full keyboard navigation + key swallowing while overlay is open.
    if (state.helpVisible) {
      const pageStep = Math.max(1, (state.terminalRows || 1) - 2)
      if (key.name === 'escape' || (key.ctrl && key.name === 'h')) {
        state.helpVisible = false
        return
      }
      if (key.name === 'up' || key.name === 'k') { state.helpScrollOffset = Math.max(0, state.helpScrollOffset - 1); return }
      if (key.name === 'down' || key.name === 'j') { state.helpScrollOffset += 1; return }
      if (key.name === 'pageup') { state.helpScrollOffset = Math.max(0, state.helpScrollOffset - pageStep); return }
      if (key.name === 'pagedown') { state.helpScrollOffset += pageStep; return }
      if (key.name === 'home') { state.helpScrollOffset = 0; return }
      if (key.name === 'end') { state.helpScrollOffset = Number.MAX_SAFE_INTEGER; return }
      if (key.ctrl && key.name === 'c') { exit(0); return }
      return
    }

    // 📖 Token Usage overlay: Shift+T shows token history chart and today/all-time breakdowns.
    if (state.tokenUsageOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }
      const pageStep = Math.max(1, (state.terminalRows || 1) - 4)
      if (key.name === 'escape') {
        closeTokenUsageOverlay()
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        state.tokenUsageScrollOffset = Math.max(0, state.tokenUsageScrollOffset - 1)
        return
      }
      if (key.name === 'down' || key.name === 'j') {
        state.tokenUsageScrollOffset += 1
        return
      }
      if (key.name === 'pageup') {
        state.tokenUsageScrollOffset = Math.max(0, state.tokenUsageScrollOffset - pageStep)
        return
      }
      if (key.name === 'pagedown') {
        state.tokenUsageScrollOffset += pageStep
        return
      }
      if (key.name === 'home') {
        state.tokenUsageScrollOffset = 0
        return
      }
      if (key.name === 'end') {
        state.tokenUsageScrollOffset = Number.MAX_SAFE_INTEGER
        return
      }
      return
    }

    // 📖 Router Onboarding overlay: shown on first launch. Y=yes enable, N=not now, Esc=cancel.
    if (state.routerOnboardingOpen) {
      if (key.ctrl && key.name === 'c') { exit(0); return }
      if (state.routerOnboardingPhase === 'loading' || state.routerOnboardingPhase === 'success' || state.routerOnboardingPhase === 'error') {
        if (key.name === 'escape' || key.name === 'return') {
          state.routerOnboardingOpen = false
          // 📖 Mark onboarding as seen (don't show again)
          if (state.config?.router) {
            state.config.router.onboardingSeen = true
          }
          return
        }
        return
      }
      if (key.name === 'escape' || key.name === 'n') {
        state.routerOnboardingOpen = false
        // 📖 Mark as seen and disabled
        if (state.config?.router) {
          state.config.router.onboardingSeen = true
          state.config.router.enabled = false
        }
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        state.routerOnboardingCursor = 0
        return
      }
      if (key.name === 'down' || key.name === 'j') {
        state.routerOnboardingCursor = 1
        return
      }
      if (key.name === 'return' || key.name === 'y') {
        const shouldEnable = key.name === 'return' ? true : (state.routerOnboardingCursor === 0)
        if (!shouldEnable) {
          state.routerOnboardingOpen = false
          if (state.config?.router) {
            state.config.router.onboardingSeen = true
            state.config.router.enabled = false
          }
          return
        }
        // 📖 Enable router: start daemon in background and mark onboarding seen
        state.routerOnboardingPhase = 'loading'
        state.routerOnboardingError = null
        void (async () => {
          try {
            const binPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'free-coding-models.js')
            const child = spawn('node', [binPath, '--daemon-bg'], {
              detached: true,
              stdio: 'ignore',
            })
            child.unref()
            await new Promise((r) => setTimeout(r, 2000))
            if (state.routerOnboardingPhase === 'loading') {
              state.routerOnboardingPhase = 'success'
              if (state.config?.router) {
                state.config.router.enabled = true
                state.config.router.onboardingSeen = true
                saveConfig(state.config)
              }
              trackTelemetryEvent('app_router_install', { router_version: '0.4.0' })
              await new Promise((r) => setTimeout(r, 1500))
              state.routerOnboardingOpen = false
              openRouterDashboardOverlay(state)
            }
          } catch (err) {
            state.routerOnboardingPhase = 'error'
            state.routerOnboardingError = err?.message || 'Failed to start router'
          }
        })()
        return
      }
      return
    }

    // 📖 Changelog overlay: two-phase (index + details) with keyboard navigation
    if (state.changelogOpen) {
      const pageStep = Math.max(1, (state.terminalRows || 1) - 2)
      const changelogData = loadChangelog()
      const { versions } = changelogData
      const versionList = Object.keys(versions).sort((a, b) => {
        const aParts = a.split('.').map(Number)
        const bParts = b.split('.').map(Number)
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0
          const bVal = bParts[i] || 0
          if (bVal !== aVal) return bVal - aVal
        }
        return 0
      })

      // 📖 Close changelog overlay
      if (key.name === 'escape' || key.name === 'n') {
        state.changelogOpen = false
        state.changelogPhase = 'index'
        state.changelogCursor = 0
        state.changelogSelectedVersion = null
        return
      }

      if (state.changelogPhase === 'index') {
        // 📖 INDEX PHASE: Navigate through versions
        if (key.name === 'up') {
          state.changelogCursor = Math.max(0, state.changelogCursor - 1)
          return
        }
        if (key.name === 'down') {
          state.changelogCursor = Math.min(versionList.length - 1, state.changelogCursor + 1)
          return
        }
        if (key.name === 'home') { state.changelogCursor = 0; return }
        if (key.name === 'end') { state.changelogCursor = versionList.length - 1; return }
        if (key.name === 'return') {
          // 📖 Enter details phase for selected version
          state.changelogPhase = 'details'
          state.changelogSelectedVersion = versionList[state.changelogCursor]
          state.changelogScrollOffset = 0
          return
        }
      } else if (state.changelogPhase === 'details') {
        // 📖 DETAILS PHASE: Scroll through selected version details
        if (key.name === 'b') {
          // 📖 B = back to index
          state.changelogPhase = 'index'
          state.changelogScrollOffset = 0
          return
        }

        // 📖 Calculate total content lines for proper scroll boundary clamping
        const calcChangelogLines = () => {
          const lines = []
          lines.push(`  🚀 free-coding-models`)
          lines.push(`  📋 v${state.changelogSelectedVersion}`)
          lines.push(`  — ↑↓ / PgUp / PgDn scroll • B back • Esc close`)
          lines.push('')
          const changes = versions[state.changelogSelectedVersion]
          if (changes) {
            const sections = { added: '✨ Added', fixed: '🐛 Fixed', changed: '🔄 Changed', updated: '📝 Updated' }
            for (const [key, label] of Object.entries(sections)) {
              if (changes[key] && changes[key].length > 0) {
                lines.push(`  ${label}`)
                for (const item of changes[key]) {
                  let displayText = item.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
                  const maxWidth = state.terminalCols - 16
                  if (displayText.length > maxWidth) {
                    displayText = displayText.substring(0, maxWidth - 3) + '…'
                  }
                  lines.push(`    • ${displayText}`)
                }
                lines.push('')
              }
            }
          }
          return lines.length
        }
        const totalChangelogLines = calcChangelogLines()
        const viewportRows = Math.max(1, state.terminalRows || 1)
        const maxScrollOffset = Math.max(0, totalChangelogLines - viewportRows)

        // 📖 Circular wrap-around scrolling: up at top → bottom, down at bottom → top
        if (key.name === 'up') {
          state.changelogScrollOffset = state.changelogScrollOffset > 0
            ? state.changelogScrollOffset - 1
            : maxScrollOffset
          return
        }
        if (key.name === 'down') {
          state.changelogScrollOffset = state.changelogScrollOffset < maxScrollOffset
            ? state.changelogScrollOffset + 1
            : 0
          return
        }
        if (key.name === 'pageup') {
          state.changelogScrollOffset = state.changelogScrollOffset >= pageStep
            ? state.changelogScrollOffset - pageStep
            : maxScrollOffset - (pageStep - state.changelogScrollOffset - 1)
          return
        }
        if (key.name === 'pagedown') {
          state.changelogScrollOffset = state.changelogScrollOffset + pageStep <= maxScrollOffset
            ? state.changelogScrollOffset + pageStep
            : (state.changelogScrollOffset + pageStep - maxScrollOffset - 1)
          return
        }
        if (key.name === 'home') { state.changelogScrollOffset = 0; return }
        if (key.name === 'end') { state.changelogScrollOffset = maxScrollOffset; return }
      }

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
      const themeRowIdx = updateRowIdx + 1
      const favoritesModeRowIdx = themeRowIdx + 1
      const cleanupLegacyProxyRowIdx = favoritesModeRowIdx + 1
      const changelogViewRowIdx = cleanupLegacyProxyRowIdx + 1
      const shellEnvRowIdx = changelogViewRowIdx + 1
        // 📖 Profile system removed - API keys now persist permanently across all sessions
      const maxRowIdx = shellEnvRowIdx

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
            if (!state.config.apiKeys || typeof state.config.apiKeys !== 'object' || Array.isArray(state.config.apiKeys)) {
              state.config.apiKeys = {}
            }
            if (state.settingsAddKeyMode) {
              // 📖 Add-key mode: append new key (addApiKey handles duplicates/empty)
              addApiKey(state.config, pk, newKey)
            } else {
              // 📖 Edit mode: replace only the primary key and keep any extra rotated keys intact.
              const existingKeys = resolveApiKeys(state.config, pk)
              state.config.apiKeys[pk] = existingKeys.length > 1
                ? [newKey, ...existingKeys.slice(1)]
                : newKey
            }
            const saveResult = persistApiKeysForProvider(state.config, pk)
            if (!saveResult.success) {
              state.settingsErrorMsg = `⚠️  Failed to persist ${pk} API key: ${saveResult.error || 'Unknown error'}`
              setTimeout(() => { state.settingsErrorMsg = null }, 4000)
            } else {
              trackAppAction('api_key_saved', {
                provider_key: pk,
                key_action: state.settingsAddKeyMode ? 'add' : 'replace',
              })
            }
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
        const nextResults = MODELS
          .filter(([,,,,,pk]) => isProviderEnabled(state.config, pk))
          .map(([modelId, label, tier, sweScore, ctx, providerKey], i) => {
            // 📖 Try to reuse existing result to keep ping history
            const existing = state.results.find(r => r.modelId === modelId && r.providerKey === providerKey)
            if (existing) return existing
            return { idx: i + 1, modelId, label, tier, sweScore, ctx, providerKey, status: 'pending', pings: [], httpCode: null, isPinging: false, hidden: false }
          })
        // 📖 Re-index results
        nextResults.forEach((r, i) => { r.idx = i + 1 })
        state.results = nextResults
        setResults(nextResults)
        syncFavoriteFlags(state.results, state.config)
        applyTierFilter()
        refreshVisibleSorted({ resetCursor: false })
        // 📖 Re-ping all models that were 'noauth' (got 401 without key) but now have a key
        // 📖 This makes the TUI react immediately when a user adds an API key in settings
        const pingModel = getPingModel?.()
        if (pingModel) {
          state.results.forEach(r => {
            if (r.status === 'noauth' && getApiKey(state.config, r.providerKey)) {
              r.status = 'pending'
              r.pings = []
              r.httpCode = null
              r.isPinging = false
              pingModel(r).catch(() => {})
            }
          })
        }
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

        if (state.settingsCursor === themeRowIdx) {
          cycleGlobalTheme()
          return
        }

        if (state.settingsCursor === favoritesModeRowIdx) {
          toggleFavoritesDisplayMode()
          return
        }

        if (state.settingsCursor === cleanupLegacyProxyRowIdx) {
          runLegacyProxyCleanup()
          return
        }

        // 📖 Changelog row: Enter → open changelog overlay
        if (state.settingsCursor === changelogViewRowIdx) {
          state.settingsOpen = false
          state.changelogOpen = true
          state.changelogPhase = 'index'
          state.changelogCursor = 0
          state.changelogSelectedVersion = null
          state.changelogScrollOffset = 0
          return
        }

        // 📖 Shell env row: Enter → toggle shell env export
        if (state.settingsCursor === shellEnvRowIdx) {
          toggleShellEnv()
          return
        }

        // 📖 Profile system removed - API keys now persist permanently across all sessions

        // 📖 Enter edit mode for the selected provider's key
        const pk = providerKeys[state.settingsCursor]
        if (!pk) return
        state.settingsEditBuffer = resolveApiKeys(state.config, pk)[0] ?? ''
        state.settingsEditMode = true
        return
      }

      if (key.name === 'space') {
        // 📖 Exclude certain rows from space toggle
        if (
          state.settingsCursor === updateRowIdx
          || state.settingsCursor === cleanupLegacyProxyRowIdx
          || state.settingsCursor === changelogViewRowIdx
        ) return
        // 📖 Shell env toggle
        if (state.settingsCursor === shellEnvRowIdx) {
          toggleShellEnv()
          return
        }
        // 📖 Theme configuration cycle inside settings
        if (state.settingsCursor === themeRowIdx) {
          cycleGlobalTheme()
          return
        }
        if (state.settingsCursor === favoritesModeRowIdx) {
          toggleFavoritesDisplayMode()
          return
        }
        // 📖 Profile system removed - API keys now persist permanently across all sessions

        // 📖 Toggle enabled/disabled for selected provider
        const pk = providerKeys[state.settingsCursor]
        if (!state.config.providers) state.config.providers = {}
        if (!state.config.providers[pk]) state.config.providers[pk] = { enabled: true }
        state.config.providers[pk].enabled = !isProviderEnabled(state.config, pk)
        saveConfig(state.config)
        return
      }

      if (key.name === 't') {
        if (
          state.settingsCursor === updateRowIdx
          || state.settingsCursor === themeRowIdx
          || state.settingsCursor === favoritesModeRowIdx
          || state.settingsCursor === cleanupLegacyProxyRowIdx
          || state.settingsCursor === changelogViewRowIdx
        ) return
        // 📖 Profile system removed - API keys now persist permanently across all sessions

        // 📖 Test the selected provider's key (fires a real ping)
        const pk = providerKeys[state.settingsCursor]
        if (!pk) return
        testProviderKey(pk)
        return
      }

      if (key.name === 'u') {
        checkUpdatesFromSettings()
        return
      }

      // 📖 Y toggles favorites display mode directly from Settings.
      if (key.name === 'y') {
        toggleFavoritesDisplayMode()
        return
      }

        // 📖 Profile system removed - API keys now persist permanently across all sessions

      if (key.ctrl && key.name === 'c') { exit(0); return }

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
          const saveResult = persistApiKeysForProvider(state.config, pk)
          if (!saveResult.success) {
            state.settingsSyncStatus = { type: 'error', msg: `❌ Failed to save API key changes: ${saveResult.error || 'Unknown error'}` }
            return
          }
          const remaining = resolveApiKeys(state.config, pk).length
          const msg = remaining > 0
            ? `✅ Removed one key for ${pk} (${remaining} remaining)`
            : `✅ Removed last API key for ${pk}`
          state.settingsSyncStatus = { type: 'success', msg }
          trackAppAction('api_key_removed', {
            provider_key: pk,
            remaining_key_count: remaining,
          })
        }
        return
      }

      return // 📖 Swallow all other keys while settings is open
    }

    // 📖 P key: open settings screen
    if (key.name === 'p' && !key.shift && !key.ctrl && !key.meta) {
      openSettingsOverlay()
      return
    }

    // 📖 Q key: open Smart Recommend overlay
    if (key.name === 'q') {
      openRecommendOverlay()
      return
    }

    // 📖 Y key toggles favorites display mode (pinned+sticky vs normal rows).
    if (key.name === 'y' && !key.ctrl && !key.meta) {
      toggleFavoritesDisplayMode()
      return
    }

    // 📖 X clears the active free-text filter set from the command palette.
    if (key.name === 'x' && !key.ctrl && !key.meta) {
      if (!state.customTextFilter) return
      state.customTextFilter = null
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      return
    }

    // 📖 Profile system removed - API keys now persist permanently across all sessions

    // 📖 Shift+R intentionally stays unadvertised in the main UI, but remains
    // 📖 available as a tester entry point for the Router Dashboard.
    if (key.name === 'r' && key.shift && !key.ctrl && !key.meta) {
      openRouterDashboardOverlay(state)
      return
    }

    // 📖 Shift+T: open the Token Usage screen.
    if (key.name === 't' && key.shift && !key.ctrl && !key.meta) {
      openTokenUsageOverlay()
      return
    }

    // 📖 Shift+U: trigger immediate update when a newer version is known.
    if (key.name === 'u' && key.shift && state.startupLatestVersion && state.versionAlertsEnabled) {
      stopUi({ resetRawMode: true })
      runUpdate(state.startupLatestVersion)
      return
    }

    // 📖 Sorting keys: R=rank, O=origin, M=model, L=latest ping, A=avg ping, S=SWE-bench, C=context, H=health, V=verdict, B=stability, U=uptime, G=usage
    // 📖 T is reserved for tier filter cycling. Y toggles favorites display mode.
    // 📖 X clears the active custom text filter.
    // 📖 D is now reserved for provider filter cycling
    // 📖 Shift+R is reserved for the Router Dashboard; reset view remains in Ctrl+P.
    const sortKeys = {
      'r': 'rank', 'o': 'origin', 'm': 'model',
      'l': 'ping', 'a': 'avg', 's': 'swe', 'c': 'ctx', 'h': 'condition', 'v': 'verdict', 'b': 'stability', 'u': 'uptime'
    }

    if (sortKeys[key.name] && !key.ctrl && !key.shift) {
      const col = sortKeys[key.name]
      setSortColumnFromCommand(col)
      return
    }

    // 📖 F key: toggle favorite on the currently selected row and persist to config.
    if (key.name === 'f') {
      toggleFavoriteOnSelectedRow()
      return
    }



    // 📖 W cycles the supported ping modes:
    // 📖 speed (2s) → normal (10s) → slow (30s) → forced (4s) → speed.
    // 📖 forced ignores auto speed/slow transitions until the user leaves it manually.
    if (key.name === 'w' && !key.alt && !key.ctrl && !key.meta) {
      const currentIdx = PING_MODE_CYCLE.indexOf(state.pingMode)
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % PING_MODE_CYCLE.length : 0
      setPingMode(PING_MODE_CYCLE[nextIdx], 'manual')
      return
    }

    // 📖 E toggles hiding models whose provider has no configured API key.
    // 📖 The preference is saved globally.
    if (key.name === 'e') {
      state.hideUnconfiguredModels = !state.hideUnconfiguredModels
      if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
      state.config.settings.hideUnconfiguredModels = state.hideUnconfiguredModels
      saveConfig(state.config)
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      return
    }

    // 📖 Tier toggle key: T = cycle through each individual tier (All → S+ → S → A+ → A → A- → B+ → B → C → All)
    if (key.name === 't') {
      state.tierFilterMode = (state.tierFilterMode + 1) % TIER_CYCLE.length
      applyTierFilter()
      // 📖 Recompute visible sorted list and reset cursor to avoid stale index into new filtered set
      refreshVisibleSorted({ resetCursor: true })
      persistUiSettings()
      return
    }

    // 📖 Provider filter key: D = cycle through each provider (All → NIM → Groq → ... → All)
    if (key.name === 'd') {
      state.originFilterMode = (state.originFilterMode + 1) % ORIGIN_CYCLE.length
      applyTierFilter()
      // 📖 Recompute visible sorted list and reset cursor to avoid stale index into new filtered set
      refreshVisibleSorted({ resetCursor: true })
      persistUiSettings()
      return
    }

    // 📖 Verdict filter key: V = cycle through each verdict (All → Perfect → Normal → Slow → ... → All)
    if (key.name === 'v') {
      state.verdictFilterMode = (state.verdictFilterMode + 1) % VERDICT_CYCLE.length
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      persistUiSettings()
      return
    }

    // 📖 Health filter key: H = cycle through each health status (All → Up → Timeout → Down → ... → All)
    if (key.name === 'h') {
      state.healthFilterMode = (state.healthFilterMode + 1) % HEALTH_CYCLE.length
      applyTierFilter()
      refreshVisibleSorted({ resetCursor: true })
      persistUiSettings()
      return
    }

    // 📖 Help overlay key: I = toggle help overlay
    if (key.name === 'i') {
      state.helpVisible = !state.helpVisible
      if (state.helpVisible) state.helpScrollOffset = 0
      return
    }

    // 📖 Changelog overlay key: N = toggle changelog overlay
    if (key.name === 'n') {
      state.changelogOpen = !state.changelogOpen
      if (state.changelogOpen) {
        state.changelogScrollOffset = 0
        state.changelogPhase = 'index'
        state.changelogCursor = 0
        state.changelogSelectedVersion = null
      }
      return
    }

    // 📖 Mode toggle key: Z cycles through the supported tool targets.
    if (key.name === 'z') {
      cycleToolMode()
      return
    }

    if (key.shift && key.name === 'up') {
      const selected = state.visibleSorted?.[state.cursor]
      if (selected?.isFavorite) {
        reorderFavorite(state.config, selected.providerKey, selected.modelId, 'up')
        syncFavoriteFlags(state.results, state.config)
        applyTierFilter()
        refreshVisibleSorted({ resetCursor: false })
      }
      return
    }

    if (key.shift && key.name === 'down') {
      const selected = state.visibleSorted?.[state.cursor]
      if (selected?.isFavorite) {
        reorderFavorite(state.config, selected.providerKey, selected.modelId, 'down')
        syncFavoriteFlags(state.results, state.config)
        applyTierFilter()
        refreshVisibleSorted({ resetCursor: false })
      }
      return
    }

    if (key.name === 'up' || key.name === 'k') {
      // 📖 Main list wrap navigation: top -> bottom on Up / K (vim-style).
      const count = state.visibleSorted.length
      if (count === 0) return
      state.cursor = state.cursor > 0 ? state.cursor - 1 : count - 1
      adjustScrollOffset(state)
      return
    }

    if (key.name === 'down' || key.name === 'j') {
      // 📖 Main list wrap navigation: bottom -> top on Down / J (vim-style).
      const count = state.visibleSorted.length
      if (count === 0) return
      state.cursor = state.cursor < count - 1 ? state.cursor + 1 : 0
      adjustScrollOffset(state)
      return
    }

    // 📖 Esc can dismiss the narrow-terminal warning immediately without quitting the app.
    if (key.name === 'escape' && state.terminalCols > 0 && state.terminalCols < WIDTH_WARNING_MIN_COLS) {
      state.widthWarningDismissed = true
      return
    }

    if (key.name === 'return') { // Enter
      const selected = state.visibleSorted[state.cursor]
      if (!selected) return

      if (!isModelCompatibleWithTool(selected.providerKey, state.mode)) {
        const compatTools = getCompatibleTools(selected.providerKey)
        const similarModels = findSimilarCompatibleModels(
          selected.sweScore || '-',
          state.mode,
          state.results.filter(r => r.providerKey !== selected.providerKey || r.modelId !== selected.modelId),
          3
        )
        state.incompatibleFallbackOpen = true
        state.incompatibleFallbackCursor = 0
        state.incompatibleFallbackScrollOffset = 0
        state.incompatibleFallbackModel = {
          modelId: selected.modelId,
          label: selected.label,
          tier: selected.tier,
          providerKey: selected.providerKey,
          sweScore: selected.sweScore || '-',
        }
        state.incompatibleFallbackTools = compatTools
        state.incompatibleFallbackSimilarModels = similarModels
        state.incompatibleFallbackSection = 'tools'
        return
      }

      if (shouldCheckMissingTool(state.mode) && !isToolInstalled(state.mode)) {
        state.toolInstallPromptOpen = true
        state.toolInstallPromptCursor = 0
        state.toolInstallPromptScrollOffset = 0
        state.toolInstallPromptMode = state.mode
        state.toolInstallPromptModel = {
          modelId: selected.modelId,
          label: selected.label,
          tier: selected.tier,
          providerKey: selected.providerKey,
          status: selected.status,
        }
        state.toolInstallPromptPlan = getToolInstallPlan(state.mode)
        state.toolInstallPromptErrorMsg = null
        return
      }

      await launchSelectedModel(selected)
    }
  }
}

/**
 * 📖 createMouseEventHandler: Factory that returns a handler for structured mouse events.
 * 📖 Works alongside the keypress handler — shares the same state and action functions.
 *
 * 📖 Supported interactions:
 *   - Click on header row column → sort by that column (or cycle tier filter for Tier column)
 *   - Click on model row → move cursor to that row
 *   - Double-click on model row → select the model (Enter)
 *   - Scroll up/down → navigate cursor up/down (with wrap-around)
 *   - Scroll in overlays → scroll overlay content
 *
 * @param {object} ctx — same context object passed to createKeyHandler
 * @returns {function} — callback for onMouseEvent in createMouseHandler()
 */
export function createMouseEventHandler(ctx) {
  const {
    state,
    adjustScrollOffset,
    applyTierFilter,
    TIER_CYCLE,
    noteUserActivity,
    sortResultsWithPinnedFavorites,
    saveConfig,
    overlayLayout,
    // 📖 Favorite toggle deps — used by right-click on model rows
    toggleFavoriteModel,
    syncFavoriteFlags,
    toFavoriteKey,
    // 📖 Tool mode cycling — used by compat column header click
    cycleToolMode,
  } = ctx

  // 📖 Shared helper: set the sort column, toggling direction if same column clicked twice.
  function setSortColumnFromClick(col) {
    if (state.sortColumn === col) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      state.sortColumn = col
      state.sortDirection = 'asc'
    }
    // 📖 Recompute visible sorted list to reflect new sort order
    const visible = state.results.filter(r => !r.hidden)
    state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection, {
      pinFavorites: state.favoritesPinnedAndSticky,
    })
  }

  // 📖 Shared helper: persist UI settings after mouse-triggered changes
  function persistUiSettings() {
    if (!state.config) return
    if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
    state.config.settings.sortColumn = state.sortColumn
    state.config.settings.sortDirection = state.sortDirection
    state.config.settings.tierFilter = TIER_CYCLE[state.tierFilterMode] || null
  }

  // 📖 Shared helper: toggle favorite on a specific model row index.
  // 📖 Mirrors the keyboard F-key handler but operates at a given index.
  function toggleFavoriteAtRow(modelIdx) {
    const selected = state.visibleSorted[modelIdx]
    if (!selected) return
    const wasFavorite = selected.isFavorite
    toggleFavoriteModel(state.config, selected.providerKey, selected.modelId)
    syncFavoriteFlags(state.results, state.config)
    applyTierFilter()
    const visible = state.results.filter(r => !r.hidden)
    state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection, {
      pinFavorites: state.favoritesPinnedAndSticky,
    })
    // 📖 If we unfavorited while pinned mode is on, reset cursor to top
    if (wasFavorite && state.favoritesPinnedAndSticky) {
      state.cursor = 0
      state.scrollOffset = 0
      return
    }
    // 📖 Otherwise, track the model's new position after re-sort
    const selectedKey = toFavoriteKey(selected.providerKey, selected.modelId)
    const newCursor = state.visibleSorted.findIndex(r => toFavoriteKey(r.providerKey, r.modelId) === selectedKey)
    if (newCursor >= 0) state.cursor = newCursor
    adjustScrollOffset(state)
  }

  // 📖 Shared helper: map a terminal row (1-based) to a cursor index using
  // 📖 an overlay's cursorLineByRow map and scroll offset.
  // 📖 Returns the cursor index, or -1 if no match.
  function overlayRowToCursor(y, cursorToLineMap, scrollOffset) {
    // 📖 Terminal row Y (1-based) → line index in the overlay lines array.
    // 📖 sliceOverlayLines shows lines from [scrollOffset .. scrollOffset + terminalRows).
    // 📖 Terminal row 1 = line[scrollOffset], row 2 = line[scrollOffset+1], etc.
    const lineIdx = (y - 1) + scrollOffset
    for (const [cursorStr, lineNum] of Object.entries(cursorToLineMap)) {
      if (lineNum === lineIdx) return parseInt(cursorStr, 10)
    }
    return -1
  }

  return (evt) => {
    noteUserActivity()
    const layout = getLastLayout()

    // ── Scroll events ──────────────────────────────────────────────────
    if (evt.type === 'scroll-up' || evt.type === 'scroll-down') {
      // 📖 Overlay scroll: if any overlay is open, scroll its content
      if (state.helpVisible) {
        const step = evt.type === 'scroll-up' ? -3 : 3
        state.helpScrollOffset = Math.max(0, (state.helpScrollOffset || 0) + step)
        return
      }
      if (state.changelogOpen) {
        const step = evt.type === 'scroll-up' ? -3 : 3
        state.changelogScrollOffset = Math.max(0, (state.changelogScrollOffset || 0) + step)
        return
      }
      if (state.settingsOpen) {
        // 📖 Settings overlay uses cursor navigation, not scroll offset.
        // 📖 Move settingsCursor up/down instead of scrolling.
        if (evt.type === 'scroll-up') {
          state.settingsCursor = Math.max(0, (state.settingsCursor || 0) - 1)
        } else {
          const max = overlayLayout?.settingsMaxRow ?? 99
          state.settingsCursor = Math.min(max, (state.settingsCursor || 0) + 1)
        }
        return
      }
      if (state.recommendOpen) {
        // 📖 Recommend questionnaire phase: scroll moves cursor through options
        if (state.recommendPhase === 'questionnaire') {
          const step = evt.type === 'scroll-up' ? -1 : 1
          state.recommendCursor = Math.max(0, (state.recommendCursor || 0) + step)
        } else {
          const step = evt.type === 'scroll-up' ? -1 : 1
          state.recommendScrollOffset = Math.max(0, (state.recommendScrollOffset || 0) + step)
        }
        return
      }

      if (state.commandPaletteOpen) {
        // 📖 Command palette: scroll the results list
        const count = state.commandPaletteResults?.length || 0
        if (count === 0) return
        if (evt.type === 'scroll-up') {
          state.commandPaletteCursor = state.commandPaletteCursor > 0 ? state.commandPaletteCursor - 1 : count - 1
        } else {
          state.commandPaletteCursor = state.commandPaletteCursor < count - 1 ? state.commandPaletteCursor + 1 : 0
        }
        return
      }
      if (state.installEndpointsOpen) {
        // 📖 Install endpoints: move cursor up/down
        if (evt.type === 'scroll-up') {
          state.installEndpointsCursor = Math.max(0, (state.installEndpointsCursor || 0) - 1)
        } else {
          state.installEndpointsCursor = (state.installEndpointsCursor || 0) + 1
        }
        return
      }
      if (state.toolInstallPromptOpen) {
        // 📖 Tool install prompt: move cursor up/down
        if (evt.type === 'scroll-up') {
          state.toolInstallPromptCursor = Math.max(0, (state.toolInstallPromptCursor || 0) - 1)
        } else {
          state.toolInstallPromptCursor = (state.toolInstallPromptCursor || 0) + 1
        }
        return
      }
      if (state.installedModelsOpen) {
        const scanResults = state.installedModelsData || []
        let maxIndex = 0
        for (const toolResult of scanResults) {
          maxIndex += 1
          maxIndex += toolResult.models.length
        }
        if (maxIndex > 0) maxIndex--

        if (evt.type === 'scroll-up') {
          state.installedModelsCursor = Math.max(0, (state.installedModelsCursor || 0) - 1)
        } else {
          state.installedModelsCursor = Math.min(maxIndex, (state.installedModelsCursor || 0) + 1)
        }
        return
      }
      if (state.routerDashboardOpen) {
        const step = evt.type === 'scroll-up' ? -3 : 3
        state.routerDashboardScrollOffset = Math.max(0, (state.routerDashboardScrollOffset || 0) + step)
        return
      }

      // 📖 Main table scroll: move cursor up/down with wrap-around
      const count = state.visibleSorted.length
      if (count === 0) return
      if (evt.type === 'scroll-up') {
        state.cursor = state.cursor > 0 ? state.cursor - 1 : count - 1
      } else {
        state.cursor = state.cursor < count - 1 ? state.cursor + 1 : 0
      }
      adjustScrollOffset(state)
      return
    }

    // ── Click / double-click events ────────────────────────────────────
    if (evt.type !== 'click' && evt.type !== 'double-click') return

    const { x, y } = evt

    // ── Overlay click handling ─────────────────────────────────────────
    // 📖 When an overlay is open, handle clicks inside it or close it.
    // 📖 Priority order matches the rendering priority in app.js.

    if (state.commandPaletteOpen) {
      // 📖 Command palette is a floating modal — detect clicks inside vs outside.
      const cp = overlayLayout
      const insideModal = cp &&
        x >= (cp.commandPaletteLeft || 0) && x <= (cp.commandPaletteRight || 0) &&
        y >= (cp.commandPaletteTop || 0) && y <= (cp.commandPaletteBottom || 0)

      if (insideModal) {
        // 📖 Check if click is in the body area (result rows)
        const bodyStart = cp.commandPaletteBodyStartRow || 0
        const bodyEnd = bodyStart + (cp.commandPaletteBodyRows || 0) - 1
        if (y >= bodyStart && y <= bodyEnd) {
          // 📖 Map terminal row → cursor index via the cursorToLine map + scroll offset
          const cursorIdx = overlayRowToCursor(
            y - bodyStart + 1, // 📖 Normalize: row within body → 1-based for overlayRowToCursor
            cp.commandPaletteCursorToLine,
            cp.commandPaletteScrollOffset
          )
          if (cursorIdx >= 0) {
            state.commandPaletteCursor = cursorIdx
            if (evt.type === 'double-click') {
              // 📖 Double-click executes the selected command (same as Enter)
              process.stdin.emit('keypress', '\r', { name: 'return', ctrl: false, meta: false, shift: false })
            }
            return
          }
        }
        // 📖 Click inside modal but not on a result row — ignore (don't close)
        return
      }

      // 📖 Click outside the modal → close (Escape equivalent)
      state.commandPaletteOpen = false
      state.commandPaletteFrozenTable = null
      state.commandPaletteQuery = ''
      state.commandPaletteCursor = 0
      state.commandPaletteScrollOffset = 0
      state.commandPaletteResults = []
      return
    }

    if (state.installEndpointsOpen) {
      // 📖 Install endpoints overlay: click closes (Escape equivalent)
      state.installEndpointsOpen = false
      return
    }

    if (state.toolInstallPromptOpen) {
      // 📖 Tool install prompt: click closes (Escape equivalent)
      state.toolInstallPromptOpen = false
      return
    }

    if (state.installedModelsOpen) {
      state.installedModelsOpen = false
      return
    }

    if (state.routerDashboardOpen) {
      closeRouterDashboardOverlay(state)
      return
    }

    if (state.incompatibleFallbackOpen) {
      // 📖 Incompatible fallback: click closes
      state.incompatibleFallbackOpen = false
      return
    }



    if (state.helpVisible) {
      // 📖 Help overlay: click anywhere closes (same as K or Escape)
      state.helpVisible = false
      return
    }

    if (state.changelogOpen) {
      // 📖 Changelog overlay: click on a version row selects it, otherwise close.
      if (overlayLayout && state.changelogPhase === 'index') {
        const cursorIdx = overlayRowToCursor(
          y,
          overlayLayout.changelogCursorToLine,
          overlayLayout.changelogScrollOffset
        )
        if (cursorIdx >= 0) {
          state.changelogCursor = cursorIdx
          // 📖 Double-click opens the selected version's details (same as Enter)
          if (evt.type === 'double-click') {
            process.stdin.emit('keypress', '\r', { name: 'return', ctrl: false, meta: false, shift: false })
          }
          return
        }
      }
      // 📖 Click outside version list → close (Escape equivalent)
      // 📖 In details phase, click anywhere goes back (same as B key)
      if (state.changelogPhase === 'details') {
        state.changelogPhase = 'index'
        state.changelogScrollOffset = 0
      } else {
        state.changelogOpen = false
      }
      return
    }

    if (state.recommendOpen) {
      if (state.recommendPhase === 'questionnaire' && overlayLayout?.recommendOptionRows) {
        // 📖 Map click Y to the specific questionnaire option row
        const optRows = overlayLayout.recommendOptionRows
        for (const [idxStr, row] of Object.entries(optRows)) {
          if (y === row) {
            state.recommendCursor = parseInt(idxStr, 10)
            if (evt.type === 'double-click') {
              // 📖 Double-click confirms the option (same as Enter)
              process.stdin.emit('keypress', '\r', { name: 'return', ctrl: false, meta: false, shift: false })
            }
            return
          }
        }
        // 📖 Click outside option rows in questionnaire — ignore (don't close)
        return
      }
      // 📖 Result phase: click closes. Analyzing phase: click does nothing.
      if (state.recommendPhase === 'results') {
        state.recommendOpen = false
        state.recommendPhase = null
        state.recommendResults = []
        state.recommendScrollOffset = 0
      }
      return
    }

    if (state.settingsOpen) {
      // 📖 Settings overlay: click on a provider/maintenance row moves cursor there.
      // 📖 Don't handle clicks during edit/add-key mode (keyboard is primary).
      if (state.settingsEditMode || state.settingsAddKeyMode) return

      if (overlayLayout) {
        const cursorIdx = overlayRowToCursor(
          y,
          overlayLayout.settingsCursorToLine,
          overlayLayout.settingsScrollOffset
        )
        if (cursorIdx >= 0 && cursorIdx <= (overlayLayout.settingsMaxRow || 99)) {
          state.settingsCursor = cursorIdx
          // 📖 Double-click triggers the Enter action (edit key / toggle / run action)
          if (evt.type === 'double-click') {
            process.stdin.emit('keypress', '\r', { name: 'return', ctrl: false, meta: false, shift: false })
          }
          return
        }
      }
      // 📖 Click outside any recognized row does nothing in Settings
      // 📖 (user can Escape or press P to close)
      return
    }

    // ── Main table click handling ──────────────────────────────────────
    // 📖 No overlay is open — clicks go to the main table.

    // 📖 Check if click is on the column header row → trigger sort
    if (y === layout.headerRow) {
      const col = layout.columns.find(c => x >= c.xStart && x <= c.xEnd)
      if (col) {
        const sortKey = COLUMN_SORT_MAP[col.name]
        if (sortKey) {
          setSortColumnFromClick(sortKey)
          persistUiSettings()
        } else if (col.name === 'tier') {
          // 📖 Clicking the Tier header cycles the tier filter (same as T key)
          state.tierFilterMode = (state.tierFilterMode + 1) % TIER_CYCLE.length
          applyTierFilter()
          const visible = state.results.filter(r => !r.hidden)
          state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection, {
            pinFavorites: state.favoritesPinnedAndSticky,
          })
          state.cursor = 0
          state.scrollOffset = 0
          persistUiSettings()
        }
      }
      return
    }

    // 📖 Check if click is on a model row → move cursor (or select on double-click)
    // 📖 Right-click toggles favorite on that row (same as F key)
    if (y >= layout.firstModelRow && y <= layout.lastModelRow) {
      const rowOffset = y - layout.firstModelRow
      const modelIdx = layout.viewportStartIdx + rowOffset
      if (modelIdx >= layout.viewportStartIdx && modelIdx < layout.viewportEndIdx) {
        state.cursor = modelIdx
        adjustScrollOffset(state)

        if (evt.button === 'right') {
          // 📖 Right-click: toggle favorite on this model row
          toggleFavoriteAtRow(modelIdx)
        } else if (evt.type === 'double-click') {
          // 📖 Double-click triggers the Enter action (select model).
          process.stdin.emit('keypress', '\r', { name: 'return', ctrl: false, meta: false, shift: false })
        }
      }
      return
    }

    // ── Footer hotkey click zones ──────────────────────────────────────
    // 📖 Check if click lands on a footer hotkey zone and emit the corresponding keypress.
    if (layout.footerHotkeys && layout.footerHotkeys.length > 0) {
      const zone = layout.footerHotkeys.find(z => y === z.row && x >= z.xStart && x <= z.xEnd)
      if (zone) {
        // 📖 Update banner click: stop TUI and run the npm update + relaunch.
        if (zone.key === 'update-click' && state.startupLatestVersion && state.versionAlertsEnabled) {
          stopUi({ resetRawMode: true })
          runUpdate(state.startupLatestVersion)
          return
        }
        // 📖 Map the footer zone key to a synthetic keypress.
        // 📖 Most are single-character keys; special cases like ctrl+p need special handling.
        if (zone.key === 'ctrl+p') {
          process.stdin.emit('keypress', '\x10', { name: 'p', ctrl: true, meta: false, shift: false })
        } else if (zone.key === 'shift+r') {
          process.stdin.emit('keypress', 'R', { name: 'r', ctrl: false, meta: false, shift: true })
        } else {
          process.stdin.emit('keypress', zone.key, { name: zone.key, ctrl: false, meta: false, shift: false })
        }
        return
      }
    }

    // 📖 Clicks outside any recognized zone are silently ignored.
  }
}
