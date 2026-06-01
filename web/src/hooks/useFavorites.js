/**
 * @file web/src/hooks/useFavorites.js
 * @description Favorites management hook for the Web Dashboard — M1 parity with TUI `F` / `Y` / `Shift+↑↓`.
 * 📖 Persists through the existing ~/.free-coding-models.json config file (same source as the TUI),
 * 📖 via the /api/favorites endpoint. Both surfaces share the same favorites list.
 *
 * 📖 Storage shape (mirrors src/core/favorites.js):
 * 📖   config.favorites              — string[] of "providerKey/modelId", insertion-ordered
 * 📖   config.settings.favoritesPinnedAndSticky — boolean (TUI `Y` key behavior)
 *
 * 📖 Returns a stable shape the rest of the Web UI can consume:
 * 📖   {
 * 📖     favorites: string[],                — current favorites in priority order
 * 📖     pinnedAndSticky: boolean,           — true = favorites bypass filters
 * 📖     isFavorite(model): boolean,         — predicate
 * 📖     favoriteRank(model): number,        — 0-based index, Number.MAX_SAFE_INTEGER if not favorited
 * 📖     toggle(model): Promise<void>,       — add/remove
 * 📖     reorder(model, dir): Promise<void>, — 'up' or 'down'
 * 📖     setPinnedAndSticky(bool): Promise<void>,
 * 📖     refresh(): Promise<void>,           — manual reload from server
 * 📖     loading: boolean,                   — initial load
 * 📖   }
 *
 * @functions
 *   → useFavorites({ models }) — hook
 *
 * @see src/core/favorites.js — TUI engine (same storage format)
 * @see web/server.js — /api/favorites endpoint
 */
import { useCallback, useEffect, useState, useMemo } from 'react'

const EMPTY_FAVORITES = Object.freeze([])

export function useFavorites({ models } = {}) {
  const [favorites, setFavorites] = useState(EMPTY_FAVORITES)
  const [pinnedAndSticky, setPinnedAndStickyState] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 📖 Initial load: fetch the current favorites + pinnedAndSticky from the server.
  const refresh = useCallback(async () => {
    try {
      const resp = await fetch('/api/favorites')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setFavorites(Array.isArray(data.favorites) ? data.favorites : [])
      setPinnedAndStickyState(Boolean(data.pinnedAndSticky))
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load favorites')
      // 📖 On error, fall back to empty state — the UI stays usable.
      setFavorites(EMPTY_FAVORITES)
      setPinnedAndStickyState(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // 📖 Build a map "providerKey/modelId" → index for O(1) lookup.
  const favoriteIndex = useMemo(() => {
    const map = new Map()
    favorites.forEach((key, idx) => map.set(key, idx))
    return map
  }, [favorites])

  const isFavorite = useCallback((model) => {
    if (!model) return false
    const key = `${model.providerKey}/${model.modelId}`
    return favoriteIndex.has(key)
  }, [favoriteIndex])

  const favoriteRank = useCallback((model) => {
    if (!model) return Number.MAX_SAFE_INTEGER
    const key = `${model.providerKey}/${model.modelId}`
    const idx = favoriteIndex.get(key)
    return idx === undefined ? Number.MAX_SAFE_INTEGER : idx
  }, [favoriteIndex])

  // 📖 Build a key for the API — same shape the TUI uses (providerKey/modelId).
  const keyOf = useCallback((model) => {
    if (!model) return null
    return `${model.providerKey}/${model.modelId}`
  }, [])

  // 📖 Send the updated favorites list to the server.
  const persistFavorites = useCallback(async (next) => {
    try {
      const resp = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites: next }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setFavorites(next)
    } catch (err) {
      setError(err.message || 'Failed to save favorites')
    }
  }, [])

  const toggle = useCallback(async (model) => {
    const key = keyOf(model)
    if (!key) return
    const exists = favoriteIndex.has(key)
    const next = exists
      ? favorites.filter((k) => k !== key)
      : [...favorites, key]
    await persistFavorites(next)
  }, [favorites, favoriteIndex, keyOf, persistFavorites])

  const reorder = useCallback(async (model, direction) => {
    const key = keyOf(model)
    if (!key) return
    const idx = favorites.indexOf(key)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= favorites.length) return
    const next = [...favorites]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    await persistFavorites(next)
  }, [favorites, keyOf, persistFavorites])

  const setPinnedAndSticky = useCallback(async (value) => {
    setPinnedAndStickyState(Boolean(value))
    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedAndSticky: Boolean(value) }),
      })
    } catch (err) {
      setError(err.message || 'Failed to save display mode')
    }
  }, [])

  // 📖 Return a stable object — callers can destructure safely across renders.
  return {
    favorites,
    pinnedAndSticky,
    isFavorite,
    favoriteRank,
    toggle,
    reorder,
    setPinnedAndSticky,
    refresh,
    loading,
    error,
  }
}
