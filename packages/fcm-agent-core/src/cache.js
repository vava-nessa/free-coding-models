/**
 * @file cache.js
 * @description Namespaced on-disk cache for FCM scan results (shared core).
 *
 * @details
 *   Each agent adapter keeps its own scan cache so repeated `/fcm`/startup reads
 *   are instant, but they all share this store implementation. A store has a
 *   primary file path plus optional legacy paths (e.g. the OpenCode adapter
 *   still reads the old Pi cache location so a scan done in one tool benefits
 *   the other). Reads return a normalized payload: ranked models filtered by
 *   the agent context-safety floor, with `bestModel` pointing at ranked[0].
 *
 * @functions
 *   - createCacheStore → Build a { read, write, clear } store for one adapter
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { isContextUsable, MIN_CONTEXT_WINDOW } from './model-config.js'

export const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000

/**
 * 📖 Read + validate one cache file. Returns null if missing, stale, or invalid.
 *
 * @param {string} filePath - Cache file to read
 * @param {number} ttlMs - Max age in milliseconds
 * @param {number} minContextWindow - Floor for the context-safety filter
 * @returns {object|null} Normalized scan payload, or null
 */
function readCacheFile(filePath, ttlMs, minContextWindow) {
  if (!filePath || !existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf8')
    const cache = JSON.parse(raw)
    if (!cache || typeof cache !== 'object') return null
    if (typeof cache.timestamp === 'number' && Date.now() - cache.timestamp > ttlMs) return null

    const data = cache.data || cache
    if (!data || !Array.isArray(data.ranked)) return null

    // 📖 Re-apply the context-safety floor at read time so a catalog policy
    // 📖 change (e.g. raising MIN_CONTEXT_WINDOW) takes effect on cached reads.
    const ranked = data.ranked.filter((m) => isContextUsable(m, minContextWindow))
    return {
      ...data,
      ranked,
      bestModel: ranked[0] || null
    }
  } catch (err) {
    return null
  }
}

/**
 * 📖 Build a namespaced cache store for one adapter.
 *
 * @param {object} options
 * @param {string} options.filePath - Primary cache file location
 * @param {string[]} [options.legacyPaths=[]] - Older paths to fall back to on read
 * @param {number} [options.ttlMs=DEFAULT_CACHE_TTL_MS] - Time-to-live
 * @param {number} [options.minContextWindow=MIN_CONTEXT_WINDOW] - Context floor
 * @returns {{ read: Function, write: Function, clear: Function, filePath: string }}
 */
export function createCacheStore({ filePath, legacyPaths = [], ttlMs = DEFAULT_CACHE_TTL_MS, minContextWindow = MIN_CONTEXT_WINDOW }) {
  const allReadPaths = [filePath, ...legacyPaths]

  return {
    filePath,
    ttlMs,

    read() {
      for (const path of allReadPaths) {
        const data = readCacheFile(path, ttlMs, minContextWindow)
        if (data) return data
      }
      return null
    },

    write(data) {
      if (!filePath) return
      try {
        mkdirSync(dirname(filePath), { recursive: true })
        const payload = { timestamp: Date.now(), data }
        writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
      } catch (err) {
        // 📖 Cache writes are best-effort; never break a scan or startup.
      }
    },

    clear() {
      if (!filePath || !existsSync(filePath)) return
      try {
        unlinkSync(filePath)
      } catch (err) {
        // 📖 Best-effort cleanup.
      }
    }
  }
}
