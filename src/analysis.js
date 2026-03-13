/**
 * @file analysis.js
 * @description Analysis functions for model reliability scoring and dynamic model discovery.
 *
 * @details
 *   This module provides high-level analysis functions:
 *   - Fiable mode: 10-second reliability analysis to find the most stable model
 *   - Dynamic OpenRouter model discovery: Fetch free models from OpenRouter API
 *   - Tier filtering with validation
 *
 *   🎯 Key features:
 *   - Run 10-second reliability analysis across all models
 *   - Find best model based on uptime, avg latency, and stability
 *   - Fetch real-time OpenRouter free models (replaces static list)
 *   - Tier filtering validation with helpful error messages
 *
 *   → Functions:
 *   - `runFiableMode`: Analyze models for 10 seconds and output the most reliable one
 *   - `filterByTierOrExit`: Filter models by tier, exit with error if tier is invalid
 *   - `fetchOpenRouterFreeModels`: Fetch live free models from OpenRouter API
 *
 *   📦 Dependencies:
 *   - ../sources.js: MODELS, sources
 *   - ../src/utils.js: findBestModel, filterByTier, formatCtxWindow, labelFromId
 *   - ../src/config.js: isProviderEnabled, getApiKey
 *   - ../src/ping.js: ping
 *   - chalk: Terminal colors and formatting
 *   - ../src/constants.js: TIER_LETTER_MAP (for validation)
 *
 *   ⚙️ Configuration:
 *   - Analysis duration: 10 seconds (hardcoded in runFiableMode)
 *   - OpenRouter tier map: Known SWE-bench scores for popular models (fallback for unknown)
 *
 *   @see {@link ../src/utils.js} findBestModel implementation
 *   @see {@link ../src/ping.js} ping implementation
 */

import { MODELS, sources } from '../sources.js'
import { findBestModel, filterByTier, formatCtxWindow, labelFromId, TIER_LETTER_MAP } from '../src/utils.js'
import { isProviderEnabled, getApiKey } from '../src/config.js'
import { ping } from '../src/ping.js'
import { PROVIDER_COLOR } from './render-table.js'
import chalk from 'chalk'

// 📖 runFiableMode: Analyze models for reliability over 10 seconds, output the best one.
// 📖 Filters to enabled providers with keys, runs initial pings, then waits.
// 📖 Uses findBestModel() from utils.js to select based on uptime/avg/stability.
export async function runFiableMode(config) {
  console.log(chalk.cyan('  ⚡ Analyzing models for reliability (10 seconds)...'))
  console.log()

  // 📖 Only include models from enabled providers that have API keys
  let results = MODELS
    .filter(([,,,,,providerKey]) => {
      return isProviderEnabled(config, providerKey) && getApiKey(config, providerKey)
    })
    .map(([modelId, label, tier, sweScore, ctx, providerKey], i) => ({
      idx: i + 1, modelId, label, tier, sweScore, ctx, providerKey,
      status: 'pending',
      pings: [],
      httpCode: null,
    }))

  const startTime = Date.now()
  const analysisDuration = 10000 // 10 seconds

  // 📖 Run initial pings using per-provider API key and URL
  const pingPromises = results.map(r => {
    const rApiKey = getApiKey(config, r.providerKey)
    const url = sources[r.providerKey]?.url
    return ping(rApiKey, r.modelId, r.providerKey, url).then(({ code, ms }) => {
      r.pings.push({ ms, code })
      if (code === '200') {
        r.status = 'up'
      } else if (code === '000') {
        r.status = 'timeout'
      } else {
        r.status = 'down'
        r.httpCode = code
      }
    })
  })

  await Promise.allSettled(pingPromises)

  // 📖 Continue pinging for the remaining time
  const remainingTime = Math.max(0, analysisDuration - (Date.now() - startTime))
  if (remainingTime > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingTime))
  }

  // 📖 Find best model
  const best = findBestModel(results)

  if (!best) {
    console.log(chalk.red('  ✖ No reliable model found'))
    process.exit(1)
  }

  // 📖 Output in format: providerName/modelId
  const providerName = sources[best.providerKey]?.name ?? best.providerKey ?? 'nvidia'
  console.log(chalk.green(`  ✓ Most reliable model:`))
  // 📖 Color provider name the same way as in the main table
  const providerRgb = PROVIDER_COLOR[best.providerKey] ?? [105, 190, 245]
  const coloredProviderName = chalk.bold.rgb(...providerRgb)(providerName)
  console.log(`    ${coloredProviderName}/${best.modelId}`)
  console.log()
  console.log(chalk.dim(`  📊 Stats:`))
  const { getAvg, getUptime } = await import('./utils.js')
  console.log(chalk.dim(`    Avg ping: ${getAvg(best)}ms`))
  console.log(chalk.dim(`    Uptime: ${getUptime(best)}%`))
  console.log(chalk.dim(`    Status: ${best.status === 'up' ? '✅ UP' : '❌ DOWN'}`))

  process.exit(0)
}

// 📖 filterByTierOrExit: Filter models by tier letter (S/A/B/C).
// 📖 Wrapper around filterByTier() that exits with error message instead of returning null.
// 📖 This is used by CLI argument parsing to fail fast on invalid tier input.
export function filterByTierOrExit(results, tierLetter) {
  const filtered = filterByTier(results, tierLetter)
  if (filtered === null) {
    console.error(chalk.red(`  ✖ Unknown tier "${tierLetter}". Valid tiers: S, A, B, C`))
    process.exit(1)
  }
  return filtered
}

// ─── Dynamic OpenRouter free model discovery ──────────────────────────────────
// 📖 Fetches the live list of free models from OpenRouter's public API at startup.
// 📖 Replaces the static openrouter entries in MODELS with fresh data so new free
// 📖 models appear automatically without a code update.
// 📖 Falls back silently to the static list on network failure.

// 📖 Known SWE-bench scores for OpenRouter free models.
// 📖 Keyed by base model ID (without the :free suffix).
// 📖 Unknown models default to tier 'B' / '25.0%'.
const OPENROUTER_TIER_MAP = {
  'qwen/qwen3-coder':                         ['S+', '70.6%'],
  'mistralai/devstral-2':                      ['S+', '72.2%'],
  'stepfun/step-3.5-flash':                    ['S+', '74.4%'],
  'deepseek/deepseek-r1-0528':                 ['S',  '61.0%'],
  'qwen/qwen3-next-80b-a3b-instruct':          ['S',  '65.0%'],
  'openai/gpt-oss-120b':                       ['S',  '60.0%'],
  'openai/gpt-oss-20b':                        ['A',  '42.0%'],
  'nvidia/nemotron-3-nano-30b-a3b':            ['A',  '43.0%'],
  'meta-llama/llama-3.3-70b-instruct':         ['A-', '39.5%'],
  'mimo-v2-flash':                             ['A',  '45.0%'],
  'google/gemma-3-27b-it':                     ['A-', '36.0%'],
  'google/gemma-3-12b-it':                     ['B+', '30.0%'],
  'google/gemma-3-4b-it':                      ['B',  '22.0%'],
  'google/gemma-3n-e4b-it':                    ['B',  '22.0%'],
  'google/gemma-3n-e2b-it':                    ['B',  '18.0%'],
  'meta-llama/llama-3.2-3b-instruct':          ['B',  '20.0%'],
  'mistralai/mistral-small-3.1-24b-instruct':  ['A-', '35.0%'],
  'qwen/qwen3-4b':                             ['B',  '22.0%'],
  'nousresearch/hermes-3-llama-3.1-405b':      ['A',  '40.0%'],
  'nvidia/nemotron-nano-9b-v2':                ['B+', '28.0%'],
  'nvidia/nemotron-nano-12b-v2-vl':            ['B+', '30.0%'],
  'z-ai/glm-4.5-air':                          ['A-', '38.0%'],
  'arcee-ai/trinity-large-preview':             ['A',  '40.0%'],
  'arcee-ai/trinity-mini':                      ['B+', '28.0%'],
  'upstage/solar-pro-3':                       ['A-', '35.0%'],
  'cognitivecomputations/dolphin-mistral-24b-venice-edition': ['B+', '28.0%'],
  'liquid/lfm-2.5-1.2b-thinking':              ['B',  '18.0%'],
  'liquid/lfm-2.5-1.2b-instruct':              ['B',  '18.0%'],
}

// 📖 fetchOpenRouterFreeModels: Fetch live free models from OpenRouter API.
// 📖 Returns array of tuples [modelId, label, tier, sweScore, ctx] or null on failure.
// 📖 Formats context windows using formatCtxWindow and labels using labelFromId.
// 📖 Uses OPENROUTER_TIER_MAP for known models; others default to tier 'B'/'25.0%'.
export async function fetchOpenRouterFreeModels() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
      headers: {
        'HTTP-Referer': 'https://github.com/vava-nessa/free-coding-models',
        'X-Title': 'free-coding-models',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const json = await res.json()
    if (!json.data || !Array.isArray(json.data)) return null

    const freeModels = json.data.filter(m => m.id && m.id.endsWith(':free'))

    return freeModels.map(m => {
      const baseId = m.id.replace(/:free$/, '')
      const [tier, swe] = OPENROUTER_TIER_MAP[baseId] || ['B', '25.0%']
      const ctx = formatCtxWindow(m.context_length)
      const label = labelFromId(m.id)
      return [m.id, label, tier, swe, ctx]
    })
  } catch {
    return null
  }
}
