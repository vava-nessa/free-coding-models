import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const configDir = mkdtempSync(join(tmpdir(), 'free-coding-models-language-'))
process.env.FCM_CONFIG_DIR = configDir
writeFileSync(join(configDir, 'config.json'), JSON.stringify({
  apiKeys: { groq: 'gsk-existing' },
  settings: { theme: 'dark' },
}), 'utf8')
const { loadConfig, saveConfig } = await import('../src/core/config.js?language-test')

after(() => {
  delete process.env.FCM_CONFIG_DIR
  rmSync(configDir, { recursive: true, force: true })
})

describe('language config compatibility', () => {
  it('defaults old settings without language to English', () => {
    const config = loadConfig()
    assert.equal(config.settings.language, 'en')
    assert.equal(config.settings.theme, 'dark')
    assert.equal(config.apiKeys.groq, 'gsk-existing')
  })

  it('preserves zh-CN when saving and reloading config', () => {
    const config = loadConfig()
    config.settings.language = 'zh-CN'
    assert.equal(saveConfig(config).success, true)
    assert.equal(loadConfig().settings.language, 'zh-CN')
  })

  it('falls back to English for invalid language values', () => {
    const config = loadConfig()
    config.settings.language = 'fr'
    assert.equal(saveConfig(config).success, true)
    assert.equal(loadConfig().settings.language, 'en')
  })

  it('persists the explicit English choice', () => {
    const config = loadConfig()
    config.settings.language = 'en'
    assert.equal(saveConfig(config).success, true)
    assert.equal(loadConfig().settings.language, 'en')
  })
})
