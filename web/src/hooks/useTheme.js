/**
 * @file web/src/hooks/useTheme.js
 * @description React hook for tri-state theme cycle (auto / dark / light) — M1 parity.
 * 📖 Mirrors the TUI's `G` key behavior:
 * 📖   auto  → system preference (resolved once at mount)
 * 📖   dark  → explicit dark
 * 📖   light → explicit light
 * 📖 Persists the choice on <html data-theme="auto|dark|light">. When set to
 * 📖 `auto`, the hook resolves the actual rendered theme and writes it back to
 * 📖 <html data-theme="..."> via resolveSystemTheme() (light/dark) so the
 * 📖 rest of the CSS keeps working without any "auto" branch in stylesheets.
 *
 * @functions
 *   → useTheme() — { theme, resolvedTheme, setTheme, cycle }
 */
import { useState, useCallback, useEffect } from 'react'

export const THEME_CYCLE = ['auto', 'dark', 'light']

// 📖 Read the OS-level dark/light preference. Falls back to dark on browsers
// 📖 that don't support matchMedia (very rare; SSR snapshots, etc.).
function resolveSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

function readInitialTheme() {
  if (typeof document === 'undefined') return 'auto'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'auto' || attr === 'dark' || attr === 'light') return attr
  return 'auto'
}

export function useTheme() {
  const [theme, setThemeState] = useState(readInitialTheme)
  const [systemTheme, setSystemTheme] = useState(resolveSystemTheme)

  // 📖 Listen for OS theme changes while the user is in "auto" mode.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light')
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    // 📖 Safari < 14 fallback
    if (typeof mq.addListener === 'function') {
      mq.addListener(handler)
      return () => mq.removeListener(handler)
    }
  }, [])

  // 📖 Apply the resolved theme to <html data-theme="..."> on every change.
  // 📖 We write the *resolved* value (light / dark) so existing CSS keeps working.
  useEffect(() => {
    const resolved = theme === 'auto' ? systemTheme : theme
    document.documentElement.setAttribute('data-theme', resolved)
    // 📖 Also stamp the user-chosen mode so other parts of the app can read it
    // 📖 (e.g. to render the right "auto" badge in the theme button).
    document.documentElement.setAttribute('data-theme-preference', theme)
  }, [theme, systemTheme])

  // 📖 Cycle through auto → dark → light → auto, matching the TUI's `G` key.
  const cycle = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_CYCLE.indexOf(prev)
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    })
  }, [])

  const setTheme = useCallback((next) => {
    if (THEME_CYCLE.includes(next)) setThemeState(next)
  }, [])

  const resolvedTheme = theme === 'auto' ? systemTheme : theme

  return { theme, resolvedTheme, setTheme, cycle }
}
