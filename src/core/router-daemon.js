/**
 * @file router-daemon.js
 * @description Smart Model Router daemon for local OpenAI-compatible failover routing.
 *
 * @details
 *   📖 The router daemon is the persistent part of FCM: coding tools point at
 *   `http://localhost:19280/v1`, send `model: "fcm"`, and this server forwards
 *   the request to the healthiest configured provider/model in the active set.
 *
 *   📖 It deliberately uses only Node built-ins and the existing provider catalog
 *   so the npm package keeps its tiny dependency surface. The daemon stores only
 *   metadata (latency, status, token counts); request and response bodies are
 *   never written to logs or telemetry.
 *
 * @functions
 *   → runRouterDaemon() — Start the foreground daemon HTTP server
 *   → startRouterDaemonBackground() — Spawn the daemon detached from the TUI
 *   → stopRouterDaemon() — Send SIGTERM to the recorded daemon process
 *   → getRouterDaemonStatus() — Discover and read `/health` from a running daemon
 *   → buildDefaultRouterSet() — Create the first priority-ordered model set
 *   → formatOpenAiError() — Build OpenAI-compatible error response payloads
 *   → createRouterRuntimeForTest() — Build an isolated runtime for mock-upstream tests
 *
 * @exports runRouterDaemon, startRouterDaemonBackground, stopRouterDaemon
 * @exports getRouterDaemonStatus, buildDefaultRouterSet, formatOpenAiError
 * @exports createRouterRuntimeForTest
 *
 * @see ./config.js — router config is persisted under `router`
 * @see ../sources.js — provider URLs and model IDs are resolved from the catalog
 */

import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { MODELS, sources } from '../../sources.js'
import {
  CONFIG_PATH,
  DEFAULT_ROUTER_SETTINGS,
  getApiKey,
  isProviderEnabled,
  loadConfig,
  normalizeRouterConfig,
  saveConfig,
} from './config.js'
import { buildChatCompletionPingBody, ping, resolveCloudflareUrl, shouldUseDisabledThinkingForProvider } from './ping.js'
import { benchmarkModel, BENCHMARK_TIMEOUT_MS } from './benchmark.js'
import { sendUsageTelemetry } from './telemetry.js'

export const ROUTER_DEFAULT_PORT = 19280
export const ROUTER_MAX_PORT = 19289
export const ROUTER_DEFAULT_PORT_DEV = 29280
export const ROUTER_MAX_PORT_DEV = 29289

// 📖 Dev mode uses -dev suffixed files so the local dev daemon never clashes
// 📖 with a production install running on the same machine.
const _dev = typeof process.env.FCM_DEV !== 'undefined' ? !!process.env.FCM_DEV : false
export const ROUTER_PID_PATH = join(homedir(), `.free-coding-models-daemon${_dev ? '-dev' : ''}.pid`)
export const ROUTER_PORT_PATH = join(homedir(), `.free-coding-models-daemon${_dev ? '-dev' : ''}.port`)
export const ROUTER_LOG_PATH = join(homedir(), `.free-coding-models-daemon${_dev ? '-dev' : ''}.log`)
export const ROUTER_TOKENS_PATH = join(homedir(), `.free-coding-models-tokens${_dev ? '-dev' : ''}.json`)

// 📖 Returns effective port range for current mode (dev vs production)
export function getRouterPortRange() {
  return _dev
    ? { defaultPort: ROUTER_DEFAULT_PORT_DEV, maxPort: ROUTER_MAX_PORT_DEV }
    : { defaultPort: ROUTER_DEFAULT_PORT, maxPort: ROUTER_MAX_PORT }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ENTRY_PATH = join(__dirname, '..', '..', 'bin', 'free-coding-models.js')
const LOCAL_VERSION = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')).version
const MAX_BODY_BYTES = 10 * 1024 * 1024
const MAX_REQUEST_LOG = 200
const MAX_SSE_CLIENTS = 10
const MAX_CONCURRENT_REQUESTS = 50
const MAX_PROBE_WINDOW = 20
const TOKEN_FLUSH_INTERVAL_MS = 60000
const CONFIG_RELOAD_INTERVAL_MS = 10000
const STATS_RETENTION_DAYS = 90
const TIER_ORDER = ['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503])
const AUTH_STATUS_CODES = new Set([401, 403])
const RATE_LIMIT_HEADER_NAMES = [
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-ratelimit-limit-requests',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-reset-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-tokens',
]

function nowIso() {
  return new Date().toISOString()
}

function modelKey(provider, model) {
  return `${provider}/${model}`
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function parseJsonResult(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (error) {
    return { ok: false, error }
  }
}

function atomicWriteJson(path, data, mode = 0o600) {
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode })
  renameSync(tempPath, path)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readNumberFile(path) {
  try {
    const value = Number.parseInt(readFileSync(path, 'utf8').trim(), 10)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function headerEntries(headers) {
  const entries = {}
  if (!headers || typeof headers.forEach !== 'function') return entries
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (['connection', 'content-encoding', 'content-length', 'transfer-encoding'].includes(lower)) return
    entries[lower] = value
  })
  return entries
}

function getHeaderValue(headers, name) {
  if (!headers || typeof headers.get !== 'function') return ''
  return headers.get(name) || ''
}

function extractRateLimitHeaders(headers) {
  const values = {}
  for (const name of RATE_LIMIT_HEADER_NAMES) {
    const value = getHeaderValue(headers, name)
    if (value) values[name] = value
  }
  return values
}

function parseRetryAfterMs(value) {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000))
  const dateMs = Date.parse(value)
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now())
  return null
}

function hasZeroRemainingQuota(rateLimitHeaders) {
  return Object.entries(rateLimitHeaders).some(([name, value]) => {
    if (!name.includes('remaining')) return false
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric <= 0
  })
}

function isLikelyHtmlText(text) {
  return /^\s*(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(text || '')
}

function isLikelyHtmlResponse(headers, text = '') {
  const contentType = getHeaderValue(headers, 'content-type').toLowerCase()
  return contentType.includes('text/html') || isLikelyHtmlText(text)
}

// ─── Web Dashboard Helpers ─────────────────────────────────────────────────────

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 8) return '••••••••'
  return '••••••••' + key.slice(-4)
}

// 📖 Same-origin / loopback check for state-changing or secret-revealing
// 📖 endpoints. Blocks CSRF from malicious tabs and key exfiltration from
// 📖 cross-origin scripts. Plain CLI calls (curl/fetch without Origin) are
// 📖 allowed because they cannot be triggered by a browser context.
function isLoopbackHostname(hostname) {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h.endsWith('.localhost')
}

// 📖 Private-network hostname check. Allows RFC 1918 IPs (10.x, 172.16–31.x,
// 📖 192.168.x) and hostnames that end in `.local` or `.internal`. This
// 📖 enables Docker and LAN setups where the browser hits the FCM web UI
// 📖 from a different machine but still on a trusted network.
function isPrivateNetworkHostname(hostname) {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  // 📖 mDNS / zero-conf hostnames
  if (h.endsWith('.local') || h.endsWith('.internal')) return true
  // 📖 IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true
  return false
}

// 📖 Cache the FCM_ALLOWED_ORIGINS env var split into a Set on first access.
// 📖 Format: comma-separated origin URLs, e.g. "http://mybox:19280,http://10.0.0.5:19280"
let _allowedOriginsCache = null
function getAllowedOrigins() {
  if (_allowedOriginsCache === null) {
    const raw = process.env.FCM_ALLOWED_ORIGINS || ''
    _allowedOriginsCache = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return _allowedOriginsCache
}

function isSameOriginOrLocal(req) {
  const origin = req.headers.origin
  const referer = req.headers.referer || req.headers.referrer
  const candidates = []
  if (typeof origin === 'string' && origin && origin !== 'null') candidates.push(origin)
  else if (typeof referer === 'string' && referer) candidates.push(referer)

  // 📖 No Origin/Referer → non-browser caller (curl, native app). Allow.
  if (candidates.length === 0) return true

  for (const c of candidates) {
    try {
      const parsed = new URL(c)
      if (isLoopbackHostname(parsed.hostname)) return true
      // 📖 Allow Docker / LAN access from private networks
      if (isPrivateNetworkHostname(parsed.hostname)) return true
      // 📖 Allow user-specified origins via env var
      if (getAllowedOrigins().includes(c)) return true
    } catch {
      return false
    }
  }
  return false
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function getWebModelsPayload(runtime) {
  // 📖 Hoist router + active set lookups out of the per-model loop so we
  // 📖 don't re-resolve them ~200 times per request.
  const router = runtime.routerConfig()
  const activeSet = runtime.getSet(router.activeSet)
  const inSetIndex = new Set(
    (activeSet?.models || []).map((m) => `${m.provider}::${m.model}`),
  )

  const payload = []
  for (const [providerKey, source] of Object.entries(sources)) {
    if (!Array.isArray(source.models)) continue
    const hasApiKey = !!runtime.getApiKeyForProvider(providerKey)
    for (const [modelId, label, tier, sweScore, ctx] of source.models) {
      const key = modelKey(providerKey, modelId)
      const probeWindow = runtime.probeWindows.get(key) || []
      const pings = probeWindow.map((entry) => ({
        ms: entry.latencyMs ?? null,
        code: entry.code ?? (entry.ok ? '200' : 'ERR'),
      }))
      const msList = pings.map((p) => p.ms).filter((ms) => typeof ms === 'number' && ms > 0)
      const avg = msList.length > 0
        ? msList.reduce((sum, ms) => sum + ms, 0) / msList.length
        : null
      const sorted = [...msList].sort((a, b) => a - b)
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : null
      const jitter = sorted.length > 1
        ? sorted.slice(1).reduce((sum, v, i) => sum + Math.abs(v - sorted[i]), 0) / (sorted.length - 1)
        : null
      const recentOk = pings.filter((p) => typeof p.ms === 'number' && String(p.code) === '200').length
      const stability = pings.length > 0 ? recentOk / pings.length : null
      const verdict = avg === null ? '—' : avg < 1000 ? 'Excellent' : avg < 2000 ? 'Good' : avg < 4000 ? 'Fair' : 'Poor'
      const uptime = pings.length > 0 ? recentOk / pings.length : null
      payload.push({
        idx: payload.length + 1,
        modelId,
        label,
        tier,
        sweScore,
        ctx,
        providerKey,
        origin: source.name || providerKey,
        status: pings.length === 0 ? 'pending' : recentOk > 0 ? 'up' : 'down',
        httpCode: pings.length > 0 ? pings[pings.length - 1].code : null,
        cliOnly: source.cliOnly || false,
        zenOnly: source.zenOnly || false,
        avg: avg === null ? null : Math.round(avg),
        verdict,
        uptime,
        p95,
        jitter: jitter === null ? null : Math.round(jitter),
        stability: stability === null ? null : Math.round(stability * 100) / 100,
        latestPing: pings.length > 0 ? pings[pings.length - 1].ms : null,
        latestCode: pings.length > 0 ? pings[pings.length - 1].code : null,
        pingHistory: pings.slice(-20),
        pingCount: pings.length,
        hasApiKey,
        inRouterSet: inSetIndex.has(`${providerKey}::${modelId}`),
        benchmarkKey: key,
        isBenchmarking: runtime.webBenchmarkRunning?.has(key) || false,
        benchmark: runtime.webBenchmarkResults?.get(key) || null,
      })
    }
  }
  return payload
}

function getWebUpdateStatusPayload() {
  if (process.env.FCM_UPDATE_ALLOWED_OUTDATED !== '1') return null
  return {
    latestVersion: process.env.FCM_UPDATE_LATEST_VERSION || null,
    allowedOutdated: true,
    warningMessage: process.env.FCM_UPDATE_WARNING_MESSAGE || null,
    failures: Number.parseInt(process.env.FCM_UPDATE_FAILURES || '0', 10) || 0,
  }
}

function getWebStatePayload(runtime) {
  const router = runtime.routerConfig()
  const probeInterval = router.probeIntervals?.[router.probeMode] || DEFAULT_ROUTER_SETTINGS.probeIntervals.balanced
  return {
    pingMode: router.probeMode === 'aggressive' ? 'speed' : router.probeMode === 'eco' ? 'slow' : 'normal',
    pingModeSource: 'daemon-probe-mode',
    pingInterval: probeInterval,
    nextPingAt: runtime.lastProbeAt ? runtime.lastProbeAt + probeInterval : null,
    pendingPings: runtime.probeTimeouts?.size || 0,
    isPinging: (runtime.probeTimeouts?.size || 0) > 0,
    globalBenchmarkRunning: runtime.webGlobalBenchmarkRunning || false,
    globalBenchmarkTotal: runtime.webGlobalBenchmarkTotal || 0,
    globalBenchmarkCompleted: runtime.webGlobalBenchmarkCompleted || 0,
    updateStatus: getWebUpdateStatusPayload(),
    models: getWebModelsPayload(runtime),
  }
}

function getWebConfigPayload(runtime) {
  const providers = {}
  for (const [key, src] of Object.entries(sources)) {
    const rawKey = runtime.getApiKeyForProvider(key)
    providers[key] = {
      name: src.name,
      hasKey: !!rawKey,
      maskedKey: rawKey ? maskApiKey(rawKey) : null,
      enabled: isProviderEnabled(runtime.config, key),
      modelCount: src.models?.length || 0,
      cliOnly: src.cliOnly || false,
    }
  }
  return { providers, totalModels: MODELS.length }
}

const WEB_DIST_DIR = resolvePath(__dirname, '..', '..', 'web', 'dist')

function serveStaticFromDist(res, absPath) {
  const ext = absPath.slice(absPath.lastIndexOf('.'))
  const ct = MIME_TYPES[ext] || 'application/octet-stream'
  res.writeHead(200, {
    'Content-Type': ct,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(readFileSync(absPath))
}

function serveSpaIndex(res) {
  const indexPath = resolvePath(WEB_DIST_DIR, 'index.html')
  if (!existsSync(indexPath)) {
    res.writeHead(503, { 'Content-Type': 'text/plain' })
    res.end('Web dashboard not built. Run: pnpm build')
    return
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(readFileSync(indexPath))
}

function serveWebStaticFile(res, pathname, requestId) {
  // 📖 Resolve to an absolute path and verify it stays inside WEB_DIST_DIR.
  // 📖 Without this, `pathname` like `/../../etc/passwd` escapes the dist root.
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = resolvePath(WEB_DIST_DIR, requested)
  if (candidate !== WEB_DIST_DIR && !candidate.startsWith(WEB_DIST_DIR + '/')) {
    sendError(res, 403, 'Forbidden', 'invalid_request_error', 'path_traversal_blocked', requestId)
    return
  }

  let stats
  try {
    stats = statSync(candidate)
  } catch (err) {
    if (err.code === 'ENOENT') {
      // 📖 SPA fallback: unknown route → serve index.html so client-side routing wins.
      serveSpaIndex(res)
      return
    }
    sendError(res, 500, 'Failed to read static file', 'server_error', 'static_file_read_failed', requestId)
    return
  }

  if (stats.isDirectory()) {
    const dirIndex = resolvePath(candidate, 'index.html')
    if (dirIndex.startsWith(WEB_DIST_DIR + '/') && existsSync(dirIndex)) {
      serveStaticFromDist(res, dirIndex)
      return
    }
    // 📖 Directory without index.html → fall back to SPA root.
    serveSpaIndex(res)
    return
  }

  serveStaticFromDist(res, candidate)
}

function buildUpstreamMeta(response, text = '') {
  // 📖 Keep quota diagnostics structural only: headers and retry timing are safe,
  // 📖 while upstream response bodies stay out of logs and telemetry.
  const rateLimitHeaders = extractRateLimitHeaders(response.headers)
  const retryAfterMs = parseRetryAfterMs(rateLimitHeaders['retry-after'])
  const quotaExhausted = response.status === 429
    || hasZeroRemainingQuota(rateLimitHeaders)
    || /\b(quota|rate[_ -]?limit|too many requests)\b/i.test(text || '')
  return {
    retryAfterMs,
    rateLimitHeaders,
    quotaExhausted,
  }
}

function attachClientAbort(req, res, controller) {
  let clientAborted = false
  const abort = () => {
    if (res.writableEnded) return
    // 📖 If the coding tool disconnects, stop spending provider quota
    // 📖 immediately and do not mark the upstream model unhealthy.
    clientAborted = true
    try {
      controller.abort(new Error('client_disconnected'))
    } catch {
      controller.abort()
    }
  }
  req.on('aborted', abort)
  res.on('close', abort)
  return {
    get aborted() {
      return clientAborted
    },
    dispose() {
      req.off('aborted', abort)
      res.off('close', abort)
    },
  }
}

export function cloneHeadersForUpstream(reqHeaders, apiKey, providerKey) {
  const headers = {}
  for (const [key, value] of Object.entries(reqHeaders || {})) {
    const lower = key.toLowerCase()
    if (['host', 'connection', 'content-length', 'authorization'].includes(lower)) continue
    if (typeof value !== 'string') continue
    if (lower === 'content-type') {
      headers['Content-Type'] = value
      continue
    }
    headers[key] = value
  }
  headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  headers.Authorization = `Bearer ${apiKey}`
  if (providerKey === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/vava-nessa/free-coding-models'
    headers['X-Title'] = 'free-coding-models'
  }
  return headers
}

function getApiModelId(providerKey, modelId) {
  return providerKey === 'zai' ? modelId.replace(/^zai\//, '') : modelId
}

function isRouteableProvider(providerKey) {
  const source = sources[providerKey]
  return Boolean(source?.url && !source.cliOnly && source.url.includes('/chat/completions'))
}

function resolveProviderUrl(providerKey) {
  const url = sources[providerKey]?.url
  if (!url) return null
  return providerKey === 'cloudflare' ? resolveCloudflareUrl(url) : url
}

function buildProviderModelsUrl(providerKey) {
  const url = resolveProviderUrl(providerKey)
  if (typeof url !== 'string' || !url.includes('/chat/completions')) return null
  return url.replace(/\/chat\/completions$/, '/models')
}

function extractUsage(payload) {
  const usage = payload?.usage
  if (!usage || typeof usage !== 'object') return null
  const promptTokens = Number(usage.prompt_tokens ?? 0)
  const completionTokens = Number(usage.completion_tokens ?? 0)
  const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens)
  if (![promptTokens, completionTokens, totalTokens].every(Number.isFinite)) return null
  if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0) return null
  return {
    prompt_tokens: Math.max(0, Math.round(promptTokens)),
    completion_tokens: Math.max(0, Math.round(completionTokens)),
    total_tokens: Math.max(0, Math.round(totalTokens)),
  }
}

export function formatOpenAiError(message, type, code, requestId, extra = {}) {
  return {
    error: {
      message,
      type,
      code,
      request_id: requestId,
      ...extra,
    },
  }
}

function sendJson(res, statusCode, payload, headers = {}) {
  if (res.writableEnded) return
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  })
  res.end(body)
}

function sendError(res, statusCode, message, type, code, requestId, extra = {}) {
  sendJson(res, statusCode, formatOpenAiError(message, type, code, requestId, extra))
}

function readRequestBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { code: 'BODY_TOO_LARGE' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function readJsonBody(req) {
  return readRequestBody(req).then((raw) => {
    if (!raw.trim()) return {}
    const parsed = safeJsonParse(raw)
    if (parsed === null) {
      throw Object.assign(new Error('Invalid JSON'), { code: 'INVALID_JSON' })
    }
    return parsed
  })
}

class RouterLogger {
  constructor(logPath, level = 'info') {
    this.logPath = logPath
    this.level = level
    this.levelRank = { error: 0, warn: 1, info: 2, debug: 3 }
  }

  shouldLog(level) {
    return this.levelRank[level] <= this.levelRank[this.level]
  }

  rotateIfNeeded() {
    try {
      if (!existsSync(this.logPath)) return
      const stat = statSync(this.logPath)
      if (stat.size < 5 * 1024 * 1024) return
      const rotatedPath = `${this.logPath}.1`
      try { unlinkSync(rotatedPath) } catch {}
      renameSync(this.logPath, rotatedPath)
    } catch {
      // 📖 Logging should never be capable of taking the daemon down.
    }
  }

  write(level, message, meta = null) {
    if (!this.shouldLog(level)) return
    const suffix = meta ? ` ${this.safeStringify(meta)}` : ''
    const line = `[${nowIso()}] [${level.toUpperCase()}] ${message}${suffix}\n`
    try {
      this.rotateIfNeeded()
      appendFileSync(this.logPath, line, { mode: 0o600 })
    } catch {
      try { process.stderr.write(line) } catch {}
    }
  }

  safeStringify(meta) {
    try {
      return JSON.stringify(meta)
    } catch {
      return '[unserializable-meta]'
    }
  }

  error(message, meta = null) { this.write('error', message, meta) }
  warn(message, meta = null) { this.write('warn', message, meta) }
  info(message, meta = null) { this.write('info', message, meta) }
  debug(message, meta = null) { this.write('debug', message, meta) }
}

class TokenTracker {
  constructor(path, logger) {
    this.path = path
    this.logger = logger
    this.stats = this.load()
    this.dirty = false
    this.flushFailures = 0
  }

  load() {
    try {
      if (!existsSync(this.path)) {
        return {
          daily: {},
          all_time: {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            requests: 0,
            first_tracked: nowIso(),
          },
        }
      }
      const parsed = safeJsonParse(readFileSync(this.path, 'utf8'), null)
      if (!parsed || typeof parsed !== 'object') throw new Error('Token stats JSON is invalid')
      return {
        daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
        all_time: {
          total_tokens: Number(parsed.all_time?.total_tokens ?? 0),
          prompt_tokens: Number(parsed.all_time?.prompt_tokens ?? 0),
          completion_tokens: Number(parsed.all_time?.completion_tokens ?? 0),
          requests: Number(parsed.all_time?.requests ?? 0),
          first_tracked: parsed.all_time?.first_tracked || nowIso(),
        },
      }
    } catch (error) {
      this.logger.warn('Token stats read failed; starting fresh counters', { error: error.message })
      return {
        daily: {},
        all_time: {
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          requests: 0,
          first_tracked: nowIso(),
        },
      }
    }
  }

  todayKey() {
    return new Date().toISOString().slice(0, 10)
  }

  ensureDaily(dateKey) {
    if (!this.stats.daily[dateKey]) {
      this.stats.daily[dateKey] = {
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        requests: 0,
        by_model: {},
      }
    }
    if (!this.stats.daily[dateKey].by_model || typeof this.stats.daily[dateKey].by_model !== 'object') {
      this.stats.daily[dateKey].by_model = {}
    }
    return this.stats.daily[dateKey]
  }

  record(provider, model, usage) {
    if (!usage) return
    const dateKey = this.todayKey()
    const daily = this.ensureDaily(dateKey)
    const key = modelKey(provider, model)
    if (!daily.by_model[key]) daily.by_model[key] = { total: 0, requests: 0 }

    daily.total_tokens += usage.total_tokens
    daily.prompt_tokens += usage.prompt_tokens
    daily.completion_tokens += usage.completion_tokens
    daily.requests += 1
    daily.by_model[key].total += usage.total_tokens
    daily.by_model[key].requests += 1

    this.stats.all_time.total_tokens += usage.total_tokens
    this.stats.all_time.prompt_tokens += usage.prompt_tokens
    this.stats.all_time.completion_tokens += usage.completion_tokens
    this.stats.all_time.requests += 1
    this.dirty = true
  }

  prune() {
    const cutoff = Date.now() - STATS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    for (const dateKey of Object.keys(this.stats.daily)) {
      const time = Date.parse(`${dateKey}T00:00:00.000Z`)
      if (Number.isFinite(time) && time < cutoff) delete this.stats.daily[dateKey]
    }
  }

  flush({ force = false } = {}) {
    if (!this.dirty && !force) return
    try {
      this.prune()
      atomicWriteJson(this.path, this.stats, 0o600)
      this.dirty = false
      this.flushFailures = 0
    } catch (error) {
      this.flushFailures += 1
      this.logger.warn('Token stats write failed; keeping counters in memory', {
        error: error.message,
        failures: this.flushFailures,
      })
    }
  }

  summary() {
    const today = this.ensureDaily(this.todayKey())
    return {
      today,
      all_time: this.stats.all_time,
      daily: this.stats.daily,
    }
  }
}

class RouterRuntime {
  constructor({ config, port, logger, tokenPath = ROUTER_TOKENS_PATH, persistConfig = true }) {
    this.config = config
    this.port = port
    this.logger = logger
    this.persistConfig = persistConfig
    this.startedAt = Date.now()
    this.inFlight = 0
    this.shuttingDown = false
    this.crashRecovered = 0
    this.uncaughtTimestamps = []
    this.server = null
    this.configReloadTimer = null
    this.tokenFlushTimer = null
    this.probeTimer = null
    this.probeTimeouts = new Set()
    this.tokenTracker = new TokenTracker(tokenPath, logger)
    this.modelCatalog = this.buildModelCatalog()
    this.probeWindows = new Map()
    this.circuit = new Map()
    this.requestLog = []
    this.sseClients = new Set()
    this.lastProbeAt = null
    this.totalRequestsRouted = 0
    this.quotaExhausted = new Set()
    this.quotaDetails = new Map()
    this.staleNotifications = new Set()
    this.webBenchmarkRunning = new Set()
    this.webBenchmarkResults = new Map()
    this.webGlobalBenchmarkRunning = false
    this.webGlobalBenchmarkTotal = 0
    this.webGlobalBenchmarkCompleted = 0
    this.refreshRouteState()
  }

  buildModelCatalog() {
    const catalog = new Map()
    for (const [providerKey, source] of Object.entries(sources)) {
      if (!Array.isArray(source.models)) continue
      for (const [modelId, label, tier, sweScore, ctx] of source.models) {
        catalog.set(modelKey(providerKey, modelId), {
          providerKey,
          modelId,
          label,
          tier,
          sweScore,
          ctx,
          routeable: isRouteableProvider(providerKey),
        })
      }
    }
    return catalog
  }

  refreshRouteState() {
    const router = this.routerConfig()
    this.logger.level = router.logLevel
    for (const set of Object.values(router.sets || {})) {
      for (const model of set.models || []) {
        const key = modelKey(model.provider, model.model)
        if (!this.probeWindows.has(key)) this.probeWindows.set(key, [])
        if (!this.circuit.has(key)) {
          this.circuit.set(key, {
            state: 'CLOSED',
            consecutiveFailures: 0,
            cooldownMs: router.circuitBreaker.initialCooldownMs,
            openedAt: null,
            lastError: null,
            authError: false,
            stale: false,
          })
        }
        const entry = this.circuit.get(key)
        entry.stale = !this.modelCatalog.has(key)
        const catalogEntry = this.modelCatalog.get(key)
        entry.unsupported = Boolean(catalogEntry && !catalogEntry.routeable)
        if (entry.stale && !this.staleNotifications.has(key)) {
          this.staleNotifications.add(key)
          this.logger.warn(`${key} is no longer available and will be skipped`)
        }
      }
    }
  }

  routerConfig() {
    const normalized = normalizeRouterConfig(this.config.router)
    if (normalized) return normalized
    const defaultSet = buildDefaultRouterSet(this.config)
    return normalizeRouterConfig({
      ...DEFAULT_ROUTER_SETTINGS,
      enabled: true,
      onboardingSeen: true,
      activeSet: defaultSet.name,
      sets: { [defaultSet.name]: defaultSet },
    })
  }

  setRouterConfig(router) {
    this.config.router = normalizeRouterConfig(router)
    this.refreshRouteState()
  }

  saveRouterConfig() {
    if (this.persistConfig === false) return { success: true, backupCreated: false }
    const result = saveConfig(this.config)
    if (!result.success) this.logger.warn('Router config write failed', { error: result.error })
    return result
  }

  reloadConfigFromDisk() {
    try {
      const nextConfig = loadConfig()
      // 📖 Always rebuild the router set from favorites so UI toggles apply dynamically
      ensureRouterConfigForDaemon(nextConfig, true)
      this.config = nextConfig
      this.refreshRouteState()
      this.scheduleProbeLoop()
      this.broadcast('config', { activeSet: this.routerConfig().activeSet })
      this.logger.debug('Router config reloaded from disk')
    } catch (error) {
      this.logger.warn('Config reload failed; keeping in-memory config', { error: error.message })
    }
  }

  getApiKeyForProvider(providerKey) {
    const configured = this.config?.apiKeys?.[providerKey]
    if (Array.isArray(configured)) return configured.find(Boolean) || null
    if (typeof configured === 'string' && configured.trim()) return configured.trim()
    return null
  }

  getSet(setName = null) {
    const router = this.routerConfig()
    const name = setName || router.activeSet
    return router.sets?.[name] || null
  }

  listSetModels(set) {
    return [...(set?.models || [])].sort((a, b) => a.priority - b.priority)
  }

  updateCircuitForCooldown(key) {
    const state = this.circuit.get(key)
    if (!state || state.state !== 'OPEN') return state
    const elapsed = Date.now() - (state.openedAt || 0)
    if (elapsed >= state.cooldownMs) {
      const oldState = state.state
      state.state = 'HALF_OPEN'
      this.broadcast('circuit', { model: key, old_state: oldState, new_state: state.state, cooldown_ms: state.cooldownMs })
    }
    return state
  }

  recordProbeResult(key, result) {
    const window = this.probeWindows.get(key) || []
    window.push({ ...result, at: Date.now() })
    while (window.length > MAX_PROBE_WINDOW) window.shift()
    this.probeWindows.set(key, window)
    this.lastProbeAt = Date.now()
    this.broadcast('probe', {
      model: key,
      status: result.ok ? 'ok' : 'fail',
      latency_ms: result.latencyMs ?? null,
      circuit_state: this.circuit.get(key)?.state || 'UNKNOWN',
    })
  }

  markAuthError(key, detail = 'authentication failed') {
    const state = this.circuit.get(key)
    if (!state) return
    state.authError = true
    state.lastError = detail
    this.broadcast('circuit', { model: key, old_state: state.state, new_state: 'AUTH_ERROR', cooldown_ms: 0 })
  }

  markSuccess(key, latencyMs = null) {
    const state = this.circuit.get(key)
    if (!state) return
    const oldState = state.state
    state.state = 'CLOSED'
    state.consecutiveFailures = 0
    state.cooldownMs = this.routerConfig().circuitBreaker.initialCooldownMs
    state.openedAt = null
    state.lastError = null
    state.authError = false
    this.quotaExhausted.delete(key)
    this.quotaDetails.delete(key)
    if (oldState !== state.state) {
      this.broadcast('circuit', { model: key, old_state: oldState, new_state: state.state, cooldown_ms: state.cooldownMs })
    }
    if (latencyMs !== null) this.recordProbeResult(key, { ok: true, latencyMs, code: 200 })
  }

  markFailure(key, detail, statusCode = null, meta = {}) {
    const state = this.circuit.get(key)
    if (!state) return
    state.authError = false
    state.consecutiveFailures += 1
    state.lastError = detail
    if (statusCode === 429 || meta.quotaExhausted) {
      this.quotaExhausted.add(key)
      this.quotaDetails.set(key, {
        model: key,
        status: statusCode,
        retry_after_ms: meta.retryAfterMs ?? null,
        rate_limit_headers: meta.rateLimitHeaders || {},
        last_seen: nowIso(),
      })
    }
    const router = this.routerConfig()
    if (state.state === 'HALF_OPEN' || state.consecutiveFailures >= router.circuitBreaker.failureThreshold) {
      const oldState = state.state
      state.state = 'OPEN'
      state.openedAt = Date.now()
      state.cooldownMs = Math.min(
        router.circuitBreaker.maxCooldownMs,
        Math.max(router.circuitBreaker.initialCooldownMs, state.cooldownMs * router.circuitBreaker.backoffMultiplier),
      )
      this.broadcast('circuit', { model: key, old_state: oldState, new_state: state.state, cooldown_ms: state.cooldownMs })
      this.logger.warn(`Circuit opened for ${key}`, { reason: detail, cooldown_ms: state.cooldownMs })
      void sendUsageTelemetry(this.config, {}, {
        event: 'app_router_circuit_open',
        mode: 'daemon',
        properties: {
          model: key,
          consecutive_failures: state.consecutiveFailures,
          cooldown_ms: state.cooldownMs,
        },
      })
    }
    this.recordProbeResult(key, { ok: false, latencyMs: null, code: statusCode || 'ERR', error: detail })
  }

  quotaDetailsForKeys(keys) {
    return keys
      .filter((key) => this.quotaExhausted.has(key))
      .map((key) => this.quotaDetails.get(key) || {
        model: key,
        status: 429,
        retry_after_ms: null,
        rate_limit_headers: {},
        last_seen: null,
      })
  }

  recordRouterError(kind, requestId, properties = {}) {
    void sendUsageTelemetry(this.config, {}, {
      event: 'app_router_error',
      mode: 'daemon',
      properties: {
        kind,
        request_id: requestId,
        ...properties,
      },
    })
  }

  getWindowStats(key) {
    const window = this.probeWindows.get(key) || []
    const successes = window.filter((entry) => entry.ok && Number.isFinite(entry.latencyMs))
    const sortedLatencies = successes.map((entry) => entry.latencyMs).sort((a, b) => a - b)
    const p95 = sortedLatencies.length > 0
      ? sortedLatencies[Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1)]
      : null
    return {
      total: window.length,
      successful: successes.length,
      uptime: window.length > 0 ? successes.length / window.length : null,
      p95,
      last: window[window.length - 1] || null,
    }
  }

  scoreCandidates(set) {
    const models = this.listSetModels(set)
    const maxP95 = Math.max(
      1,
      ...models
        .map((entry) => this.getWindowStats(modelKey(entry.provider, entry.model)).p95)
        .filter((value) => Number.isFinite(value)),
    )
    const router = this.routerConfig()
    const setSize = Math.max(1, models.length)
    const weights = router.scoring

    return models.map((entry) => {
      const key = modelKey(entry.provider, entry.model)
      const stats = this.getWindowStats(key)
      const hasData = stats.total > 0
      const latencyScore = stats.p95 === null ? 0.5 : Math.max(0, 1 - (stats.p95 / maxP95))
      const uptimeScore = stats.uptime === null ? 0.5 : stats.uptime
      const priorityBonus = 1 - ((entry.priority - 1) / setSize)
      const score = hasData
        ? (weights.latencyWeight * latencyScore) + (weights.uptimeWeight * uptimeScore) + (weights.priorityWeight * priorityBonus)
        : priorityBonus
      const state = this.updateCircuitForCooldown(key) || {}
      return {
        ...entry,
        key,
        score,
        stats,
        circuit: state,
        catalog: this.modelCatalog.get(key) || null,
      }
    })
  }

  getRoutingCandidates(set) {
    const scored = this.scoreCandidates(set)
    const usable = scored.filter((candidate) => {
      if (!candidate.catalog || candidate.circuit?.stale) return false
      if (!candidate.catalog.routeable || candidate.circuit?.unsupported) return false
      if (candidate.circuit?.authError) return false
      if (!this.getApiKeyForProvider(candidate.provider)) return false
      return candidate.circuit?.state === 'CLOSED' || candidate.circuit?.state === 'HALF_OPEN'
    })
    const closed = usable.filter((candidate) => candidate.circuit.state === 'CLOSED')
    const halfOpen = usable.filter((candidate) => candidate.circuit.state === 'HALF_OPEN')
    const byScore = (a, b) => b.score - a.score || a.priority - b.priority
    return [...closed.sort(byScore), ...halfOpen.sort(byScore)]
  }

  getModelHealth(set = this.getSet()) {
    return this.scoreCandidates(set || { models: [] }).map((candidate) => ({
      provider: candidate.provider,
      model: candidate.model,
      key: candidate.key,
      priority: candidate.priority,
      state: candidate.circuit?.authError
        ? 'AUTH_ERROR'
        : candidate.circuit?.stale
          ? 'STALE'
          : candidate.circuit?.unsupported
            ? 'UNSUPPORTED'
            : candidate.circuit?.state || 'UNKNOWN',
      score: Number(candidate.score.toFixed(4)),
      last_latency_ms: candidate.stats.last?.latencyMs ?? null,
      uptime: candidate.stats.uptime,
      last_error: candidate.circuit?.lastError || null,
    }))
  }

  findBestModelForProviderInSources(providerKey) {
    const source = sources[providerKey]
    if (!source || !Array.isArray(source.models)) return null
    let best = null
    let bestTier = Infinity
    for (const modelEntry of source.models) {
      const [modelId, , tier] = modelEntry
      if (!modelId || !tier) continue
      const tierIdx = TIER_ORDER.indexOf(tier)
      if (tierIdx < 0) continue
      if (tierIdx < bestTier) {
        bestTier = tierIdx
        best = modelId
      }
    }
    return best
  }

  addRequestLog(entry) {
    this.requestLog.unshift({ ...entry, at: nowIso() })
    while (this.requestLog.length > MAX_REQUEST_LOG) this.requestLog.pop()
    this.broadcast('request', entry)
  }

  broadcast(event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    for (const client of [...this.sseClients]) {
      try {
        client.write(message)
      } catch {
        this.sseClients.delete(client)
      }
    }
  }

  broadcastWebState() {
    this.broadcast('models', getWebStatePayload(this))
  }

  async runWebBenchmark(providerKey, modelId) {
    const key = modelKey(providerKey, modelId)
    if (this.webBenchmarkRunning.has(key)) return { skipped: true }
    const source = sources[providerKey]
    if (!source?.url) {
      return { ok: false, code: 'UNSUPPORTED', totalMs: 0, error: 'Provider has no benchmark URL', retries: 0 }
    }

    this.webBenchmarkRunning.add(key)
    this.broadcastWebState()
    try {
      const result = await benchmarkModel({
        apiKey: this.getApiKeyForProvider(providerKey) ?? null,
        modelId,
        providerKey,
        url: source.url,
        timeoutMs: BENCHMARK_TIMEOUT_MS,
      })
      this.webBenchmarkResults.set(key, result)
      return result
    } catch (err) {
      const fallback = { ok: false, code: 'ERR', totalMs: 0, error: err?.message || 'Benchmark failed', retries: 0 }
      this.webBenchmarkResults.set(key, fallback)
      return fallback
    } finally {
      this.webBenchmarkRunning.delete(key)
      this.broadcastWebState()
    }
  }

  async runWebGlobalBenchmark(models) {
    if (this.webGlobalBenchmarkRunning) return { started: false, error: 'Global benchmark already running' }
    const knownModels = []
    const seen = new Set()
    for (const item of Array.isArray(models) ? models : []) {
      const providerKey = typeof item?.providerKey === 'string' ? item.providerKey : ''
      const modelId = typeof item?.modelId === 'string' ? item.modelId : ''
      const key = modelKey(providerKey, modelId)
      if (!this.modelCatalog.has(key) || seen.has(key)) continue
      seen.add(key)
      knownModels.push({ providerKey, modelId, key })
    }

    const fallbackModels = knownModels.length > 0
      ? knownModels
      : [...this.modelCatalog.values()].filter((m) => sources[m.providerKey]?.url && !sources[m.providerKey]?.cliOnly)

    this.webGlobalBenchmarkRunning = true
    this.webGlobalBenchmarkTotal = fallbackModels.length
    this.webGlobalBenchmarkCompleted = 0
    this.broadcastWebState()

    const healthPriority = { up: 0, pending: 1, timeout: 2, noauth: 3, auth_error: 4, down: 5 }
    const sorted = [...fallbackModels].sort((a, b) => {
      const aw = this.probeWindows.get(modelKey(a.providerKey, a.modelId)) || []
      const bw = this.probeWindows.get(modelKey(b.providerKey, b.modelId)) || []
      const aLast = aw.at(-1)
      const bLast = bw.at(-1)
      const aState = aLast?.ok ? 'up' : aw.length ? 'down' : 'pending'
      const bState = bLast?.ok ? 'up' : bw.length ? 'down' : 'pending'
      const hpA = healthPriority[aState] ?? 6
      const hpB = healthPriority[bState] ?? 6
      if (hpA !== hpB) return hpA - hpB
      return (aLast?.latencyMs ?? 99999) - (bLast?.latencyMs ?? 99999)
    })

    const workers = new Array(Math.min(5, sorted.length)).fill(null).map(async () => {
      while (sorted.length > 0) {
        const next = sorted.shift()
        if (!next) break
        try {
          await this.runWebBenchmark(next.providerKey, next.modelId)
        } finally {
          this.webGlobalBenchmarkCompleted += 1
          this.broadcastWebState()
        }
      }
    })

    void Promise.all(workers).finally(() => {
      this.webGlobalBenchmarkRunning = false
      this.webGlobalBenchmarkTotal = 0
      this.webGlobalBenchmarkCompleted = 0
      this.broadcastWebState()
    })

    return { started: true, total: fallbackModels.length }
  }

  statusPayload() {
    const router = this.routerConfig()
    const activeSet = this.getSet(router.activeSet)
    return {
      ok: true,
      pid: process.pid,
      port: this.port,
      enabled: router.enabled,
      activeSet: router.activeSet,
      activeModelCount: activeSet?.models?.length || 0,
      setCount: Object.keys(router.sets || {}).length,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      requestsRouted: this.totalRequestsRouted,
      inFlight: this.inFlight,
      shuttingDown: this.shuttingDown,
      probeMode: router.probeMode,
      lastProbeAt: this.lastProbeAt ? new Date(this.lastProbeAt).toISOString() : null,
      crashRecovered: this.crashRecovered,
      configPath: CONFIG_PATH,
      tokenStatsPath: ROUTER_TOKENS_PATH,
      logPath: ROUTER_LOG_PATH,
    }
  }

  statsPayload() {
    const router = this.routerConfig()
    const activeSet = this.getSet(router.activeSet)
    return {
      ...this.statusPayload(),
      tokens: this.tokenTracker.summary(),
      models: this.getModelHealth(activeSet),
      requestLog: this.requestLog.slice(0, 20),
      circuitBreakers: Object.fromEntries([...this.circuit.entries()].map(([key, value]) => [key, {
        state: value.authError ? 'AUTH_ERROR' : value.stale ? 'STALE' : value.unsupported ? 'UNSUPPORTED' : value.state,
        consecutiveFailures: value.consecutiveFailures,
        cooldownMs: value.cooldownMs,
        openedAt: value.openedAt ? new Date(value.openedAt).toISOString() : null,
        lastError: value.lastError,
      }])),
    }
  }

  async probeCandidate(candidate, { eco = false } = {}) {
    const key = modelKey(candidate.provider, candidate.model)
    const apiKey = this.getApiKeyForProvider(candidate.provider)
    if (!apiKey) {
      this.markAuthError(key, 'missing API key')
      return
    }
    // 📖 Guard: skip probe if the provider URL cannot be resolved (e.g. missing account ID)
    const providerUrl = resolveProviderUrl(candidate.provider)
    if (!providerUrl) {
      this.markAuthError(key, 'provider URL unresolvable')
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const started = performance.now()
    try {
      const modelsUrl = eco ? buildProviderModelsUrl(candidate.provider) : null
      const response = modelsUrl
        ? await fetch(modelsUrl, {
            method: 'GET',
            headers: cloneHeadersForUpstream({}, apiKey, candidate.provider),
            signal: controller.signal,
          })
        : await fetch(providerUrl, {
            method: 'POST',
            headers: cloneHeadersForUpstream({}, apiKey, candidate.provider),
            body: JSON.stringify(buildChatCompletionPingBody(
              getApiModelId(candidate.provider, candidate.model),
              { stream: false },
              { disableThinking: shouldUseDisabledThinkingForProvider(candidate.provider) }
            )),
            signal: controller.signal,
          })
      const latencyMs = Math.round(performance.now() - started)
      if (response.ok) {
        this.markSuccess(key)
        this.recordProbeResult(key, { ok: true, latencyMs, code: response.status })
        this.logger.info(`Probe ok ${key} — ${latencyMs}ms`)
      } else if (AUTH_STATUS_CODES.has(response.status)) {
        this.markAuthError(key, `HTTP ${response.status}`)
        this.recordProbeResult(key, { ok: false, latencyMs, code: response.status })
      } else if (RETRYABLE_STATUS_CODES.has(response.status)) {
        this.markFailure(key, `HTTP ${response.status}`, response.status)
      } else {
        this.recordProbeResult(key, { ok: false, latencyMs, code: response.status })
      }
    } catch (error) {
      const detail = error.name === 'AbortError' ? 'probe timeout' : error.message
      this.markFailure(key, detail)
    } finally {
      clearTimeout(timeout)
    }
  }

  async runProbeBurst() {
    const set = this.getSet()
    if (!set) return
    const candidates = this.scoreCandidates(set)
      .filter((candidate) => candidate.catalog?.routeable && !candidate.circuit?.stale)
    await Promise.allSettled(candidates.map((candidate) => this.probeCandidate(candidate, {
      eco: this.routerConfig().probeMode === 'eco',
    })))
  }

  scheduleProbeLoop() {
    if (this.probeTimer) clearInterval(this.probeTimer)
    for (const timeout of this.probeTimeouts) clearTimeout(timeout)
    this.probeTimeouts.clear()
    const router = this.routerConfig()
    const interval = router.probeIntervals[router.probeMode] || DEFAULT_ROUTER_SETTINGS.probeIntervals.balanced
    this.probeTimer = setInterval(() => {
      const set = this.getSet()
      if (!set || this.shuttingDown) return
      const candidates = this.scoreCandidates(set)
        .filter((candidate) => candidate.catalog?.routeable && !candidate.circuit?.stale)
      const stagger = candidates.length > 0 ? Math.max(250, Math.floor(interval / candidates.length)) : interval
      candidates.forEach((candidate, index) => {
        const timeout = setTimeout(() => {
          this.probeTimeouts.delete(timeout)
          void this.probeCandidate(candidate, { eco: router.probeMode === 'eco' })
        }, index * stagger)
        timeout.unref?.()
        this.probeTimeouts.add(timeout)
      })
    }, interval)
    this.probeTimer.unref?.()
  }

  async routeRequest({ req, res, body, setName, requestId }) {
    if (this.shuttingDown) {
      sendError(res, 503, 'Daemon is shutting down', 'service_unavailable', 'daemon_shutting_down', requestId)
      return
    }
    if (this.inFlight >= MAX_CONCURRENT_REQUESTS) {
      sendError(res, 503, 'Router overloaded, too many concurrent requests', 'service_unavailable', 'router_overloaded', requestId)
      return
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendError(res, 400, 'Request body must be a JSON object', 'invalid_request_error', 'invalid_json_object', requestId)
      return
    }
    if (typeof body.model !== 'string' || !body.model.trim()) {
      sendError(res, 400, 'Missing required field: model', 'invalid_request_error', 'missing_model', requestId)
      return
    }

    const set = this.getSet(setName)
    if (!set) {
      sendError(res, 404, `Router set not found: ${setName || this.routerConfig().activeSet}`, 'invalid_request_error', 'set_not_found', requestId)
      return
    }

    const candidates = this.getRoutingCandidates(set)
    const maxRetries = this.routerConfig().failover.maxRetries
    const maxAttempts = Math.max(1, maxRetries)
    if (candidates.length === 0) {
      const health = this.getModelHealth(set)
      const quotaExhausted = [...this.quotaExhausted].filter((key) => set.models.some((model) => modelKey(model.provider, model.model) === key))
      
      let statusCode = 503
      let errorCode = 'all_models_unavailable'
      let errorType = 'service_unavailable'
      if (health.length > 0) {
        const allAuthError = health.length > 0 && health.every((h) => h.state === 'AUTH_ERROR')
        const allAuthOrQuota = health.length > 0 && health.every((h) => h.state === 'AUTH_ERROR' || quotaExhausted.includes(h.key))
        const allStaleOrUnsupported = health.every((h) => h.state === 'STALE' || h.state === 'UNSUPPORTED')
        if (allAuthError) {
          statusCode = 401
          errorCode = 'invalid_api_key'
          errorType = 'invalid_request_error'
        } else if (allAuthOrQuota) {
          statusCode = 429
          errorCode = 'insufficient_quota'
          errorType = 'insufficient_quota'
        } else if (allStaleOrUnsupported) {
          statusCode = 400
          errorCode = 'invalid_model'
          errorType = 'invalid_request_error'
        }
      }

      sendError(res, statusCode, `All models in set are unavailable: ${set.name}`, errorType, errorCode, requestId, {
        set: set.name,
        models_tried: [],
        quota_exhausted: quotaExhausted,
        quota_exhausted_details: this.quotaDetailsForKeys(quotaExhausted),
        model_health: health,
      })
      void sendUsageTelemetry(this.config, {}, {
        event: 'app_router_all_down',
        mode: 'daemon',
        properties: {
          set_name: set.name,
          models_tried: [],
          quota_exhausted_count: quotaExhausted.length,
        },
      })
      return
    }

    this.inFlight += 1
    try {
      const tried = []
      const blockedProviders = new Set()
      let attemptIndex = 0
      for (const candidate of candidates) {
        if (attemptIndex >= maxAttempts) break
        if (blockedProviders.has(candidate.provider)) continue
        tried.push(candidate.key)
        const result = body.stream === true
          ? await this.proxyStreamingRequest({ req, res, body, candidate, requestId, attemptIndex })
          : await this.proxyJsonRequest({ req, res, body, candidate, requestId, attemptIndex })
        if (result.done) return
        attemptIndex += 1
        if (result.authFailure) blockedProviders.add(candidate.provider)
        if (result.failoverToNext && attemptIndex < maxAttempts) {
          const next = candidates.find((entry) => !tried.includes(entry.key) && !blockedProviders.has(entry.provider))
          this.logger.warn(`Failover ${candidate.key}${next ? ` -> ${next.key}` : ''}`, { request_id: requestId, reason: result.reason })
          void sendUsageTelemetry(this.config, {}, {
            event: 'app_router_failover',
            mode: 'daemon',
            properties: {
              from_model: candidate.key,
              to_model: next?.key || null,
              reason: result.reason,
              attempt_number: attemptIndex,
            },
          })
          continue
        }
      }

      const quotaExhausted = [...this.quotaExhausted].filter((key) => tried.includes(key))
      const allAuthError = tried.every((key) => {
        const [provider] = key.split('/')
        return blockedProviders.has(provider)
      })
      const allQuotaError = tried.length > 0 && quotaExhausted.length === tried.length
      const allAuthOrQuota = tried.every((key) => {
        const [provider] = key.split('/')
        return blockedProviders.has(provider) || quotaExhausted.includes(key)
      })

      let statusCode = 503
      let errorCode = 'all_models_failed'
      let errorType = 'service_unavailable'

      if (tried.length > 0) {
        if (allAuthError) {
          statusCode = 401
          errorCode = 'invalid_api_key'
          errorType = 'invalid_request_error'
        } else if (allQuotaError || allAuthOrQuota) {
          statusCode = 429
          errorCode = 'insufficient_quota'
          errorType = 'insufficient_quota'
        }
      }

      sendError(res, statusCode, `All routed models failed for set: ${set.name}`, errorType, errorCode, requestId, {
        set: set.name,
        models_tried: tried,
        quota_exhausted: quotaExhausted,
        quota_exhausted_details: this.quotaDetailsForKeys(quotaExhausted),
      })
    } finally {
      this.inFlight -= 1
    }
  }

  async proxyJsonRequest({ req, res, body, candidate, requestId, attemptIndex }) {
    const key = candidate.key
    const apiKey = this.getApiKeyForProvider(candidate.provider)
    // 📖 Guard: bail early if provider URL cannot be resolved
    const providerUrl = resolveProviderUrl(candidate.provider)
    if (!providerUrl) {
      this.markFailure(key, 'provider URL unresolvable')
      this.addRequestLog({ request_id: requestId, model: key, status: 'ERR', latency_ms: null, tokens: 0, failover: attemptIndex > 0, error: 'provider_url_unresolvable' })
      return { done: false, failoverToNext: true, reason: 'provider_url_unresolvable' }
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.routerConfig().failover.requestTimeoutMs)
    const started = performance.now()
    const upstreamBody = {
      ...body,
      model: getApiModelId(candidate.provider, candidate.model),
      stream: false,
    }
    // 📖 Some providers/models fail if we send custom internal params, so strip them
    if (upstreamBody.add_generation_prompt !== undefined) delete upstreamBody.add_generation_prompt
    if (upstreamBody.continue_final_message !== undefined) delete upstreamBody.continue_final_message
    if (upstreamBody.tools?.length === 0) delete upstreamBody.tools
    
    const clientAbort = attachClientAbort(req, res, controller)
    try {
      const response = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          ...cloneHeadersForUpstream(req.headers, apiKey, candidate.provider),
          'X-Request-Id': requestId,
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const latencyMs = Math.round(performance.now() - started)
      const text = await response.text()
      const upstreamMeta = buildUpstreamMeta(response, text)

      if (isLikelyHtmlResponse(response.headers, text)) {
        this.markFailure(key, 'upstream_html_maintenance', 503, upstreamMeta)
        this.recordRouterError('upstream_html_maintenance', requestId, { model: key, status: response.status })
        this.addRequestLog({ request_id: requestId, model: key, status: 503, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: 'upstream_html_maintenance' })
        return { done: false, failoverToNext: true, reason: 'upstream_html_maintenance' }
      }

      if (response.ok) {
        const parsed = parseJsonResult(text)
        if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
          this.markFailure(key, 'upstream_invalid_json', 502, upstreamMeta)
          this.recordRouterError('upstream_invalid_json', requestId, { model: key, status: response.status })
          this.addRequestLog({ request_id: requestId, model: key, status: 502, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: 'upstream_invalid_json' })
          return { done: false, failoverToNext: true, reason: 'upstream_invalid_json' }
        }
        this.markSuccess(key, latencyMs)
        const usage = extractUsage(parsed.value)
        this.tokenTracker.record(candidate.provider, candidate.model, usage)
        this.totalRequestsRouted += 1
        // 📖 Fire app_router_use telemetry once per 10 routed requests
        if (this.totalRequestsRouted % 10 === 0) {
          void sendUsageTelemetry(this.config, {}, {
            event: 'app_router_use',
            mode: 'daemon',
            properties: {
              total_requests: this.totalRequestsRouted,
              active_set: this.routerConfig().activeSet,
            },
          })
        }
        this.addRequestLog({
          request_id: requestId,
          model: key,
          status: response.status,
          latency_ms: latencyMs,
          tokens: usage?.total_tokens || 0,
          failover: attemptIndex > 0,
        })
        this.logger.info(`Routed to ${key} — ${latencyMs}ms`, { request_id: requestId, status: response.status })
        if (!res.writableEnded) {
          res.writeHead(response.status, {
            ...headerEntries(response.headers),
            'x-fcm-router-model': key,
            'x-request-id': requestId,
          })
          res.end(text)
        }
        return { done: true }
      }

      if (AUTH_STATUS_CODES.has(response.status)) {
        this.markAuthError(key, `HTTP ${response.status}`)
        this.addRequestLog({ request_id: requestId, model: key, status: response.status, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: 'auth_error' })
        return { done: false, failoverToNext: true, reason: `auth_${response.status}`, authFailure: true }
      }

      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        this.markFailure(key, `HTTP ${response.status}`, response.status, upstreamMeta)
        this.addRequestLog({ request_id: requestId, model: key, status: response.status, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: `http_${response.status}` })
        return { done: false, failoverToNext: true, reason: `http_${response.status}` }
      }

      // 📖 Provide failover fallback for non-retryable errors from the provider (like 400 Bad Request) 
      // when they are caused by format idiosyncrasies (e.g. empty tools array that another model might accept)
      if (response.status >= 400 && response.status < 500) {
        this.recordRouterError(`http_${response.status}`, requestId, { model: key, status: response.status, body: text })
        this.markFailure(key, `HTTP ${response.status}`)
        this.addRequestLog({ request_id: requestId, model: key, status: response.status, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: `http_${response.status}` })
        return { done: false, failoverToNext: true, reason: `http_${response.status}` }
      }

      if (!res.writableEnded) {
        res.writeHead(response.status, {
          ...headerEntries(response.headers),
          'x-fcm-router-model': key,
          'x-request-id': requestId,
        })
        res.end(text)
      }
      return { done: true }
    } catch (error) {
      if (clientAbort.aborted) {
        this.logger.info(`Client disconnected before upstream response from ${key}`, { request_id: requestId })
        return { done: true }
      }
      const reason = error.name === 'AbortError' ? 'timeout' : (error.message || String(error))
      this.markFailure(key, reason)
      this.recordRouterError('upstream_transport_error', requestId, { model: key, reason })
      this.addRequestLog({ request_id: requestId, model: key, status: 'ERR', latency_ms: null, tokens: 0, failover: attemptIndex > 0, error: reason })
      return { done: false, failoverToNext: true, reason }
    } finally {
      clearTimeout(timeout)
      clientAbort.dispose()
    }
  }

  async proxyStreamingRequest({ req, res, body, candidate, requestId, attemptIndex }) {
    const key = candidate.key
    const apiKey = this.getApiKeyForProvider(candidate.provider)
    // 📖 Guard: bail early if provider URL cannot be resolved
    const providerUrl = resolveProviderUrl(candidate.provider)
    if (!providerUrl) {
      this.markFailure(key, 'provider URL unresolvable')
      this.addRequestLog({ request_id: requestId, model: key, status: 'ERR', latency_ms: null, tokens: 0, failover: attemptIndex > 0, error: 'provider_url_unresolvable', stream: true })
      return { done: false, failoverToNext: true, reason: 'provider_url_unresolvable' }
    }
    const controller = new AbortController()
    const started = performance.now()
    const upstreamBody = {
      ...body,
      model: getApiModelId(candidate.provider, candidate.model),
      stream: true,
    }
    // 📖 Some providers/models fail if we send custom internal params, so strip them
    if (upstreamBody.add_generation_prompt !== undefined) delete upstreamBody.add_generation_prompt
    if (upstreamBody.continue_final_message !== undefined) delete upstreamBody.continue_final_message
    if (upstreamBody.tools?.length === 0) delete upstreamBody.tools
    
    const timeout = setTimeout(() => controller.abort(), this.routerConfig().failover.requestTimeoutMs)
    let sentToClient = false
    const clientAbort = attachClientAbort(req, res, controller)
    try {
      const response = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          ...cloneHeadersForUpstream(req.headers, apiKey, candidate.provider),
          'X-Request-Id': requestId,
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const latencyMs = Math.round(performance.now() - started)
      const upstreamMeta = buildUpstreamMeta(response)
      if (isLikelyHtmlResponse(response.headers)) {
        this.markFailure(key, 'upstream_html_maintenance', 503, upstreamMeta)
        this.recordRouterError('upstream_html_maintenance', requestId, { model: key, status: response.status, stream: true })
        this.addRequestLog({ request_id: requestId, model: key, status: 503, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: 'upstream_html_maintenance', stream: true })
        return { done: false, failoverToNext: true, reason: 'upstream_html_maintenance' }
      }
      if (!response.ok) {
        if (AUTH_STATUS_CODES.has(response.status)) {
          this.markAuthError(key, `HTTP ${response.status}`)
          this.addRequestLog({ request_id: requestId, model: key, status: response.status, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: 'auth_error', stream: true })
          return { done: false, failoverToNext: true, reason: `auth_${response.status}`, authFailure: true }
        }
        if (RETRYABLE_STATUS_CODES.has(response.status)) {
          this.markFailure(key, `HTTP ${response.status}`, response.status, upstreamMeta)
          this.addRequestLog({ request_id: requestId, model: key, status: response.status, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: `http_${response.status}`, stream: true })
          return { done: false, failoverToNext: true, reason: `http_${response.status}` }
        }
        
        // 📖 Provide failover fallback for non-retryable errors from the provider (like 400 Bad Request) 
        // when they are caused by format idiosyncrasies (e.g. empty tools array that another model might accept)
        if (response.status >= 400 && response.status < 500) {
          const rawErr = await response.text()
          this.recordRouterError(`http_${response.status}`, requestId, { model: key, status: response.status, body: rawErr, stream: true })
          this.markFailure(key, `HTTP ${response.status}`)
          this.addRequestLog({ request_id: requestId, model: key, status: response.status, latency_ms: latencyMs, tokens: 0, failover: attemptIndex > 0, error: `http_${response.status}`, stream: true })
          return { done: false, failoverToNext: true, reason: `http_${response.status}` }
        }

        if (!res.writableEnded) {
          res.writeHead(response.status, {
            ...headerEntries(response.headers),
            'x-fcm-router-model': key,
            'x-request-id': requestId,
          })
          try { res.end(await response.text()) } catch {}
        }
        return { done: true }
      }

      const reader = response.body?.getReader()
      if (!reader) {
        this.markFailure(key, 'empty stream')
        return { done: false, failoverToNext: true, reason: 'empty_stream' }
      }

      const firstChunk = await this.readStreamChunkWithTimeout(reader)
      if (firstChunk.done || !firstChunk.value) {
        this.markFailure(key, 'stream ended before first chunk')
        return { done: false, failoverToNext: true, reason: 'empty_stream' }
      }
      // 📖 Guard: ensure value is a valid buffer source before conversion
      const firstChunkBuffer = Buffer.isBuffer(firstChunk.value) ? firstChunk.value : Buffer.from(firstChunk.value)
      if (isLikelyHtmlText(firstChunkBuffer.toString('utf8'))) {
        this.markFailure(key, 'upstream_html_maintenance', 503, upstreamMeta)
        this.recordRouterError('upstream_html_maintenance', requestId, { model: key, status: response.status, stream: true })
        return { done: false, failoverToNext: true, reason: 'upstream_html_maintenance' }
      }

      if (res.writableEnded) return { done: true }
      res.writeHead(response.status, {
        ...headerEntries(response.headers),
        'x-fcm-router-model': key,
        'x-request-id': requestId,
      })
      sentToClient = true
      res.write(firstChunkBuffer)

      while (!res.writableEnded) {
        const chunk = await this.readStreamChunkWithTimeout(reader)
        if (chunk.done || !chunk.value) break
        // 📖 Guard: ensure chunk value is safe for Buffer conversion
        const buf = Buffer.isBuffer(chunk.value) ? chunk.value : Buffer.from(chunk.value)
        res.write(buf)
      }

      this.markSuccess(key, latencyMs)
      this.totalRequestsRouted += 1
      this.addRequestLog({
        request_id: requestId,
        model: key,
        status: response.status,
        latency_ms: latencyMs,
        tokens: 0,
        failover: attemptIndex > 0,
        stream: true,
      })
      if (!res.writableEnded) res.end()
      return { done: true }
    } catch (error) {
      try { controller.abort() } catch {}
      if (clientAbort.aborted) {
        this.logger.info(`Client disconnected during streaming response from ${key}`, { request_id: requestId })
        return { done: true }
      }
      const reason = error.name === 'AbortError' ? 'timeout' : (error.message || String(error))
      this.markFailure(key, reason)
      if (reason !== 'timeout') {
        this.recordRouterError('upstream_stream_error', requestId, { model: key, reason, partial: sentToClient })
      } else {
        this.recordRouterError('timeout', requestId, { model: key, reason, partial: sentToClient })
      }
      this.addRequestLog({ request_id: requestId, model: key, status: 'ERR', latency_ms: null, tokens: 0, failover: attemptIndex > 0, error: reason, stream: true })
      if (sentToClient) {
        this.logger.warn(`Streaming failure after partial response from ${key}`, { request_id: requestId, reason })
        try { if (!res.writableEnded) res.end() } catch {}
        return { done: true }
      }
      return { done: false, failoverToNext: true, reason }
    } finally {
      clearTimeout(timeout)
      clientAbort.dispose()
    }
  }

  readStreamChunkWithTimeout(reader) {
    const timeoutMs = this.routerConfig().failover.streamStallTimeoutMs
    let timeout = null
    return Promise.race([
      reader.read().finally(() => {
        if (timeout) clearTimeout(timeout)
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('stream_stall_timeout')), timeoutMs)
      }),
    ])
  }

  async handleSetsRequest(req, res, url, requestId) {
    const router = this.routerConfig()
    const setNameMatch = url.pathname.match(/^\/sets\/([^/]+)$/)
    const activateMatch = url.pathname.match(/^\/sets\/([^/]+)\/activate$/)

    if (req.method === 'GET' && url.pathname === '/sets') {
      sendJson(res, 200, { activeSet: router.activeSet, sets: router.sets })
      return
    }

    if (req.method === 'POST' && url.pathname === '/sets') {
      const body = await readJsonBody(req)
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) {
        sendError(res, 400, 'Set name is required', 'invalid_request_error', 'missing_set_name', requestId)
        return
      }
      const normalized = normalizeRouterConfig({
        ...router,
        sets: {
          ...router.sets,
          [name]: {
            name,
            models: Array.isArray(body.models) ? body.models : [],
            created: nowIso(),
          },
        },
      })
      this.setRouterConfig(normalized)
      this.saveRouterConfig()
      this.broadcast('set_change', { old_set: router.activeSet, new_set: normalized.activeSet })
      sendJson(res, 201, { set: normalized.sets[normalized.activeSet] || normalized.sets[name], router: normalized })
      return
    }

    if (activateMatch && req.method === 'POST') {
      const name = decodeURIComponent(activateMatch[1])
      if (!router.sets[name]) {
        sendError(res, 404, `Router set not found: ${name}`, 'invalid_request_error', 'set_not_found', requestId)
        return
      }
      this.setRouterConfig({ ...router, activeSet: name })
      this.saveRouterConfig()
      this.broadcast('set_change', { old_set: router.activeSet, new_set: name })
      void this.runProbeBurst()
      sendJson(res, 200, { activeSet: name })
      return
    }

    if (setNameMatch && req.method === 'PUT') {
      const name = decodeURIComponent(setNameMatch[1])
      if (!router.sets[name]) {
        sendError(res, 404, `Router set not found: ${name}`, 'invalid_request_error', 'set_not_found', requestId)
        return
      }
      const body = await readJsonBody(req)
      const nextName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : name
      const nextSets = { ...router.sets }
      delete nextSets[name]
      nextSets[nextName] = {
        ...router.sets[name],
        ...body,
        name: nextName,
        models: Array.isArray(body.models) ? body.models : router.sets[name].models,
      }
      const nextActiveSet = router.activeSet === name ? nextName : router.activeSet
      const normalized = normalizeRouterConfig({ ...router, activeSet: nextActiveSet, sets: nextSets })
      this.setRouterConfig(normalized)
      this.saveRouterConfig()
      sendJson(res, 200, { set: normalized.sets[nextName], router: normalized })
      return
    }

    if (setNameMatch && req.method === 'DELETE') {
      const name = decodeURIComponent(setNameMatch[1])
      if (!router.sets[name]) {
        sendError(res, 404, `Router set not found: ${name}`, 'invalid_request_error', 'set_not_found', requestId)
        return
      }
      const nextSets = { ...router.sets }
      delete nextSets[name]
      const nextActiveSet = router.activeSet === name ? (Object.keys(nextSets)[0] || DEFAULT_ROUTER_SETTINGS.activeSet) : router.activeSet
      this.setRouterConfig({ ...router, activeSet: nextActiveSet, sets: nextSets })
      this.saveRouterConfig()
      sendJson(res, 200, { deleted: name, activeSet: this.routerConfig().activeSet })
      return
    }

    sendError(res, 404, 'Not found', 'invalid_request_error', 'not_found', requestId)
  }

  async handleProbeModeRequest(req, res, requestId) {
    const body = await readJsonBody(req)
    const nextProbeMode = typeof body.probeMode === 'string'
      ? body.probeMode.trim().toLowerCase()
      : typeof body.mode === 'string'
        ? body.mode.trim().toLowerCase()
        : ''
    if (!['eco', 'balanced', 'aggressive'].includes(nextProbeMode)) {
      sendError(res, 400, 'probeMode must be one of: eco, balanced, aggressive', 'invalid_request_error', 'invalid_probe_mode', requestId)
      return
    }

    const router = this.routerConfig()
    const previousProbeMode = router.probeMode
    this.setRouterConfig({ ...router, probeMode: nextProbeMode })
    this.saveRouterConfig()
    this.scheduleProbeLoop()
    this.broadcast('config', {
      activeSet: this.routerConfig().activeSet,
      old_probe_mode: previousProbeMode,
      probe_mode: nextProbeMode,
    })
    void this.runProbeBurst()
    sendJson(res, 200, {
      ok: true,
      previousProbeMode,
      probeMode: nextProbeMode,
    }, { 'x-request-id': requestId })
  }

  async handleHttp(req, res) {
    const requestId = req.headers['x-request-id'] || `req-${randomUUID()}`
    const url = new URL(req.url, `http://localhost:${this.port}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, this.statusPayload(), { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/stats') {
        sendJson(res, 200, this.statsPayload(), { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/stats/tokens') {
        sendJson(res, 200, this.tokenTracker.summary(), { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname.startsWith('/stats/tokens/daily/')) {
        const date = decodeURIComponent(url.pathname.replace('/stats/tokens/daily/', ''))
        sendJson(res, 200, { date, usage: this.tokenTracker.stats.daily[date] || null }, { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/v1/models') {
        const router = this.routerConfig()
        sendJson(res, 200, {
          object: 'list',
          data: [
            { id: 'fcm', object: 'model', owned_by: 'fcm-router' },
            ...Object.keys(router.sets || {}).map((name) => ({ id: `fcm:${name}`, object: 'model', owned_by: 'fcm-router' })),
          ],
        }, { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/stream/events') {
        if (this.sseClients.size >= MAX_SSE_CLIENTS) {
          sendError(res, 503, 'Too many dashboard clients', 'service_unavailable', 'too_many_sse_clients', requestId)
          return
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'x-request-id': requestId,
        })
        res.write(`event: hello\ndata: ${JSON.stringify(this.statusPayload())}\n\n`)
        this.sseClients.add(res)
        req.on('close', () => this.sseClients.delete(res))
        return
      }
      if (url.pathname === '/daemon/shutdown' && req.method === 'POST') {
        sendJson(res, 200, { ok: true, message: 'Daemon shutting down' }, { 'x-request-id': requestId })
        setTimeout(() => this.shutdown(0), 50)
        return
      }
      if (url.pathname === '/daemon/probe-mode' && req.method === 'POST') {
        await this.handleProbeModeRequest(req, res, requestId)
        return
      }
      if (url.pathname === '/sets' || url.pathname.startsWith('/sets/')) {
        await this.handleSetsRequest(req, res, url, requestId)
        return
      }

      // ─── Web Dashboard API endpoints ───────────────────────────────────────
      if (req.method === 'GET' && url.pathname === '/api/models') {
        sendJson(res, 200, getWebModelsPayload(this), { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && (url.pathname === '/api/tool-mode')) {
        sendJson(res, 200, { mode: 'opencode', tools: ['opencode', 'openclaw', 'opencode-desktop', 'opencode-web'] }, { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && (url.pathname === '/api/favorites')) {
        const cfg = this.config || {}
        sendJson(res, 200, { favorites: cfg.favorites || [], pinnedAndSticky: Boolean(cfg.settings?.favoritesPinnedAndSticky) }, { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && (url.pathname === '/api/version')) {
        sendJson(res, 200, { local: LOCAL_VERSION, latest: null, lastReleaseDate: null, error: null }, { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        sendJson(res, 200, getWebStatePayload(this), { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        sendJson(res, 200, getWebConfigPayload(this), { 'x-request-id': requestId })
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if (this.sseClients.size >= MAX_SSE_CLIENTS) {
          sendError(res, 503, 'Too many dashboard clients', 'service_unavailable', 'too_many_sse_clients', requestId)
          return
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-request-id': requestId,
        })
        res.write(`data: ${JSON.stringify(getWebStatePayload(this))}\n\n`)
        this.sseClients.add(res)
        req.on('close', () => this.sseClients.delete(res))
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/activity') {
        sendJson(res, 200, { ok: true }, { 'x-request-id': requestId })
        return
      }
      if (req.method === 'POST' && url.pathname === '/api/benchmark') {
        const body = await readJsonBody(req)
        const providerKey = typeof body.providerKey === 'string' ? body.providerKey : ''
        const modelId = typeof body.modelId === 'string' ? body.modelId : ''
        if (!this.modelCatalog.has(modelKey(providerKey, modelId))) {
          sendJson(res, 404, { error: 'Model not found' }, { 'x-request-id': requestId })
          return
        }
        if (this.webBenchmarkRunning.has(modelKey(providerKey, modelId))) {
          sendJson(res, 409, { error: 'Benchmark already in progress for this model' }, { 'x-request-id': requestId })
          return
        }
        const result = await this.runWebBenchmark(providerKey, modelId)
        sendJson(res, 200, result, { 'x-request-id': requestId })
        return
      }
      if (url.pathname === '/api/global-benchmark') {
        if (req.method === 'GET') {
          sendJson(res, 200, {
            running: this.webGlobalBenchmarkRunning,
            total: this.webGlobalBenchmarkTotal,
            completed: this.webGlobalBenchmarkCompleted,
          }, { 'x-request-id': requestId })
          return
        }
        if (req.method !== 'POST') {
          sendError(res, 405, 'Method not allowed', 'invalid_request_error', 'method_not_allowed', requestId)
          return
        }
        if (this.webGlobalBenchmarkRunning) {
          sendJson(res, 409, { error: 'Global benchmark already running' }, { 'x-request-id': requestId })
          return
        }
        const body = await readJsonBody(req)
        const result = await this.runWebGlobalBenchmark(body.models)
        sendJson(res, result.started ? 202 : 409, result, { 'x-request-id': requestId })
        return
      }
      if (url.pathname.startsWith('/api/key/')) {
        if (!isSameOriginOrLocal(req)) {
          sendError(res, 403, 'Forbidden cross-origin request', 'invalid_request_error', 'forbidden_origin', requestId)
          return
        }
        const testMatch = url.pathname.match(/^\/api\/key\/([^/]+)\/test$/)
        if (testMatch && req.method === 'POST') {
          const providerKey = decodeURIComponent(testMatch[1])
          if (!sources[providerKey]) {
            sendError(res, 404, 'Unknown provider', 'invalid_request_error', 'unknown_provider', requestId)
            return
          }
          const apiKey = this.getApiKeyForProvider(providerKey)
          if (!apiKey) {
            sendJson(res, 200, { outcome: 'missing_key', detail: `${providerKey} has no saved API key.` }, { 'x-request-id': requestId })
            return
          }
          const providerModels = sources[providerKey]?.models || []
          const modelId = providerModels[0]?.[0] || ''
          try {
            const result = await ping(apiKey, modelId, providerKey, sources[providerKey].url)
            const code = result?.code
            if (code === '200') {
              sendJson(res, 200, { outcome: 'ok', code: 200 }, { 'x-request-id': requestId })
            } else if (code === '401' || code === '403') {
              sendJson(res, 200, { outcome: 'auth_error', code: Number(code) || code }, { 'x-request-id': requestId })
            } else {
              sendJson(res, 200, { outcome: 'fail', code: code ?? 'ERR', detail: 'Probe did not return a 2xx' }, { 'x-request-id': requestId })
            }
          } catch (err) {
            sendJson(res, 200, { outcome: 'fail', detail: err.message || 'Probe failed' }, { 'x-request-id': requestId })
          }
          return
        }
        if (req.method === 'GET') {
          const providerKey = decodeURIComponent(url.pathname.slice('/api/key/'.length))
          if (!providerKey || !sources[providerKey]) {
            sendError(res, 404, 'Unknown provider', 'invalid_request_error', 'unknown_provider', requestId)
            return
          }
          const rawKey = this.getApiKeyForProvider(providerKey)
          sendJson(res, 200, { key: rawKey || null }, { 'x-request-id': requestId })
          return
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/settings') {
        // 📖 Writes API keys + provider toggles — same-origin only to block
        // 📖 CSRF-style writes from malicious browser tabs.
        if (!isSameOriginOrLocal(req)) {
          sendError(res, 403, 'Forbidden cross-origin request', 'invalid_request_error', 'forbidden_origin', requestId)
          return
        }
        const body = await readJsonBody(req)
        if (body.apiKeys) {
          for (const [key, value] of Object.entries(body.apiKeys)) {
            if (value) {
              if (!this.config.apiKeys) this.config.apiKeys = {}
              this.config.apiKeys[key] = value
            } else {
              if (this.config.apiKeys) delete this.config.apiKeys[key]
            }
          }
        }
        if (body.providers) {
          for (const [key, value] of Object.entries(body.providers)) {
            if (!this.config.providers) this.config.providers = {}
            if (!this.config.providers[key]) this.config.providers[key] = {}
            this.config.providers[key].enabled = value.enabled !== false
          }
        }
        try {
          saveConfig(this.config)
        } catch (err) {
          sendError(res, 500, 'Failed to save config: ' + err.message, 'server_error', 'config_save_failed', requestId)
          return
        }
        if (body.apiKeys) {
          for (const pk of Object.keys(body.apiKeys)) {
            if (typeof pk !== 'string' || !pk) continue
            const newModel = this.findBestModelForProviderInSources(pk)
            if (!newModel) continue
            const router = this.routerConfig()
            if (!router.activeSet) continue
            const activeSetData = router.sets?.[router.activeSet]
            if (!activeSetData || activeSetData.models?.some((m) => m.provider === pk)) continue
            const nextModels = [
              ...(activeSetData.models || []),
              { provider: pk, model: newModel, priority: (activeSetData.models?.length || 0) + 1 },
            ]
            this.setRouterConfig({
              ...router,
              sets: { ...router.sets, [router.activeSet]: { ...activeSetData, models: nextModels } },
            })
          }
          void this.runProbeBurst()
        }
        sendJson(res, 200, { success: true }, { 'x-request-id': requestId })
        return
      }

      // ─── Static file serving for web dashboard ────────────────────────────────
      if (req.method === 'GET' && (
        url.pathname === '/' || url.pathname === '/index.html' ||
        url.pathname === '/styles.css' || url.pathname === '/app.js' ||
        url.pathname.startsWith('/assets/') ||
        url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.ico')
      )) {
        serveWebStaticFile(res, url.pathname, requestId)
        return
      }
      if (url.pathname === '/v1/chat/completions' || url.pathname.match(/^\/v1\/sets\/[^/]+\/chat\/completions$/)) {
        if (req.method !== 'POST') {
          sendError(res, 405, 'Method not allowed', 'invalid_request_error', 'method_not_allowed', requestId, { allowed: ['POST'] })
          return
        }
        const setMatch = url.pathname.match(/^\/v1\/sets\/([^/]+)\/chat\/completions$/)
        const body = await readJsonBody(req)
        await this.routeRequest({ req, res, body, setName: setMatch ? decodeURIComponent(setMatch[1]) : null, requestId })
        return
      }
      sendError(res, 404, 'Not found', 'invalid_request_error', 'not_found', requestId)
    } catch (error) {
      if (error.code === 'BODY_TOO_LARGE') {
        sendError(res, 413, 'Request body too large', 'invalid_request_error', 'request_body_too_large', requestId, { max_bytes: MAX_BODY_BYTES })
        return
      }
      if (error.code === 'INVALID_JSON') {
        sendError(res, 400, 'Invalid JSON', 'invalid_request_error', 'invalid_json', requestId, { detail: error.message })
        return
      }
      this.logger.error('Internal router error', { request_id: requestId, error: error?.stack || error?.message || String(error) })
      this.recordRouterError('internal_router_error', requestId, { message: error?.message || String(error) })
      if (!res.writableEnded) {
        sendError(res, 500, 'Internal router error', 'server_error', 'internal_router_error', requestId)
      }
    }
  }

  installProcessSafety() {
    process.on('uncaughtException', (error) => {
      this.crashRecovered += 1
      this.uncaughtTimestamps.push(Date.now())
      this.uncaughtTimestamps = this.uncaughtTimestamps.filter((ts) => Date.now() - ts < 5 * 60 * 1000)
      this.logger.error('Recovered uncaught exception', { error: error.stack || error.message })
      if (this.uncaughtTimestamps.length >= 10) {
        this.logger.error('Too many uncaught exceptions; shutting down for external restart')
        void sendUsageTelemetry(this.config, {}, {
          event: 'app_router_self_restart',
          mode: 'daemon',
          properties: {
            uncaught_count: this.uncaughtTimestamps.length,
            uptime_before_restart: Math.floor((Date.now() - this.startedAt) / 1000),
            strategy: 'exit_for_service_restart',
          },
        })
        void this.shutdown(1)
      }
    })
    process.on('unhandledRejection', (reason) => {
      this.crashRecovered += 1
      this.uncaughtTimestamps.push(Date.now())
      this.uncaughtTimestamps = this.uncaughtTimestamps.filter((ts) => Date.now() - ts < 5 * 60 * 1000)
      this.logger.error('Recovered unhandled rejection', { error: reason?.stack || String(reason) })
      if (this.uncaughtTimestamps.length >= 10) {
        this.logger.error('Too many uncaught exceptions/rejections; shutting down for external restart')
        void this.shutdown(1)
      }
    })
    process.on('SIGTERM', () => void this.shutdown(0))
    process.on('SIGINT', () => void this.shutdown(0))
    process.on('SIGHUP', () => this.reloadConfigFromDisk())
  }

  async shutdown(exitCode = 0) {
    if (this.shuttingDown) return
    this.shuttingDown = true
    this.logger.info('Router daemon stopping')
    if (this.probeTimer) clearInterval(this.probeTimer)
    if (this.configReloadTimer) clearInterval(this.configReloadTimer)
    if (this.tokenFlushTimer) clearInterval(this.tokenFlushTimer)
    for (const timeout of this.probeTimeouts) clearTimeout(timeout)
    const started = Date.now()
    while (this.inFlight > 0 && Date.now() - started < 30000) {
      await sleep(100)
    }
    this.tokenTracker.flush({ force: true })
    try { this.server?.close() } catch {}
    try { unlinkSync(ROUTER_PID_PATH) } catch {}
    try { unlinkSync(ROUTER_PORT_PATH) } catch {}
    void sendUsageTelemetry(this.config, {}, {
      event: 'app_daemon_stop',
      mode: 'daemon',
      properties: {
        uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
        total_requests_routed: this.totalRequestsRouted,
        total_tokens: this.tokenTracker.stats.all_time.total_tokens,
      },
    })
    setTimeout(() => process.exit(exitCode), 20)
  }
}

const PREFERRED_DEFAULT_MODELS = [
  { provider: 'nvidia', model: 'minimaxai/minimax-m2.7' },
  { provider: 'nvidia', model: 'z-ai/glm-5.1' },
  { provider: 'nvidia', model: 'deepseek-ai/deepseek-v4-flash' },
  { provider: 'nvidia', model: 'openai/gpt-oss-120b' },
]

export function buildDefaultRouterSet(config = {}, maxModels) {
  const keyedProviders = new Set(Object.entries(config.apiKeys || {})
    .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim()))
    .map(([provider]) => provider))
  if (maxModels === undefined) maxModels = Math.max(5, keyedProviders.size * 2)
  const entries = []
  for (const [providerKey, source] of Object.entries(sources)) {
    if (!isRouteableProvider(providerKey)) continue
    for (const [model, label, tier, sweScore, ctx] of source.models || []) {
      entries.push({
        provider: providerKey,
        model,
        label,
        tier,
        sweScore,
        ctx,
        hasKey: keyedProviders.has(providerKey),
      })
    }
  }
  const preferred = entries.some((entry) => entry.hasKey)
    ? entries.filter((entry) => entry.hasKey)
    : entries
  const pinned = []
  const allRemaining = [...entries]
  for (const pref of PREFERRED_DEFAULT_MODELS) {
    const idx = allRemaining.findIndex((e) => e.provider === pref.provider && e.model === pref.model)
    if (idx >= 0) {
      pinned.push(allRemaining.splice(idx, 1)[0])
    }
  }
  const remaining = preferred.filter((e) => !pinned.some((p) => p.provider === e.provider && p.model === e.model))
  remaining.sort((a, b) => {
    const tierCmp = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
    if (tierCmp !== 0) return tierCmp
    const sweA = Number.parseFloat(a.sweScore) || 0
    const sweB = Number.parseFloat(b.sweScore) || 0
    return sweB - sweA
  })
  const ordered = [...pinned, ...remaining]
  return {
    name: DEFAULT_ROUTER_SETTINGS.activeSet,
    models: ordered.slice(0, maxModels).map((entry, index) => ({
      provider: entry.provider,
      model: entry.model,
      priority: index + 1,
    })),
    created: nowIso(),
  }
}

export function createRouterRuntimeForTest({ config, port = 0, logger = null, tokenPath = ROUTER_TOKENS_PATH } = {}) {
  const testLogger = logger || {
    level: 'error',
    error() {},
    warn() {},
    info() {},
    debug() {},
  }
  // 📖 Tests use this factory to exercise the real HTTP router against local
  // 📖 fake providers without spawning a daemon or touching user token files.
  // 📖 Router config persistence is disabled here so set/probe-mode endpoint
  // 📖 tests cannot write fixture router sets into ~/.free-coding-models.json.
  return new RouterRuntime({
    config: config || {},
    port,
    logger: testLogger,
    tokenPath,
    persistConfig: false,
  })
}

function ensureRouterConfigForDaemon(config, skipSave = false) {
  // 📖 Preserve existing named sets (e.g., created by sync-set) to avoid overwriting
  // 📖 user-created configurations. Only rebuild from favorites/defaults when no
  // 📖 sets exist at all (fresh install).
  const existingSets = config.router?.sets || {}
  const existingActiveSet = config.router?.activeSet || DEFAULT_ROUTER_SETTINGS.activeSet
  const existingSetData = existingSets[existingActiveSet]
  const hasExistingNamedSet = existingSetData && Array.isArray(existingSetData.models) && existingSetData.models.length > 0

  let activeSet
  if (hasExistingNamedSet) {
    activeSet = { name: existingActiveSet, models: existingSetData.models, created: existingSetData.created }
  } else {
    const favSet = buildRouterSetFromFavorites(config)
    activeSet = favSet || buildDefaultRouterSet(config)
  }
  config.router = normalizeRouterConfig({
    ...DEFAULT_ROUTER_SETTINGS,
    enabled: true,
    onboardingSeen: true,
    activeSet: activeSet.name,
    sets: { [activeSet.name]: activeSet },
  })
  if (!skipSave) saveConfig(config)
  return config.router
}

/**
 * 📖 Build a router set from the user's favorites list.
 * 📖 Each favorite "providerKey/modelId" is resolved to its source model entry.
 * 📖 Falls back to buildDefaultRouterSet if no favorites exist.
 */
function buildRouterSetFromFavorites(config) {
  const favorites = config.favorites
  if (!Array.isArray(favorites) || favorites.length === 0) return null
  const models = []
  for (let i = 0; i < favorites.length; i++) {
    const fav = favorites[i]
    const slashIdx = fav.indexOf('/')
    if (slashIdx < 0) continue
    const providerKey = fav.slice(0, slashIdx)
    const modelId = fav.slice(slashIdx + 1)
    if (!isRouteableProvider(providerKey)) continue
    const source = sources[providerKey]
    if (!source) continue
    const found = (source.models || []).find((m) => m[0] === modelId)
    if (!found) {
      models.push({ provider: providerKey, model: modelId, priority: i + 1 })
      continue
    }
    models.push({ provider: providerKey, model: found[0], priority: i + 1 })
  }
  if (models.length === 0) return null
  return {
    name: DEFAULT_ROUTER_SETTINGS.activeSet,
    models,
    created: nowIso(),
  }
}

function listenOnPort(server, port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('error', onError)
      reject(error)
    }
    const onListening = () => {
      server.off('listening', onListening)
      resolve(port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

async function listenWithFallback(server, preferredPort, logger, host = '127.0.0.1') {
  const { defaultPort, maxPort } = getRouterPortRange()
  const start = Math.max(1, preferredPort || defaultPort)
  const candidates = []
  for (let port = start; port <= maxPort; port += 1) candidates.push(port)
  if (!candidates.includes(defaultPort)) {
    for (let port = defaultPort; port <= maxPort; port += 1) candidates.push(port)
  }
  let lastError = null
  for (const port of candidates) {
    try {
      await listenOnPort(server, port, host)
      return port
    } catch (error) {
      lastError = error
      logger.warn(`Port ${port} unavailable`, { error: error.code || error.message })
    }
  }
  throw lastError || new Error('No router ports available')
}

export async function runRouterDaemon() {
  const config = loadConfig()
  const router = ensureRouterConfigForDaemon(config)
  const logger = new RouterLogger(ROUTER_LOG_PATH, router.logLevel)
  const runtime = new RouterRuntime({ config, port: router.port, logger })
  runtime.installProcessSafety()
  const server = createServer((req, res) => void runtime.handleHttp(req, res))
  runtime.server = server
  const host = process.env.FCM_HOST || '127.0.0.1'
  const port = await listenWithFallback(server, router.port, logger, host)
  runtime.port = port
  runtime.config.router.port = port
  saveConfig(runtime.config)
  try { writeFileSync(ROUTER_PID_PATH, String(process.pid), { mode: 0o600 }) } catch (error) { logger.warn('PID file write failed', { error: error.message }) }
  try { writeFileSync(ROUTER_PORT_PATH, String(port), { mode: 0o600 }) } catch (error) { logger.warn('Port file write failed', { error: error.message }) }
  logger.info('Router daemon started', { pid: process.pid, port, host, activeSet: runtime.routerConfig().activeSet })
  void sendUsageTelemetry(runtime.config, {}, {
    event: 'app_daemon_start',
    mode: 'daemon',
    properties: {
      port,
      set_count: Object.keys(runtime.routerConfig().sets || {}).length,
      models_in_active_set: runtime.getSet()?.models?.length || 0,
      auto_start: false,
      probe_mode: runtime.routerConfig().probeMode,
    },
  })
  runtime.configReloadTimer = setInterval(() => runtime.reloadConfigFromDisk(), CONFIG_RELOAD_INTERVAL_MS)
  runtime.tokenFlushTimer = setInterval(() => runtime.tokenTracker.flush(), TOKEN_FLUSH_INTERVAL_MS)
  void runtime.runProbeBurst()
  runtime.scheduleProbeLoop()
  return runtime
}

export async function getRouterDaemonStatus() {
  const { defaultPort, maxPort } = getRouterPortRange()
  const ports = []
  const recordedPort = readNumberFile(ROUTER_PORT_PATH)
  if (recordedPort) ports.push(recordedPort)
  for (let port = defaultPort; port <= maxPort; port += 1) {
    if (!ports.includes(port)) ports.push(port)
  }
  for (const port of ports) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return await response.json()
    } catch {
      // 📖 Keep scanning the small discovery range.
    }
  }
  const pid = readNumberFile(ROUTER_PID_PATH)
  return {
    ok: false,
    running: false,
    stalePid: pid && !isProcessAlive(pid) ? pid : null,
    pid: pid || null,
    port: recordedPort || null,
  }
}

export async function startRouterDaemonBackground() {
  const existing = await getRouterDaemonStatus()
  if (existing.ok) return { ...existing, alreadyRunning: true }

  const child = fork(CLI_ENTRY_PATH, ['--daemon'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()
  for (let i = 0; i < 40; i += 1) {
    await sleep(250)
    const status = await getRouterDaemonStatus()
    if (status.ok) return { ...status, alreadyRunning: false }
  }
  return { ok: false, running: false, pid: child.pid, error: 'Daemon did not become healthy before timeout' }
}

export async function stopRouterDaemon() {
  const pid = readNumberFile(ROUTER_PID_PATH)
  if (!pid) return { ok: false, stopped: false, error: 'No daemon PID file found' }
  if (!isProcessAlive(pid)) {
    try { unlinkSync(ROUTER_PID_PATH) } catch {}
    return { ok: true, stopped: false, stalePid: pid }
  }
  process.kill(pid, 'SIGTERM')
  for (let i = 0; i < 60; i += 1) {
    await sleep(250)
    if (!isProcessAlive(pid)) return { ok: true, stopped: true, pid }
  }
  return { ok: false, stopped: false, pid, error: 'Daemon did not stop before timeout' }
}
