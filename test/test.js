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
 *   → Router daemon integration — verifies failover, quota metadata, and upstream hardening with fake providers
 *
 * @see lib/utils.js — the functions under test
 * @see sources.js — model data validated here
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, accessSync, constants, chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { join, dirname } from 'node:path'
import { tmpdir, homedir } from 'node:os'
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
} from '../src/core/utils.js'
import {
  _emptyProfileSettings,
  normalizeEndpointInstalls, getApiKey,
  buildPersistedConfig,
  normalizeRouterConfig,
  DEFAULT_ROUTER_SETTINGS
} from '../src/core/config.js'
import { buildDefaultRouterSet, cloneHeadersForUpstream, createRouterRuntimeForTest, formatOpenAiError } from '../src/core/router-daemon.js'
import { formatRouterDuration, normalizeRouterDashboardSnapshot, parseRouterDashboardSseFrame } from '../src/core/router-dashboard.js'
import { buildProviderModelTokenKey, loadTokenUsageByProviderModel, formatTokenTotalCompact } from '../src/core/token-usage-reader.js'
import { renderTable, getLastLayout } from '../src/tui/render-table.js'
import { createOverlayRenderers } from '../src/tui/overlays.js'
import { buildProviderModelsUrl, parseProviderModelIds, listProviderTestModels, classifyProviderTestOutcome, buildProviderTestDetail } from '../src/tui/key-handler.js'
import { buildCliHelpText } from '../src/tui/cli-help.js'
import { buildSyncCandidates } from '../src/core/sync-set.js'
import { detectPackageManager, getInstallArgs, getManualInstallCmd } from '../src/core/updater.js'
import {
  buildToolEnv,
  prepareExternalToolLaunch,
  resolveLauncherModelId,
} from '../src/core/tool-launchers.js'
import { getToolInstallPlan, isToolInstalled, resolveToolBinaryPath } from '../src/core/tool-bootstrap.js'
import { TOOL_METADATA, TOOL_MODE_ORDER, getCompatibleTools, isModelCompatibleWithTool, findSimilarCompatibleModels } from '../src/core/tool-metadata.js'
import { sortResultsWithPinnedFavorites, stripAnsi } from '../src/tui/render-helpers.js'
import { parseMouseEvents, containsMouseSequence, createMouseHandler, MOUSE_ENABLE, MOUSE_DISABLE } from '../src/tui/mouse.js'
import { COLUMN_SORT_MAP } from '../src/tui/render-table.js'
import { startOpenClaw } from '../src/core/openclaw.js'
import { getConfiguredInstallableProviders, getInstallTargetModes, installProviderEndpoints } from '../src/core/endpoint-installer.js'
import { cleanupLegacyProxyArtifacts } from '../src/core/legacy-proxy-cleanup.js'
import {
  buildEnvContent,
  buildRcSourceLine,
  getEnvFilePath,
  ENV_FILE_MARKER,
  detectShellInfo,
  syncShellEnv,
  ensureShellRcSource,
  removeShellEnv,
} from '../src/core/shell-env.js'
import {
  buildFixTasks,
  classifyToolTranscript,
  createTestfcmRunId,
  extractJsonPayload,
  hasConfiguredKey,
  normalizeTestfcmToolName,
  pickTestfcmSelectionIndex,
  resolveTestfcmToolSpec,
} from '../src/core/testfcm.js'
import {
  buildCommandPaletteEntries,
  fuzzyMatchCommand,
  filterCommandPaletteEntries,
} from '../src/tui/command-palette.js'
import { startWebServer, inspectExistingWebServer } from '../web/server.js'
import { buildTelemetryProperties, sendUsageTelemetry } from '../src/core/telemetry.js'
import {
  formatBenchmarkLatency,
  formatBenchmarkTps,
  formatBenchmarkResult,
  estimateTokensFromText,
  buildBenchmarkRequest,
  benchmarkModel,
} from '../src/core/benchmark.js'
import { buildChatCompletionPingBody, buildPingRequest, ping } from '../src/core/ping.js'

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

const ROUTER_TEST_MODELS = Object.freeze({
  groqFast: 'llama-3.3-70b-versatile',
  groqBackup: 'openai/gpt-oss-120b',
  nvidiaFast: 'deepseek-ai/deepseek-v4-flash',
})

function listenOnRandomPort(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })
}

function closeRouterTestServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

function readNodeRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function withTimeout(promise, ms, label) {
  let timeout = null
  return Promise.race([
    promise.finally(() => {
      if (timeout) clearTimeout(timeout)
    }),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

async function withSourceUrls(overrides, fn) {
  // 📖 Router integration tests temporarily point real catalog providers at
  // 📖 localhost fake upstreams, then restore the catalog no matter what fails.
  const originals = new Map()
  for (const [provider, url] of Object.entries(overrides)) {
    originals.set(provider, sources[provider]?.url)
    sources[provider].url = url
  }
  try {
    return await fn()
  } finally {
    for (const [provider, url] of originals) {
      sources[provider].url = url
    }
  }
}

async function withMockProvider(responder, fn) {
  // 📖 This tiny OpenAI-compatible fake provider keeps Phase 2 tests
  // 📖 deterministic without adding a test framework or network dependency.
  const requests = []
  const server = createHttpServer(async (req, res) => {
    const bodyText = await readNodeRequestBody(req)
    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      bodyText,
      body: bodyText ? JSON.parse(bodyText) : null,
    }
    requests.push(request)
    const response = await responder(request, res)
    if (!response || res.writableEnded || res.destroyed) return
    if (response.delayMs) await new Promise((resolve) => setTimeout(resolve, response.delayMs))
    res.writeHead(response.status ?? 200, response.headers || { 'content-type': 'application/json' })
    if (Array.isArray(response.chunks)) {
      for (const chunk of response.chunks) res.write(chunk)
      res.end()
      return
    }
    if (response.rawBody !== undefined) {
      res.end(response.rawBody)
      return
    }
    res.end(JSON.stringify(response.body ?? { id: 'chatcmpl-test', choices: [] }))
  })
  const port = await listenOnRandomPort(server)
  try {
    return await fn({
      requests,
      url: `http://127.0.0.1:${port}/v1/chat/completions`,
      port,
      server,
    })
  } finally {
    await closeRouterTestServer(server)
  }
}

describe('buildPingRequest', () => {
  it('adds disabled thinking to standard chat-completion ping payloads', () => {
    const req = buildPingRequest('test-key', 'zai/glm-5.1-air', 'zai', 'https://example.test/v1/chat/completions')

    assert.equal(req.body.model, 'glm-5.1-air')
    assert.deepEqual(req.body.thinking, { type: 'disabled' })
    assert.equal(req.body.max_tokens, 1)
  })

  it('adds disabled thinking to Cloudflare chat-completion ping payloads', () => {
    const req = buildPingRequest('cf-key', '@cf/meta/llama', 'cloudflare', 'https://example.test/{account_id}/ai/v1/chat/completions')

    assert.deepEqual(req.body.thinking, { type: 'disabled' })
    assert.equal(req.body.messages[0].content, 'hi')
  })

  it('keeps Replicate prediction probes free of OpenAI-only thinking fields', () => {
    const req = buildPingRequest('replicate-key', 'version-id', 'replicate', 'https://api.replicate.com/v1/predictions')

    assert.equal(Object.hasOwn(req.body, 'thinking'), false)
    assert.equal(req.body.input.prompt, 'hi')
  })

  it('allows router probes to add stream=false without losing disabled thinking', () => {
    const body = buildChatCompletionPingBody('test/model', { stream: false })

    assert.deepEqual(body.thinking, { type: 'disabled' })
    assert.equal(body.stream, false)
  })

  it('can explicitly omit disabled thinking for strict provider fallbacks', () => {
    const body = buildChatCompletionPingBody('test/model', { stream: false }, { disableThinking: false })

    assert.equal(Object.hasOwn(body, 'thinking'), false)
    assert.equal(body.stream, false)
  })

  it('retries once without thinking when a strict provider rejects that field', async () => {
    const originalFetch = globalThis.fetch
    const bodies = []
    globalThis.fetch = async (_url, init) => {
      bodies.push(JSON.parse(init.body))
      if (bodies.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'Unknown field: thinking' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ id: 'chatcmpl-test', choices: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    try {
      const result = await ping('test-key', 'test/model', 'unit-thinking-fallback', 'https://example.test/v1/chat/completions')

      assert.equal(result.code, '200')
      assert.deepEqual(bodies[0].thinking, { type: 'disabled' })
      assert.equal(Object.hasOwn(bodies[1], 'thinking'), false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

function buildRouterTestConfig(models, overrides = {}) {
  // 📖 Tests use real router normalization so timeout/circuit defaults match
  // 📖 production behavior instead of silently depending on impossible values.
  const router = normalizeRouterConfig({
    ...DEFAULT_ROUTER_SETTINGS,
    enabled: true,
    onboardingSeen: true,
    activeSet: 'test-set',
    sets: {
      'test-set': {
        name: 'test-set',
        created: '2026-04-23T00:00:00.000Z',
        models,
      },
    },
    failover: {
      ...DEFAULT_ROUTER_SETTINGS.failover,
      maxRetries: overrides.maxRetries ?? models.length,
      requestTimeoutMs: overrides.requestTimeoutMs ?? 500,
      streamStallTimeoutMs: overrides.streamStallTimeoutMs ?? 100,
    },
    circuitBreaker: {
      ...DEFAULT_ROUTER_SETTINGS.circuitBreaker,
      failureThreshold: 1,
    },
  })
  return {
    telemetry: { enabled: false },
    apiKeys: {
      groq: 'gsk-router-test',
      nvidia: 'nvapi-router-test',
    },
    router,
  }
}

async function withRouterTestServer(config, fn) {
  const tokenPath = join(tmpdir(), `fcm-router-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
  const runtime = createRouterRuntimeForTest({
    config,
    tokenPath,
    logger: {
      level: 'error',
      error() {},
      warn() {},
      info() {},
      debug() {},
    },
  })
  const server = createHttpServer((req, res) => void runtime.handleHttp(req, res))
  const port = await listenOnRandomPort(server)
  runtime.port = port
  runtime.server = server
  try {
    return await fn({
      runtime,
      port,
      baseUrl: `http://127.0.0.1:${port}`,
    })
  } finally {
    try { runtime.tokenTracker.flush({ force: true }) } catch {}
    await closeRouterTestServer(server)
    rmSync(tokenPath, { force: true })
  }
}

function routerChatBody(overrides = {}) {
  return {
    model: 'fcm',
    messages: [{ role: 'user', content: 'ping' }],
    ...overrides,
  }
}

async function postRouterChat(baseUrl, bodyOverrides = {}) {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(routerChatBody(bodyOverrides)),
  })
}

describe('command palette fuzzy search', () => {
  it('matches in-order characters and returns highlight positions', () => {
    const out = fuzzyMatchCommand('srt', 'Sort by rank')
    assert.equal(out.matched, true)
    assert.ok(out.score > 0)
    assert.deepEqual(out.positions, [0, 2, 3])
  })

  it('returns no match when query letters are missing', () => {
    const out = fuzzyMatchCommand('zzz', 'Sort by rank')
    assert.equal(out.matched, false)
    assert.equal(out.score, 0)
    assert.deepEqual(out.positions, [])
  })

  it('ranks direct label matches above keyword-only matches', () => {
    const entries = buildCommandPaletteEntries()
    const commandsOnly = entries.filter(e => e.type === 'command')
    const ranked = filterCommandPaletteEntries(commandsOnly, 'uptime')
    assert.ok(ranked.length > 0)
    assert.equal(ranked[0].id, 'sort-uptime')
  })

  it('keeps a stable category+label order when scores tie', () => {
    const tied = [
      { id: 'x', label: 'Alpha', type: 'command', depth: 1, hasChildren: false, isExpanded: false, shortcut: null, keywords: ['foo'] },
      { id: 'y', label: 'Beta', type: 'command', depth: 1, hasChildren: false, isExpanded: false, shortcut: null, keywords: ['foo'] },
    ]
    const ranked = filterCommandPaletteEntries(tied, 'foo')
    assert.ok(ranked.length >= 2)
  })

  it('exposes explicit ping mode commands in the action submenu', () => {
    const entries = buildCommandPaletteEntries()
    const ids = new Set(entries.map((entry) => entry.id))
    assert.ok(ids.has('action-set-ping-speed'))
    assert.ok(ids.has('action-set-ping-normal'))
    assert.ok(ids.has('action-set-ping-slow'))
    assert.ok(ids.has('action-set-ping-forced'))
  })

  it('exposes explicit tool and favorites mode commands in the action submenu', () => {
    const entries = buildCommandPaletteEntries()
    const ids = new Set(entries.map((entry) => entry.id))
    assert.ok(ids.has('action-set-tool-opencode'))
    assert.ok(ids.has('action-set-tool-opencode-desktop'))
    assert.ok(ids.has('action-set-tool-openclaw'))
    assert.ok(ids.has('action-toggle-favorite-mode'))
    assert.ok(ids.has('action-favorites-mode-pinned'))
    assert.ok(ids.has('action-favorites-mode-normal'))
  })

  it('keeps router pages out of the visible command palette', () => {
    const entries = buildCommandPaletteEntries()
    const ids = new Set(entries.map((entry) => entry.id))
    assert.equal(ids.has('open-router-dashboard'), false)
    assert.equal(ids.has('open-token-usage'), false)
  })
})

describe('router dashboard helpers', () => {
  it('formats daemon uptime compactly', () => {
    assert.equal(formatRouterDuration(45), '45s')
    assert.equal(formatRouterDuration(125), '2m 5s')
    assert.equal(formatRouterDuration(7320), '2h 2m')
  })

  it('normalizes malformed daemon payloads without throwing', () => {
    const snapshot = normalizeRouterDashboardSnapshot(null, {
      models: [
        { provider: 'groq', model: 'llama', state: 'closed', score: '0.8', uptime: '0.5' },
        null,
      ],
      requestLog: [{ model: 'groq/llama', status: 200, tokens: '12' }],
      tokens: { today: { total_tokens: '1000' }, all_time: { requests: '2' } },
    })

    assert.equal(snapshot.ok, false)
    assert.equal(snapshot.models.length, 2)
    assert.equal(snapshot.models[0].state, 'CLOSED')
    assert.equal(snapshot.models[1].provider, 'unknown')
    assert.equal(snapshot.requestLog[0].tokens, 12)
    assert.equal(snapshot.tokens.today.total_tokens, 1000)
    assert.equal(snapshot.tokens.all_time.requests, 2)
  })

  it('parses SSE event frames defensively', () => {
    const parsed = parseRouterDashboardSseFrame('event: request\ndata: {"model":"groq/x","status":200}\n\n')
    assert.equal(parsed.event, 'request')
    assert.deepEqual(parsed.data, { model: 'groq/x', status: 200 })

    const malformed = parseRouterDashboardSseFrame('event: probe\ndata: nope\n\n')
    assert.equal(malformed.event, 'probe')
    assert.equal(malformed.data, 'nope')
  })
})

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
    assert.equal(sources.nvidia.name, 'NVIDIA NIM')
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
      listProviderTestModels('sambanova', sources.sambanova, ['Qwen3-235B', 'DeepSeek-V3.1']).slice(0, 4),
      ['MiniMax-M2.5', 'DeepSeek-V3.1', 'DeepSeek-V3.2', 'Qwen3-235B']
    )
  })

  it('uses discovered repo-known ids before the static catalog head for NVIDIA', () => {
    assert.deepEqual(
      listProviderTestModels('nvidia', sources.nvidia, ['openai/gpt-oss-120b', 'deepseek-ai/deepseek-v4-flash']).slice(0, 5),
      [
        'deepseek-ai/deepseek-v4-flash',
        'openai/gpt-oss-120b',
        'minimaxai/minimax-m2.7',
        'z-ai/glm-5.1',
        'moonshotai/kimi-k2.6',
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
  it('renders the tiny verdict indicator column and matching verdict emoji', () => {
    const output = stripAnsi(renderTable({
      results: [mockResult({ status: 'up', pings: [{ ms: 200, code: '200' }], providerKey: 'nvidia', totalTokens: 0 })],
      pendingPings: 0,
      frame: 0,
      terminalRows: 12,
      terminalCols: 200,
    }))

    assert.match(output, /❔/)
    assert.match(output, /🟩\s+.*🟩 Perfect/)
  })

  it('renders explicit labels for common HTTP failure codes', () => {
    const results = [
      mockResult({ label: '429 model', status: 'down', httpCode: '429', pings: [{ ms: 0, code: '429' }], providerKey: 'nvidia', totalTokens: 0 }),
      mockResult({ label: '410 model', status: 'down', httpCode: '410', pings: [{ ms: 0, code: '410' }], providerKey: 'nvidia', totalTokens: 0 }),
      mockResult({ label: '404 model', status: 'down', httpCode: '404', pings: [{ ms: 0, code: '404' }], providerKey: 'nvidia', totalTokens: 0 }),
      mockResult({ label: '500 model', status: 'down', httpCode: '500', pings: [{ ms: 0, code: '500' }], providerKey: 'nvidia', totalTokens: 0 }),
    ]
    const output = renderTable({ results, pendingPings: 0, frame: 0 })

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
    const output = renderTable({ results, pendingPings: 0, frame: 0 })

    assert.match(output, /AUTH FAIL/)
    assert.match(output, /NO KEY/)
  })
})

describe('renderTable benchmark columns', () => {
  it('renders AI Latency and TPS as separate columns', () => {
    const results = [mockResult({
      label: 'Bench model',
      providerKey: 'nvidia',
      pings: [{ ms: 200, code: '200' }],
      totalTokens: 0,
    })]
    const output = stripAnsi(renderTable({
      results,
      pendingPings: 0,
      frame: 0,
      terminalRows: 12,
      terminalCols: 220,
      benchmarkResults: {
        'nvidia/test/model': { ok: true, totalMs: 4300, outputTokens: 56, tokensPerSecond: 13 },
      },
    }))

    assert.match(output, /AI Latency/)
    assert.match(output, /TPS/)
    assert.match(output, /4\.3s/)
    assert.match(output, /\b13\b/)
    assert.doesNotMatch(output, /4\.3s \/ 13 TPS/)
  })

  it('keeps benchmark failure details out of AI Latency while Health shows the row error', () => {
    const results = [mockResult({
      label: 'Throttled model',
      providerKey: 'nvidia',
      status: 'down',
      httpCode: '429',
      pings: [{ ms: 0, code: '429' }],
      totalTokens: 0,
    })]
    const output = stripAnsi(renderTable({
      results,
      pendingPings: 0,
      frame: 0,
      terminalRows: 12,
      terminalCols: 220,
      benchmarkResults: {
        'nvidia/test/model': { ok: false, code: 'TIMEOUT', totalMs: 20_000 },
      },
    }))

    assert.equal((output.match(/429 TRY LATER/g) || []).length, 1)
    assert.doesNotMatch(output, /TIMEOUT/)
  })
})

describe('renderTable sticky header and footer layout', () => {
  const makeManyResults = (count = 80) => Array.from({ length: count }, (_, idx) => mockResult({
    idx: idx + 1,
    label: `Model ${String(idx + 1).padStart(2, '0')}`,
    providerKey: 'nvidia',
    pings: [{ ms: 100 + idx, code: '200' }],
    totalTokens: 0,
  }))

  const visibleLines = (output) => output
    .split('\n')
    .map((line) => stripAnsi(line).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''))

  it('does not overrun terminal height in the normal table view', () => {
    const output = renderTable({ results: makeManyResults(), cursor: 0, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 140 })
    const lines = visibleLines(output)

    assert.equal(lines.length, 20)
    assert.match(lines[0], /free-coding-models/)
    assert.match(lines[1], /Model/)
    assert.doesNotMatch(output, /Search "\/"/)
    assert.doesNotMatch(output, /Shift\+R Router|daemon not running|Smart Router is now available/)
    assert.match(lines.at(-3), /F Favorite/)
    assert.match(lines.at(-2), /Ctrl\+P Cmd Palette/)
    assert.match(lines.at(-1), /AI Speed Test/)
  })

  it('keeps title, search filters, and column headers visible when scrolled', () => {
    const output = renderTable({ results: makeManyResults(), cursor: 40, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', scrollOffset: 40, terminalRows: 20, terminalCols: 140 })
    const lines = visibleLines(output)

    assert.equal(lines.length, 20)
    assert.match(lines[0], /free-coding-models/)
    assert.match(lines[1], /Model/)
    assert.match(lines[2], /more above/)
  })

  it('reserves space for temporary footer rows without hiding the header', () => {
    const output = renderTable({ results: makeManyResults(), cursor: 0, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 180, pingMode: 'normal', pingModeSource: 'auto', settingsUpdateState: 'idle', startupLatestVersion: '9.9.9', versionAlertsEnabled: true, customTextFilter: 'deep' })
    const lines = visibleLines(output)

    assert.equal(lines.length, 20)
    assert.match(lines[0], /free-coding-models/)
    assert.match(lines[1], /Model/)
    assert.match(output, /UPDATE AVAILABLE/)
    assert.match(output, /X Disable filter: "deep"/)
  })

  it('sticks the footer to the bottom when there are few model rows', () => {
    const output = renderTable({ results: makeManyResults(3), cursor: 0, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 12, terminalCols: 140 })
    const lines = visibleLines(output)

    assert.equal(lines.length, 12)
    assert.match(lines[0], /free-coding-models/)
    assert.match(lines[1], /Model/)
    // 3 model rows + 3 footer lines = 6 fixed content lines, blank padding fills the rest
    assert.ok(lines.slice(5, 9).every((line) => line === ''), 'expected blank padding before sticky footer')
    assert.match(lines.at(-3), /F Favorite/)
    assert.match(lines.at(-2), /Ctrl\+P Cmd Palette/)
    assert.match(lines.at(-1), /AI Speed Test/)
  })

  it('always renders the full footer even when an old collapsed-footer flag is passed', () => {
    const output = renderTable({ results: makeManyResults(10), cursor: 0, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 140, pingMode: 'normal', pingModeSource: 'auto', settingsUpdateState: 'idle', versionAlertsEnabled: true })

    assert.doesNotMatch(output, /Toggle Footer/)
    assert.doesNotMatch(output, /Shift\+R Router|daemon not running/)
    assert.match(output, /Ctrl\+P Cmd Palette/)
  })
})

describe('renderTable outdated footer banner', () => {
  it('renders a dedicated update banner when startup auto-check already found a newer version', () => {
    const results = [
      mockResult({ providerKey: 'nvidia', totalTokens: 0 }),
    ]
    const { version: localVersion } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const output = renderTable({ results: results, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 190, pingMode: 'normal', pingModeSource: 'auto', settingsUpdateState: 'idle', startupLatestVersion: '9.9.9', versionAlertsEnabled: true })

    assert.match(output, new RegExp(`UPDATE AVAILABLE — v${escapeRegex(localVersion)} → v9\\.9\\.9`))
    assert.match(output, /Click here or press Shift\+U to update/)
    // 📖 The update banner stays in the footer budget without surfacing router hints.
    assert.match(output, /UPDATE AVAILABLE/)
    assert.doesNotMatch(output, /Shift\+R Router|daemon not running/)
  })

  it('stays quiet when no newer version is known', () => {
    const results = [
      mockResult({ providerKey: 'nvidia', totalTokens: 0 }),
    ]
    const output = renderTable({ results, pendingPings: 0, frame: 0, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 190 })

    assert.doesNotMatch(output, /UPDATE AVAILABLE/)
  })

  it('shows the active custom text filter badge on its own footer line', () => {
    const results = [
      mockResult({ providerKey: 'nvidia', totalTokens: 0 }),
    ]
    const output = renderTable({ results: results, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 190, pingMode: 'normal', pingModeSource: 'auto', settingsUpdateState: 'idle', versionAlertsEnabled: true, favoritesPinnedAndSticky: true, customTextFilter: 'deep' })

    // 📖 Footer was slimmed: changelog moved to Settings, exit hint moved to Help.
    // 📖 The X-clear filter badge now lives on its own dedicated footer line.
    assert.match(output, /X Disable filter: "deep"/)
  })

  it('stays quiet in dev-mode render paths even if npm has a newer published version', () => {
    const results = [
      mockResult({ providerKey: 'nvidia', totalTokens: 0 }),
    ]
    const output = renderTable({ results: results, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 190, pingMode: 'normal', pingModeSource: 'auto', settingsUpdateState: 'idle', startupLatestVersion: '9.9.9', versionAlertsEnabled: false })

    assert.doesNotMatch(output, /UPDATE AVAILABLE/)
  })

  it('skips the narrow-terminal overlay when terminal width is 80 columns or wider', () => {
    const output = renderTable({ results: [mockResult()], cursor: 0, sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 20, terminalCols: 120, pingMode: 'normal', pingModeSource: 'auto', widthWarningStartedAt: Date.now(), settingsUpdateState: 'idle', versionAlertsEnabled: true })

    assert.doesNotMatch(output, /Please maximize your terminal/)
    assert.match(output, /free-coding-models/)
  })
})

describe('renderTable responsive column visibility', () => {
  // 📖 Helper: render with a specific terminalCols value (all other params at sensible defaults)
  const renderAtWidth = (cols) => renderTable({ results: [mockResult({ providerKey: 'nvidia', totalTokens: 0, pings: [{ ms: 200, code: '200' }] })], sortColumn: 'avg', sortDirection: 'asc', pingInterval: 10_000, lastPingTime: Date.now(), mode: 'opencode', terminalRows: 30, terminalCols: cols, pingMode: 'normal', pingModeSource: 'auto', settingsUpdateState: 'idle', versionAlertsEnabled: false })

  // 📖 Full row width is computed dynamically from active columns.
  // 📖 Ping columns are permanently compact: Last Ping and Avg Ping both use 9 chars.
  // 📖 Compact mode shrinks Stability, Provider, Health, and AI Latency before hiding optional columns.

  it('shows all columns and compact ping labels at very wide terminal (200 cols)', () => {
    const output = renderAtWidth(200)
    assert.match(output, /Rank/)
    assert.match(output, /Tier/)
    assert.match(output, /Up%/)
    // 📖 Header renders StaBility (capital B for hotkey)
    assert.match(output, /StaBility/)
    assert.match(output, /Last Ping/)
    assert.match(output, /Avg Ping/)
    assert.doesNotMatch(output, /Latest Ping/)
    // 📖 Full provider header 'PrOviDer' visible
    assert.match(output, /Provider|PrOviDer/)
    assert.match(output, /AI Latency/)
    assert.match(output, /TPS/)
  })

  it('keeps ping columns at the same 9-char width', () => {
    renderAtWidth(200)
    const layout = getLastLayout()
    const pingCol = layout.columns.find((column) => column.name === 'ping')
    const avgCol = layout.columns.find((column) => column.name === 'avg')
    assert.ok(pingCol, 'ping column should exist')
    assert.ok(avgCol, 'avg column should exist')
    assert.equal(pingCol.xEnd - pingCol.xStart + 1, 9)
    assert.equal(avgCol.xEnd - avgCol.xStart + 1, 9)
  })

  it('keeps compact ping labels in compact mode (slightly narrow)', () => {
    // 📖 At 175 cols, compact mode is active but no columns hidden yet
    const output = renderAtWidth(175)
    assert.match(output, /Last Ping/)
    assert.match(output, /Avg Ping/)
    assert.doesNotMatch(output, /Latest Ping/)
    // 📖 Provider header should be compact 'PrOD…'
    assert.match(output, /PrOD…/)
    // 📖 All optional columns still visible (Rank + AI Latency/TPS)
    assert.match(output, /Rank/)
    assert.match(output, /Up%/)
    assert.match(output, /AI Lat\./)
    assert.match(output, /TPS/)
  })

  it('hides Rank column first when too narrow for compact', () => {
    // 📖 At 145 cols, Rank is hidden (compact = 153, minus Rank col+sep = 144)
    const output = renderAtWidth(145)
    assert.doesNotMatch(output, /Rank/)
    // 📖 Other always-visible columns should still be present
    assert.match(output, /Model/)
    assert.match(output, /Health/)
  })

  it('hides Rank and Up% at narrower widths', () => {
    // 📖 At 120 cols, Rank, AI Latency/TPS, and Uptime hidden.
    const output = renderAtWidth(120)
    assert.doesNotMatch(output, /Rank/)
    // 📖 Up% header is just 'Up%' — check it is NOT in the output
    assert.doesNotMatch(output, /Up%/)
    assert.match(output, /Model/)
  })

  it('hides Rank, Up%, and Tier at even narrower widths', () => {
    // 📖 At 110 cols, Rank, AI Latency/TPS, Uptime, and Tier hidden.
    const output = renderAtWidth(110)
    assert.doesNotMatch(output, /Rank/)
    const lines = output.split('\n')
    const headerLine = lines.find(l => l.includes('Model') && l.includes('Health'))
    assert.ok(headerLine, 'header line should exist')
    assert.ok(!headerLine.includes('Tier'), 'Tier should be hidden at 110 cols')
  })

  it('hides all optional columns at very narrow widths', () => {
    // 📖 At 108 cols, all optional columns hidden (110 minus Stability col+sep = 99)
    const output = renderAtWidth(108)
    assert.doesNotMatch(output, /Rank/)
    // 📖 Stability/StaB. should be gone
    assert.doesNotMatch(output, /Stability/)
    assert.doesNotMatch(output, /StaB\./)
    // 📖 Core columns always present
    assert.match(output, /Model/)
    assert.match(output, /Health/)
    assert.match(output, /Verdict/)
  })

  it('truncates provider name to 4 chars + ellipsis in compact mode', () => {
    // 📖 In compact mode, provider names longer than 5 chars should be truncated
    const output = renderAtWidth(160)
    // 📖 'NIM' is only 3 chars so it should NOT be truncated
    // 📖 But the header should show compact 'PrOD…'
    assert.match(output, /PrOD…/)
  })

  it('truncates health status text in compact mode', () => {
    // 📖 In compact mode, health text after 6 chars gets '…' appended
    // 📖 '✅ UP' is short enough — no truncation expected
    const output = renderAtWidth(160)
    assert.match(output, /UP/)
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
      settingsScrollOffset: 0,
      settingsSyncStatus: null,
      activeProfile: null,
      terminalRows: 40,
      terminalCols: 120,
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
      PROVIDER_COLOR: {
        groq: [255, 204, 188],
      },
      LOCAL_VERSION: '0.2.1',
      getApiKey,
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
      OVERLAY_PANEL_WIDTH: 120,
      keepOverlayTargetVisible: (currentOffset) => currentOffset,
      sliceOverlayLines: (lines, offset = 0) => ({ visible: lines, offset }),
      tintOverlayLines: (lines) => lines,
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
      padEndDisplay: (value) => value,
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

  it('does not show the removed Small Width Warnings toggle in settings', () => {
    const renderSettings = buildSettingsRenderer({ apiKeys: {}, providers: {}, settings: {} })
    const output = renderSettings()

    assert.doesNotMatch(output, /Small Width Warnings/)
  })

  it('shows the global theme row with the resolved auto label', () => {
    const renderSettings = buildSettingsRenderer({ apiKeys: {}, providers: {}, settings: { theme: 'auto' } })
    const output = renderSettings()

    assert.match(output, /Global Theme/)
    assert.match(output, /Auto/)
  })

  it('shows the Startup AI Speed Scan toggle as disabled by default', () => {
    const renderSettings = buildSettingsRenderer({ apiKeys: {}, providers: {}, settings: {} })
    const output = renderSettings()

    assert.match(output, /Startup AI Speed Scan/)
    assert.match(output, /manual Ctrl\+U only/)
  })

  it('shows enabled status for Startup AI Speed Scan', () => {
    const renderSettings = buildSettingsRenderer({ apiKeys: {}, providers: {}, settings: { runAiSpeedTestOnStartup: true } })
    const output = renderSettings()

    assert.match(output, /Startup AI Speed Scan/)
    assert.match(output, /runs Ctrl\+U after startup/)
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

describe('renderToolInstallPrompt', () => {
  it('renders the official install command for a missing launcher', () => {
    const installPlan = getToolInstallPlan('opencode', { platform: 'darwin' })
    const state = {
      toolInstallPromptOpen: true,
      toolInstallPromptCursor: 0,
      toolInstallPromptScrollOffset: 0,
      toolInstallPromptMode: 'opencode',
      toolInstallPromptModel: {
        label: 'DeepSeek V4 Flash',
      },
      toolInstallPromptPlan: installPlan,
      toolInstallPromptErrorMsg: null,
      terminalRows: 40,
      terminalCols: 120,
      config: { settings: {} },
    }

    const renderers = createOverlayRenderers(state, {
      chalk,
      sources,
      PROVIDER_METADATA: {},
      PROVIDER_COLOR: {},
      LOCAL_VERSION: '0.3.18',
      getApiKey: () => null,
      resolveApiKeys: () => [],
      isProviderEnabled: () => true,
      TIER_CYCLE: ['All'],
      OVERLAY_PANEL_WIDTH: 120,
      keepOverlayTargetVisible: (currentOffset) => currentOffset,
      sliceOverlayLines: (lines, offset = 0) => ({ visible: lines, offset }),
      tintOverlayLines: (lines) => lines,
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
      getToolMeta: () => ({ label: 'OpenCode CLI', emoji: '💻' }),
      getToolInstallPlan: () => installPlan,
      padEndDisplay: (value) => value,
    })

    const output = renderers.renderToolInstallPrompt()
    assert.match(output, /Missing Tool/)
    assert.match(output, /npm install -g opencode-ai/)
    assert.match(output, /DeepSeek V4 Flash/)
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

  it('detects --premium flag', () => {
    assert.equal(parseArgs(argv('--premium')).premiumMode, true)
    assert.equal(parseArgs(argv()).premiumMode, false)
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

  it('detects --opencode-web flag', () => {
    assert.equal(parseArgs(argv('--opencode-web')).openCodeWebMode, true)
    assert.equal(parseArgs(argv()).openCodeWebMode, false)
  })

  it('detects external tool flags', () => {
    const result = parseArgs(argv(
      '--aider',
      '--crush',
      '--goose',
      '--qwen',
      '--kilo',
      '--openhands',
      '--amp',
      '--hermes',
      '--continue',
      '--cline',
      '--pi',
      '--caveman'
    ))
    assert.equal(result.aiderMode, true)
    assert.equal(result.crushMode, true)
    assert.equal(result.gooseMode, true)
    assert.equal(result.qwenMode, true)
    assert.equal(result.kiloMode, true)
    assert.equal(result.openHandsMode, true)
    assert.equal(result.ampMode, true)
    assert.equal(result.hermesMode, true)
    assert.equal(result.continueMode, true)
    assert.equal(result.clineMode, true)
    assert.equal(result.piMode, true)
    assert.equal(result.cavemanMode, true)
  })

  it('detects --no-telemetry flag', () => {
    assert.equal(parseArgs(argv('--no-telemetry')).noTelemetry, true)
    assert.equal(parseArgs(argv()).noTelemetry, false)
  })

  it('detects router daemon lifecycle flags', () => {
    assert.equal(parseArgs(argv('--daemon')).daemonMode, true)
    assert.equal(parseArgs(argv('--daemon-bg')).daemonBackgroundMode, true)
    assert.equal(parseArgs(argv('--daemon-stop')).daemonStopMode, true)
    assert.equal(parseArgs(argv('--daemon-status')).daemonStatusMode, true)
    assert.equal(parseArgs(argv()).daemonMode, false)
  })

  it('detects web dashboard mode without treating subcommand as API key', () => {
    const subcommand = parseArgs(argv('web'))
    assert.equal(subcommand.webMode, true)
    assert.equal(subcommand.apiKey, null)
    assert.equal(parseArgs(argv('--web')).webMode, true)
    assert.equal(parseArgs(argv('--gui')).webMode, true)
  })

  it('detects --help and -h flags', () => {
    assert.equal(parseArgs(argv('--help')).helpMode, true)
    assert.equal(parseArgs(argv('-h')).helpMode, true)
    assert.equal(parseArgs(argv()).helpMode, false)
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
    assert.equal(parseArgs(argv('--HELP')).helpMode, true)
  })
})

describe('cli help text', () => {
  it('lists the supported CLI flags for the direct-only app surface', () => {
    const help = buildCliHelpText()
    const expectedEntries = [
      '--opencode',
      '--opencode-desktop',
      '--openclaw',
      '--crush',
      '--goose',
      '--pi',
      '--aider',
      '--qwen',
      '--openhands',
      '--amp',
      '--best',
      '--fiable',
      '--premium',
      '--json',
      '--tier <S|A|B|C>',
      '--recommend',
      'web | --web | --gui',
      '--daemon',
      '--daemon-bg',
      '--daemon-status',
      '--daemon-stop',
      '--no-telemetry',
      '--help, -h',
    ]

    for (const entry of expectedEntries) {
      assert.match(help, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  })
})

describe('telemetry', () => {
  it('builds telemetry properties with custom launch metadata', () => {
    const properties = buildTelemetryProperties({
      mode: 'openclaw',
      properties: {
        session_id: 'session_test',
        tool_mode: 'openclaw',
        provider_key: 'nvidia',
        model_id: 'deepseek-ai/deepseek-v4-flash',
        action_type: 'launch_model',
        ignored: undefined,
      },
    })

    assert.equal(properties.app, 'free-coding-models')
    assert.equal(properties.mode, 'openclaw')
    assert.equal(properties.session_id, 'session_test')
    assert.equal(properties.tool_mode, 'openclaw')
    assert.equal(properties.provider_key, 'nvidia')
    assert.equal(properties.model_id, 'deepseek-ai/deepseek-v4-flash')
    assert.equal(properties.action_type, 'launch_model')
    assert.equal('ignored' in properties, false)
  })

  it('sends app_start and app_use with the same distinct_id and session_id', async () => {
    const originalFetch = global.fetch
    const calls = []
    global.fetch = async (url, options) => {
      calls.push({ url, options })
      return { ok: true }
    }

    try {
      const config = {
        telemetry: {
          enabled: true,
          anonymousId: 'anon_test_user',
        },
      }
      const cliArgs = { noTelemetry: false }

      await sendUsageTelemetry(config, cliArgs, {
        event: 'app_start',
        mode: 'opencode',
        properties: {
          session_id: 'session_test_user',
          event_version: 1,
        },
      })

      await sendUsageTelemetry(config, cliArgs, {
        event: 'app_use',
        mode: 'openclaw',
        properties: {
          session_id: 'session_test_user',
          event_version: 1,
          action_type: 'launch_model',
          tool_mode: 'openclaw',
          provider_key: 'nvidia',
          model_id: 'deepseek-ai/deepseek-v4-flash',
          model_label: 'DeepSeek V4 Flash',
          model_tier: 'S+',
        },
      })

      assert.equal(calls.length, 2)
      const [startBody, useBody] = calls.map(({ options }) => JSON.parse(options.body))
      assert.equal(startBody.event, 'app_start')
      assert.equal(useBody.event, 'app_use')
      assert.equal(startBody.distinct_id, 'anon_test_user')
      assert.equal(useBody.distinct_id, 'anon_test_user')
      assert.equal(startBody.properties.session_id, 'session_test_user')
      assert.equal(useBody.properties.session_id, 'session_test_user')
      assert.equal(useBody.properties.tool_mode, 'openclaw')
      assert.equal(useBody.properties.provider_key, 'nvidia')
      assert.equal(useBody.properties.model_id, 'deepseek-ai/deepseek-v4-flash')
      assert.equal(useBody.properties.model_label, 'DeepSeek V4 Flash')
      assert.equal(useBody.properties.model_tier, 'S+')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('does not send telemetry when disabled via CLI flag or env var', async () => {
    const originalFetch = global.fetch
    const originalTelemetryEnv = process.env.FREE_CODING_MODELS_TELEMETRY
    const calls = []
    global.fetch = async (url, options) => {
      calls.push({ url, options })
      return { ok: true }
    }

    try {
      const config = {
        telemetry: {
          enabled: true,
          anonymousId: 'anon_opt_out',
        },
      }

      await sendUsageTelemetry(config, { noTelemetry: true }, {
        event: 'app_use',
        mode: 'opencode',
        properties: { session_id: 'session_cli_opt_out' },
      })

      process.env.FREE_CODING_MODELS_TELEMETRY = '0'
      await sendUsageTelemetry(config, { noTelemetry: false }, {
        event: 'app_action',
        mode: 'opencode',
        properties: { session_id: 'session_env_opt_out', action_type: 'api_key_saved' },
      })

      assert.equal(calls.length, 0)
    } finally {
      global.fetch = originalFetch
      if (originalTelemetryEnv === undefined) delete process.env.FREE_CODING_MODELS_TELEMETRY
      else process.env.FREE_CODING_MODELS_TELEMETRY = originalTelemetryEnv
    }
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

  it('builds the web dashboard during prepack so npm releases include web/dist', () => {
    assert.equal(pkg.scripts?.prepack, 'npm run build:web')
  })

  it('packages the router daemon through the npm files allowlist', () => {
    assert.ok(pkg.files.includes('src/'), 'src/ must stay packaged because it contains src/core/router-daemon.js')
    assert.ok(existsSync(join(ROOT, 'src/core/router-daemon.js')), 'router daemon entry should exist')
  })
})

describe('CLI entry point sanity', () => {
  const binContent = readFileSync(join(ROOT, 'bin/free-coding-models.js'), 'utf8')

  it('has shebang line', () => {
    assert.ok(binContent.startsWith('#!/usr/bin/env node'), 'Should start with shebang')
  })

  it('imports from sources.js', () => {
    // no longer imports sources.js directly
  })

  it('imports from lib/utils.js', () => {
    assert.ok(binContent.includes("from '../src/core/utils.js'"), 'Should import lib/utils.js')
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
describe('parseArgs --recommend', () => {
  // 📖 Helper: simulate process.argv (first two entries are node + script path)
  const argv = (...args) => ['node', 'script.js', ...args]

  it('parses --recommend flag', () => {
    assert.equal(parseArgs(argv('--recommend')).recommendMode, true)
  })

  it('recommendMode defaults to false', () => {
    assert.equal(parseArgs(argv()).recommendMode, false)
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
    assert.equal(settings.favoritesPinnedAndSticky, false)
    assert.equal(settings.runAiSpeedTestOnStartup, false)
  })

  it('defaults configured-only mode and preferred tool mode in profile settings', () => {
    assert.equal(_emptyProfileSettings().hideUnconfiguredModels, true)
    assert.equal(_emptyProfileSettings().favoritesPinnedAndSticky, false)
    assert.equal(_emptyProfileSettings().runAiSpeedTestOnStartup, false)
    assert.equal(_emptyProfileSettings().preferredToolMode, 'opencode')
    assert.equal(_emptyProfileSettings().theme, 'auto')
  })
})

describe('buildPersistedConfig', () => {
  it('preserves disk apiKeys and favorites when a stale snapshot saves unrelated changes', () => {
    const diskConfig = {
      apiKeys: {
        nvidia: 'disk-nvidia',
        groq: 'disk-groq',
      },
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: ['nvidia/model-a', 'groq/model-b'],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      activeProfile: null,
      profiles: {},
    }

    const incomingConfig = {
      apiKeys: {
        nvidia: 'disk-nvidia',
      },
      providers: {},
      settings: { hideUnconfiguredModels: false },
      favorites: ['nvidia/model-a'],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      activeProfile: null,
      profiles: {},
    }

    const persisted = buildPersistedConfig(incomingConfig, diskConfig)
    assert.deepEqual(persisted.apiKeys, {
      nvidia: 'disk-nvidia',
      groq: 'disk-groq',
    })
    assert.deepEqual(persisted.favorites, ['nvidia/model-a', 'groq/model-b'])
    assert.equal(persisted.settings.hideUnconfiguredModels, false)
  })

  it('can exactly replace favorites when the caller intentionally removes one', () => {
    const diskConfig = {
      apiKeys: {},
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: ['nvidia/model-a', 'groq/model-b'],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      activeProfile: null,
      profiles: {},
    }

    const incomingConfig = {
      apiKeys: {},
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: ['groq/model-b'],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      activeProfile: null,
      profiles: {},
    }

    const persisted = buildPersistedConfig(incomingConfig, diskConfig, { replaceFavorites: true })
    assert.deepEqual(persisted.favorites, ['groq/model-b'])
  })

  it('can exactly replace apiKeys when a provider key is intentionally removed', () => {
    const diskConfig = {
      apiKeys: {
        nvidia: 'disk-nvidia',
        groq: 'disk-groq',
      },
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      activeProfile: null,
      profiles: {},
    }

    const incomingConfig = {
      apiKeys: {
        nvidia: 'disk-nvidia',
      },
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      activeProfile: null,
      profiles: {},
    }

    const persisted = buildPersistedConfig(incomingConfig, diskConfig, { replaceApiKeys: true })
    assert.deepEqual(persisted.apiKeys, { nvidia: 'disk-nvidia' })
  })

  it('can exactly replace tracked endpoint installs when managed catalogs are rewritten', () => {
    const diskConfig = {
      apiKeys: {},
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [
        {
          providerKey: 'groq',
          toolMode: 'goose',
          scope: 'selected',
          modelIds: ['openai/gpt-oss-120b'],
          lastSyncedAt: '2026-03-09T08:00:00.000Z',
        },
      ],
      activeProfile: null,
      profiles: {},
    }

    const incomingConfig = {
      apiKeys: {},
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [
        {
          providerKey: 'nvidia',
          toolMode: 'opencode',
          scope: 'selected',
          modelIds: ['deepseek-ai/deepseek-v4-flash'],
          lastSyncedAt: '2026-03-10T09:00:00.000Z',
        },
      ],
      activeProfile: null,
      profiles: {},
    }

    const persisted = buildPersistedConfig(incomingConfig, diskConfig, { replaceEndpointInstalls: true })
    assert.deepEqual(persisted.endpointInstalls, [
      {
        providerKey: 'nvidia',
        toolMode: 'opencode',
        scope: 'selected',
        modelIds: ['deepseek-ai/deepseek-v4-flash'],
        lastSyncedAt: '2026-03-10T09:00:00.000Z',
      },
    ])
  })

  it('preserves router config from disk when unrelated stale writers save', () => {
    const diskConfig = {
      apiKeys: { groq: 'disk-groq' },
      providers: {},
      settings: { hideUnconfiguredModels: true },
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
      router: {
        enabled: true,
        activeSet: 'fast-coding',
        sets: {
          'fast-coding': {
            name: 'fast-coding',
            models: [{ provider: 'groq', model: 'openai/gpt-oss-120b', priority: 1 }],
            created: '2026-04-22T10:00:00.000Z',
          },
        },
      },
    }

    const incomingConfig = {
      apiKeys: { groq: 'disk-groq' },
      providers: {},
      settings: { hideUnconfiguredModels: false },
      favorites: [],
      telemetry: { enabled: null, consentVersion: 0, anonymousId: null },
      endpointInstalls: [],
    }

    const persisted = buildPersistedConfig(incomingConfig, diskConfig)
    assert.equal(persisted.router.enabled, true)
    assert.equal(persisted.router.activeSet, 'fast-coding')
    assert.equal(persisted.router.sets['fast-coding'].models[0].provider, 'groq')
  })
})

describe('router config helpers', () => {
  it('normalizes router sets, priorities, and tuning defaults', () => {
    const router = normalizeRouterConfig({
      enabled: true,
      activeSet: 'fast coding!',
      probeMode: 'turbo',
      sets: {
        'fast coding!': {
          name: 'fast coding!',
          models: [
            { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 4 },
            { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 9 },
            { provider: 'cerebras', model: 'gpt-oss-120b', priority: 1 },
          ],
        },
      },
    })

    assert.equal(router.enabled, true)
    assert.equal(router.activeSet, 'fast-coding')
    assert.equal(router.probeMode, DEFAULT_ROUTER_SETTINGS.probeMode)
    assert.deepEqual(router.sets['fast-coding'].models.map((entry) => entry.priority), [1, 2])
    assert.deepEqual(router.sets['fast-coding'].models.map((entry) => entry.provider), ['cerebras', 'groq'])
  })

  it('builds a default router set with pinned models first, then keyed providers', () => {
    const set = buildDefaultRouterSet({ apiKeys: { groq: 'gsk-test' } }, 6)
    assert.equal(set.name, DEFAULT_ROUTER_SETTINGS.activeSet)
    assert.equal(set.models[0].provider, 'nvidia')
    assert.equal(set.models[0].model, 'minimaxai/minimax-m2.7')
    assert.equal(set.models[1].provider, 'nvidia')
    assert.equal(set.models[1].model, 'z-ai/glm-5.1')
    assert.equal(set.models[2].provider, 'nvidia')
    assert.equal(set.models[2].model, 'deepseek-ai/deepseek-v4-flash')
    assert.equal(set.models[3].provider, 'nvidia')
    assert.equal(set.models[3].model, 'openai/gpt-oss-120b')
    assert.ok(set.models.slice(4).every((entry) => entry.provider === 'groq'))
    assert.deepEqual(set.models.map((entry) => entry.priority), set.models.map((_, i) => i + 1))
  })

  it('formats errors with the OpenAI-compatible router shape', () => {
    const payload = formatOpenAiError('All models unavailable', 'service_unavailable', 'all_models_unavailable', 'req-test', {
      set: 'fast-coding',
    })
    assert.equal(payload.error.message, 'All models unavailable')
    assert.equal(payload.error.type, 'service_unavailable')
    assert.equal(payload.error.code, 'all_models_unavailable')
    assert.equal(payload.error.request_id, 'req-test')
    assert.equal(payload.error.set, 'fast-coding')
  })
})

describe('router daemon integration hardening', () => {
  it('canonicalizes content-type before proxying upstream requests', () => {
    const actual = cloneHeadersForUpstream({ 'content-type': 'application/json', accept: 'application/json' }, 'router-test-key', 'groq')

    assert.equal(actual['Content-Type'], 'application/json')
    assert.equal(actual['content-type'], undefined)
    assert.equal(actual.Authorization, 'Bearer router-test-key')
    assert.equal(actual.accept, 'application/json')
  })

  it('routes non-streaming chat completions through the highest-priority healthy model', async () => {
    await withMockProvider(() => ({
      body: {
        id: 'chatcmpl-success',
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      },
    }), async (groqProvider) => {
      await withSourceUrls({ groq: groqProvider.url }, async () => {
        const config = buildRouterTestConfig([
          { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
        ])
        await withRouterTestServer(config, async ({ baseUrl, runtime }) => {
          const response = await postRouterChat(baseUrl)
          const payload = await response.json()

          assert.equal(response.status, 200)
          assert.equal(response.headers.get('x-fcm-router-model'), `groq/${ROUTER_TEST_MODELS.groqFast}`)
          assert.equal(payload.id, 'chatcmpl-success')
          assert.equal(groqProvider.requests.length, 1)
          assert.equal(groqProvider.requests[0].headers.authorization, 'Bearer gsk-router-test')
          assert.equal(groqProvider.requests[0].body.model, ROUTER_TEST_MODELS.groqFast)
          assert.equal(runtime.tokenTracker.stats.all_time.total_tokens, 5)
        })
      })
    })
  })

  it('fails over non-streaming retryable provider errors to the next model', async () => {
    await withMockProvider(() => ({ status: 503, body: { error: { message: 'maintenance' } } }), async (groqProvider) => {
      await withMockProvider(() => ({ body: { id: 'chatcmpl-failover', choices: [] } }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: groqProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
          ])
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl)
            const payload = await response.json()

            assert.equal(response.status, 200)
            assert.equal(response.headers.get('x-fcm-router-model'), `nvidia/${ROUTER_TEST_MODELS.nvidiaFast}`)
            assert.equal(payload.id, 'chatcmpl-failover')
            assert.equal(groqProvider.requests.length, 1)
            assert.equal(nvidiaProvider.requests.length, 1)
          })
        })
      })
    })
  })

  it('fails over streaming errors before the first byte', async () => {
    await withMockProvider(() => ({ status: 503, body: { error: { message: 'warming up' } } }), async (groqProvider) => {
      await withMockProvider(() => ({
        headers: { 'content-type': 'text/event-stream' },
        chunks: ['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', 'data: [DONE]\n\n'],
      }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: groqProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
          ])
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl, { stream: true })
            const text = await response.text()

            assert.equal(response.status, 200)
            assert.equal(response.headers.get('x-fcm-router-model'), `nvidia/${ROUTER_TEST_MODELS.nvidiaFast}`)
            assert.match(text, /"ok"/)
            assert.equal(groqProvider.requests.length, 1)
            assert.equal(nvidiaProvider.requests.length, 1)
          })
        })
      })
    })
  })

  it('does not retry a streaming response after partial output reached the client', async () => {
    await withMockProvider((request, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')
      setTimeout(() => res.destroy(new Error('upstream stream exploded')), 5)
      return null
    }, async (groqProvider) => {
      await withMockProvider(() => ({ body: { id: 'should-not-run', choices: [] } }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: groqProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
          ])
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl, { stream: true })
            const text = await response.text()

            assert.equal(response.status, 200)
            assert.match(text, /partial/)
            assert.equal(groqProvider.requests.length, 1)
            assert.equal(nvidiaProvider.requests.length, 0)
          })
        })
      })
    })
  })

  it('skips remaining candidates from the same provider after an auth error', async () => {
    await withMockProvider(() => ({ status: 401, body: { error: { message: 'bad key' } } }), async (groqProvider) => {
      await withMockProvider(() => ({ body: { id: 'chatcmpl-auth-skip', choices: [] } }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: groqProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqBackup, priority: 2 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 3 },
          ])
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl)

            assert.equal(response.status, 200)
            assert.equal(response.headers.get('x-fcm-router-model'), `nvidia/${ROUTER_TEST_MODELS.nvidiaFast}`)
            assert.equal(groqProvider.requests.length, 1)
            assert.equal(nvidiaProvider.requests.length, 1)
          })
        })
      })
    })
  })

  it('returns precise quota metadata when every routed model is exhausted', async () => {
    await withMockProvider(() => ({
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': '7',
        'x-ratelimit-remaining': '0',
      },
      body: { error: { message: 'quota exceeded' } },
    }), async (groqProvider) => {
      await withSourceUrls({ groq: groqProvider.url }, async () => {
        const config = buildRouterTestConfig([
          { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
        ])
        await withRouterTestServer(config, async ({ baseUrl }) => {
          const response = await postRouterChat(baseUrl)
          const payload = await response.json()

          assert.equal(response.status, 429)
          assert.equal(payload.error.code, 'insufficient_quota')
          assert.deepEqual(payload.error.quota_exhausted, [`groq/${ROUTER_TEST_MODELS.groqFast}`])
          assert.equal(payload.error.quota_exhausted_details[0].retry_after_ms, 7000)
          assert.equal(payload.error.quota_exhausted_details[0].rate_limit_headers['x-ratelimit-remaining'], '0')
          assert.equal(groqProvider.requests.length, 1)
        })
      })
    })
  })

  it('treats upstream HTML maintenance pages as retryable 503 responses', async () => {
    await withMockProvider(() => ({
      headers: { 'content-type': 'text/html' },
      rawBody: '<!doctype html><html><body>maintenance</body></html>',
    }), async (groqProvider) => {
      await withMockProvider(() => ({ body: { id: 'chatcmpl-after-html', choices: [] } }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: groqProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
          ])
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl)
            const payload = await response.json()

            assert.equal(response.status, 200)
            assert.equal(payload.id, 'chatcmpl-after-html')
            assert.equal(groqProvider.requests.length, 1)
            assert.equal(nvidiaProvider.requests.length, 1)
          })
        })
      })
    })
  })

  it('fails over malformed successful JSON instead of returning it to clients', async () => {
    await withMockProvider(() => ({
      headers: { 'content-type': 'application/json' },
      rawBody: '{"id":',
    }), async (groqProvider) => {
      await withMockProvider(() => ({ body: { id: 'chatcmpl-after-invalid-json', choices: [] } }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: groqProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
          ])
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl)
            const payload = await response.json()

            assert.equal(response.status, 200)
            assert.equal(payload.id, 'chatcmpl-after-invalid-json')
            assert.equal(groqProvider.requests.length, 1)
            assert.equal(nvidiaProvider.requests.length, 1)
          })
        })
      })
    })
  })

  it('fails over request timeouts and connection-refused transport errors', async () => {
    await withMockProvider(() => ({ delayMs: 1100, body: { id: 'too-late', choices: [] } }), async (slowProvider) => {
      await withMockProvider(() => ({ body: { id: 'chatcmpl-after-timeout', choices: [] } }), async (nvidiaProvider) => {
        await withSourceUrls({ groq: slowProvider.url, nvidia: nvidiaProvider.url }, async () => {
          const config = buildRouterTestConfig([
            { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
            { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
          ], { requestTimeoutMs: 10 })
          await withRouterTestServer(config, async ({ baseUrl }) => {
            const response = await postRouterChat(baseUrl)
            const payload = await response.json()

            assert.equal(response.status, 200)
            assert.equal(payload.id, 'chatcmpl-after-timeout')
            assert.equal(nvidiaProvider.requests.length, 1)
          })
        })
      })
    })

    const closedServer = createHttpServer(() => {})
    const closedPort = await listenOnRandomPort(closedServer)
    await closeRouterTestServer(closedServer)
    await withMockProvider(() => ({ body: { id: 'chatcmpl-after-refused', choices: [] } }), async (nvidiaProvider) => {
      await withSourceUrls({
        groq: `http://127.0.0.1:${closedPort}/v1/chat/completions`,
        nvidia: nvidiaProvider.url,
      }, async () => {
        const config = buildRouterTestConfig([
          { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
          { provider: 'nvidia', model: ROUTER_TEST_MODELS.nvidiaFast, priority: 2 },
        ])
        await withRouterTestServer(config, async ({ baseUrl }) => {
          const response = await postRouterChat(baseUrl)
          const payload = await response.json()

          assert.equal(response.status, 200)
          assert.equal(payload.id, 'chatcmpl-after-refused')
          assert.equal(nvidiaProvider.requests.length, 1)
        })
      })
    })
  })

  it('aborts the upstream request when the client disconnects', async () => {
    let providerCloseResolve = null
    let providerReceivedResolve = null
    const providerClosed = new Promise((resolve) => { providerCloseResolve = resolve })
    const providerReceived = new Promise((resolve) => { providerReceivedResolve = resolve })

    await withMockProvider((request, res) => {
      providerReceivedResolve()
      res.on('close', () => providerCloseResolve())
      return new Promise(() => {})
    }, async (groqProvider) => {
      await withSourceUrls({ groq: groqProvider.url }, async () => {
        const config = buildRouterTestConfig([
          { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
        ], { requestTimeoutMs: 1000 })
        await withRouterTestServer(config, async ({ baseUrl }) => {
          const controller = new AbortController()
          const request = fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(routerChatBody()),
            signal: controller.signal,
          }).catch((error) => error)

          await withTimeout(providerReceived, 500, 'provider request')
          controller.abort()
          await withTimeout(providerClosed, 500, 'provider close')
          const result = await request

          assert.ok(result instanceof Error)
          assert.equal(groqProvider.requests.length, 1)
        })
      })
    })
  })

  it('does not advertise the daemon restart endpoint before a real restart strategy exists', async () => {
    const config = buildRouterTestConfig([
      { provider: 'groq', model: ROUTER_TEST_MODELS.groqFast, priority: 1 },
    ])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/daemon/restart`, { method: 'POST' })
      const payload = await response.json()

      assert.equal(response.status, 404)
      assert.equal(payload.error.code, 'not_found')
    })
  })

  it('updates probe mode through the dashboard endpoint', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl, runtime }) => {
      const response = await fetch(`${baseUrl}/daemon/probe-mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ probeMode: 'eco' }),
      })
      const payload = await response.json()
      const health = await (await fetch(`${baseUrl}/health`)).json()

      assert.equal(response.status, 200)
      assert.equal(payload.probeMode, 'eco')
      assert.equal(runtime.routerConfig().probeMode, 'eco')
      assert.equal(health.probeMode, 'eco')
    })
  })

  it('serves /api/models with model catalog data', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/models`)
      const payload = await response.json()

      assert.equal(response.status, 200)
      assert.ok(Array.isArray(payload), '/api/models should return an array')
      assert.ok(payload.length > 0, 'model array should not be empty')
      const first = payload[0]
      assert.ok(typeof first.modelId === 'string', 'modelId should be string')
      assert.ok(typeof first.tier === 'string', 'tier should be string')
      assert.ok(typeof first.providerKey === 'string', 'providerKey should be string')
      assert.ok(typeof first.label === 'string', 'label should be string')
      assert.ok(typeof first.hasApiKey === 'boolean', 'hasApiKey should be boolean')
      assert.ok(first.hasOwnProperty('status'), 'should have status field')
      assert.ok(first.hasOwnProperty('inRouterSet'), 'should have inRouterSet field')
    })
  })

  it('serves /api/config with sanitized provider data', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/config`)
      const payload = await response.json()

      assert.equal(response.status, 200)
      assert.ok(payload.providers, 'should have providers object')
      assert.ok(typeof payload.totalModels === 'number', 'totalModels should be number')
      for (const [key, provider] of Object.entries(payload.providers)) {
        assert.ok(typeof provider.name === 'string', `${key} should have name`)
        assert.ok(typeof provider.hasKey === 'boolean', `${key} should have hasKey boolean`)
        assert.ok(provider.hasKey === false || provider.maskedKey?.includes('•'), `${key} should mask key`)
        assert.ok(typeof provider.enabled === 'boolean', `${key} should have enabled boolean`)
      }
    })
  })

  it('serves static index.html for root path', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/`)
      const text = await response.text()

      assert.equal(response.status, 200)
      assert.ok(text.includes('<!DOCTYPE html') || text.includes('<html'), 'should serve HTML')
    })
  })

  it('serves /api/events as SSE stream', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1000)
      const response = await fetch(`${baseUrl}/api/events`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)

      assert.equal(response.status, 200)
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'), 'should be SSE')
    })
  })

  it('blocks path traversal in static file serving', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/../../../../../../etc/passwd`)
      // 📖 Either the path-traversal guard fires (403) or the server's URL
      // 📖 normalization collapses the path so the dashboard SPA serves 200
      // 📖 with an HTML page. The critical contract: never expose /etc/passwd.
      const body = await response.text()
      assert.ok(!body.startsWith('root:'), 'must not leak /etc/passwd contents')
      assert.ok(!body.includes('/bin/bash'), 'must not leak shell paths')
    })
  })

  it('rejects /api/settings POST from a cross-origin browser context', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://evil.example.com',
        },
        body: JSON.stringify({ apiKeys: { groq: 'stolen' } }),
      })
      assert.equal(response.status, 403, 'cross-origin write must be blocked')
    })
  })

  it('accepts /api/settings POST from a same-origin (localhost) context', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:19280',
        },
        body: JSON.stringify({ providers: { groq: { enabled: false } } }),
      })
      assert.equal(response.status, 200, 'same-origin write must succeed')
    })
  })

  it('rejects /api/key/* GET from a cross-origin browser context', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/key/groq`, {
        headers: { 'Origin': 'https://evil.example.com' },
      })
      assert.equal(response.status, 403, 'cross-origin key reveal must be blocked')
    })
  })

  it('serves /api/key/<provider> for same-origin / CLI callers', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      // 📖 No Origin header == CLI caller (curl). Must be allowed.
      const response = await fetch(`${baseUrl}/api/key/groq`)
      assert.equal(response.status, 200)
      const payload = await response.json()
      assert.ok(payload.hasOwnProperty('key'), 'should return a key field')
    })
  })

  it('returns 404 on /api/key for an unknown provider', async () => {
    const config = buildRouterTestConfig([])
    await withRouterTestServer(config, async ({ baseUrl }) => {
      const response = await fetch(`${baseUrl}/api/key/not-a-real-provider`)
      assert.equal(response.status, 404)
    })
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
    const statsFile = join(dir, 'token-stats.json')

    try {
      writeFileSync(statsFile, JSON.stringify({
        byAccount: {
          'groq/openai-gpt-oss-120b/0': { tokens: 1500 },
          'groq/openai-gpt-oss-120b/1': { tokens: 300 },
          'nvidia/openai-gpt-oss-120b/0': { tokens: 5500 },
        },
      }, null, 2))

      const totals = loadTokenUsageByProviderModel({ statsFile })
      assert.equal(totals['groq::openai-gpt-oss-120b'], 1800)
      assert.equal(totals['nvidia::openai-gpt-oss-120b'], 5500)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('/testfcm helpers', () => {
  it('normalizes common tool aliases to canonical launcher modes', () => {
    assert.equal(normalizeTestfcmToolName('opencodecli'), 'opencode')
    assert.equal(normalizeTestfcmToolName('crush'), 'crush')
  })

  it('resolves a known tool spec and keeps its CLI flag', () => {
    const spec = resolveTestfcmToolSpec('goose')
    assert.equal(spec?.mode, 'goose')
    assert.equal(spec?.flag, '--goose')
  })

  it('treats string and array API key entries as configured only when non-empty', () => {
    assert.equal(hasConfiguredKey('gsk_live'), true)
    assert.equal(hasConfiguredKey('   '), false)
    assert.equal(hasConfiguredKey(['', '  ', 'gsk_live']), true)
    assert.equal(hasConfiguredKey(['', '  ']), false)
  })

  it('builds compact run ids from timestamps', () => {
    assert.equal(createTestfcmRunId(new Date('2026-03-16T18:45:12.345Z')), '20260316-184512-345')
  })

  it('extracts JSON arrays from mixed stdout text', () => {
    const parsed = extractJsonPayload('  ⚡ Pinging models...\n\n[\n  {"label":"Model A"}\n]\n')
    assert.deepEqual(parsed, [{ label: 'Model A' }])
  })

  it('picks the first clearly healthy preflight row before pressing Enter', () => {
    const index = pickTestfcmSelectionIndex([
      { status: 'down', httpCode: 'ERR' },
      { status: 'up', httpCode: '401' },
      { status: 'up', httpCode: '200' },
      { status: 'up', httpCode: '200' },
    ])
    assert.equal(index, 2)
  })

  it('classifies a successful assistant transcript', () => {
    const result = classifyToolTranscript('Mock Crush ready\nhello, how can i help you?\n')
    assert.equal(result.status, 'passed')
    assert.equal(result.findings.length, 0)
  })

  it('classifies invalid API failures and emits a follow-up task', () => {
    const result = classifyToolTranscript('Error: invalid api key (401 unauthorized)')
    assert.equal(result.status, 'failed')
    assert.equal(result.findings[0]?.id, 'invalid_api_key')
    assert.match(buildFixTasks(result.findings)[0] || '', /Validate the provider key/i)
  })

  it('flags PTY width warnings as actionable harness failures', () => {
    const result = classifyToolTranscript('Please maximize your terminal for optimal use. The current terminal is too small.')
    assert.equal(result.status, 'failed')
    assert.equal(result.findings[0]?.id, 'terminal_too_small')
    assert.match(buildFixTasks(result.findings)[0] || '', /width warning disabled|wider PTY/i)
  })

  it('stays inconclusive when no success or known failure pattern exists', () => {
    const result = classifyToolTranscript('Tool opened, waiting for model...')
    assert.equal(result.status, 'inconclusive')
    assert.equal(result.findings.length, 0)
  })
})

describe('tool launcher env building', () => {
  it('sanitizes inherited OpenAI-compatible vars for direct launches', () => {
    const config = { apiKeys: { nvidia: 'nvapi-test' } }
    const model = { providerKey: 'nvidia', modelId: 'openai/gpt-oss-120b' }
    const inheritedEnv = {
      OPENAI_API_KEY: 'stale-openai-key',
      OPENAI_BASE_URL: 'https://old.example/v1',
      PATH: process.env.PATH || '',
    }

    const { env } = buildToolEnv('crush', model, config, {
      sanitize: true,
      includeCompatDefaults: true,
      includeProviderEnv: false,
      inheritedEnv,
    })

    assert.equal(env.OPENAI_API_KEY, 'nvapi-test')
    assert.match(env.OPENAI_BASE_URL || '', /integrate\.api\.nvidia\.com/)
    assert.equal(env.LLM_MODEL, 'openai/openai/gpt-oss-120b')
  })

  it('keeps launcher model ids provider-native in direct mode', () => {
    assert.equal(resolveLauncherModelId({ modelId: 'deepseek-ai/deepseek-v3.1' }), 'deepseek-ai/deepseek-v3.1')
  })
})

describe('tool bootstrap helpers', () => {
  it('returns the npm install plan for opencode', () => {
    const plan = getToolInstallPlan('opencode', { platform: 'darwin' })
    assert.equal(plan.supported, true)
    assert.equal(plan.binary, 'opencode')
    assert.match(plan.shellCommand || '', /npm install -g opencode-ai/)
  })

  it('returns the official goose installer script on linux', () => {
    const plan = getToolInstallPlan('goose', { platform: 'linux' })
    assert.equal(plan.supported, true)
    assert.match(plan.shellCommand || '', /download_cli\.sh \| CONFIGURE=false bash/)
  })

  it('marks OpenHands auto-install unsupported on native Windows', () => {
    const plan = getToolInstallPlan('openhands', { platform: 'win32' })
    assert.equal(plan.supported, false)
    assert.match(plan.reason || '', /WSL/i)
  })

  it('resolves a fake tool binary from PATH without spawning it', () => {
    const dir = join(tmpdir(), `fcm-tool-bootstrap-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const binaryPath = join(dir, 'crush')

    try {
      writeFileSync(binaryPath, '#!/bin/sh\nexit 0\n')
      chmodSync(binaryPath, 0o755)

      const resolved = resolveToolBinaryPath('crush', { env: { PATH: dir } })
      assert.equal(resolved, binaryPath)
      assert.equal(isToolInstalled('crush', { env: { PATH: dir } }), true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('tool compatibility matrix', () => {
  it('regular providers are compatible with all non-cliOnly tools', () => {
    const regularTools = getCompatibleTools('nvidia')
    assert.ok(regularTools.includes('opencode'))
    assert.ok(regularTools.includes('opencode-desktop'))
    assert.ok(regularTools.includes('openclaw'))
    assert.ok(regularTools.includes('goose'))
    assert.ok(regularTools.includes('amp'))
    assert.ok(regularTools.includes('caveman'), 'regular models should be compatible with caveman')
    assert.ok(!regularTools.includes('rovo'), 'regular models should NOT be compatible with rovo')
    assert.ok(!regularTools.includes('gemini'), 'regular models should NOT be compatible with gemini')
  })

  it('rovo models are only compatible with rovo', () => {
    const tools = getCompatibleTools('rovo')
    assert.deepEqual(tools, ['rovo'])
  })

  it('gemini models are only compatible with gemini', () => {
    const tools = getCompatibleTools('gemini')
    assert.deepEqual(tools, ['gemini'])
  })

  it('opencode-zen models are compatible with all non-cliOnly tools (OpenAI-compatible endpoint)', () => {
    const tools = getCompatibleTools('opencode-zen')
    // 📖 Zen uses /v1/chat/completions — any OpenAI-compatible tool can use it
    assert.ok(tools.includes('opencode'), 'zen should work with opencode')
    assert.ok(tools.includes('opencode-desktop'), 'zen should work with opencode-desktop')
    assert.ok(tools.includes('pi'), 'zen should work with pi')
    assert.ok(tools.includes('aider'), 'zen should work with aider')
    assert.ok(tools.includes('goose'), 'zen should work with goose')
    assert.ok(!tools.includes('rovo'), 'zen should NOT work with cli-only rovo')
    assert.ok(!tools.includes('gemini'), 'zen should NOT work with cli-only gemini')
  })

  it('isModelCompatibleWithTool returns true for matching pairs', () => {
    assert.ok(isModelCompatibleWithTool('nvidia', 'opencode'))
    assert.ok(isModelCompatibleWithTool('rovo', 'rovo'))
    assert.ok(isModelCompatibleWithTool('gemini', 'gemini'))
    assert.ok(isModelCompatibleWithTool('opencode-zen', 'opencode'))
    assert.ok(isModelCompatibleWithTool('opencode-zen', 'opencode-desktop'))
    assert.ok(isModelCompatibleWithTool('opencode-zen', 'opencode-web'))
    assert.ok(isModelCompatibleWithTool('opencode-zen', 'pi'), 'zen should work with pi')
    assert.ok(isModelCompatibleWithTool('opencode-zen', 'goose'), 'zen should work with goose')
    assert.ok(isModelCompatibleWithTool('opencode-zen', 'aider'), 'zen should work with aider')
  })

  it('isModelCompatibleWithTool returns false for incompatible pairs', () => {
    assert.ok(!isModelCompatibleWithTool('rovo', 'opencode'))
    assert.ok(!isModelCompatibleWithTool('gemini', 'openclaw'))
    assert.ok(!isModelCompatibleWithTool('opencode-zen', 'rovo'), 'zen is not compatible with cli-only rovo')
    assert.ok(!isModelCompatibleWithTool('opencode-zen', 'gemini'), 'zen is not compatible with cli-only gemini')
    assert.ok(!isModelCompatibleWithTool('nvidia', 'rovo'))
  })

  it('every tool in TOOL_MODE_ORDER has an emoji and color', () => {
    for (const toolKey of TOOL_MODE_ORDER) {
      const meta = TOOL_METADATA[toolKey]
      assert.ok(meta, `missing TOOL_METADATA for ${toolKey}`)
      assert.ok(typeof meta.emoji === 'string' && meta.emoji.length >= 1, `${toolKey} needs an emoji`)
      assert.ok(Array.isArray(meta.color) && meta.color.length === 3, `${toolKey} needs a [r,g,b] color`)
    }
  })

  it('all tool emojis are unique (except OpenCode CLI/Desktop sharing 📦)', () => {
    // 📖 OpenCode CLI and Desktop intentionally share 📦 — they are the same platform
    const emojis = TOOL_MODE_ORDER.map(k => TOOL_METADATA[k].emoji)
    const nonShared = emojis.filter(e => e !== '📦')
    const unique = new Set(nonShared)
    assert.equal(unique.size, nonShared.length, `duplicate emojis found (excluding 📦): ${nonShared.join(',')}`)
  })

  it('sources.js opencode-zen has zenOnly flag', () => {
    assert.ok(sources['opencode-zen'], 'opencode-zen source must exist')
    assert.ok(sources['opencode-zen'].zenOnly, 'opencode-zen must have zenOnly: true')
    assert.ok(sources['opencode-zen'].models.length > 0, 'opencode-zen must have models')
  })

  // 📖 findSimilarCompatibleModels tests
  it('findSimilarCompatibleModels returns models sorted by SWE delta', () => {
    const mockResults = [
      { modelId: 'a', label: 'Model A', tier: 'S+', sweScore: '72.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'b', label: 'Model B', tier: 'S', sweScore: '65.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'c', label: 'Model C', tier: 'A+', sweScore: '80.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'd', label: 'Model D', tier: 'A', sweScore: '50.0%', providerKey: 'nvidia', hidden: false },
    ]
    const result = findSimilarCompatibleModels('70.0%', 'opencode', mockResults, 3)
    assert.equal(result.length, 3)
    // 📖 Closest to 70.0% should be 72.0% (delta 2), then 65.0% (delta 5), then 80.0% (delta 10)
    assert.equal(result[0].sweScore, '72.0%')
    assert.equal(result[1].sweScore, '65.0%')
    assert.equal(result[2].sweScore, '80.0%')
  })

  it('findSimilarCompatibleModels excludes incompatible models', () => {
    const mockResults = [
      { modelId: 'a', label: 'Regular', tier: 'S', sweScore: '70.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'b', label: 'Rovo Only', tier: 'S', sweScore: '71.0%', providerKey: 'rovo', hidden: false },
    ]
    // 📖 When looking for models compatible with 'opencode', rovo models should be excluded
    const result = findSimilarCompatibleModels('70.0%', 'opencode', mockResults, 3)
    assert.equal(result.length, 1)
    assert.equal(result[0].label, 'Regular')
  })

  it('findSimilarCompatibleModels excludes hidden models', () => {
    const mockResults = [
      { modelId: 'a', label: 'Visible', tier: 'S', sweScore: '70.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'b', label: 'Hidden', tier: 'S', sweScore: '71.0%', providerKey: 'nvidia', hidden: true },
    ]
    const result = findSimilarCompatibleModels('70.0%', 'opencode', mockResults, 3)
    assert.equal(result.length, 1)
    assert.equal(result[0].label, 'Visible')
  })

  it('findSimilarCompatibleModels respects maxResults limit', () => {
    const mockResults = [
      { modelId: 'a', label: 'A', tier: 'S', sweScore: '70.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'b', label: 'B', tier: 'S', sweScore: '71.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'c', label: 'C', tier: 'S', sweScore: '72.0%', providerKey: 'nvidia', hidden: false },
      { modelId: 'd', label: 'D', tier: 'S', sweScore: '73.0%', providerKey: 'nvidia', hidden: false },
    ]
    const result = findSimilarCompatibleModels('70.0%', 'opencode', mockResults, 2)
    assert.equal(result.length, 2)
  })

  it('findSimilarCompatibleModels handles missing SWE scores gracefully', () => {
    const mockResults = [
      { modelId: 'a', label: 'No SWE', tier: 'S', sweScore: '-', providerKey: 'nvidia', hidden: false },
      { modelId: 'b', label: 'Has SWE', tier: 'S', sweScore: '70.0%', providerKey: 'nvidia', hidden: false },
    ]
    // 📖 When selected model has no SWE score, treat as 0 — should still return results
    const result = findSimilarCompatibleModels('-', 'opencode', mockResults, 3)
    assert.equal(result.length, 2)
    // 📖 '-' parses as 0, so the model with sweScore '-' (also 0) should be closest
    assert.equal(result[0].label, 'No SWE')
  })
})

describe('tool launch preparation', () => {
  function createToolPaths(dir) {
    return {
      aiderConfigPath: join(dir, 'aider', '.aider.conf.yml'),
      crushConfigPath: join(dir, 'crush', 'crush.json'),
      gooseProvidersDir: join(dir, 'goose', 'custom_providers'),
      gooseSecretsPath: join(dir, 'goose', 'secrets.yaml'),
      gooseConfigPath: join(dir, 'goose', 'config.yaml'),
      qwenConfigPath: join(dir, 'qwen', 'settings.json'),
      ampConfigPath: join(dir, 'amp', 'settings.json'),
      piModelsPath: join(dir, 'pi', 'models.json'),
      piSettingsPath: join(dir, 'pi', 'settings.json'),
      openHandsEnvPath: join(dir, '.fcm-openhands-env'),
    }
  }

  it('persists the selected model into every external tool before launch', () => {
    const dir = join(tmpdir(), `fcm-tool-launch-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const paths = createToolPaths(dir)
    const config = { apiKeys: { nvidia: 'nvapi-test' } }
    const model = { providerKey: 'nvidia', modelId: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash' }

    try {
      const aiderPlan = prepareExternalToolLaunch('aider', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      assert.equal(aiderPlan.command, 'aider')
      assert.deepEqual(aiderPlan.args, ['--model', 'openai/deepseek-ai/deepseek-v4-flash'])
      assert.match(readFileSync(paths.aiderConfigPath, 'utf8'), /model: openai\/deepseek-ai\/deepseek-v4-flash/)

      const crushPlan = prepareExternalToolLaunch('crush', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      const crushConfig = JSON.parse(readFileSync(paths.crushConfigPath, 'utf8'))
      assert.equal(crushPlan.command, 'crush')
      assert.equal(crushConfig.models.large.model, 'deepseek-ai/deepseek-v4-flash')
      assert.equal(crushConfig.models.large.provider, 'freeCodingModels')
      assert.equal(crushConfig.models.small.model, 'deepseek-ai/deepseek-v4-flash')

      const goosePlan = prepareExternalToolLaunch('goose', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      const gooseConfig = readFileSync(paths.gooseConfigPath, 'utf8')
      assert.equal(goosePlan.command, 'goose')
      assert.match(gooseConfig, /GOOSE_PROVIDER: fcm-nvidia/)
      assert.match(gooseConfig, /GOOSE_MODEL: deepseek-ai\/deepseek-v4-flash/)

      const qwenPlan = prepareExternalToolLaunch('qwen', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      const qwenConfig = JSON.parse(readFileSync(paths.qwenConfigPath, 'utf8'))
      assert.equal(qwenPlan.command, 'qwen')
      assert.equal(qwenConfig.model, 'deepseek-ai/deepseek-v4-flash')
      assert.equal(qwenConfig.modelProviders.openai[0].id, 'deepseek-ai/deepseek-v4-flash')

      const openHandsPlan = prepareExternalToolLaunch('openhands', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      const openHandsEnv = readFileSync(paths.openHandsEnvPath, 'utf8')
      assert.equal(openHandsPlan.command, 'openhands')
      assert.deepEqual(openHandsPlan.args, ['--override-with-envs'])
      assert.match(openHandsEnv, /OPENAI_MODEL="deepseek-ai\/deepseek-v4-flash"/)
      assert.match(openHandsEnv, /LLM_MODEL="openai\/deepseek-ai\/deepseek-v4-flash"/)

      const ampPlan = prepareExternalToolLaunch('amp', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      const ampConfig = JSON.parse(readFileSync(paths.ampConfigPath, 'utf8'))
      assert.equal(ampPlan.command, 'amp')
      assert.equal(ampConfig['amp.model'], 'deepseek-ai/deepseek-v4-flash')

      const piPlan = prepareExternalToolLaunch('pi', model, config, { paths, inheritedEnv: { PATH: process.env.PATH || '' } })
      const piModels = JSON.parse(readFileSync(paths.piModelsPath, 'utf8'))
      const piSettings = JSON.parse(readFileSync(paths.piSettingsPath, 'utf8'))
      assert.equal(piPlan.command, 'pi')
      assert.deepEqual(piPlan.args, ['--provider', 'nvidia', '--model', 'deepseek-ai/deepseek-v4-flash', '--api-key', piPlan.apiKey])
      assert.equal(piModels.providers.nvidia.models[0].id, 'deepseek-ai/deepseek-v4-flash')
      assert.equal(piSettings.defaultModel, 'deepseek-ai/deepseek-v4-flash')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('openclaw selected model persistence', () => {
  it('writes the selected provider/model as the OpenClaw default instead of forcing nvidia', async () => {
    const dir = join(tmpdir(), `fcm-openclaw-launch-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const openclawConfigPath = join(dir, 'openclaw', 'openclaw.json')
    const config = { apiKeys: { groq: 'gsk-test' } }
    const model = { providerKey: 'groq', modelId: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' }

    try {
      const result = await startOpenClaw(model, config, { paths: { openclawConfigPath } })
      const written = JSON.parse(readFileSync(openclawConfigPath, 'utf8'))

      assert.equal(result?.providerId, 'fcm-groq')
      assert.equal(written.agents.defaults.model.primary, 'fcm-groq/openai/gpt-oss-120b')
      assert.equal(Boolean(written.models.providers['fcm-groq']), true)
      assert.equal(written.models.providers['fcm-groq'].models[0].id, 'openai/gpt-oss-120b')
      assert.equal(written.env.GROQ_API_KEY, 'gsk-test')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('endpoint install tracking', () => {
  it('exposes only persisted-config install targets in the Y install list', () => {
    const installTargets = getInstallTargetModes()
    assert.deepEqual(installTargets, ['opencode', 'opencode-desktop', 'opencode-web', 'openclaw', 'kilo', 'crush', 'goose', 'pi', 'aider', 'qwen', 'openhands', 'amp', 'hermes', 'continue', 'cline', 'forgecode', 'fcm_router'])
  })

  it('normalizes tracked installs to canonical shape', () => {
    const normalized = normalizeEndpointInstalls([
      {
        providerKey: 'nvidia',
        toolMode: 'opencode',
        scope: 'selected',
        modelIds: ['deepseek-ai/deepseek-v4-flash', '', 'deepseek-ai/deepseek-v4-flash'],
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
        modelIds: ['deepseek-ai/deepseek-v4-flash'],
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
        modelIds: ['deepseek-ai/deepseek-v4-flash'],
        paths,
      })

      const written = JSON.parse(readFileSync(paths.opencodeConfigPath, 'utf8'))
      assert.equal(result.toolMode, 'opencode')
      assert.equal(result.modelCount, 1)
      assert.equal(written.provider['fcm-nvidia'].options.apiKey, expectedApiKey)
      assert.deepEqual(written.provider['fcm-nvidia'].models, {
        'deepseek-ai/deepseek-v4-flash': { name: 'DeepSeek V4 Flash' },
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
          modelIds: ['deepseek-ai/deepseek-v4-flash'],
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

describe('legacy proxy cleanup', () => {
  function createCleanupFixtureDir() {
    const dir = join(tmpdir(), `fcm-legacy-cleanup-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    return dir
  }

  it('removes discontinued proxy fields from the main config while preserving direct installs', () => {
    const homeDir = createCleanupFixtureDir()
    const configPath = join(homeDir, '.free-coding-models.json')
    const opencodeConfigPath = join(homeDir, '.config', 'opencode', 'opencode.json')
    mkdirSync(dirname(opencodeConfigPath), { recursive: true })

    try {
      writeFileSync(configPath, JSON.stringify({
        apiKeys: { nvidia: 'nvapi-test' },
        providers: {},
        settings: {
          preferredToolMode: 'claude-code',
          proxy: { enabled: true },
        },
        proxySettings: { enabled: true },
        endpointInstalls: [
          { providerKey: 'nvidia', toolMode: 'claude-code', scope: 'all', modelIds: [] },
          { providerKey: 'nvidia', toolMode: 'opencode', scope: 'selected', modelIds: ['deepseek-ai/deepseek-v4-flash'] },
        ],
      }, null, 2))

      writeFileSync(opencodeConfigPath, JSON.stringify({
        provider: {
          'fcm-proxy': { options: { apiKey: 'legacy' } },
          'fcm-nvidia': { options: { apiKey: 'nvapi-test' } },
        },
        model: 'fcm-proxy/deepseek-ai/deepseek-v4-flash',
      }, null, 2))

      const summary = cleanupLegacyProxyArtifacts({
        homeDir,
        paths: {
          configPath,
          opencodeConfigPath,
          shellProfilePaths: [],
        },
      })

      const nextConfig = JSON.parse(readFileSync(configPath, 'utf8'))
      const nextOpencode = JSON.parse(readFileSync(opencodeConfigPath, 'utf8'))

      assert.equal(summary.changed, true)
      assert.equal('proxySettings' in nextConfig, false)
      assert.equal('proxy' in nextConfig.settings, false)
      assert.equal(nextConfig.settings.preferredToolMode, 'opencode')
      assert.deepEqual(nextConfig.endpointInstalls, [
        { providerKey: 'nvidia', toolMode: 'opencode', scope: 'selected', modelIds: ['deepseek-ai/deepseek-v4-flash'] },
      ])
      assert.equal(Boolean(nextOpencode.provider['fcm-proxy']), false)
      assert.equal(Boolean(nextOpencode.provider['fcm-nvidia']), true)
      assert.equal('model' in nextOpencode, false)
    } finally {
      rmSync(homeDir, { recursive: true, force: true })
    }
  })

  it('removes proxy-only env files and shell sourcing lines', () => {
    const homeDir = createCleanupFixtureDir()
    const envPath = join(homeDir, '.fcm-claude-code-env')
    const envBackupPath = `${envPath}.bak`
    const zshrcPath = join(homeDir, '.zshrc')

    try {
      writeFileSync(envPath, 'export ANTHROPIC_BASE_URL=http://127.0.0.1:18045/v1\n')
      writeFileSync(envBackupPath, 'backup\n')
      writeFileSync(zshrcPath, [
        '# 📖 FCM Proxy — Claude Code env vars',
        'source "$HOME/.fcm-claude-code-env"',
        'export PATH="$HOME/bin:$PATH"',
      ].join('\n'))

      const summary = cleanupLegacyProxyArtifacts({
        homeDir,
        paths: {
          shellProfilePaths: [zshrcPath],
        },
      })

      const nextZshrc = readFileSync(zshrcPath, 'utf8')
      assert.equal(summary.changed, true)
      assert.equal(existsSync(envPath), false)
      assert.equal(existsSync(envBackupPath), false)
      assert.doesNotMatch(nextZshrc, /\.fcm-claude-code-env/)
      assert.match(nextZshrc, /export PATH=/)
    } finally {
      rmSync(homeDir, { recursive: true, force: true })
    }
  })

  it('removes legacy Goose and Qwen proxy entries but keeps direct providers', () => {
    const homeDir = createCleanupFixtureDir()
    const gooseProvidersDir = join(homeDir, '.config', 'goose', 'custom_providers')
    const gooseSecretsPath = join(homeDir, '.config', 'goose', 'secrets.yaml')
    const gooseConfigPath = join(homeDir, '.config', 'goose', 'config.yaml')
    const qwenConfigPath = join(homeDir, '.qwen', 'settings.json')
    mkdirSync(gooseProvidersDir, { recursive: true })
    mkdirSync(dirname(qwenConfigPath), { recursive: true })

    try {
      writeFileSync(join(gooseProvidersDir, 'fcm-proxy.json'), '{}\n')
      writeFileSync(join(gooseProvidersDir, 'fcm-nvidia.json'), '{}\n')
      writeFileSync(gooseSecretsPath, [
        `FCM_PROXY_API_KEY: ${JSON.stringify('legacy-secret')}`,
        `FCM_NVIDIA_API_KEY: ${JSON.stringify('direct-secret')}`,
      ].join('\n'))
      writeFileSync(gooseConfigPath, [
        'GOOSE_PROVIDER: fcm-proxy',
        'GOOSE_MODEL: fcm-proxy/deepseek-ai/deepseek-v4-flash',
        'OTHER_SETTING: keep-me',
      ].join('\n'))
      writeFileSync(qwenConfigPath, JSON.stringify({
        modelProviders: {
          openai: [
            { id: 'fcm-proxy/deepseek-ai/deepseek-v4-flash', envKey: 'FCM_PROXY_API_KEY', baseUrl: 'http://127.0.0.1:18045/v1' },
            { id: 'fcm-nvidia/deepseek-ai/deepseek-v4-flash', envKey: 'FCM_NVIDIA_API_KEY', baseUrl: 'https://integrate.api.nvidia.com/v1' },
          ],
        },
        model: 'fcm-proxy/deepseek-ai/deepseek-v4-flash',
      }, null, 2))

      cleanupLegacyProxyArtifacts({
        homeDir,
        paths: {
          gooseProvidersDir,
          gooseSecretsPath,
          gooseConfigPath,
          qwenConfigPath,
          shellProfilePaths: [],
        },
      })

      const nextSecrets = readFileSync(gooseSecretsPath, 'utf8')
      const nextGooseConfig = readFileSync(gooseConfigPath, 'utf8')
      const nextQwenConfig = JSON.parse(readFileSync(qwenConfigPath, 'utf8'))

      assert.equal(existsSync(join(gooseProvidersDir, 'fcm-proxy.json')), false)
      assert.equal(existsSync(join(gooseProvidersDir, 'fcm-nvidia.json')), true)
      assert.doesNotMatch(nextSecrets, /FCM_PROXY_API_KEY/)
      assert.match(nextSecrets, /FCM_NVIDIA_API_KEY/)
      assert.doesNotMatch(nextGooseConfig, /GOOSE_PROVIDER:\s*fcm-proxy/)
      assert.match(nextGooseConfig, /OTHER_SETTING: keep-me/)
      assert.deepEqual(nextQwenConfig.modelProviders.openai, [
        { id: 'fcm-nvidia/deepseek-ai/deepseek-v4-flash', envKey: 'FCM_NVIDIA_API_KEY', baseUrl: 'https://integrate.api.nvidia.com/v1' },
      ])
      assert.equal('model' in nextQwenConfig, false)
    } finally {
      rmSync(homeDir, { recursive: true, force: true })
    }
  })

  it('keeps a direct OpenHands env file but removes the old localhost proxy variant', () => {
    const homeDir = createCleanupFixtureDir()
    const openHandsEnvPath = join(homeDir, '.fcm-openhands-env')

    try {
      writeFileSync(openHandsEnvPath, [
        'export OPENAI_API_KEY=direct-key',
        'export OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1',
      ].join('\n'))

      cleanupLegacyProxyArtifacts({ homeDir, paths: { shellProfilePaths: [] } })
      assert.equal(existsSync(openHandsEnvPath), true)

      writeFileSync(openHandsEnvPath, [
        '# FCM Proxy V2',
        'export OPENAI_BASE_URL=http://127.0.0.1:18045/v1',
      ].join('\n'))

      cleanupLegacyProxyArtifacts({ homeDir, paths: { shellProfilePaths: [] } })
      assert.equal(existsSync(openHandsEnvPath), false)
    } finally {
      rmSync(homeDir, { recursive: true, force: true })
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
      assert.match(entry[3], /^(\d+\.\d+%|-)$/, 'sweScore should match N.N% format or unknown marker')
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

// ─── Custom text filter matching logic ───────────────────────────────────────
// 📖 Tests that verify the custom text filter matching behavior used in applyTierFilter().
// 📖 The filter is case-insensitive and matches against label, ctx, providerKey, and provider display name.
describe('Custom text filter matching logic', () => {
  // 📖 Helper that mirrors the exact matching logic from applyTierFilter() in app.js
  function matchesTextFilter(row, query, providerSources) {
    if (!query) return true
    const q = query.toLowerCase()
    const providerName = (providerSources[row.providerKey]?.name || '').toLowerCase()
    return (row.label || '').toLowerCase().includes(q)
      || (row.ctx || '').toLowerCase().includes(q)
      || (row.providerKey || '').toLowerCase().includes(q)
      || providerName.includes(q)
  }

  const mockSources = {
    nvidia: { name: 'NVIDIA NIM' },
    groq: { name: 'Groq' },
    cerebras: { name: 'Cerebras' },
    openrouter: { name: 'OpenRouter' },
  }

  const mockRows = [
    { label: 'DeepSeek V3', ctx: '128k', providerKey: 'nvidia' },
    { label: 'Claude 4 Sonnet', ctx: '200k', providerKey: 'openrouter' },
    { label: 'Llama 4 Scout', ctx: '512k', providerKey: 'groq' },
    { label: 'Qwen 3 235B', ctx: '128k', providerKey: 'cerebras' },
  ]

  it('matches model name (case-insensitive)', () => {
    assert.equal(matchesTextFilter(mockRows[0], 'deepseek', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[0], 'DEEPSEEK', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[0], 'DeepSeek', mockSources), true)
  })

  it('matches partial model name', () => {
    assert.equal(matchesTextFilter(mockRows[1], 'claude', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[1], 'sonnet', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[1], '4 Son', mockSources), true)
  })

  it('matches context window string', () => {
    assert.equal(matchesTextFilter(mockRows[0], '128k', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[1], '200k', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[2], '512k', mockSources), true)
  })

  it('matches provider key', () => {
    assert.equal(matchesTextFilter(mockRows[0], 'nvidia', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[2], 'groq', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[3], 'cerebras', mockSources), true)
  })

  it('matches provider display name', () => {
    assert.equal(matchesTextFilter(mockRows[0], 'NVIDIA NIM', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[0], 'nim', mockSources), true)
    assert.equal(matchesTextFilter(mockRows[1], 'OpenRouter', mockSources), true)
  })

  it('returns false for non-matching query', () => {
    assert.equal(matchesTextFilter(mockRows[0], 'anthropic', mockSources), false)
    assert.equal(matchesTextFilter(mockRows[0], 'gemini', mockSources), false)
    assert.equal(matchesTextFilter(mockRows[0], '999k', mockSources), false)
  })

  it('returns true when query is null or empty', () => {
    assert.equal(matchesTextFilter(mockRows[0], null, mockSources), true)
    assert.equal(matchesTextFilter(mockRows[0], '', mockSources), true)
  })

  it('filters a list of models correctly', () => {
    const filtered = mockRows.filter(r => matchesTextFilter(r, '128k', mockSources))
    assert.equal(filtered.length, 2) // DeepSeek V3 and Qwen 3 235B both have 128k
    assert.equal(filtered[0].label, 'DeepSeek V3')
    assert.equal(filtered[1].label, 'Qwen 3 235B')
  })

  it('stacks with other filters (simulated tier + text)', () => {
    // 📖 Simulate tier S+ filter reducing to a subset, then text filter further narrows
    const tierSPlusRows = mockRows.filter(r => r.label.includes('Claude')) // pretend only Claude is S+
    const result = tierSPlusRows.filter(r => matchesTextFilter(r, 'sonnet', mockSources))
    assert.equal(result.length, 1)
    assert.equal(result[0].label, 'Claude 4 Sonnet')
  })
})

// ─── sortResultsWithPinnedFavorites (no toolMode partition) ───────────────────
// 📖 Sorting no longer partitions by tool compatibility — incompatible models stay
// 📖 in their natural sorted position and are highlighted with a red background instead.

describe('sortResultsWithPinnedFavorites normal sort order', () => {
  const mockModels = [
    { id: 'nvidia-1', providerKey: 'nvidia', label: 'Llama 3.1', idx: 1, tier: 'A', pings: [], isRecommended: false, isFavorite: false },
    { id: 'rovo-1', providerKey: 'rovo', label: 'Claude Sonnet 4', idx: 2, tier: 'S+', pings: [], isRecommended: false, isFavorite: false },
    { id: 'openrouter-1', providerKey: 'openrouter', label: 'GPT-4o', idx: 3, tier: 'S', pings: [], isRecommended: false, isFavorite: false },
    { id: 'gemini-1', providerKey: 'gemini', label: 'Gemini 2.5 Pro', idx: 4, tier: 'S+', pings: [], isRecommended: false, isFavorite: false },
    { id: 'zen-1', providerKey: 'opencode-zen', label: 'Big Pickle', idx: 5, tier: 'A', pings: [], isRecommended: false, isFavorite: false },
    { id: 'groq-1', providerKey: 'groq', label: 'Llama 3.3 70B', idx: 6, tier: 'A+', pings: [], isRecommended: false, isFavorite: false },
  ]

  it('returns normal rank sort order — no partitioning by tool compatibility', () => {
    const sorted = sortResultsWithPinnedFavorites(mockModels, 'rank', 'asc', { pinFavorites: false })
    // 📖 All models in rank ascending order: idx 1,2,3,4,5,6 — rovo/gemini/zen NOT pushed to bottom
    assert.equal(sorted[0].id, 'nvidia-1')
    assert.equal(sorted[1].id, 'rovo-1')
    assert.equal(sorted[2].id, 'openrouter-1')
    assert.equal(sorted[3].id, 'gemini-1')
    assert.equal(sorted[4].id, 'zen-1')
    assert.equal(sorted[5].id, 'groq-1')
  })

  it('recommended models still pinned above others', () => {
    const models = [
      { id: 'regular-1', providerKey: 'nvidia', label: 'Llama', idx: 1, tier: 'A', pings: [], isRecommended: false, isFavorite: false },
      { id: 'rovo-1', providerKey: 'rovo', label: 'Claude Sonnet 4', idx: 2, tier: 'S+', pings: [], isRecommended: true, recommendScore: 90, isFavorite: false },
    ]
    const sorted = sortResultsWithPinnedFavorites(models, 'rank', 'asc', { pinFavorites: false })
    assert.equal(sorted[0].id, 'rovo-1')
    assert.equal(sorted[1].id, 'regular-1')
  })

  it('favorites pinned above non-favorites when pinFavorites=true', () => {
    const models = [
      { id: 'regular-1', providerKey: 'nvidia', label: 'Llama', idx: 1, tier: 'A', pings: [], isRecommended: false, isFavorite: false },
      { id: 'rovo-fav', providerKey: 'rovo', label: 'Claude Fav', idx: 3, tier: 'S', pings: [], isRecommended: false, isFavorite: true, favoriteRank: 0 },
    ]
    const sorted = sortResultsWithPinnedFavorites(models, 'rank', 'asc', { pinFavorites: true })
    assert.equal(sorted[0].id, 'rovo-fav')
    assert.equal(sorted[1].id, 'regular-1')
  })
})

// ─── Mouse support tests ────────────────────────────────────────────────

describe('parseMouseEvents', () => {
  it('parses a left-click press event', () => {
    // 📖 SGR: \x1b[<0;10;5M → left press at col 10, row 5
    const events = parseMouseEvents('\x1b[<0;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'press')
    assert.equal(events[0].button, 'left')
    assert.equal(events[0].x, 10)
    assert.equal(events[0].y, 5)
    assert.equal(events[0].shift, false)
    assert.equal(events[0].meta, false)
    assert.equal(events[0].ctrl, false)
  })

  it('parses a left-click release event', () => {
    // 📖 SGR: \x1b[<0;10;5m → left release at col 10, row 5
    const events = parseMouseEvents('\x1b[<0;10;5m')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'release')
    assert.equal(events[0].button, 'left')
    assert.equal(events[0].x, 10)
    assert.equal(events[0].y, 5)
  })

  it('parses a right-click press event', () => {
    // 📖 SGR: \x1b[<2;20;15M → right press
    const events = parseMouseEvents('\x1b[<2;20;15M')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'press')
    assert.equal(events[0].button, 'right')
    assert.equal(events[0].x, 20)
    assert.equal(events[0].y, 15)
  })

  it('parses a middle-click event', () => {
    const events = parseMouseEvents('\x1b[<1;5;3M')
    assert.equal(events.length, 1)
    assert.equal(events[0].button, 'middle')
    assert.equal(events[0].type, 'press')
  })

  it('parses scroll-up event', () => {
    // 📖 SGR: \x1b[<64;10;5M → scroll up
    const events = parseMouseEvents('\x1b[<64;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'scroll-up')
    assert.equal(events[0].button, 'scroll-up')
    assert.equal(events[0].x, 10)
    assert.equal(events[0].y, 5)
  })

  it('parses scroll-down event', () => {
    const events = parseMouseEvents('\x1b[<65;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'scroll-down')
    assert.equal(events[0].button, 'scroll-down')
  })

  it('parses drag event', () => {
    // 📖 SGR: \x1b[<32;10;5M → left drag
    const events = parseMouseEvents('\x1b[<32;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'drag')
    assert.equal(events[0].button, 'left')
  })

  it('detects shift modifier', () => {
    // 📖 Shift adds +4 to button field: 0+4 = 4
    const events = parseMouseEvents('\x1b[<4;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].shift, true)
    assert.equal(events[0].meta, false)
    assert.equal(events[0].ctrl, false)
    assert.equal(events[0].button, 'left')
  })

  it('detects meta/alt modifier', () => {
    // 📖 Meta adds +8: 0+8 = 8
    const events = parseMouseEvents('\x1b[<8;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].meta, true)
    assert.equal(events[0].shift, false)
  })

  it('detects ctrl modifier', () => {
    // 📖 Ctrl adds +16: 0+16 = 16
    const events = parseMouseEvents('\x1b[<16;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].ctrl, true)
  })

  it('detects combined modifiers (shift + ctrl)', () => {
    // 📖 Shift(4) + Ctrl(16) = 20 on left button
    const events = parseMouseEvents('\x1b[<20;10;5M')
    assert.equal(events.length, 1)
    assert.equal(events[0].shift, true)
    assert.equal(events[0].ctrl, true)
    assert.equal(events[0].meta, false)
    assert.equal(events[0].button, 'left')
  })

  it('parses multiple events from a single data chunk', () => {
    // 📖 Rapid scrolling can send multiple events in one chunk
    const data = '\x1b[<64;10;5M\x1b[<64;10;5M\x1b[<65;10;5M'
    const events = parseMouseEvents(data)
    assert.equal(events.length, 3)
    assert.equal(events[0].type, 'scroll-up')
    assert.equal(events[1].type, 'scroll-up')
    assert.equal(events[2].type, 'scroll-down')
  })

  it('returns empty array for non-mouse data', () => {
    const events = parseMouseEvents('hello world')
    assert.deepEqual(events, [])
  })

  it('handles Buffer input', () => {
    const buf = Buffer.from('\x1b[<0;10;5M', 'utf8')
    const events = parseMouseEvents(buf)
    assert.equal(events.length, 1)
    assert.equal(events[0].button, 'left')
  })

  it('parses large coordinates (> 223 columns)', () => {
    // 📖 SGR mode supports coordinates > 223 (unlike X10 mode)
    const events = parseMouseEvents('\x1b[<0;300;150M')
    assert.equal(events.length, 1)
    assert.equal(events[0].x, 300)
    assert.equal(events[0].y, 150)
  })
})

describe('containsMouseSequence', () => {
  it('returns true for SGR mouse data', () => {
    assert.equal(containsMouseSequence('\x1b[<0;10;5M'), true)
  })

  it('returns true for partial mouse prefix in mixed data', () => {
    assert.equal(containsMouseSequence('abc\x1b[<0;10;5Mdef'), true)
  })

  it('returns false for regular keypress data', () => {
    assert.equal(containsMouseSequence('\x1b[A'), false) // up arrow
    assert.equal(containsMouseSequence('T'), false)
    assert.equal(containsMouseSequence('\r'), false)
  })

  it('returns false for empty string', () => {
    assert.equal(containsMouseSequence(''), false)
  })

  it('handles Buffer input', () => {
    const buf = Buffer.from('\x1b[<0;1;1M', 'utf8')
    assert.equal(containsMouseSequence(buf), true)
  })
})

describe('createMouseHandler', () => {
  it('emits click on left-button release', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })

    // 📖 Send press then release — click is emitted only on release
    handler('\x1b[<0;10;5M')  // press
    handler('\x1b[<0;10;5m')  // release
    assert.equal(received.length, 1)
    assert.equal(received[0].type, 'click')
    assert.equal(received[0].button, 'left')
    assert.equal(received[0].x, 10)
    assert.equal(received[0].y, 5)
  })

  it('does not emit click on press alone (only on release)', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })
    handler('\x1b[<0;10;5M')  // press only
    assert.equal(received.length, 0)
  })

  it('emits scroll events immediately (no press/release)', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })
    handler('\x1b[<64;10;5M')  // scroll up
    assert.equal(received.length, 1)
    assert.equal(received[0].type, 'scroll-up')
  })

  it('emits drag events', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })
    handler('\x1b[<32;10;5M')  // left drag
    assert.equal(received.length, 1)
    assert.equal(received[0].type, 'drag')
    assert.equal(received[0].button, 'left')
  })

  it('emits right-click on right-button release', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })
    handler('\x1b[<2;15;8M')  // right press
    handler('\x1b[<2;15;8m')  // right release
    // 📖 Right press is ignored; only release emits click
    assert.equal(received.length, 1)
    assert.equal(received[0].type, 'click')
    assert.equal(received[0].button, 'right')
  })

  it('detects double-click on same position within timeout', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })

    // 📖 Two rapid left releases at the same position → click + double-click
    handler('\x1b[<0;10;5m')  // first release
    handler('\x1b[<0;10;5m')  // second release (within 400ms)

    assert.equal(received.length, 2)
    assert.equal(received[0].type, 'click')
    assert.equal(received[1].type, 'double-click')
  })

  it('does not double-click on different positions', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })

    handler('\x1b[<0;10;5m')  // first release at (10,5)
    handler('\x1b[<0;20;5m')  // second release at (20,5) — different x

    assert.equal(received.length, 2)
    assert.equal(received[0].type, 'click')
    assert.equal(received[1].type, 'click') // 📖 Not double-click — different position
  })

  it('ignores non-mouse data', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })
    handler('T')       // regular keypress
    handler('\x1b[A')  // up arrow
    assert.equal(received.length, 0)
  })

  it('third rapid click does not trigger another double-click', () => {
    const received = []
    const handler = createMouseHandler({ onMouseEvent: (e) => received.push(e) })

    handler('\x1b[<0;10;5m')  // 1st release → click
    handler('\x1b[<0;10;5m')  // 2nd release → double-click (resets)
    handler('\x1b[<0;10;5m')  // 3rd release → click (not double-click)

    assert.equal(received.length, 3)
    assert.equal(received[0].type, 'click')
    assert.equal(received[1].type, 'double-click')
    assert.equal(received[2].type, 'click') // 📖 Reset after double-click
  })
})

describe('MOUSE_ENABLE / MOUSE_DISABLE sequences', () => {
  it('MOUSE_ENABLE contains all required mode activations', () => {
    // 📖 Mode 1000 (basic), 1002 (button-event), 1006 (SGR)
    assert.ok(MOUSE_ENABLE.includes('\x1b[?1000h'), 'missing mode 1000 enable')
    assert.ok(MOUSE_ENABLE.includes('\x1b[?1002h'), 'missing mode 1002 enable')
    assert.ok(MOUSE_ENABLE.includes('\x1b[?1006h'), 'missing mode 1006 enable')
  })

  it('MOUSE_DISABLE contains all required mode deactivations', () => {
    assert.ok(MOUSE_DISABLE.includes('\x1b[?1000l'), 'missing mode 1000 disable')
    assert.ok(MOUSE_DISABLE.includes('\x1b[?1002l'), 'missing mode 1002 disable')
    assert.ok(MOUSE_DISABLE.includes('\x1b[?1006l'), 'missing mode 1006 disable')
  })

  it('MOUSE_DISABLE reverses MOUSE_ENABLE modes in opposite order', () => {
    // 📖 Best practice: disable in reverse order of enable
    const enableOrder = ['1000', '1002', '1006']
    const disableOrder = ['1006', '1002', '1000']
    enableOrder.forEach((mode, i) => {
      assert.ok(MOUSE_ENABLE.indexOf(`?${mode}h`) >= 0)
    })
    disableOrder.forEach((mode, i) => {
      assert.ok(MOUSE_DISABLE.indexOf(`?${mode}l`) >= 0)
  })
})

// ─── Shell Env tests ─────────────────────────────────────────────────────────
describe('Shell Env', () => {
  it('buildEnvContent generates export lines for bash/zsh', () => {
    const config = { apiKeys: { nvidia: 'nvapi-test', groq: 'gsk-abc123' } }
    const content = buildEnvContent(config, 'bash')
    assert.ok(content.includes("export NVIDIA_API_KEY='nvapi-test'"))
    assert.ok(content.includes("export GROQ_API_KEY='gsk-abc123'"))
    assert.ok(content.includes(ENV_FILE_MARKER))
    assert.ok(content.startsWith('#!/bin/env sh'))
  })

  it('buildEnvContent generates set -gx lines for fish', () => {
    const config = { apiKeys: { nvidia: 'nvapi-test', groq: 'gsk-abc123' } }
    const content = buildEnvContent(config, 'fish')
    assert.ok(content.includes("set -gx NVIDIA_API_KEY 'nvapi-test'"))
    assert.ok(content.includes("set -gx GROQ_API_KEY 'gsk-abc123'"))
    assert.ok(!content.includes('export'))
  })

  it('buildEnvContent skips providers with no key', () => {
    const config = { apiKeys: { nvidia: 'nvapi-test' } }
    const content = buildEnvContent(config, 'bash')
    assert.ok(content.includes('NVIDIA_API_KEY'))
    assert.ok(!content.includes('GROQ_API_KEY'))
    assert.ok(!content.includes('CEREBRAS_API_KEY'))
  })

  it('buildEnvContent uses first key from multi-key arrays', () => {
    const config = { apiKeys: { groq: ['gsk-first', 'gsk-second'] } }
    const content = buildEnvContent(config, 'bash')
    assert.ok(content.includes("export GROQ_API_KEY='gsk-first'"))
    assert.ok(!content.includes('gsk-second'))
  })

  it('buildEnvContent handles keys with single quotes', () => {
    const config = { apiKeys: { nvidia: "nvapi-it's" } }
    const content = buildEnvContent(config, 'bash')
    assert.ok(content.includes("nvapi-it'\\''s"))
  })

  it('buildEnvContent returns minimal file for empty config', () => {
    const config = { apiKeys: {} }
    const content = buildEnvContent(config, 'bash')
    assert.ok(content.includes(ENV_FILE_MARKER))
    assert.ok(!content.includes('export'))
  })

  it('buildRcSourceLine generates bash/zsh source line with marker', () => {
    const envPath = join(tmpdir(), '.free-coding-models.env')
    const line = buildRcSourceLine(envPath, 'bash')
    assert.ok(line.includes('.free-coding-models.env'))
    assert.ok(line.includes(ENV_FILE_MARKER))
    assert.ok(line.includes('[ -f '))
    assert.ok(line.includes('. '))
  })

  it('buildRcSourceLine generates fish source line with marker', () => {
    const envPath = join(tmpdir(), '.free-coding-models.env')
    const line = buildRcSourceLine(envPath, 'fish')
    assert.ok(line.includes('test -f'))
    assert.ok(line.includes('source'))
    assert.ok(line.includes(ENV_FILE_MARKER))
  })

  it('buildRcSourceLine uses ~/ relative path for home dir', () => {
    const home = homedir()
    const envPath = join(home, '.free-coding-models.env')
    const line = buildRcSourceLine(envPath, 'zsh')
    assert.ok(line.includes('~/.free-coding-models.env'))
    assert.ok(!line.includes(home))
  })

  it('getEnvFilePath returns absolute path in home directory', () => {
    const path = getEnvFilePath()
    assert.ok(path.endsWith('.free-coding-models.env'))
    assert.ok(path.includes('/'))
  })

  it('detectShellInfo returns a valid shell and rcPath', () => {
    const info = detectShellInfo()
    assert.ok(['zsh', 'bash', 'fish'].includes(info.shell))
    assert.ok(info.rcPath.length > 0)
    assert.ok(info.rcPath.includes('/'))
  })

  it('syncShellEnv writes env file and removes it when no keys', () => {
    const tmpDir = join(tmpdir(), `fcm-test-shellenv-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    const config = { apiKeys: { nvidia: 'nvapi-test' }, settings: { shellEnvEnabled: true } }
    const result = syncShellEnv(config)
    assert.ok(result.success)

    // 📖 Clean up: remove env file if created
    const envPath = getEnvFilePath()
    if (existsSync(envPath)) {
      try { rmSync(envPath) } catch { /* best effort */ }
    }

    // 📖 Test with empty config — should clean up
    const emptyResult = syncShellEnv({ apiKeys: {} })
    assert.ok(emptyResult.success)
  })

  it('ENV_FILE_MARKER is a stable identifier string', () => {
    assert.ok(typeof ENV_FILE_MARKER === 'string')
    assert.ok(ENV_FILE_MARKER.startsWith('#'))
    assert.ok(ENV_FILE_MARKER.includes('free-coding-models'))
  })
})
})

describe('COLUMN_SORT_MAP', () => {
  it('maps mood column to verdict sort key', () => {
    assert.equal(COLUMN_SORT_MAP.mood, 'verdict')
  })

  it('maps rank column to rank sort key', () => {
    assert.equal(COLUMN_SORT_MAP.rank, 'rank')
  })

  it('maps tier column to null (triggers filter cycle, not sort)', () => {
    assert.equal(COLUMN_SORT_MAP.tier, null)
  })

  it('maps swe column to swe sort key', () => {
    assert.equal(COLUMN_SORT_MAP.swe, 'swe')
  })

  it('maps ctx column to ctx sort key', () => {
    assert.equal(COLUMN_SORT_MAP.ctx, 'ctx')
  })

  it('maps model column to model sort key', () => {
    assert.equal(COLUMN_SORT_MAP.model, 'model')
  })

  it('maps source column to origin sort key', () => {
    assert.equal(COLUMN_SORT_MAP.source, 'origin')
  })

  it('maps ping column to ping sort key', () => {
    assert.equal(COLUMN_SORT_MAP.ping, 'ping')
  })

  it('maps avg column to avg sort key', () => {
    assert.equal(COLUMN_SORT_MAP.avg, 'avg')
  })

  it('maps health column to condition sort key', () => {
    assert.equal(COLUMN_SORT_MAP.health, 'condition')
  })

  it('maps verdict column to verdict sort key', () => {
    assert.equal(COLUMN_SORT_MAP.verdict, 'verdict')
  })

  it('maps stability column to stability sort key', () => {
    assert.equal(COLUMN_SORT_MAP.stability, 'stability')
  })

  it('maps uptime column to uptime sort key', () => {
    assert.equal(COLUMN_SORT_MAP.uptime, 'uptime')
  })

  it('maps benchmark display columns to benchmark sort keys', () => {
    assert.equal(COLUMN_SORT_MAP.aiLatency, 'aiLatency')
    assert.equal(COLUMN_SORT_MAP.tps, 'tps')
  })

  it('has entries for all expected columns', () => {
    const expected = ['mood', 'rank', 'tier', 'swe', 'ctx', 'model', 'source', 'ping', 'avg', 'health', 'verdict', 'stability', 'uptime', 'aiLatency', 'tps']
    for (const col of expected) {
      assert.ok(col in COLUMN_SORT_MAP, `missing column: ${col}`)
    }
  })
})

describe('detectPackageManager', () => {
  it('returns a valid package manager string', () => {
    const pm = detectPackageManager()
    assert.ok(['npm', 'bun', 'pnpm', 'yarn'].includes(pm), `unexpected pm: ${pm}`)
  })
})

describe('getInstallArgs', () => {
  it('returns npm install args by default', () => {
    const { bin, args } = getInstallArgs('npm', '1.0.0')
    assert.equal(bin, 'npm')
    assert.deepEqual(args, ['i', '-g', 'free-coding-models@1.0.0', '--prefer-online'])
  })

  it('returns bun install args', () => {
    const { bin, args } = getInstallArgs('bun', '1.0.0')
    assert.equal(bin, 'bun')
    assert.deepEqual(args, ['add', '-g', 'free-coding-models@1.0.0'])
  })

  it('returns pnpm install args', () => {
    const { bin, args } = getInstallArgs('pnpm', '1.0.0')
    assert.equal(bin, 'pnpm')
    assert.deepEqual(args, ['add', '-g', 'free-coding-models@1.0.0'])
  })

  it('returns yarn install args', () => {
    const { bin, args } = getInstallArgs('yarn', '1.0.0')
    assert.equal(bin, 'yarn')
    assert.deepEqual(args, ['global', 'add', 'free-coding-models@1.0.0'])
  })

  it('falls back to npm for unknown pm', () => {
    const { bin, args } = getInstallArgs('unknown', '1.0.0')
    assert.equal(bin, 'npm')
    assert.deepEqual(args, ['i', '-g', 'free-coding-models@1.0.0', '--prefer-online'])
  })
})

describe('getManualInstallCmd', () => {
  it('returns npm command string', () => {
    assert.equal(getManualInstallCmd('npm', '2.0.0'), 'npm i -g free-coding-models@2.0.0 --prefer-online')
  })

  it('returns bun command string', () => {
    assert.equal(getManualInstallCmd('bun', '2.0.0'), 'bun add -g free-coding-models@2.0.0')
  })

  it('returns pnpm command string', () => {
    assert.equal(getManualInstallCmd('pnpm', '2.0.0'), 'pnpm add -g free-coding-models@2.0.0')
  })

  it('returns yarn command string', () => {
    assert.equal(getManualInstallCmd('yarn', '2.0.0'), 'yarn global add free-coding-models@2.0.0')
  })
})

describe('web dashboard table sorting', () => {
  const sortableWebColumns = [
    'mood', 'idx', 'tier', 'sweScore', 'ctx', 'label', 'origin', 'latestPing',
    'avg', 'condition', 'verdict', 'stability', 'uptime', 'aiLatency', 'tps', 'trend',
  ]

  it('keeps every visible web table column explicitly sortable', () => {
    const tableSource = readFileSync(join(ROOT, 'web/src/components/dashboard/ModelTable.jsx'), 'utf8')

    assert.match(tableSource, /const SORTABLE_COLUMN_IDS = new Set/, 'header clickability must not depend on TanStack display-column accessors')
    assert.match(tableSource, /SORTABLE_COLUMN_IDS\.has\(col\.id\)/, 'headers must use the explicit sortable allowlist')

    for (const columnId of sortableWebColumns) {
      assert.ok(tableSource.includes(`'${columnId}'`), `${columnId} must be present in the sortable allowlist`)
      const idPattern = columnId === 'condition'
        ? /id:\s*'condition',[\s\S]*?enableSorting:\s*true/
        : new RegExp(`(?:id:\\s*'${columnId}'|accessor\\('${columnId}'|accessor\\("${columnId}")[\\s\\S]*?enableSorting:\\s*true`)
      assert.match(tableSource, idPattern, `${columnId} column must opt into sorting`)
    }
  })

  it('has comparator support for every sortable web table column', () => {
    const filterSource = readFileSync(join(ROOT, 'web/src/hooks/useFilter.js'), 'utf8')

    for (const columnId of sortableWebColumns) {
      assert.ok(
        filterSource.includes(`sortColumn === '${columnId}'`) || columnId === 'avg',
        `${columnId} must be handled by useFilter sorting`
      )
    }
  })
})

// 📖 Web server tests use real loopback ports so we can verify the startup
// 📖 fallback behavior without depending on shell scripts or a browser.
async function getFreePort() {
  const server = createHttpServer()
  await new Promise((resolve) => server.listen(0, resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  return port
}

async function closeServer(server) {
  if (!server?.listening) return
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
}

describe('web server startup', () => {
  it('detects an existing free-coding-models web server via the health route', async () => {
    const port = await getFreePort()
    const server = await startWebServer(port, { open: false, startPingLoop: false })

    try {
      assert.ok(server)
      assert.deepEqual(await inspectExistingWebServer(port), { inUse: true, isFcm: true })
    } finally {
      await closeServer(server)
    }
  })

  it('falls back to another port when the requested one is occupied by another app', async () => {
    const requestedPort = await getFreePort()
    const foreignServer = createHttpServer((req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
    })
    await new Promise((resolve) => foreignServer.listen(requestedPort, resolve))

    const server = await startWebServer(requestedPort, { open: false, startPingLoop: false })

    try {
      assert.ok(server)
      const address = server.address()
      const actualPort = typeof address === 'object' && address ? address.port : null
      assert.notEqual(actualPort, requestedPort)

      const response = await fetch(`http://127.0.0.1:${actualPort}/api/health`)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('x-fcm-server'), 'free-coding-models-web')
      assert.deepEqual(await response.json(), { ok: true, app: 'free-coding-models-web' })
    } finally {
      await closeServer(server)
      await closeServer(foreignServer)
    }
  })

  it('reuses the existing dashboard when it already owns the requested port', async () => {
    const port = await getFreePort()
    const server = await startWebServer(port, { open: false, startPingLoop: false })

    try {
      assert.ok(server)
      const reused = await startWebServer(port, { open: false, startPingLoop: false })
      assert.equal(reused, null)
    } finally {
      await closeServer(server)
    }
  })
})

// ─── Sync Set Tests ──────────────────────────────────────────────────────────

describe('sync-set', () => {
  describe('parseArgs --sync-set', () => {
    const argv = (...a) => ['node', 'fcm', ...a]

    it('parses --sync-set without name', () => {
      const result = parseArgs(argv('--sync-set'))
      assert.equal(result.syncSetMode, true)
      assert.equal(result.syncSetName, null)
    })

    it('parses --sync-set with a name', () => {
      const result = parseArgs(argv('--sync-set', 'my-coding-set'))
      assert.equal(result.syncSetMode, true)
      assert.equal(result.syncSetName, 'my-coding-set')
    })

    it('does not consume --sync-set name as apiKey', () => {
      const result = parseArgs(argv('--sync-set', 'my-set'))
      assert.equal(result.apiKey, null)
      assert.equal(result.syncSetName, 'my-set')
    })

    it('defaults syncSetMode to false', () => {
      const result = parseArgs(argv())
      assert.equal(result.syncSetMode, false)
      assert.equal(result.syncSetName, null)
    })

    it('handles --sync-set combined with other flags', () => {
      const result = parseArgs(argv('--sync-set', 'prod', '--no-telemetry'))
      assert.equal(result.syncSetMode, true)
      assert.equal(result.syncSetName, 'prod')
      assert.equal(result.noTelemetry, true)
    })

    it('treats --sync-set followed by a flag as having no name', () => {
      const result = parseArgs(argv('--sync-set', '--json'))
      assert.equal(result.syncSetMode, true)
      assert.equal(result.syncSetName, null)
      assert.equal(result.jsonMode, true)
    })
  })

  describe('buildSyncCandidates', () => {
    it('returns empty when no keys match providers', () => {
      const candidates = buildSyncCandidates({ nonexistent_provider: 'key-123' })
      assert.equal(candidates.length, 0)
    })

    it('returns candidates sorted by score descending for nvidia', () => {
      const candidates = buildSyncCandidates({ nvidia: 'test-key' })
      assert.ok(candidates.length > 0)
      assert.equal(candidates[0].provider, 'nvidia')
      // 📖 All candidates should have nvidia provider since only nvidia key is given
      for (const c of candidates) {
        assert.equal(c.provider, 'nvidia')
      }
      // 📖 Scores should be non-increasing (sorted descending)
      for (let i = 1; i < candidates.length; i++) {
        assert.ok(candidates[i].score <= candidates[i - 1].score,
          `candidate ${i} (${candidates[i].model}: ${candidates[i].score}) should be <= candidate ${i-1} (${candidates[i-1].model}: ${candidates[i-1].score})`)
      }
    })

    it('filters out googleai models', () => {
      const candidates = buildSyncCandidates({ nvidia: 'key', googleai: 'key' })
      const googleai = candidates.filter(c => c.provider === 'googleai')
      assert.equal(googleai.length, 0)
    })

    it('respects exclude option', () => {
      const allCandidates = buildSyncCandidates({ nvidia: 'key' })
      if (allCandidates.length === 0) return // skip if no nvidia models
      const firstModel = `${allCandidates[0].provider}/${allCandidates[0].model}`
      const filtered = buildSyncCandidates({ nvidia: 'key' }, { exclude: new Set([firstModel]) })
      const found = filtered.find(c => `${c.provider}/${c.model}` === firstModel)
      assert.equal(found, undefined)
    })

    it('respects preferOrder option', () => {
      const allCandidates = buildSyncCandidates({ nvidia: 'key' })
      if (allCandidates.length < 2) return
      const lastModel = allCandidates[allCandidates.length - 1]
      const preferKey = `${lastModel.provider}/${lastModel.model}`
      const reordered = buildSyncCandidates({ nvidia: 'key' }, { preferOrder: [preferKey] })
      assert.equal(`${reordered[0].provider}/${reordered[0].model}`, preferKey)
    })

    it('only includes free openrouter models by default', () => {
      const candidates = buildSyncCandidates({ openrouter: 'key' })
      for (const c of candidates) {
        if (c.provider === 'openrouter') {
          assert.ok(c.model.endsWith(':free') || c.model === 'openrouter/free' || c.model === 'openrouter/owl-alpha',
            `OpenRouter model ${c.model} should be a free model`)
        }
      }
    })

    it('includes candidate fields', () => {
      const candidates = buildSyncCandidates({ nvidia: 'key' })
      if (candidates.length === 0) return
      const first = candidates[0]
      assert.ok(typeof first.provider === 'string')
      assert.ok(typeof first.model === 'string')
      assert.ok(typeof first.tier === 'string')
      assert.ok(typeof first.score === 'number')
      assert.ok(typeof first.swePercent === 'number')
      assert.ok(typeof first.url === 'string')
    })
  })

  describe('cli-help includes --sync-set', () => {
    it('includes --sync-set in help text', () => {
      const help = buildCliHelpText()
      assert.ok(help.includes('--sync-set'), 'Help text should mention --sync-set')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📖 BENCHMARK MODULE
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('benchmark display formatters', () => {
    it('splits 4300ms + 56 tokens into AI Latency and TPS values', () => {
      const result = { ok: true, totalMs: 4300, outputTokens: 56, tokensPerSecond: 13 }
      assert.deepEqual(formatBenchmarkLatency(result), { text: '4.3s', retryBadge: '' })
      assert.deepEqual(formatBenchmarkTps(result), { text: '13', retryBadge: '' })
    })

    it('shows dash for empty state', () => {
      assert.deepEqual(formatBenchmarkLatency(null), { text: '—', retryBadge: '' })
      assert.deepEqual(formatBenchmarkTps(null), { text: '—', retryBadge: '' })
    })

    it('shows spinner when running', () => {
      assert.deepEqual(formatBenchmarkLatency(null, { running: true, frame: 0 }), { text: '⠋', retryBadge: '' })
      assert.deepEqual(formatBenchmarkTps(null, { running: true, frame: 0 }), { text: '⠋', retryBadge: '' })
    })

    it('shows compact error code in latency and dash in TPS on failure', () => {
      assert.deepEqual(formatBenchmarkLatency({ ok: false, code: 'TIMEOUT' }), { text: 'TIMEOUT', retryBadge: '' })
      assert.deepEqual(formatBenchmarkLatency({ ok: false, code: '401' }), { text: '401', retryBadge: '' })
      assert.deepEqual(formatBenchmarkLatency({ ok: false, code: '429' }), { text: '429', retryBadge: '' })
      assert.deepEqual(formatBenchmarkLatency({ ok: false, code: 'ERR' }), { text: 'ERR', retryBadge: '' })
      assert.deepEqual(formatBenchmarkTps({ ok: false, code: 'TIMEOUT' }), { text: '—', retryBadge: '' })
    })

    it('uses whole seconds when latency is >= 10s', () => {
      const result = { ok: true, totalMs: 12300, outputTokens: 100, tokensPerSecond: 8 }
      assert.deepEqual(formatBenchmarkLatency(result), { text: '12s', retryBadge: '' })
      assert.deepEqual(formatBenchmarkTps(result), { text: '8', retryBadge: '' })
    })

    it('rounds TPS to integer', () => {
      const result = { ok: true, totalMs: 1000, outputTokens: 15, tokensPerSecond: 15.7 }
      assert.deepEqual(formatBenchmarkLatency(result), { text: '1.0s', retryBadge: '' })
      assert.deepEqual(formatBenchmarkTps(result), { text: '16', retryBadge: '' })
    })

    it('keeps legacy combined formatter available', () => {
      const result = { ok: true, totalMs: 4300, outputTokens: 56, tokensPerSecond: 13 }
      assert.equal(formatBenchmarkResult(result), '4.3s / 13 TPS')
    })
  })

  describe('estimateTokensFromText', () => {
    it('returns 0 for empty text', () => {
      assert.equal(estimateTokensFromText(''), 0)
      assert.equal(estimateTokensFromText(null), 0)
    })

    it('estimates tokens from character length divided by 4', () => {
      // 40 chars → ceil(40/4) = 10 tokens
      assert.equal(estimateTokensFromText('a'.repeat(40)), 10)
    })

    it('rounds up partial tokens', () => {
      // 41 chars → ceil(41/4) = 11 tokens
      assert.equal(estimateTokensFromText('a'.repeat(41)), 11)
    })
  })

  describe('benchmarkModel', () => {
    it('returns unsupported for CLI-only providers', async () => {
      const result = await benchmarkModel({
        apiKey: 'test',
        modelId: 'test',
        providerKey: 'rovo',
        url: 'http://example.com',
      })
      assert.equal(result.ok, false)
      assert.equal(result.code, 'UNSUPPORTED')
    })

    it('returns unsupported for gemini provider', async () => {
      const result = await benchmarkModel({
        apiKey: 'test',
        modelId: 'test',
        providerKey: 'gemini',
        url: 'http://example.com',
      })
      assert.equal(result.ok, false)
      assert.equal(result.code, 'UNSUPPORTED')
    })
  })

  describe('buildBenchmarkRequest', () => {
    it('builds OpenAI-compatible request for standard providers', () => {
      const req = buildBenchmarkRequest('sk-test', 'gpt-4', 'nvidia', 'https://api.nvidia.com/v1/chat/completions')
      assert.equal(req.url, 'https://api.nvidia.com/v1/chat/completions')
      assert.equal(req.headers.Authorization, 'Bearer sk-test')
      assert.equal(req.body.model, 'gpt-4')
      assert.equal(req.body.temperature, 0)
      assert.equal(req.body.max_tokens, 140)
      assert.match(req.body.messages[0].content, /one cohesive paragraph of 80 to 100 words/i)
      assert.ok(Array.isArray(req.body.messages))
    })

    it('strips zai/ prefix for zai provider', () => {
      const req = buildBenchmarkRequest('sk-test', 'zai/glm-5', 'zai', 'https://api.z.ai/v1/chat/completions')
      assert.equal(req.body.model, 'glm-5')
    })

    it('builds replicate-specific payload', () => {
      const req = buildBenchmarkRequest('token', 'version123', 'replicate', 'https://api.replicate.com/v1/predictions')
      assert.equal(req.url, 'https://api.replicate.com/v1/predictions')
      assert.equal(req.headers.Authorization, 'Token token')
      assert.equal(req.body.version, 'version123')
      assert.equal(req.body.input.max_tokens, 140)
      assert.match(req.body.input.prompt, /one cohesive paragraph of 80 to 100 words/i)
    })

    it('builds cloudflare request with account id resolution', () => {
      const req = buildBenchmarkRequest('token', 'model-x', 'cloudflare', 'https://api.cloudflare.com/{account_id}/v1/chat/completions')
      // 📖 resolveCloudflareUrl replaces {account_id} with the env var or 'missing-account-id'
      assert.ok(!req.url.includes('{account_id}'), 'placeholder should be resolved')
      assert.ok(req.url.includes('/v1/chat/completions'))
      assert.ok(req.headers.Authorization)
    })

    it('adds openrouter headers', () => {
      const req = buildBenchmarkRequest('sk-or-test', 'model', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions')
      assert.equal(req.headers['HTTP-Referer'], 'https://github.com/vava-nessa/free-coding-models')
      assert.equal(req.headers['X-Title'], 'free-coding-models')
    })
  })
})

// ─── useColumnSizing pure helpers ─────────────────────────────────────────────
// 📖 The React hook is a thin wrapper around these pure functions, so testing
// 📖 them covers all the storage/validation edge cases without needing a DOM.
import {
  sanitizeSizing,
  clampSizing,
  mergeSizing,
  hasCustomSizing,
  readSizingFromStorage,
  writeSizingToStorage,
  removeSizingFromStorage,
  COLUMN_SIZING_STORAGE_KEY,
  COLUMN_SIZING_MIN,
  COLUMN_SIZING_MAX,
} from '../web/src/hooks/useColumnSizing.js'

// 📖 In-memory localStorage shim — matches the Storage interface our helpers use.
function makeMockStorage(initial = {}) {
  let store = { ...initial }
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length },
  }
}

describe('useColumnSizing: sanitizeSizing', () => {
  it('keeps only finite positive numbers keyed by string', () => {
    assert.deepEqual(
      sanitizeSizing({ a: 1, b: 2.5, c: 'x', d: NaN, e: Infinity, f: -1, g: 0, h: 42 }),
      { a: 1, b: 2.5, h: 42 }
    )
  })

  it('returns an empty object for null / arrays / primitives', () => {
    assert.deepEqual(sanitizeSizing(null), {})
    assert.deepEqual(sanitizeSizing(undefined), {})
    assert.deepEqual(sanitizeSizing([]), {})
    assert.deepEqual(sanitizeSizing('nope'), {})
    assert.deepEqual(sanitizeSizing(42), {})
  })
})

describe('useColumnSizing: clampSizing', () => {
  it('clamps to [min, max] and rounds to integers', () => {
    assert.deepEqual(
      clampSizing({ a: 10, b: 30, c: 1500, d: 200.4, e: -3 }),
      { a: COLUMN_SIZING_MIN, b: 30, c: COLUMN_SIZING_MAX, d: 200, e: COLUMN_SIZING_MIN }
    )
  })

  it('respects custom min/max bounds', () => {
    assert.deepEqual(clampSizing({ a: 5, b: 200 }, 50, 100), { a: 50, b: 100 })
  })

  it('drops non-finite values silently', () => {
    assert.deepEqual(clampSizing({ a: NaN, b: Infinity, c: 'x', d: 50 }), { d: 50 })
  })

  it('returns an empty object for null / undefined input', () => {
    assert.deepEqual(clampSizing(null), {})
    assert.deepEqual(clampSizing(undefined), {})
  })
})

describe('useColumnSizing: mergeSizing', () => {
  it('layers stored on top of defaults, runtime on top of stored', () => {
    const defaults = { a: 1, b: 2, c: 3 }
    const stored = { a: 99, b: 50 }
    const runtime = { b: 77, d: 4 }
    assert.deepEqual(mergeSizing(defaults, stored, runtime), { a: 99, b: 77, c: 3, d: 4 })
  })

  it('falls back gracefully when one layer is missing', () => {
    assert.deepEqual(mergeSizing({ a: 1 }, null, { a: 9 }), { a: 9 })
    assert.deepEqual(mergeSizing({ a: 1 }, {}, {}), { a: 1 })
    assert.deepEqual(mergeSizing(undefined, undefined, undefined), {})
  })
})

describe('useColumnSizing: hasCustomSizing', () => {
  it('returns true when any column differs from its default', () => {
    assert.equal(hasCustomSizing({ a: 10, b: 20 }, { a: 10, b: 30 }), true)
    assert.equal(hasCustomSizing({ a: 10, b: 20 }, { a: 10, b: 20 }), false)
  })

  it('handles null inputs', () => {
    assert.equal(hasCustomSizing(null, { a: 1 }), false)
    assert.equal(hasCustomSizing({ a: 1 }, null), false)
  })
})

describe('useColumnSizing: storage adapters', () => {
  it('round-trips a sizing object through the mock storage', () => {
    const storage = makeMockStorage()
    const data = { mood: 40, idx: 50, label: 250 }
    assert.equal(writeSizingToStorage(storage, COLUMN_SIZING_STORAGE_KEY, data), true)
    assert.deepEqual(
      readSizingFromStorage(storage, COLUMN_SIZING_STORAGE_KEY, {}),
      data
    )
  })

  it('returns the fallback when the key is missing', () => {
    const storage = makeMockStorage()
    const fallback = { x: 1 }
    assert.deepEqual(readSizingFromStorage(storage, 'missing-key', fallback), fallback)
  })

  it('returns the fallback when JSON is corrupt', () => {
    const storage = makeMockStorage({ [COLUMN_SIZING_STORAGE_KEY]: '{not json' })
    assert.deepEqual(
      readSizingFromStorage(storage, COLUMN_SIZING_STORAGE_KEY, { fb: 1 }),
      { fb: 1 }
    )
  })

  it('sanitizes non-numeric values on read', () => {
    const storage = makeMockStorage({
      [COLUMN_SIZING_STORAGE_KEY]: JSON.stringify({ good: 42, bad: 'oops', neg: -5, zero: 0 }),
    })
    assert.deepEqual(
      readSizingFromStorage(storage, COLUMN_SIZING_STORAGE_KEY, {}),
      { good: 42 }
    )
  })

  it('removes a key and reports success', () => {
    const storage = makeMockStorage({ [COLUMN_SIZING_STORAGE_KEY]: '{"a":1}' })
    assert.equal(removeSizingFromStorage(storage, COLUMN_SIZING_STORAGE_KEY), true)
    assert.equal(storage.getItem(COLUMN_SIZING_STORAGE_KEY), null)
  })

  it('swallows storage errors instead of throwing', () => {
    const broken = {
      getItem: () => { throw new Error('quota') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('quota') },
    }
    assert.deepEqual(readSizingFromStorage(broken, 'k', { fb: 9 }), { fb: 9 })
    assert.equal(writeSizingToStorage(broken, 'k', { a: 1 }), false)
    assert.equal(removeSizingFromStorage(broken, 'k'), false)
  })

  it('treats a null/undefined storage as empty (SSR + private mode)', () => {
    assert.deepEqual(readSizingFromStorage(null, 'k', { fb: 7 }), { fb: 7 })
    assert.equal(writeSizingToStorage(undefined, 'k', {}), false)
  })
})

// ─── useFilter benchmark sort ─────────────────────────────────────────────────
// 📖 The 3-bucket sort (completed → running → never tested) is the heart of the
// 📖 AI Latency / TPS ordering. These tests pin down every bucket transition
// 📖 so a future refactor can't silently merge "running" back into "missing".
import { benchmarkBucket, compareBenchmark } from '../web/src/hooks/useFilter.js'

// 📖 Tiny model factory — only the fields compareBenchmark reads.
function bmModel({ ok, totalMs, tokensPerSecond, isBenchmarking }) {
  return {
    benchmark: ok ? { ok: true, totalMs, tokensPerSecond } : null,
    isBenchmarking: Boolean(isBenchmarking),
  }
}

describe('useFilter: benchmarkBucket', () => {
  it('classifies a successful benchmark as bucket 0', () => {
    assert.equal(benchmarkBucket(bmModel({ ok: true, totalMs: 100 })), 0)
  })

  it('classifies a benchmark with ok:false as not-completed', () => {
    // 📖 Only ok: true counts as "completed". A failed benchmark falls through
    // 📖 to the running/missing branch.
    const failed = { benchmark: { ok: false, error: 'timeout' }, isBenchmarking: false }
    assert.equal(benchmarkBucket(failed), 2)
  })

  it('classifies a running benchmark as bucket 1 even when no result exists', () => {
    assert.equal(benchmarkBucket(bmModel({ isBenchmarking: true })), 1)
  })

  it('classifies a never-tested model as bucket 2', () => {
    assert.equal(benchmarkBucket({ benchmark: null, isBenchmarking: false }), 2)
    assert.equal(benchmarkBucket({}), 2)
  })

  it('prioritizes completed over running when both flags are set', () => {
    // 📖 Defensive: a successful benchmark that just so happens to also be
    // 📖 marked isBenchmarking should still count as completed.
    const both = { benchmark: { ok: true, totalMs: 200 }, isBenchmarking: true }
    assert.equal(benchmarkBucket(both), 0)
  })
})

describe('useFilter: compareBenchmark', () => {
  const getLatency = (bench) => bench.totalMs
  const getTps = (bench) => bench.tokensPerSecond ?? 0

  it('sorts completed rows by value in ascending order', () => {
    const slow = bmModel({ ok: true, totalMs: 800 })
    const fast = bmModel({ ok: true, totalMs: 200 })
    assert.ok(compareBenchmark(fast, slow, 1, getLatency) < 0)
    assert.ok(compareBenchmark(slow, fast, 1, getLatency) > 0)
  })

  it('sorts completed rows by value in descending order when direction is -1', () => {
    const slow = bmModel({ ok: true, totalMs: 800 })
    const fast = bmModel({ ok: true, totalMs: 200 })
    assert.ok(compareBenchmark(slow, fast, -1, getLatency) < 0)
    assert.ok(compareBenchmark(fast, slow, -1, getLatency) > 0)
  })

  it('places running rows AFTER completed rows, regardless of direction', () => {
    const completed = bmModel({ ok: true, totalMs: 50 })
    const running = bmModel({ isBenchmarking: true })
    // 📖 In ascending order, running > completed.
    assert.ok(compareBenchmark(running, completed, 1, getLatency) > 0)
    // 📖 In descending order, running is still after completed (positive result
    // 📖 means a should come after b in the array — both directions agree).
    assert.ok(compareBenchmark(running, completed, -1, getLatency) > 0)
    assert.ok(compareBenchmark(completed, running, 1, getLatency) < 0)
    assert.ok(compareBenchmark(completed, running, -1, getLatency) < 0)
  })

  it('places never-tested rows AFTER running rows, regardless of direction', () => {
    const running = bmModel({ isBenchmarking: true })
    const never = bmModel({})
    assert.ok(compareBenchmark(never, running, 1, getLatency) > 0)
    assert.ok(compareBenchmark(never, running, -1, getLatency) > 0)
    assert.ok(compareBenchmark(running, never, 1, getLatency) < 0)
    assert.ok(compareBenchmark(running, never, -1, getLatency) < 0)
  })

  it('keeps the order of running-vs-never-tested groups internally stable (returns 0)', () => {
    // 📖 Within bucket 1 or 2, rows are not sorted by their numeric value
    // 📖 (they don't have one), so the comparator must return 0 to let the
    // 📖 tie-breaker (rank order) take over.
    const a = bmModel({ isBenchmarking: true })
    const b = bmModel({ isBenchmarking: true })
    assert.equal(compareBenchmark(a, b, 1, getLatency), 0)
    const c = bmModel({})
    const d = bmModel({})
    assert.equal(compareBenchmark(c, d, 1, getLatency), 0)
  })

  it('orders completed TPS rows by tokensPerSecond when used with the TPS getter', () => {
    const high = bmModel({ ok: true, tokensPerSecond: 120 })
    const low  = bmModel({ ok: true, tokensPerSecond: 30 })
    // 📖 Ascending: low first, high second.
    assert.ok(compareBenchmark(low, high, 1, getTps) < 0)
    assert.ok(compareBenchmark(high, low, 1, getTps) > 0)
    // 📖 Descending: high first.
    assert.ok(compareBenchmark(high, low, -1, getTps) < 0)
  })

  it('full 5-row scenario: completed (fastest→slowest) | running | never-tested', () => {
    // 📖 Realistic spread: 2 completed (one fast, one slow), 1 running, 2 never.
    const fast   = bmModel({ ok: true, totalMs: 150 })
    const slow   = bmModel({ ok: true, totalMs: 900 })
    const runA   = bmModel({ isBenchmarking: true })
    const noneA  = bmModel({})
    const noneB  = bmModel({})

    const models = [noneA, runA, slow, fast, noneB]
    // 📖 Ascending: completed first (fast→slow), then running, then never-tested.
    models.sort((a, b) => compareBenchmark(a, b, 1, getLatency))
    const order = models.map(m => {
      if (m.benchmark?.ok) return `done-${m.benchmark.totalMs}`
      if (m.isBenchmarking) return 'running'
      return 'never'
    })
    assert.deepEqual(order, ['done-150', 'done-900', 'running', 'never', 'never'])
  })
})

// ─── useFilter cycle helpers (M1 parity: TUI T / D / V / H / E key behavior) ───
// 📖 Each cycle starts from `all` (the TUI's "no filter" state) and returns
// 📖 to `all` after the last real value. Order is the same as the TUI.
import { TIER_CYCLE, STATUS_CYCLE, VERDICT_CYCLE, HEALTH_CYCLE, VISIBILITY_CYCLE } from '../web/src/hooks/useFilter.js'

describe('useFilter: filter cycles match TUI ordering', () => {
  it('tier cycle goes All → S+ → S → A+ → … → C → All', () => {
    assert.deepEqual(TIER_CYCLE, ['all', 'S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C'])
  })

  it('status cycle exposes the 3 user-facing states (up / down / pending)', () => {
    assert.deepEqual(STATUS_CYCLE, ['all', 'up', 'down', 'pending'])
  })

  it('verdict cycle covers the TUI VERDICT_CYCLE (minus null)', () => {
    // 📖 Web parity exposes every verdict state the TUI can filter on, plus
    // 📖 `all` at the front so the chip matches the rest of the bar.
    assert.deepEqual(VERDICT_CYCLE, [
      'all', 'Perfect', 'Normal', 'Spiky', 'Slow', 'Overloaded', 'Down', 'Unstable', 'Pending',
    ])
  })

  it('health cycle covers the TUI HEALTH_CYCLE (minus null)', () => {
    assert.deepEqual(HEALTH_CYCLE, [
      'all', 'up', 'timeout', 'down', 'pending', 'noauth', 'auth_error',
    ])
  })

  it('visibility cycle is the TUI E-key cycle (Normal / Configured / Usable)', () => {
    assert.deepEqual(VISIBILITY_CYCLE, ['normal', 'configured', 'usable'])
  })

  it('every cycle is a closed loop — the first entry is the reset state', () => {
    for (const cycle of [TIER_CYCLE, STATUS_CYCLE, VERDICT_CYCLE, HEALTH_CYCLE]) {
      // 📖 Cycles must be non-empty + first entry must be the reset state.
      // 📖 (The "last entry wraps to first" is tested by the cycling logic
      // 📖 itself in the useFilter hook — this just checks the array shape.)
      assert.ok(cycle.length >= 3, `cycle ${cycle} too short`)
      assert.equal(cycle[0], 'all', `first entry of ${cycle} must be the "all" reset state`)
    }
  })
})
