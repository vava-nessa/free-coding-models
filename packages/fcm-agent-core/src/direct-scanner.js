/**
 * @file direct-scanner.js
 * @description Direct model scanner (non-daemon fallback) — shared core.
 *
 * @details
 *   Runs pings and AI benchmarks directly from the host agent process by
 *   importing core FCM modules. This is the slow path (no daemon), so it limits
 *   work to the top N candidates by SWE score to avoid network thrashing.
 *
 *   Rendering is NOT done here. The scanner emits structured progress events
 *   via `onProgress(event)`; each adapter decides how to show them (Pi status
 *   bar, OpenCode toast, logs, …). This keeps the core free of chalk/ANSI and
 *   host-specific UI.
 *
 * @functions
 *   - directScan → Ping + benchmark candidates, return scanned models + events
 */

import { MODELS, sources } from 'free-coding-models/sources.js'
import { ping } from 'free-coding-models/src/core/ping.js'
import { benchmarkModel } from 'free-coding-models/src/core/benchmark.js'
import { loadAllApiKeys } from './api-keys.js'
import { parseSweScore } from './ranker.js'

/**
 * @typedef {object} ScannedModel
 * @property {string} modelId
 * @property {string} label
 * @property {string} tier
 * @property {string} sweScore
 * @property {string} ctxWindow
 * @property {string} providerKey
 * @property {string} providerName
 * @property {string} providerUrl
 * @property {string} apiKey
 * @property {string} status - 'up' | 'down' | 'timeout' | 'auth_error' | 'noauth'
 * @property {number|null} latencyMs
 * @property {number|null} tps
 * @property {number|null} totalBenchMs
 * @property {number} stabilityScore
 * @property {boolean} hasKey
 */

/**
 * 📖 Scan model availability and latency directly from the agent process.
 *
 * @param {object} [options={}]
 * @param {function} [options.onProgress] - Structured progress callback `(event) => void`
 * @param {AbortSignal} [options.signal] - Abort signal to cancel the scan early
 * @param {number} [options.maxCandidates=30] - Cap on pinged candidates
 * @param {number} [options.maxBenchmarkCandidates=5] - Cap on benchmarked survivors
 * @returns {Promise<Array<ScannedModel>>} Scanned models list (unfiltered)
 */
export async function directScan(options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
  const signal = options.signal
  const maxCandidates = options.maxCandidates ?? 30
  const maxBenchmarkCandidates = options.maxBenchmarkCandidates ?? 5
  const keys = loadAllApiKeys()
  const scannedList = []

  // 📖 Step 1: Filter models by available keys (skip zen-only / cli-only models)
  const candidateModels = MODELS.filter(tuple => {
    const providerKey = tuple[5]
    const sourceInfo = sources[providerKey]
    if (!sourceInfo) return false
    if (sourceInfo.zenOnly) return false // 📖 Zen models only work in OpenCode
    const key = keys.get(providerKey)
    return !!key || !!sourceInfo.noKeyNeeded
  })

  if (candidateModels.length === 0) {
    onProgress({ phase: 'error', message: 'No configured API keys found' })
    return []
  }

  // 📖 Step 2: Sort by SWE score descending, keep top N
  const sortedCandidates = candidateModels
    .map(tuple => ({
      modelId: tuple[0],
      label: tuple[1],
      tier: tuple[2],
      sweScore: tuple[3],
      ctxWindow: tuple[4],
      providerKey: tuple[5],
      sourceInfo: sources[tuple[5]]
    }))
    .sort((a, b) => parseSweScore(b.sweScore) - parseSweScore(a.sweScore))
    .slice(0, maxCandidates)

  const totalPings = sortedCandidates.length
  let completedPings = 0

  let currentAction = 'Probing'
  let activeModels = []
  let pct = 0
  let completed = 0
  let total = totalPings

  const emit = (overrides = {}) => {
    onProgress({
      phase: currentAction === 'Probing' ? 'probing' : 'benchmarking',
      action: currentAction,
      percent: pct,
      completed,
      total,
      activeModels: activeModels.slice(-2),
      ...overrides
    })
  }

  emit()

  // 📖 Step 3: Ping candidate models in parallel (15s timeout inside ping.js)
  const pingPromises = sortedCandidates.map(async (candidate) => {
    if (signal?.aborted) return null
    const { modelId, providerKey, sourceInfo, label } = candidate
    const apiKey = keys.get(providerKey) || null
    const url = sourceInfo.url
    const providerName = sourceInfo.name || providerKey
    const target = { label, providerName }
    activeModels.push(target)
    emit()

    try {
      const res = await ping(apiKey, modelId, providerKey, url)

      let status = 'down'
      if (res.code === '200') status = 'up'
      else if (res.code === '000') status = 'timeout'
      else if (res.code === '401' || res.code === '403') {
        status = apiKey ? 'auth_error' : 'noauth'
      }

      return {
        ...candidate,
        apiKey,
        providerName,
        providerUrl: url,
        status,
        latencyMs: typeof res.ms === 'number' ? res.ms : null,
        tps: null,
        totalBenchMs: null,
        stabilityScore: 100,
        hasKey: status !== 'noauth' && status !== 'auth_error'
      }
    } catch (err) {
      return {
        ...candidate,
        apiKey,
        providerName,
        providerUrl: url,
        status: 'down',
        latencyMs: null,
        tps: null,
        totalBenchMs: null,
        stabilityScore: 100,
        hasKey: true
      }
    } finally {
      completedPings++
      pct = Math.round((completedPings / totalPings) * 100)
      completed = completedPings
      activeModels = activeModels.filter(t => t !== target)
      emit()
    }
  })

  const pingResults = await Promise.allSettled(pingPromises)
  const aliveModels = []

  for (const result of pingResults) {
    if (result.status === 'fulfilled' && result.value) {
      aliveModels.push(result.value)
    }
  }

  // 📖 Remove intermediate sourceInfo so returning plain JSON is safe
  for (const m of aliveModels) {
    delete m.sourceInfo
  }

  const usableAlive = aliveModels.filter(m => m.status === 'up')
  if (usableAlive.length === 0) {
    onProgress({ phase: 'done', percent: 100, completed: totalPings, total: totalPings, activeModels: [] })
    return aliveModels
  }

  // 📖 Step 4: AI Latency + TPS benchmark on the top survivors
  const benchmarkCandidates = usableAlive
    .sort((a, b) => parseSweScore(b.sweScore) - parseSweScore(a.sweScore))
    .slice(0, maxBenchmarkCandidates)

  currentAction = 'Benchmarking'
  completed = 0
  pct = 0
  total = benchmarkCandidates.length
  activeModels = []
  emit()

  const totalBenchmarks = benchmarkCandidates.length
  let completedBenchmarks = 0

  const benchmarkPromises = benchmarkCandidates.map(async (model) => {
    if (signal?.aborted) return { modelId: model.modelId, ok: false, code: 'ABORTED', totalMs: null }
    const { modelId, providerKey, providerUrl, apiKey, label, providerName } = model
    const target = { label, providerName }
    activeModels.push(target)
    emit()

    try {
      const res = await benchmarkModel({
        apiKey,
        modelId,
        providerKey,
        url: providerUrl,
        maxRetries: 1,
        retryDelayMs: 3000
      })

      if (res.ok) {
        return { modelId, ok: true, tps: res.tokensPerSecond || null, totalMs: res.totalMs || null }
      }
      return { modelId, ok: false, code: res.code || 'ERR', totalMs: res.totalMs || null }
    } catch (err) {
      return { modelId, ok: false, code: 'ERR', totalMs: null }
    } finally {
      completedBenchmarks++
      pct = Math.round((completedBenchmarks / totalBenchmarks) * 100)
      completed = completedBenchmarks
      activeModels = activeModels.filter(t => t !== target)
      emit()
    }
  })

  const benchmarkResults = await Promise.allSettled(benchmarkPromises)
  const benchMap = new Map()
  const benchmarkedIds = new Set(benchmarkCandidates.map((model) => model.modelId))

  for (const res of benchmarkResults) {
    if (res.status === 'fulfilled') {
      benchMap.set(res.value.modelId, res.value)
    }
  }

  onProgress({ phase: 'done', percent: 100, completed: total, total, activeModels: [] })

  // 📖 Step 5: Merge benchmark stats back in. If a survivor failed the real AI
  // 📖 latency test, mark it down: a tiny ping passing is not enough for an agent.
  return aliveModels.map(model => {
    const bench = benchMap.get(model.modelId)
    if (bench?.ok) {
      return { ...model, tps: bench.tps, totalBenchMs: bench.totalMs, benchmarkStatus: 'up' }
    }
    if (benchmarkedIds.has(model.modelId)) {
      return {
        ...model,
        status: 'down',
        tps: null,
        totalBenchMs: bench?.totalMs || null,
        benchmarkStatus: bench?.code || 'ERR'
      }
    }
    return model
  })
}
