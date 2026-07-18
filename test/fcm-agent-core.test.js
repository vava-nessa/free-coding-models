/**
 * @file test/fcm-agent-core.test.js
 * @description Unit tests for the shared fcm-agent-core package.
 *
 * @details
 *   Covers the pure logic extracted from the legacy Pi extension into the shared
 *   core: SWE parsing, composite scoring + ranking, context-window parsing and
 *   the agent safety floor, base-URL normalization, provider-ID prefixing, the
 *   Pi/OpenCode/router descriptor builders (incl. a no-API-key-leak check for
 *   OpenCode), and the namespaced cache store (write/read/clear, TTL, legacy
 *   fallback, and context-safety re-filtering on read).
 *
 * @see packages/fcm-agent-core/src/*.js — the modules under test
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  parseSweScore,
  computeCompositeScore,
  rankModels,
  formatModelLine,
  parseContextWindow,
  getMaxTokens,
  isContextUsable,
  getReasoningFlag,
  MIN_CONTEXT_WINDOW,
  DEFAULT_CONTEXT_WINDOW,
  normalizeBaseUrl,
  getProviderId,
  getOpenCodeEnvName,
  buildPiProviderDescriptor,
  buildOpenCodeProviderDescriptor,
  buildSmartRouterDescriptor,
  createCacheStore,
  DEFAULT_CACHE_TTL_MS,
} from '../packages/fcm-agent-core/src/index.js'

// ─── Ranker ──────────────────────────────────────────────────────────────────
describe('ranker: parseSweScore', () => {
  it('parses percentage strings', () => {
    assert.equal(parseSweScore('72.0%'), 72.0)
    assert.equal(parseSweScore('0%'), 0)
  })
  it('returns 0 for "-" / empty / garbage', () => {
    assert.equal(parseSweScore('-'), 0)
    assert.equal(parseSweScore(''), 0)
    assert.equal(parseSweScore('n/a'), 0)
  })
})

describe('ranker: computeCompositeScore', () => {
  it('scores in [0,1] and rewards high SWE + low latency', () => {
    const great = computeCompositeScore({ sweScore: '90%', latencyMs: 100, tps: 80, stabilityScore: 100 })
    const poor = computeCompositeScore({ sweScore: '20%', latencyMs: 5000, tps: 5, stabilityScore: 40 })
    assert.ok(great > poor)
    assert.ok(great > 0 && great <= 1)
    assert.ok(poor >= 0 && poor < 1)
  })
})

describe('ranker: rankModels', () => {
  it('drops non-up / unkeyed models and sorts by score desc', () => {
    const models = [
      { label: 'A', sweScore: '50%', latencyMs: 200, tps: 50, stabilityScore: 100, status: 'up', hasKey: true },
      { label: 'B', sweScore: '90%', latencyMs: 100, tps: 90, stabilityScore: 100, status: 'up', hasKey: true },
      { label: 'C', sweScore: '99%', latencyMs: 50, tps: 99, stabilityScore: 100, status: 'down', hasKey: true },
      { label: 'D', sweScore: '99%', latencyMs: 50, tps: 99, stabilityScore: 100, status: 'up', hasKey: false },
    ]
    const ranked = rankModels(models)
    assert.deepEqual(ranked.map(m => m.label), ['B', 'A'])
    assert.ok(ranked.every(m => typeof m.compositeScore === 'number'))
  })
})

describe('ranker: formatModelLine', () => {
  it('renders a plain-text line without ANSI', () => {
    const line = formatModelLine({ label: 'K2', tier: 'S', sweScore: '70%', latencyMs: 200, tps: 40, providerKey: 'kimi' }, 1)
    assert.match(line, /K2/)
    assert.match(line, /70% SWE/)
    assert.doesNotMatch(line, /\u001b\[/) // no ANSI escape codes from core
  })
})

// ─── Model config ────────────────────────────────────────────────────────────
describe('model-config: parseContextWindow', () => {
  it('parses k / M suffixes and raw numbers', () => {
    assert.equal(parseContextWindow('8k'), 8000)
    assert.equal(parseContextWindow('128k'), 128000)
    assert.equal(parseContextWindow('1M'), 1_000_000)
    assert.equal(parseContextWindow(200000), 200000)
  })
  it('falls back to default for invalid input', () => {
    assert.equal(parseContextWindow(''), DEFAULT_CONTEXT_WINDOW)
    assert.equal(parseContextWindow(null), DEFAULT_CONTEXT_WINDOW)
    assert.equal(parseContextWindow('abc'), DEFAULT_CONTEXT_WINDOW)
  })
})

describe('model-config: getMaxTokens', () => {
  it('caps to [512, 8192] as a quarter of context', () => {
    assert.equal(getMaxTokens(128000), 8192)   // 25% = 32000, capped at 8192
    assert.equal(getMaxTokens(8000), 2000)     // 25% of 8k
    assert.equal(getMaxTokens(1024), 512)      // below floor → 512
  })
})

describe('model-config: isContextUsable', () => {
  it('hides models below the agent context floor', () => {
    assert.equal(isContextUsable({ ctxWindow: '8k' }), false)
    assert.equal(isContextUsable({ ctxWindow: '128k' }), true)
    assert.equal(isContextUsable({ ctxWindow: `${MIN_CONTEXT_WINDOW}` }), true)
    assert.equal(isContextUsable({ ctxWindow: '15k' }), false) // 15000 < 16000 floor
  })
})

describe('model-config: getReasoningFlag', () => {
  it('is always false for FCM OpenAI-compatible providers', () => {
    assert.equal(getReasoningFlag(), false)
  })
})

// ─── Provider config builders ────────────────────────────────────────────────
describe('providers: normalizeBaseUrl', () => {
  it('strips /chat/completions, /completions, /responses', () => {
    assert.equal(normalizeBaseUrl('https://api.x.com/v1/chat/completions'), 'https://api.x.com/v1')
    assert.equal(normalizeBaseUrl('https://api.x.com/v1/completions'), 'https://api.x.com/v1')
    assert.equal(normalizeBaseUrl('https://api.x.com/v1/responses'), 'https://api.x.com/v1')
    assert.equal(normalizeBaseUrl('https://api.x.com/v1'), 'https://api.x.com/v1')
  })
})

describe('providers: getProviderId / getOpenCodeEnvName', () => {
  it('prefixes with fcm- unless already prefixed', () => {
    assert.equal(getProviderId('groq'), 'fcm-groq')
    assert.equal(getProviderId('fcm-groq'), 'fcm-groq')
    assert.equal(getProviderId({ providerKey: 'nvidia' }), 'fcm-nvidia')
  })
  it('builds a stable FCM_*_API_KEY env name', () => {
    assert.equal(getOpenCodeEnvName('groq'), 'FCM_GROQ_API_KEY')
    assert.equal(getOpenCodeEnvName('nvidia'), 'FCM_NVIDIA_API_KEY')
  })
})

describe('providers: buildPiProviderDescriptor', () => {
  it('returns the Pi provider + model shape shared by disk + runtime', () => {
    const d = buildPiProviderDescriptor({
      modelId: 'k2', label: 'Kimi K2', tier: 'S+', sweScore: '70%',
      ctxWindow: '128k', providerKey: 'kimi', providerName: 'Kimi',
      providerUrl: 'https://api.kimi.com/v1/chat/completions', apiKey: 'sk-secret'
    })
    assert.equal(d.providerId, 'fcm-kimi')
    assert.equal(d.provider.baseUrl, 'https://api.kimi.com/v1')
    assert.equal(d.provider.api, 'openai-completions')
    assert.equal(d.provider.apiKey, 'sk-secret')
    const m = d.provider.models[0]
    assert.equal(m.id, 'k2')
    assert.deepEqual(m.input, ['text']) // critical Pi boot guard
    assert.equal(m.reasoning, false)
    assert.equal(m.contextWindow, 128000)
    assert.deepEqual(Object.keys(m.cost).sort(), ['cacheRead', 'cacheWrite', 'input', 'output'])
  })
})

describe('providers: buildOpenCodeProviderDescriptor (no key leak)', () => {
  it('references the key via env placeholder, never inlines it', () => {
    const d = buildOpenCodeProviderDescriptor({
      modelId: 'k2', label: 'Kimi K2', tier: 'S+', sweScore: '70%',
      ctxWindow: '128k', providerKey: 'kimi', providerName: 'Kimi',
      providerUrl: 'https://api.kimi.com/v1/chat/completions', apiKey: 'sk-secret'
    })
    assert.equal(d.providerId, 'fcm-kimi')
    assert.equal(d.envName, 'FCM_KIMI_API_KEY')
    assert.equal(d.provider.options.apiKey, '{env:FCM_KIMI_API_KEY}')
    assert.equal(d.provider.options.baseURL, 'https://api.kimi.com/v1')
    assert.equal(d.modelRef, 'fcm-kimi/k2')
    // 📖 The real key must NEVER appear anywhere in the descriptor
    assert.ok(!JSON.stringify(d).includes('sk-secret'))
  })
})

describe('providers: buildSmartRouterDescriptor', () => {
  it('builds a Pi router and an OpenCode router', () => {
    const pi = buildSmartRouterDescriptor({ target: 'pi' })
    assert.equal(pi.providerId, 'fcm-router')
    assert.match(pi.provider.baseUrl, /localhost:19280\/v1/)
    assert.equal(pi.provider.models[0].id, 'fcm')

    const oc = buildSmartRouterDescriptor({ target: 'opencode' })
    assert.equal(oc.providerId, 'fcm-router')
    assert.equal(oc.provider.options.apiKey, 'fcm-local')
    assert.equal(oc.modelRef, 'fcm-router/fcm')
  })
})

// ─── Cache store ─────────────────────────────────────────────────────────────
describe('cache: createCacheStore', () => {
  let dir
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fcm-core-cache-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('round-trips a scan result and re-filters by context on read', () => {
    const store = createCacheStore({ filePath: join(dir, 'cache.json') })
    const ranked = [
      { label: 'big', ctxWindow: '128k', status: 'up', hasKey: true, sweScore: '70%' },
      { label: 'tiny', ctxWindow: '8k', status: 'up', hasKey: true, sweScore: '90%' },
    ]
    store.write({ source: 'direct', ranked })
    const read = store.read()
    assert.equal(read.ranked.length, 1) // 8k model filtered out by the safety floor
    assert.equal(read.ranked[0].label, 'big')
    assert.equal(read.bestModel.label, 'big')
  })

  it('returns null when missing or stale', () => {
    const store = createCacheStore({ filePath: join(dir, 'cache.json'), ttlMs: 10 })
    store.write({ source: 'direct', ranked: [{ label: 'x', ctxWindow: '128k', status: 'up', hasKey: true, sweScore: '50%' }] })
    return new Promise((resolve) => setTimeout(() => {
      assert.equal(store.read(), null) // expired past 10ms TTL
      resolve()
    }, 30))
  })

  it('falls back to a legacy path on read', () => {
    const primary = join(dir, 'new.json')
    const legacy = join(dir, 'legacy.json')
    const legacyStore = createCacheStore({ filePath: legacy })
    legacyStore.write({ source: 'daemon', ranked: [{ label: 'leg', ctxWindow: '128k', status: 'up', hasKey: true, sweScore: '50%' }] })
    const store = createCacheStore({ filePath: primary, legacyPaths: [legacy] })
    const read = store.read()
    assert.equal(read.source, 'daemon')
    assert.equal(read.bestModel.label, 'leg')
  })

  it('clear() removes the cache file', () => {
    const file = join(dir, 'cache.json')
    const store = createCacheStore({ filePath: file })
    store.write({ source: 'direct', ranked: [] })
    store.clear()
    assert.equal(store.read(), null)
  })

  it('exposes a sane default TTL constant', () => {
    assert.equal(DEFAULT_CACHE_TTL_MS, 10 * 60 * 1000)
  })
})
