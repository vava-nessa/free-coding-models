/**
 * @file test/cache-dir.test.js
 * @description Tests for the TUI ping cache location following --config-dir.
 *
 * Covers:
 *   - getCachePath() falls back to ~/.free-coding-models.cache.json when no
 *     config dir is set
 *   - getCachePath() lives at <dir>/cache.json when FCM_CONFIG_DIR is set
 *   - getCachePath() honors --config-dir in process.argv even when env is unset
 *   - saveCache() writes to <dir>/cache.json and never touches $HOME
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let _seq = 0
async function freshCacheModule() {
  _seq += 1
  return import(`../src/core/cache.js?cachedir=${_seq}`)
}

let originalConfigDir
let originalHome
let originalArgv

beforeEach(() => {
  originalConfigDir = process.env.FCM_CONFIG_DIR
  originalHome = process.env.HOME
  originalArgv = process.argv
  delete process.env.FCM_CONFIG_DIR
  process.argv = ['node']
})

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.FCM_CONFIG_DIR
  else process.env.FCM_CONFIG_DIR = originalConfigDir
  if (originalHome === undefined) delete process.env.HOME
  else process.env.HOME = originalHome
  process.argv = originalArgv
})

describe('--config-dir / FCM_CONFIG_DIR → cache location', () => {
  it('getCachePath() falls back to ~/.free-coding-models.cache.json', async () => {
    const home = mkdtempSync(join(tmpdir(), 'fcm-cache-home-'))
    try {
      process.env.HOME = home
      const { getCachePath } = await freshCacheModule()
      assert.equal(getCachePath(), join(home, '.free-coding-models.cache.json'))
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('getCachePath() lives at <dir>/cache.json when FCM_CONFIG_DIR is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-cache-dir-'))
    try {
      process.env.FCM_CONFIG_DIR = dir
      const { getCachePath } = await freshCacheModule()
      assert.equal(getCachePath(), join(dir, 'cache.json'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('getCachePath() honors --config-dir in process.argv', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-cache-argv-'))
    try {
      process.argv = ['node', 'fcm', '--config-dir', dir]
      const { getCachePath } = await freshCacheModule()
      assert.equal(getCachePath(), join(dir, 'cache.json'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('saveCache() writes to <dir>/cache.json and never touches $HOME', async () => {
    const home = mkdtempSync(join(tmpdir(), 'fcm-cache-home-'))
    const dir = mkdtempSync(join(tmpdir(), 'fcm-cache-dir-'))
    try {
      process.env.HOME = home
      process.env.FCM_CONFIG_DIR = dir
      const cache = await freshCacheModule()

      const results = [
        { modelId: 'groq/llama-3.3-70b-versatile', avg: 120, p95: 150, jitter: 10, stability: 95, uptime: 99.5, verdict: 'Perfect', status: 'up', httpCode: '200', pings: [{ ms: 120, code: '200' }] }
      ]
      cache.saveCache(results, 'normal')

      const written = JSON.parse(readFileSync(join(dir, 'cache.json'), 'utf8'))
      assert.equal(written.models['groq/llama-3.3-70b-versatile'].avg, 120)
      assert.equal(existsSync(join(home, '.free-coding-models.cache.json')), false)
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
