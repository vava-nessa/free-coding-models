/**
 * @file lib/usage-reader.js
 * @description Pure functions to read provider-scoped Usage snapshots from token-stats.json.
 *
 * Designed for TUI consumption: reads the pre-computed provider-scoped quota
 * snapshots written by TokenStats. Never reads the JSONL log.
 *
 * The UI must distinguish the same model served by different Origins
 * (for example NVIDIA vs Groq). Because of that, the canonical snapshot source
 * is `quotaSnapshots.byProviderModel`, not the legacy `byModel` aggregate.
 *
 * All functions are pure (no shared mutable state) and handle missing/malformed
 * files gracefully by returning safe fallback values.
 *
 * Default path: ~/.free-coding-models/token-stats.json
 *
 * ## Freshness contract
 * Usage snapshots carry an `updatedAt` ISO timestamp.  Any entry whose
 * `updatedAt` is older than SNAPSHOT_TTL_MS (30 minutes) is excluded and
 * treated as `N/A` by the UI.  Entries that predate this feature (no
 * `updatedAt` field) are included for backward compatibility.
 *
 * ## Parse cache
 * `loadUsageSnapshot` maintains a module-level in-memory cache keyed by the
 * resolved stats-file path.  Each cache entry is valid for CACHE_TTL_MS
 * (500 ms – 1 000 ms).  This avoids redundant synchronous disk reads when the
 * TUI rerenders multiple times within the same tick or across a few frames.
 * The 30-minute data-freshness filter (SNAPSHOT_TTL_MS) is applied every time
 * the snapshot is parsed — caching never bypasses it.
 *
 * Use `clearUsageCache()` to evict all entries (useful in tests).
 *
 * @exports SNAPSHOT_TTL_MS
 * @exports CACHE_TTL_MS
 * @exports clearUsageCache
 * @exports loadUsageSnapshot
 * @exports buildUsageSnapshotKey
 * @exports loadUsageMap
 * @exports usageForModelId
 * @exports usageForRow
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { supportsUsagePercent, usageResetsDaily } from './quota-capabilities.js'

const DEFAULT_STATS_FILE = join(homedir(), '.free-coding-models', 'token-stats.json')

/**
 * Freshness TTL for quota snapshots in milliseconds (30 minutes).
 * Snapshots older than this are treated as stale and excluded from results.
 * The UI renders stale/missing entries as `N/A`.
 */
export const SNAPSHOT_TTL_MS = 30 * 60 * 1000

/**
 * TTL for the module-level parse cache in milliseconds (750 ms).
 * Within this window repeated calls to loadUsageSnapshot with the same path
 * return the already-parsed result without touching the filesystem.
 */
export const CACHE_TTL_MS = 750

/**
 * Module-level cache: path → { snapshot, expiresAt }
 * @type {Map<string, { snapshot: { byProviderModel: Record<string, number>, byProvider: Record<string, number>, legacyByModel: Record<string, number> }, expiresAt: number }>}
 */
const _cache = new Map()

/**
 * Evict all cached parse results.  Subsequent calls to loadUsageSnapshot will
 * re-read from disk.  Primarily intended for use in tests.
 */
export function clearUsageCache() {
  _cache.clear()
}

/**
 * Returns true when the snapshot entry is considered fresh enough to display.
 *
 * Rules:
 * - If `updatedAt` is absent (older format): include for backward compatibility.
 * - If `updatedAt` parses to a time older than SNAPSHOT_TTL_MS ago: exclude (stale).
 * - If `updatedAt` is within TTL (strictly less than TTL ms ago): include.
 *
 * @param {{ updatedAt?: string }} entry
 * @param {number} [nowMs] - optional current time (ms) for testability
 * @returns {boolean}
 */
function isSnapshotFresh(entry, nowMs = Date.now(), providerKey = null) {
  if (!entry || typeof entry.updatedAt !== 'string') return true // backward compat
  const updatedMs = Date.parse(entry.updatedAt)
  if (!Number.isFinite(updatedMs)) return true // unparseable: be generous
  if (providerKey && usageResetsDaily(providerKey)) {
    const nowDay = new Date(nowMs).toISOString().slice(0, 10)
    const updatedDay = entry.updatedAt.slice(0, 10)
    if (updatedDay !== nowDay) return false
  }
  return nowMs - updatedMs < SNAPSHOT_TTL_MS
}

/**
 * Build the canonical map key for one Origin + model pair.
 *
 * @param {string} providerKey
 * @param {string} modelId
 * @returns {string}
 */
export function buildUsageSnapshotKey(providerKey, modelId) {
  return `${providerKey}::${modelId}`
}

/**
 * Load token-stats.json and return model/provider usage maps.
 * Entries with stale `updatedAt` (older than SNAPSHOT_TTL_MS) are excluded.
 *
 * Results are cached in memory for CACHE_TTL_MS to avoid repeated disk reads.
 * The 30-minute data freshness filter is re-applied on every cache miss (parse).
 *
 * @param {string} [statsFile]
 * @returns {{ byProviderModel: Record<string, number>, byProvider: Record<string, number>, legacyByModel: Record<string, number> }}
 */
export function loadUsageSnapshot(statsFile = DEFAULT_STATS_FILE) {
  const now = Date.now()

  // Return cached result if still valid
  const cached = _cache.get(statsFile)
  if (cached && now < cached.expiresAt) {
    return cached.snapshot
  }

  // Cache miss — parse from disk
  const snapshot = _parseSnapshot(statsFile, now)
  _cache.set(statsFile, { snapshot, expiresAt: now + CACHE_TTL_MS })
  return snapshot
}

/**
 * Internal: read and parse token-stats.json without caching.
 *
 * @param {string} statsFile
 * @param {number} now - current time in ms (for freshness checks)
 * @returns {{ byProviderModel: Record<string, number>, byProvider: Record<string, number>, legacyByModel: Record<string, number> }}
 */
function _parseSnapshot(statsFile, now) {
  try {
    if (!existsSync(statsFile)) return { byProviderModel: {}, byProvider: {}, legacyByModel: {} }
    const raw = readFileSync(statsFile, 'utf8')
    const data = JSON.parse(raw)

    const byProviderModelSrc = data?.quotaSnapshots?.byProviderModel
    const byModelSrc = data?.quotaSnapshots?.byModel
    const byProviderSrc = data?.quotaSnapshots?.byProvider

    const byProviderModel = {}
    if (byProviderModelSrc && typeof byProviderModelSrc === 'object') {
      for (const [snapshotKey, entry] of Object.entries(byProviderModelSrc)) {
        const providerKey = typeof entry?.providerKey === 'string'
          ? entry.providerKey
          : snapshotKey.split('::', 1)[0]
        if (!supportsUsagePercent(providerKey)) continue
        if (entry && typeof entry.quotaPercent === 'number' && Number.isFinite(entry.quotaPercent)) {
          if (isSnapshotFresh(entry, now, providerKey)) {
            byProviderModel[snapshotKey] = entry.quotaPercent
          }
        }
      }
    }

    // 📖 Legacy map kept only for backward compatibility helpers/tests.
    const legacyByModel = {}
    if (byModelSrc && typeof byModelSrc === 'object') {
      for (const [modelId, entry] of Object.entries(byModelSrc)) {
        if (entry && typeof entry.quotaPercent === 'number' && Number.isFinite(entry.quotaPercent)) {
          if (isSnapshotFresh(entry, now)) {
            legacyByModel[modelId] = entry.quotaPercent
          }
        }
      }
    }

    const byProvider = {}
    if (byProviderSrc && typeof byProviderSrc === 'object') {
      for (const [providerKey, entry] of Object.entries(byProviderSrc)) {
        if (!supportsUsagePercent(providerKey)) continue
        if (entry && typeof entry.quotaPercent === 'number' && Number.isFinite(entry.quotaPercent)) {
          if (isSnapshotFresh(entry, now, providerKey)) {
            byProvider[providerKey] = entry.quotaPercent
          }
        }
      }
    }

    return { byProviderModel, byProvider, legacyByModel }
  } catch {
    return { byProviderModel: {}, byProvider: {}, legacyByModel: {} }
  }
}

/**
 * Load token-stats.json and return a plain object mapping provider+model → quotaPercent.
 *
 * Only includes models whose `quotaPercent` is a finite number and whose
 * snapshot is fresh (within SNAPSHOT_TTL_MS).
 * Returns an empty object on any error (missing file, bad JSON, missing keys).
 *
 * @param {string} [statsFile] - Path to token-stats.json (defaults to ~/.free-coding-models/token-stats.json)
 * @returns {Record<string, number>}  e.g. { 'groq::openai/gpt-oss-120b': 37 }
 */
export function loadUsageMap(statsFile = DEFAULT_STATS_FILE) {
  return loadUsageSnapshot(statsFile).byProviderModel
}

/**
 * Return the legacy quota percent remaining for a specific modelId.
 * This helper is retained for backward compatibility tests only.
 *
 * @param {string} modelId
 * @param {string} [statsFile] - Path to token-stats.json (defaults to ~/.free-coding-models/token-stats.json)
 * @returns {number | null}  quota percent (0–100), or null if unknown/stale
 */
export function usageForModelId(modelId, statsFile = DEFAULT_STATS_FILE) {
  const map = loadUsageSnapshot(statsFile).legacyByModel
  const value = map[modelId]
  return value !== undefined ? value : null
}

/**
 * Return quota percent for a table row with model-first, provider fallback.
 * Both model and provider snapshots are checked for freshness independently.
 * Returns null when both are absent or stale.
 *
 * @param {string} providerKey
 * @param {string} modelId
 * @param {string} [statsFile]
 * @returns {number | null}
 */
export function usageForRow(providerKey, modelId, statsFile = DEFAULT_STATS_FILE) {
  if (!supportsUsagePercent(providerKey)) return null
  const { byProviderModel, byProvider } = loadUsageSnapshot(statsFile)
  const providerModelKey = buildUsageSnapshotKey(providerKey, modelId)
  if (byProviderModel[providerModelKey] !== undefined) return byProviderModel[providerModelKey]
  if (byProvider[providerKey] !== undefined) return byProvider[providerKey]
  return null
}
