/**
 * @file test/fixtures/daemon-settings-delete-key.mjs
 * @description Child-process fixture for GH #208: exercises `POST /api/settings`
 * on the real router-daemon HTTP surface with a throwaway FCM_CONFIG_DIR.
 *
 * @details
 *   📖 Run by `test/settings-delete-key.test.js`, never by a human.
 *   📖 It must live in its own process because `CONFIG_PATH` in
 *   📖 src/core/config.js is resolved once at module load from FCM_CONFIG_DIR.
 *   📖 The parent test sets FCM_CONFIG_DIR to a temp directory, so the real
 *   📖 ~/.free-coding-models.json of whoever runs the suite is never touched.
 *
 *   📖 Scenarios (both against the docker/dashboard surface on :19280):
 *   1. Stored key delete: POST { apiKeys: { groq: '' } } plus a provider toggle.
 *      The groq key must disappear from disk and from the live config, the
 *      unrelated nvidia key must survive, and the toggle must stick. This is the
 *      regression: a plain saveConfig() used to merge the deleted key back from
 *      the disk snapshot.
 *   2. Env precedence: with GROQ_API_KEY exported, deleting the stored key must
 *      clear the file but leave the provider authenticated through the env var.
 *
 *   📖 Prints one JSON line on stdout; the parent asserts on it.
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const configDir = process.env.FCM_CONFIG_DIR
if (!configDir) {
  console.error('FCM_CONFIG_DIR is required')
  process.exit(2)
}
const configPath = join(configDir, 'config.json')

const { createRouterRuntimeForTest } = await import('../../src/core/router-daemon.js')
const { loadConfig } = await import('../../src/core/config.js')

const STORED_GROQ = 'gsk-fixture-stored'
const STORED_NVIDIA = 'nvapi-fixture-stored'

function writeFixtureConfig() {
  writeFileSync(configPath, JSON.stringify({
    apiKeys: { groq: STORED_GROQ, nvidia: STORED_NVIDIA },
    providers: { groq: { enabled: true }, nvidia: { enabled: true } },
    favorites: ['groq/llama-3.3-70b-versatile'],
  }, null, 2))
}

function readDiskConfig() {
  return JSON.parse(readFileSync(configPath, 'utf8'))
}

async function withServer(fn) {
  const runtime = createRouterRuntimeForTest({ config: loadConfig(), persistConfig: true })
  const server = createServer((req, res) => void runtime.handleHttp(req, res))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  runtime.port = server.address().port
  runtime.server = server
  const baseUrl = `http://127.0.0.1:${runtime.port}`
  const answer = (path, init) => fetch(`${baseUrl}${path}`, init)
  try {
    return await fn({ runtime, answer })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const report = {}

// ─── Scenario 1: delete a stored key, keep unrelated keys + provider toggle ──
delete process.env.GROQ_API_KEY
writeFixtureConfig()
report.deleteStoredKey = await withServer(async ({ runtime, answer }) => {
  const before = await (await answer('/api/config')).json()
  const response = await answer('/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKeys: { groq: '' },
      providers: { nvidia: { enabled: false } },
    }),
  })
  const after = await (await answer('/api/config')).json()
  const disk = readDiskConfig()
  return {
    status: response.status,
    body: await response.json(),
    beforeGroqHasKey: before.providers.groq.hasKey,
    afterGroqHasKey: after.providers.groq.hasKey,
    afterNvidiaHasKey: after.providers.nvidia.hasKey,
    afterNvidiaEnabled: after.providers.nvidia.enabled,
    memoryApiKeys: { ...(runtime.config.apiKeys || {}) },
    diskApiKeys: { ...(disk.apiKeys || {}) },
    diskNvidiaEnabled: disk.providers?.nvidia?.enabled,
    diskFavorites: disk.favorites,
  }
})

// ─── Scenario 2: env-var precedence survives a stored-key delete ────────────
writeFixtureConfig()
process.env.GROQ_API_KEY = 'gsk-fixture-from-env'
report.envPrecedence = await withServer(async ({ answer }) => {
  const response = await answer('/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKeys: { groq: '' } }),
  })
  const after = await (await answer('/api/config')).json()
  const disk = readDiskConfig()
  return {
    status: response.status,
    afterGroqHasKey: after.providers.groq.hasKey,
    afterGroqMaskedKey: after.providers.groq.maskedKey,
    diskApiKeys: { ...(disk.apiKeys || {}) },
  }
})
delete process.env.GROQ_API_KEY

rmSync(configPath, { force: true })
console.log(JSON.stringify(report))
process.exit(0)
