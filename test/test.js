/**
 * @file test/test.js
 * @description Unit tests for free-coding-models using Node.js built-in test runner.
 *
 * 📖 Run with: `node --test test/test.js` or `pnpm test`
 * 📖 Uses node:test + node:assert (zero dependencies, works on Node 18+)
 *
 * @functions
 *   → sources.js data integrity — validates model array structure, tiers, uniqueness
 *   → Core logic — getAvg, getVerdict, getUptime, filterByTier, sortResults, findBestModel
 *   → CLI arg parsing — parseArgs covers all flag combinations
 *   → Package & CLI sanity — package.json fields, bin entry, shebang, imports
 *   → Provider key test model discovery — protects settings key-check probes from stale provider catalogs
 *   → Provider key test outcome classification — distinguishes auth failure, rate limits, and no-callable-model cases
 *   → Provider key test diagnostics — explains probe failures in human-readable form
 *
 * @see lib/utils.js — the functions under test
 * @see sources.js — model data validated here
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// 📖 Import modules under test
import { nvidiaNim, sources, MODELS } from '../sources.js'
import {
  getAvg, getVerdict, getUptime, getP95, getJitter, getStabilityScore,
  sortResults, filterByTier, findBestModel, parseArgs,
  TIER_ORDER, VERDICT_ORDER, TIER_LETTER_MAP,
  scoreModelForTask, getTopRecommendations, TASK_TYPES, PRIORITY_TYPES, CONTEXT_BUDGETS,
  formatCtxWindow, labelFromId
} from '../src/utils.js'
import {
  _emptyProfileSettings, saveAsProfile, loadProfile, listProfiles,
  deleteProfile, getActiveProfileName, setActiveProfile, getProxySettings, normalizeProxySettings, normalizeEndpointInstalls, getApiKey
} from '../src/config.js'
import { buildProviderModelTokenKey, loadTokenUsageByProviderModel, formatTokenTotalCompact } from '../src/token-usage-reader.js'
import { renderTable } from '../src/render-table.js'
import { createOverlayRenderers } from '../src/overlays.js'
import { buildProviderModelsUrl, parseProviderModelIds, listProviderTestModels, classifyProviderTestOutcome, buildProviderTestDetail } from '../src/key-handler.js'
import { buildMergedModels } from '../src/model-merger.js'
import { setOpenCodeModelData } from '../src/opencode.js'
import { resolveLauncherModelId } from '../src/tool-launchers.js'
import { parseLogLine } from '../src/log-reader.js'
import { getConfiguredInstallableProviders, installProviderEndpoints } from '../src/endpoint-installer.js'

// ─── Helper: create a mock model result ──────────────────────────────────────
// 📖 Builds a minimal result object matching the shape used by the main script
function mockResult(overrides = {}) {
  return {
    idx: 1,
    modelId: 'test/model',
    label: 'Test Model',
    tier: 'S',
    sweScore: '50.0%',
    ctx: '128k',
    status: 'up',
    pings: [],
    httpCode: null,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 1. SOURCES.JS DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════════
describe('sources.js data integrity', () => {
  const VALID_TIERS = ['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']

  it('nvidiaNim is a non-empty array', () => {
    assert.ok(Array.isArray(nvidiaNim))
    assert.ok(nvidiaNim.length > 0, 'nvidiaNim should have models')
  })

  it('every model entry has [modelId, label, tier, sweScore, ctx] structure', () => {
    for (const entry of nvidiaNim) {
      assert.ok(Array.isArray(entry), `Entry should be an array: ${JSON.stringify(entry)}`)
      assert.equal(entry.length, 5, `Entry should have 5 elements: ${JSON.stringify(entry)}`)
      assert.equal(typeof entry[0], 'string', `modelId should be string: ${entry[0]}`)
      assert.equal(typeof entry[1], 'string', `label should be string: ${entry[1]}`)
      assert.equal(typeof entry[2], 'string', `tier should be string: ${entry[2]}`)
      assert.equal(typeof entry[3], 'string', `sweScore should be string: ${entry[3]}`)
      assert.equal(typeof entry[4], 'string', `ctx should be string: ${entry[4]}`)
    }
  })

  it('all tiers are valid', () => {
    for (const [modelId, , tier] of nvidiaNim) {
      assert.ok(VALID_TIERS.includes(tier), `Invalid tier "${tier}" for model "${modelId}"`)
    }
  })

  it('no duplicate model IDs', () => {
    const ids = nvidiaNim.map(m => m[0])
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    assert.deepEqual(dupes, [], `Duplicate model IDs found: ${dupes.join(', ')}`)
  })

  it('MODELS flat array matches sources count', () => {
    let totalFromSources = 0
    for (const s of Object.values(sources)) {
      totalFromSources += s.models.length
    }
    assert.equal(MODELS.length, totalFromSources, 'MODELS length should match sum of all source models')
  })

  it('sources object has nvidia key with correct structure', () => {
    assert.ok(sources.nvidia, 'sources.nvidia should exist')
    assert.equal(sources.nvidia.name, 'NIM')
    assert.ok(Array.isArray(sources.nvidia.models))
    assert.equal(sources.nvidia.models, nvidiaNim)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 2. CORE LOGIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
describe('getAvg', () => {
  it('returns Infinity when no pings', () => {
    assert.equal(getAvg(mockResult({ pings: [] })), Infinity)
  })

  it('returns Infinity when no successful pings', () => {
    assert.equal(getAvg(mockResult({ pings: [{ ms: 500, code: '500' }] })), Infinity)
  })

  it('calculates average from successful pings only', () => {
    const r = mockResult({
      pings: [
        { ms: 200, code: '200' },
        { ms: 400, code: '200' },
        { ms: 999, code: '500' }, // 📖 should be ignored
      ]
    })
    assert.equal(getAvg(r), 300)
  })

  it('includes 401 pings because no-key responses still measure real latency', () => {
    const r = mockResult({
      pings: [
        { ms: 200, code: '200' },
        { ms: 400, code: '401' },
        { ms: 999, code: '500' },
      ]
    })
    assert.equal(getAvg(r), 300)
  })

  it('rounds to integer', () => {
    const r = mockResult({
      pings: [{ ms: 333, code: '200' }, { ms: 334, code: '200' }]
    })
    assert.equal(getAvg(r), 334) // 📖 (333+334)/2 = 333.5 → 334
  })
})

describe('getVerdict', () => {
  it('returns Overloaded for 429 status', () => {
    assert.equal(getVerdict(mockResult({ httpCode: '429', pings: [{ ms: 100, code: '429' }] })), 'Overloaded')
  })

  it('returns Perfect for fast avg (<400ms)', () => {
    assert.equal(getVerdict(mockResult({ pings: [{ ms: 200, code: '200' }] })), 'Perfect')
  })

  it('returns Normal for avg 400-999ms', () => {
    assert.equal(getVerdict(mockResult({ pings: [{ ms: 500, code: '200' }] })), 'Normal')
  })

  it('returns Slow for avg 1000-2999ms', () => {
    assert.equal(getVerdict(mockResult({ pings: [{ ms: 2000, code: '200' }] })), 'Slow')
  })

  it('returns Very Slow for avg 3000-4999ms', () => {
    assert.equal(getVerdict(mockResult({ pings: [{ ms: 4000, code: '200' }] })), 'Very Slow')
  })

  it('returns Unstable for timeout with prior success', () => {
    assert.equal(getVerdict(mockResult({
      status: 'timeout',
      pings: [{ ms: 200, code: '200' }, { ms: 0, code: '000' }]
    })), 'Unstable')
  })

  it('returns Not Active for timeout without prior success', () => {
    assert.equal(getVerdict(mockResult({ status: 'timeout', pings: [{ ms: 0, code: '000' }] })), 'Not Active')
  })

  it('returns Pending when no successful pings and status is up', () => {
    assert.equal(getVerdict(mockResult({ status: 'up', pings: [] })), 'Pending')
  })

  it('uses 401-only latency samples for noauth verdicts', () => {
    assert.equal(getVerdict(mockResult({
      status: 'noauth',
      httpCode: '401',
      pings: [{ ms: 350, code: '401' }]
    })), 'Perfect')
  })
})

describe('getUptime', () => {
  it('returns 0 when no pings', () => {
    assert.equal(getUptime(mockResult({ pings: [] })), 0)
  })

  it('returns 100 when all pings succeed', () => {
    assert.equal(getUptime(mockResult({
      pings: [{ ms: 100, code: '200' }, { ms: 200, code: '200' }]
    })), 100)
  })

  it('returns 50 when half succeed', () => {
    assert.equal(getUptime(mockResult({
      pings: [{ ms: 100, code: '200' }, { ms: 0, code: '500' }]
    })), 50)
  })

  it('returns 0 when none succeed', () => {
    assert.equal(getUptime(mockResult({
      pings: [{ ms: 0, code: '500' }, { ms: 0, code: '429' }]
    })), 0)
  })
})

describe('provider key test model discovery', () => {
  it('derives /models from a chat completions url', () => {
    assert.equal(
      buildProviderModelsUrl('https://api.sambanova.ai/v1/chat/completions'),
      'https://api.sambanova.ai/v1/models'
    )
  })

  it('returns null when the provider url is not chat/completions', () => {
    assert.equal(buildProviderModelsUrl('https://api.replicate.com/v1/predictions'), null)
  })

  it('parses model ids from an OpenAI-style /models payload', () => {
    assert.deepEqual(
      parseProviderModelIds({
        data: [
          { id: 'DeepSeek-V3-0324' },
          { id: 'Meta-Llama-3.1-8B-Instruct' },
          { nope: true },
        ],
      }),
      ['DeepSeek-V3-0324', 'Meta-Llama-3.1-8B-Instruct']
    )
  })

  it('prioritizes the SambaNova override ahead of discovered and static ids', () => {
    assert.deepEqual(
      listProviderTestModels('sambanova', sources.sambanova, ['Qwen3-235B', 'DeepSeek-V3-0324']).slice(0, 4),
      ['DeepSeek-V3-0324', 'Qwen3-235B', 'MiniMax-M2.5', 'DeepSeek-R1-0528']
    )
  })

  it('uses discovered repo-known ids before the static catalog head for NVIDIA', () => {
    assert.deepEqual(
      listProviderTestModels('nvidia', sources.nvidia, ['openai/gpt-oss-120b', 'deepseek-ai/deepseek-v3.2']).slice(0, 5),
      [
        'deepseek-ai/deepseek-v3.1-terminus',
        'openai/gpt-oss-120b',
        'deepseek-ai/deepseek-v3.2',
        'moonshotai/kimi-k2.5',
        'z-ai/glm5',
      ]
    )
  })

  it('falls back to static models when no discovery data exists', () => {
    assert.equal(
      listProviderTestModels('groq', sources.groq)[0],
      'llama-3.3-70b-versatile'
    )
  })
})

describe('classifyProviderTestOutcome', () => {
  it('returns ok when any probe succeeds', () => {
    assert.equal(classifyProviderTestOutcome(['404', '200']), 'ok')
  })

  it('returns fail on auth errors', () => {
    assert.equal(classifyProviderTestOutcome(['403']), 'auth_error')
  })

  it('returns rate_limited when all attempted probes are throttled', () => {
    assert.equal(classifyProviderTestOutcome(['429', '429']), 'rate_limited')
  })

  it('returns no_callable_model when every attempted model is missing', () => {
    assert.equal(classifyProviderTestOutcome(['404', '410', '404']), 'no_callable_model')
  })

  it('falls back to fail for mixed non-auth transport or server errors', () => {
    assert.equal(classifyProviderTestOutcome(['404', '500', 'ERR']), 'fail')
  })
})

describe('buildProviderTestDetail', () => {
  it('mentions auth rejection and attempt history', () => {
    const detail = buildProviderTestDetail('Groq', 'auth_error', [
      { attempt: 1, model: 'llama-3.3-70b-versatile', code: '401' },
    ], 'Live model discovery returned HTTP 401; falling back to the repo catalog.')

    assert.match(detail, /Groq rejected the configured key/i)
    assert.match(detail, /invalid, expired, revoked, or truncated/i)
    assert.match(detail, /#1 llama-3\.3-70b-versatile -> 401/)
  })

  it('explains rate limiting separately from auth failure', () => {
    const detail = buildProviderTestDetail('OpenRouter', 'rate_limited', [
      { attempt: 1, model: 'qwen/qwen3-coder:free', code: '429' },
      { attempt: 2, model: 'openai/gpt-oss-120b:free', code: '429' },
    ])

    assert.match(detail, /throttled every probe/i)
    assert.match(detail, /quota window/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 2b. STABILITY FUNCTIONS (p95, jitter, stability score)
// ═══════════════════════════════════════════════════════════════════════════════
describe('getP95', () => {
  it('returns Infinity when no pings', () => {
    assert.equal(getP95(mockResult({ pings: [] })), Infinity)
  })

  it('returns Infinity when no successful pings', () => {
    assert.equal(getP95(mockResult({ pings: [{ ms: 500, code: '500' }] })), Infinity)
  })

  it('returns the single value when one ping', () => {
    assert.equal(getP95(mockResult({ pings: [{ ms: 300, code: '200' }] })), 300)
  })

  it('returns the highest value for small sets', () => {
    // With 5 pings: ceil(5 * 0.95) - 1 = 4 → last element
    const r = mockResult({
      pings: [
        { ms: 100, code: '200' }, { ms: 200, code: '200' },
        { ms: 300, code: '200' }, { ms: 400, code: '200' },
        { ms: 5000, code: '200' },
      ]
    })
    assert.equal(getP95(r), 5000)
  })

  it('ignores non-200 pings', () => {
    const r = mockResult({
      pings: [
        { ms: 100, code: '200' }, { ms: 200, code: '200' },
        { ms: 99999, code: '500' }, // should be ignored
      ]
    })
    assert.equal(getP95(r), 200)
  })

  it('includes 401 pings in percentile calculations', () => {
    const r = mockResult({
      pings: [
        { ms: 100, code: '401' },
        { ms: 200, code: '200' },
        { ms: 99999, code: '500' },
      ]
    })
    assert.equal(getP95(r), 200)
  })

  it('catches tail latency spikes with 20 pings', () => {
    // With 20 pings: p95 index = ceil(20 * 0.95) - 1 = 18
    // Need at least 2 high values so index 18 hits the spike
    const pings = Array.from({ length: 18 }, () => ({ ms: 200, code: '200' }))
    pings.push({ ms: 5000, code: '200' })
    pings.push({ ms: 5000, code: '200' })
    const r = mockResult({ pings })
    assert.equal(getP95(r), 5000)
  })
})

describe('getJitter', () => {
  it('returns 0 when no pings', () => {
    assert.equal(getJitter(mockResult({ pings: [] })), 0)
  })

  it('returns 0 when only one ping', () => {
    assert.equal(getJitter(mockResult({ pings: [{ ms: 500, code: '200' }] })), 0)
  })

  it('returns 0 when all pings are identical', () => {
    const r = mockResult({
      pings: [{ ms: 300, code: '200' }, { ms: 300, code: '200' }, { ms: 300, code: '200' }]
    })
    assert.equal(getJitter(r), 0)
  })

  it('calculates correct jitter for known values', () => {
    // pings: 100, 300 → mean = 200, variance = ((100-200)^2 + (300-200)^2)/2 = 10000, σ = 100
    const r = mockResult({
      pings: [{ ms: 100, code: '200' }, { ms: 300, code: '200' }]
    })
    assert.equal(getJitter(r), 100)
  })

  it('ignores non-200 pings', () => {
    const r = mockResult({
      pings: [
        { ms: 300, code: '200' }, { ms: 300, code: '200' },
        { ms: 99999, code: '500' }, // should be ignored
      ]
    })
    assert.equal(getJitter(r), 0)
  })

  it('includes 401 pings in jitter calculations', () => {
    const r = mockResult({
      pings: [
        { ms: 100, code: '401' },
        { ms: 300, code: '200' },
        { ms: 99999, code: '500' },
      ]
    })
    assert.equal(getJitter(r), 100)
  })

  it('returns high jitter for spiky latencies', () => {
    const r = mockResult({
      pings: [
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 5000, code: '200' },
      ]
    })
    // mean = 1325, large std dev
    const jitter = getJitter(r)
    assert.ok(jitter > 1000, `Expected high jitter, got ${jitter}`)
  })
})

describe('getStabilityScore', () => {
  it('returns -1 when no successful pings', () => {
    assert.equal(getStabilityScore(mockResult({ pings: [] })), -1)
    assert.equal(getStabilityScore(mockResult({ pings: [{ ms: 0, code: '500' }] })), -1)
  })

  it('returns high score for consistent fast model', () => {
    const r = mockResult({
      pings: [
        { ms: 200, code: '200' }, { ms: 210, code: '200' },
        { ms: 190, code: '200' }, { ms: 205, code: '200' },
        { ms: 195, code: '200' },
      ]
    })
    const score = getStabilityScore(r)
    assert.ok(score >= 80, `Expected high stability score, got ${score}`)
  })

  it('computes a stability score from 401 latency samples too', () => {
    const score = getStabilityScore(mockResult({
      status: 'noauth',
      pings: [
        { ms: 200, code: '401' },
        { ms: 220, code: '401' },
        { ms: 210, code: '401' },
      ]
    }))
    assert.ok(score >= 0 && score <= 100, `Score should be 0-100, got ${score}`)
  })

  it('returns low score for spiky model', () => {
    const r = mockResult({
      pings: [
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 8000, code: '200' },
        { ms: 100, code: '200' }, { ms: 7000, code: '200' },
      ]
    })
    const score = getStabilityScore(r)
    assert.ok(score < 60, `Expected low stability score for spiky model, got ${score}`)
  })

  it('penalizes low uptime', () => {
    const good = mockResult({
      pings: [
        { ms: 200, code: '200' }, { ms: 200, code: '200' },
        { ms: 200, code: '200' }, { ms: 200, code: '200' },
      ]
    })
    const flaky = mockResult({
      pings: [
        { ms: 200, code: '200' }, { ms: 0, code: '500' },
        { ms: 0, code: '500' }, { ms: 0, code: '500' },
      ]
    })
    assert.ok(getStabilityScore(good) > getStabilityScore(flaky))
  })

  it('Model B (consistent 400ms) scores higher than Model A (avg 250ms, spiky p95)', () => {
    // The motivating example from the issue
    const modelA = mockResult({
      pings: [
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 6000, code: '200' }, // p95 spike!
      ]
    })
    const modelB = mockResult({
      pings: [
        { ms: 400, code: '200' }, { ms: 380, code: '200' },
        { ms: 420, code: '200' }, { ms: 410, code: '200' },
        { ms: 390, code: '200' }, { ms: 400, code: '200' },
        { ms: 395, code: '200' }, { ms: 405, code: '200' },
        { ms: 400, code: '200' }, { ms: 400, code: '200' },
      ]
    })
    assert.ok(
      getStabilityScore(modelB) > getStabilityScore(modelA),
      `Model B (consistent) should score higher than Model A (spiky)`
    )
  })

  it('score is between 0 and 100 for valid data', () => {
    const r = mockResult({
      pings: [{ ms: 500, code: '200' }, { ms: 1000, code: '200' }]
    })
    const score = getStabilityScore(r)
    assert.ok(score >= 0 && score <= 100, `Score should be 0-100, got ${score}`)
  })
})

describe('getVerdict stability-aware', () => {
  it('returns Spiky for normal avg but terrible p95 (≥3 pings)', () => {
    // 18 pings at 200ms + 2 at 8000ms
    // avg = (18*200 + 2*8000)/20 = (3600+16000)/20 = 980ms → Normal range
    // p95 index = ceil(20*0.95)-1 = 18, sorted[18] = 8000 → p95 > 5000 → Spiky
    const pings = Array.from({ length: 18 }, () => ({ ms: 200, code: '200' }))
    pings.push({ ms: 8000, code: '200' })
    pings.push({ ms: 8000, code: '200' })
    const r = mockResult({ pings })
    assert.equal(getVerdict(r), 'Spiky')
  })

  it('still returns Perfect for fast avg when p95 is fine', () => {
    const r = mockResult({
      pings: [
        { ms: 200, code: '200' }, { ms: 210, code: '200' },
        { ms: 190, code: '200' }, { ms: 205, code: '200' },
      ]
    })
    assert.equal(getVerdict(r), 'Perfect')
  })

  it('does not flag Spiky with only 1-2 pings (not enough data)', () => {
    const r = mockResult({
      pings: [{ ms: 100, code: '200' }, { ms: 5000, code: '200' }]
    })
    // avg = 2550 which is > 1000 but < 3000, so verdict is Slow (not Spiky)
    // The avg pushes it out of the "fast" range entirely
    const verdict = getVerdict(r)
    assert.ok(verdict !== 'Spiky', `Should not be Spiky with 2 pings, got ${verdict}`)
  })

  it('Spiky is in VERDICT_ORDER', () => {
    assert.ok(VERDICT_ORDER.includes('Spiky'), 'VERDICT_ORDER should include Spiky')
  })
})

describe('filterByTier', () => {
  const results = [
    mockResult({ tier: 'S+', label: 'A' }),
    mockResult({ tier: 'S', label: 'B' }),
    mockResult({ tier: 'A+', label: 'C' }),
    mockResult({ tier: 'A', label: 'D' }),
    mockResult({ tier: 'A-', label: 'E' }),
    mockResult({ tier: 'B+', label: 'F' }),
    mockResult({ tier: 'B', label: 'G' }),
    mockResult({ tier: 'C', label: 'H' }),
  ]

  it('filters S tier (S+ and S)', () => {
    const filtered = filterByTier(results, 'S')
    assert.equal(filtered.length, 2)
    assert.ok(filtered.every(r => ['S+', 'S'].includes(r.tier)))
  })

  it('filters A tier (A+, A, A-)', () => {
    const filtered = filterByTier(results, 'A')
    assert.equal(filtered.length, 3)
  })

  it('filters B tier (B+, B)', () => {
    const filtered = filterByTier(results, 'B')
    assert.equal(filtered.length, 2)
  })

  it('filters C tier (C only)', () => {
    const filtered = filterByTier(results, 'C')
    assert.equal(filtered.length, 1)
  })

  it('is case-insensitive', () => {
    const filtered = filterByTier(results, 's')
    assert.equal(filtered.length, 2)
  })

  it('returns null for invalid tier', () => {
    assert.equal(filterByTier(results, 'X'), null)
  })
})

describe('sortResults', () => {
  it('sorts by avg ascending', () => {
    const results = [
      mockResult({ label: 'Slow', pings: [{ ms: 500, code: '200' }] }),
      mockResult({ label: 'Fast', pings: [{ ms: 100, code: '200' }] }),
    ]
    const sorted = sortResults(results, 'avg', 'asc')
    assert.equal(sorted[0].label, 'Fast')
    assert.equal(sorted[1].label, 'Slow')
  })

  it('sorts by avg descending', () => {
    const results = [
      mockResult({ label: 'Fast', pings: [{ ms: 100, code: '200' }] }),
      mockResult({ label: 'Slow', pings: [{ ms: 500, code: '200' }] }),
    ]
    const sorted = sortResults(results, 'avg', 'desc')
    assert.equal(sorted[0].label, 'Slow')
  })

  it('sorts by tier', () => {
    const results = [
      mockResult({ tier: 'C', label: 'C' }),
      mockResult({ tier: 'S+', label: 'S+' }),
    ]
    const sorted = sortResults(results, 'tier', 'asc')
    assert.equal(sorted[0].tier, 'S+')
  })

  it('sorts by model name', () => {
    const results = [
      mockResult({ label: 'Zeta' }),
      mockResult({ label: 'Alpha' }),
    ]
    const sorted = sortResults(results, 'model', 'asc')
    assert.equal(sorted[0].label, 'Alpha')
  })

  it('sorts by ctx (context window) ascending', () => {
    const results = [
      mockResult({ label: 'Small', ctx: '8k' }),
      mockResult({ label: 'Large', ctx: '128k' }),
      mockResult({ label: 'Medium', ctx: '32k' }),
    ]
    const sorted = sortResults(results, 'ctx', 'asc')
    assert.equal(sorted[0].label, 'Small')
    assert.equal(sorted[1].label, 'Medium')
    assert.equal(sorted[2].label, 'Large')
  })

  it('sorts by ctx with million tokens', () => {
    const results = [
      mockResult({ label: 'K', ctx: '128k' }),
      mockResult({ label: 'M', ctx: '1m' }),
    ]
    const sorted = sortResults(results, 'ctx', 'asc')
    assert.equal(sorted[0].label, 'K')
    assert.equal(sorted[1].label, 'M')
  })

  it('does not mutate original array', () => {
    const results = [
      mockResult({ label: 'B', pings: [{ ms: 500, code: '200' }] }),
      mockResult({ label: 'A', pings: [{ ms: 100, code: '200' }] }),
    ]
    const original = [...results]
    sortResults(results, 'avg', 'asc')
    assert.equal(results[0].label, original[0].label)
  })

  it('sorts by stability descending (most stable first)', () => {
    const stable = mockResult({
      label: 'Stable',
      pings: [
        { ms: 200, code: '200' }, { ms: 210, code: '200' },
        { ms: 190, code: '200' }, { ms: 205, code: '200' },
      ]
    })
    const spiky = mockResult({
      label: 'Spiky',
      pings: [
        { ms: 100, code: '200' }, { ms: 100, code: '200' },
        { ms: 100, code: '200' }, { ms: 8000, code: '200' },
      ]
    })
    const sorted = sortResults([spiky, stable], 'stability', 'desc')
    assert.equal(sorted[0].label, 'Stable')
  })

  it('sorts by usage ascending (low usagePercent first)', () => {
    const results = [
      mockResult({ label: 'HighUsage', usagePercent: 80 }),
      mockResult({ label: 'LowUsage',  usagePercent: 20 }),
      mockResult({ label: 'MedUsage',  usagePercent: 50 }),
    ]
    const sorted = sortResults(results, 'usage', 'asc')
    assert.equal(sorted[0].label, 'LowUsage')
    assert.equal(sorted[1].label, 'MedUsage')
    assert.equal(sorted[2].label, 'HighUsage')
  })

  it('sorts by usage descending (high usagePercent first)', () => {
    const results = [
      mockResult({ label: 'LowUsage',  usagePercent: 20 }),
      mockResult({ label: 'HighUsage', usagePercent: 80 }),
    ]
    const sorted = sortResults(results, 'usage', 'desc')
    assert.equal(sorted[0].label, 'HighUsage')
    assert.equal(sorted[1].label, 'LowUsage')
  })

  it('treats missing usagePercent as 0 when sorting by usage ascending', () => {
    const results = [
      mockResult({ label: 'HasUsage', usagePercent: 50 }),
      mockResult({ label: 'NoUsage' }),  // no usagePercent field → treated as 0
    ]
    const sorted = sortResults(results, 'usage', 'asc')
    assert.equal(sorted[0].label, 'NoUsage')
    assert.equal(sorted[1].label, 'HasUsage')
  })
})

describe('renderTable health labels', () => {
  it('renders explicit labels for common HTTP failure codes', () => {
    const results = [
      mockResult({ label: '429 model', status: 'down', httpCode: '429', pings: [{ ms: 0, code: '429' }], providerKey: 'nvidia', totalTokens: 0 }),
      mockResult({ label: '410 model', status: 'down', httpCode: '410', pings: [{ ms: 0, code: '410' }], providerKey: 'nvidia', totalTokens: 0 }),
      mockResult({ label: '404 model', status: 'down', httpCode: '404', pings: [{ ms: 0, code: '404' }], providerKey: 'nvidia', totalTokens: 0 }),
      mockResult({ label: '500 model', status: 'down', httpCode: '500', pings: [{ ms: 0, code: '500' }], providerKey: 'nvidia', totalTokens: 0 }),
    ]
    const output = renderTable(results, 0, 0)

    assert.match(output, /429 TRY LATER/)
    assert.match(output, /410 GONE/)
    assert.match(output, /404 NOT FOUND/)
    assert.match(output, /500 ERROR/)
  })

  it('renders auth failure distinctly from missing key', () => {
    const results = [
      mockResult({ label: 'Auth fail', status: 'auth_error', httpCode: '401', pings: [{ ms: 25, code: '401' }], providerKey: 'groq', totalTokens: 0 }),
      mockResult({ label: 'No key', status: 'noauth', httpCode: '401', pings: [{ ms: 25, code: '401' }], providerKey: 'groq', totalTokens: 0 }),
    ]
    const output = renderTable(results, 0, 0)

    assert.match(output, /AUTH FAIL/)
    assert.match(output, /NO KEY/)
  })
})

describe('renderSettings provider test badges', () => {
  function buildSettingsRenderer(config) {
    const state = {
      settingsOpen: true,
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
      settingsProxyPortEditMode: false,
      settingsProxyPortBuffer: '',
      settingsScrollOffset: 0,
      settingsSyncStatus: null,
      activeProfile: null,
      terminalRows: 40,
      config,
    }

    return createOverlayRenderers(state, {
      chalk,
      sources: { groq: sources.groq },
      PROVIDER_METADATA: {
        groq: {
          label: 'Groq',
          rateLimits: 'Free dev tier',
          signupUrl: 'https://console.groq.com/keys',
          signupHint: 'API Keys → Create API Key',
        },
      },
      LOCAL_VERSION: '0.2.1',
      getApiKey,
      getProxySettings,
      resolveApiKeys: (cfg, providerKey) => {
        const raw = cfg.apiKeys?.[providerKey]
        if (Array.isArray(raw)) return raw
        return typeof raw === 'string' && raw ? [raw] : []
      },
      isProviderEnabled: () => true,
      listProfiles: () => [],
      TIER_CYCLE: ['All'],
      SETTINGS_OVERLAY_BG: null,
      HELP_OVERLAY_BG: null,
      RECOMMEND_OVERLAY_BG: null,
      LOG_OVERLAY_BG: null,
      OVERLAY_PANEL_WIDTH: 120,
      keepOverlayTargetVisible: (currentOffset) => currentOffset,
      sliceOverlayLines: (lines, offset = 0) => ({ visible: lines, offset }),
      tintOverlayLines: (lines) => lines,
      loadRecentLogs: () => [],
      TASK_TYPES: [],
      PRIORITY_TYPES: [],
      CONTEXT_BUDGETS: [],
      FRAMES: ['-'],
      TIER_COLOR: () => '',
      getAvg: () => 0,
      getStabilityScore: () => 0,
      toFavoriteKey: () => '',
      getTopRecommendations: () => [],
      adjustScrollOffset: () => {},
      getPingModel: () => null,
      getConfiguredInstallableProviders: () => [],
      getInstallTargetModes: () => [],
      getProviderCatalogModels: () => [],
    }).renderSettings
  }

  it('shows Test when a provider has a saved key but no test ran yet', () => {
    const renderSettings = buildSettingsRenderer({ apiKeys: { groq: 'gsk_live_key' }, providers: {}, settings: {} })
    const output = renderSettings()

    assert.match(output, /\[Test\]/)
  })

  it('shows Missing Key when a provider has no saved key', () => {
    const renderSettings = buildSettingsRenderer({ apiKeys: {}, providers: {}, settings: {} })
    const output = renderSettings()

    assert.match(output, /\[Missing Key 🔑\]/)
  })
})

describe('findBestModel', () => {
  it('returns null for empty array', () => {
    assert.equal(findBestModel([]), null)
  })

  it('prefers model that is up', () => {
    const results = [
      mockResult({ label: 'Down', status: 'down', pings: [{ ms: 50, code: '200' }] }),
      mockResult({ label: 'Up', status: 'up', pings: [{ ms: 500, code: '200' }] }),
    ]
    assert.equal(findBestModel(results).label, 'Up')
  })

  it('prefers fastest avg when both up', () => {
    const results = [
      mockResult({ label: 'Slow', status: 'up', pings: [{ ms: 500, code: '200' }] }),
      mockResult({ label: 'Fast', status: 'up', pings: [{ ms: 100, code: '200' }] }),
    ]
    assert.equal(findBestModel(results).label, 'Fast')
  })

  it('prefers higher uptime when avg is equal', () => {
    const results = [
      mockResult({ label: 'Flaky', status: 'up', pings: [{ ms: 300, code: '200' }, { ms: 0, code: '500' }] }),
      mockResult({ label: 'Stable', status: 'up', pings: [{ ms: 300, code: '200' }, { ms: 300, code: '200' }] }),
    ]
    assert.equal(findBestModel(results).label, 'Stable')
  })

  it('prefers more stable model when avg is equal', () => {
    // Both have same avg (300ms) but different stability
    const results = [
      mockResult({
        label: 'Spiky',
        status: 'up',
        pings: [
          { ms: 100, code: '200' }, { ms: 100, code: '200' },
          { ms: 100, code: '200' }, { ms: 900, code: '200' },
        ]
      }),
      mockResult({
        label: 'Consistent',
        status: 'up',
        pings: [
          { ms: 300, code: '200' }, { ms: 300, code: '200' },
          { ms: 300, code: '200' }, { ms: 300, code: '200' },
        ]
      }),
    ]
    assert.equal(findBestModel(results).label, 'Consistent')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 3. CLI ARG PARSING
// ═══════════════════════════════════════════════════════════════════════════════
describe('parseArgs', () => {
  // 📖 parseArgs expects argv starting from index 0 (like process.argv)
  // 📖 so we prepend ['node', 'script'] to simulate real argv
  const argv = (...args) => ['node', 'script', ...args]

  it('extracts API key from first non-flag arg', () => {
    const result = parseArgs(argv('nvapi-xxx'))
    assert.equal(result.apiKey, 'nvapi-xxx')
  })

  it('returns null apiKey when none given', () => {
    const result = parseArgs(argv('--best'))
    assert.equal(result.apiKey, null)
  })

  it('detects --best flag', () => {
    assert.equal(parseArgs(argv('--best')).bestMode, true)
    assert.equal(parseArgs(argv()).bestMode, false)
  })

  it('detects --fiable flag', () => {
    assert.equal(parseArgs(argv('--fiable')).fiableMode, true)
  })

  it('detects --opencode flag', () => {
    assert.equal(parseArgs(argv('--opencode')).openCodeMode, true)
  })

  it('detects --openclaw flag', () => {
    assert.equal(parseArgs(argv('--openclaw')).openClawMode, true)
  })

  it('detects --opencode-desktop flag', () => {
    assert.equal(parseArgs(argv('--opencode-desktop')).openCodeDesktopMode, true)
    assert.equal(parseArgs(argv()).openCodeDesktopMode, false)
  })

  it('detects external tool flags', () => {
    const result = parseArgs(argv(
      '--aider',
      '--crush',
      '--goose',
      '--claude-code',
      '--codex',
      '--gemini',
      '--qwen',
      '--openhands',
      '--amp',
      '--pi'
    ))
    assert.equal(result.aiderMode, true)
    assert.equal(result.crushMode, true)
    assert.equal(result.gooseMode, true)
    assert.equal(result.claudeCodeMode, true)
    assert.equal(result.codexMode, true)
    assert.equal(result.geminiMode, true)
    assert.equal(result.qwenMode, true)
    assert.equal(result.openHandsMode, true)
    assert.equal(result.ampMode, true)
    assert.equal(result.piMode, true)
  })

  it('detects --no-telemetry flag', () => {
    assert.equal(parseArgs(argv('--no-telemetry')).noTelemetry, true)
    assert.equal(parseArgs(argv()).noTelemetry, false)
  })

  it('parses --tier value', () => {
    assert.equal(parseArgs(argv('--tier', 'S')).tierFilter, 'S')
    assert.equal(parseArgs(argv('--tier', 'a')).tierFilter, 'A') // 📖 uppercased
  })

  it('returns null tierFilter when --tier has no value', () => {
    assert.equal(parseArgs(argv('--tier')).tierFilter, null)
    assert.equal(parseArgs(argv('--tier', '--best')).tierFilter, null) // 📖 next arg is a flag
  })

  it('does not capture --tier value as apiKey', () => {
    assert.equal(parseArgs(argv('--tier', 'S')).apiKey, null)
    assert.equal(parseArgs(argv('--opencode', '--tier', 'A')).apiKey, null)
  })

  it('handles multiple flags together', () => {
    const result = parseArgs(argv('nvapi-key', '--opencode', '--best', '--tier', 'S'))
    assert.equal(result.apiKey, 'nvapi-key')
    assert.equal(result.openCodeMode, true)
    assert.equal(result.bestMode, true)
    assert.equal(result.tierFilter, 'S')
  })

  it('flags are case-insensitive', () => {
    assert.equal(parseArgs(argv('--BEST')).bestMode, true)
    assert.equal(parseArgs(argv('--OpenCode')).openCodeMode, true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 4. PACKAGE & CLI SANITY
// ═══════════════════════════════════════════════════════════════════════════════
describe('package.json sanity', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

  it('has required fields', () => {
    assert.ok(pkg.name, 'name is required')
    assert.ok(pkg.version, 'version is required')
    assert.ok(pkg.main, 'main is required')
    assert.ok(pkg.bin, 'bin is required')
    assert.ok(pkg.license, 'license is required')
  })

  it('version matches semver pattern', () => {
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  })

  it('bin entry points to existing file', () => {
    const binPath = join(ROOT, pkg.bin['free-coding-models'])
    assert.ok(existsSync(binPath), `bin entry ${pkg.bin['free-coding-models']} should exist`)
  })

  it('main entry points to existing file', () => {
    const mainPath = join(ROOT, pkg.main)
    assert.ok(existsSync(mainPath), `main entry ${pkg.main} should exist`)
  })

  it('type is module (ESM)', () => {
    assert.equal(pkg.type, 'module')
  })

  it('engines requires node >= 18', () => {
    assert.ok(pkg.engines?.node, 'engines.node should be set')
    assert.match(pkg.engines.node, /18/)
  })
})

describe('CLI entry point sanity', () => {
  const binContent = readFileSync(join(ROOT, 'bin/free-coding-models.js'), 'utf8')

  it('has shebang line', () => {
    assert.ok(binContent.startsWith('#!/usr/bin/env node'), 'Should start with shebang')
  })

  it('imports from sources.js', () => {
    assert.ok(binContent.includes("from '../sources.js'"), 'Should import sources.js')
  })

  it('imports from lib/utils.js', () => {
    assert.ok(binContent.includes("from '../src/utils.js'"), 'Should import lib/utils.js')
  })
})

describe('constants consistency', () => {
  it('TIER_ORDER covers all tiers used in sources', () => {
    const tiersInModels = [...new Set(MODELS.map(m => m[2]))]
    for (const tier of tiersInModels) {
      assert.ok(TIER_ORDER.includes(tier), `Tier "${tier}" from models not in TIER_ORDER`)
    }
  })

  it('TIER_LETTER_MAP covers all tier letters', () => {
    assert.deepEqual(Object.keys(TIER_LETTER_MAP).sort(), ['A', 'B', 'C', 'S'])
  })

  it('all TIER_LETTER_MAP values are subsets of TIER_ORDER', () => {
    for (const [letter, tiers] of Object.entries(TIER_LETTER_MAP)) {
      for (const tier of tiers) {
        assert.ok(TIER_ORDER.includes(tier), `TIER_LETTER_MAP['${letter}'] has invalid tier "${tier}"`)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 5. SMART RECOMMEND — SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
describe('Smart Recommend constants', () => {
  it('TASK_TYPES has expected keys', () => {
    assert.deepEqual(Object.keys(TASK_TYPES).sort(), ['quickfix', 'refactor', 'review', 'testgen'])
  })

  it('TASK_TYPES weights sum to 1.0 for each task', () => {
    for (const [key, task] of Object.entries(TASK_TYPES)) {
      const sum = task.sweWeight + task.speedWeight + task.ctxWeight + task.stabilityWeight
      assert.ok(Math.abs(sum - 1.0) < 0.001, `${key} weights sum to ${sum}, expected 1.0`)
    }
  })

  it('PRIORITY_TYPES has expected keys', () => {
    assert.deepEqual(Object.keys(PRIORITY_TYPES).sort(), ['balanced', 'quality', 'speed'])
  })

  it('PRIORITY_TYPES balanced has 1.0 multipliers', () => {
    assert.equal(PRIORITY_TYPES.balanced.speedMultiplier, 1.0)
    assert.equal(PRIORITY_TYPES.balanced.sweMultiplier, 1.0)
  })

  it('CONTEXT_BUDGETS has expected keys', () => {
    assert.deepEqual(Object.keys(CONTEXT_BUDGETS).sort(), ['large', 'medium', 'small'])
  })

  it('CONTEXT_BUDGETS have ascending idealCtx', () => {
    assert.ok(CONTEXT_BUDGETS.small.idealCtx < CONTEXT_BUDGETS.medium.idealCtx)
    assert.ok(CONTEXT_BUDGETS.medium.idealCtx < CONTEXT_BUDGETS.large.idealCtx)
  })
})

describe('scoreModelForTask', () => {
  it('returns 0 for invalid task type', () => {
    assert.equal(scoreModelForTask(mockResult(), 'invalid', 'balanced', 'small'), 0)
  })

  it('returns 0 for invalid priority', () => {
    assert.equal(scoreModelForTask(mockResult(), 'quickfix', 'invalid', 'small'), 0)
  })

  it('returns 0 for invalid context budget', () => {
    assert.equal(scoreModelForTask(mockResult(), 'quickfix', 'balanced', 'invalid'), 0)
  })

  it('returns a score between 0 and 100', () => {
    const r = mockResult({ pings: [{ ms: 200, code: '200' }, { ms: 300, code: '200' }] })
    const score = scoreModelForTask(r, 'quickfix', 'balanced', 'small')
    assert.ok(score >= 0 && score <= 100, `score ${score} should be 0-100`)
  })

  it('penalizes down models', () => {
    const up = mockResult({ status: 'up', pings: [{ ms: 200, code: '200' }], sweScore: '50.0%', ctx: '128k' })
    const down = mockResult({ status: 'down', pings: [{ ms: 200, code: '200' }], sweScore: '50.0%', ctx: '128k' })
    const scoreUp = scoreModelForTask(up, 'quickfix', 'balanced', 'small')
    const scoreDown = scoreModelForTask(down, 'quickfix', 'balanced', 'small')
    assert.ok(scoreUp > scoreDown, `up (${scoreUp}) should beat down (${scoreDown})`)
  })

  it('penalizes timeout models', () => {
    const up = mockResult({ status: 'up', pings: [{ ms: 200, code: '200' }], sweScore: '50.0%', ctx: '128k' })
    const timeout = mockResult({ status: 'timeout', pings: [{ ms: 200, code: '200' }], sweScore: '50.0%', ctx: '128k' })
    const scoreUp = scoreModelForTask(up, 'quickfix', 'balanced', 'small')
    const scoreTimeout = scoreModelForTask(timeout, 'quickfix', 'balanced', 'small')
    assert.ok(scoreUp > scoreTimeout, `up (${scoreUp}) should beat timeout (${scoreTimeout})`)
  })

  it('higher SWE score gives higher score for quality-focused tasks', () => {
    const highSwe = mockResult({ sweScore: '70.0%', pings: [{ ms: 300, code: '200' }], ctx: '128k' })
    const lowSwe = mockResult({ sweScore: '20.0%', pings: [{ ms: 300, code: '200' }], ctx: '128k' })
    const scoreHigh = scoreModelForTask(highSwe, 'refactor', 'quality', 'medium')
    const scoreLow = scoreModelForTask(lowSwe, 'refactor', 'quality', 'medium')
    assert.ok(scoreHigh > scoreLow, `high SWE (${scoreHigh}) should beat low SWE (${scoreLow})`)
  })

  it('faster model scores better for speed-focused quickfix', () => {
    const fast = mockResult({ pings: [{ ms: 100, code: '200' }], sweScore: '40.0%', ctx: '128k' })
    const slow = mockResult({ pings: [{ ms: 4000, code: '200' }], sweScore: '40.0%', ctx: '128k' })
    const scoreFast = scoreModelForTask(fast, 'quickfix', 'speed', 'small')
    const scoreSlow = scoreModelForTask(slow, 'quickfix', 'speed', 'small')
    assert.ok(scoreFast > scoreSlow, `fast (${scoreFast}) should beat slow (${scoreSlow})`)
  })

  it('larger context model scores better for large codebase budget', () => {
    const bigCtx = mockResult({ ctx: '256k', pings: [{ ms: 300, code: '200' }], sweScore: '40.0%' })
    const smallCtx = mockResult({ ctx: '4k', pings: [{ ms: 300, code: '200' }], sweScore: '40.0%' })
    const scoreBig = scoreModelForTask(bigCtx, 'review', 'balanced', 'large')
    const scoreSmall = scoreModelForTask(smallCtx, 'review', 'balanced', 'large')
    assert.ok(scoreBig > scoreSmall, `big ctx (${scoreBig}) should beat small ctx (${scoreSmall})`)
  })

  it('handles missing SWE score (dash)', () => {
    const r = mockResult({ sweScore: '—', pings: [{ ms: 200, code: '200' }] })
    const score = scoreModelForTask(r, 'quickfix', 'balanced', 'small')
    assert.ok(score >= 0, `score with no SWE should be >= 0`)
  })

  it('handles missing context (dash)', () => {
    const r = mockResult({ ctx: '—', pings: [{ ms: 200, code: '200' }], sweScore: '40.0%' })
    const score = scoreModelForTask(r, 'quickfix', 'balanced', 'small')
    assert.ok(score >= 0, `score with no ctx should be >= 0`)
  })

  it('handles no pings (Infinity avg)', () => {
    const r = mockResult({ pings: [], sweScore: '40.0%', ctx: '128k' })
    const score = scoreModelForTask(r, 'quickfix', 'balanced', 'small')
    assert.ok(score >= 0, `score with no pings should be >= 0`)
  })

  it('handles 1m context', () => {
    const r = mockResult({ ctx: '1m', pings: [{ ms: 200, code: '200' }], sweScore: '40.0%' })
    const score = scoreModelForTask(r, 'review', 'balanced', 'large')
    assert.ok(score > 0, `1m context model should score > 0`)
  })
})

describe('getTopRecommendations', () => {
  it('returns topN results', () => {
    const results = [
      mockResult({ modelId: 'a', sweScore: '60.0%', pings: [{ ms: 100, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'b', sweScore: '40.0%', pings: [{ ms: 200, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'c', sweScore: '70.0%', pings: [{ ms: 150, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'd', sweScore: '30.0%', pings: [{ ms: 300, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'e', sweScore: '50.0%', pings: [{ ms: 250, code: '200' }], ctx: '128k' }),
    ]
    const recs = getTopRecommendations(results, 'quickfix', 'balanced', 'small', 3)
    assert.equal(recs.length, 3)
  })

  it('returns results sorted by score descending', () => {
    const results = [
      mockResult({ modelId: 'a', sweScore: '60.0%', pings: [{ ms: 100, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'b', sweScore: '30.0%', pings: [{ ms: 500, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'c', sweScore: '70.0%', pings: [{ ms: 150, code: '200' }], ctx: '128k' }),
    ]
    const recs = getTopRecommendations(results, 'quickfix', 'balanced', 'small', 3)
    assert.ok(recs[0].score >= recs[1].score, 'first should have highest score')
    assert.ok(recs[1].score >= recs[2].score, 'second should beat third')
  })

  it('excludes hidden results', () => {
    const results = [
      mockResult({ modelId: 'a', sweScore: '60.0%', pings: [{ ms: 100, code: '200' }], ctx: '128k' }),
      mockResult({ modelId: 'b', sweScore: '90.0%', pings: [{ ms: 50, code: '200' }], ctx: '256k', hidden: true }),
      mockResult({ modelId: 'c', sweScore: '30.0%', pings: [{ ms: 200, code: '200' }], ctx: '128k' }),
    ]
    const recs = getTopRecommendations(results, 'quickfix', 'balanced', 'small', 3)
    assert.equal(recs.length, 2, 'hidden model should be excluded')
    const ids = recs.map(r => r.result.modelId)
    assert.ok(!ids.includes('b'), 'hidden model b should not appear')
  })

  it('returns fewer than topN if not enough results', () => {
    const results = [
      mockResult({ modelId: 'a', sweScore: '60.0%', pings: [{ ms: 100, code: '200' }], ctx: '128k' }),
    ]
    const recs = getTopRecommendations(results, 'quickfix', 'balanced', 'small', 3)
    assert.equal(recs.length, 1)
  })

  it('each result has result and score fields', () => {
    const results = [
      mockResult({ modelId: 'a', sweScore: '60.0%', pings: [{ ms: 100, code: '200' }], ctx: '128k' }),
    ]
    const recs = getTopRecommendations(results, 'quickfix', 'balanced', 'small')
    assert.ok(recs[0].result, 'should have result field')
    assert.equal(typeof recs[0].score, 'number', 'should have numeric score')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 6. PARSEARGS — --profile AND --recommend FLAGS
// ═══════════════════════════════════════════════════════════════════════════════
describe('parseArgs --profile and --recommend', () => {
  // 📖 Helper: simulate process.argv (first two entries are node + script path)
  const argv = (...args) => ['node', 'script.js', ...args]

  it('parses --profile with a value', () => {
    const result = parseArgs(argv('--profile', 'work'))
    assert.equal(result.profileName, 'work')
  })

  it('returns null profileName when --profile has no value', () => {
    assert.equal(parseArgs(argv('--profile')).profileName, null)
    assert.equal(parseArgs(argv('--profile', '--best')).profileName, null)
  })

  it('does not capture --profile value as apiKey', () => {
    assert.equal(parseArgs(argv('--profile', 'work')).apiKey, null)
  })

  it('parses --recommend flag', () => {
    assert.equal(parseArgs(argv('--recommend')).recommendMode, true)
  })

  it('recommendMode defaults to false', () => {
    assert.equal(parseArgs(argv()).recommendMode, false)
  })

  it('handles --profile and --recommend together', () => {
    const result = parseArgs(argv('--profile', 'fast', '--recommend', '--opencode'))
    assert.equal(result.profileName, 'fast')
    assert.equal(result.recommendMode, true)
    assert.equal(result.openCodeMode, true)
  })

  it('parses the proxy cleanup flags', () => {
    assert.equal(parseArgs(argv('--clean-proxy')).cleanProxyMode, true)
    assert.equal(parseArgs(argv('--proxy-clean')).cleanProxyMode, true)
    assert.equal(parseArgs(argv()).cleanProxyMode, false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📖 7. CONFIG PROFILES — pure logic tests (no filesystem I/O)
// ═══════════════════════════════════════════════════════════════════════════════
describe('config profile functions', () => {
  // 📖 Helper: create a minimal config object matching the shape from loadConfig()
  function mockConfig() {
    return {
      apiKeys: { nvidia: 'test-key' },
      providers: { nvidia: true },
      settings: {
        hideUnconfiguredModels: true,
        proxy: { enabled: false, syncToOpenCode: false, preferredPort: 0 },
      },
      favorites: ['nvidia/test-model'],
      telemetry: { enabled: false },
      profiles: {},
      activeProfile: null,
    }
  }

  it('_emptyProfileSettings returns expected shape', () => {
    const settings = _emptyProfileSettings()
    assert.equal(typeof settings.tierFilter, 'object') // null
    assert.equal(settings.sortColumn, 'avg')
    assert.equal(settings.sortAsc, true)
    assert.equal(settings.pingInterval, 10000)
    assert.equal(settings.hideUnconfiguredModels, true)
    assert.deepEqual(settings.proxy, { enabled: false, syncToOpenCode: false, preferredPort: 0 })
  })

  it('listProfiles returns empty array for fresh config', () => {
    const config = mockConfig()
    assert.deepEqual(listProfiles(config), [])
  })

  it('saveAsProfile saves and listProfiles returns it', () => {
    const config = mockConfig()
    saveAsProfile(config, 'work', { sortColumn: 'swe', sortAsc: false, pingInterval: 5000 })
    assert.deepEqual(listProfiles(config), ['work'])
  })

  it('saveAsProfile copies apiKeys and favorites into profile', () => {
    const config = mockConfig()
    saveAsProfile(config, 'myprofile')
    const profile = config.profiles.myprofile
    assert.deepEqual(profile.apiKeys, { nvidia: 'test-key' })
    assert.deepEqual(profile.favorites, ['nvidia/test-model'])
  })

  it('saveAsProfile persists the configured-only filter in profile settings', () => {
    const config = mockConfig()
    saveAsProfile(config, 'focused', { hideUnconfiguredModels: true })
    assert.equal(config.profiles.focused.settings.hideUnconfiguredModels, true)
  })

  it('saveAsProfile can persist proxy settings', () => {
    const config = mockConfig()
    saveAsProfile(config, 'proxy', { proxy: { enabled: true, syncToOpenCode: true, preferredPort: 8045 } })
    assert.deepEqual(config.profiles.proxy.settings.proxy, { enabled: true, syncToOpenCode: true, preferredPort: 8045 })
  })

  it('loadProfile returns settings and sets activeProfile', () => {
    const config = mockConfig()
    saveAsProfile(config, 'dev', { sortColumn: 'rank', sortAsc: true, pingInterval: 3000, hideUnconfiguredModels: true, proxy: { enabled: true, syncToOpenCode: true, preferredPort: 9000 } })
    const settings = loadProfile(config, 'dev')
    assert.equal(settings.sortColumn, 'rank')
    assert.equal(settings.hideUnconfiguredModels, true)
    assert.equal(settings.proxy.enabled, true)
    assert.equal(config.settings.proxy.preferredPort, 9000)
    assert.equal(config.activeProfile, 'dev')
  })

  it('loadProfile returns null for nonexistent profile', () => {
    const config = mockConfig()
    assert.equal(loadProfile(config, 'nope'), null)
  })

  it('loadProfile applies apiKeys from profile to config', () => {
    const config = mockConfig()
    saveAsProfile(config, 'p1')
    // 📖 Mutate config apiKeys after saving profile
    config.apiKeys.nvidia = 'changed-key'
    loadProfile(config, 'p1')
    assert.equal(config.apiKeys.nvidia, 'test-key', 'should restore original key from profile')
  })

  it('deleteProfile removes the profile', () => {
    const config = mockConfig()
    saveAsProfile(config, 'temp')
    assert.deepEqual(listProfiles(config), ['temp'])
    deleteProfile(config, 'temp')
    assert.deepEqual(listProfiles(config), [])
  })

  it('deleteProfile clears activeProfile if it was the deleted one', () => {
    const config = mockConfig()
    saveAsProfile(config, 'active')
    setActiveProfile(config, 'active')
    assert.equal(getActiveProfileName(config), 'active')
    deleteProfile(config, 'active')
    assert.equal(getActiveProfileName(config), null)
  })

  it('getActiveProfileName returns null by default', () => {
    const config = mockConfig()
    assert.equal(getActiveProfileName(config), null)
  })

  it('setActiveProfile sets and getActiveProfileName reads it', () => {
    const config = mockConfig()
    setActiveProfile(config, 'fast')
    assert.equal(getActiveProfileName(config), 'fast')
  })

  it('setActiveProfile(null) clears the active profile', () => {
    const config = mockConfig()
    setActiveProfile(config, 'fast')
    setActiveProfile(config, null)
    assert.equal(getActiveProfileName(config), null)
  })

  it('multiple profiles can coexist', () => {
    const config = mockConfig()
    saveAsProfile(config, 'work', { sortColumn: 'rank' })
    saveAsProfile(config, 'personal', { sortColumn: 'avg' })
    saveAsProfile(config, 'fast', { sortColumn: 'ping' })
    assert.deepEqual(listProfiles(config), ['fast', 'personal', 'work'])
  })

  it('normalizes proxy settings to disabled-by-default', () => {
    assert.deepEqual(normalizeProxySettings(), { enabled: false, syncToOpenCode: false, preferredPort: 0 })
    assert.deepEqual(getProxySettings({ settings: {} }), { enabled: false, syncToOpenCode: false, preferredPort: 0 })
    assert.deepEqual(getProxySettings({ settings: { proxy: { enabled: true, syncToOpenCode: true, preferredPort: 8123 } } }), {
      enabled: true,
      syncToOpenCode: true,
      preferredPort: 8123,
    })
  })

  it('defaults configured-only mode and preferred tool mode in profile settings', () => {
    assert.equal(_emptyProfileSettings().hideUnconfiguredModels, true)
    assert.equal(_emptyProfileSettings().preferredToolMode, 'opencode')
  })
})

// ─── formatCtxWindow ─────────────────────────────────────────────────────────
// 📖 Tests for context window number-to-string conversion used by dynamic OpenRouter discovery
describe('formatCtxWindow', () => {
  it('converts 128000 to 128k', () => {
    assert.equal(formatCtxWindow(128000), '128k')
  })

  it('converts 256000 to 256k', () => {
    assert.equal(formatCtxWindow(256000), '256k')
  })

  it('converts 1048576 to 1M', () => {
    assert.equal(formatCtxWindow(1048576), '1M')
  })

  it('converts 2000000 to 2M', () => {
    assert.equal(formatCtxWindow(2000000), '2M')
  })

  it('converts 32768 to 33k (rounds)', () => {
    assert.equal(formatCtxWindow(32768), '33k')
  })

  it('returns 128k for zero', () => {
    assert.equal(formatCtxWindow(0), '128k')
  })

  it('returns 128k for negative', () => {
    assert.equal(formatCtxWindow(-1), '128k')
  })

  it('returns 128k for non-number', () => {
    assert.equal(formatCtxWindow(null), '128k')
    assert.equal(formatCtxWindow(undefined), '128k')
    assert.equal(formatCtxWindow('128k'), '128k')
  })
})

// ─── labelFromId ─────────────────────────────────────────────────────────────
// 📖 Tests for OpenRouter model ID to human-readable label conversion
describe('labelFromId', () => {
  it('strips :free suffix and org prefix', () => {
    assert.equal(labelFromId('qwen/qwen3-coder:free'), 'Qwen3 Coder')
  })

  it('handles deep nested org paths', () => {
    assert.equal(labelFromId('meta-llama/llama-3.3-70b-instruct:free'), 'Llama 3.3 70b Instruct')
  })

  it('handles underscore-separated names', () => {
    assert.equal(labelFromId('org/model_name_v2:free'), 'Model Name V2')
  })

  it('handles ID without org prefix', () => {
    assert.equal(labelFromId('mimo-v2-flash:free'), 'Mimo V2 Flash')
  })

  it('handles ID without :free suffix', () => {
    assert.equal(labelFromId('qwen/qwen3-coder'), 'Qwen3 Coder')
  })
})

// ─── token-usage-reader ─────────────────────────────────────────────────────
describe('token-usage-reader', () => {
  it('buildProviderModelTokenKey combines provider and model', () => {
    assert.equal(buildProviderModelTokenKey('groq', 'openai/gpt-oss-120b'), 'groq::openai/gpt-oss-120b')
  })

  it('formatTokenTotalCompact renders raw, k, and M with 2 decimals', () => {
    assert.equal(formatTokenTotalCompact(0), '0')
    assert.equal(formatTokenTotalCompact(999), '999')
    assert.equal(formatTokenTotalCompact(1234), '1.23k')
    assert.equal(formatTokenTotalCompact(999999), '1.00M')
    assert.equal(formatTokenTotalCompact(1456789), '1.46M')
  })

  it('loadTokenUsageByProviderModel aggregates tokens per exact provider/model pair', () => {
    const dir = join(tmpdir(), `fcm-token-usage-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const logFile = join(dir, 'request-log.jsonl')

    try {
      writeFileSync(logFile, [
        JSON.stringify({ timestamp: new Date().toISOString(), providerKey: 'groq', modelId: 'openai/gpt-oss-120b', promptTokens: 1200, completionTokens: 300 }),
        JSON.stringify({ timestamp: new Date().toISOString(), providerKey: 'groq', modelId: 'openai/gpt-oss-120b', promptTokens: 200, completionTokens: 100 }),
        JSON.stringify({ timestamp: new Date().toISOString(), providerKey: 'nvidia', modelId: 'openai/gpt-oss-120b', promptTokens: 5000, completionTokens: 500 }),
      ].join('\n') + '\n')

      const totals = loadTokenUsageByProviderModel({ logFile, limit: 100 })
      assert.equal(totals['groq::openai/gpt-oss-120b'], 1800)
      assert.equal(totals['nvidia::openai/gpt-oss-120b'], 5500)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('request log parsing', () => {
  it('parses proxy switch metadata for fallback rows', () => {
    const row = parseLogLine(JSON.stringify({
      timestamp: new Date().toISOString(),
      providerKey: 'groq',
      modelId: 'openai/gpt-oss-120b',
      requestedModelId: 'deepseek-v3-1',
      switched: true,
      switchReason: '429',
      switchedFromProviderKey: 'nvidia',
      switchedFromModelId: 'deepseek-ai/deepseek-v3.1',
      statusCode: 200,
      promptTokens: 120,
      completionTokens: 30,
      latencyMs: 456,
    }))

    assert.ok(row)
    assert.equal(row.requestedModel, 'deepseek-v3-1')
    assert.equal(row.model, 'openai/gpt-oss-120b')
    assert.equal(row.switched, true)
    assert.equal(row.switchReason, '429')
    assert.equal(row.switchedFromProvider, 'nvidia')
    assert.equal(row.switchedFromModel, 'deepseek-ai/deepseek-v3.1')
  })
})

describe('proxy launcher model ids', () => {
  it('uses the merged proxy slug for proxy-backed launcher flows', () => {
    const mergedModels = buildMergedModels(MODELS)
    const mergedModelByLabel = new Map(mergedModels.map(model => [model.label, model]))
    setOpenCodeModelData(mergedModels, mergedModelByLabel)

    const resolved = resolveLauncherModelId({
      modelId: 'openai/gpt-oss-120b',
      label: 'GPT OSS 120B',
      providerKey: 'nvidia',
    }, true)

    assert.equal(resolved, 'gpt-oss-120b')
  })

  it('keeps the provider-specific model id when proxy is disabled', () => {
    const resolved = resolveLauncherModelId({
      modelId: 'deepseek-ai/deepseek-v3.1',
      label: 'DeepSeek V3.1',
      providerKey: 'nvidia',
    }, false)

    assert.equal(resolved, 'deepseek-ai/deepseek-v3.1')
  })
})

describe('endpoint install tracking', () => {
  it('normalizes tracked installs to canonical shape', () => {
    const normalized = normalizeEndpointInstalls([
      {
        providerKey: 'nvidia',
        toolMode: 'opencode',
        scope: 'selected',
        modelIds: ['deepseek-ai/deepseek-v3.2', '', 'deepseek-ai/deepseek-v3.2'],
        lastSyncedAt: '2026-03-09T12:00:00.000Z',
      },
      null,
      { providerKey: '', toolMode: 'goose' },
    ])

    assert.deepEqual(normalized, [
      {
        providerKey: 'nvidia',
        toolMode: 'opencode',
        scope: 'selected',
        modelIds: ['deepseek-ai/deepseek-v3.2'],
        lastSyncedAt: '2026-03-09T12:00:00.000Z',
      },
    ])
  })

  it('lists only configured providers that support direct endpoint installs', () => {
    const providers = getConfiguredInstallableProviders({
      apiKeys: {
        nvidia: 'nvapi-test',
        replicate: 'r8-test',
      },
    })

    assert.ok(providers.some((provider) => provider.providerKey === 'nvidia'))
    assert.ok(!providers.some((provider) => provider.providerKey === 'replicate'))
  })
})

describe('endpoint installer', () => {
  it('installs a managed OpenCode provider catalog and tracks it canonically', () => {
    const dir = join(tmpdir(), `fcm-opencode-install-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const config = {
      apiKeys: { nvidia: 'nvapi-test' },
      providers: {},
      settings: {},
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      profiles: {},
      activeProfile: null,
    }

    const paths = {
      opencodeConfigPath: join(dir, 'opencode', 'opencode.json'),
      openclawConfigPath: join(dir, 'openclaw', 'openclaw.json'),
      crushConfigPath: join(dir, 'crush', 'crush.json'),
      gooseProvidersDir: join(dir, 'goose', 'custom_providers'),
      gooseSecretsPath: join(dir, 'goose', 'secrets.yaml'),
    }

    try {
      const expectedApiKey = getApiKey(config, 'nvidia')
      const result = installProviderEndpoints(config, 'nvidia', 'opencode-desktop', {
        scope: 'selected',
        modelIds: ['deepseek-ai/deepseek-v3.2'],
        paths,
      })

      const written = JSON.parse(readFileSync(paths.opencodeConfigPath, 'utf8'))
      assert.equal(result.toolMode, 'opencode')
      assert.equal(result.modelCount, 1)
      assert.equal(written.provider['fcm-nvidia'].options.apiKey, expectedApiKey)
      assert.deepEqual(written.provider['fcm-nvidia'].models, {
        'deepseek-ai/deepseek-v3.2': { name: 'DeepSeek V3.2' },
      })
      assert.deepEqual(config.endpointInstalls.map((entry) => ({
        providerKey: entry.providerKey,
        toolMode: entry.toolMode,
        scope: entry.scope,
        modelIds: entry.modelIds,
      })), [
        {
          providerKey: 'nvidia',
          toolMode: 'opencode',
          scope: 'selected',
          modelIds: ['deepseek-ai/deepseek-v3.2'],
        },
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('installs Goose custom provider metadata and persists the matching secret', () => {
    const dir = join(tmpdir(), `fcm-goose-install-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })

    const config = {
      apiKeys: { groq: 'gsk-test' },
      providers: {},
      settings: {},
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      profiles: {},
      activeProfile: null,
    }

    const paths = {
      opencodeConfigPath: join(dir, 'opencode', 'opencode.json'),
      openclawConfigPath: join(dir, 'openclaw', 'openclaw.json'),
      crushConfigPath: join(dir, 'crush', 'crush.json'),
      gooseProvidersDir: join(dir, 'goose', 'custom_providers'),
      gooseSecretsPath: join(dir, 'goose', 'secrets.yaml'),
    }

    try {
      const expectedApiKey = getApiKey(config, 'groq')
      installProviderEndpoints(config, 'groq', 'goose', {
        scope: 'selected',
        modelIds: ['openai/gpt-oss-120b'],
        paths,
      })

      const providerFile = join(paths.gooseProvidersDir, 'fcm-groq.json')
      const providerConfig = JSON.parse(readFileSync(providerFile, 'utf8'))
      const secretsYaml = readFileSync(paths.gooseSecretsPath, 'utf8')

      assert.equal(providerConfig.api_key_env, 'FCM_GROQ_API_KEY')
      assert.equal(providerConfig.models[0].name, 'openai/gpt-oss-120b')
      assert.match(secretsYaml, new RegExp(`FCM_GROQ_API_KEY:\\s+${JSON.stringify(String(expectedApiKey))}`))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ─── Dynamic OpenRouter model discovery (MODELS mutation) ────────────────────
// 📖 Tests that verify the MODELS array mutation logic used by fetchOpenRouterFreeModels
describe('Dynamic OpenRouter MODELS mutation', () => {
  it('MODELS array contains openrouter entries from static sources', () => {
    const orEntries = MODELS.filter(m => m[5] === 'openrouter')
    assert.ok(orEntries.length > 0, 'Should have at least one openrouter entry in MODELS')
  })

  it('all openrouter entries have valid tuple format [id, label, tier, swe, ctx, providerKey]', () => {
    const orEntries = MODELS.filter(m => m[5] === 'openrouter')
    for (const entry of orEntries) {
      assert.equal(entry.length, 6, `Entry ${entry[0]} should have 6 elements`)
      assert.equal(typeof entry[0], 'string', 'modelId should be string')
      assert.equal(typeof entry[1], 'string', 'label should be string')
      assert.ok(TIER_ORDER.includes(entry[2]), `tier ${entry[2]} should be valid`)
      assert.match(entry[3], /^\d+\.\d+%$/, 'sweScore should match N.N% format')
      assert.match(entry[4], /^\d+[kM]$/, 'ctx should match Nk or NM format')
      assert.equal(entry[5], 'openrouter', 'providerKey should be openrouter')
    }
  })

  it('MODELS array is mutable (can splice and push)', () => {
    const originalLength = MODELS.length
    // Push a test entry
    MODELS.push(['test/model:free', 'Test Model', 'B', '25.0%', '128k', 'openrouter'])
    assert.equal(MODELS.length, originalLength + 1)
    // Remove it
    MODELS.splice(MODELS.length - 1, 1)
    assert.equal(MODELS.length, originalLength)
  })
})
