/**
 * @file benchmark.js
 * @description Real-answer benchmark for measuring model response speed and throughput.
 *
 * @details
 *   This module sends a single small chat completion to a model and measures:
 *   - Total wall-clock response time (ms)
 *   - Output tokens generated
 *   - Tokens per second (TPS)
 *
 *   🎯 Key features:
 *   - Provider-specific request building (reuses buildPingRequest from ping.js)
 *   - Async benchmark with timeout and abort controller
 *   - Prefers `usage.completion_tokens` from the API response
 *   - Falls back to character-length estimate when usage is missing
 *   - Returns structured success/failure objects for TUI consumption
 *
 *   → Functions:
 *   - `buildBenchmarkRequest`: Build provider-specific benchmark request
 *   - `benchmarkModel`: Run a single benchmark and return timing + token metrics
 *   - `formatBenchmarkLatency`: Format benchmark latency for the AI Latency TUI column
 *   - `formatBenchmarkTps`: Format benchmark throughput for the TPS TUI column
 *   - `formatBenchmarkResult`: Legacy combined formatter for compatibility
 *   - `estimateTokensFromText`: Fallback token estimator (clearly labeled)
 *
 *   📦 Dependencies:
 *   - ./ping.js: buildPingRequest, resolveCloudflareUrl
 *
 *   @see {@link ./ping.js} Provider-specific request building
 *   @see {@link ./render-table.js} AI Latency + TPS column rendering
 */

import { buildPingRequest, resolveCloudflareUrl } from './ping.js'

// 📖 BENCHMARK_PROMPT: A deterministic one-paragraph task that any model can answer.
// 📖 The longer target gives latency + TPS measurements enough generated tokens to be reliable.
export const BENCHMARK_PROMPT = 'Why is the sky blue? Answer in exactly one cohesive paragraph of 80 to 100 words. Do not use bullet points, headings, or multiple paragraphs.'

// 📖 BENCHMARK_MAX_TOKENS: Hard cap high enough for a real paragraph, but low enough
// 📖 to avoid accidental essays when benchmarking many models at once.
export const BENCHMARK_MAX_TOKENS = 140

// 📖 BENCHMARK_TEMPERATURE: Zero temperature for deterministic, reproducible results.
export const BENCHMARK_TEMPERATURE = 0

// 📖 BENCHMARK_TIMEOUT_MS: How long to wait before treating a benchmark attempt as timed out.
export const BENCHMARK_TIMEOUT_MS = 20_000

// 📖 BENCHMARK_MAX_RETRIES: Number of attempts before giving up. Models that are timeout,
// 📖 429, or temporarily down may succeed on a later attempt — this is the whole point.
export const BENCHMARK_MAX_RETRIES = 3

// 📖 BENCHMARK_RETRY_DELAY_MS: Wait time between failed attempts so the server can recover.
export const BENCHMARK_RETRY_DELAY_MS = 15_000

// 📖 estimateTokensFromText: Fallback token counter when the API does not return usage.
// 📖 Uses a simple heuristic: avg English token ≈ 4 chars. This is explicitly an ESTIMATE
// 📖 and is labeled as such everywhere it surfaces. Do not use for billing.
export function estimateTokensFromText(text) {
  if (!text || typeof text !== 'string') return 0
  return Math.ceil(text.length / 4)
}

// 📖 benchmarkSpinner: Shared tiny spinner for benchmark columns while a request runs.
function benchmarkSpinner(frame) {
  const spinIdx = frame % 10
  return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][spinIdx]
}

// 📖 retryBadge: compact retry indicator appended to latency when > 0 attempts failed.
function retryBadge(retries) {
  return (typeof retries === 'number' && retries > 0) ? `↻${retries}` : ''
}

// 📖 formatBenchmarkLatency: Returns { text, retryBadge } so the renderer can color
// 📖 the retry badge independently (blue) vs the latency value (green).
export function formatBenchmarkLatency(result, { running = false, frame = 0 } = {}) {
  if (running) return { text: benchmarkSpinner(frame), retryBadge: '' }
  if (!result) return { text: '—', retryBadge: '' }
  if (!result.ok) return { text: result.code || 'ERR', retryBadge: '' }

  const totalSeconds = result.totalMs / 1000
  const badge = retryBadge(result.retries)
  const latency = totalSeconds >= 10
    ? totalSeconds.toFixed(0) + 's'
    : totalSeconds.toFixed(1) + 's'
  return { text: latency, retryBadge: badge }
}

// 📖 formatBenchmarkTps: Returns { text, retryBadge } so the renderer can color
// 📖 the retry badge independently (blue) vs the TPS value (green).
export function formatBenchmarkTps(result, { running = false, frame = 0 } = {}) {
  if (running) return { text: benchmarkSpinner(frame), retryBadge: '' }
  if (!result || !result.ok) return { text: '—', retryBadge: '' }
  const badge = retryBadge(result.retries)
  return { text: String(Math.round(result.tokensPerSecond ?? 0)), retryBadge: badge }
}

// 📖 formatBenchmarkResult: legacy combined formatter retained for integrations/tests
// 📖 that still expect the old single-column "latency / TPS" string.
export function formatBenchmarkResult(result, options = {}) {
  if (options.running) return benchmarkSpinner(options.frame ?? 0)
  if (!result) return '—'
  if (!result.ok) return result.code || 'ERR'
  const lat = formatBenchmarkLatency(result)
  const tps = formatBenchmarkTps(result)
  return `${lat.text}${lat.retryBadge} / ${tps.text}${tps.retryBadge} TPS`
}

// 📖 buildBenchmarkRequest: Build provider-specific benchmark request.
// 📖 Reuses the ping module's request builder but swaps the payload for a real
// 📖 completion with temperature=0 and max_tokens=32.
export function buildBenchmarkRequest(apiKey, modelId, providerKey, url) {
  // 📖 ZAI models are stored as "zai/glm-..." in sources.js but the API expects just "glm-..."
  const apiModelId = providerKey === 'zai' ? modelId.replace(/^zai\//, '') : modelId

  if (providerKey === 'replicate') {
    const replicateHeaders = { 'Content-Type': 'application/json', Prefer: 'wait=4' }
    if (apiKey) replicateHeaders.Authorization = `Token ${apiKey}`
    return {
      url,
      headers: replicateHeaders,
      body: { version: modelId, input: { prompt: BENCHMARK_PROMPT, max_tokens: BENCHMARK_MAX_TOKENS } },
    }
  }

  if (providerKey === 'cloudflare') {
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    return {
      url: resolveCloudflareUrl(url),
      headers,
      body: {
        model: apiModelId,
        messages: [{ role: 'user', content: BENCHMARK_PROMPT }],
        max_tokens: BENCHMARK_MAX_TOKENS,
        temperature: BENCHMARK_TEMPERATURE,
      },
    }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (providerKey === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }

  return {
    url,
    headers,
    body: {
      model: apiModelId,
      messages: [{ role: 'user', content: BENCHMARK_PROMPT }],
      max_tokens: BENCHMARK_MAX_TOKENS,
      temperature: BENCHMARK_TEMPERATURE,
    },
  }
}

// 📖 benchmarkModel: Send one real completion request and measure response speed.
// 📖
// 📖 Returns on success:
// 📖   {
// 📖     ok: true,
// 📖     totalMs: 4300,
// 📖     outputTokens: 56,
// 📖     tokensPerSecond: 13,
// 📖     answerPreview: "The sky is blue because..."
// 📖   }
// 📖
// 📖 Returns on failure:
// 📖   {
// 📖     ok: false,
// 📖     code: "TIMEOUT" | "ERR" | "401" | "429" | "UNSUPPORTED",
// 📖     totalMs: 15000,
// 📖     error: "Request timed out"
// 📖   }
// 📖 benchmarkSingleAttempt: One HTTP attempt. Extracted so the retry loop stays clean.
async function benchmarkSingleAttempt({ apiKey, modelId, providerKey, url, timeoutMs }) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const t0 = performance.now()

  try {
    const req = buildBenchmarkRequest(apiKey, modelId, providerKey, url)
    const resp = await fetch(req.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: req.headers,
      body: JSON.stringify(req.body),
    })

    const totalMs = Math.round(performance.now() - t0)

    // 📖 Parse response body regardless of HTTP status so we can extract partial data
    let bodyText = ''
    try { bodyText = await resp.text() } catch {}
    let data = null
    try { data = JSON.parse(bodyText) } catch {}

    // 📖 Non-2xx: return compact error code
    if (!resp.ok) {
      const code = String(resp.status)
      return {
        ok: false,
        code,
        totalMs,
        error: data?.error?.message || `HTTP ${resp.status}`,
      }
    }

    // 📖 Extract generated text from OpenAI-compatible response
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || ''
    const answerPreview = typeof content === 'string' ? content.slice(0, 60) : ''

    // 📖 Prefer usage.completion_tokens when available
    let outputTokens = 0
    if (data?.usage?.completion_tokens != null) {
      outputTokens = Number(data.usage.completion_tokens) || 0
    } else {
      outputTokens = estimateTokensFromText(content)
    }

    const seconds = totalMs / 1000
    const tokensPerSecond = seconds > 0 ? outputTokens / seconds : 0

    return {
      ok: true,
      totalMs,
      outputTokens,
      tokensPerSecond,
      answerPreview,
    }
  } catch (err) {
    const totalMs = Math.round(performance.now() - t0)
    const isTimeout = err.name === 'AbortError'
    return {
      ok: false,
      code: isTimeout ? 'TIMEOUT' : 'ERR',
      totalMs,
      error: isTimeout ? 'Request timed out' : (err.message || 'Network error'),
    }
  } finally {
    clearTimeout(timer)
  }
}

// 📖 benchmarkModel: Retry wrapper — up to BENCHMARK_MAX_RETRIES attempts with
// 📖 BENCHMARK_RETRY_DELAY_MS between failures. Models that are timeout, 429, down,
// 📖 or auth-failing may succeed on a later attempt. The `retries` field in the
// 📖 result tells the TUI how many attempts were needed (0 = first try, 2 = 3rd try).
// 📖
// 📖 Returns on success:
// 📖   { ok: true, totalMs, outputTokens, tokensPerSecond, answerPreview, retries }
// 📖
// 📖 Returns on failure (all attempts exhausted):
// 📖   { ok: false, code, totalMs, error, retries }
export async function benchmarkModel({ apiKey, modelId, providerKey, url, timeoutMs = BENCHMARK_TIMEOUT_MS, maxRetries = BENCHMARK_MAX_RETRIES, retryDelayMs = BENCHMARK_RETRY_DELAY_MS }) {
  // 📖 Guard: unsupported providers that don't do chat completions
  if (providerKey === 'rovo' || providerKey === 'gemini' || providerKey === 'opencode-zen') {
    return {
      ok: false,
      code: 'UNSUPPORTED',
      totalMs: 0,
      error: 'Provider does not support chat completions',
      retries: 0,
    }
  }

  let lastResult = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    lastResult = await benchmarkSingleAttempt({ apiKey, modelId, providerKey, url, timeoutMs })

    // 📖 Success — return immediately with retry count
    if (lastResult.ok) {
      lastResult.retries = attempt
      return lastResult
    }

    // 📖 Failed — wait before retrying (skip delay on last attempt)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    }
  }

  // 📖 All attempts failed — return last error with retry count
  lastResult.retries = maxRetries - 1
  return lastResult
}
