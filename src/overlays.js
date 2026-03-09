/**
 * @file overlays.js
 * @description Factory for TUI overlay renderers and recommend analysis flow.
 *
 * @details
 *   This module centralizes all overlay rendering in one place:
 *   - Settings, Help, Log, Smart Recommend, Feature Request, Bug Report
 *   - Recommend analysis timer orchestration and progress updates
 *
 *   The factory pattern keeps stateful UI logic isolated while still
 *   allowing the main CLI to control shared state and dependencies.
 *
 *   → Functions:
 *   - `createOverlayRenderers` — returns renderer + analysis helpers
 *
 * @exports { createOverlayRenderers }
 */

export function createOverlayRenderers(state, deps) {
  const {
    chalk,
    sources,
    PROVIDER_METADATA,
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
    getPingModel,
  } = deps

  // 📖 Keep log token formatting aligned with the main table so the same totals
  // 📖 read the same everywhere in the TUI.
  const formatLogTokens = (totalTokens) => {
    const safeTotal = Number(totalTokens) || 0
    if (safeTotal <= 0) return '--'
    if (safeTotal >= 999_500) return `${(safeTotal / 1_000_000).toFixed(2)}M`
    if (safeTotal >= 1_000) return `${(safeTotal / 1_000).toFixed(2)}k`
    return String(Math.floor(safeTotal))
  }

  // ─── Settings screen renderer ─────────────────────────────────────────────
  // 📖 renderSettings: Draw the settings overlay in the alt screen buffer.
  // 📖 Shows all providers with their API key (masked) + enabled state.
  // 📖 When in edit mode (settingsEditMode=true), shows an inline input field.
  // 📖 Key "T" in settings = test API key for selected provider.
  function renderSettings() {
    const providerKeys = Object.keys(sources)
    const updateRowIdx = providerKeys.length
    const proxyEnabledRowIdx = updateRowIdx + 1
    const proxySyncRowIdx = updateRowIdx + 2
    const proxyPortRowIdx = updateRowIdx + 3
    const proxyCleanupRowIdx = updateRowIdx + 4
    const proxySettings = getProxySettings(state.config)
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
      else if (testResult === 'rate_limited') testBadge = chalk.yellow('[Rate limit ⏳]')
      else if (testResult === 'no_callable_model') testBadge = chalk.magenta('[No model ⚠]')
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

    lines.push('')
    lines.push(`  ${chalk.bold('🔀 Proxy')}`)
    lines.push(`  ${chalk.dim('  ' + '─'.repeat(112))}`)
    lines.push('')

    const proxyEnabledBullet = state.settingsCursor === proxyEnabledRowIdx ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
    const proxyEnabledRow = `${proxyEnabledBullet}${chalk.bold('Proxy mode (opt-in)').padEnd(44)} ${proxySettings.enabled ? chalk.greenBright('Enabled') : chalk.dim('Disabled by default')}`
    cursorLineByRow[proxyEnabledRowIdx] = lines.length
    lines.push(state.settingsCursor === proxyEnabledRowIdx ? chalk.bgRgb(20, 45, 60)(proxyEnabledRow) : proxyEnabledRow)

    const proxySyncBullet = state.settingsCursor === proxySyncRowIdx ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
    const proxySyncRow = `${proxySyncBullet}${chalk.bold('Persist proxy in OpenCode').padEnd(44)} ${proxySettings.syncToOpenCode ? chalk.greenBright('Enabled') : chalk.dim('Disabled')}`
    cursorLineByRow[proxySyncRowIdx] = lines.length
    lines.push(state.settingsCursor === proxySyncRowIdx ? chalk.bgRgb(20, 45, 60)(proxySyncRow) : proxySyncRow)

    const proxyPortBullet = state.settingsCursor === proxyPortRowIdx ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
    const proxyPortValue = state.settingsProxyPortEditMode && state.settingsCursor === proxyPortRowIdx
      ? chalk.cyanBright(`${state.settingsProxyPortBuffer}▏`)
      : (proxySettings.preferredPort === 0 ? chalk.dim('auto (OS-assigned)') : chalk.green(String(proxySettings.preferredPort)))
    const proxyPortRow = `${proxyPortBullet}${chalk.bold('Preferred proxy port').padEnd(44)} ${proxyPortValue}`
    cursorLineByRow[proxyPortRowIdx] = lines.length
    lines.push(state.settingsCursor === proxyPortRowIdx ? chalk.bgRgb(20, 45, 60)(proxyPortRow) : proxyPortRow)

    const proxyCleanupBullet = state.settingsCursor === proxyCleanupRowIdx ? chalk.bold.cyan('  ❯ ') : chalk.dim('    ')
    const proxyCleanupRow = `${proxyCleanupBullet}${chalk.bold('Clean OpenCode proxy config').padEnd(44)} ${chalk.dim('Enter removes fcm-proxy from opencode.json')}`
    cursorLineByRow[proxyCleanupRowIdx] = lines.length
    lines.push(state.settingsCursor === proxyCleanupRowIdx ? chalk.bgRgb(45, 30, 30)(proxyCleanupRow) : proxyCleanupRow)

    // 📖 Profiles section — list saved profiles with active indicator + delete support
    const savedProfiles = listProfiles(state.config)
    const profileStartIdx = updateRowIdx + 5
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
    } else if (state.settingsProxyPortEditMode) {
      lines.push(chalk.dim('  Type proxy port (0 = auto)  •  Enter Save  •  Esc Cancel'))
    } else {
      lines.push(chalk.dim('  ↑↓ Navigate  •  Enter Edit/Run  •  + Add key  •  - Remove key  •  Space Toggle  •  T Test key  •  S Sync→OpenCode  •  R Restore backup  •  U Updates  •  ⌫ Delete profile  •  Esc Close'))
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
    lines.push(`  ${chalk.cyan('Provider')}    Provider source (NIM, Groq, Cerebras, etc.)  ${chalk.dim('Sort:')} ${chalk.yellow('O')}  ${chalk.dim('Cycle:')} ${chalk.yellow('D')}`)
    lines.push(`              ${chalk.dim('Same model on different providers can have very different speed and uptime.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Latest')}      Most recent ping response time (ms)  ${chalk.dim('Sort:')} ${chalk.yellow('L')}`)
    lines.push(`              ${chalk.dim('Shows how fast the server is responding right now — useful to catch live slowdowns.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Avg Ping')}    Average response time across all measurable pings (200 + 401) (ms)  ${chalk.dim('Sort:')} ${chalk.yellow('A')}`)
    lines.push(`              ${chalk.dim('The long-term truth. Even without a key, a 401 still gives real latency so the average stays useful.')}`)
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
    lines.push(`  ${chalk.cyan('Used')}        Total prompt+completion tokens consumed in logs for this exact provider/model pair`)
    lines.push(`              ${chalk.dim('Loaded once at startup from request-log.jsonl. Displayed in K tokens, or M tokens above one million.')}`)
    lines.push('')
    lines.push(`  ${chalk.cyan('Usage')}       Remaining quota for this exact provider when quota telemetry is exposed  ${chalk.dim('Sort:')} ${chalk.yellow('G')}`)
    lines.push(`              ${chalk.dim('If a provider does not expose a trustworthy remaining %, the table shows a green dot instead of a fake number.')}`)

    lines.push('')
    lines.push(`  ${chalk.bold('Main TUI')}`)
    lines.push(`  ${chalk.bold('Navigation')}`)
    lines.push(`  ${chalk.yellow('↑↓')}           Navigate rows`)
    lines.push(`  ${chalk.yellow('Enter')}        Select model and launch`)
    lines.push('')
    lines.push(`  ${chalk.bold('Controls')}`)
    lines.push(`  ${chalk.yellow('W')}  Toggle ping mode  ${chalk.dim('(speed 2s → normal 10s → slow 30s → forced 4s)')}`)
    lines.push(`  ${chalk.yellow('E')}  Toggle configured models only  ${chalk.dim('(enabled by default, persisted globally + in profiles)')}`)
    lines.push(`  ${chalk.yellow('X')}  Toggle token log page  ${chalk.dim('(shows recent request usage from request-log.jsonl)')}`)
    lines.push(`  ${chalk.yellow('Z')}  Cycle tool mode  ${chalk.dim('(OpenCode → Desktop → OpenClaw → Crush → Goose)')}`)
    lines.push(`  ${chalk.yellow('F')}  Toggle favorite on selected row  ${chalk.dim('(⭐ pinned at top, persisted)')}`)
    lines.push(`  ${chalk.yellow('Q')}  Smart Recommend  ${chalk.dim('(🎯 find the best model for your task — questionnaire + live analysis)')}`)
    lines.push(`  ${chalk.rgb(57, 255, 20).bold('J')}  Request Feature  ${chalk.dim('(📝 send anonymous feedback to the project team)')}`)
    lines.push(`  ${chalk.rgb(255, 87, 51).bold('I')}  Report Bug  ${chalk.dim('(🐛 send anonymous bug report to the project team)')}`)
    lines.push(`  ${chalk.yellow('P')}  Open settings  ${chalk.dim('(manage API keys, provider toggles, proxy, manual update)')}`)
    lines.push(`  ${chalk.yellow('Shift+P')}  Cycle config profile  ${chalk.dim('(switch between saved profiles live)')}`)
    lines.push(`  ${chalk.yellow('Shift+S')}  Save current config as a named profile  ${chalk.dim('(inline prompt — type name + Enter)')}`)
    lines.push(`             ${chalk.dim('Profiles store: favorites, sort, tier filter, ping interval, configured-only filter, API keys.')}`)
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
    lines.push(`  ${chalk.cyan('free-coding-models --crush')}              ${chalk.dim('Crush mode')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --goose')}              ${chalk.dim('Goose mode')}`)
    // 📖 Temporarily disabled launchers kept out of the public help until their flows are hardened.
    // lines.push(`  ${chalk.cyan('free-coding-models --aider')}              ${chalk.dim('Aider mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --claude-code')}        ${chalk.dim('Claude Code proxy mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --codex')}              ${chalk.dim('Codex CLI proxy mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --gemini')}             ${chalk.dim('Gemini CLI proxy mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --qwen')}               ${chalk.dim('Qwen Code mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --openhands')}          ${chalk.dim('OpenHands mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --amp')}                ${chalk.dim('Amp mode')}`)
    // lines.push(`  ${chalk.cyan('free-coding-models --pi')}                 ${chalk.dim('Pi mode')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --best')}               ${chalk.dim('Only top tiers (A+, S, S+)')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --fiable')}             ${chalk.dim('10s reliability analysis')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --tier S|A|B|C')}       ${chalk.dim('Filter by tier letter')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --no-telemetry')}       ${chalk.dim('Disable telemetry for this run')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --recommend')}          ${chalk.dim('Auto-open Smart Recommend on start')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --profile <name>')}     ${chalk.dim('Load a saved config profile')}`)
    lines.push(`  ${chalk.cyan('free-coding-models --clean-proxy')}       ${chalk.dim('Remove persisted fcm-proxy config from OpenCode')}`)
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
    lines.push(chalk.dim('  Works only when the multi-account proxy is enabled and requests go through it.'))
    lines.push(chalk.dim('  Direct provider launches do not currently write into this log.'))
    lines.push('')

    // 📖 Load recent log entries — bounded read, newest-first, malformed lines skipped.
    const logRows = loadRecentLogs({ limit: 200 })
    const totalTokens = logRows.reduce((sum, row) => sum + (Number(row.tokens) || 0), 0)

    if (logRows.length === 0) {
      lines.push(chalk.dim('  No log entries found.'))
      lines.push(chalk.dim('  Logs are written to ~/.free-coding-models/request-log.jsonl'))
      lines.push(chalk.dim('  when requests are proxied through the multi-account rotation proxy.'))
      lines.push(chalk.dim('  Direct provider launches do not currently feed this token log.'))
    } else {
      lines.push(`  ${chalk.bold('Total Consumed:')} ${chalk.greenBright(formatLogTokens(totalTokens))}`)
      lines.push('')
      // 📖 Column widths for the log table
      const W_TIME    = 19
      const W_PROV    = 14
      const W_MODEL   = 36
      const W_STATUS  = 8
      const W_TOKENS  = 12
      const W_LAT     = 10

      // 📖 Header row
      const hTime   = chalk.dim('Time'.padEnd(W_TIME))
      const hProv   = chalk.dim('Provider'.padEnd(W_PROV))
      const hModel  = chalk.dim('Model'.padEnd(W_MODEL))
      const hStatus = chalk.dim('Status'.padEnd(W_STATUS))
      const hTok    = chalk.dim('Tokens Used'.padEnd(W_TOKENS))
      const hLat    = chalk.dim('Latency'.padEnd(W_LAT))
      lines.push(`  ${hTime}  ${hProv}  ${hModel}  ${hStatus}  ${hTok}  ${hLat}`)
      lines.push(chalk.dim('  ' + '─'.repeat(W_TIME + W_PROV + W_MODEL + W_STATUS + W_TOKENS + W_LAT + 10)))

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

        const tokStr = formatLogTokens(row.tokens)
        const latStr = row.latency > 0 ? `${row.latency}ms` : '--'

        const timeCell  = chalk.dim(timeStr.slice(0, W_TIME).padEnd(W_TIME))
        const provCell  = chalk.cyan(row.provider.slice(0, W_PROV).padEnd(W_PROV))
        const modelCell = chalk.white(row.model.slice(0, W_MODEL).padEnd(W_MODEL))
        const tokCell   = chalk.dim(tokStr.padEnd(W_TOKENS))
        const latCell   = chalk.dim(latStr.padEnd(W_LAT))

        lines.push(`  ${timeCell}  ${provCell}  ${modelCell}  ${statusCell}  ${tokCell}  ${latCell}`)
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

  return {
    renderSettings,
    renderHelp,
    renderLog,
    renderRecommend,
    renderFeatureRequest,
    renderBugReport,
    startRecommendAnalysis,
    stopRecommendAnalysis,
  }
}
