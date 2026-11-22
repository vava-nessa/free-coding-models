/**
 * @file test/fixtures/web-settings-delete-key.mjs
 * @description Child-process fixture for GH #208 on the dev/npm web dashboard
 * (`web/server.js`, the `--web` surface). Prints one JSON line with the result.
 *
 * @details
 *   📖 Its own process because `web/server.js` captures the config at module
 *   load (`let config = loadConfig()`), and CONFIG_PATH is resolved once from
 *   FCM_CONFIG_DIR. The parent test sets FCM_CONFIG_DIR to a temp directory, so
 *   the real ~/.free-coding-models.json is never touched.
 *
 *   📖 Verifies the delete survives: after POST { apiKeys: { groq: '' } } the
 *   key must be gone from /api/config and from disk, while an unrelated
 *   provider keeps its key.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

const configDir = process.env.FCM_CONFIG_DIR
if (!configDir) {
  console.error('FCM_CONFIG_DIR is required')
  process.exit(2)
}
const configPath = join(configDir, 'config.json')

writeFileSync(configPath, JSON.stringify({
  apiKeys: { groq: 'gsk-web-fixture', nvidia: 'nvapi-web-fixture' },
  providers: { groq: { enabled: true }, nvidia: { enabled: true } },
  favorites: ['groq/llama-3.3-70b-versatile'],
}, null, 2))

// 📖 Ask the OS for a free port, then hand it to the dashboard.
const probe = createServer()
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise((resolve) => probe.close(resolve))

const { startWebServer } = await import('../../web/server.js')
const server = await startWebServer(port, { open: false, startPingLoop: false })
const baseUrl = `http://127.0.0.1:${port}`

const before = await (await fetch(`${baseUrl}/api/config`)).json()
const response = await fetch(`${baseUrl}/api/settings`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ apiKeys: { groq: '' } }),
})
const body = await response.json()
const after = await (await fetch(`${baseUrl}/api/config`)).json()
const disk = JSON.parse(readFileSync(configPath, 'utf8'))

console.log(JSON.stringify({
  status: response.status,
  body,
  beforeGroqHasKey: before.providers.groq.hasKey,
  afterGroqHasKey: after.providers.groq.hasKey,
  afterNvidiaHasKey: after.providers.nvidia.hasKey,
  diskApiKeys: { ...(disk.apiKeys || {}) },
  diskFavorites: disk.favorites,
}))

await new Promise((resolve) => server.close(resolve))
process.exit(0)
