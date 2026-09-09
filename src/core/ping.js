/**
 * @file ping.js
 * @description HTTP ping infrastructure for model availability and latency measurement.
 *
 * @details
 *   This module provides functions for sending ping requests to model providers,
 *   extracting quota information from response headers, and managing provider
 *   endpoint quota polling with caching.
 *
 *   🎯 Key features:
 *   - Provider-specific request building (handles Replicate, Cloudflare, OpenRouter,
 *     OpenCode Zen mandatory session header)
 *   - Async ping with timeout and abort controller
 *   - Quota extraction from rate limit headers (multiple variants supported)
 *   - Cached provider quota polling with TTL and error backoff
 *   - Cloudflare account ID resolution from environment
 *   - Per-provider circuit-breaker on 429 (issue #146): pauses ALL models of a provider
 *     when the provider returns a quota-exhausted response, so the ping loop stops
 *     hammering the user's daily quota while the provider's retry window is active.
 *
 *   → Functions:
 *   - `getProviderSessionHeaders`: Extra mandatory headers per provider (e.g. OpenCode Zen session id)
 *   - `resolveCloudflareUrl`: Resolve {account_id} placeholder from CLOUDFLARE_ACCOUNT_ID env var
 *   - `buildChatCompletionPingBody`: Build minimal chat-completion probe payloads with thinking disabled
 *   - `markDisabledThinkingUnsupported`: Cache strict providers that reject the optional thinking control
 *   - `shouldUseDisabledThinkingForProvider`: Decide whether a provider should receive disabled-thinking probes
 *   - `buildPingRequest`: Build provider-specific HTTP request for pinging
 *   - `ping`: Send async ping request with timeout; returns { code, ms, quotaPercent }
 *   - `getHeaderValue`: Helper to extract header value from Headers object or plain object
 *   - `extractQuotaPercent`: Parse rate limit headers to calculate remaining quota percentage
 *   - `fetchProviderQuotaPercent`: Fetch quota for a provider from dedicated endpoint/headers
 *   - `getProviderQuotaPercentCached`: Wrapper for cached provider quota fetching
 *   - `usagePlaceholderForProvider`: Return display token for Usage column based on provider behavior
 *
 *   📦 Dependencies:
 *   - ../src/constants.js: PING_TIMEOUT
 *   - ../src/provider-quota-fetchers.js: _fetchProviderQuotaFromModule (quota fetching with cache)
 *   - ../src/quota-capabilities.js: supportsUsagePercent
 *   - ./provider-cooldown.js: pauseProviderQuota, extractRetryAfterFromResponse (issue #146)
 *
 *   ⚙️ Configuration:
 *   - PING_TIMEOUT: Timeout in ms for ping requests (default: 15000)
 *   - CLOUDFLARE_ACCOUNT_ID: Env var for Cloudflare Workers AI account ID
 *
 *   @see {@link ../src/provider-quota-fetchers.js} Quota fetching implementation
 *   @see {@link ../src/quota-capabilities.js} Quota telemetry + Usage behavior detection
 */

import { randomUUID } from 'node:crypto'
import { PING_TIMEOUT } from './constants.js'
import { fetchProviderQuota as _fetchProviderQuotaFromModule, extractQuota as _extractQuotaFromModule, processResponseHeaders as _processResponseHeadersFromModule } from './provider-quota-fetchers.js'
import { supportsUsagePercent } from './quota-capabilities.js'
import {
  extractRetryAfterFromResponse,
  pauseProviderQuota,
} from './provider-cooldown.js'

const DISABLED_THINKING_RETRY_STATUSES = new Set([400, 422])
const disabledThinkingUnsupportedProviders = new Set()

// 📖 resolveCloudflareUrl: Cloudflare's OpenAI-compatible endpoint is account-scoped.
// 📖 We resolve the placeholder from the CLOUDFLARE_ACCOUNT_ID env var so provider
// 📖 setup can stay simple in config. Supports both the `{account_id}` placeholder
// 📖 and the explicit `{$CLOUDFLARE_ACCOUNT_ID}` form used in sources.js.
export function resolveCloudflareUrl(url) {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const hasPlaceholder = url.includes('{$CLOUDFLARE_ACCOUNT_ID}') || url.includes('{account_id}')
  if (!hasPlaceholder) return url
  const replacement = accountId ? encodeURIComponent(accountId) : 'missing-account-id'
  return url
    .replace(/\{\$CLOUDFLARE_ACCOUNT_ID\}/g, replacement)
    .replace(/\{account_id\}/g, replacement)
}

// 📖 buildChatCompletionPingBody: Use the smallest useful chat-completion probe.
// 📖 The explicit thinking toggle prevents reasoning-capable endpoints from spending
// 📖 hidden tokens or adding thinking latency when we only need availability + RTT.
export function buildChatCompletionPingBody(modelId, overrides = {}, options = {}) {
  const body = {
    model: modelId,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 1,
    thinking: { type: 'disabled' },
    ...overrides,
  }
  if (options.disableThinking === false) delete body.thinking
  return body
}

// 📖 markDisabledThinkingUnsupported: remember strict providers that reject the
// 📖 optional `thinking` field so future pings avoid repeated 400/422 retries.
export function markDisabledThinkingUnsupported(providerKey) {
  if (providerKey) disabledThinkingUnsupportedProviders.add(providerKey)
}

// 📖 shouldUseDisabledThinkingForProvider: central policy for OpenAI-compatible
// 📖 probes, shared by regular pings and router health probes.
export function shouldUseDisabledThinkingForProvider(providerKey) {
  if (providerKey === 'cerebras' || providerKey === 'mistral' || providerKey === 'groq' || providerKey === 'sambanova') return false
  return !disabledThinkingUnsupportedProviders.has(providerKey)
}

// 📖 getProviderSessionHeaders: extra mandatory headers a provider requires beyond
// 📖 the standard Content-Type/Authorization pair, centralised so probes (ping.js),
// 📖 the router daemon and the web dashboard all send identical headers instead of
// 📖 duplicating per-provider knowledge (issue #181).
// 📖 OpenCode Zen rejects every request without an `x-opencode-session` header with
// 📖 HTTP 400 MissingSessionID ("OpenCode's free tier can only be used in OpenCode").
// 📖 The Zen docs describe a stable per-conversation session id, so we generate ONE
// 📖 uuid per process at module load: every request this process sends shares the
// 📖 same identity, mirroring how the real OpenCode client behaves and keeping the
// 📖 value stable across repeated probes.
const OPENCODE_ZEN_SESSION_ID = randomUUID()

export function getProviderSessionHeaders(providerKey) {
  if (providerKey === 'opencode-zen') {
    return { 'x-opencode-session': OPENCODE_ZEN_SESSION_ID }
  }
  return {}
}

// 📖 buildPingRequest: Build provider-specific ping request.
// 📖 Handles Replicate's /v1/predictions format, Cloudflare's account_id in URL,
// 📖 and standard OpenAI-compliant chat completions with provider-specific headers.
export function buildPingRequest(apiKey, modelId, providerKey, url, options = {}) {
  // 📖 ZAI models are stored as "zai/glm-..." in sources.js but the API expects just "glm-..."
  const apiModelId = providerKey === 'zai' ? modelId.replace(/^zai\//, '') : modelId

  if (providerKey === 'replicate') {
    // 📖 Replicate uses /v1/predictions with a different payload than OpenAI chat-completions.
    const replicateHeaders = { 'Content-Type': 'application/json', Prefer: 'wait=4' }
    if (apiKey) replicateHeaders.Authorization = `Token ${apiKey}`
    return {
      url,
      headers: replicateHeaders,
      body: { version: modelId, input: { prompt: 'hi' } },
    }
  }

  if (providerKey === 'cloudflare') {
    // 📖 Cloudflare Workers AI uses OpenAI-compatible payload but needs account_id in URL.
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    return {
      url: resolveCloudflareUrl(url),
      headers,
      body: buildChatCompletionPingBody(apiModelId, {}, {
        disableThinking: options.disableThinking ?? shouldUseDisabledThinkingForProvider(providerKey),
      }),
    }
  }

  const headers = { 'Content-Type': 'application/json', ...getProviderSessionHeaders(providerKey) }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (providerKey === 'openrouter') {
    // 📖 OpenRouter recommends optional app identification headers.
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }
  if (providerKey === 'orcarouter') {
    // 📖 OrcaRouter uses the same app-identification convention as OpenRouter.
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }

  return {
    url,
    headers,
    body: buildChatCompletionPingBody(apiModelId, {}, {
      disableThinking: options.disableThinking ?? shouldUseDisabledThinkingForProvider(providerKey),
    }),
  }
}

// 📖 sendPingFetch: keep retry code tiny and ensure both attempts use the same abort signal.
async function sendPingFetch(req, signal) {
  return fetch(req.url, {
    method: 'POST', signal,
    headers: req.headers,
    body: JSON.stringify(req.body),
  })
}

// 📖 isDisabledThinkingRejected: strict OpenAI-compatible gateways may reject
// 📖 unknown root fields. We only retry when the status and error text names
// 📖 the optional `thinking` control, avoiding retries for real model failures.
async function isDisabledThinkingRejected(resp, req) {
  if (!req?.body?.thinking || !DISABLED_THINKING_RETRY_STATUSES.has(resp.status)) return false
  try {
    const text = await resp.clone().text()
    return /thinking/i.test(text)
  } catch {
    return false
  }
}

// 📖 ping: Send a single chat completion request to measure model availability and latency.
// 📖 providerKey and url determine provider-specific request format.
// 📖 apiKey can be null — in that case no Authorization header is sent.
// 📖 A 401 response still tells us the server is UP and gives us real latency.
// 📖 Returns { code, ms, quotaPercent }
export async function ping(apiKey, modelId, providerKey, url) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT)
  const t0    = performance.now()
  try {
    let req = buildPingRequest(apiKey, modelId, providerKey, url)
    let resp = await sendPingFetch(req, ctrl.signal)
    if (await isDisabledThinkingRejected(resp, req)) {
      markDisabledThinkingUnsupported(providerKey)
      req = buildPingRequest(apiKey, modelId, providerKey, url, { disableThinking: false })
      resp = await sendPingFetch(req, ctrl.signal)
    }
    // 📖 Provider circuit-breaker (issue #146): openrouter + similar gateways rate-limit
    // 📖 at the provider/key level, not per-model. A 429 means the WHOLE key is paused,
    // 📖 often for hours — re-pinging every model every 2-30s would burn the quota in minutes.
    // 📖 Honour Retry-After header + the OpenRouter body "try again N seconds later".
    if (resp.status === 429) {
      const retryMs = await extractRetryAfterFromResponse(resp)
      if (retryMs > 0) pauseProviderQuota(providerKey, retryMs)
    }
    // 📖 Normalize all HTTP 2xx statuses to "200" so existing verdict/avg logic still works.
    const code = resp.status >= 200 && resp.status < 300 ? '200' : String(resp.status)
    // 📖 Passive quota tracker (t2): parse the response headers via the shared module.
    // 📖 1) Write to the passive snapshot map so /stats + TUI footer see live quota.
    // 📖 2) Return the percent number for the per-call consumer below.
    const extracted = _extractQuotaFromModule(resp.headers)
    _processResponseHeadersFromModule(providerKey, resp.headers)
    return {
      code,
      ms: Math.round(performance.now() - t0),
      quotaPercent: extracted ? extracted.percent : null,
    }
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    return {
      code: isTimeout ? '000' : 'ERR',
      ms: isTimeout ? 'TIMEOUT' : Math.round(performance.now() - t0),
      quotaPercent: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

// 📖 getHeaderValue: Helper to extract header value from Headers object or plain object.
// 📖 Returns null if headers is null or key is not found.
function getHeaderValue(headers, key) {
  if (!headers) return null
  if (typeof headers.get === 'function') return headers.get(key)
  return headers[key] ?? headers[key.toLowerCase()] ?? null
}

// 📖 extractQuotaPercent: Parse rate limit headers to calculate remaining quota percentage.
// 📖 Checks multiple header variants (x-ratelimit-*, ratelimit-*, etc.).
// 📖 Returns value clamped 0–100, or null if quota headers not present.
export function extractQuotaPercent(headers) {
  const variants = [
    ['x-ratelimit-remaining', 'x-ratelimit-limit'],
    ['x-ratelimit-remaining-requests', 'x-ratelimit-limit-requests'],
    ['x-ratelimit-remaining-requests-day', 'x-ratelimit-limit-requests-day'],
    ['x-ratelimit-remaining-tokens', 'x-ratelimit-limit-tokens'],
    ['x-ratelimit-remaining-tokens-minute', 'x-ratelimit-limit-tokens-minute'],
    ['ratelimit-remaining', 'ratelimit-limit'],
    ['ratelimit-remaining-requests', 'ratelimit-limit-requests'],
  ]

  for (const [remainingKey, limitKey] of variants) {
    const remainingRaw = getHeaderValue(headers, remainingKey)
    const limitRaw = getHeaderValue(headers, limitKey)
    const remaining = parseFloat(remainingRaw)
    const limit = parseFloat(limitRaw)
    if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) {
      const pct = Math.round((remaining / limit) * 100)
      return Math.max(0, Math.min(100, pct))
    }
  }

  return null
}

// ─── Provider endpoint quota polling ─────────────────────────────────────────

// 📖 fetchProviderQuotaPercent: Fetch quota for a provider from dedicated endpoint/headers.
// 📖 Delegates to unified module entrypoint (handles openrouter + siliconflow + others).
// 📖 The module implements TTL cache and error backoff internally.
export async function fetchProviderQuotaPercent(providerKey, apiKey) {
  return _fetchProviderQuotaFromModule(providerKey, apiKey)
}

// 📖 getProviderQuotaPercentCached: Wrapper for cached provider quota fetching.
// 📖 The module already implements TTL cache and error backoff internally.
// 📖 This wrapper preserves the existing call-site API from bin/free-coding-models.js.
export async function getProviderQuotaPercentCached(providerKey, apiKey) {
  return fetchProviderQuotaPercent(providerKey, apiKey)
}

// 📖 usagePlaceholderForProvider: Return display token for Usage column.
// 📖 '--' means this provider can expose a real remaining percentage once telemetry arrives.
// 📖 '🟢' means the provider is usable, but a live remaining % is not applicable/reliable.
export function usagePlaceholderForProvider(providerKey) {
  return supportsUsagePercent(providerKey) ? '--' : '🟢'
}
