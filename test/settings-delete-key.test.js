/**
 * @file test/settings-delete-key.test.js
 * @description Regression tests for GH #208 - "Cannot delete an existing API key
 * in Settings". The dashboard's `Delete key` button posts
 * `{ apiKeys: { <provider>: '' } }` to `POST /api/settings`; the daemon used to
 * save that through a plain `saveConfig()`, whose disk merge restored the key
 * that had just been deleted. The provider stayed authenticated and the masked
 * key stayed on screen.
 *
 * @details
 *   📖 Two layers are covered:
 *   1. The config module helper (`persistApiKeysForProvider`) that every surface
 *      now uses for single-provider key writes: delete sticks, unrelated keys
 *      survive, env vars keep precedence.
 *   2. The router-daemon HTTP handler (the docker/dashboard surface on :19280),
 *      end to end through a child process with an isolated FCM_CONFIG_DIR so the
 *      developer's real ~/.free-coding-models.json is never written.
 *
 * @functions
 *   → persistApiKeysForProvider — deletes one provider key without resurrecting it
 *   → POST /api/settings (router daemon) — deletes keys, keeps other providers, honors env
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DAEMON_FIXTURE = join(__dirname, 'fixtures', 'daemon-settings-delete-key.mjs')
const WEB_FIXTURE = join(__dirname, 'fixtures', 'web-settings-delete-key.mjs')

/** 📖 Run a child fixture against an isolated config dir and parse its JSON report. */
async function runFixture(fixture, dir) {
  const { stdout } = await execFileAsync(process.execPath, [fixture], {
    env: { ...process.env, FCM_CONFIG_DIR: dir },
    cwd: ROOT,
    timeout: 60_000,
  })
  const reportLine = stdout.trim().split('\n').filter(Boolean).pop()
  return JSON.parse(reportLine)
}

/**
 * 📖 Load a fresh copy of src/core/config.js bound to `dir`.
 *
 * 📖 CONFIG_PATH is computed once at module load from FCM_CONFIG_DIR (or
 * 📖 --config-dir), so re-importing with a cache-busting query string is the only
 * 📖 way to point the module at a temp directory without touching the real file.
 * 📖 Same pattern as test/config-dir.test.js.
 */
async function withIsolatedConfigModule(dir, fn) {
  const previous = process.env.FCM_CONFIG_DIR
  process.env.FCM_CONFIG_DIR = dir
  try {
    const url = `${pathToFileURL(join(ROOT, 'src/core/config.js')).href}?isolated=${Date.now()}-${Math.random().toString(16).slice(2)}`
    const module = await import(url)
    mkdirSync(dir, { recursive: true })
    return await fn(module, join(dir, 'config.json'))
  } finally {
    if (previous === undefined) delete process.env.FCM_CONFIG_DIR
    else process.env.FCM_CONFIG_DIR = previous
  }
}

describe('GH #208 - Delete key persistence', () => {
  let tempDirs = []

  const makeTempDir = (prefix) => {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs = []
  })

  it('persistApiKeysForProvider removes one provider key from disk and memory', async () => {
    const dir = makeTempDir('fcm-208-config-')
    await withIsolatedConfigModule(dir, async (configModule, configPath) => {
      writeFileSync(configPath, JSON.stringify({
        apiKeys: { groq: 'gsk-to-delete', nvidia: 'nvapi-keep-me' },
        favorites: ['groq/llama-3.3-70b-versatile'],
      }, null, 2))

      const config = configModule.loadConfig()
      assert.equal(config.apiKeys.groq, 'gsk-to-delete')

      // 📖 Exactly what the dashboard does: the key is gone from the in-memory
      // 📖 config before the provider-scoped write.
      delete config.apiKeys.groq
      const result = configModule.persistApiKeysForProvider(config, 'groq')
      assert.equal(result.success, true, result.error)

      const disk = JSON.parse(readFileSync(configPath, 'utf8'))
      assert.equal(Object.hasOwn(disk.apiKeys, 'groq'), false, 'deleted key must not come back on disk')
      assert.equal(disk.apiKeys.nvidia, 'nvapi-keep-me', 'unrelated keys must survive')
      assert.deepEqual(disk.favorites, ['groq/llama-3.3-70b-versatile'], 'favorites must survive')

      assert.equal(Object.hasOwn(config.apiKeys, 'groq'), false, 'live config must drop the key')
      assert.equal(config.apiKeys.nvidia, 'nvapi-keep-me')
    })
  })

  it('persistApiKeysForProvider still writes a new key for a single provider', async () => {
    const dir = makeTempDir('fcm-208-config-set-')
    await withIsolatedConfigModule(dir, async (configModule, configPath) => {
      writeFileSync(configPath, JSON.stringify({ apiKeys: { nvidia: 'nvapi-keep-me' } }, null, 2))

      const config = configModule.loadConfig()
      config.apiKeys.groq = '  gsk-fresh-value  '
      const result = configModule.persistApiKeysForProvider(config, 'groq')
      assert.equal(result.success, true, result.error)

      const disk = JSON.parse(readFileSync(configPath, 'utf8'))
      assert.equal(disk.apiKeys.groq, 'gsk-fresh-value', 'keys are trimmed before hitting disk')
      assert.equal(disk.apiKeys.nvidia, 'nvapi-keep-me')
    })
  })

  it('POST /api/settings deletes the key on the router daemon dashboard surface', async () => {
    const dir = makeTempDir('fcm-208-daemon-')
    const report = await runFixture(DAEMON_FIXTURE, dir)

    const stored = report.deleteStoredKey
    assert.equal(stored.status, 200, 'same-origin dashboard write must succeed')
    assert.equal(stored.body.success, true)
    assert.equal(stored.beforeGroqHasKey, true, 'fixture must start with a stored groq key')

    assert.equal(stored.afterGroqHasKey, false, 'deleted key must disappear from /api/config')
    assert.equal(Object.hasOwn(stored.diskApiKeys, 'groq'), false, 'deleted key must disappear from disk')
    assert.equal(Object.hasOwn(stored.memoryApiKeys, 'groq'), false, 'deleted key must disappear from the live config')

    assert.equal(stored.afterNvidiaHasKey, true, 'unrelated provider keys must survive')
    assert.equal(stored.diskApiKeys.nvidia, 'nvapi-fixture-stored')
    assert.equal(stored.diskNvidiaEnabled, false, 'a provider toggle sent with the delete must persist')
    assert.equal(stored.afterNvidiaEnabled, false)
    assert.deepEqual(stored.diskFavorites, ['groq/llama-3.3-70b-versatile'])

    const env = report.envPrecedence
    assert.equal(env.status, 200)
    assert.equal(Object.hasOwn(env.diskApiKeys, 'groq'), false, 'stored key still leaves the file')
    assert.equal(env.afterGroqHasKey, true, 'env var keeps the provider authenticated')
    assert.match(env.afterGroqMaskedKey || '', /^••••••••/, 'masked key is still served, raw key never is')
  })

  it('POST /api/settings deletes the key on the dev/npm web dashboard surface', async () => {
    const dir = makeTempDir('fcm-208-web-')
    const report = await runFixture(WEB_FIXTURE, dir)

    assert.equal(report.status, 200, 'dashboard write must succeed')
    assert.equal(report.body.success, true)
    assert.equal(report.beforeGroqHasKey, true, 'fixture must start with a stored groq key')
    assert.equal(report.afterGroqHasKey, false, 'deleted key must disappear from /api/config')
    assert.equal(Object.hasOwn(report.diskApiKeys, 'groq'), false, 'deleted key must disappear from disk')
    assert.equal(report.diskApiKeys.nvidia, 'nvapi-web-fixture', 'unrelated provider keys must survive')
    assert.equal(report.afterNvidiaHasKey, true)
    assert.deepEqual(report.diskFavorites, ['groq/llama-3.3-70b-versatile'])
  })
})
