/**
 * @file test/config-dir.test.js
 * @description Tests for the `--config-dir` / FCM_CONFIG_DIR override.
 *
 * Covers:
 *   - getConfigDir() resolves FCM_CONFIG_DIR (and null when unset)
 *   - CONFIG_PATH falls back to ~/.free-coding-models.json when unset
 *   - CONFIG_PATH lives at <dir>/config.json when FCM_CONFIG_DIR is set
 *   - parseArgs parses --config-dir without treating the value as an API key
 *   - saveConfig writes to <dir>/config.json + creates <dir>/backups/, and
 *     never touches $HOME (starts fresh — no migration)
 *   - loadConfig starts fresh (empty config) when the dir has no config.json
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseArgs } from '../src/core/utils.js'

// 📖 Cache-busting dynamic import: CONFIG_PATH / getConfigDir() read
// 📖 FCM_CONFIG_DIR at module load time, so each test needs a fresh module.
let _seq = 0
async function freshConfigModule() {
  _seq += 1
  return import(`../src/core/config.js?configdir=${_seq}`)
}

let originalConfigDir
let originalHome

beforeEach(() => {
  originalConfigDir = process.env.FCM_CONFIG_DIR
  originalHome = process.env.HOME
  delete process.env.FCM_CONFIG_DIR
})

afterEach(() => {
  if (originalConfigDir === undefined) delete process.env.FCM_CONFIG_DIR
  else process.env.FCM_CONFIG_DIR = originalConfigDir
  if (originalHome === undefined) delete process.env.HOME
  else process.env.HOME = originalHome
})

describe('--config-dir / FCM_CONFIG_DIR', () => {
  it('getConfigDir() returns null when FCM_CONFIG_DIR is unset', async () => {
    const { getConfigDir } = await freshConfigModule()
    assert.equal(getConfigDir(), null)
  })

  it('getConfigDir() returns the resolved dir when FCM_CONFIG_DIR is set', async () => {
    process.env.FCM_CONFIG_DIR = join(tmpdir(), 'fcm-rel-dir')
    const { getConfigDir } = await freshConfigModule()
    assert.ok(getConfigDir().endsWith('fcm-rel-dir'))
  })

  it('CONFIG_PATH falls back to ~/.free-coding-models.json when unset', async () => {
    const home = mkdtempSync(join(tmpdir(), 'fcm-home-'))
    try {
      process.env.HOME = home
      const { CONFIG_PATH } = await freshConfigModule()
      assert.equal(CONFIG_PATH, join(home, '.free-coding-models.json'))
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('CONFIG_PATH lives at <dir>/config.json when FCM_CONFIG_DIR is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-cfgdir-'))
    try {
      process.env.FCM_CONFIG_DIR = dir
      const { CONFIG_PATH } = await freshConfigModule()
      assert.equal(CONFIG_PATH, join(dir, 'config.json'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('CONFIG_PATH honors --config-dir in process.argv even when env is unset', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-argvdir-'))
    try {
      delete process.env.FCM_CONFIG_DIR
      process.argv = ['node', 'fcm', '--config-dir', dir]
      const { CONFIG_PATH } = await freshConfigModule()
      assert.equal(CONFIG_PATH, join(dir, 'config.json'))
    } finally {
      process.argv = ['node']
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('--config-dir in process.argv wins over FCM_CONFIG_DIR', async () => {
    const flagDir = mkdtempSync(join(tmpdir(), 'fcm-flagdir-'))
    const envDir = mkdtempSync(join(tmpdir(), 'fcm-envdir-'))
    try {
      process.env.FCM_CONFIG_DIR = envDir
      process.argv = ['node', 'fcm', '--config-dir', flagDir]
      const { CONFIG_PATH } = await freshConfigModule()
      assert.equal(CONFIG_PATH, join(flagDir, 'config.json'))
    } finally {
      process.argv = ['node']
      rmSync(flagDir, { recursive: true, force: true })
      rmSync(envDir, { recursive: true, force: true })
    }
  })

  it('parseArgs parses --config-dir without treating the value as an API key', () => {
    const args = parseArgs(['node', 'free-coding-models', '--config-dir', '/tmp/fcm-dir'])
    assert.equal(args.configDir, '/tmp/fcm-dir')
    assert.equal(args.apiKey, null)
  })

  it('saveConfig writes to <dir>/config.json + backups/ and never touches $HOME', async () => {
    const home = mkdtempSync(join(tmpdir(), 'fcm-home-'))
    const dir = mkdtempSync(join(tmpdir(), 'fcm-cfgdir-'))
    try {
      process.env.HOME = home
      process.env.FCM_CONFIG_DIR = dir
      const config = await freshConfigModule()

      const base = { apiKeys: { nvidia: 'nvapi-abc' }, providers: {}, settings: {}, favorites: [], telemetry: {}, endpointInstalls: [], hiddenModels: [] }
      assert.equal(config.saveConfig(base).success, true)
      // 📖 Second save triggers a backup of the now-existing config.json
      assert.equal(config.saveConfig(base).success, true)

      assert.equal(existsSync(join(dir, 'config.json')), true)
      const written = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
      assert.equal(written.apiKeys.nvidia, 'nvapi-abc')

      const backupsDir = join(dir, 'backups')
      assert.equal(existsSync(backupsDir), true)
      const backups = readdirSync(backupsDir).filter(f => f.startsWith('config.') && f.endsWith('.json'))
      assert.ok(backups.length >= 1, 'expected at least one backup snapshot')

      // 📖 Fresh start — nothing written to the default dotfile location
      assert.equal(existsSync(join(home, '.free-coding-models.json')), false)
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadConfig starts fresh (empty) when the config dir has no config.json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-cfgdir-'))
    try {
      process.env.FCM_CONFIG_DIR = dir
      const config = await freshConfigModule()
      const loaded = config.loadConfig()
      assert.deepEqual(loaded.apiKeys, {})
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})