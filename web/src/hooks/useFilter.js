/**
 * @file web/src/hooks/useFilter.js
 * @description React hook for model filtering and tri-state sorting state.
 *
 * 📖 M1 parity additions (vs the previous version):
 * 📖   - verdict filter cycle   (`V` in TUI)
 * 📖   - health filter cycle    (`H` in TUI)
 * 📖   - visibility mode cycle  (`E` in TUI: Normal / Configured-only / Usable-only)
 * 📖   - custom text filter     (Ctrl+P → "Apply text filter" in TUI)
 * 📖   - resetView()            (`N` in TUI) — clears every filter back to defaults
 *
 * 📖 All TUI filter values (tier / status / provider / verdict / health)
 * 📖 are read in a single sorted pass so the visible list always matches the
 * 📖 header chip bar one-to-one.
 *
 * @functions
 *   → useFilter(models) — filter + sort state for the dashboard table
 * @exports useFilter
 */
import { useState, useMemo, useCallback } from 'react'
import { tierRank, verdictRank, parseSwe } from '../utils/ranks.js'
import { formatCtx } from '../utils/format.js'

// 📖 TUI constants mirrored in JS so the Web chips use the same labels/cycle as the TUI.
export const TIER_CYCLE = ['all', 'S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']
export const STATUS_CYCLE = ['all', 'up', 'down', 'pending']
// 📖 Verdict filter: full set of verdict states the TUI cycles through.
// 📖 `all` = no verdict filter (the TUI's null position in VERDICT_CYCLE).
export const VERDICT_CYCLE = ['all', 'Perfect', 'Normal', 'Spiky', 'Slow', 'Overloaded', 'Down', 'Unstable', 'Pending']
// 📖 Health filter: matches the TUI's HEALTH_CYCLE exactly.
export const HEALTH_CYCLE = ['all', 'up', 'timeout', 'down', 'pending', 'noauth', 'auth_error']
// 📖 Visibility mode: TUI's E key cycle — Normal / Configured-only / Usable-only.
export const VISIBILITY_CYCLE = ['normal', 'configured', 'usable']

function rankOrder(model) {
  return model.idx ?? 9999
}

function pingHistory(model) {
  return model.pingHistory || model.pings || []
}

function latestPingMs(model) {
  const hist = pingHistory(model)
  const latest = hist.length > 0 ? hist[hist.length - 1] : null
  return latest?.ms ?? null
}

function trendDelta(model) {
  const points = pingHistory(model)
    .map((point) => point?.ms)
    .filter((ms) => typeof ms === 'number' && Number.isFinite(ms))
  if (points.length < 2) return null
  return points[points.length - 1] - points[0]
}

function numericOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function compareNullableNumber(aValue, bValue, direction) {
  const aMissing = aValue == null
  const bMissing = bValue == null
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return (aValue - bValue) * direction
}

function compareNullableString(aValue, bValue, direction) {
  const aText = typeof aValue === 'string' ? aValue : ''
  const bText = typeof bValue === 'string' ? bValue : ''
  const aMissing = aText.length === 0
  const bMissing = bText.length === 0
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return aText.localeCompare(bText) * direction
}

// 📖 Health order: same precedence as the TUI's HEALTH_CYCLE.
// 📖 "up" is best, noauth/auth_error are worst.
const HEALTH_ORDER = {
  up: 0, pending: 1, timeout: 2, down: 3, noauth: 4, auth_error: 5,
}

export function useFilter(models) {
  // 📖 Initial values match the TUI defaults (everything off, "all" everywhere).
  const [filterTier, setFilterTier] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProvider, setFilterProvider] = useState('all')
  const [filterVerdict, setFilterVerdict] = useState('all')
  const [filterHealth, setFilterHealth] = useState('all')
  const [visibilityMode, setVisibilityMode] = useState('normal')
  const [searchQuery, setSearchQuery] = useState('')
  const [customTextFilter, setCustomTextFilter] = useState(null)
  const [sortColumn, setSortColumn] = useState('avg')
  const [sortDirection, setSortDirection] = useState('asc')

  // 📖 Cycle helpers: clicking the same chip advances to the next value in its
  // 📖 cycle, matching the TUI's single-key cycling (T / D / V / H / E).
  const cycleFilter = useCallback((current, cycle, setter) => {
    const idx = cycle.indexOf(current)
    setter(cycle[(idx + 1) % cycle.length])
  }, [])

  const cycleTier = useCallback(() => cycleFilter(filterTier, TIER_CYCLE, setFilterTier), [filterTier, cycleFilter])
  const cycleStatus = useCallback(() => cycleFilter(filterStatus, STATUS_CYCLE, setFilterStatus), [filterStatus, cycleFilter])
  const cycleVerdict = useCallback(() => cycleFilter(filterVerdict, VERDICT_CYCLE, setFilterVerdict), [filterVerdict, cycleFilter])
  const cycleHealth = useCallback(() => cycleFilter(filterHealth, HEALTH_CYCLE, setFilterHealth), [filterHealth, cycleFilter])
  const cycleVisibility = useCallback(() => cycleFilter(visibilityMode, VISIBILITY_CYCLE, setVisibilityMode), [visibilityMode, cycleFilter])

  const toggleSort = useCallback((col) => {
    if (sortColumn !== col) {
      setSortColumn(col)
      setSortDirection('asc')
      return
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }
    // 📖 Third click resets the column: no active sort, catalog/rank order.
    setSortColumn(null)
    setSortDirection('asc')
  }, [sortColumn, sortDirection])

  // 📖 Reset view — TUI's `N` key. Wipes every filter + sort back to default
  // 📖 and clears the search box. The custom text filter is part of the view
  // 📖 state and gets cleared too.
  const resetView = useCallback(() => {
    setFilterTier('all')
    setFilterStatus('all')
    setFilterProvider('all')
    setFilterVerdict('all')
    setFilterHealth('all')
    setVisibilityMode('normal')
    setSearchQuery('')
    setCustomTextFilter(null)
    setSortColumn('avg')
    setSortDirection('asc')
  }, [])

  const filtered = useMemo(() => {
    let result = [...models]

    // ── Tier ──
    if (filterTier !== 'all') result = result.filter((m) => m.tier === filterTier)
    // ── Status (coarser cycle that maps onto the TUI's "health" semantics) ──
    if (filterStatus !== 'all') {
      result = result.filter((m) => {
        if (filterStatus === 'up') return m.status === 'up'
        if (filterStatus === 'down') return m.status === 'down' || m.status === 'timeout'
        if (filterStatus === 'pending') return m.status === 'pending'
        return true
      })
    }
    // ── Provider ──
    if (filterProvider !== 'all') result = result.filter((m) => m.providerKey === filterProvider)
    // ── Verdict (TUI's `V` cycle) ──
    if (filterVerdict !== 'all') result = result.filter((m) => m.verdict === filterVerdict)
    // ── Health (TUI's `H` cycle — full granularity) ──
    if (filterHealth !== 'all') result = result.filter((m) => m.status === filterHealth)
    // ── Visibility mode (TUI's `E` cycle) ──
    if (visibilityMode === 'configured') {
      // 📖 Hide models with no API key OR auth/noauth errors. Keep timeout/429.
      result = result.filter((m) => m.hasApiKey && m.status !== 'noauth' && m.status !== 'auth_error')
    } else if (visibilityMode === 'usable') {
      // 📖 Only Health UP with verdict in the good set (Perfect / Normal / Slow).
      result = result.filter((m) => {
        if (m.status !== 'up') return false
        return ['Perfect', 'Normal', 'Slow'].includes(m.verdict)
      })
    }
    // ── Search + custom text filter (TUI's Ctrl+P "Apply text filter") ──
    const searchLower = searchQuery.trim().toLowerCase()
    const customLower = (customTextFilter || '').trim().toLowerCase()
    if (searchLower) {
      result = result.filter((m) => (
        m.label.toLowerCase().includes(searchLower) ||
        m.modelId.toLowerCase().includes(searchLower) ||
        m.origin.toLowerCase().includes(searchLower) ||
        m.tier.toLowerCase().includes(searchLower) ||
        (m.verdict || '').toLowerCase().includes(searchLower)
      ))
    }
    if (customLower) {
      result = result.filter((m) => (
        m.label.toLowerCase().includes(customLower) ||
        m.modelId.toLowerCase().includes(customLower) ||
        m.origin.toLowerCase().includes(customLower) ||
        (m.ctx || '').toLowerCase().includes(customLower) ||
        (m.providerKey || '').toLowerCase().includes(customLower)
      ))
    }

    result.sort((a, b) => {
      if (!sortColumn) return rankOrder(a) - rankOrder(b)

      const direction = sortDirection === 'desc' ? -1 : 1
      let cmp = 0

      if (sortColumn === 'mood') {
        cmp = compareNullableNumber(verdictRank(a.verdict), verdictRank(b.verdict), direction)
      } else if (sortColumn === 'idx') {
        cmp = compareNullableNumber(rankOrder(a), rankOrder(b), direction)
      } else if (sortColumn === 'tier') {
        cmp = compareNullableNumber(tierRank(a.tier), tierRank(b.tier), direction)
      } else if (sortColumn === 'label') {
        cmp = compareNullableString(a.label, b.label, direction)
      } else if (sortColumn === 'origin') {
        cmp = compareNullableString(a.origin, b.origin, direction)
      } else if (sortColumn === 'sweScore') {
        cmp = compareNullableNumber(parseSwe(a.sweScore), parseSwe(b.sweScore), direction)
      } else if (sortColumn === 'ctx') {
        cmp = compareNullableNumber(formatCtx(a.ctx), formatCtx(b.ctx), direction)
      } else if (sortColumn === 'latestPing') {
        cmp = compareNullableNumber(latestPingMs(a), latestPingMs(b), direction)
      } else if (sortColumn === 'avg') {
        const aAvg = a.avg == null || a.avg === Infinity || a.avg > 99000 ? null : a.avg
        const bAvg = b.avg == null || b.avg === Infinity || b.avg > 99000 ? null : b.avg
        cmp = compareNullableNumber(aAvg, bAvg, direction)
      } else if (sortColumn === 'condition') {
        cmp = compareNullableNumber(HEALTH_ORDER[a.status] ?? 9, HEALTH_ORDER[b.status] ?? 9, direction)
      } else if (sortColumn === 'verdict') {
        cmp = compareNullableNumber(verdictRank(a.verdict), verdictRank(b.verdict), direction)
      } else if (sortColumn === 'stability') {
        cmp = compareNullableNumber(numericOrNull(a.stability), numericOrNull(b.stability), direction)
      } else if (sortColumn === 'uptime') {
        cmp = compareNullableNumber(numericOrNull(a.uptime), numericOrNull(b.uptime), direction)
      } else if (sortColumn === 'aiLatency') {
        cmp = compareNullableNumber(a.benchmark?.ok ? a.benchmark.totalMs : null, b.benchmark?.ok ? b.benchmark.totalMs : null, direction)
      } else if (sortColumn === 'tps') {
        cmp = compareNullableNumber(a.benchmark?.ok ? a.benchmark.tokensPerSecond ?? 0 : null, b.benchmark?.ok ? b.benchmark.tokensPerSecond ?? 0 : null, direction)
      } else if (sortColumn === 'quota') {
        cmp = compareNullableNumber(numericOrNull(a.usagePercent), numericOrNull(b.usagePercent), direction)
      } else if (sortColumn === 'trend') {
        cmp = compareNullableNumber(trendDelta(a), trendDelta(b), direction)
      }

      return cmp || (rankOrder(a) - rankOrder(b))
    })

    return result
  }, [models, filterTier, filterStatus, filterProvider, filterVerdict, filterHealth, visibilityMode, searchQuery, customTextFilter, sortColumn, sortDirection])

  return {
    filtered,
    filterTier, setFilterTier, cycleTier,
    filterStatus, setFilterStatus, cycleStatus,
    filterProvider, setFilterProvider,
    filterVerdict, setFilterVerdict, cycleVerdict,
    filterHealth, setFilterHealth, cycleHealth,
    visibilityMode, setVisibilityMode, cycleVisibility,
    searchQuery, setSearchQuery,
    customTextFilter, setCustomTextFilter,
    sortColumn, sortDirection, toggleSort,
    resetView,
  }
}

// ─── 3-bucket sort helpers (extracted for unit testing) ────────────────
// 📖 The AI Latency + TPS columns sort rows by a "bucket" then by value:
// 📖   bucket 0 = completed benchmark (has a real result)
// 📖   bucket 1 = benchmark currently running (no result yet, but isBenchmarking)
// 📖   bucket 2 = never tested (no benchmark object, not running)
// 📖 Rows in buckets 1 and 2 are NOT sorted by their numeric value (they don't
// 📖 have one) — the comparator returns 0 inside each bucket so the rank-based
// 📖 tie-breaker takes over.

/**
 * 📖 Classify a model into one of the 3 benchmark buckets.
 * @param {{benchmark?: {ok?: boolean}|null, isBenchmarking?: boolean}} model
 * @returns {0|1|2}
 */
export function benchmarkBucket(model) {
  if (!model) return 2
  if (model.benchmark && model.benchmark.ok === true) return 0
  if (model.isBenchmarking === true) return 1
  return 2
}

/**
 * 📖 Comparator for the AI Latency / TPS sort columns.
 * 📖 Always agrees on bucket order (completed → running → never) regardless of
 * 📖 direction. Within each bucket, returns 0 so the rank tie-breaker applies.
 * 📖 `valueGetter` reads the numeric metric (totalMs for latency, tokensPerSecond for TPS).
 * @param {object} a
 * @param {object} b
 * @param {1|-1} direction  — 1 = ascending, -1 = descending
 * @param {(bench: object) => number} valueGetter
 * @returns {number}
 */
export function compareBenchmark(a, b, direction, valueGetter) {
  const ba = benchmarkBucket(a)
  const bb = benchmarkBucket(b)
  if (ba !== bb) {
    // 📖 Completed always first, never-tested always last, regardless of direction.
    if (ba < bb) return -1
    return 1
  }
  if (ba !== 0) return 0
  // 📖 Both completed: sort by the actual metric.
  const va = valueGetter ? valueGetter(a.benchmark) : null
  const vb = valueGetter ? valueGetter(b.benchmark) : null
  if (va == null && vb == null) return 0
  if (va == null) return 1
  if (vb == null) return -1
  return (va - vb) * direction
}
