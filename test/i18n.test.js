import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator, getLocale, normalizeLocale, setLocale, t } from '../src/core/i18n/index.js'

describe('shared localization core', () => {
  it('returns English strings by default', () => {
    setLocale('en')
    assert.equal(getLocale(), 'en')
    assert.equal(t('settings.title'), 'Settings')
  })

  it('returns Simplified Chinese strings for zh-CN', () => {
    setLocale('zh-CN')
    assert.equal(t('settings.title'), '设置')
  })

  it('normalizes an unknown locale to English', () => {
    assert.equal(normalizeLocale('fr'), 'en')
    assert.equal(setLocale('fr'), 'en')
    assert.equal(t('settings.title'), 'Settings')
  })

  it('falls back to the English resource when a translation is missing', () => {
    const translate = createTranslator({ en: { 'test.fallback': 'English fallback' }, 'zh-CN': {} })
    assert.equal(translate('zh-CN', 'test.fallback'), 'English fallback')
  })

  it('returns the semantic key when no locale defines it', () => {
    setLocale('zh-CN')
    assert.equal(t('unknown.test.key'), 'unknown.test.key')
  })

  it('interpolates simple named values', () => {
    setLocale('zh-CN')
    assert.equal(t('router.brokenModels', { count: 3 }), '当前模型组中有 3 个模型没有响应')
  })
})
