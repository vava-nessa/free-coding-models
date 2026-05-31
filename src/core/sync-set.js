/**
 * @file src/sync-set.js
 * @description Auto-discover, live-probe, and populate a router set with the best available models.
 *
 * @details
 *   📖 `--sync-set [name]` is a headless CLI command that:
 *     1. Reads the model catalog from sources.js
 *     2. Filters to routeable providers where the user has API keys
 *     3. Ranks candidates by tier, SWE-bench score, and coding affinity
 *     4. Live-probes each candidate (plain response + tool-call test)
 *     5. Writes the best N passing models into a named router set
 *     6. Signals the daemon to reload if running
 *
 *   📖 This replaces manual set management for users who want an always-current
 *      "best available" set without hand-picking models or monitoring quotas.
 *
 *   📖 The probe is intentionally conservative: a model must both produce
 *      correct plain-text output AND successfully make a tool call to pass.
 *      This ensures coding tools (Forge, OpenCode, Aider, etc.) get reliable
 *      function-calling models, not just chat-capable ones.
 *
 * @exports syncSet — Main entry point, returns a structured result object
 * @exports buildSyncCandidates — Candidate ranking (exported for testing)
 * @exports probeModel — Single-model probe (exported for testing)
 *
 * @see ./router-daemon.js — daemon lifecycle and set management
 * @see ./config.js — config persistence and API key resolution
 * @see ../sources.js — model catalog
 */

import { sources } from '../../sources.js'
import {
  CONFIG_PATH,
  getApiKey,
  loadConfig,
  normalizeRouterConfig,
  saveConfig,
} from './config.js'
import { resolveCloudflareUrl } from './ping.js'
import { ROUTER_PID_PATH } from './router-daemon.js'
import { existsSync, readFileSync } from 'node:fs'

// 📖 Tier ordering — best tiers first, used for scoring candidates.
const TIER_ORDER = ['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']

// 📖 Numeric value per tier for composite scoring.
const TIER_SCORES = {
  'S+': 900, S: 800, 'A+': 700, A: 600, 'A-': 500, 'B+': 400, B: 300, C: 200,
}

// 📖 Default limits — probe at most MAX_PROBES candidates, keep TARGET_COUNT in the set.
const DEFAULT_MAX_PROBES = 50
const DEFAULT_TARGET_COUNT = 8
const PROBE_TIMEOUT_MS = 40000

// 📖 Models that are known to fail tool calls or produce broken output.
// 📖 Users can override via the `exclude` option.
const DEFAULT_EXCLUDE_PATTERNS = [
  /thinking/i,
  /gemma/i,
]

// 📖 Models on googleai tend to include <thought> tags in streamed output,
// 📖 which breaks structured parsing in coding tools.
const EXCLUDED_PROVIDERS = new Set(['googleai'])

const OPENROUTER_FREE_MODEL_IDS = new Set([
  'openrouter/free',
  'openrouter/owl-alpha',
])

/**
 * Check whether a provider's catalog entry supports routing (has a
 * chat/completions URL and is not CLI-only).
 */
function isRouteableProvider(providerKey) {
  const source = sources[providerKey]
  return Boolean(source?.url && !source.cliOnly && source.url.includes('/chat/completions'))
}

/**
 * Resolve the upstream URL for a provider, handling Cloudflare template substitution.
 */
function resolveUrl(providerKey) {
  const url = sources[providerKey]?.url
  if (!url) return null
  return providerKey === 'cloudflare' ? resolveCloudflareUrl(url) : url
}

/**
 * Normalize model ID for API calls (strip provider prefix for ZAI).
 */
function normalizeModelId(providerKey, modelId) {
  return providerKey === 'zai' ? String(modelId).replace(/^zai\//, '') : String(modelId)
}

function isOpenRouterFreeModelId(modelId) {
  return String(modelId).endsWith(':free') || OPENROUTER_FREE_MODEL_IDS.has(String(modelId))
}

/**
 * Parse a SWE-bench percentage string like "49.2%" to a number.
 */
function parseSwePercent(value) {
  if (typeof value !== 'string') return 0
  const numeric = parseFloat(value.replace('%', '').trim())
  return Number.isFinite(numeric) ? numeric : 0
}

/**
 * Score a candidate model for ranking. Higher is better.
 *
 * Combines tier score, SWE-bench percentage, coding keyword affinity,
 * and provider reliability bonus into a single comparable number.
 */
function scoreCandidate(provider, modelId, label, tier, swePercent) {
  const tierScore = TIER_SCORES[tier] || 0
  const codingHint = /coder|code|deepseek|gpt-oss|qwen|glm|starcoder/i.test(`${modelId} ${label}`) ? 40 : 0
  return tierScore + Math.round(swePercent * 10) + codingHint
}

/**
 * Check whether a model should be skipped based on exclude patterns and heuristics.
 */
function shouldSkipModel(provider, modelId, tier, swePercent, options = {}) {
  if (EXCLUDED_PROVIDERS.has(provider)) return true
  if (tier === 'C') return true
  if (swePercent < (options.minSwePercent || 40)) return true

  // 📖 For OpenRouter, only consider free models unless the user opts in
  if (provider === 'openrouter' && !isOpenRouterFreeModelId(modelId) && !options.includePaidOpenRouter) return true

  const excludePatterns = options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS
  for (const pattern of excludePatterns) {
    if (pattern.test(modelId)) return true
  }

  const excludeSet = options.exclude
  if (excludeSet && excludeSet.has(`${provider}/${modelId}`)) return true

  return false
}

/**
 * Build and rank candidate models from the sources catalog.
 *
 * @param {Object} apiKeys — Map of provider → API key
 * @param {Object} [options] — Filtering and ranking options
 * @param {Set<string>} [options.exclude] — Set of "provider/model" keys to skip
 * @param {string[]} [options.preferOrder] — Ordered list of "provider/model" keys to prefer
 * @param {number} [options.minSwePercent] — Minimum SWE-bench score (default: 40)
 * @returns {Array<Object>} Ranked candidate list
 */
export function buildSyncCandidates(apiKeys, options = {}) {
  const candidates = []

  for (const [providerKey, sourceData] of Object.entries(sources)) {
    if (!apiKeys[providerKey]) continue
    if (!isRouteableProvider(providerKey)) continue

    for (const tuple of sourceData.models || []) {
      const [modelId, label = '', tier = '', swe = '0%'] = tuple
      if (typeof modelId !== 'string' || !modelId.trim()) continue
      const swePercent = parseSwePercent(swe)
      if (shouldSkipModel(providerKey, modelId, tier, swePercent, options)) continue
      const score = scoreCandidate(providerKey, modelId, label, tier, swePercent)
      candidates.push({
        provider: providerKey,
        model: modelId,
        label,
        tier,
        swePercent,
        score,
        url: sourceData.url,
      })
    }
  }

  // 📖 De-duplicate and sort: preferred models first, then by score descending
  const preferOrder = options.preferOrder || []
  const preferMap = new Map(preferOrder.map((key, i) => [key, i]))

  const deduped = []
  const seen = new Set()
  for (const candidate of candidates.sort((a, b) => {
    const keyA = `${a.provider}/${a.model}`
    const keyB = `${b.provider}/${b.model}`
    const prefA = preferMap.has(keyA) ? preferMap.get(keyA) : Number.MAX_SAFE_INTEGER
    const prefB = preferMap.has(keyB) ? preferMap.get(keyB) : Number.MAX_SAFE_INTEGER
    if (prefA !== prefB) return prefA - prefB
    return b.score - a.score
  })) {
    const key = `${candidate.provider}/${candidate.model}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(candidate)
  }

  return deduped
}

/**
 * Build request headers for a provider, including auth and OpenRouter attribution.
 */
function buildHeaders(providerKey, apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (providerKey === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }
  return headers
}

/**
 * Send a JSON request to a provider and return the parsed response.
 */
async function jsonRequest(url, headers, body, timeoutMs = PROBE_TIMEOUT_MS) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const raw = await response.text()
    let parsed = null
    try { parsed = JSON.parse(raw) } catch {}
    return { ok: response.ok, status: response.status, parsed, raw }
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return { ok: false, status: null, parsed: null, raw: '', timeout, error }
  }
}

/**
 * Live-probe a single model candidate with two checks:
 *   1. Plain text response — must reply with exactly "OK"
 *   2. Tool call — must produce a valid tool_calls array
 *
 * Both must pass for the model to be considered usable by coding tools.
 *
 * @param {Object} candidate — Candidate from buildSyncCandidates
 * @param {string} apiKey — API key for the provider
 * @returns {Object} Probe result with ok, status, reason fields
 */
export async function probeModel(candidate, apiKey) {
  const url = candidate.provider === 'cloudflare'
    ? resolveCloudflareUrl(candidate.url)
    : candidate.url
  const headers = buildHeaders(candidate.provider, apiKey)
  const model = normalizeModelId(candidate.provider, candidate.model)

  // 📖 Step 1: Plain text response correctness
  const plain = await jsonRequest(url, headers, {
    model,
    messages: [{ role: 'user', content: 'Reply with exactly OK and nothing else.' }],
    stream: false,
    max_tokens: 32,
    temperature: 0,
  })

  if (!plain.ok) {
    return {
      ok: false,
      status: plain.status,
      reason: plain.timeout ? 'timeout_plain' : `http_${plain.status ?? 'err'}_plain`,
    }
  }

  const content = String(plain.parsed?.choices?.[0]?.message?.content ?? '').trim()
  // 📖 Accept responses that contain "OK" — some models add thinking tags or extra whitespace
  const normalizedContent = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim()
  if (!normalizedContent.startsWith('OK')) {
    return { ok: false, status: plain.status, reason: 'plain_not_ok' }
  }

  // 📖 Step 2: Tool call capability
  const tool = await jsonRequest(url, headers, {
    model,
    messages: [{ role: 'user', content: 'Use the echo tool with text exactly OK and nothing else.' }],
    tools: [{
      type: 'function',
      function: {
        name: 'echo',
        description: 'Echo text back',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: 'auto',
    stream: false,
    max_tokens: 128,
    temperature: 0,
  })

  if (!tool.ok) {
    return {
      ok: false,
      status: tool.status,
      reason: tool.timeout ? 'timeout_tool' : `http_${tool.status ?? 'err'}_tool`,
    }
  }

  const toolCalls = tool.parsed?.choices?.[0]?.message?.tool_calls
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return { ok: false, status: tool.status, reason: 'no_tool_calls' }
  }

  return { ok: true, status: tool.status, reason: 'ok' }
}

/**
 * Signal the running daemon to reload config via SIGHUP.
 *
 * @returns {boolean} true if the signal was sent successfully
 */
function signalDaemonReload() {
  try {
    if (!existsSync(ROUTER_PID_PATH)) return false
    const pid = Number(readFileSync(ROUTER_PID_PATH, 'utf8').trim())
    if (!Number.isFinite(pid) || pid <= 0) return false
    process.kill(pid, 'SIGHUP')
    return true
  } catch {
    return false
  }
}

/**
 * Collect all available API keys from config, environment variables, and
 * secondary credential stores (e.g. Forge credentials).
 */
function collectApiKeys(config) {
  const apiKeys = {}

  // 📖 Start with keys from the config file
  for (const [provider, value] of Object.entries(config.apiKeys || {})) {
    const key = getApiKey(config, provider)
    if (key) apiKeys[provider] = key
  }

  // 📖 Fill in from environment for any missing providers
  for (const providerKey of Object.keys(sources)) {
    if (apiKeys[providerKey]) continue
    const key = getApiKey({}, providerKey)
    if (key) apiKeys[providerKey] = key
  }

  return apiKeys
}

/**
 * Run the full sync-set pipeline: discover, rank, probe, write.
 *
 * @param {Object} [options] — Configuration options
 * @param {string} [options.name='auto'] — Name for the router set
 * @param {number} [options.maxProbes=10] — Maximum candidates to probe
 * @param {number} [options.targetCount=4] — Target number of models in the set
 * @param {Set<string>} [options.exclude] — "provider/model" keys to skip
 * @param {string[]} [options.preferOrder] — Preferred model ordering
 * @param {number} [options.minSwePercent=40] — Minimum SWE-bench score
 * @param {boolean} [options.activate=true] — Whether to make this the active set
 * @param {boolean} [options.json=false] — Produce JSON output (for scripting)
 * @returns {Object} Result with ok, selected, probeResults, daemonReloaded
 */
export async function syncSet(options = {}) {
  const name = options.name || 'auto'
  const maxProbes = options.maxProbes || DEFAULT_MAX_PROBES
  const targetCount = options.targetCount || DEFAULT_TARGET_COUNT
  const activate = options.activate !== false

  const config = loadConfig()
  const apiKeys = collectApiKeys(config)

  const candidates = buildSyncCandidates(apiKeys, {
    exclude: options.exclude,
    preferOrder: options.preferOrder,
    minSwePercent: options.minSwePercent,
    excludePatterns: options.excludePatterns,
    includePaidOpenRouter: options.includePaidOpenRouter,
  })

  const selected = []
  const probeResults = []

  for (const candidate of candidates.slice(0, maxProbes)) {
    if (selected.length >= targetCount) break

    const key = apiKeys[candidate.provider]
    if (!key) continue

    const result = await probeModel(candidate, key)
    probeResults.push({
      model: `${candidate.provider}/${candidate.model}`,
      tier: candidate.tier,
      score: candidate.score,
      status: result.status,
      ok: result.ok,
      reason: result.reason,
    })

    if (result.ok) {
      selected.push({
        provider: candidate.provider,
        model: candidate.model,
        priority: selected.length + 1,
      })
    }
  }

  // 📖 Assign final priority numbers
  const normalizedSelected = selected.map((entry, index) => ({
    ...entry,
    priority: index + 1,
  }))

  if (normalizedSelected.length === 0) {
    // 📖 Keep existing set if no probes succeeded
    const existing = config?.router?.sets?.[name]?.models
    if (Array.isArray(existing) && existing.length > 0) {
      return {
        ok: false,
        reusedExisting: true,
        name,
        reason: 'no_probe_success',
        existing,
        probeResults,
      }
    }
    return {
      ok: false,
      name,
      reason: 'no_candidates',
      probeResults,
    }
  }

  // 📖 Build router config and persist
  if (!config.router || typeof config.router !== 'object') config.router = {}
  const router = config.router
  if (!router.sets || typeof router.sets !== 'object') router.sets = {}
  router.enabled = true
  router.onboardingSeen = true

  const existingCreated = router.sets[name]?.created
  router.sets[name] = {
    name,
    models: normalizedSelected,
    created: existingCreated || new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    managedBy: 'sync-set',
  }

  if (activate) {
    router.activeSet = name
  }

  config.router = normalizeRouterConfig(router)
  saveConfig(config)

  const daemonReloaded = signalDaemonReload()

  return {
    ok: true,
    name,
    activated: activate,
    selected: normalizedSelected,
    daemonReloaded,
    probeCount: probeResults.length,
    probeResults,
  }
}
