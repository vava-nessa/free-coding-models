/**
 * @file lib/provider-quota-fetchers.js
 * @description Provider endpoint quota pollers for publicly available endpoints.
 *
 * Supported providers:
 *   - openrouter: GET https://openrouter.ai/api/v1/key
 *       derives percent from limit_remaining/limit (with fallback field names)
 *   - siliconflow: GET https://api.siliconflow.cn/v1/user/info
 *       returns balance info; percent is null (no limit field to derive from)
 *
 * Features:
 *   - TTL cache (default 60s) prevents hammering endpoints
 *   - Error backoff (default 15s) after failures
 *   - Injectable fetch + time for testing
 *   - API keys are never logged
 *
 * @exports parseOpenRouterResponse(data) → number|null
 * @exports parseSiliconFlowResponse(data) → { balance, chargeBalance, totalBalance }|null
 * @exports createProviderQuotaFetcher(options) → fetcher(providerKey, apiKey) → Promise<number|null>
 * @exports fetchProviderQuota(providerKey, apiKey, options) → Promise<number|null>
 */

// ─── Response parsers (pure, no I/O) ─────────────────────────────────────────

import { createHash } from 'node:crypto'

/**
 * Parse an OpenRouter /api/v1/key response into a quota percent [0,100] or null.
 *
 * The endpoint may wrap fields in a `data` object or return them at root.
 * Field precedence:
 *   1. limit_remaining / limit
 *   2. remaining / total_limit
 *   3. remaining_credits / credits
 *
 * @param {unknown} responseData - Parsed JSON from the endpoint
 * @returns {number|null} Integer percent 0–100, or null when not derivable
 */
export function parseOpenRouterResponse(responseData) {
  if (responseData == null || typeof responseData !== 'object') return null

  // Unwrap .data if present, fall back to root
  const root = responseData.data != null && typeof responseData.data === 'object'
    ? responseData.data
    : responseData

  // Try field pairs in priority order
  const pairs = [
    ['limit_remaining', 'limit'],
    ['remaining', 'total_limit'],
    ['remaining_credits', 'credits'],
  ]

  for (const [remainingKey, limitKey] of pairs) {
    const remaining = parseFloat(root[remainingKey])
    const limit = parseFloat(root[limitKey])
    if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) {
      const pct = Math.round((remaining / limit) * 100)
      return Math.max(0, Math.min(100, pct))
    }
  }

  return null
}

/**
 * Parse a SiliconFlow /v1/user/info response.
 *
 * SiliconFlow does not expose a credit/quota limit, only the current balance.
 * A percentage cannot be reliably derived without knowing the original limit.
 *
 * Returns an object with raw balance fields when the response is well-formed,
 * or null when the response is missing/malformed/error.
 *
 * Callers may use { percent: null } as a signal that the provider responded
 * successfully but quota percentage is not available.
 *
 * @param {unknown} responseData - Parsed JSON from the endpoint
 * @returns {{ balance: number, chargeBalance: number, totalBalance: number, percent: null }|null}
 */
export function parseSiliconFlowResponse(responseData) {
  if (responseData == null || typeof responseData !== 'object') return null

  // SiliconFlow wraps payload in .data; code 20000 = success
  const data = responseData.data
  if (data == null || typeof data !== 'object') return null

  // Require a success indicator
  const code = responseData.code
  const status = responseData.status
  if (code !== 20000 && status !== true) return null

  const balance = parseFloat(data.balance)
  const chargeBalance = parseFloat(data.chargeBalance)
  const totalBalance = parseFloat(data.totalBalance)

  // All three fields must be numeric to be valid
  if (!Number.isFinite(balance) || !Number.isFinite(chargeBalance) || !Number.isFinite(totalBalance)) {
    return null
  }

  // We cannot derive a reliable percent without a "limit" (initial balance) field.
  // Return structured balance info with percent: null.
  return {
    balance,
    chargeBalance,
    totalBalance,
    percent: null,
  }
}

// ─── TTL cache + backoff ──────────────────────────────────────────────────────

/**
 * Create an in-memory cache entry.
 * @param {number|null} value
 * @param {number} expiresAt - Date.now() timestamp
 * @returns {{ value: number|null, expiresAt: number }}
 */
function makeCacheEntry(value, expiresAt) {
  return { value, expiresAt }
}

// ─── Endpoint definitions ─────────────────────────────────────────────────────

const OPENROUTER_KEY_ENDPOINT = 'https://openrouter.ai/api/v1/key'
const SILICONFLOW_USER_ENDPOINT = 'https://api.siliconflow.cn/v1/user/info'

/**
 * @param {string} apiKey
 * @param {Function} fetchFn - injectable fetch
 * @returns {Promise<number|null>} quota percent or null
 */
async function fetchOpenRouterRaw(apiKey, fetchFn) {
  const resp = await fetchFn(OPENROUTER_KEY_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/vava-nessa/free-coding-models',
      'X-Title': 'free-coding-models',
    },
    signal: AbortSignal.timeout(5000),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  return parseOpenRouterResponse(data)
}

/**
 * @param {string} apiKey
 * @param {Function} fetchFn - injectable fetch
 * @returns {Promise<number|null>} quota percent (always null for SiliconFlow) or null on error
 */
async function fetchSiliconFlowRaw(apiKey, fetchFn) {
  const resp = await fetchFn(SILICONFLOW_USER_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(5000),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  const parsed = parseSiliconFlowResponse(data)
  // percent is always null for SiliconFlow (no limit field)
  return parsed !== null ? parsed.percent : null
}

// ─── Module-level default cache (used by fetchProviderQuota) ──────────────────

const DEFAULT_CACHE_TTL_MS = 60_000
const DEFAULT_ERROR_BACKOFF_MS = 15_000
/** @type {Map<string, { value: number|null, expiresAt: number, pendingPromise?: Promise<number|null> }>} */
const _defaultCache = new Map()

/**
 * Build a collision-resistant cache key from providerKey + apiKey.
 * Uses SHA-256 of the full apiKey so that keys sharing the same suffix
 * (e.g. 'account-A-SHARED12' vs 'account-B-SHARED12') do not collide.
 * The raw API key is never stored or logged.
 *
 * @param {string} providerKey
 * @param {string} apiKey
 * @returns {string}
 */
function makeCacheKey(providerKey, apiKey) {
  const hash = createHash('sha256').update(apiKey).digest('hex').slice(0, 16)
  return `${providerKey}:${hash}`
}

// ─── createProviderQuotaFetcher ───────────────────────────────────────────────

/**
 * Create a stateful fetcher with its own TTL cache and error backoff.
 *
 * @param {object} [options]
 * @param {Function} [options.fetchFn=fetch] - injectable fetch (defaults to global fetch)
 * @param {number} [options.cacheTtlMs=60000] - TTL for successful results
 * @param {number} [options.errorBackoffMs=15000] - TTL after errors (prevents spam)
 * @returns {(providerKey: string, apiKey: string) => Promise<number|null>}
 */
export function createProviderQuotaFetcher({ fetchFn = fetch, cacheTtlMs = DEFAULT_CACHE_TTL_MS, errorBackoffMs = DEFAULT_ERROR_BACKOFF_MS } = {}) {
  /** @type {Map<string, { value: number|null, expiresAt: number, pendingPromise?: Promise<number|null> }>} */
  const cache = new Map()

  return async function fetcherInstance(providerKey, apiKey) {
    if (!apiKey) return null

    // Cache key uses a hash of the full key to avoid suffix-collision bugs
    const cacheKey = makeCacheKey(providerKey, apiKey)
    const now = Date.now()
    const cached = cache.get(cacheKey)

    // Reuse in-flight promise to prevent duplicate concurrent requests
    if (cached?.pendingPromise) {
      return cached.pendingPromise
    }

    // Return cached value if still fresh
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    // Dispatch to provider-specific fetcher
    const doFetch = providerKey === 'openrouter'
      ? () => fetchOpenRouterRaw(apiKey, fetchFn)
      : providerKey === 'siliconflow'
        ? () => fetchSiliconFlowRaw(apiKey, fetchFn)
        : null

    if (!doFetch) return null

    const pendingPromise = doFetch()
      .then((value) => {
        const finalValue = (typeof value === 'number' && Number.isFinite(value)) ? value : null
        cache.set(cacheKey, makeCacheEntry(finalValue, Date.now() + cacheTtlMs))
        return finalValue
      })
      .catch(() => {
        cache.set(cacheKey, makeCacheEntry(null, Date.now() + errorBackoffMs))
        return null
      })

    // Store pending promise to coalesce concurrent calls
    cache.set(cacheKey, {
      value: cached?.value ?? null,
      expiresAt: cached?.expiresAt ?? 0,
      pendingPromise,
    })

    return pendingPromise
  }
}

// ─── fetchProviderQuota (top-level convenience, uses module-level default cache) ──

/**
 * Fetch provider quota percent for a given provider + API key.
 *
 * Supported providers: 'openrouter', 'siliconflow'.
 * All other providers return null immediately.
 *
 * Options:
 *   - fetchFn: injectable fetch for testing (bypasses module-level cache when provided)
 *   - cacheTtlMs / errorBackoffMs: only used when fetchFn is provided (creates isolated fetcher)
 *
 * When called WITHOUT fetchFn, uses the module-level cache shared across all calls.
 *
 * @param {string} providerKey
 * @param {string} apiKey
 * @param {object} [options]
 * @param {Function} [options.fetchFn] - injectable fetch; when provided, creates a per-call fetcher
 * @param {number} [options.cacheTtlMs]
 * @param {number} [options.errorBackoffMs]
 * @returns {Promise<number|null>}
 */
export async function fetchProviderQuota(providerKey, apiKey, options = {}) {
  if (!apiKey) return null
  if (providerKey !== 'openrouter' && providerKey !== 'siliconflow') return null

  const { fetchFn, cacheTtlMs = DEFAULT_CACHE_TTL_MS, errorBackoffMs = DEFAULT_ERROR_BACKOFF_MS } = options

  // When a custom fetchFn is provided, create an isolated fetcher (for testing)
  if (fetchFn) {
    const fetcher = createProviderQuotaFetcher({ fetchFn, cacheTtlMs, errorBackoffMs })
    return fetcher(providerKey, apiKey)
  }

  // Default path: use module-level cache
  const cacheKey = makeCacheKey(providerKey, apiKey)
  const now = Date.now()
  const cached = _defaultCache.get(cacheKey)

  if (cached?.pendingPromise) return cached.pendingPromise
  if (cached && cached.expiresAt > now) return cached.value

  const doFetch = providerKey === 'openrouter'
    ? () => fetchOpenRouterRaw(apiKey, fetch)
    : () => fetchSiliconFlowRaw(apiKey, fetch)

  const pendingPromise = doFetch()
    .then((value) => {
      const finalValue = (typeof value === 'number' && Number.isFinite(value)) ? value : null
      _defaultCache.set(cacheKey, makeCacheEntry(finalValue, Date.now() + cacheTtlMs))
      return finalValue
    })
    .catch(() => {
      _defaultCache.set(cacheKey, makeCacheEntry(null, Date.now() + errorBackoffMs))
      return null
    })

  _defaultCache.set(cacheKey, {
    value: cached?.value ?? null,
    expiresAt: cached?.expiresAt ?? 0,
    pendingPromise,
  })

  return pendingPromise
}
