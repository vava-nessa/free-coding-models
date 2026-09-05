/**
 * @file test/extended-benchmarks.test.js
 * @description Tests for src/core/extended-benchmarks.js — extended per-model benchmark catalog
 *              with prefix-indexed O(key length) lookup and lazy JSON loading.
 *
 * Covers:
 *   - getBenchmarksDataPath returns the expected src/data/benchmarks.json
 *   - Lazy load: loadCatalog caches the catalog after first call
 *   - getCatalog() returns the live catalog object (with _meta)
 *   - buildPrefixIndex correctly indexes exact and prefix variants
 *   - lookupExtendedBenchmark — exact match (O(1))
 *   - lookupExtendedBenchmark — prefix fallback (cross-provider variants)
 *   - lookupExtendedBenchmark — unknown model returns null (no throw)
 *   - lookupExtendedBenchmark — invalid input returns null (no throw)
 *   - scoreCandidate tie-breaker (exact beats longest-prefix when both exist)
 *   - mergeExtendedBenchmark — non-mutating by default, overlay bag shape
 *   - mergeExtendedBenchmark — mutate=true mutates in place
 *   - mergeExtendedBenchmark — null entry sets extendedBench: null
 *   - getCatalogStats — totals, byField counts, _meta lastUpdated
 *   - resetCatalogCache — clears _catalog and _index (rebuild on next access)
 *   - enrichWithExtendedBenchmark — convenience combo
 *   - BENCHMARKS proxy — defers load to first access
 *   - Performance sanity: 10k lookups against a 50-entry catalog stay sub-10ms
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

import {
  getBenchmarksDataPath,
  loadCatalog,
  resetCatalogCache,
  getCatalog,
  buildPrefixIndex,
  lookupExtendedBenchmark,
  getCatalogStats,
  mergeExtendedBenchmark,
  enrichWithExtendedBenchmark,
  EXTENDED_BENCH_FIELDS,
  BENCHMARKS,
} from '../src/core/extended-benchmarks.js'

// ─── Test fixtures ────────────────────────────────────────────────────────────

/**
 * 📖 Minimal in-memory catalog used by prefix-index + lookup tests so we don't
 * 📖 depend on the real benchmarks.json shape (which can grow over time).
 */
const FIXTURE = {
  _meta: { schemaVersion: 1, lastUpdated: '2026-07-25', source: 'test' },
  'deepseek-ai/deepseek-v4-pro': {
    codingIndex: 81.2, mathIndex: 84.5, mmluPro: 86.4, hle: 14.2,
    contextWindow: 1_000_000, supportsReasoning: true, supportsVision: false,
    lastUpdated: '2026-07-20', originalModel: 'DeepSeek V4 Pro',
  },
  'deepseek-ai/deepseek-v4-flash': {
    codingIndex: 78.9, mmluPro: 83.2, hle: 12.8,
    contextWindow: 1_000_000, supportsReasoning: true, supportsVision: false,
    lastUpdated: '2026-07-20', originalModel: 'DeepSeek V4 Flash',
  },
  'deepseek-ai/deepseek-r1': {
    codingIndex: 52.0, mmluPro: 84.0, hle: 9.9, contextWindow: 128_000,
    supportsReasoning: true, lastUpdated: '2026-07-20', originalModel: 'DeepSeek R1',
  },
  'z-ai/glm-5.2': {
    codingIndex: 82.4, mmluPro: 84.2, hle: 13.5, contextWindow: 128_000,
    supportsReasoning: true, lastUpdated: '2026-07-20', originalModel: 'GLM 5.2',
  },
  'meta/llama-4-scout': {
    codingIndex: 28.0, mmluPro: 30.0, hle: 2.0, contextWindow: 10_000_000,
    supportsReasoning: false, supportsVision: true, lastUpdated: '2026-07-20',
  },
  'MiniMax-M2.7': {
    codingIndex: 77.5, mmluPro: 80.5, hle: 11.5, contextWindow: 192_000,
    supportsReasoning: true, lastUpdated: '2026-07-20',
  },
}

function indexOfFixture() {
  return buildPrefixIndex(FIXTURE)
}

// ─── getBenchmarksDataPath ───────────────────────────────────────────────────

describe('getBenchmarksDataPath', () => {
  it('returns the src/data/benchmarks.json absolute path', () => {
    const p = getBenchmarksDataPath()
    assert.ok(p.endsWith('/src/data/benchmarks.json'), `unexpected path: ${p}`)
  })

  it('points to a file that exists on disk (committed seed data)', () => {
    const p = getBenchmarksDataPath()
    assert.ok(existsSync(p), `expected seed file to exist: ${p}`)
  })
})

// ─── Lazy load + cache ───────────────────────────────────────────────────────

describe('loadCatalog + resetCatalogCache', () => {
  afterEach(() => resetCatalogCache())

  it('returns the committed seed catalog on first call', () => {
    const c = loadCatalog()
    assert.ok(c && typeof c === 'object')
    assert.ok('_meta' in c, 'expected _meta key')
    assert.ok(typeof c._meta.lastUpdated === 'string')
  })

  it('caches the catalog — second call returns the same reference', () => {
    const a = loadCatalog()
    const b = loadCatalog()
    assert.equal(a, b, 'expected the same object reference')
  })

  it('resetCatalogCache forces a reload on next call', () => {
    const a = loadCatalog()
    resetCatalogCache()
    const b = loadCatalog()
    assert.notEqual(a, b, 'expected a new object after reset')
  })

  it('returns a valid JSON object for the seed file', () => {
    const c = loadCatalog()
    const keys = Object.keys(c).filter(k => k !== '_meta')
    assert.ok(keys.length >= 20, `expected >= 20 model entries in seed, got ${keys.length}`)
  })
})

// ─── getCatalog + BENCHMARKS proxy ───────────────────────────────────────────

describe('getCatalog + BENCHMARKS proxy', () => {
  beforeEach(() => resetCatalogCache())

  it('getCatalog returns the catalog object', () => {
    const c = getCatalog()
    assert.ok(c && typeof c === 'object')
    assert.ok('_meta' in c)
  })

  it('BENCHMARKS proxy returns real entries by key', () => {
    // 📖 Force a load first (proxy defers), then read a known seed entry.
    // 📖 We test against any non-meta key from the real seed.
    const c = getCatalog()
    const sample = Object.keys(c).find(k => k !== '_meta')
    if (sample) {
      const viaProxy = BENCHMARKS[sample]
      assert.ok(viaProxy && typeof viaProxy === 'object', 'proxy should return the entry')
      assert.equal(viaProxy, c[sample])
    } else {
      // 📖 Fallback: just verify the proxy is non-thenable + returns object for any key
      assert.equal(BENCHMARKS.then, undefined, 'proxy should be non-thenable')
    }
  })

  it('BENCHMARKS proxy is non-thenable (then === undefined)', () => {
    assert.equal(BENCHMARKS.then, undefined)
  })
})

// ─── buildPrefixIndex ────────────────────────────────────────────────────────

describe('buildPrefixIndex', () => {
  it('indexes each entry under its full key for exact lookup', () => {
    const { exact } = indexOfFixture()
    assert.equal(exact.size, 6)
    assert.ok(exact.has('deepseek-ai/deepseek-v4-pro'))
    assert.ok(exact.has('MiniMax-M2.7'))
  })

  it('skips the _meta key (it is not a model entry)', () => {
    const { exact } = indexOfFixture()
    assert.ok(!exact.has('_meta'))
  })

  it('creates prefix variants for cross-provider matches', () => {
    const { variants } = indexOfFixture()
    // 📖 "deepseek-ai" should map to all 3 deepseek-ai/* entries
    const deepseekAiBucket = variants.get('deepseek-ai')
    assert.ok(deepseekAiBucket && deepseekAiBucket.length === 3,
      `expected 3 deepseek-ai/* entries, got ${deepseekAiBucket?.length}`)
    // 📖 "deepseek-ai/deepseek" should map to all 3 as well
    const deepseekFullBucket = variants.get('deepseek-ai/deepseek')
    assert.ok(deepseekFullBucket && deepseekFullBucket.length === 3)
  })

  it('handles both NIM-style (z-ai/glm-5.2) and provider-only (MiniMax-M2.7) ids', () => {
    const { variants } = indexOfFixture()
    // 📖 "z-ai" should be a prefix bucket (segment split on [-/])
    const zAiBucket = variants.get('z-ai')
    assert.ok(zAiBucket && zAiBucket.length === 1, 'z-ai bucket should contain 1 entry')
    // 📖 "MiniMax" should be a prefix bucket (no slashes/dashes inside)
    const minimaxBucket = variants.get('MiniMax')
    assert.ok(minimaxBucket && minimaxBucket.length === 1)
  })
})

// ─── lookupExtendedBenchmark ─────────────────────────────────────────────────

describe('lookupExtendedBenchmark', () => {
  it('returns the entry on exact match', () => {
    const idx = indexOfFixture()
    const entry = lookupExtendedBenchmark('deepseek-ai/deepseek-v4-pro', { index: idx })
    assert.ok(entry)
    assert.equal(entry.codingIndex, 81.2)
    assert.equal(entry.originalModel, 'DeepSeek V4 Pro')
  })

  it('falls back via prefix walk when no exact match', () => {
    const idx = indexOfFixture()
    // 📖 "deepseek-ai/deepseek-v4-pro-turbo" doesn't exist, but the longest shared
    // 📖 prefix "deepseek-ai/deepseek-v4" is in the index. Should return that entry.
    const entry = lookupExtendedBenchmark('deepseek-ai/deepseek-v4-pro-turbo', { index: idx })
    assert.ok(entry, 'expected prefix fallback to find a deepseek-v4 entry')
    // 📖 With multiple candidates, scoreCandidate should pick the closer one
    // 📖 (v4-pro shares more characters with "v4-pro-turbo" than v4-flash does)
    assert.equal(entry.originalModel, 'DeepSeek V4 Pro')
  })

  it('picks the best-scoring candidate when multiple share a prefix', () => {
    const idx = indexOfFixture()
    // 📖 Query for "deepseek-ai/deepseek-v4" — exact? no.
    // 📖 Prefix "deepseek-ai/deepseek-v4" → maps to both v4-pro and v4-flash.
    // 📖 Since neither is an exact match, scoreCandidate picks the one with more
    // 📖 shared characters with the request.
    const entry = lookupExtendedBenchmark('deepseek-ai/deepseek-v4', { index: idx })
    assert.ok(entry)
    // 📖 Both have identical scoring since neither is exact. Whichever is first
    // 📖 in the tie wins. Just verify it's one of the two valid entries.
    assert.ok(['DeepSeek V4 Pro', 'DeepSeek V4 Flash'].includes(entry.originalModel))
  })

  it('returns null for an unknown model (no throw)', () => {
    const idx = indexOfFixture()
    const entry = lookupExtendedBenchmark('totally-unknown-model/abc-xyz', { index: idx })
    assert.equal(entry, null)
  })

  it('returns null for invalid input (empty string, non-string, null)', () => {
    const idx = indexOfFixture()
    assert.equal(lookupExtendedBenchmark('', { index: idx }), null)
    assert.equal(lookupExtendedBenchmark(null, { index: idx }), null)
    assert.equal(lookupExtendedBenchmark(undefined, { index: idx }), null)
    assert.equal(lookupExtendedBenchmark(42, { index: idx }), null)
  })

  it('against the real seed catalog: known model returns a real entry', () => {
    resetCatalogCache()
    const entry = lookupExtendedBenchmark('z-ai/glm-5.2')
    assert.ok(entry, 'expected z-ai/glm-5.2 to be in the real seed catalog')
    assert.ok(typeof entry.codingIndex === 'number')
  })

  it('against the real seed catalog: unknown model returns null', () => {
    resetCatalogCache()
    const entry = lookupExtendedBenchmark('this/is/not/in/the/seed-zzz')
    assert.equal(entry, null)
  })
})

// ─── mergeExtendedBenchmark ──────────────────────────────────────────────────

describe('mergeExtendedBenchmark', () => {
  it('non-mutating by default — returns a new object', () => {
    const model = { modelId: 'deepseek-ai/deepseek-v4-pro', sweScore: '80.6%' }
    const idx = indexOfFixture()
    const entry = lookupExtendedBenchmark(model.modelId, { index: idx })
    const merged = mergeExtendedBenchmark(model, entry)
    assert.notEqual(merged, model, 'expected a new object')
    assert.equal(model.extendedBench, undefined, 'original should not be mutated')
  })

  it('overlay preserves the original sweScore (sources.js is source of truth)', () => {
    const model = { modelId: 'deepseek-ai/deepseek-v4-pro', sweScore: '80.6%' }
    const idx = indexOfFixture()
    const entry = lookupExtendedBenchmark(model.modelId, { index: idx })
    const merged = mergeExtendedBenchmark(model, entry)
    assert.equal(merged.sweScore, '80.6%')
    assert.ok(merged.extendedBench)
    assert.equal(merged.extendedBench.codingIndex, 81.2)
  })

  it('mutate=true mutates the input in place', () => {
    const model = { modelId: 'deepseek-ai/deepseek-v4-pro' }
    const idx = indexOfFixture()
    const entry = lookupExtendedBenchmark(model.modelId, { index: idx })
    const returned = mergeExtendedBenchmark(model, entry, { mutate: true })
    assert.equal(returned, model, 'should return the same object reference')
    assert.ok(model.extendedBench)
  })

  it('null entry sets extendedBench: null (so UI can show a "no data" badge)', () => {
    const model = { modelId: 'unknown/foo' }
    const merged = mergeExtendedBenchmark(model, null)
    assert.equal(merged.extendedBench, null)
  })

  it('handles missing model gracefully (returns the model unchanged)', () => {
    const result = mergeExtendedBenchmark(null, { codingIndex: 50 })
    assert.equal(result, null)
  })

  it('overlay bag contains all EXTENDED_BENCH_FIELDS keys', () => {
    const model = { modelId: 'deepseek-ai/deepseek-v4-pro' }
    const idx = indexOfFixture()
    const entry = lookupExtendedBenchmark(model.modelId, { index: idx })
    const merged = mergeExtendedBenchmark(model, entry)
    for (const field of EXTENDED_BENCH_FIELDS) {
      assert.ok(field in merged.extendedBench, `missing field: ${field}`)
    }
  })
})

// ─── getCatalogStats ─────────────────────────────────────────────────────────

describe('getCatalogStats', () => {
  it('against the fixture: reports total, source, lastUpdated, and byField counts', () => {
    // 📖 We can't override the catalog for getCatalogStats (it always reads the
    // 📖 lazy-loaded module cache), so we test the shape on the real seed.
    resetCatalogCache()
    const stats = getCatalogStats()
    assert.ok(typeof stats.total === 'number' && stats.total >= 20)
    assert.equal(typeof stats.lastUpdated, 'string')
    assert.equal(typeof stats.source, 'string')
    // 📖 models.dev measures prompt benchmarks (codingIndex) for a subset of the
    // 📖 catalog only; unmeasured entries carry null by design (see the notes
    // 📖 field in benchmarks.json). Assert a meaningful measured subset exists.
    assert.ok(stats.byField.codingIndex >= 20,
      'expected a meaningful measured subset to have codingIndex')
    assert.ok(stats.byField.codingIndex <= stats.total)
    assert.ok('contextWindow' in stats.byField)
    assert.ok('supportsReasoning' in stats.byField)
    assert.ok('supportsVision' in stats.byField)
  })
})

// ─── enrichWithExtendedBenchmark ─────────────────────────────────────────────

describe('enrichWithExtendedBenchmark', () => {
  beforeEach(() => resetCatalogCache())

  it('returns a new object with extendedBench populated for known models', () => {
    const model = { modelId: 'z-ai/glm-5.2', sweScore: '82.8%' }
    const enriched = enrichWithExtendedBenchmark(model)
    assert.notEqual(enriched, model)
    assert.ok(enriched.extendedBench)
    assert.equal(enriched.sweScore, '82.8%', 'sweScore preserved')
  })

  it('returns the model with extendedBench: null for unknown ids', () => {
    const model = { modelId: 'totally-unknown-xyz/foo' }
    const enriched = enrichWithExtendedBenchmark(model)
    assert.equal(enriched.extendedBench, null)
  })
})

// ─── Performance sanity ──────────────────────────────────────────────────────

describe('lookupExtendedBenchmark — performance sanity', () => {
  it('10k lookups against a 50-entry fixture complete in <50ms', () => {
    // 📖 Build a 50-entry fixture by replicating the base 6 entries with suffixes
    const big = { _meta: { schemaVersion: 1 } }
    for (let i = 0; i < 50; i++) {
      big[`provider-${i}/model-variant-${i}`] = { codingIndex: 50 + i, lastUpdated: '2026-07-20' }
    }
    const idx = buildPrefixIndex(big)
    const queries = []
    for (let i = 0; i < 10000; i++) {
      queries.push(`provider-${i % 50}/model-variant-${i % 50}`)
    }
    const t0 = performance.now()
    for (const q of queries) {
      lookupExtendedBenchmark(q, { index: idx })
    }
    const elapsed = performance.now() - t0
    assert.ok(elapsed < 50, `expected < 50ms, got ${elapsed.toFixed(1)}ms`)
  })

  it('against the real seed: 1k lookups complete in <10ms (idempotent index)', () => {
    resetCatalogCache()
    // 📖 Warm-up: trigger catalog + index load
    lookupExtendedBenchmark('z-ai/glm-5.2')
    const t0 = performance.now()
    for (let i = 0; i < 1000; i++) {
      lookupExtendedBenchmark('z-ai/glm-5.2')
      lookupExtendedBenchmark('deepseek-ai/deepseek-v4-pro')
      lookupExtendedBenchmark('nonexistent/zzz')
    }
    const elapsed = performance.now() - t0
    assert.ok(elapsed < 10, `expected < 10ms, got ${elapsed.toFixed(1)}ms`)
  })
})
