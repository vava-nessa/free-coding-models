/**
 * @file overlays.js
 * @description Factory for TUI overlay renderers and recommend analysis flow.
 *
 * @details
 *   This module centralizes all overlay rendering in one place:
 *   - Settings, Install Endpoints, Command Palette, Help, Smart Recommend, Changelog, Router Dashboard
 *   - Settings diagnostics for provider key tests, including wrapped retry/error details
 *   - Recommend analysis timer orchestration and progress updates
 *
 *   The factory pattern keeps stateful UI logic isolated while still
 *   allowing the main CLI to control shared state and dependencies.
 *
 *   → Functions:
 *   - `createOverlayRenderers` — returns renderer + analysis helpers + overlayLayout
 *   - `renderRouterDashboard` — mounts the Smart Model Router dashboard renderer
 *
 * @exports { createOverlayRenderers }
 * @see ./key-handler.js — handles keypresses for all overlay interactions
 */

import { loadChangelog } from './changelog-loader.js'
import { buildCliHelpLines } from './cli-help.js'
import { renderRouterDashboard as renderRouterDashboardOverlay } from './router-dashboard.js'
import { themeColors, getThemeStatusLabel, getProviderRgb } from './theme.js'

export function createOverlayRenderers(state, deps) {
  const {
    chalk,
    sources,
    PROVIDER_METADATA,
    PROVIDER_COLOR,
    LOCAL_VERSION,
    getApiKey,
    resolveApiKeys,
    isProviderEnabled,
    TIER_CYCLE,
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
    getPingModel,
    getConfiguredInstallableProviders,
    getInstallTargetModes,
    getProviderCatalogModels,
    getToolMeta,
    getToolInstallPlan,
    padEndDisplay,
    displayWidth,
  } = deps

  const bullet = (isCursor) => (isCursor ? themeColors.accentBold('  ❯ ') : themeColors.dim('    '))
  const activeThemeSetting = () => state.config.settings?.theme || 'auto'

  // 📖 Wrap plain diagnostic text so long Settings messages stay readable inside
  // 📖 the overlay instead of turning into one truncated red line.
  // 📖 Uses 100% of terminal width minus padding for better readability.
  const wrapPlainText = (text, width = null) => {
    const effectiveWidth = width || (state.terminalCols - 16)
    const normalized = typeof text === 'string' ? text.trim() : ''
    if (!normalized) return []
    const words = normalized.split(/\s+/)
    const lines = []
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > effectiveWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    if (current) lines.push(current)
    return lines
  }

  // 📖 Overlay layout tracking: records cursor-to-line mappings and scroll offsets
  // 📖 so the mouse handler can map terminal click coordinates → overlay cursor positions.
  // 📖 Updated each render frame by the active overlay renderer.
  const overlayLayout = {
    settingsCursorToLine: {},   // 📖 cursor index → line index in pre-scroll lines array
    settingsScrollOffset: 0,   // 📖 current scroll offset applied by sliceOverlayLines
    settingsMaxRow: 0,         // 📖 maximum valid settingsCursor index
    installEndpointsCursorToLine: {},
    installEndpointsScrollOffset: 0,
    installEndpointsMaxRow: 0,
    commandPaletteCursorToLine: {},
    commandPaletteScrollOffset: 0,
    commandPaletteBodyStartRow: 0, // 📖 1-based terminal row where CP results begin
    commandPaletteBodyRows: 0,
    commandPaletteLeft: 0,
    commandPaletteRight: 0,
    commandPaletteTop: 0,
    commandPaletteBottom: 0,
    changelogCursorToLine: {},
    changelogScrollOffset: 0,
    recommendOptionRows: {},       // 📖 option index → 1-based terminal row (questionnaire phase)
  }

  // ─── Settings screen renderer ─────────────────────────────────────────────
  // 📖 renderSettings: Draw the settings overlay in the alt screen buffer.
  // 📖 Shows all providers with their API key (masked) + enabled state.
  // 📖 When in edit mode (settingsEditMode=true), shows an inline input field.
  // 📖 Key "T" in settings = test API key for selected provider.
  function renderSettings() {
    const providerKeys = Object.keys(sources)
    const updateRowIdx = providerKeys.length
    const themeRowIdx = updateRowIdx + 1
    const favoritesModeRowIdx = themeRowIdx + 1
    const startupAiSpeedScanRowIdx = favoritesModeRowIdx + 1
    const cleanupLegacyProxyRowIdx = startupAiSpeedScanRowIdx + 1
    const changelogViewRowIdx = cleanupLegacyProxyRowIdx + 1
    const shellEnvRowIdx = changelogViewRowIdx + 1
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}

    // 📖 Branding header
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${themeColors.textBold('⚙  Settings')}`)

    if (state.settingsErrorMsg) {
      lines.push(`  ${themeColors.errorBold(state.settingsErrorMsg)}`)
      lines.push('')
    }

    lines.push(`  ${themeColors.textBold('🧩 Providers')}`)
    // 📖 Dynamic separator line using 100% terminal width
    const separatorWidth = Math.max(20, state.terminalCols - 10)
    lines.push(`  ${themeColors.dim('  ' + '─'.repeat(separatorWidth))}`)
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
        const modePrefix = state.settingsAddKeyMode ? themeColors.dim('[+] ') : ''
        keyDisplay = themeColors.accentBold(`${modePrefix}${state.settingsEditBuffer || ''}▏`)
      } else if (keyCount > 0) {
        // 📖 Show the primary (first/string) key masked + count indicator for extras
        const primaryKey = allKeys[0]
        const visible = primaryKey.slice(-4)
        const masked = '•'.repeat(Math.min(16, Math.max(4, primaryKey.length - 4)))
        const keyMasked = themeColors.dim(masked + visible)
        const extra = keyCount > 1 ? themeColors.info(` (+${keyCount - 1} more)`) : ''
        keyDisplay = keyMasked + extra
      } else {
        keyDisplay = themeColors.dim('(no key set)')
      }

      // 📖 Test result badge
      const testResult = state.settingsTestResults[pk]
      // 📖 Default badge reflects configuration first: a saved key should look
      // 📖 ready to test even before the user has run the probe once.
      let testBadge = keyCount > 0 ? themeColors.info('[Test]') : themeColors.dim('[Missing Key 🔑]')
      if (testResult === 'pending') testBadge = themeColors.warning('[Testing…]')
      else if (testResult === 'ok')   testBadge = themeColors.successBold('[Test ✅]')
      else if (testResult === 'missing_key') testBadge = themeColors.dim('[Missing Key 🔑]')
      else if (testResult === 'auth_error') testBadge = themeColors.error('[Auth ❌]')
      else if (testResult === 'rate_limited') testBadge = themeColors.warning('[Rate limit ⏳]')
      else if (testResult === 'no_callable_model') testBadge = chalk.rgb(...getProviderRgb('openrouter'))('[No model ⚠]')
      else if (testResult === 'fail') testBadge = themeColors.error('[Test ❌]')
      // 📖 No truncation of rate limits - overlay now uses 100% terminal width
      const rateSummary = themeColors.dim(meta.rateLimits || 'No limit info')

      const enabledBadge = enabled ? themeColors.successBold('✅') : themeColors.errorBold('❌')
      // 📖 Color provider names the same way as in the main table
      const providerRgb = PROVIDER_COLOR[pk] ?? [105, 190, 245]
      const providerName = chalk.bold.rgb(...providerRgb)((meta.label || src.name || pk).slice(0, 22).padEnd(22))

      const row = `${bullet(isCursor)}[ ${enabledBadge} ] ${providerName}  ${padEndDisplay(keyDisplay, 30)}  ${testBadge}  ${rateSummary}`
      cursorLineByRow[i] = lines.length
      lines.push(isCursor ? themeColors.bgCursor(row) : row)
    }

    lines.push('')
    const selectedProviderKey = providerKeys[Math.min(state.settingsCursor, providerKeys.length - 1)]
    const selectedSource = sources[selectedProviderKey]
    const selectedMeta = PROVIDER_METADATA[selectedProviderKey] || {}
    if (selectedSource && state.settingsCursor < providerKeys.length) {
      const selectedKey = getApiKey(state.config, selectedProviderKey)
      const setupStatus = selectedKey ? themeColors.success('API key detected ✅') : themeColors.warning('API key missing ⚠')
      // 📖 Color the provider name in the setup instructions header
      const selectedProviderRgb = PROVIDER_COLOR[selectedProviderKey] ?? [105, 190, 245]
      const coloredProviderName = chalk.bold.rgb(...selectedProviderRgb)(selectedMeta.label || selectedSource.name || selectedProviderKey)
      lines.push(`  ${themeColors.textBold('Setup Instructions')} — ${coloredProviderName}`)
      lines.push(themeColors.dim(`  1) Create a ${selectedMeta.label || selectedSource.name} account: ${selectedMeta.signupUrl || 'signup link missing'}`))
      lines.push(themeColors.dim(`  2) ${selectedMeta.signupHint || 'Generate an API key and paste it with Enter on this row'}`))
      lines.push(themeColors.dim(`  3) Press ${themeColors.hotkey('T')} to test your key. Status: ${setupStatus}`))
      if (selectedProviderKey === 'cloudflare') {
        const hasAccountId = Boolean((process.env.CLOUDFLARE_ACCOUNT_ID || '').trim())
        const accountIdStatus = hasAccountId ? themeColors.success('CLOUDFLARE_ACCOUNT_ID detected ✅') : themeColors.warning('Set CLOUDFLARE_ACCOUNT_ID ⚠')
        lines.push(themeColors.dim(`  4) Export ${themeColors.hotkey('CLOUDFLARE_ACCOUNT_ID')} in your shell. Status: ${accountIdStatus}`))
      }
      const testDetail = state.settingsTestDetails?.[selectedProviderKey]
      if (testDetail) {
        lines.push('')
        lines.push(themeColors.errorBold('  Test Diagnostics'))
        for (const detailLine of wrapPlainText(testDetail)) {
          lines.push(themeColors.error(`  ${detailLine}`))
        }
      }
      lines.push('')
    }

    lines.push('')
    lines.push(`  ${themeColors.textBold('🛠 Maintenance')}`)
    lines.push(`  ${themeColors.dim('  ' + '─'.repeat(separatorWidth))}`)
    lines.push('')

    const updateCursor = state.settingsCursor === updateRowIdx
    const updateState = state.settingsUpdateState
    const latestFound = state.settingsUpdateLatestVersion
    const updateActionLabel = updateState === 'available' && latestFound
      ? `Install update (v${latestFound})`
      : 'Check for updates manually'
    let updateStatus = themeColors.dim('Press Enter or U to check npm registry')
    if (updateState === 'checking') updateStatus = themeColors.warning('Checking npm registry…')
    if (updateState === 'available' && latestFound) updateStatus = themeColors.successBold(`Update available: v${latestFound} (Enter to install)`)
    if (updateState === 'up-to-date') updateStatus = themeColors.success('Already on latest version')
    if (updateState === 'error') updateStatus = themeColors.error('Check failed (press U to retry)')
    if (updateState === 'installing') updateStatus = themeColors.info('Installing update…')
    const updateRow = `${bullet(updateCursor)}${themeColors.textBold(updateActionLabel).padEnd(44)} ${updateStatus}`
    cursorLineByRow[updateRowIdx] = lines.length
    lines.push(updateCursor ? themeColors.bgCursor(updateRow) : updateRow)
    const themeStatus = getThemeStatusLabel(activeThemeSetting())
    const themeStatusColor = themeStatus.includes('Dark') ? themeColors.warningBold : themeColors.info
    const themeRow = `${bullet(state.settingsCursor === themeRowIdx)}${themeColors.textBold('Global Theme').padEnd(44)} ${themeStatusColor(themeStatus)}`
    cursorLineByRow[themeRowIdx] = lines.length
    lines.push(state.settingsCursor === themeRowIdx ? themeColors.bgCursor(themeRow) : themeRow)

    // 📖 Favorites mode row mirrors Y-key behavior from the main table.
    const favoritesModeEnabled = state.favoritesPinnedAndSticky === true
    const favoritesModeStatus = favoritesModeEnabled
      ? themeColors.warningBold('Pinned + always visible')
      : themeColors.info('Normal rows (filter/sort)')
    const favoritesModeRow = `${bullet(state.settingsCursor === favoritesModeRowIdx)}${themeColors.textBold('Favorites Display Mode').padEnd(44)} ${favoritesModeStatus}`
    cursorLineByRow[favoritesModeRowIdx] = lines.length
    lines.push(state.settingsCursor === favoritesModeRowIdx ? themeColors.bgCursorSettingsList(favoritesModeRow) : favoritesModeRow)

    // 📖 Startup AI Speed Scan row controls the opt-in Ctrl+U auto-run at launch.
    const startupAiSpeedScanEnabled = state.config.settings?.runAiSpeedTestOnStartup === true
    const startupAiSpeedScanStatus = startupAiSpeedScanEnabled
      ? themeColors.successBold('✅ Enabled — runs Ctrl+U after startup')
      : themeColors.dim('❌ Disabled — manual Ctrl+U only')
    const startupAiSpeedScanRow = `${bullet(state.settingsCursor === startupAiSpeedScanRowIdx)}${themeColors.textBold('Startup AI Speed Scan').padEnd(44)} ${startupAiSpeedScanStatus}`
    cursorLineByRow[startupAiSpeedScanRowIdx] = lines.length
    lines.push(state.settingsCursor === startupAiSpeedScanRowIdx ? themeColors.bgCursorSettingsList(startupAiSpeedScanRow) : startupAiSpeedScanRow)

    if (updateState === 'error' && state.settingsUpdateError) {
      lines.push(themeColors.error(`      ${state.settingsUpdateError}`))
    }

    // 📖 Cleanup row removes stale proxy-era config left behind by older builds.
    const cleanupLegacyProxyRow = `${bullet(state.settingsCursor === cleanupLegacyProxyRowIdx)}${themeColors.textBold('Clean Legacy Proxy Config').padEnd(44)} ${themeColors.warning('Enter remove discontinued bridge leftovers')}`
    cursorLineByRow[cleanupLegacyProxyRowIdx] = lines.length
    lines.push(state.settingsCursor === cleanupLegacyProxyRowIdx ? themeColors.bgCursorLegacy(cleanupLegacyProxyRow) : cleanupLegacyProxyRow)

    // 📖 Changelog viewer row
    const changelogViewRow = `${bullet(state.settingsCursor === changelogViewRowIdx)}${themeColors.textBold('View Changelog').padEnd(44)} ${themeColors.dim('Enter browse version history')}`
    cursorLineByRow[changelogViewRowIdx] = lines.length
    lines.push(state.settingsCursor === changelogViewRowIdx ? themeColors.bgCursorSettingsList(changelogViewRow) : changelogViewRow)

    // 📖 Shell env toggle — expose API keys as shell environment variables
    const shellEnvSetting = state.config.settings?.shellEnvEnabled
    const shellEnvStatus = shellEnvSetting === true
      ? themeColors.successBold('✅ Enabled — keys available in shell')
      : shellEnvSetting === false
        ? themeColors.dim('❌ Disabled')
        : themeColors.warning('🔘 Not configured — Enter to set up')
    const shellEnvRow = `${bullet(state.settingsCursor === shellEnvRowIdx)}${themeColors.textBold('Shell Env Export').padEnd(44)} ${shellEnvStatus}`
    cursorLineByRow[shellEnvRowIdx] = lines.length
    lines.push(state.settingsCursor === shellEnvRowIdx ? themeColors.bgCursorSettingsList(shellEnvRow) : shellEnvRow)

    // 📖 Profile system removed - API keys now persist permanently across all sessions

    lines.push('')
    if (state.settingsEditMode) {
      lines.push(themeColors.dim('  Type API key  •  Enter Save  •  Esc Cancel'))
    } else {
      lines.push(themeColors.dim('  ↑↓ Navigate  •  Enter Edit/Run/Cycle  •  + Add key  •  - Remove key  •  Space Toggle/Cycle  •  T Test key  •  U Updates  •  G Theme  •  Y Favorites  •  Esc Close'))
    }
    // 📖 Show sync/restore status message if set
    if (state.settingsSyncStatus) {
      const { type, msg } = state.settingsSyncStatus
      lines.push(type === 'success' ? themeColors.successBold(`  ${msg}`) : themeColors.warning(`  ${msg}`))
    }
    lines.push('')

    // 📖 Footer with credits + community links — Discord and Buy me a coffee
    // 📖 live here (and in the onboarding) instead of the main TUI footer to
    // 📖 keep the table chrome lean.
    lines.push('')
    lines.push(
      themeColors.dim('  ') +
      themeColors.footerLove('Made with 💖 & ☕ by ') +
      themeColors.link('\x1b]8;;https://github.com/vava-nessa\x1b\\vava-nessa\x1b]8;;\x1b\\') +
      themeColors.dim('  •  💬 ') +
      themeColors.footerDiscord('\x1b]8;;https://discord.gg/ZTNFHvvCkU\x1b\\Join the Discord\x1b]8;;\x1b\\') +
      themeColors.dim('  •  ☕ ') +
      themeColors.footerCoffee('\x1b]8;;https://buymeacoffee.com/vavanessadev\x1b\\Buy me a coffee\x1b]8;;\x1b\\') +
      themeColors.dim('  •  ') +
      'Esc to close'
    )

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

    // 📖 Mouse support: record layout so click handler can map Y → settingsCursor
    overlayLayout.settingsCursorToLine = { ...cursorLineByRow }
    overlayLayout.settingsScrollOffset = offset
    overlayLayout.settingsMaxRow = shellEnvRowIdx

    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }

  // ─── Install Endpoints overlay renderer ───────────────────────────────────
  // 📖 renderInstallEndpoints drives the provider → tool → scope → model flow
  // 📖 opened from Settings/Command Palette. It deliberately reuses the same overlay viewport
  // 📖 helpers as Settings so long provider/model lists stay navigable.
  function renderInstallEndpoints() {
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}
    const providerChoices = getConfiguredInstallableProviders(state.config)
    const toolChoices = getInstallTargetModes().filter(t => !(state.installEndpointsProviderKey === 'fcm_router' && t === 'fcm_router'))
    const totalSteps = 4
    const scopeChoices = [
      {
        key: 'all',
        label: 'Install all models',
        hint: 'Recommended — FCM will refresh this provider catalog automatically later.',
      },
      {
        key: 'selected',
        label: 'Install selected models only',
        hint: 'Choose a smaller curated subset for a cleaner model picker.',
      },
    ]
    const selectedProviderLabel = state.installEndpointsProviderKey === 'fcm_router' 
      ? 'Smart Router Daemon' 
      : state.installEndpointsProviderKey
        ? (sources[state.installEndpointsProviderKey]?.name || state.installEndpointsProviderKey)
        : '—'

    // 📖 Resolve tool label from metadata instead of hard-coded switch
    const selectedToolLabel = state.installEndpointsToolMode
      ? (() => {
          const meta = getToolMeta(state.installEndpointsToolMode)
          const suffix = state.installEndpointsToolMode.startsWith('opencode') ? ' (shared opencode.json)' : ''
          return `${meta.label}${suffix}`
        })()
      : '—'

    const selectedConnectionLabel = 'Direct Provider'

    lines.push('')
    // 📖 Branding header
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${themeColors.textBold('🔌 Install Endpoints')}`)
    lines.push('')
    lines.push(themeColors.dim('  — install provider catalogs into supported coding tools'))
    if (state.installEndpointsErrorMsg) {
      lines.push(`  ${themeColors.warning(state.installEndpointsErrorMsg)}`)
    }
    lines.push('')

    if (state.installEndpointsPhase === 'providers') {
      lines.push(`  ${themeColors.textBold(`Step 1/${totalSteps}`)}  ${themeColors.info('Choose a configured provider')}`)
      lines.push('')

      if (providerChoices.length === 0) {
        lines.push(themeColors.dim('  No configured providers can be installed directly right now.'))
        lines.push(themeColors.dim('  Add an API key in Settings (`P`) first, then reopen this screen.'))
      } else {
        providerChoices.forEach((provider, idx) => {
          const isCursor = idx === state.installEndpointsCursor
          const row = `${bullet(isCursor)}${themeColors.textBold(provider.label.padEnd(24))} ${themeColors.dim(`${provider.modelCount} models`)}`
          cursorLineByRow[idx] = lines.length
          lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
        })
      }

      lines.push('')
      lines.push(themeColors.dim('  ↑↓ Navigate  •  Enter Choose provider  •  Esc Close'))
    } else if (state.installEndpointsPhase === 'tools') {
      lines.push(`  ${themeColors.textBold(`Step 2/${totalSteps}`)}  ${themeColors.info('Choose the target tool')}`)
      lines.push(themeColors.dim(`  Provider: ${selectedProviderLabel}`))
      lines.push('')

      // 📖 Use getToolMeta for labels instead of hard-coded ternary chains
      toolChoices.forEach((toolMode, idx) => {
        const isCursor = idx === state.installEndpointsCursor
        const meta = getToolMeta(toolMode)
        const label = `${meta.emoji} ${meta.label}`
        const note = toolMode.startsWith('opencode')
          ? themeColors.dim('shared config file')
          : toolMode === 'openhands'
            ? themeColors.dim('env file (~/.fcm-*-env)')
            : themeColors.dim('managed config install')
        const row = `${bullet(isCursor)}${themeColors.textBold(label.padEnd(26))} ${note}`
        cursorLineByRow[idx] = lines.length
        lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
      })

      lines.push('')
      lines.push(themeColors.dim('  ↑↓ Navigate  •  Enter Choose tool  •  Esc Back'))
    } else if (state.installEndpointsPhase === 'scope') {
      lines.push(`  ${themeColors.textBold(`Step 3/${totalSteps}`)}  ${themeColors.info('Choose the install scope')}`)
      lines.push(themeColors.dim(`  Provider: ${selectedProviderLabel}  •  Tool: ${selectedToolLabel}  •  ${selectedConnectionLabel}`))
      lines.push('')

      scopeChoices.forEach((scope, idx) => {
        const isCursor = idx === state.installEndpointsCursor
        const row = `${bullet(isCursor)}${themeColors.textBold(scope.label)}`
        cursorLineByRow[idx] = lines.length
        lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
        lines.push(themeColors.dim(`      ${scope.hint}`))
        lines.push('')
      })

      lines.push(themeColors.dim('  Enter Continue  •  Esc Back'))
    } else if (state.installEndpointsPhase === 'models') {
      const models = getProviderCatalogModels(state.installEndpointsProviderKey)
      const selectedCount = state.installEndpointsSelectedModelIds.size

      lines.push(`  ${themeColors.textBold(`Step 4/${totalSteps}`)}  ${themeColors.info('Choose which models to install')}`)
      lines.push(themeColors.dim(`  Provider: ${selectedProviderLabel}  •  Tool: ${selectedToolLabel}  •  ${selectedConnectionLabel}`))
      lines.push(themeColors.dim(`  Selected: ${selectedCount}/${models.length}`))
      lines.push('')

      models.forEach((model, idx) => {
        const isCursor = idx === state.installEndpointsCursor
        const selected = state.installEndpointsSelectedModelIds.has(model.modelId)
        const checkbox = selected ? themeColors.successBold('[✓]') : themeColors.dim('[ ]')
        const tier = themeColors.info(model.tier.padEnd(2))
        const row = `${bullet(isCursor)}${checkbox} ${themeColors.textBold(model.label.padEnd(26))} ${tier} ${themeColors.dim(model.ctx.padEnd(6))} ${themeColors.dim(model.modelId)}`
        cursorLineByRow[idx] = lines.length
        lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
      })

      lines.push('')
      lines.push(themeColors.dim('  ↑↓ Navigate  •  Space Toggle model  •  A All/None  •  Enter Install  •  Esc Back'))
    } else if (state.installEndpointsPhase === 'result') {
      const result = state.installEndpointsResult
      const accent = result?.type === 'success' ? themeColors.successBold : themeColors.errorBold
      lines.push(`  ${themeColors.textBold('Result')}  ${accent(result?.title || 'Install result unavailable')}`)
      lines.push('')

      for (const detail of result?.lines || []) {
        lines.push(`  ${detail}`)
      }

      if (result?.type === 'success') {
        lines.push('')
        lines.push(themeColors.dim('  Future FCM launches will refresh this catalog automatically when the provider list evolves.'))
      }

      lines.push('')
      lines.push(themeColors.dim('  Enter or Esc Close'))
    }

    const targetLine = cursorLineByRow[state.installEndpointsCursor] ?? 0
    state.toolInstallPromptScrollOffset = keepOverlayTargetVisible(
      state.toolInstallPromptScrollOffset,
      targetLine,
      lines.length,
      state.terminalRows
    )
    const { visible, offset } = sliceOverlayLines(lines, state.toolInstallPromptScrollOffset, state.terminalRows)
    state.toolInstallPromptScrollOffset = offset

    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    const cleared = tintedLines.map((line) => line + EL)
    return cleared.join('\n')
  }

  // ─── Installed Models Manager overlay renderer ─────────────────────────────
  // 📖 renderInstalledModels displays all models configured in external tools
  // 📖 Shows tool configs, model lists, and provides actions (Launch, Disable, Reinstall)
  function renderInstalledModels() {
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}

    lines.push('')
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${themeColors.textBold('🗂️  Installed Models Manager')}`)
    lines.push('')
    lines.push(themeColors.dim('  — models configured in your tools'))

    if (state.installedModelsErrorMsg) {
      lines.push(`  ${themeColors.warning(state.installedModelsErrorMsg)}`)
    }

    if (state.installedModelsErrorMsg === 'Scanning...') {
      lines.push(themeColors.dim('  Scanning tool configs, please wait...'))
      const targetLine = 5
      state.installedModelsScrollOffset = keepOverlayTargetVisible(
        state.installedModelsScrollOffset,
        targetLine,
        lines.length,
        state.terminalRows
      )
      const { visible, offset } = sliceOverlayLines(lines, state.installedModelsScrollOffset, state.terminalRows)
      state.installedModelsScrollOffset = offset

      overlayLayout.installedModelsCursorToLine = cursorLineByRow
      overlayLayout.installedModelsScrollOffset = offset

      const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
      const cleared = tintedLines.map((l) => l + EL)
      return cleared.join('\n')
    }

    lines.push('')

    const scanResults = state.installedModelsData || []

    if (scanResults.length === 0) {
      lines.push(themeColors.dim('  No tool configs found.'))
      lines.push(themeColors.dim('  Install a tool (Goose, Crush, Aider, etc.) to get started.'))
    } else {
      let globalIdx = 0

      for (const toolResult of scanResults) {
        const { toolMode, toolLabel, toolEmoji, configPath, isValid, hasManagedMarker, models } = toolResult

        lines.push('')
        const isCursor = globalIdx === state.installedModelsCursor

        const statusIcon = isValid ? themeColors.successBold('✅') : themeColors.errorBold('⚠️')
        const toolHeader = `${bullet(isCursor)}${toolEmoji} ${themeColors.textBold(toolLabel)} ${statusIcon}`
        cursorLineByRow[globalIdx++] = lines.length
        lines.push(isCursor ? themeColors.bgCursor(toolHeader) : toolHeader)

        const configShortPath = configPath.replace(process.env.HOME || homedir(), '~')
        lines.push(`     ${themeColors.dim(configShortPath)}`)

        if (!isValid) {
          lines.push(themeColors.dim('     ⚠️  Config invalid or missing'))
        } else if (models.length === 0) {
          lines.push(themeColors.dim('     No models configured'))
        } else {
          const managedBadge = hasManagedMarker ? themeColors.info('• Managed by FCM') : themeColors.dim('• External config')
          lines.push(`     ${themeColors.success(`${models.length} model${models.length > 1 ? 's' : ''} configured`)}  ${managedBadge}`)

          for (const model of models) {
            const isModelCursor = globalIdx === state.installedModelsCursor
            const tierBadge = model.tier !== '-' ? themeColors.info(model.tier.padEnd(2)) : themeColors.dim('  ')
            const externalBadge = model.isExternal ? themeColors.dim('[external]') : ''

            const modelRow = `     • ${model.label} ${tierBadge} ${externalBadge}`
            cursorLineByRow[globalIdx++] = lines.length
            lines.push(isModelCursor ? themeColors.bgCursor(modelRow) : modelRow)

            if (isModelCursor) {
              lines.push(`        ${themeColors.dim('[Enter] Launch  [D] Disable')}`)
            }
          }
        }
      }
    }

    lines.push('')
    lines.push(themeColors.dim('  ↑↓ Navigate  Enter=Launch  D=Disable  Esc=Close'))

    const targetLine = cursorLineByRow[state.installedModelsCursor] ?? 0
    state.installedModelsScrollOffset = keepOverlayTargetVisible(
      state.installedModelsScrollOffset,
      targetLine,
      lines.length,
      state.terminalRows
    )
    const { visible, offset } = sliceOverlayLines(lines, state.installedModelsScrollOffset, state.terminalRows)
    state.installedModelsScrollOffset = offset

    overlayLayout.installedModelsCursorToLine = cursorLineByRow
    overlayLayout.installedModelsScrollOffset = offset

    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    const cleared = tintedLines.map((l) => l + EL)
    return cleared.join('\n')
  }

  // ─── Missing-tool install confirmation overlay ────────────────────────────
  // 📖 renderToolInstallPrompt keeps the user inside the TUI long enough to
  // 📖 confirm the auto-install, then the key handler exits the alt screen and
  // 📖 runs the official installer before retrying the selected launch.
  function renderToolInstallPrompt() {
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}
    const installPlan = state.toolInstallPromptPlan || getToolInstallPlan(state.toolInstallPromptMode)
    const toolMeta = state.toolInstallPromptMode ? getToolMeta(state.toolInstallPromptMode) : null
    const selectedModel = state.toolInstallPromptModel
    const options = [
      {
        label: 'Yes, install it now',
        hint: installPlan?.summary || 'Run the official installer, then continue with the selected model.',
      },
      {
        label: 'No, go back',
        hint: 'Return to the model list without installing anything.',
      },
    ]

    lines.push(`  ${chalk.cyanBright('🚀')} ${chalk.bold.cyanBright('free-coding-models')}`)
    lines.push(`  ${chalk.bold('📦 Missing Tool')}`)
    lines.push('')

    if (!toolMeta || !installPlan) {
      lines.push(chalk.red('  No install metadata is available for the selected tool.'))
      lines.push('')
      lines.push(chalk.dim('  Esc Close'))
    } else {
      const title = `${toolMeta.emoji} ${toolMeta.label}`
      lines.push(`  ${chalk.bold(title)} is not installed on this machine.`)
      lines.push(chalk.dim(`  Selected model: ${selectedModel?.label || 'Unknown model'}`))
      lines.push('')

      if (!installPlan.supported) {
        lines.push(chalk.yellow(`  ${installPlan.reason || 'FCM cannot auto-install this tool on the current platform.'}`))
        if (installPlan.docsUrl) {
          lines.push(chalk.dim(`  Docs: ${installPlan.docsUrl}`))
        }
        lines.push('')
        lines.push(chalk.dim('  Enter or Esc Close'))
      } else {
        lines.push(chalk.dim(`  Command: ${installPlan.shellCommand}`))
        if (installPlan.note) {
          lines.push(chalk.dim(`  Note: ${installPlan.note}`))
        }
        if (installPlan.docsUrl) {
          lines.push(chalk.dim(`  Docs: ${installPlan.docsUrl}`))
        }
        if (state.toolInstallPromptErrorMsg) {
          lines.push('')
          lines.push(chalk.yellow(`  ${state.toolInstallPromptErrorMsg}`))
        }
        lines.push('')

        options.forEach((option, idx) => {
          const isCursor = idx === state.toolInstallPromptCursor
          const bullet = isCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
          const row = `${bullet}${chalk.bold(option.label)}`
          cursorLineByRow[idx] = lines.length
          lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
          lines.push(chalk.dim(`      ${option.hint}`))
          lines.push('')
        })

        lines.push(chalk.dim('  ↑↓ Navigate  •  Enter Confirm  •  Esc Cancel'))
      }
    }

    const targetLine = cursorLineByRow[state.toolInstallPromptCursor] ?? 0
    state.installEndpointsScrollOffset = keepOverlayTargetVisible(
      state.installEndpointsScrollOffset,
      targetLine,
      lines.length,
      state.terminalRows
    )
    const { visible, offset } = sliceOverlayLines(lines, state.installEndpointsScrollOffset, state.terminalRows)
    state.installEndpointsScrollOffset = offset

    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    const cleared = tintedLines.map((line) => line + EL)
    return cleared.join('\n')
  }

  // ─── Command palette renderer ──────────────────────────────────────────────
  // 📖 renderCommandPalette draws a centered floating modal over the live table.
  // 📖 Supports hierarchical categories with expand/collapse and rich colors.
  function renderCommandPalette() {
    const terminalRows = state.terminalRows || 24
    const terminalCols = state.terminalCols || 80
    const panelWidth = Math.max(52, Math.min(100, terminalCols - 8))
    const panelInnerWidth = Math.max(32, panelWidth - 4)
    const panelPad = 2
    const panelOuterWidth = panelWidth + (panelPad * 2)
    const headerRowCount = 4
    const bodyRows = Math.max(8, Math.min(18, terminalRows - 12))

    const truncatePlain = (text, width) => {
      if (width <= 1) return ''
      if (displayWidth(text) <= width) return text
      if (width <= 2) return text.slice(0, width)
      return text.slice(0, width - 1) + '…'
    }

    const highlightMatch = (label, positions = []) => {
      if (!Array.isArray(positions) || positions.length === 0) return label
      const posSet = new Set(positions)
      let out = ''
      for (let i = 0; i < label.length; i++) {
        out += posSet.has(i) ? themeColors.accentBold(label[i]) : label[i]
      }
      return out
    }

    const allResults = Array.isArray(state.commandPaletteResults) ? state.commandPaletteResults.slice(0, 80) : []
    const panelLines = []
    const cursorLineByRow = {}

    if (allResults.length === 0) {
      panelLines.push(themeColors.dim('  No commands found. Try a different search.'))
    } else {
      for (let idx = 0; idx < allResults.length; idx++) {
        const entry = allResults[idx]
        const isCursor = idx === state.commandPaletteCursor
        
        const indent = '  '.repeat(entry.depth || 0)
        const expandIndicator = entry.hasChildren
          ? (entry.isExpanded ? themeColors.infoBold('▼') : themeColors.dim('▶'))
          : themeColors.dim('•')
        
        // 📖 Only use icon from entry, label should NOT include emoji
        const iconPrefix = entry.icon ? `${entry.icon} ` : ''
        const plainLabel = truncatePlain(entry.label, panelInnerWidth - indent.length - iconPrefix.length - 4)
        const label = entry.matchPositions ? highlightMatch(plainLabel, entry.matchPositions) : plainLabel
        
        let rowLine
        if (entry.type === 'category') {
          rowLine = `${indent}${expandIndicator} ${iconPrefix}${themeColors.headerBold(label)}`
        } else if (entry.type === 'subcategory') {
          rowLine = `${indent}${expandIndicator} ${iconPrefix}${themeColors.textBold(label)}`
        } else if (entry.type === 'page') {
          // 📖 Pages are at root level with icon + label + shortcut + description
          const shortcut = entry.shortcut ? themeColors.dim(` (${entry.shortcut})`) : ''
          const description = entry.description ? themeColors.dim(` — ${entry.description}`) : ''
          rowLine = `${expandIndicator} ${iconPrefix}${themeColors.textBold(label)}${shortcut}${description}`
        } else if (entry.type === 'action') {
          // 📖 Actions are at root level with icon + label + shortcut + description
          const shortcut = entry.shortcut ? themeColors.dim(` (${entry.shortcut})`) : ''
          const description = entry.description ? themeColors.dim(` — ${entry.description}`) : ''
          rowLine = `${expandIndicator} ${iconPrefix}${themeColors.textBold(label)}${shortcut}${description}`
        } else {
          // 📖 Regular commands in submenus
          const shortcut = entry.shortcut ? themeColors.dim(` (${entry.shortcut})`) : ''
          const description = entry.description ? themeColors.dim(` — ${entry.description}`) : ''
          // 📖 Color tiers and providers
          let coloredLabel = label
          let prefixWithIcon = iconPrefix
          
          if (entry.providerKey && !entry.icon) {
            // 📖 Model filter: add provider icon
            const providerIcon = '🏢'
            prefixWithIcon = `${providerIcon} `
            coloredLabel = themeColors.provider(entry.providerKey, label, { bold: false })
          } else if (entry.tier) {
            coloredLabel = themeColors.tier(entry.tier, label)
          } else if (entry.providerKey) {
            coloredLabel = themeColors.provider(entry.providerKey, label, { bold: false })
          }
          
          rowLine = `${indent}  ${expandIndicator} ${prefixWithIcon}${coloredLabel}${shortcut}${description}`
        }

        cursorLineByRow[idx] = panelLines.length
        
        if (isCursor) {
          panelLines.push(themeColors.bgCursor(rowLine))
        } else {
          panelLines.push(rowLine)
        }
      }
    }

    const targetLine = cursorLineByRow[state.commandPaletteCursor] ?? 0
    state.commandPaletteScrollOffset = keepOverlayTargetVisible(
      state.commandPaletteScrollOffset,
      targetLine,
      panelLines.length,
      bodyRows
    )
    const { visible, offset } = sliceOverlayLines(panelLines, state.commandPaletteScrollOffset, bodyRows)
    state.commandPaletteScrollOffset = offset

    const query = state.commandPaletteQuery || ''
    const queryWithCursor = query.length > 0
      ? `${query}${themeColors.accentBold('▏')}`
      : themeColors.accentBold('▏') + themeColors.dim(' Search commands…')

    const headerLines = []
    const title = themeColors.headerBold('⚡️ Command Palette')
    const titleLeft = ` ${title}`
    const titleRight = themeColors.dim('Esc')
    const titleWidth = Math.max(1, panelInnerWidth - 1 - displayWidth('Esc'))
    headerLines.push(`${padEndDisplay(titleLeft, titleWidth)} ${titleRight}`)
    headerLines.push(` ${padEndDisplay(`> ${queryWithCursor}`, panelInnerWidth)}`)
    headerLines.push(themeColors.dim(` ${'─'.repeat(Math.max(1, panelInnerWidth))}`))

    const footerLines = [
      themeColors.dim(` ${'─'.repeat(Math.max(1, panelInnerWidth))}`),
      ` ${padEndDisplay(themeColors.dim('↵ Select • ← → Expand'), panelInnerWidth)}`,
      ` ${padEndDisplay(themeColors.dim('↑↓ Navigate • Type search'), panelInnerWidth)}`,
    ]

    const allPanelLines = [...headerLines, ...visible, ...footerLines]
    
    while (allPanelLines.length < bodyRows + headerRowCount + 3) {
      allPanelLines.splice(headerLines.length + visible.length, 0, ` ${' '.repeat(panelInnerWidth)}`)
    }

    const blankPaddedLine = ' '.repeat(panelOuterWidth)
    const paddedPanelLines = [
      blankPaddedLine,
      blankPaddedLine,
      ...allPanelLines.map((line) => `${' '.repeat(panelPad)}${padEndDisplay(line, panelWidth)}${' '.repeat(panelPad)}`),
      blankPaddedLine,
      blankPaddedLine,
    ]

    const panelHeight = paddedPanelLines.length
    const top = Math.max(1, Math.floor((terminalRows - panelHeight) / 2) + 1)
    const left = Math.max(1, Math.floor((terminalCols - panelOuterWidth) / 2) + 1)

    // 📖 Mouse support: record CP layout so clicks inside the modal can select items.
    // 📖 Body rows start after 2 blank-padding lines + headerLines (3).
    const bodyStartRow = top + 2 + headerLines.length // 📖 1-based terminal row of first body line
    overlayLayout.commandPaletteCursorToLine = { ...cursorLineByRow }
    overlayLayout.commandPaletteScrollOffset = state.commandPaletteScrollOffset
    overlayLayout.commandPaletteBodyStartRow = bodyStartRow
    overlayLayout.commandPaletteBodyRows = bodyRows
    overlayLayout.commandPaletteLeft = left
    overlayLayout.commandPaletteRight = left + panelOuterWidth - 1
    overlayLayout.commandPaletteTop = top
    overlayLayout.commandPaletteBottom = top + panelHeight - 1

    const tintedLines = paddedPanelLines.map((line) => {
      const padded = padEndDisplay(line, panelOuterWidth)
      return themeColors.overlayBgCommandPalette(padded)
    })

    return tintedLines
      .map((line, idx) => `\x1b[${top + idx};${left}H${line}`)
      .join('')
  }

  // ─── Help overlay renderer ────────────────────────────────────────────────
  // 📖 renderHelp: Draw the help overlay listing all key bindings.
  // 📖 Toggled with K key. Gives users a quick reference without leaving the TUI.
  function renderHelp() {
    const EL = '\x1b[K'
    const lines = []
    const label = themeColors.info
    const hint = themeColors.dim
    const key = themeColors.hotkey
    const heading = themeColors.textBold

    // 📖 Branding header
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${heading('❓ Help & Keyboard Shortcuts')}`)
    lines.push(`  ${themeColors.successBold('🔑 Yellow = active key')}`)
    lines.push('')
    lines.push(`  ${hint('— ↑↓ / PgUp / PgDn / Home / End scroll • K or ')}${themeColors.successBold('Esc close')}`)
    lines.push(`  ${heading('Columns')}`)
    lines.push('')
    lines.push(`  ${label('Rank')}        SWE-bench rank (1 = best coding score)  ${hint('Sort:')} ${key('R')}`)
    lines.push(`              ${hint('Quick glance at which model is objectively the best coder right now.')}`)
    lines.push('')
    lines.push(`  ${label('Tier')}        S+ / S / A+ / A / A- / B+ / B / C based on SWE-bench score  ${hint('Cycle:')} ${key('T')}`)
    lines.push(`              ${hint('Skip the noise — S/S+ models solve real GitHub issues, C models are for light tasks.')}`)
    lines.push('')
    lines.push(`  ${label('SWE%')}        SWE-bench score — coding ability benchmark (color-coded)  ${hint('Sort:')} ${key('S')}`)
    lines.push(`              ${hint('The raw number behind the tier. Higher = better at writing, fixing, and refactoring code.')}`)
    lines.push('')
    lines.push(`  ${label('CTX')}         Context window size (128k, 200k, 256k, 1m, etc.)  ${hint('Sort:')} ${key('C')}`)
    lines.push(`              ${hint('Bigger context = the model can read more of your codebase at once without forgetting.')}`)
    lines.push('')
    lines.push(`  ${label('Model')}       Model name (1️⃣2️⃣3️⃣ = favorite order)  ${hint('Sort:')} ${key('M')}  ${hint('Favorite:')} ${key('F')}`)
    lines.push(`              ${hint('Star the ones you like. Press Y to switch between pinned mode and normal filter/sort mode.')}`)
    lines.push('')
    lines.push(`  ${label('Provider')}    Provider source (NIM, Groq, Cerebras, etc.)  ${hint('Sort:')} ${key('O')}  ${hint('Cycle:')} ${key('D')}`)
    lines.push(`              ${hint('Same model on different providers can have very different speed and uptime.')}`)
    lines.push('')
    lines.push(`  ${label('Last Ping')}   Most recent ping response time (ms)  ${hint('Sort:')} ${key('L')}`)
    lines.push(`              ${hint('Shows how fast the server is responding right now — useful to catch live slowdowns.')}`)
    lines.push('')
    lines.push(`  ${label('Avg Ping')}   Average response time across all measurable pings (200 + 401) (ms)  ${hint('Sort:')} ${key('A')}`)
    lines.push(`              ${hint('The long-term truth. Even without a key, a 401 still gives real latency so the average stays useful.')}`)
    lines.push('')
    lines.push(`  ${label('Health')}      Live status: ✅ UP / 🔥 429 / ⏳ TIMEOUT / ❌ ERR / 🔑 NO KEY  ${hint('Sort:')} ${key('H')}`)
    lines.push(`              ${hint('Tells you instantly if a model is reachable or down — no guesswork needed.')}`)
    lines.push('')
    lines.push(`  ${label('Verdict')}     Overall assessment: Perfect / Normal / Spiky / Slow / Overloaded  ${hint('Sort:')} ${key('V')}`)
    lines.push(`              ${hint('One-word summary so you don\'t have to cross-check speed, health, and stability yourself.')}`)
    lines.push('')
    lines.push(`  ${label('Stability')}   Composite 0–100 score: p95 + jitter + spike rate + uptime  ${hint('Sort:')} ${key('B')}`)
    lines.push(`              ${hint('A fast model that randomly freezes is worse than a steady one. This catches that.')}`)
    lines.push('')
    lines.push(`  ${label('Up%')}         Uptime — ratio of successful pings to total pings  ${hint('Sort:')} ${key('U')}`)
    lines.push(`              ${hint('If a model only works half the time, you\'ll waste time retrying. Higher = more reliable.')}`)
    lines.push('')
    lines.push(`  ${label('Used')}        Historical prompt+completion tokens tracked for this exact provider/model pair`)
    lines.push(`              ${hint('Loaded from local stats snapshots. Displayed in K tokens, or M tokens above one million.')}`)
    lines.push('')


    lines.push('')
    lines.push(`  ${heading('Main TUI')}`)
    lines.push(`  ${heading('Navigation')}`)
    lines.push(`  ${key('↑↓ / J/K')}     Navigate rows  ${hint('(J/K = vim-style scroll)')}`)
    lines.push(`  ${key('Enter')}        Select model and launch`)
    lines.push(`              ${hint('If the active CLI is missing, FCM offers a one-click install prompt first.')}`)
    lines.push('')
    lines.push(`  ${heading('Controls')}`)
    lines.push(`  ${key('W')}  Toggle ping mode  ${hint('(speed 2s → normal 10s → slow 30s → forced 4s)')}`)
    lines.push(`  ${key('Ctrl+P')}  Open ⚡️ command palette  ${hint('(search and run actions quickly)')}`)
    lines.push(`  ${key('Ctrl+A')}  AI Speed Test  ${hint('(benchmark selected model → time + TPS)')}`)
    lines.push(`  ${key('Ctrl+U')}  Global AI Speed Test  ${hint('(benchmark all models; Settings can auto-run it on startup)')}`)
    lines.push(`  ${key('E')}  Cycle filter mode  ${hint('(Normal → Configured only → Usable only)')}`)
    lines.push(`  ${key('Z')}  Cycle tool mode  ${hint('(📦 OpenCode → π Pi → 🪼 jcode → 📦 Desktop → 🦞 OpenClaw → 💘 Crush → 🪿 Goose → 🛠 Aider → 🐉 Qwen → 🤲 OpenHands → ⚡ Amp → 🦘 Rovo → ♊ Gemini)')}`)
    lines.push(`  ${key('F')}  Toggle favorite on selected row  ${hint('(1️⃣2️⃣3️⃣ = router fallback order, capped at 🔟)')}`)
    lines.push(`  ${key('⇧↑/⇧↓')}  Reorder selected favorite up/down  ${hint('(changes router priority)')}`)
    lines.push(`  ${key('Y')}  Toggle favorites mode  ${hint('(Pinned + always visible ↔ Normal filter/sort behavior)')}`)
    lines.push(`  ${key('X')}  Clear active text filter  ${hint('(remove custom query applied from ⚡️ Command Palette)')}`)
    lines.push(`  ${key('Q')}  Smart Recommend  ${hint('(🎯 find the best model for your task — questionnaire + live analysis)')}`)
    lines.push(`  ${key('G')}  Cycle theme  ${hint('(auto → dark → light)')}`)

    lines.push(`  ${key('P')}  Open settings  ${hint('(manage API keys, provider toggles, updates, legacy cleanup)')}`)
      // 📖 Profile system removed - API keys now persist permanently across all sessions
    lines.push(`  ${key('Ctrl+P')}  Reset view settings  ${hint('(search "Reset view" in the command palette)')}`)
    lines.push(`  ${key('N')}  Reset view  ${hint('(🔄 reset all filters & sort back to default)')}`)
    lines.push(`  ${key('I')} / ${key('Esc')}  Show/hide this help`)
    lines.push(`  ${key('Ctrl+C')}  Exit`)
    lines.push('')
    lines.push(`  ${heading('Settings (P)')}`)
    lines.push(`  ${key('↑↓')}           Navigate rows`)
    lines.push(`  ${key('PgUp/PgDn')}    Jump by page`)
    lines.push(`  ${key('Home/End')}     Jump first/last row`)
    lines.push(`  ${key('Enter')}        Edit key / run selected maintenance action`)
    lines.push(`  ${key('Space')}        Toggle selected row option (provider/theme/favorites)`)
    lines.push(`  ${key('Y')}            Toggle favorites mode (global)`)
    lines.push(`  ${key('T')}            Test selected provider key`)
    lines.push(`  ${key('U')}            Check updates manually`)
    lines.push(`  ${key('G')}            Cycle theme globally`)
    lines.push(`  ${key('Esc')}          Close settings`)
    lines.push('')
    lines.push(...buildCliHelpLines({ chalk, indent: '  ', title: 'CLI Flags' }))
    lines.push('')
    // 📖 Help overlay can be longer than viewport, so keep a dedicated scroll offset.
    const { visible, offset } = sliceOverlayLines(lines, state.helpScrollOffset, state.terminalRows)
    state.helpScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgHelp, state.terminalCols)
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

    // 📖 Branding header
    lines.push('')
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${themeColors.textBold('🎯 Smart Recommend')}`)
    lines.push('')
    lines.push(themeColors.dim('  — find the best model for your task'))
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
          breadcrumbs += themeColors.successBold(`  ✓ ${questions[i].title} ${themeColors.textBold(answeredLabel)}`) + '\n'
        }
      }
      if (breadcrumbs) {
        lines.push(breadcrumbs.trimEnd())
        lines.push('')
      }

      lines.push(`  ${themeColors.textBold(`Question ${qNum}/${qTotal}:`)} ${themeColors.info(q.title)}`)
      lines.push('')

      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i]
        const isCursor = i === state.recommendCursor
        const label = isCursor ? themeColors.textBold(opt.label) : themeColors.text(opt.label)
        // 📖 Mouse support: record the 1-based terminal row of each option
        // 📖 lines.length is the 0-based index → +1 = 1-based row
        overlayLayout.recommendOptionRows = overlayLayout.recommendOptionRows || {}
        overlayLayout.recommendOptionRows[i] = lines.length + 1
        lines.push(`${bullet(isCursor)}${label}`)
      }

      lines.push('')
      lines.push(themeColors.dim('  ↑↓ navigate  •  Enter select  •  Esc cancel'))

    } else if (state.recommendPhase === 'analyzing') {
      // 📖 Loading screen with progress bar
      const pct = Math.min(100, Math.round(state.recommendProgress))
      const barWidth = 40
      const filled = Math.round(barWidth * pct / 100)
      const empty = barWidth - filled
      const bar = themeColors.successBold('█'.repeat(filled)) + themeColors.dim('░'.repeat(empty))

      lines.push(`  ${themeColors.textBold('Analyzing models...')}`)
      lines.push('')
      lines.push(`  ${bar}  ${themeColors.textBold(String(pct) + '%')}`)
      lines.push('')

      // 📖 Show what we're doing
      const taskLabel = TASK_TYPES[state.recommendAnswers.taskType]?.label || '—'
      const prioLabel = PRIORITY_TYPES[state.recommendAnswers.priority]?.label || '—'
      const ctxLabel = CONTEXT_BUDGETS[state.recommendAnswers.contextBudget]?.label || '—'
      lines.push(themeColors.dim(`  Task: ${taskLabel}  •  Priority: ${prioLabel}  •  Context: ${ctxLabel}`))
      lines.push('')

      // 📖 Spinning indicator
      const spinIdx = state.frame % FRAMES.length
      lines.push(`  ${themeColors.warning(FRAMES[spinIdx])} Pinging models at 2 pings/sec to gather fresh latency data...`)
      lines.push('')
      lines.push(themeColors.dim('  Esc to cancel'))

    } else if (state.recommendPhase === 'results') {
      // 📖 Show Top 3 results with detailed info
      const taskLabel = TASK_TYPES[state.recommendAnswers.taskType]?.label || '—'
      const prioLabel = PRIORITY_TYPES[state.recommendAnswers.priority]?.label || '—'
      const ctxLabel = CONTEXT_BUDGETS[state.recommendAnswers.contextBudget]?.label || '—'
      lines.push(themeColors.dim(`  Task: ${taskLabel}  •  Priority: ${prioLabel}  •  Context: ${ctxLabel}`))
      lines.push('')

      if (state.recommendResults.length === 0) {
        lines.push(`  ${themeColors.warning('No models could be scored. Try different criteria or wait for more pings.')}`)
      } else {
        lines.push(`  ${themeColors.textBold('Top Recommendations:')}`)
        lines.push('')

        for (let i = 0; i < state.recommendResults.length; i++) {
          const rec = state.recommendResults[i]
          const r = rec.result
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
          const providerName = sources[r.providerKey]?.name ?? r.providerKey
          const tierFn = TIER_COLOR[r.tier] ?? ((text) => themeColors.text(text))
          const avg = getAvg(r)
          const avgStr = avg === Infinity ? '—' : Math.round(avg) + 'ms'
          const sweStr = r.sweScore ?? '—'
          const ctxStr = r.ctx ?? '—'
          const stability = getStabilityScore(r)
          const stabStr = stability === -1 ? '—' : String(stability)

          const isCursor = i === state.recommendCursor
          const highlight = isCursor ? themeColors.bgCursor : (text) => text

          lines.push(highlight(`  ${medal} ${themeColors.textBold('#' + (i + 1))}  ${themeColors.textBold(r.label)}  ${themeColors.dim('(' + providerName + ')')}`))
          lines.push(highlight(`       Score: ${themeColors.successBold(String(rec.score) + '/100')}  │  Tier: ${tierFn(r.tier)}  │  SWE: ${themeColors.info(sweStr)}  │  Avg: ${themeColors.warning(avgStr)}  │  CTX: ${themeColors.info(ctxStr)}  │  Stability: ${themeColors.info(stabStr)}`))
          lines.push('')
        }
      }

      lines.push('')
      lines.push(`  ${themeColors.dim('These models are now')} ${themeColors.successBold('highlighted')} ${themeColors.dim('and')} 🎯 ${themeColors.dim('pinned in the main table.')}`)
      lines.push('')
      lines.push(themeColors.dim('  ↑↓ navigate  •  Enter select & close  •  Esc close  •  Q new search'))
    }

    lines.push('')
    const { visible, offset } = sliceOverlayLines(lines, state.recommendScrollOffset, state.terminalRows)
    state.recommendScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgRecommend, state.terminalCols)
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

    const pingModel = getPingModel?.()
    if (!pingModel) return

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

  // ─── Changelog overlay renderer ───────────────────────────────────────────
  // 📖 renderChangelog: Two-phase overlay — index of all versions or details of one version
  function renderChangelog() {
    const EL = '\x1b[K'
    const lines = []
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

    // 📖 Branding header
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)

    if (state.changelogPhase === 'index') {
      // ═══════════════════════════════════════════════════════════════════════
      // 📖 INDEX PHASE: Show all versions with selection
      // ═══════════════════════════════════════════════════════════════════════
      lines.push(`  ${themeColors.textBold('📋 Changelog - All Versions')}`)
      lines.push(`  ${themeColors.dim('— ↑↓ navigate • Enter select • Esc close')}`)
      lines.push('')

      for (let i = 0; i < versionList.length; i++) {
        const version = versionList[i]
        const changes = versions[version]
        const isSelected = i === state.changelogCursor

        // 📖 Count items in this version
        let itemCount = 0
        for (const key of ['added', 'fixed', 'changed', 'updated']) {
          if (changes[key]) itemCount += changes[key].length
        }

        // 📖 Build a short summary from the first few items (max ~15 words, stripped of markdown)
        const allItems = []
        for (const k of ['added', 'fixed', 'changed', 'updated']) {
          if (changes[k]) for (const item of changes[k]) allItems.push(item)
        }
        let summary = ''
        if (allItems.length > 0) {
          // 📖 Extract the bold title part if present, otherwise use the raw text
          const firstItem = allItems[0]
          const boldMatch = firstItem.match(/\*\*([^*]+)\*\*/)
          const rawText = boldMatch ? boldMatch[1] : firstItem.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
          // 📖 Truncate to ~15 words max
          const words = rawText.split(/\s+/).slice(0, 15)
          summary = words.join(' ')
          if (rawText.split(/\s+/).length > 15) summary += '…'
        }

        // 📖 Format version line with selection highlight + dim summary
        const countStr = `${itemCount} ${itemCount === 1 ? 'change' : 'changes'}`
        const prefix = `  v${version.padEnd(8)} — ${countStr}`
        if (isSelected) {
          const full = summary ? `${prefix} · ${summary}` : prefix
          lines.push(themeColors.bgCursor(full))
        } else {
          const dimSummary = summary ? themeColors.dim(` · ${summary}`) : ''
          lines.push(`${prefix}${dimSummary}`)
        }
      }

      lines.push('')
      lines.push(`  ${themeColors.dim(`Total: ${versionList.length} versions`)}`)

    } else if (state.changelogPhase === 'details') {
      // ═══════════════════════════════════════════════════════════════════════
      // 📖 DETAILS PHASE: Show detailed changes for selected version
      // ═══════════════════════════════════════════════════════════════════════
      lines.push(`  ${themeColors.textBold(`📋 v${state.changelogSelectedVersion}`)}`)
      lines.push(`  ${themeColors.dim('— ↑↓ / PgUp / PgDn scroll • B back • Esc close')}`)
      lines.push('')

      const changes = versions[state.changelogSelectedVersion]
      if (changes) {
        const sections = { added: '✨ Added', fixed: '🐛 Fixed', changed: '🔄 Changed', updated: '📝 Updated' }
        for (const [key, label] of Object.entries(sections)) {
          if (changes[key] && changes[key].length > 0) {
            lines.push(`  ${themeColors.warning(label)}`)
            for (const item of changes[key]) {
              // 📖 Unwrap markdown bold/code markers for display
              let displayText = item.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
              // 📖 Wrap long lines
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
    }

    // 📖 Keep selected changelog row visible by scrolling the overlay viewport (index phase)
    if (state.changelogPhase === 'index') {
      const targetLine = 4 + state.changelogCursor  // 📖 3 header lines + 1 blank = versions start at line 4
      state.changelogScrollOffset = keepOverlayTargetVisible(
        state.changelogScrollOffset,
        targetLine,
        lines.length,
        state.terminalRows
      )
    }

    // 📖 Use scrolling with overlay handler
    const { visible, offset } = sliceOverlayLines(lines, state.changelogScrollOffset, state.terminalRows)
    state.changelogScrollOffset = offset

    // 📖 Mouse support: record changelog layout for click-to-select versions
    overlayLayout.changelogScrollOffset = offset
    // 📖 In index phase, version items start at line 4 (header + blank + title + instructions)
    // 📖 Each version occupies exactly one line. changelogCursorToLine maps cursor → line index.
    if (state.changelogPhase === 'index') {
      const map = {}
      for (let i = 0; i < versionList.length; i++) {
        map[i] = 4 + i // 📖 3 header-ish lines + 1 blank before version list
      }
      overlayLayout.changelogCursorToLine = map
    } else {
      overlayLayout.changelogCursorToLine = {}
    }

    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgChangelog, state.terminalCols)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }

  // 📖 stopRecommendAnalysis: cleanup timers if user cancels during analysis
  function stopRecommendAnalysis() {
    if (state.recommendAnalysisTimer) { clearInterval(state.recommendAnalysisTimer); state.recommendAnalysisTimer = null }
    if (state.recommendPingTimer) { clearInterval(state.recommendPingTimer); state.recommendPingTimer = null }
  }

  function renderRouterDashboard() {
    return renderRouterDashboardOverlay(state, { LOCAL_VERSION })
  }

  // ─── Incompatible fallback overlay ─────────────────────────────────────────
  // 📖 renderIncompatibleFallback shows when user presses Enter on a model that
  // 📖 is NOT compatible with the active tool. Two sections:
  // 📖   Section 1: "Switch to a compatible tool" — lists tools the model CAN run on
  // 📖   Section 2: "Use a similar model" — lists SWE-similar models compatible with current tool
  // 📖 Cursor navigates a flat list across both sections. Enter executes, Esc cancels.
  function renderIncompatibleFallback() {
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}

    const model = state.incompatibleFallbackModel
    const tools = state.incompatibleFallbackTools || []
    const similarModels = state.incompatibleFallbackSimilarModels || []
    const totalItems = tools.length + similarModels.length
    const activeMeta = getToolMeta(state.mode)

    lines.push(`  ${chalk.cyanBright('🚀')} ${chalk.bold.cyanBright('free-coding-models')}`)
    lines.push(`  ${chalk.bold('⚠️  Incompatible Model')}`)
    lines.push('')

    if (!model) {
      lines.push(chalk.red('  No model data available.'))
      lines.push('')
      lines.push(chalk.dim('  Esc Close'))
    } else {
      // 📖 Header: explain why it's incompatible
      const tierFn = TIER_COLOR[model.tier] ?? ((text) => themeColors.text(text))
      lines.push(`  ${themeColors.textBold(model.label)}  ${tierFn(model.tier)}`)
      lines.push(chalk.dim(`  This model cannot run on ${activeMeta.emoji} ${activeMeta.label}.`))
      lines.push('')

      // 📖 Section 1: Switch to a compatible tool
      if (tools.length > 0) {
        lines.push(`  ${themeColors.textBold('Switch to a compatible tool:')}`)
        lines.push('')

        for (let i = 0; i < tools.length; i++) {
          const toolKey = tools[i]
          const meta = getToolMeta(toolKey)
          const [r, g, b] = meta.color || [200, 200, 200]
          const coloredLabel = chalk.rgb(r, g, b)(`${meta.emoji} ${meta.label}`)
          const isCursor = state.incompatibleFallbackCursor === i
          const bullet = isCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
          const row = `${bullet}${coloredLabel}`
          cursorLineByRow[i] = lines.length
          lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
        }
        lines.push('')
      }

      // 📖 Section 2: Use a similar model
      if (similarModels.length > 0) {
        lines.push(`  ${themeColors.textBold('Or pick a similar model for')} ${activeMeta.emoji} ${themeColors.textBold(activeMeta.label + ':')}`)
        lines.push('')

        for (let i = 0; i < similarModels.length; i++) {
          const sm = similarModels[i]
          const flatIdx = tools.length + i
          const tierFnSm = TIER_COLOR[sm.tier] ?? ((text) => themeColors.text(text))
          const isCursor = state.incompatibleFallbackCursor === flatIdx
          const bullet = isCursor ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
          const sweLabel = sm.sweScore !== '-' ? `SWE ${sm.sweScore}` : 'SWE —'
          const row = `${bullet}${themeColors.textBold(sm.label)}  ${tierFnSm(sm.tier)}  ${chalk.dim(sweLabel)}`
          cursorLineByRow[flatIdx] = lines.length
          lines.push(isCursor ? themeColors.bgCursorInstall(row) : row)
        }
        lines.push('')
      }

      if (totalItems === 0) {
        lines.push(chalk.yellow('  No compatible tools or similar models found.'))
        lines.push('')
      }

      lines.push(chalk.dim('  ↑↓ Navigate  •  Enter Confirm  •  Esc Cancel'))
    }

    lines.push('')

    // 📖 Scroll management — same pattern as other overlays
    const targetLine = cursorLineByRow[state.incompatibleFallbackCursor] ?? 0
    state.incompatibleFallbackScrollOffset = keepOverlayTargetVisible(
      state.incompatibleFallbackScrollOffset,
      targetLine,
      lines.length,
      state.terminalRows
    )
    const { visible, offset } = sliceOverlayLines(lines, state.incompatibleFallbackScrollOffset, state.terminalRows)
    state.incompatibleFallbackScrollOffset = offset

    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    const cleared = tintedLines.map(l => l + EL)
    return cleared.join('\n')
  }


  // ─── Token Usage screen renderer ───────────────────────────────────────────
  // 📖 renderTokenUsage: shows today/all-time breakdowns, by-model breakdown,
  // 📖 and a 7-day bar chart. Triggered by Shift+T from the main table.
  // 📖 Data fetched from GET /stats/tokens on the daemon.
  function renderTokenUsage() {
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}

    lines.push('')
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${themeColors.textBold('📊 Token Usage')}  ${themeColors.dim('Shift+T from main table')}`)
    lines.push('')

    const data = state.tokenUsageData

    if (state.tokenUsageError) {
      lines.push(`  ${themeColors.warning(state.tokenUsageError)}`)
      lines.push('')
      lines.push(themeColors.dim('  Press Shift+S to start the router daemon first, then reopen this screen.'))
      lines.push(themeColors.dim('  Esc to return to the main table'))
      const { visible, offset } = sliceOverlayLines(lines, state.tokenUsageScrollOffset, state.terminalRows)
      state.tokenUsageScrollOffset = offset
      const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
      return tintedLines.map((l) => l + EL).join('\n')
    }

    if (!data) {
      lines.push(themeColors.dim('  Loading token stats...'))
      const { visible, offset } = sliceOverlayLines(lines, state.tokenUsageScrollOffset, state.terminalRows)
      state.tokenUsageScrollOffset = offset
      const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
      return tintedLines.map((l) => l + EL).join('\n')
    }

    const today = data.today || {}
    const allTime = data.all_time || {}
    const dailyData = data.daily || {}

    const todayTotal = today.total_tokens || 0
    const todayPrompt = today.prompt_tokens || 0
    const todayCompletion = today.completion_tokens || 0
    const todayReq = today.requests || 0
    const allTimeTotal = allTime.total_tokens || 0
    const allTimeReq = allTime.requests || 0
    const firstTracked = allTime.first_tracked || null

    lines.push(`  ${themeColors.textBold('TODAY')}  ${themeColors.dim(new Date().toISOString().slice(0, 10))}  ${themeColors.dim('|')}  ${themeColors.textBold('ALL TIME')}`)
    lines.push(`  ${themeColors.dim('─'.repeat(40))}  ${themeColors.dim('─'.repeat(30))}`)
    lines.push(`  ${themeColors.textBold('Total:')}     ${themeColors.info(formatTokenTotalCompact(todayTotal))} tok  ${themeColors.dim('│')}  ${themeColors.textBold('Total:')}  ${themeColors.info(formatTokenTotalCompact(allTimeTotal))} tok`)
    lines.push(`  ${themeColors.textBold('Prompt:')}   ${themeColors.dim(formatTokenTotalCompact(todayPrompt))} tok  ${themeColors.dim('│')}  ${themeColors.textBold('Requests:')} ${themeColors.dim(String(allTimeReq))}`)
    lines.push(`  ${themeColors.textBold('Completion:')} ${themeColors.dim(formatTokenTotalCompact(todayCompletion))} tok  ${themeColors.dim('│')}  ${themeColors.textBold('Since:')} ${themeColors.dim(firstTracked ? new Date(firstTracked).toLocaleDateString() : '—')}`)
    lines.push(`  ${themeColors.textBold('Requests:')} ${themeColors.dim(String(todayReq))}  ${themeColors.dim('│')}`)

    const byModel = today.by_model || {}
    const sortedModels = Object.entries(byModel)
      .map(([key, val]) => {
        // 📖 val can be a number (legacy) or { total, prompt, completion } object
        const total = (val && typeof val === 'object' && !Array.isArray(val)) ? (val.total || 0) : Number(val) || 0
        return { key, total }
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    lines.push('')
    lines.push(`  ${themeColors.textBold('TOP MODELS TODAY')}`)
    if (sortedModels.length === 0) {
      lines.push(themeColors.dim('  No usage tracked yet today.'))
    } else {
      const maxTotal = sortedModels[0]?.total || 1
      for (const m of sortedModels) {
        const barLen = Math.max(2, Math.round((m.total / maxTotal) * 28))
        const bar = themeColors.success('█'.repeat(barLen)) + themeColors.dim('░'.repeat(28 - barLen))
        const pct = todayTotal > 0 ? Math.round((m.total / todayTotal) * 100) : 0
        lines.push(`  ${bar}  ${themeColors.textBold(formatTokenTotalCompact(m.total))} tok  ${themeColors.dim(`${pct}%  ${m.key}`)}`)
      }
    }

    lines.push('')
    lines.push(`  ${themeColors.textBold('LAST 7 DAYS')}`)
    const dayLabels = []
    const dayTotals = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const dayData = dailyData[key]
      const total = dayData?.total_tokens || 0
      dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }))
      dayTotals.push(total)
    }
    const maxDay = Math.max(...dayTotals, 1)
    lines.push(`  ${dayLabels.map((l, i) => themeColors.dim(padEndDisplay(l, 6))).join(' ')}`)
    const barHeights = [14, 10, 7, 4]
    for (const bh of barHeights) {
      const row = dayTotals.map((t) => {
        const filled = Math.round((t / maxDay) * bh)
        const bar = themeColors.info('█'.repeat(filled)) + themeColors.dim('░'.repeat(bh - filled))
        return padEndDisplay(bar, 6)
      })
      lines.push(`  ${row.join(' ')}`)
    }
    const totalRow = dayTotals.map((t) => padEndDisplay(themeColors.textBold(formatTokenTotalCompact(t)), 6))
    lines.push(`  ${totalRow.join(' ')}`)

    lines.push('')
    lines.push(themeColors.dim('  Esc Back to main table'))

    const { visible, offset } = sliceOverlayLines(lines, state.tokenUsageScrollOffset, state.terminalRows)
    state.tokenUsageScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    return tintedLines.map((l) => l + EL).join('\n')
  }

  // ─── Router Onboarding overlay renderer ─────────────────────────────────────
  // 📖 renderRouterOnboarding: shown on first launch (no config.router) or
  // 📖 first launch after upgrade (existing config but router.onboardingSeen !== true).
  // 📖 Two options: Enable (Y) or Not now (N). Phase 6 — Smart Model Router.
  function renderRouterOnboarding() {
    const EL = '\x1b[K'
    const lines = []
    const cursorLineByRow = {}

    lines.push('')
    lines.push(`  ${themeColors.accent('🚀')} ${themeColors.accentBold('free-coding-models')} ${themeColors.dim(`v${LOCAL_VERSION}`)}`)
    lines.push(`  ${themeColors.textBold('🔀 Smart Router Available!')}`)
    lines.push('')
    lines.push(themeColors.dim('  FCM can run a background daemon that automatically'))
    lines.push(themeColors.dim('  routes your requests to the fastest healthy model —'))
    lines.push(themeColors.dim('  with zero manual intervention after initial setup.'))
    lines.push('')

    const options = [
      { label: 'Yes, enable the router', hint: 'Recommended — creates default set and starts daemon', key: 'Y' },
      { label: 'Not now', hint: 'You can enable it later from the TUI', key: 'N' },
    ]

    if (state.routerOnboardingPhase === 'loading') {
      lines.push(themeColors.info('  Enabling router, please wait...'))
    } else if (state.routerOnboardingPhase === 'success') {
      lines.push(themeColors.success('  ✅ Router enabled! Dashboard opening...'))
      lines.push(themeColors.dim('  Setup complete. Return to the main table to continue.'))
    } else if (state.routerOnboardingPhase === 'error') {
      lines.push(themeColors.error(`  ❌ ${state.routerOnboardingError || 'Failed to enable router'}`))
      lines.push(themeColors.dim('  Press Esc or Enter to continue to the main table'))
    } else {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]
        const isCursor = i === state.routerOnboardingCursor
        const keyLabel = themeColors.hotkey(`  ${opt.key}]`)
        const row = `${bullet(isCursor)}${keyLabel} ${isCursor ? themeColors.textBold(opt.label) : themeColors.text(opt.label)}`
        cursorLineByRow[i] = lines.length
        lines.push(isCursor ? themeColors.bgCursorSettingsList(row) : row)
        lines.push(themeColors.dim(`      ${opt.hint}`))
        lines.push('')
      }
      lines.push(themeColors.dim('  ↑↓ Navigate  •  Enter Select  •  Esc Skip for now'))
      lines.push('')
      lines.push(
        themeColors.dim('  💬 ') +
        themeColors.footerDiscord('\x1b]8;;https://discord.gg/ZTNFHvvCkU\x1b\\Join the Discord community\x1b]8;;\x1b\\') +
        themeColors.dim('  •  Get help, share feedback, follow updates')
      )
    }

    const targetLine = cursorLineByRow[state.routerOnboardingCursor] ?? 0
    state.routerOnboardingScrollOffset = keepOverlayTargetVisible(state.routerOnboardingScrollOffset, targetLine, lines.length, state.terminalRows)
    const { visible, offset } = sliceOverlayLines(lines, state.routerOnboardingScrollOffset, state.terminalRows)
    state.routerOnboardingScrollOffset = offset
    const tintedLines = tintOverlayLines(visible, themeColors.overlayBgSettings, state.terminalCols)
    return tintedLines.map((l) => l + EL).join('\n')
  }

  return {
    renderSettings,
    renderInstallEndpoints,
    renderToolInstallPrompt,
    renderCommandPalette,
    renderHelp,
    renderRecommend,
    renderChangelog,
    renderInstalledModels,
    renderRouterDashboard,
    renderIncompatibleFallback,
    renderTokenUsage,
    renderRouterOnboarding,
    startRecommendAnalysis,
    stopRecommendAnalysis,
    overlayLayout,
  }
}
