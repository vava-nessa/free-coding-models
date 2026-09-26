/**
 * @file web/src/hooks/useToolMode.js
 * @description M3 tool-mode hook for the Web Dashboard. It cycles endpoint install
 * targets by loading and persisting `settings.preferredToolMode` through
 * `/api/tool-mode`, while keeping URL hydration safe from late API responses.
 *
 * @functions
 *   → useToolMode — loads, sets, and cycles the active endpoint target
 * @exports useToolMode
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { INSTALL_ENDPOINT_TOOL_MODES } from '../utils/m3.js'

const DEFAULT_TOOL_MODE = 'opencode'

function normalizeToolMode(mode) {
  return INSTALL_ENDPOINT_TOOL_MODES.includes(mode) ? mode : DEFAULT_TOOL_MODE
}

export function useToolMode({ onToast } = {}) {
  const [toolModeState, setToolModeState] = useState(DEFAULT_TOOL_MODE)
  const userSetRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function loadToolMode() {
      try {
        const resp = await fetch('/api/tool-mode')
        const payload = await resp.json().catch(() => ({}))
        if (!cancelled && !userSetRef.current && resp.ok) {
          setToolModeState(normalizeToolMode(payload.mode))
        }
      } catch (err) {
        if (!cancelled) onToast?.(`Tool mode load failed: ${err.message}`, 'error')
      }
    }
    void loadToolMode()
    return () => { cancelled = true }
  }, [onToast])

  const persistToolMode = useCallback(async (mode) => {
    const normalized = normalizeToolMode(mode)
    userSetRef.current = true
    setToolModeState(normalized)
    try {
      const resp = await fetch('/api/tool-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: normalized }),
      })
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        // 📖 Error bodies vary by server: the daemon's 404 catch-all nests the
        // message ({ error: { message } }), web/server.js sends a plain string.
        // Extract the innermost message so toasts never show "[object Object]".
        const rawError = payload?.error
        const message = (typeof rawError === 'string' && rawError) || rawError?.message || `HTTP ${resp.status}`
        throw new Error(message)
      }
      setToolModeState(normalizeToolMode(payload.mode))
      return { ok: true, mode: normalizeToolMode(payload.mode) }
    } catch (err) {
      onToast?.(`Tool mode save failed: ${err.message}`, 'error')
      return { ok: false, error: err.message, mode: normalized }
    }
  }, [onToast])

  const cycleToolMode = useCallback(() => {
    const currentIndex = INSTALL_ENDPOINT_TOOL_MODES.indexOf(toolModeState)
    const next = INSTALL_ENDPOINT_TOOL_MODES[(currentIndex + 1) % INSTALL_ENDPOINT_TOOL_MODES.length] || DEFAULT_TOOL_MODE
    return persistToolMode(next)
  }, [persistToolMode, toolModeState])

  const tools = useMemo(() => [...INSTALL_ENDPOINT_TOOL_MODES], [])

  return {
    toolMode: toolModeState,
    tools,
    setToolMode: persistToolMode,
    cycleToolMode,
  }
}
