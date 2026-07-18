/**
 * @file daemon-client.js
 * @description HTTP client for the local free-coding-models daemon (shared core).
 *
 * @details
 *   Talks to the localhost FCM daemon on port 19280. When active, it exposes
 *   pre-probed model health, latencies, and benchmark stats so an agent adapter
 *   can skip running its own network pings. All requests are short-timeout and
 *   never throw — they resolve to null/false so callers can fall back cleanly.
 *
 * @functions
 *   - isDaemonRunning → Health-check the local FCM daemon
 *   - fetchDaemonModels → Fetch the /api/models payload
 *   - queryDaemon → Merge health + models into one daemon state object
 */

const DEFAULT_DAEMON_PORT = 19280
export const DAEMON_PORT = Number(process.env.FCM_ROUTER_PORT) || DEFAULT_DAEMON_PORT
export const DAEMON_BASE_URL = `http://localhost:${DAEMON_PORT}`

/**
 * 📖 Check if the FCM daemon is running.
 *
 * @param {number} [timeoutMs=1500] - Health-check timeout
 * @returns {Promise<boolean>} True if running, false otherwise
 */
export async function isDaemonRunning(timeoutMs = 1500) {
  try {
    const res = await fetch(`${DAEMON_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs)
    })
    return res.ok
  } catch (err) {
    return false
  }
}

/**
 * 📖 Fetch the model list payload from the daemon.
 *
 * @param {number} [timeoutMs=3000] - Fetch timeout
 * @returns {Promise<Array<object>|null>} Array of models, or null on failure
 */
export async function fetchDaemonModels(timeoutMs = 3000) {
  try {
    const res = await fetch(`${DAEMON_BASE_URL}/api/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    return null
  }
}

/**
 * 📖 Query both health and model payloads and merge the status.
 *
 * @returns {Promise<object|null>} Merged daemon state or null if not running
 */
export async function queryDaemon() {
  const active = await isDaemonRunning()
  if (!active) return null

  const models = await fetchDaemonModels()
  if (!models) return null

  return {
    available: true,
    models
  }
}
