/**
 * @file daemon-client.js
 * @description HTTP client for querying the local free-coding-models daemon API.
 *
 * @details
 *   Queries the localhost daemon on port 19280. If active, it fetches pre-probed
 *   model health, latencies, and benchmark statistics, avoiding the need to
 *   run separate network pings during the Pi session startup.
 */

const DAEMON_PORT = 19280
const DAEMON_BASE_URL = `http://localhost:${DAEMON_PORT}`

/**
 * 📖 Check if the FCM daemon is running.
 * 
 * @returns {Promise<boolean>} True if running, false otherwise
 */
export async function isDaemonRunning() {
  try {
    const res = await fetch(`${DAEMON_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500) // 1.5s timeout for fast response
    })
    return res.ok
  } catch (err) {
    return false
  }
}

/**
 * 📖 Fetch the model list payload from the daemon.
 * 
 * @returns {Promise<Array<object>|null>} Array of models, or null on failure
 */
export async function fetchDaemonModels() {
  try {
    const res = await fetch(`${DAEMON_BASE_URL}/api/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3s timeout
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
