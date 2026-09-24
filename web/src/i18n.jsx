import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  normalizeLocale,
  setLocale as setCoreLocale,
  t,
} from '../../src/core/i18n/index.js'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE)

  useEffect(() => {
    let active = true
    fetch('/api/config')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active || !payload) return
        const configuredLocale = normalizeLocale(payload.settings?.language)
        setCoreLocale(configuredLocale)
        setLocaleState(configuredLocale)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const setLanguage = useCallback(async (nextLocale) => {
    const normalizedLocale = normalizeLocale(nextLocale)
    const previousLocale = locale
    setCoreLocale(normalizedLocale)
    setLocaleState(normalizedLocale)
    try {
      const response = await fetch('/api/settings/feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'language', value: normalizedLocale }),
      })
      if (!response.ok) throw new Error('Language preference could not be saved')
      return true
    } catch {
      setCoreLocale(previousLocale)
      setLocaleState(previousLocale)
      return false
    }
  }, [locale])

  const value = useMemo(() => ({ locale, locales: LOCALE_OPTIONS, setLanguage, t }), [locale, setLanguage])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context) return context
  return { locale: DEFAULT_LOCALE, locales: LOCALE_OPTIONS, setLanguage: async () => false, t }
}
