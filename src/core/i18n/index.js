import en from './locales/en.js'
import zhCN from './locales/zh-CN.js'

export const DEFAULT_LOCALE = 'en'
export const SUPPORTED_LOCALES = Object.freeze(['en', 'zh-CN'])
export const LOCALE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'en', labelKey: 'common.language.english' }),
  Object.freeze({ value: 'zh-CN', labelKey: 'common.language.simplifiedChinese' }),
])

const dictionaries = Object.freeze({ en, 'zh-CN': zhCN })
let activeLocale = DEFAULT_LOCALE

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
}

export function getLocale() {
  return activeLocale
}

export function setLocale(locale) {
  activeLocale = normalizeLocale(locale)
  return activeLocale
}

export function createTranslator(resources = dictionaries) {
  return (locale, key, values = {}) => {
    if (typeof key !== 'string') return ''
    const active = normalizeLocale(locale)
    const localized = resources[active]?.[key]
    const fallback = resources[DEFAULT_LOCALE]?.[key]
    const template = typeof localized === 'string' ? localized : typeof fallback === 'string' ? fallback : key
    return template.replace(/\{([\w.]+)\}/g, (match, name) => {
      const value = values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined
      return value === null || value === undefined ? match : String(value)
    })
  }
}

const translate = createTranslator()

export function t(key, values = {}) {
  return translate(activeLocale, key, values)
}

export function hasTranslation(locale, key) {
  return typeof dictionaries[normalizeLocale(locale)]?.[key] === 'string'
}
