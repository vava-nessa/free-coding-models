/**
 * @file key-handler.js
 * @description Factory for the main TUI keypress handler and provider key-test model selection.
 *
 * @details
 *   This module encapsulates the full onKeyPress switch used by the TUI,
 *   including settings navigation, install-endpoint flow, overlays, profile management, and
 *   OpenCode/OpenClaw launch actions. It also keeps the live key bindings
 *   aligned with the highlighted letters shown in the table headers.
 *
 *   It also owns the "test key" model selection used by the Settings overlay.
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

// 📖 Some providers need an explicit probe model because the first catalog entry
// 📖 is not guaranteed to be accepted by their chat endpoint.
const PROVIDER_TEST_MODEL_OVERRIDES = {
  sambanova: ['DeepSeek-V3-0324'],
  nvidia: ['deepseek-ai/deepseek-v3.1-terminus', 'openai/gpt-oss-120b'],
}

// 📖 Settings key tests retry retryable failures across several models so a
// 📖 single stale catalog entry or transient timeout does not mark a valid key as dead.
const SETTINGS_TEST_MAX_ATTEMPTS = 10
const SETTINGS_TEST_RETRY_DELAY_MS = 4000

// 📖 Sleep helper kept local to this module so the Settings key test flow can
// 📖 back off between retries without leaking timer logic into the rest of the TUI.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    startRecommendAnalysis,
    stopRecommendAnalysis,
    sendFeatureRequest,
    sendBugReport,
    stopUi,
    ping,
    getPingModel,
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
    setResults,
    readline,
  } = ctx

  let userSelected = null

  // ─── Settings key test helper ───────────────────────────────────────────────
  // 📖 Fires a single ping to the selected provider to verify the API key works.
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
        // 📖 Discovery failure is non-fatal; we still have repo-defined fallbacks.
        discoveryNote = `Live model discovery failed (${err?.name || 'error'}); falling back to the repo catalog.`
      }
    }

    const candidateModels = listProviderTestModels(providerKey, src, discoveredModelIds)
    if (candidateModels.length === 0) {
      state.settingsTestResults[providerKey] = 'fail'
      state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'fail', [], discoveryNote || 'No candidate model was available for probing.')
      return
    }
    const attempts = []

    for (let attemptIndex = 0; attemptIndex < SETTINGS_TEST_MAX_ATTEMPTS; attemptIndex++) {
      const testModel = candidateModels[attemptIndex % candidateModels.length]
      const { code } = await ping(testKey, testModel, providerKey, src.url)
      attempts.push({ attempt: attemptIndex + 1, model: testModel, code })

      if (code === '200') {
        state.settingsTestResults[providerKey] = 'ok'
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'ok', attempts, discoveryNote)
        return
      }

      const outcome = classifyProviderTestOutcome(attempts.map(({ code: attemptCode }) => attemptCode))
      if (outcome === 'auth_error') {
        state.settingsTestResults[providerKey] = 'auth_error'
        state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, 'auth_error', attempts, discoveryNote)
        return
      }

      if (attemptIndex < SETTINGS_TEST_MAX_ATTEMPTS - 1) {
        state.settingsTestDetails[providerKey] = `Testing ${providerLabel}... probe ${attemptIndex + 1}/${SETTINGS_TEST_MAX_ATTEMPTS} failed on ${testModel} (${code}). Retrying in ${SETTINGS_TEST_RETRY_DELAY_MS / 1000}s.`
        await sleep(SETTINGS_TEST_RETRY_DELAY_MS)
      }
    }

    const finalOutcome = classifyProviderTestOutcome(attempts.map(({ code }) => code))
    state.settingsTestResults[providerKey] = finalOutcome
    state.settingsTestDetails[providerKey] = buildProviderTestDetail(providerLabel, finalOutcome, attempts, discoveryNote)
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

  function resetInstallEndpointsOverlay() {
    state.installEndpointsOpen = false
    state.installEndpointsPhase = 'providers'
    state.installEndpointsCursor = 0
    state.installEndpointsScrollOffset = 0
    state.installEndpointsProviderKey = null
    state.installEndpointsToolMode = null
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
    state.installEndpointsPhase = 'result'
    state.installEndpointsCursor = 0
    state.installEndpointsScrollOffset = 0
    state.installEndpointsErrorMsg = null
  }

  return async (str, key) => {
    if (!key) return
    noteUserActivity()

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
            tierFilter: TIER_CYCLE[state.tierFilterMode],
            sortColumn: state.sortColumn,
            sortAsc: state.sortDirection === 'asc',
            pingInterval: state.pingInterval,
            hideUnconfiguredModels: state.hideUnconfiguredModels,
            proxy: getProxySettings(state.config),
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

    // 📖 Install Endpoints overlay: provider → tool → scope → optional model subset.
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
      const proxySettings = getProxySettings(state.config)
      const providerKeys = Object.keys(sources)
      const updateRowIdx = providerKeys.length
      const proxyEnabledRowIdx = updateRowIdx + 1
      const proxySyncRowIdx = updateRowIdx + 2
      const proxyPortRowIdx = updateRowIdx + 3
      const proxyCleanupRowIdx = updateRowIdx + 4
      // 📖 Profile rows start after maintenance + proxy rows — one row per saved profile
      const savedProfiles = listProfiles(state.config)
      const profileStartIdx = updateRowIdx + 5
      const maxRowIdx = savedProfiles.length > 0 ? profileStartIdx + savedProfiles.length - 1 : proxyCleanupRowIdx

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

      // 📖 Dedicated inline editor for the preferred proxy port. 0 = OS auto-port.
      if (state.settingsProxyPortEditMode) {
        if (key.name === 'return') {
          const raw = state.settingsProxyPortBuffer.trim()
          const parsed = raw === '' ? 0 : Number.parseInt(raw, 10)
          if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
            state.settingsSyncStatus = { type: 'error', msg: '❌ Proxy port must be 0 (auto) or a number between 1 and 65535' }
            return
          }
          if (!state.config.settings) state.config.settings = {}
          state.config.settings.proxy = { ...proxySettings, preferredPort: parsed }
          saveConfig(state.config)
          state.settingsProxyPortEditMode = false
          state.settingsProxyPortBuffer = ''
          state.settingsSyncStatus = { type: 'success', msg: `✅ Preferred proxy port saved: ${parsed === 0 ? 'auto' : parsed}` }
        } else if (key.name === 'escape') {
          state.settingsProxyPortEditMode = false
          state.settingsProxyPortBuffer = ''
        } else if (key.name === 'backspace') {
          state.settingsProxyPortBuffer = state.settingsProxyPortBuffer.slice(0, -1)
        } else if (str && /^[0-9]$/.test(str) && state.settingsProxyPortBuffer.length < 5) {
          state.settingsProxyPortBuffer += str
        }
        return
      }

      // 📖 Normal settings navigation
      if (key.name === 'escape' || key.name === 'p') {
        // 📖 Close settings — rebuild results to reflect provider changes
        state.settingsOpen = false
        state.settingsEditMode = false
        state.settingsAddKeyMode = false
        state.settingsProxyPortEditMode = false
        state.settingsProxyPortBuffer = ''
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
        const visible = state.results.filter(r => !r.hidden)
        state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
        if (state.cursor >= state.visibleSorted.length) state.cursor = Math.max(0, state.visibleSorted.length - 1)
        adjustScrollOffset(state)
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

        if (state.settingsCursor === proxyPortRowIdx) {
          state.settingsProxyPortEditMode = true
          state.settingsProxyPortBuffer = String(proxySettings.preferredPort || 0)
          return
        }

        if (state.settingsCursor === proxyCleanupRowIdx) {
          const cleaned = cleanupOpenCodeProxyConfig()
          state.settingsSyncStatus = {
            type: 'success',
            msg: `✅ Proxy cleanup done (${cleaned.removedProvider ? 'provider removed' : 'no provider found'}, ${cleaned.removedModel ? 'default model cleared' : 'default model unchanged'})`,
          }
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
              setPingMode(intervalToPingMode(settings.pingInterval || PING_INTERVAL), 'manual')
              if (settings.tierFilter) {
                const tierIdx = TIER_CYCLE.indexOf(settings.tierFilter)
                if (tierIdx >= 0) state.tierFilterMode = tierIdx
              } else {
                state.tierFilterMode = 0
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
        if (state.settingsCursor === updateRowIdx || state.settingsCursor === proxyPortRowIdx || state.settingsCursor === proxyCleanupRowIdx) return
        // 📖 Profile rows don't respond to Space
        if (state.settingsCursor >= profileStartIdx) return

        if (state.settingsCursor === proxyEnabledRowIdx || state.settingsCursor === proxySyncRowIdx) {
          if (!state.config.settings) state.config.settings = {}
          state.config.settings.proxy = {
            ...proxySettings,
            enabled: state.settingsCursor === proxyEnabledRowIdx ? !proxySettings.enabled : proxySettings.enabled,
            syncToOpenCode: state.settingsCursor === proxySyncRowIdx ? !proxySettings.syncToOpenCode : proxySettings.syncToOpenCode,
          }
          saveConfig(state.config)
          state.settingsSyncStatus = {
            type: 'success',
            msg: state.settingsCursor === proxyEnabledRowIdx
              ? `✅ Proxy mode ${state.config.settings.proxy.enabled ? 'enabled' : 'disabled'}`
              : `✅ OpenCode proxy sync ${state.config.settings.proxy.syncToOpenCode ? 'enabled' : 'disabled'}`,
          }
          return
        }

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
            if (!proxySettings.enabled) {
              state.settingsSyncStatus = { type: 'error', msg: '⚠ Enable Proxy mode first if you want to sync fcm-proxy into OpenCode' }
              return
            }
            if (!proxySettings.syncToOpenCode) {
              state.settingsSyncStatus = { type: 'error', msg: '⚠ Enable "Persist proxy in OpenCode" first, or use the direct OpenCode flow only' }
              return
            }
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
      state.settingsProxyPortEditMode = false
      state.settingsProxyPortBuffer = ''
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

    // 📖 Y key: open Install Endpoints flow for configured providers.
    if (key.name === 'y') {
      state.installEndpointsOpen = true
      state.installEndpointsPhase = 'providers'
      state.installEndpointsCursor = 0
      state.installEndpointsScrollOffset = 0
      state.installEndpointsProviderKey = null
      state.installEndpointsToolMode = null
      state.installEndpointsScope = null
      state.installEndpointsSelectedModelIds = new Set()
      state.installEndpointsErrorMsg = null
      state.installEndpointsResult = null
      return
    }

    // 📖 Shift+P: cycle through profiles (or show profile picker)
    if (key.name === 'p' && key.shift) {
      const profiles = listProfiles(state.config)
      if (profiles.length === 0) {
        // 📖 No profiles saved — save current config as 'default' profile
        saveAsProfile(state.config, 'default', {
          tierFilter: TIER_CYCLE[state.tierFilterMode],
          sortColumn: state.sortColumn,
          sortAsc: state.sortDirection === 'asc',
          pingInterval: state.pingInterval,
          hideUnconfiguredModels: state.hideUnconfiguredModels,
          proxy: getProxySettings(state.config),
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
            setPingMode(intervalToPingMode(settings.pingInterval || PING_INTERVAL), 'manual')
            if (settings.tierFilter) {
              const tierIdx = TIER_CYCLE.indexOf(settings.tierFilter)
              if (tierIdx >= 0) state.tierFilterMode = tierIdx
            } else {
              state.tierFilterMode = 0
            }
            state.hideUnconfiguredModels = settings.hideUnconfiguredModels === true
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

    // 📖 Sorting keys: R=rank, O=origin, M=model, L=latest ping, A=avg ping, S=SWE-bench, C=context, H=health, V=verdict, B=stability, U=uptime, G=usage
    // 📖 T is reserved for tier filter cycling. Y now opens the install-endpoints flow.
    // 📖 D is now reserved for provider filter cycling
    const sortKeys = {
      'r': 'rank', 'o': 'origin', 'm': 'model',
      'l': 'ping', 'a': 'avg', 's': 'swe', 'c': 'ctx', 'h': 'condition', 'v': 'verdict', 'b': 'stability', 'u': 'uptime', 'g': 'usage'
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

    // 📖 W cycles the supported ping modes:
    // 📖 speed (2s) → normal (10s) → slow (30s) → forced (4s) → speed.
    // 📖 forced ignores auto speed/slow transitions until the user leaves it manually.
    if (key.name === 'w') {
      const currentIdx = PING_MODE_CYCLE.indexOf(state.pingMode)
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % PING_MODE_CYCLE.length : 0
      setPingMode(PING_MODE_CYCLE[nextIdx], 'manual')
    }

    // 📖 E toggles hiding models whose provider has no configured API key.
    // 📖 The preference is saved globally and mirrored into the active profile.
    if (key.name === 'e') {
      state.hideUnconfiguredModels = !state.hideUnconfiguredModels
      if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
      state.config.settings.hideUnconfiguredModels = state.hideUnconfiguredModels
      if (state.activeProfile && state.config.profiles?.[state.activeProfile]) {
        const profile = state.config.profiles[state.activeProfile]
        if (!profile.settings || typeof profile.settings !== 'object') profile.settings = {}
        profile.settings.hideUnconfiguredModels = state.hideUnconfiguredModels
      }
      saveConfig(state.config)
      applyTierFilter()
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    // 📖 Tier toggle key: T = cycle through each individual tier (All → S+ → S → A+ → A → A- → B+ → B → C → All)
    if (key.name === 't') {
      state.tierFilterMode = (state.tierFilterMode + 1) % TIER_CYCLE.length
      applyTierFilter()
      // 📖 Recompute visible sorted list and reset cursor to avoid stale index into new filtered set
      const visible = state.results.filter(r => !r.hidden)
      state.visibleSorted = sortResultsWithPinnedFavorites(visible, state.sortColumn, state.sortDirection)
      state.cursor = 0
      state.scrollOffset = 0
      return
    }

    // 📖 Provider filter key: D = cycle through each provider (All → NIM → Groq → ... → All)
    if (key.name === 'd') {
      state.originFilterMode = (state.originFilterMode + 1) % ORIGIN_CYCLE.length
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

    // 📖 Mode toggle key: Z cycles through the supported tool targets.
    if (key.name === 'z') {
      const modeOrder = getToolModeOrder()
      const currentIndex = modeOrder.indexOf(state.mode)
      const nextIndex = (currentIndex + 1) % modeOrder.length
      state.mode = modeOrder[nextIndex]
      if (!state.config.settings || typeof state.config.settings !== 'object') state.config.settings = {}
      state.config.settings.preferredToolMode = state.mode
      if (state.activeProfile && state.config.profiles?.[state.activeProfile]) {
        const profile = state.config.profiles[state.activeProfile]
        if (!profile.settings || typeof profile.settings !== 'object') profile.settings = {}
        profile.settings.preferredToolMode = state.mode
      }
      saveConfig(state.config)
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

    // 📖 Esc can dismiss the narrow-terminal warning immediately without quitting the app.
    if (key.name === 'escape' && state.terminalCols > 0 && state.terminalCols < 166) {
      state.widthWarningDismissed = true
      return
    }

    if (key.name === 'return') { // Enter
      // 📖 Use the cached visible+sorted array — guaranteed to match what's on screen
      const selected = state.visibleSorted[state.cursor]
      if (!selected) return // 📖 Guard: empty visible list (all filtered out)
      // 📖 Allow selecting ANY model (even timeout/down) - user knows what they're doing
      userSelected = { modelId: selected.modelId, label: selected.label, tier: selected.tier, providerKey: selected.providerKey }

      // 📖 Stop everything and act on selection immediately
      readline.emitKeypressEvents(process.stdin)
      process.stdin.setRawMode(true)
      stopUi()

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
          console.log(chalk.yellow(`  The selected tool may not be able to use ${selected.label}.`))
          console.log(chalk.dim(`  Set ${ENV_VAR_NAMES[selected.providerKey] || selected.providerKey.toUpperCase() + '_API_KEY'} or configure via settings (P key).`))
          console.log()
        }
      }

      // 📖 Dispatch to the correct integration based on active mode
      if (state.mode === 'openclaw') {
        await startOpenClaw(userSelected, apiKey)
      } else if (state.mode === 'opencode-desktop') {
        await startOpenCodeDesktop(userSelected, state.config)
      } else if (state.mode === 'opencode') {
        const topology = buildProxyTopologyFromConfig(state.config)
        if (isProxyEnabledForConfig(state.config) && topology.accounts.length > 0) {
          await startProxyAndLaunch(userSelected, state.config)
        } else {
          if (isProxyEnabledForConfig(state.config) && topology.accounts.length === 0) {
            console.log(chalk.yellow('  Proxy mode is enabled, but no proxy-capable API keys were found. Falling back to direct flow.'))
            console.log()
          }
          await startOpenCode(userSelected, state.config)
        }
      } else {
        await startExternalTool(state.mode, userSelected, state.config)
      }
      process.exit(0)
    }
  }
}
