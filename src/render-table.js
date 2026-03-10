/**
 * @file render-table.js
 * @description Master table renderer for the main TUI list.
 *
 * @details
 *   This module contains the full renderTable implementation used by the CLI.
 *   It renders the header, model rows, status indicators, and footer hints
 *   with consistent alignment, colorization, and viewport clipping.
 *
 *   🎯 Key features:
 *   - Full table layout with tier, latency, stability, uptime, token totals, and usage columns
 *   - Hotkey-aware header lettering so highlighted letters always match live sort/filter keys
 *   - Emoji-aware padding via padEndDisplay for aligned verdict/status cells
 *   - Viewport clipping with above/below indicators
 *   - Smart badges (mode, tier filter, origin filter, profile)
 *   - Proxy status line integrated in footer
 *   - Install-endpoints shortcut surfaced directly in the footer hints
 *   - Distinct auth-failure vs missing-key health labels so configured providers stay honest
 *
 *   → Functions:
 *   - `setActiveProxy` — Provide the active proxy instance for footer status rendering
 *   - `renderTable` — Render the full TUI table as a string (no side effects)
 *
 *   📦 Dependencies:
 *   - ../sources.js: sources provider metadata
 *   - ../src/constants.js: PING_INTERVAL, FRAMES
 *   - ../src/tier-colors.js: TIER_COLOR
 *   - ../src/utils.js: getAvg, getVerdict, getUptime, getStabilityScore
 *   - ../src/ping.js: usagePlaceholderForProvider
 *   - ../src/render-helpers.js: calculateViewport, sortResultsWithPinnedFavorites, renderProxyStatusLine, padEndDisplay
 *
 *   @see bin/free-coding-models.js — main entry point that calls renderTable
 */

import chalk from 'chalk'
import { createRequire } from 'module'
import { sources } from '../sources.js'
import { PING_INTERVAL, FRAMES } from './constants.js'
import { TIER_COLOR } from './tier-colors.js'
import { getAvg, getVerdict, getUptime, getStabilityScore, getVersionStatusInfo } from './utils.js'
import { usagePlaceholderForProvider } from './ping.js'
import { formatTokenTotalCompact } from './token-usage-reader.js'
import { calculateViewport, sortResultsWithPinnedFavorites, renderProxyStatusLine, padEndDisplay } from './render-helpers.js'
import { getToolMeta } from './tool-metadata.js'

const ACTIVE_FILTER_BG_BY_TIER = {
  'S+': [57, 255, 20],
  'S': [57, 255, 20],
  'A+': [160, 255, 60],
  'A': [255, 224, 130],
  'A-': [255, 204, 128],
  'B+': [255, 171, 64],
  'B': [239, 83, 80],
  'C': [186, 104, 200],
}

const require = createRequire(import.meta.url)
const { version: LOCAL_VERSION } = require('../package.json')

// 📖 Provider column palette: soft pastel rainbow so each provider stays easy
// 📖 to spot without turning the table into a harsh neon wall.
const PROVIDER_COLOR = {
  nvidia: [178, 235, 190],
  groq: [255, 204, 188],
  cerebras: [179, 229, 252],
  sambanova: [255, 224, 178],
  openrouter: [225, 190, 231],
  huggingface: [255, 245, 157],
  replicate: [187, 222, 251],
  deepinfra: [178, 223, 219],
  fireworks: [255, 205, 210],
  codestral: [248, 187, 208],
  hyperbolic: [255, 171, 145],
  scaleway: [129, 212, 250],
  googleai: [187, 222, 251],
  siliconflow: [178, 235, 242],
  together: [255, 241, 118],
  cloudflare: [255, 204, 128],
  perplexity: [244, 143, 177],
  qwen: [255, 224, 130],
  zai: [174, 213, 255],
  iflow: [220, 231, 117],
}

// 📖 Active proxy reference for footer status line (set by bin/free-coding-models.js).
let activeProxyRef = null

// 📖 setActiveProxy: Store active proxy instance for renderTable footer line.
export function setActiveProxy(proxyInstance) {
  activeProxyRef = proxyInstance
}

// ─── renderTable: mode param controls footer hint text (opencode vs openclaw) ─────────
export function renderTable(results, pendingPings, frame, cursor = null, sortColumn = 'avg', sortDirection = 'asc', pingInterval = PING_INTERVAL, lastPingTime = Date.now(), mode = 'opencode', tierFilterMode = 0, scrollOffset = 0, terminalRows = 0, terminalCols = 0, originFilterMode = 0, activeProfile = null, profileSaveMode = false, profileSaveBuffer = '', proxyStartupStatus = null, pingMode = 'normal', pingModeSource = 'auto', hideUnconfiguredModels = false, widthWarningStartedAt = null, widthWarningDismissed = false, settingsUpdateState = 'idle', settingsUpdateLatestVersion = null, proxyEnabled = false) {
  // 📖 Filter out hidden models for display
  const visibleResults = results.filter(r => !r.hidden)

  const up      = visibleResults.filter(r => r.status === 'up').length
  const down    = visibleResults.filter(r => r.status === 'down').length
  const timeout = visibleResults.filter(r => r.status === 'timeout').length
  const pending = visibleResults.filter(r => r.status === 'pending').length
  const totalVisible = visibleResults.length
  const completedPings = Math.max(0, totalVisible - pending)

  // 📖 Calculate seconds until next ping
  const timeSinceLastPing = Date.now() - lastPingTime
  const timeUntilNextPing = Math.max(0, pingInterval - timeSinceLastPing)
  const secondsUntilNext = timeUntilNextPing / 1000
  const secondsUntilNextLabel = secondsUntilNext.toFixed(1)

  const intervalSec = Math.round(pingInterval / 1000)
  const pingModeMeta = {
    speed: { label: 'fast', color: chalk.bold.rgb(255, 210, 80) },
    normal: { label: 'normal', color: chalk.bold.rgb(120, 210, 255) },
    slow: { label: 'slow', color: chalk.bold.rgb(255, 170, 90) },
    forced: { label: 'forced', color: chalk.bold.rgb(255, 120, 120) },
  }
  const activePingMode = pingModeMeta[pingMode] ?? pingModeMeta.normal
  const pingProgressText = `${completedPings}/${totalVisible}`
  const nextCountdownColor = secondsUntilNext > 8
    ? chalk.red.bold
    : secondsUntilNext >= 4
      ? chalk.yellow.bold
      : secondsUntilNext < 1
        ? chalk.greenBright.bold
        : chalk.green.bold
  const pingControlBadge =
    activePingMode.color(' [ ') +
    chalk.yellow.bold('W') +
    activePingMode.color(` Ping Interval : ${intervalSec}s (${activePingMode.label}) - ${pingProgressText} - next : `) +
    nextCountdownColor(`${secondsUntilNextLabel}s`) +
    activePingMode.color(' ]')

  // 📖 Tool badge keeps the active launch target visible in the header, so the
  // 📖 footer no longer needs a redundant Enter action or mode toggle reminder.
  const toolMeta = getToolMeta(mode)
  const toolBadgeColor = mode === 'openclaw'
    ? chalk.bold.rgb(255, 100, 50)
    : chalk.bold.rgb(0, 200, 255)
  const modeBadge = toolBadgeColor(' [ ') + chalk.yellow.bold('Z') + toolBadgeColor(` Tool : ${toolMeta.label} ]`)
  const activeHeaderBadge = (text, bg = [57, 255, 20], fg = [0, 0, 0]) => chalk.bgRgb(...bg).rgb(...fg).bold(` ${text} `)
  const versionStatus = getVersionStatusInfo(settingsUpdateState, settingsUpdateLatestVersion)

  // 📖 Tier filter badge shown when filtering is active (shows exact tier name)
  const TIER_CYCLE_NAMES = [null, 'S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']
  let tierBadge = ''
  let activeTierLabel = ''
  if (tierFilterMode > 0) {
    activeTierLabel = TIER_CYCLE_NAMES[tierFilterMode]
    const tierBg = ACTIVE_FILTER_BG_BY_TIER[activeTierLabel] || [57, 255, 20]
    tierBadge = ` ${activeHeaderBadge(`TIER (${activeTierLabel})`, tierBg)}`
  }

  const normalizeOriginLabel = (name, key) => {
    if (key === 'qwen') return 'Alibaba'
    return name
  }

  // 📖 Origin filter badge — shown when filtering by provider is active
  let originBadge = ''
  let activeOriginLabel = ''
  if (originFilterMode > 0) {
    const originKeys = [null, ...Object.keys(sources)]
    const activeOriginKey = originKeys[originFilterMode]
    const activeOriginName = activeOriginKey ? sources[activeOriginKey]?.name ?? activeOriginKey : null
    if (activeOriginName) {
      activeOriginLabel = normalizeOriginLabel(activeOriginName, activeOriginKey)
      const providerRgb = PROVIDER_COLOR[activeOriginKey] || [255, 255, 255]
      originBadge = ` ${activeHeaderBadge(`PROVIDER (${activeOriginLabel})`, [0, 0, 0], providerRgb)}`
    }
  }

  let configuredBadge = ''
  if (hideUnconfiguredModels) {
    configuredBadge = ` ${activeHeaderBadge('CONFIGURED ONLY')}`
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
  const W_TOKENS = 7
  const W_USAGE = 7
  const MIN_TABLE_WIDTH = 166
  const warningDurationMs = 5_000
  const elapsed = widthWarningStartedAt ? Math.max(0, Date.now() - widthWarningStartedAt) : warningDurationMs
  const remainingMs = Math.max(0, warningDurationMs - elapsed)
  const showWidthWarning = terminalCols > 0 && terminalCols < MIN_TABLE_WIDTH && !widthWarningDismissed && remainingMs > 0

  if (showWidthWarning) {
    const lines = []
    const blankLines = Math.max(0, Math.floor(((terminalRows || 24) - 5) / 2))
    const warning = 'Please maximize your terminal for optimal use.'
    const warning2 = 'The current terminal is too small.'
    const warning3 = 'Reduce font size or maximize width of terminal.'
    const padLeft = Math.max(0, Math.floor((terminalCols - warning.length) / 2))
    const padLeft2 = Math.max(0, Math.floor((terminalCols - warning2.length) / 2))
    const padLeft3 = Math.max(0, Math.floor((terminalCols - warning3.length) / 2))
    for (let i = 0; i < blankLines; i++) lines.push('')
    lines.push(' '.repeat(padLeft) + chalk.red.bold(warning))
    lines.push(' '.repeat(padLeft2) + chalk.red(warning2))
    lines.push(' '.repeat(padLeft3) + chalk.red(warning3))
    lines.push('')
    lines.push(' '.repeat(Math.max(0, Math.floor((terminalCols - 34) / 2))) + chalk.yellow(`this message will hide in ${(remainingMs / 1000).toFixed(1)}s`))
    lines.push(' '.repeat(Math.max(0, Math.floor((terminalCols - 20) / 2))) + chalk.dim('press esc to dismiss'))
    while (terminalRows > 0 && lines.length < terminalRows) lines.push('')
    const EL = '\x1b[K'
    return lines.map(line => line + EL).join('\n')
  }

  // 📖 Sort models using the shared helper
  const sorted = sortResultsWithPinnedFavorites(visibleResults, sortColumn, sortDirection)

  const lines = [
    `  ${chalk.greenBright.bold(`✅ Free-Coding-Models v${LOCAL_VERSION}`)}${modeBadge}${pingControlBadge}${tierBadge}${originBadge}${configuredBadge}${profileBadge}${chalk.reset('')}   ` +
      chalk.greenBright(`✅ ${up}`) + chalk.dim(' up  ') +
      chalk.yellow(`⏳ ${timeout}`) + chalk.dim(' timeout  ') +
      chalk.red(`❌ ${down}`) + chalk.dim(' down  ') +
      '',
    '',
  ]

  // 📖 Header row with sorting indicators
  // 📖 NOTE: padEnd on chalk strings counts ANSI codes, breaking alignment
  // 📖 Solution: build plain text first, then colorize
  const dir = sortDirection === 'asc' ? '↑' : '↓'

  const rankH    = 'Rank'
  const tierH    = 'Tier'
  const originH  = 'Provider'
  const modelH   = 'Model'
  const sweH     = sortColumn === 'swe' ? dir + ' SWE%' : 'SWE%'
  const ctxH     = sortColumn === 'ctx' ? dir + ' CTX' : 'CTX'
  const pingH    = sortColumn === 'ping' ? dir + ' Latest Ping' : 'Latest Ping'
  const avgH     = sortColumn === 'avg' ? dir + ' Avg Ping' : 'Avg Ping'
  const healthH  = sortColumn === 'condition' ? dir + ' Health' : 'Health'
  const verdictH = sortColumn === 'verdict' ? dir + ' Verdict' : 'Verdict'
  const stabH    = sortColumn === 'stability' ? dir + ' Stability' : 'Stability'
  const uptimeH  = sortColumn === 'uptime' ? dir + ' Up%' : 'Up%'
  const tokensH  = 'Used'
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
  const originLabel = 'Provider'
  const originH_c  = sortColumn === 'origin'
    ? chalk.bold.cyan(originLabel.padEnd(W_SOURCE))
    : (originFilterMode > 0 ? chalk.bold.rgb(100, 200, 255)(originLabel.padEnd(W_SOURCE)) : (() => {
      // 📖 Provider keeps O for sorting and D for provider-filter cycling.
      const plain = 'PrOviDer'
      const padding = ' '.repeat(Math.max(0, W_SOURCE - plain.length))
      return chalk.dim('Pr') + chalk.yellow.bold('O') + chalk.dim('vi') + chalk.yellow.bold('D') + chalk.dim('er' + padding)
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
  // 📖 Up% sorts on U, so keep the highlighted shortcut in the shared yellow sort-key color.
  const uptimeH_c  = sortColumn === 'uptime' ? chalk.bold.cyan(uptimeH.padEnd(W_UPTIME)) : (() => {
    const plain = 'Up%'
    const padding = ' '.repeat(Math.max(0, W_UPTIME - plain.length))
    return chalk.yellow.bold('U') + chalk.dim('p%' + padding)
  })()
  const tokensH_c  = chalk.dim(tokensH.padEnd(W_TOKENS))
  // 📖 Usage sorts on plain G, so the highlighted letter must stay in the visible header.
  const usageH_c   = sortColumn === 'usage' ? chalk.bold.cyan(usageH.padEnd(W_USAGE)) : (() => {
    const plain = 'UsaGe'
    const padding = ' '.repeat(Math.max(0, W_USAGE - plain.length))
    return chalk.dim('Usa') + chalk.yellow.bold('G') + chalk.dim('e' + padding)
  })()

  // 📖 Header with proper spacing (column order: Rank, Tier, SWE%, CTX, Model, Provider, Latest Ping, Avg Ping, Health, Verdict, Stability, Up%, Used, Usage)
  lines.push('  ' + rankH_c + '  ' + tierH_c + '  ' + sweH_c + '  ' + ctxH_c + '  ' + modelH_c + '  ' + originH_c + '  ' + pingH_c + '  ' + avgH_c + '  ' + healthH_c + '  ' + verdictH_c + '  ' + stabH_c + '  ' + uptimeH_c + '  ' + tokensH_c + '  ' + usageH_c)

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
    chalk.dim('─'.repeat(W_TOKENS)) + '  ' +
    chalk.dim('─'.repeat(W_USAGE))
  )

  if (sorted.length === 0) {
    lines.push('')
    if (hideUnconfiguredModels) {
      lines.push(`  ${chalk.redBright.bold('Press P to configure your API key.')}`)
      lines.push(`  ${chalk.dim('No configured provider currently exposes visible models in the table.')}`)
    } else {
      lines.push(`  ${chalk.yellow.bold('No models match the current filters.')}`)
    }
  }

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
    const providerNameRaw = sources[r.providerKey]?.name ?? r.providerKey ?? 'NIM'
    const providerName = normalizeOriginLabel(providerNameRaw, r.providerKey)
    const providerRgb = PROVIDER_COLOR[r.providerKey] ?? [105, 190, 245]
    const source = chalk.rgb(...providerRgb)(providerName.padEnd(W_SOURCE))
    // 📖 Favorites: always reserve 2 display columns at the start of Model column.
    // 📖 🎯 (2 cols) for recommended, ⭐ (2 cols) for favorites, '  ' (2 spaces) for non-favorites — keeps alignment stable.
    const favoritePrefix = r.isRecommended ? '🎯' : r.isFavorite ? '⭐' : '  '
    const prefixDisplayWidth = 2
    const nameWidth = Math.max(0, W_MODEL - prefixDisplayWidth)
    const name = favoritePrefix + r.label.slice(0, nameWidth).padEnd(nameWidth)
    const modelColor = chalk.rgb(...providerRgb)
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

    // 📖 Keep the row-local spinner small and inline so users can still read the last measured latency.
    const buildLatestPingDisplay = (value) => {
      const spinner = r.isPinging ? ` ${FRAMES[frame % FRAMES.length]}` : ''
      return `${value}${spinner}`.padEnd(W_PING)
    }

    // 📖 Latest ping - pings are objects: { ms, code }
    // 📖 Show response time for 200 (success) and 401 (no-auth but server is reachable)
    const latestPing = r.pings.length > 0 ? r.pings[r.pings.length - 1] : null
    let pingCell
    if (!latestPing) {
      const placeholder = r.isPinging ? buildLatestPingDisplay('———') : '———'.padEnd(W_PING)
      pingCell = chalk.dim(placeholder)
    } else if (latestPing.code === '200') {
      // 📖 Success - show response time
      const str = buildLatestPingDisplay(String(latestPing.ms))
      pingCell = latestPing.ms < 500 ? chalk.greenBright(str) : latestPing.ms < 1500 ? chalk.yellow(str) : chalk.red(str)
    } else if (latestPing.code === '401') {
      // 📖 401 = no API key but server IS reachable — still show latency in dim
      pingCell = chalk.dim(buildLatestPingDisplay(String(latestPing.ms)))
    } else {
      // 📖 Error or timeout - show "———" (error code is already in Status column)
      const placeholder = r.isPinging ? buildLatestPingDisplay('———') : '———'.padEnd(W_PING)
      pingCell = chalk.dim(placeholder)
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
    } else if (r.status === 'auth_error') {
      // 📖 A key is configured but the provider rejected it — keep this distinct
      // 📖 from "no key" so configured-only mode does not look misleading.
      statusText = `🔐 AUTH FAIL`
      statusColor = (s) => chalk.redBright(s)
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
      const errorLabels = {
        '404': '404 NOT FOUND',
        '410': '410 GONE',
        '429': '429 TRY LATER',
        '500': '500 ERROR',
      }
      const emoji = errorEmojis[code] || '❌'
      statusText = `${emoji} ${errorLabels[code] || code}`
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

    // 📖 Model text now mirrors the provider hue so provider affinity is visible
    // 📖 even before the eye reaches the Provider column.
    const nameCell = isCursor ? modelColor.bold(name) : modelColor(name)
    const sourceCursorText = providerName.padEnd(W_SOURCE)
    const sourceCell = isCursor ? chalk.rgb(...providerRgb).bold(sourceCursorText) : source

    // 📖 Usage column — provider-scoped remaining quota when measurable,
    // 📖 otherwise a green dot to show "usable but not meaningfully quantifiable".
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
      const usagePlaceholder = usagePlaceholderForProvider(r.providerKey)
      usageCell = usagePlaceholder === '🟢'
        ? chalk.greenBright(usagePlaceholder.padEnd(W_USAGE))
        : chalk.dim(usagePlaceholder.padEnd(W_USAGE))
    }

    // 📖 Used column — total historical prompt+completion tokens consumed for this
    // 📖 exact provider/model pair, loaded once from request-log.jsonl at startup.
    const tokenTotal = Number(r.totalTokens) || 0
    const tokensCell = tokenTotal > 0
      ? chalk.rgb(120, 210, 255)(formatTokenTotalCompact(tokenTotal).padEnd(W_TOKENS))
      : chalk.dim('0'.padEnd(W_TOKENS))

    // 📖 Build row with double space between columns (order: Rank, Tier, SWE%, CTX, Model, Provider, Latest Ping, Avg Ping, Health, Verdict, Stability, Up%, Used, Usage)
    const row = '  ' + num + '  ' + tier + '  ' + sweCell + '  ' + ctxCell + '  ' + nameCell + '  ' + sourceCell + '  ' + pingCell + '  ' + avgCell + '  ' + status + '  ' + speedCell + '  ' + stabCell + '  ' + uptimeCell + '  ' + tokensCell + '  ' + usageCell

    if (isCursor) {
      lines.push(chalk.bgRgb(155, 55, 135)(row))
    } else if (r.isRecommended) {
      // 📖 Medium green background for recommended models (distinguishable from favorites)
      lines.push(chalk.bgRgb(15, 40, 15)(row))
    } else if (r.isFavorite) {
      lines.push(chalk.bgRgb(88, 64, 10)(row))
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
  // 📖 Footer hints keep only navigation and secondary actions now that the
  // 📖 active tool target is already visible in the header badge.
  const hotkey = (keyLabel, text) => chalk.yellow(keyLabel) + chalk.dim(text)
  // 📖 Active filter pills use a loud green background so tier/provider/configured-only
  // 📖 states are obvious even when the user misses the smaller header badges.
  const activeHotkey = (keyLabel, text, bg = [57, 255, 20], fg = [0, 0, 0]) => chalk.bgRgb(...bg).rgb(...fg)(` ${keyLabel}${text} `)
  // 📖 Line 1: core navigation + filtering shortcuts
  lines.push(
    chalk.dim(`  ↑↓ Navigate  •  `) +
    hotkey('F', ' Toggle Favorite') +
    chalk.dim(`  •  `) +
    (tierFilterMode > 0
      ? activeHotkey('T', ` Tier (${activeTierLabel})`, ACTIVE_FILTER_BG_BY_TIER[activeTierLabel] || [57, 255, 20])
      : hotkey('T', ' Tier')) +
    chalk.dim(`  •  `) +
    (originFilterMode > 0
      ? activeHotkey('D', ` Provider (${activeOriginLabel})`, [0, 0, 0], PROVIDER_COLOR[[null, ...Object.keys(sources)][originFilterMode]] || [255, 255, 255])
      : hotkey('D', ' Provider')) +
    chalk.dim(`  •  `) +
    (hideUnconfiguredModels ? activeHotkey('E', ' Configured Only') : hotkey('E', ' Configured Only')) +
    chalk.dim(`  •  `) +
    hotkey('X', ' Token Logs') +
    chalk.dim(`  •  `) +
    hotkey('P', ' Settings') +
    chalk.dim(`  •  `) +
    hotkey('K', ' Help')
  )
  // 📖 Line 2: profiles, install flow, recommend, feature request, bug report, and extended hints.
  lines.push(chalk.dim(`  `) + hotkey('⇧P', ' Cycle profile') + chalk.dim(`  •  `) + hotkey('⇧S', ' Save profile') + chalk.dim(`  •  `) + hotkey('Y', ' Install endpoints') + chalk.dim(`  •  `) + hotkey('Q', ' Smart Recommend') + chalk.dim(`  •  `) + hotkey('J', ' Request feature') + chalk.dim(`  •  `) + hotkey('I', ' Report bug'))
  // 📖 Proxy status line — always rendered with explicit state (starting/running/failed/stopped)
  lines.push(renderProxyStatusLine(proxyStartupStatus, activeProxyRef, proxyEnabled))
  if (versionStatus.isOutdated) {
    const outdatedBadge = chalk.bgRed.bold.yellow(' This version is outdated . ')
    const latestLabel = chalk.redBright(` local v${LOCAL_VERSION} · latest v${versionStatus.latestVersion}`)
    lines.push(`  ${outdatedBadge}${latestLabel}`)
  }
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
