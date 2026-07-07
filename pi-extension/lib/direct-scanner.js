/**
 * @file direct-scanner.js
 * @description Direct model scanner (non-daemon fallback).
 *
 * @details
 *   Runs pings and AI benchmarks directly from the Pi session process by
 *   importing core FCM modules. Limits requests to the top 30 models by SWE
 *   to avoid hitting local bandwidth caps. Provides real-time percentage
 *   progress tracking for the terminal status display.
 */

import { MODELS, sources } from 'free-coding-models/sources.js'
import { ping } from 'free-coding-models/src/core/ping.js'
import { benchmarkModel } from 'free-coding-models/src/core/benchmark.js'
import { loadAllApiKeys } from './api-keys.js'
import { parseSweScore } from './model-ranker.js'
import chalk from 'chalk'

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
 * @property {string} status - 'up' | 'down' | 'timeout' | 'auth_error'
 * @property {number|null} latencyMs
 * @property {number|null} tps
 * @property {number|null} totalBenchMs
 * @property {boolean} hasKey
 */

/**
 * 📖 Scan model availability and latency directly from the CLI/TUI process.
 * 
 * @param {object} options - Configuration and progress callbacks
 * @param {function} [options.onProgress] - Progress message callback
 * @returns {Promise<Array<ScannedModel>>} Scanned models list
 */
export async function directScan(options = {}) {
  const keys = loadAllApiKeys()
  const scannedList = []

  // 📖 Step 1: Filter models by available keys (and skip zen-only / cli-only models)
  const candidateModels = MODELS.filter(tuple => {
    const providerKey = tuple[5]
    const sourceInfo = sources[providerKey]
    
    if (!sourceInfo) return false
    if (sourceInfo.zenOnly) return false // 📖 Zen models only work in OpenCode
    
    const key = keys.get(providerKey)
    const hasKey = !!key
    const noKeyNeeded = !!sourceInfo.noKeyNeeded

    return hasKey || noKeyNeeded
  })

  if (candidateModels.length === 0) {
    if (options.onProgress) options.onProgress('No configured API keys found')
    return []
  }

  // 📖 Step 2: Sort by SWE score descending, keep top 30 to prevent network thrashing
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
    .slice(0, 30)

  const totalPings = sortedCandidates.length
  let completedPings = 0

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let spinnerIndex = 0
  let currentAction = 'Probing'
  let currentTargets = []
  let pct = 0
  let completed = 0
  let total = totalPings

  const updateProgress = () => {
    if (!options.onProgress) return
    const spinner = chalk.bold.magenta(spinnerFrames[spinnerIndex])
    const actionStr = chalk.bold.yellow(`${currentAction}:`)
    const targetStr = currentTargets.length > 0 
      ? chalk.cyan(currentTargets.slice(-2).join(', ')) 
      : chalk.gray('...')
    const pctStr = chalk.bold.cyan(`${pct}%`)
    const counterStr = chalk.gray(`(${completed}/${total})`)
    
    options.onProgress(`${spinner} ${actionStr} ${targetStr} — ${pctStr} ${counterStr}`)
  }

  const intervalId = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
    updateProgress()
  }, 80)

  // 📖 Step 3: Ping candidate models in parallel (15s timeout inside ping.js)
  const pingPromises = sortedCandidates.map(async (candidate) => {
    const { modelId, providerKey, sourceInfo, label } = candidate
    const apiKey = keys.get(providerKey) || null
    const url = sourceInfo.url
    const providerName = sourceInfo.name || providerKey
    const targetDesc = `${label} [${providerName}]`

    currentTargets.push(targetDesc)
    updateProgress()

    try {
      const res = await ping(apiKey, modelId, providerKey, url)
      
      // 📖 Map ping code to clean status string
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
        hasKey: true
      }
    } finally {
      completedPings++
      pct = Math.round((completedPings / totalPings) * 100)
      completed = completedPings
      currentTargets = currentTargets.filter(t => t !== targetDesc)
      updateProgress()
    }
  })

  const pingResults = await Promise.allSettled(pingPromises)
  const aliveModels = []

  for (const result of pingResults) {
    if (result.status === 'fulfilled') {
      aliveModels.push(result.value)
    }
  }

  // 📖 Filter to only models that responded successfully
  const usableAlive = aliveModels.filter(m => m.status === 'up')
  
  if (usableAlive.length === 0) {
    clearInterval(intervalId)
    return aliveModels // 📖 Return what we have (mostly timeouts/auth_errors)
  }

  // 📖 Step 4: Run AI Latency + TPS Benchmark on top 5 alive candidates
  const benchmarkCandidates = usableAlive
    .sort((a, b) => parseSweScore(b.sweScore) - parseSweScore(a.sweScore))
    .slice(0, 5)

  currentAction = 'Benchmarking'
  completed = 0
  pct = 0
  total = benchmarkCandidates.length
  currentTargets = []
  updateProgress()

  const totalBenchmarks = benchmarkCandidates.length
  let completedBenchmarks = 0

  const benchmarkPromises = benchmarkCandidates.map(async (model) => {
    const { modelId, providerKey, providerUrl, apiKey, label, providerName } = model
    const targetDesc = `${label} [${providerName}]`
    currentTargets.push(targetDesc)
    updateProgress()

    try {
      // 📖 Limit benchmark retries to 1 with a short delay for speed
      const res = await benchmarkModel({
        apiKey,
        modelId,
        providerKey,
        url: providerUrl,
        maxRetries: 1,
        retryDelayMs: 3000
      })

      if (res.ok) {
        return {
          modelId,
          tps: res.tokensPerSecond || null,
          totalMs: res.totalMs || null
        }
      }
    } catch (err) {
      // 📖 Catch benchmark errors gracefully
    } finally {
      completedBenchmarks++
      pct = Math.round((completedBenchmarks / totalBenchmarks) * 100)
      completed = completedBenchmarks
      currentTargets = currentTargets.filter(t => t !== targetDesc)
      updateProgress()
    }
    return { modelId, tps: null, totalMs: null }
  })

  const benchmarkResults = await Promise.allSettled(benchmarkPromises)
  clearInterval(intervalId)

  const benchMap = new Map()

  for (const res of benchmarkResults) {
    if (res.status === 'fulfilled') {
      benchMap.set(res.value.modelId, res.value)
    }
  }

  // 📖 Step 5: Merge benchmark stats back into the model objects
  const finalModels = aliveModels.map(model => {
    const bench = benchMap.get(model.modelId)
    if (bench) {
      return {
        ...model,
        tps: bench.tps,
        totalBenchMs: bench.totalMs
      }
    }
    return model
  })

  // 📖 Remove intermediate sourceInfo object so returning plain JSON is safe
  return finalModels.map(({ sourceInfo, ...rest }) => rest)
}
