/**
 * @file web/src/hooks/useColumnSizing.js
 * @description React hook for resizable table columns with localStorage persistence.
 *
 * 📖 Wires TanStack Table's `columnSizing` state to a localStorage entry so the user's
 * 📖 custom column widths survive page reloads and Dashboard/Desktop restarts.
 *
 * 📖 Storage strategy:
 * 📖   - Key: `fcm.columnSizing.v1`
 * 📖   - Value: JSON object { [columnId]: number } with the user's chosen widths in px
 * 📖   - Read once on mount, written on every sizing change (debounced via React batching)
 *
 * 📖 Why a versioned key:
 * 📖   - Future column additions or remodels can invalidate by bumping the suffix.
 * 📖   - Old saved widths won't silently apply to a table whose columns have changed.
 *
 * 📖 Why not Zustand/Redux:
 * 📖   - localStorage is the simplest possible cross-tab/cross-session persistence layer.
 * 📖   - The data is 200 bytes max — no need for IndexedDB or a migration story.
 * 📖   - SSR safety: every localStorage access is guarded with `typeof window !== 'undefined'`.
 *
 * @functions
 *   → useColumnSizing(defaultSizing) — returns { columnSizing, setColumnSizing, resetColumnSizing, hasCustomSizing }
 *   → sanitizeSizing / clampSizing / mergeSizing / hasCustomSizing — pure helpers (unit-tested)
 *   → readSizingFromStorage / writeSizingToStorage / removeSizingFromStorage — storage adapters
 * @exports useColumnSizing, sanitizeSizing, clampSizing, mergeSizing, hasCustomSizing,
 *          readSizingFromStorage, writeSizingToStorage, removeSizingFromStorage,
 *          COLUMN_SIZING_STORAGE_KEY, COLUMN_SIZING_MIN, COLUMN_SIZING_MAX
 */

import { useState, useCallback, useEffect, useRef } from 'react'

export const COLUMN_SIZING_STORAGE_KEY = 'fcm.columnSizing.v1'

// 📖 Bounds (px) for every column width. Mirrored in the model's CSS so the
// 📖 rendering layer never has to ask the hook about min/max.
export const COLUMN_SIZING_MIN = 24
export const COLUMN_SIZING_MAX = 1200

/**
 * 📖 sanitizeSizing: Validate + clean an arbitrary object into a { id: number } map.
 * 📖 Strips non-numbers, NaN, Infinity, zero, and negative widths.
 * 📖 Exported for unit testing and for any future code path that ingests raw input.
 */
export function sanitizeSizing(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  }
  return out
}

/**
 * 📖 clampSizing: Force every value into [min, max], rounded to an integer.
 * 📖 Drops entries whose value is not a finite number so a typo in storage
 * 📖 never crashes the dashboard.
 */
export function clampSizing(sizing, min = COLUMN_SIZING_MIN, max = COLUMN_SIZING_MAX) {
  const out = {}
  for (const [k, v] of Object.entries(sizing || {})) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    out[k] = Math.max(min, Math.min(max, Math.round(v)))
  }
  return out
}

/**
 * 📖 mergeSizing: Layer the stored widths on top of the defaults, with the
 * 📖 runtime (in-memory) state winning on conflicts. This three-way merge is
 * 📖 what keeps new columns (added in newer releases) from disappearing when
 * 📖 a stale localStorage entry is loaded.
 */
export function mergeSizing(defaults, stored, runtime) {
  return { ...(defaults || {}), ...(stored || {}), ...(runtime || {}) }
}

/**
 * 📖 hasCustomSizing: True when at least one column differs from its default.
 * 📖 Used by the UI to decide whether to show a "Reset" affordance.
 */
export function hasCustomSizing(current, defaults) {
  if (!current || !defaults) return false
  for (const k of Object.keys(current)) {
    if (current[k] !== defaults[k]) return true
  }
  return false
}

/**
 * 📖 readSizingFromStorage: Read JSON from a localStorage-like object, returns
 * 📖 a sanitized empty object on any failure. Exported separately from the
 * 📖 React hook so unit tests can drive it without a DOM.
 *
 * 📖 @param {Storage|null|undefined} storage  - the localStorage-like object
 * 📖 @param {string} key                        - the storage key
 * 📖 @param {Object} fallback                  - default if missing/empty
 */
export function readSizingFromStorage(storage, key, fallback = {}) {
  if (!storage || typeof storage.getItem !== 'function') return fallback
  let raw
  try { raw = storage.getItem(key) } catch { return fallback }
  if (!raw) return fallback
  let parsed
  try { parsed = JSON.parse(raw) } catch { return fallback }
  return sanitizeSizing(parsed)
}

/**
 * 📖 writeSizingToStorage: Persist a sizing object to a localStorage-like store.
 * 📖 Returns true on success, false on any failure (quota, private mode, etc.).
 */
export function writeSizingToStorage(storage, key, sizing) {
  if (!storage || typeof storage.setItem !== 'function') return false
  try {
    storage.setItem(key, JSON.stringify(sizing))
    return true
  } catch {
    return false
  }
}

/**
 * 📖 removeSizingFromStorage: Best-effort delete; used when the runtime sizing
 * 📖 returns to defaults so we don't keep stale entries around.
 */
export function removeSizingFromStorage(storage, key) {
  if (!storage || typeof storage.removeItem !== 'function') return false
  try { storage.removeItem(key); return true } catch { return false }
}

/**
 * 📖 useColumnSizing: TanStack-compatible state for the table's columnSizing slot.
 *
 * 📖 Pass the default sizing object (e.g. `{ mood: 28, idx: 36, ... }`) used to seed
 * 📖 new sessions; it also acts as the "reset to defaults" target.
 *
 * @param {Object} defaultSizing - { [columnId]: number } — defaults for the current column set
 * @returns {{
 *   columnSizing: Object,
 *   setColumnSizing: (updater: Object | ((prev: Object) => Object)) => void,
 *   resetColumnSizing: () => void,
 *   hasCustomSizing: boolean,
 * }}
 */
export function useColumnSizing(defaultSizing) {
  const defaultRef = useRef(defaultSizing)
  defaultRef.current = defaultSizing

  const [columnSizing, setColumnSizingState] = useState(() => {
    // 📖 SSR / unit-test safe: in Node, window is undefined and we fall back to defaults.
    if (typeof window === 'undefined') return { ...defaultSizing }
    const stored = readSizingFromStorage(window.localStorage, COLUMN_SIZING_STORAGE_KEY, {})
    // 📖 Merge: defaults first, then stored overrides. New columns added in a
    // 📖 future release still get their declared default width.
    return mergeSizing(defaultSizing, stored, {})
  })

  // 📖 Keep a ref to the latest sizing for the cross-tab sync listener.
  const sizingRef = useRef(columnSizing)
  sizingRef.current = columnSizing

  // 📖 Persist on every change. React batches updates, so this only fires once per real change.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return
    // 📖 When the runtime matches the defaults, drop the stored entry so a "reset"
    // 📖 is also persisted (no orphan entry, no waste of quota).
    if (!hasCustomSizing(columnSizing, defaultRef.current)) {
      removeSizingFromStorage(window.localStorage, COLUMN_SIZING_STORAGE_KEY)
      return
    }
    writeSizingToStorage(window.localStorage, COLUMN_SIZING_STORAGE_KEY, columnSizing)
  }, [columnSizing])

  // 📖 Cross-tab sync: if the user resizes columns in another tab/window, apply it live here.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return
    const onStorage = (e) => {
      if (e.key !== COLUMN_SIZING_STORAGE_KEY) return
      const next = readSizingFromStorage(window.localStorage, COLUMN_SIZING_STORAGE_KEY, {})
      // 📖 Merge incoming changes into the current default-sourced state so removed
      // 📖 columns in the incoming payload don't drop widths for columns we still show.
      setColumnSizingState((prev) => mergeSizing(defaultRef.current, next, prev))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setColumnSizing = useCallback((updater) => {
    setColumnSizingState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      // 📖 Clamp every value: TanStack can momentarily receive 0-width from a drag,
      // 📖 but rendering a 0-width column breaks layout.
      return { ...prev, ...clampSizing(next) }
    })
  }, [])

  const resetColumnSizing = useCallback(() => {
    setColumnSizingState({ ...defaultRef.current })
  }, [])

  // 📖 hasCustomSizing is memoized cheaply — one pass over the current keys is enough.
  const isCustom = hasCustomSizing(columnSizing, defaultRef.current)

  return {
    columnSizing,
    setColumnSizing,
    resetColumnSizing,
    hasCustomSizing: isCustom,
  }
}
