/**
 * @file cloudflare-account.js
 * @description Central Cloudflare account-id resolution for the account-scoped Workers AI endpoint.
 *
 * @details
 *   WHY: Cloudflare's OpenAI-compatible endpoint is per-account
 *   (`https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`).
 *   The catalog URL in sources.js therefore carries a `{$CLOUDFLARE_ACCOUNT_ID}`
 *   placeholder, and every request path must replace it with a real account id
 *   before hitting the API. A literal or missing id makes Cloudflare's router
 *   return 404 for every model, 100% of the time (issue #181).
 *
 *   Resolution order (first hit wins):
 *     1. `CLOUDFLARE_ACCOUNT_ID` env var
 *     2. In-process cache (a previously resolved or discovered id)
 *     3. Stored config `settings.cloudflareAccountId` (~/.free-coding-models.json)
 *     4. Auto-discovery: GET /client/v4/accounts with the stored Cloudflare API key
 *        (env CLOUDFLARE_API_TOKEN/CLOUDFLARE_API_KEY or config apiKeys.cloudflare);
 *        the first account's id is cached in-process AND persisted to the config
 *        settings so discovery only ever happens once. Best-effort: on failure the
 *        old 'missing-account-id' behavior is kept and discovery backs off for
 *        DISCOVERY_RETRY_COOLDOWN_MS so probes never hammer the endpoint.
 *
 *   The pure decision helpers (env / settings / discovery-payload / URL substitution)
 *   are exported separately so tests can cover every branch hermetically with
 *   injected dependencies, no network and no real config file.
 *
 *   📖 Note: `settings.cloudflareAccountId` is intentionally NOT added to
 *   normalizeSettingsSection() in config.js: unknown settings keys pass through the
 *   spread, so a stale process that loaded its config before discovery never clobbers
 *   the persisted id on its next saveConfig() (it does not carry the key at all).
 *
 * @functions
 *   → `pickAccountIdFromEnv(env)` - pure: trimmed CLOUDFLARE_ACCOUNT_ID or null
 *   → `pickAccountIdFromSettings(settings)` - pure: stored settings.cloudflareAccountId or null
 *   → `pickAccountIdFromDiscoveryResponse(payload)` - pure: first account id from a /accounts JSON body
 *   → `applyCloudflareAccountId(url, accountId)` - pure: substitute the URL placeholders (encode + safe fallback)
 *   → `getCloudflareAccountIdSync(deps)` - sync env > cache > stored-config resolution
 *   → `ensureCloudflareAccountId(deps)` - async: sync resolution, then best-effort discovery (cached + persisted)
 *   → `resolveCloudflareUrlAsync(url, deps)` - async: resolve the URL after guaranteeing an account id
 *   → `resetCloudflareAccountStateForTests()` - clear in-process caches between tests
 *
 * @exports CLOUDFLARE_ACCOUNTS_URL, pickAccountIdFromEnv, pickAccountIdFromSettings,
 *          pickAccountIdFromDiscoveryResponse, applyCloudflareAccountId,
 *          getCloudflareAccountIdSync, ensureCloudflareAccountId, resolveCloudflareUrlAsync,
 *          resetCloudflareAccountStateForTests
 *
 * @see src/core/ping.js - resolveCloudflareUrl (sync wrapper) + ping() probe path
 * @see web/server.js - benchmark SSE + playground direct-route request paths
 * @see issue #181 - why every cloudflare model probed as 404
 */

import { existsSync, readFileSync } from 'node:fs'
import { CONFIG_PATH, saveConfig } from './config.js'

// 📖 Cloudflare account-list endpoint: a plain GET with the API key as Bearer
// 📖 returns the accounts the token can access; the first id is what probes need.
export const CLOUDFLARE_ACCOUNTS_URL = 'https://api.cloudflare.com/client/v4/accounts'

// 📖 Fallback segment kept identical to ping.js's historical behavior so verdicts,
// 📖 docs and error messages stay stable when no account id can be resolved.
const MISSING_ACCOUNT_ID = 'missing-account-id'

// 📖 Discovery is best-effort: short timeout so probes never stall on it, and a
// 📖 cooldown after failures so a broken key does not turn every ping into a
// 📖 /accounts round-trip.
const DISCOVERY_TIMEOUT_MS = 8000
const DISCOVERY_RETRY_COOLDOWN_MS = 5 * 60 * 1000

// 📖 In-process state: a resolved id is stable for the lifetime of the process,
// 📖 so cache aggressively and dedupe concurrent discoveries.
let cachedAccountId = null
let diskSettingsLoaded = false
let diskAccountId = null
let discoveryInFlight = null
// 📖 null = no failure yet; a timestamp (per the injectable clock) once a
// 📖 discovery attempt failed, so back-off works with any clock source.
let lastDiscoveryFailureAt = null

/**
 * 📖 Pure: read the account id from an env-style object. Trimmed, or null.
 * @param {NodeJS.ProcessEnv | Record<string, string|undefined>} [env]
 * @returns {string|null}
 */
export function pickAccountIdFromEnv(env = process.env) {
  const raw = typeof env.CLOUDFLARE_ACCOUNT_ID === 'string' ? env.CLOUDFLARE_ACCOUNT_ID.trim() : ''
  return raw || null
}

/**
 * 📖 Pure: read the account id from a stored settings section. Trimmed, or null.
 * @param {Record<string, unknown>|undefined} settings
 * @returns {string|null}
 */
export function pickAccountIdFromSettings(settings) {
  const raw = settings && typeof settings.cloudflareAccountId === 'string'
    ? settings.cloudflareAccountId.trim()
    : ''
  return raw || null
}

/**
 * 📖 Pure: extract the first usable account id from a /accounts JSON response.
 * 📖 Cloudflare answers { success: true, result: [{ id: '...' }, ...] } on success
 * 📖 and { success: false, errors: [...] } on auth failures; both must be safe.
 * @param {unknown} payload
 * @returns {string|null}
 */
export function pickAccountIdFromDiscoveryResponse(payload) {
  if (!payload || typeof payload !== 'object' || payload.success !== true) return null
  const accounts = Array.isArray(payload.result) ? payload.result : []
  for (const account of accounts) {
    const id = account && typeof account.id === 'string' ? account.id.trim() : ''
    if (id) return id
  }
  return null
}

/**
 * 📖 Pure: substitute the account-id placeholders in a catalog URL.
 * 📖 Encodes the id so odd characters can never break the path, falls back to
 * 📖 the historical 'missing-account-id' segment, and leaves URLs without a
 * 📖 placeholder completely untouched.
 * @param {string} url
 * @param {string|null} accountId
 * @returns {string}
 */
export function applyCloudflareAccountId(url, accountId) {
  const hasPlaceholder = url.includes('{$CLOUDFLARE_ACCOUNT_ID}') || url.includes('{account_id}')
  if (!hasPlaceholder) return url
  const replacement = accountId ? encodeURIComponent(accountId) : MISSING_ACCOUNT_ID
  return url
    .replace(/\{\$CLOUDFLARE_ACCOUNT_ID\}/g, replacement)
    .replace(/\{account_id\}/g, replacement)
}

// 📖 One-shot read of the stored settings.cloudflareAccountId from the config
// 📖 file. Deliberately a raw readFileSync (no loadConfig side effects like
// 📖 auto-repair or console noise) because this runs on every probe path.
function readDiskSettings() {
  if (diskSettingsLoaded) return diskAccountId
  diskSettingsLoaded = true
  try {
    if (existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
      diskAccountId = pickAccountIdFromSettings(parsed?.settings)
    }
  } catch {
    // 📖 Corrupt or unreadable config - behave as if nothing is stored.
  }
  return diskAccountId
}

/**
 * 📖 Sync resolution: env var, then in-process cache, then stored config.
 * 📖 Used by every synchronous URL builder (ping request builder, benchmarks,
 * 📖 router daemon, tool launchers, endpoint installer).
 * @param {{ env?: NodeJS.ProcessEnv|Record<string, string|undefined>, settingsProvider?: () => string|null }} [deps]
 * @returns {string|null}
 */
export function getCloudflareAccountIdSync({ env = process.env, settingsProvider = readDiskSettings } = {}) {
  const fromEnv = pickAccountIdFromEnv(env)
  if (fromEnv) {
    cachedAccountId = fromEnv
    return fromEnv
  }
  if (cachedAccountId) return cachedAccountId
  const stored = settingsProvider()
  if (stored) {
    cachedAccountId = stored
    return stored
  }
  return null
}

/**
 * 📖 Best-effort persistence of a discovered id into the config settings so
 * 📖 discovery only happens once per machine, not once per process.
 * 📖 Reads a fresh snapshot right before saving to minimize clobber risk.
 * @param {string} accountId
 * @returns {void}
 */
function persistAccountIdToDisk(accountId) {
  try {
    if (!existsSync(CONFIG_PATH)) return
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return
    if (!parsed.settings || typeof parsed.settings !== 'object') parsed.settings = {}
    if (parsed.settings.cloudflareAccountId === accountId) return
    parsed.settings.cloudflareAccountId = accountId
    saveConfig(parsed)
  } catch {
    // 📖 Persistence is an optimization; resolution still works in-process.
  }
}

// 📖 Discovery API key: same candidates as config.js's ENV_VARS.cloudflare,
// 📖 falling back to the stored config key (string or multi-key array).
function readDiscoveryApiKey({ env, storedApiKeyProvider }) {
  for (const candidate of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY']) {
    const raw = typeof env[candidate] === 'string' ? env[candidate].trim() : ''
    if (raw) return raw
  }
  return storedApiKeyProvider() || null
}

function readStoredApiKeyFromDisk() {
  try {
    if (!existsSync(CONFIG_PATH)) return null
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
    const stored = parsed?.apiKeys?.cloudflare
    if (Array.isArray(stored)) {
      const first = stored.find(k => typeof k === 'string' && k.length > 0)
      return first ?? null
    }
    return typeof stored === 'string' && stored ? stored : null
  } catch {
    return null
  }
}

/**
 * 📖 Async orchestrator: resolve via env/cache/config, then discover.
 * 📖 Inject every dependency in tests - never let tests touch the network.
 * @param {{
 *   env?: NodeJS.ProcessEnv|Record<string, string|undefined>,
 *   settingsProvider?: () => string|null,
 *   apiKey?: string|null,
 *   storedApiKeyProvider?: () => string|null,
 *   fetchImpl?: typeof fetch,
 *   persist?: (accountId: string) => void,
 *   now?: () => number,
 * }} [deps]
 * @returns {Promise<string|null>} the resolved id, or null (caller keeps 'missing-account-id')
 */
export async function ensureCloudflareAccountId({
  env = process.env,
  settingsProvider = readDiskSettings,
  apiKey = undefined,
  storedApiKeyProvider = readStoredApiKeyFromDisk,
  fetchImpl = globalThis.fetch,
  persist = persistAccountIdToDisk,
  now = Date.now,
} = {}) {
  const existing = getCloudflareAccountIdSync({ env, settingsProvider })
  if (existing) return existing

  const key = apiKey !== undefined ? apiKey : readDiscoveryApiKey({ env, storedApiKeyProvider })
  // 📖 No key means discovery cannot authenticate: stay in fail-safe mode
  // 📖 instead of firing an always-401 request on every probe.
  if (!key) return null

  // 📖 After a failure, back off so probe loops never hammer /accounts.
  if (lastDiscoveryFailureAt !== null && now() - lastDiscoveryFailureAt < DISCOVERY_RETRY_COOLDOWN_MS) return null

  // 📖 Dedupe concurrent probes: share one in-flight discovery.
  if (discoveryInFlight) return discoveryInFlight

  discoveryInFlight = (async () => {
    try {
      const resp = await fetchImpl(CLOUDFLARE_ACCOUNTS_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      })
      let payload = null
      try { payload = await resp.json() } catch { /* non-JSON error body */ }
      const id = resp.ok ? pickAccountIdFromDiscoveryResponse(payload) : null
      if (id) {
        cachedAccountId = id
        persist(id)
        return id
      }
      lastDiscoveryFailureAt = now()
      return null
    } catch {
      // 📖 Network error, timeout or abort: fail safe, back off.
      lastDiscoveryFailureAt = now()
      return null
    } finally {
      discoveryInFlight = null
    }
  })()
  return discoveryInFlight
}

/**
 * 📖 Async URL resolution for request paths that are already async: guarantee
 * 📖 an account id (running discovery if needed) before substituting. Every
 * 📖 caller that POSTs to the Cloudflare endpoint should go through this or
 * 📖 through ping's sync resolveCloudflareUrl after ensure has run.
 * @param {string} url
 * @param {Parameters<typeof ensureCloudflareAccountId>[0]} [deps]
 * @returns {Promise<string>}
 */
export async function resolveCloudflareUrlAsync(url, deps = {}) {
  const accountId = await ensureCloudflareAccountId(deps)
  return applyCloudflareAccountId(url, accountId)
}

/**
 * 📖 Test-only: clear all in-process state so tests stay hermetic.
 * @returns {void}
 */
export function resetCloudflareAccountStateForTests() {
  cachedAccountId = null
  diskSettingsLoaded = false
  diskAccountId = null
  discoveryInFlight = null
  lastDiscoveryFailureAt = null
}
