/**
 * @file web/src/components/router/RouterView.jsx
 * @description Router Dashboard modal — daemon status, start/stop, active set
 * manager (add / remove / drag-and-drop), probe mode, quick-setup card.
 * 📖 M5: full set-management UI replacing the M4 read-only "Model Health" section.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  IconRoute, IconPlayerPlay, IconPlayerStop, IconRefresh,
  IconCopy, IconCheck, IconChevronDown, IconChevronUp,
  IconActivity, IconServer, IconPlus, IconX, IconGripVertical,
  IconArrowRight, IconArrowUp, IconArrowDown, IconTrash, IconList, IconWand,
  IconSend, IconBolt,
} from '@tabler/icons-react'
import styles from './RouterView.module.css'
import PlaygroundChat from '../playground/PlaygroundChat.jsx'

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// 📖 Friendly labels for the circuit breaker states. The raw names
// 📖 (CLOSED/OPEN/HALF_OPEN/AUTH_ERROR) are jargon — translate them
// 📖 to words a normal developer can scan in <1 second.
const CIRCUIT_STATE_LABELS = {
  CLOSED:     { label: 'Healthy',    cls: 'circuitClosed' },
  OPEN:       { label: 'Down',       cls: 'circuitOpen' },
  HALF_OPEN:  { label: 'Recovering', cls: 'circuitHalfOpen' },
  AUTH_ERROR: { label: 'Auth error', cls: 'circuitAuth' },
  STALE:      { label: 'Deprecated', cls: 'circuitUnknown' },
  UNSUPPORTED:{ label: 'Unsupported',cls: 'circuitUnknown' },
  UNKNOWN:    { label: 'Unknown',    cls: 'circuitUnknown' },
}

function CircuitBadge({ state }) {
  const entry = CIRCUIT_STATE_LABELS[state] || CIRCUIT_STATE_LABELS.UNKNOWN
  return <span className={`${styles.circuitBadge} ${styles[entry.cls]}`}>{entry.label}</span>
}

const SAVE_STATUS_IDLE = { kind: 'idle' }
const SAVE_STATUS_SAVING = { kind: 'saving' }
const SAVE_STATUS_SAVED = { kind: 'saved' }
const SAVE_STATUS_ERROR = (message) => ({ kind: 'error', message })

export default function RouterView({ onClose, onToast, favorites }) {
  const [status, setStatus] = useState(null)
  const [stats, setStats] = useState(null)
  const [quickSetup, setQuickSetup] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [logExpanded, setLogExpanded] = useState(false)
  const [copied, setCopied] = useState(null)
  const [autoHealDismissed, setAutoHealDismissed] = useState(false)

  // 📖 Set management state — the active set, its model list (mutated
  // 📖 locally on every drag/remove/add), and the catalog of available
  // 📖 routeable models for the Add picker.
  const [setsData, setSetsData] = useState({ activeSet: null, sets: {} })
  const [catalog, setCatalog] = useState([]) // [{ key, provider, model, label, tier, ctx, hasKey }]
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerProvider, setPickerProvider] = useState('')
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS_IDLE)
  const saveTimerRef = useRef(null)
  const hasAutoExpandedLog = useRef(false)

  // 📖 Probe state — AI Latency benchmarks launched on the active set. Progress
  // 📖 comes from /stats.globalBenchmark (polled), results land on
  // 📖 /stats.models[].benchmark. `probePolling` speeds up polling while running
  // 📖 so the progress bar + per-model latencies update live.
  const [probePolling, setProbePolling] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/router/status')
      const data = await resp.json()
      setStatus(data)
      if (data?.ok) {
        const statsResp = await fetch('/api/router/stats')
        const statsData = await statsResp.json()
        if (statsData.ok) setStats(statsData)
      }
    } catch {}
  }, [])

  const fetchSets = useCallback(async () => {
    try {
      const resp = await fetch('/api/router/sets')
      const data = await resp.json()
      if (data && data.sets) setSetsData(data)
    } catch {}
  }, [])

  const fetchCatalog = useCallback(async () => {
    try {
      const resp = await fetch('/api/router/catalog')
      const data = await resp.json()
      if (Array.isArray(data?.models)) setCatalog(data.models)
    } catch {}
  }, [])

  useEffect(() => {
    void fetchStatus()
    void fetchSets()
    void fetchCatalog()
    void fetch('/api/router/quick-setup').then(r => r.json()).then(setQuickSetup).catch(() => {})
    const interval = setInterval(() => {
      void fetchStatus()
      void fetchSets()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchSets, fetchCatalog])

  // 📖 Fast-poll /stats while a probe is running so the progress bar and
  // 📖 per-model AI latencies stream in live (every 1.2s instead of 5s).
  // 📖 Stops the moment the daemon reports the global benchmark as done.
  useEffect(() => {
    if (!probePolling) return undefined
    const interval = setInterval(() => { void fetchStatus() }, 1200)
    return () => clearInterval(interval)
  }, [probePolling, fetchStatus])

  // 📖 Keep probePolling in sync with the daemon's real state: if it says the
  // 📖 global benchmark stopped, drop our fast-poll flag so we go back to 5s.
  useEffect(() => {
    if (probePolling && stats?.globalBenchmark && !stats.globalBenchmark.running) {
      setProbePolling(false)
    }
  }, [stats?.globalBenchmark, probePolling])

  // 📖 Cleanup the "saved" indicator so it fades back to idle after 1.5s.
  useEffect(() => {
    if (saveStatus.kind !== 'saved') return undefined
    saveTimerRef.current = setTimeout(() => setSaveStatus(SAVE_STATUS_IDLE), 1500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [saveStatus])

  const handleStart = async () => {
    setActionLoading(true)
    try {
      const resp = await fetch('/api/router/start', { method: 'POST' })
      const data = await resp.json()
      if (data.ok || data.alreadyRunning) {
        onToast?.('Router daemon started.', 'success')
        await fetchStatus()
        await fetchSets()
      } else {
        onToast?.(`Failed to start: ${data.error || data.message || 'unknown'}`, 'error')
      }
    } catch (err) {
      // 📖 Distinguish between "daemon not running" (fetch itself fails) and
      // 📖 other network errors so the user gets an actionable error message.
      const msg = err.name === 'TypeError' && err.message?.includes('fetch')
        ? 'Cannot reach daemon — it may not be installed or the port is blocked'
        : err.message
      onToast?.(`Start failed: ${msg}`, 'error')
    } finally { setActionLoading(false) }
  }

  const handleStop = async () => {
    setActionLoading(true)
    try {
      const resp = await fetch('/api/router/stop', { method: 'POST' })
      const data = await resp.json()
      if (data.ok) {
        onToast?.('Router daemon stopped.', 'success')
        setStatus({ ok: false, running: false })
        setStats(null)
      } else {
        onToast?.(`Failed to stop: ${data.error || 'unknown'}`, 'error')
      }
    } catch (err) {
      onToast?.(`Stop failed: ${err.message}`, 'error')
    } finally { setActionLoading(false) }
  }

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const handleSetProbeMode = async (mode) => {
    try {
      await fetch('/api/router/probe-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ probeMode: mode }),
      })
      onToast?.(`Probe mode set to ${mode}.`, 'info')
      await fetchStatus()
    } catch {}
  }

  // ── Set management helpers ────────────────────────────────────────────
  const activeSetName = setsData?.activeSet || status?.activeSet || 'fast-coding'
  const activeSet = setsData?.sets?.[activeSetName] || { models: [] }
  const models = Array.isArray(activeSet.models) ? activeSet.models : []

  const setActiveSet = async (name) => {
    try {
      await fetch(`/api/router/sets/${encodeURIComponent(name)}/activate`, { method: 'POST' })
      onToast?.(`Active set: ${name}`, 'info')
      await fetchSets()
      await fetchStatus()
    } catch (err) {
      onToast?.(`Failed to activate: ${err.message}`, 'error')
    }
  }

  // 📖 "Sync best" — re-run the probe pipeline against the user's actual
  // 📖 API keys and rebuild the set with only models that come back 2xx.
  // 📖 This is the one-click "default to working models" path for users
  // 📖 whose keys have changed since the last sync or who want a fresh
  // 📖 probe-driven ranking. The daemon shows probe progress to the UI
  // 📖 and returns the new model list.
  const handleSyncBest = async () => {
    if (!activeSetName) return
    setSaveStatus(SAVE_STATUS_SAVING)
    onToast?.('Probing models with your keys…', 'info')
    try {
      const resp = await fetch(`/api/router/sets/${encodeURIComponent(activeSetName)}/sync`, { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      const picked = data.selected?.length || 0
      const probed = data.probeCount || 0
      onToast?.(`Synced ${activeSetName}: ${picked} working model${picked === 1 ? '' : 's'} from ${probed} probes.`, 'success')
      await fetchSets()
      await fetchStatus()
      setSaveStatus(SAVE_STATUS_SAVED)
    } catch (err) {
      setSaveStatus(SAVE_STATUS_ERROR(err.message || String(err)))
      onToast?.(`Sync failed: ${err.message}`, 'error')
    }
  }

  // 📖 Replace active set models with favorites
  const handleUseFavorites = async () => {
    if (!activeSetName) return
    const favList = favorites?.favorites || []
    if (favList.length === 0) {
      onToast?.('You do not have any favorite models yet. Star some models first!', 'info')
      return
    }

    const nextModels = favList.map((key, idx) => {
      const parts = key.split('/')
      const provider = parts[0]
      const model = parts.slice(1).join('/')
      return { provider, model, priority: idx + 1 }
    })

    setSaveStatus(SAVE_STATUS_SAVING)
    try {
      const resp = await fetch(`/api/router/sets/${encodeURIComponent(activeSetName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: nextModels }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      if (data?.sets?.[activeSetName]) {
        setSetsData((prev) => ({ ...prev, sets: data.sets }))
      } else {
        await fetchSets()
      }
      setSaveStatus(SAVE_STATUS_SAVED)
      onToast?.(`Replaced active set with ${favList.length} favorite model${favList.length === 1 ? '' : 's'}.`, 'success')
      await fetchStatus()
    } catch (err) {
      setSaveStatus(SAVE_STATUS_ERROR(err.message || String(err)))
      onToast?.(`Failed to replace set: ${err.message}`, 'error')
    }
  }

  const persistReorder = useCallback(async (nextModels) => {
    if (!activeSetName) return
    setSaveStatus(SAVE_STATUS_SAVING)
    try {
      const order = nextModels.map((m) => `${m.provider}/${m.model}`)
      const resp = await fetch(`/api/router/sets/${encodeURIComponent(activeSetName)}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      if (data?.sets?.[activeSetName]) {
        setSetsData((prev) => ({ ...prev, sets: data.sets }))
      } else {
        await fetchSets()
      }
      setSaveStatus(SAVE_STATUS_SAVED)
    } catch (err) {
      setSaveStatus(SAVE_STATUS_ERROR(err.message || String(err)))
      onToast?.(`Reorder failed: ${err.message}`, 'error')
    }
  }, [activeSetName, fetchSets, onToast])

  const persistAdd = useCallback(async (provider, model) => {
    if (!activeSetName) return
    setSaveStatus(SAVE_STATUS_SAVING)
    try {
      const resp = await fetch(`/api/router/sets/${encodeURIComponent(activeSetName)}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      if (data?.sets?.[activeSetName]) {
        setSetsData((prev) => ({ ...prev, sets: data.sets }))
      } else {
        await fetchSets()
      }
      setSaveStatus(SAVE_STATUS_SAVED)
      onToast?.(`Added ${provider}/${model} to ${activeSetName}.`, 'success')
    } catch (err) {
      setSaveStatus(SAVE_STATUS_ERROR(err.message || String(err)))
      onToast?.(`Add failed: ${err.message}`, 'error')
    }
  }, [activeSetName, fetchSets, onToast])

  const persistRemove = useCallback(async (provider, model) => {
    if (!activeSetName) return
    setSaveStatus(SAVE_STATUS_SAVING)
    try {
      const resp = await fetch(`/api/router/sets/${encodeURIComponent(activeSetName)}/models`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      if (data?.sets?.[activeSetName]) {
        setSetsData((prev) => ({ ...prev, sets: data.sets }))
      } else {
        await fetchSets()
      }
      setSaveStatus(SAVE_STATUS_SAVED)
    } catch (err) {
      setSaveStatus(SAVE_STATUS_ERROR(err.message || String(err)))
      onToast?.(`Remove failed: ${err.message}`, 'error')
    }
  }, [activeSetName, fetchSets, onToast])

  // 📖 handleProbeAll — launch AI Latency benchmarks on every model in the
  // 📖 active set, inside the DAEMON. Progress + results stream back through
  // 📖 /stats (globalBenchmark + per-model benchmark), which the fast-poll
  // 📖 effect above picks up every 1.2s. Disabled while already running.
  const handleProbeAll = async () => {
    if (!activeSetName || probePolling) return
    if (localModels.length === 0) {
      onToast?.('Add models to the set first, then probe.', 'info')
      return
    }
    try {
      const probeModels = localModels.map((m) => ({ providerKey: m.provider, modelId: m.model }))
      const resp = await fetch('/api/router/probe-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: probeModels }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok || !resp.status || resp.status === 409) {
        throw new Error(data?.error || 'Probe already running')
      }
      setProbePolling(true)
      const total = data?.total ?? localModels.length
      onToast?.(`Probing ${total} model${total === 1 ? '' : 's'} for AI Latency…`, 'info')
      await fetchStatus()
    } catch (err) {
      onToast?.(`Probe failed: ${err.message}`, 'error')
      setProbePolling(false)
    }
  }

  // 📖 The "Test Router" mini playground is now rendered by the shared
  // 📖 <PlaygroundChat> component (model="fcm"), which streams the reply
  // 📖 through /api/playground/chat and shows the harmonized metadata row
  // 📖 (served model · ms · tok · t/s) under every reply. The router's
  // 📖 Primary pick is passed as `targetLabel` so the user sees which model
  // 📖 the priority-first router will try first under their user bubble.

  // ── Drag and drop state ───────────────────────────────────────────────
  // We keep a local copy of `models` so the drag UX is instant — the
  // server is updated only when the user actually drops the row.
  const [localModels, setLocalModels] = useState(models)
  useEffect(() => { setLocalModels(models) }, [models])
  const [draggingKey, setDraggingKey] = useState(null)
  const [dropPosition, setDropPosition] = useState(null) // { key, side: 'above' | 'below' } | null

  const handleMove = useCallback(async (idx, direction) => {
    const next = [...localModels]
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= next.length) return
    const [moved] = next.splice(idx, 1)
    next.splice(newIdx, 0, moved)
    setLocalModels(next)
    await persistReorder(next)
  }, [localModels, persistReorder])

  const handleRemove = useCallback(async (idx) => {
    const target = localModels[idx]
    if (!target) return
    // Optimistic update: drop the row immediately, send the DELETE after.
    const next = localModels.filter((_, i) => i !== idx)
    setLocalModels(next)
    await persistRemove(target.provider, target.model)
  }, [localModels, persistRemove])

  const handleDragStart = (e, idx) => {
    const target = localModels[idx]
    if (!target) return
    setDraggingKey(`${target.provider}/${target.model}`)
    // 📖 dataTransfer is required for Firefox to actually fire drag events.
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${target.provider}/${target.model}`)
  }

  const handleDragOver = (e, idx) => {
    if (draggingKey == null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const target = localModels[idx]
    if (!target) return
    const key = `${target.provider}/${target.model}`
    if (key === draggingKey) return
    const rect = e.currentTarget.getBoundingClientRect()
    const side = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
    setDropPosition({ key, side })
  }

  const handleDragLeave = (e) => {
    // 📖 Don't clear on every leave — only when we leave the list entirely.
    if (e.currentTarget.contains(e.relatedTarget)) return
  }

  const handleDrop = async (e, idx) => {
    e.preventDefault()
    if (draggingKey == null) return
    const dragIdx = localModels.findIndex((m) => `${m.provider}/${m.model}` === draggingKey)
    if (dragIdx < 0) {
      setDraggingKey(null)
      setDropPosition(null)
      return
    }
    const target = localModels[idx]
    if (!target) {
      setDraggingKey(null)
      setDropPosition(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const side = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'
    let insertAt = side === 'above' ? idx : idx + 1
    if (dragIdx < insertAt) insertAt -= 1
    if (insertAt === dragIdx) {
      setDraggingKey(null)
      setDropPosition(null)
      return
    }
    const next = [...localModels]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(insertAt, 0, moved)
    setLocalModels(next)
    setDraggingKey(null)
    setDropPosition(null)
    await persistReorder(next)
  }

  const handleDragEnd = () => {
    setDraggingKey(null)
    setDropPosition(null)
  }

  // ── Picker filter ────────────────────────────────────────────────────
  const providers = useMemo(() => {
    const set = new Set(catalog.map((m) => m.provider))
    return Array.from(set).sort()
  }, [catalog])

  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    return catalog.filter((m) => {
      if (pickerProvider && m.provider !== pickerProvider) return false
      if (!q) return true
      return (
        m.key.toLowerCase().includes(q)
        || (m.label || '').toLowerCase().includes(q)
        || m.provider.toLowerCase().includes(q)
      )
    }).slice(0, 200)
  }, [catalog, pickerSearch, pickerProvider])

  const modelKeyInSet = (provider, model) => localModels.some((m) => m.provider === provider && m.model === model)

  const running = status?.ok
  const circuitBreakers = stats?.circuitBreakers || {}
  const requestLog = stats?.requestLog || []

  // 📖 routingOrder — the exact attempt order the daemon will use for the next
  // 📖 request (priority-first among healthy models). routingOrder[0] is the
  // 📖 model that will serve the next chat. Used to mark the "next" row and
  // 📖 to label Primary vs Fallback semantics. Falls back to set order when the
  // 📖 daemon isn't running or hasn't reported yet (so stopped state still shows
  // 📖 a sensible priority chain). See issue #120.
  const routingOrder = stats?.routingOrder || []
  const nextToServeKey = routingOrder.length > 0 ? routingOrder[0].key : null

  // 📖 Benchmark results keyed by "provider/model" so each set row can show
  // 📖 its live AI Latency + TPS after a probe. Built from /stats.models.
  const benchmarkByKey = new Map()
  for (const m of (stats?.models || [])) {
    if (m && typeof m.key === 'string') benchmarkByKey.set(m.key, m)
  }
  const globalBenchmark = stats?.globalBenchmark || null
  const probeActive = Boolean(globalBenchmark?.running) || probePolling

  // 📖 Auto-expand the request log the first time requests appear.
  useEffect(() => {
    if (requestLog.length > 0 && !hasAutoExpandedLog.current) {
      hasAutoExpandedLog.current = true
      setLogExpanded(true)
    }
  }, [requestLog.length])

  // 📖 Computed quick-setup display values: actual when running, defaults when stopped.
  const qsBaseUrl = running && quickSetup?.baseUrl ? quickSetup.baseUrl : 'http://localhost:19280/v1'
  const qsModel = quickSetup?.model || 'fcm'
  const qsApiKey = 'fcm-local'
  const qsAllText = `Base URL: ${qsBaseUrl}\nModel: ${qsModel}\nAPI Key: ${qsApiKey}`

  const sets = setsData?.sets || {}
  const setNames = Object.keys(sets).sort()

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <IconRoute size={20} stroke={1.5} />
            Router Dashboard
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Auto-heal banner — shown when the daemon detected broken
              models in the active set on startup. The banner disappears
              once the user clicks "Sync best" or "Fix now" (which heals
              the set and reloads the page state). */}
          {running && status?.brokenModelCount > 0 && !autoHealDismissed && (
            <div className={styles.autoHealBanner}>
              <div className={styles.autoHealLeft}>
                <span className={styles.autoHealIcon}>⚠</span>
                <div>
                  <div className={styles.autoHealTitle}>
                    {status.brokenModelCount} model{status.brokenModelCount === 1 ? '' : 's'} in the active set are not responding
                  </div>
                  <div className={styles.autoHealHint}>
                    Auto-heal ran on startup but the replacement may also be broken.
                    Click <strong>Sync best</strong> below to re-probe with your current keys,
                    or click <strong>Fix now</strong> to manually replace the broken entries.
                  </div>
                </div>
              </div>
              <div className={styles.autoHealActions}>
                <button className={styles.smallBtn} onClick={handleSyncBest}>
                  <IconWand size={11} />
                  Fix now
                </button>
                <button className={styles.iconBtn} onClick={() => setAutoHealDismissed(true)} aria-label="Dismiss">
                  <IconX size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Quick Setup — ALWAYS visible, front and center */}
          <div className={`${styles.quickSetup} ${running ? styles.quickSetupHero : ''}`}>
            <h3 className={styles.sectionTitle}>
              <IconCopy size={14} />
              Quick Setup
              <button className={styles.copyAllBtn} onClick={() => handleCopy(qsAllText, 'all')}>
                {copied === 'all' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                {copied === 'all' ? 'Copied!' : 'Copy all'}
              </button>
            </h3>
            <div className={styles.quickRows}>
              <div className={styles.quickRow}>
                <span className={styles.quickLabel}>Base URL</span>
                <code className={styles.quickValue}>{qsBaseUrl}</code>
                <button className={styles.copyBtn} onClick={() => handleCopy(qsBaseUrl, 'url')}>
                  {copied === 'url' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                </button>
              </div>
              <div className={styles.quickRow}>
                <span className={styles.quickLabel}>Model</span>
                <code className={styles.quickValue}>{qsModel}</code>
                <button className={styles.copyBtn} onClick={() => handleCopy(qsModel, 'model')}>
                  {copied === 'model' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                </button>
              </div>
              <div className={styles.quickRow}>
                <span className={styles.quickLabel}>API Key</span>
                <code className={styles.quickValue}>{qsApiKey}</code>
                <button className={styles.copyBtn} onClick={() => handleCopy(qsApiKey, 'key')}>
                  {copied === 'key' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* Hero Card */}
          <div className={`${styles.heroCard} ${running ? styles.heroRunning : styles.heroStopped}`}>
            <div className={styles.heroLeft}>
              <div className={styles.heroStatus}>
                <span className={`${styles.statusDot} ${running ? styles.dotGreen : styles.dotGray}`} />
                <span className={styles.heroLabel}>{running ? 'Running' : 'Stopped'}</span>
              </div>
              {running && (
                <div className={styles.heroMeta}>
                  <span>Port {status.port}</span>
                  <span>·</span>
                  <span>Uptime {formatUptime(status.uptimeSeconds)}</span>
                  <span>·</span>
                  <span>{status.requestsRouted} requests</span>
                </div>
              )}
              {!running && (
                <div className={styles.heroMeta}>
                  Smart failover router — start to route requests to the healthiest model.
                </div>
              )}
            </div>
            <div className={styles.heroActions}>
              {!running ? (
                <button className={`${styles.startBtn} ${styles.startBtnBig}`} onClick={handleStart} disabled={actionLoading}>
                  <IconPlayerPlay size={16} />
                  {actionLoading ? 'Starting…' : 'Start Router'}
                </button>
              ) : (
                <button className={styles.stopBtn} onClick={handleStop} disabled={actionLoading}>
                  <IconPlayerStop size={14} />
                  {actionLoading ? 'Stopping…' : 'Stop'}
                </button>
              )}
              <button className={styles.refreshBtn} onClick={fetchStatus} title="Refresh">
                <IconRefresh size={14} />
              </button>
            </div>
          </div>

          {/* Active Set Manager */}
          {running && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <IconList size={14} />
                Active Set ({localModels.length} models)
              </h3>

              <div className={styles.setMeta}>
                <div className={styles.setActions}>
                  <span className={styles.setMetaName}>{activeSetName}</span>
                  {setNames.length > 1 && (
                    <select
                      className={styles.pickerSelect}
                      value={activeSetName}
                      onChange={(e) => setActiveSet(e.target.value)}
                      title="Switch the active set"
                    >
                      {setNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className={styles.setActions}>
                  <SaveBadge status={saveStatus} />
                  <button
                    className={styles.smallBtn}
                    onClick={handleSyncBest}
                    disabled={saveStatus.kind === 'saving'}
                    title="Probe your API keys and rebuild the set with only models that actually work"
                  >
                    <IconWand size={11} />
                    Sync best
                  </button>
                  {favorites && (
                    <button
                      className={styles.smallBtn}
                      onClick={handleUseFavorites}
                      disabled={saveStatus.kind === 'saving'}
                      title="Replace current router models with your favorite models"
                    >
                      <IconList size={11} />
                      Use favorites
                    </button>
                  )}
                  {/* 📖 Probe all — run AI Latency benchmarks on every model in the
                      set. Results stream into the rows below (AI Lat column). */}
                  <button
                    className={`${styles.smallBtn} ${probeActive ? styles.probeBtnActive : ''}`}
                    onClick={handleProbeAll}
                    disabled={probeActive || saveStatus.kind === 'saving' || localModels.length === 0}
                    title="Benchmark AI Latency + TPS on every model in this set"
                  >
                    <IconBolt size={11} />
                    {probeActive ? 'Probing…' : 'Probe all'}
                  </button>
                  <button
                    className={styles.primaryBtn}
                    onClick={() => setPickerOpen((v) => !v)}
                    disabled={saveStatus.kind === 'saving'}
                  >
                    {pickerOpen ? <IconX size={11} /> : <IconPlus size={11} />}
                    {pickerOpen ? 'Close' : 'Add model'}
                  </button>
                </div>
              </div>

              {/* 📖 Probe progress bar — shown while AI Latency benchmarks run
                  across the set. Reads /stats.globalBenchmark (fast-polled). */}
              {probeActive && globalBenchmark && (
                <div className={styles.probeProgress}>
                  <div className={styles.probeProgressLabel}>
                    <IconBolt size={11} />
                    AI Latency probe
                    <span className={styles.probeProgressCount}>
                      {globalBenchmark.completed} / {globalBenchmark.total || localModels.length}
                    </span>
                  </div>
                  <div className={styles.probeProgressBar}>
                    <div
                      className={styles.probeProgressFill}
                      style={{ width: `${Math.min(100, ((globalBenchmark.completed || 0) / Math.max(1, globalBenchmark.total || localModels.length)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {localModels.length === 0 ? (
                <div className={styles.setEmpty}>
                  <div className={styles.setEmptyTitle}>No models in the active set</div>
                  <div className={styles.setEmptyHint}>
                    Add models from the picker below, or click <strong>Sync best</strong> above to auto-pick working models.
                  </div>
                </div>
              ) : (
                <>
                  {/* 📖 Priority legend — explains the fallback chain so users
                      understand WHY the top model serves every request (issue #120).
                      Higher priority = tried first; the rest are failover targets. */}
                  <div className={styles.priorityLegend}>
                    <span className={styles.legendPrimary}><IconArrowRight size={11} /> Primary</span>
                    <span className={styles.legendSeparator}>tries first</span>
                    <span className={styles.legendFallback}>Fallback</span>
                    <span className={styles.legendSeparator}>on failure / rate-limit</span>
                    {running && nextToServeKey && (
                      <span className={styles.legendNext}>Next up: <code>{nextToServeKey}</code></span>
                    )}
                  </div>
                  <div className={styles.setList} onDragLeave={handleDragLeave}>
                  {localModels.map((m, idx) => {
                    const key = `${m.provider}/${m.model}`
                    const cb = circuitBreakers[key] || {}
                    // 📖 Per-model AI Latency from the latest probe. `bm` is the
                    // 📖 raw benchmark result; `bmLoading` is true while it runs.
                    const bmEntry = benchmarkByKey.get(key)
                    const bm = bmEntry?.benchmark || null
                    const bmLoading = Boolean(bmEntry?.isBenchmarking)
                    const isDragging = draggingKey === key
                    const dropAbove = dropPosition?.key === key && dropPosition.side === 'above'
                    const dropBelow = dropPosition?.key === key && dropPosition.side === 'below'
                    // 📖 Priority semantics for the UI: #1 is the Primary model the
                    // 📖 router tries first; everyone else is a Fallback. `isNext` is
                    // 📖 true for the exact model the daemon will serve next request —
                    // 📖 derived from /stats.routingOrder (priority-first, see #120).
                    const isPrimary = idx === 0
                    const isNext = running && nextToServeKey === key
                    return (
                      <div
                        key={key}
                        className={`${styles.setRow} ${isDragging ? styles.setRowDragging : ''} ${isNext ? styles.setRowNext : ''} ${dropAbove ? `${styles.setRowDropTarget} ${styles.setRowDropTargetAbove}` : ''} ${dropBelow ? `${styles.setRowDropTarget} ${styles.setRowDropTargetBelow}` : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        title={key}
                      >
                        <span className={styles.setDragHandle} aria-hidden>
                          <IconGripVertical size={14} />
                        </span>
                        <span
                          className={`${styles.setPriority} ${isPrimary ? styles.setPriorityPrimary : styles.setPriorityFallback}`}
                          title={isPrimary ? 'Primary model — tried first on every request' : `Fallback #${idx + 1} — used when higher-priority models fail or rate-limit`}
                        >
                          {isPrimary ? 'Primary' : `#${idx + 1}`}
                        </span>
                        <span className={styles.setKey}>{key}</span>
                        {m.tier && <span className={styles.setTier}>{m.tier}</span>}
                        <CircuitBadge state={cb.state || m.state} />
                        {/* 📖 AI Latency — populated by "Probe all". Shows a spinner
                            while benchmarking, the latency+TPS once done, or a dim
                            placeholder before the first probe. */}
                        <span className={styles.aiLatencyCell} title={bm ? `AI Latency: ${Math.round(bm.totalMs)}ms · TPS: ${(bm.tokensPerSecond ?? 0).toFixed(1)}` : 'Run Probe all to measure AI Latency'}>
                          {bmLoading
                            ? <span className={styles.aiLatencySpin}>···</span>
                            : bm?.ok
                              ? <><span className={styles.aiLatencyMs}>{Math.round(bm.totalMs)}ms</span>{bm.tokensPerSecond != null && bm.tokensPerSecond > 0 && <span className={styles.aiLatencyTps}>{bm.tokensPerSecond.toFixed(1)} t/s</span>}</>
                              : bm && !bm.ok
                                ? <span className={styles.aiLatencyErr}>fail</span>
                                : <span className={styles.aiLatencyNone}>—</span>}
                        </span>
                        <div className={styles.setRowBtns}>
                          <button
                            className={styles.iconBtn}
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0 || saveStatus.kind === 'saving'}
                            title="Move up"
                            aria-label={`Move ${key} up`}
                          >
                            <IconArrowUp size={12} />
                          </button>
                          <button
                            className={styles.iconBtn}
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === localModels.length - 1 || saveStatus.kind === 'saving'}
                            title="Move down"
                            aria-label={`Move ${key} down`}
                          >
                            <IconArrowDown size={12} />
                          </button>
                          <button
                            className={`${styles.iconBtn} ${styles.removeBtn}`}
                            onClick={() => handleRemove(idx)}
                            disabled={saveStatus.kind === 'saving'}
                            title="Remove from set"
                            aria-label={`Remove ${key}`}
                          >
                            <IconTrash size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                </>
              )}

              {pickerOpen && (
                <div className={styles.pickerPanel}>
                  <div className={styles.pickerHeader}>
                    <span>Add a model to <code>{activeSetName}</code></span>
                    <span style={{ color: 'var(--text-muted, #888)' }}>
                      {filteredCatalog.length} of {catalog.length}
                    </span>
                  </div>
                  <div className={styles.pickerSearch}>
                    <input
                      className={styles.pickerInput}
                      placeholder="Search by provider, model, or label…"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      autoFocus
                    />
                    <select
                      className={styles.pickerSelect}
                      value={pickerProvider}
                      onChange={(e) => setPickerProvider(e.target.value)}
                    >
                      <option value="">All providers</option>
                      {providers.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.pickerList}>
                    {filteredCatalog.length === 0 ? (
                      <div className={styles.pickerEmpty}>No models match your filter.</div>
                    ) : (
                      filteredCatalog.map((entry) => {
                        const inSet = modelKeyInSet(entry.provider, entry.model)
                        return (
                          <div
                            key={entry.key}
                            className={`${styles.pickerItem} ${inSet ? styles.pickerItemAdded : ''}`}
                            onClick={() => { if (!inSet) void persistAdd(entry.provider, entry.model) }}
                            title={inSet ? 'Already in set' : `Add ${entry.key}`}
                          >
                            <span className={styles.pickerProvider}>{entry.provider}</span>
                            <span className={styles.pickerModel}>{entry.label || entry.model}</span>
                            {entry.tier && <span className={styles.setTier}>{entry.tier}</span>}
                            {entry.hasKey
                              ? <span className={`${styles.pickerBadge} ${styles.pickerBadgeOk}`}>key</span>
                              : <span className={styles.pickerBadge}>no key</span>}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Probe Mode */}
          {running && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <IconActivity size={14} />
                Probe Mode
              </h3>
              <div className={styles.probeModes}>
                {['eco', 'balanced', 'aggressive'].map((mode) => (
                  <button
                    key={mode}
                    className={`${styles.probeBtn} ${status?.probeMode === mode ? styles.probeActive : ''}`}
                    onClick={() => handleSetProbeMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Request Log — always visible when running */}
          {running && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle} onClick={() => setLogExpanded(!logExpanded)} style={{ cursor: 'pointer' }}>
                <IconActivity size={14} />
                Request Log ({requestLog.length})
                {logExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
              </h3>
              {logExpanded && (
                requestLog.length === 0 ? (
                  <div className={styles.logEmpty}>No requests yet. Start coding to see traffic here.</div>
                ) : (
                  <div className={styles.logList}>
                    {requestLog.map((entry, i) => (
                      <div key={i} className={styles.logRow}>
                        <span className={entry.error ? styles.logErr : styles.logOk}>
                          {entry.status || '—'}
                        </span>
                        <span className={styles.logModel}>{entry.model}</span>
                        <span className={styles.logLatency}>
                          {entry.latency_ms != null ? `${entry.latency_ms}ms` : '—'}
                        </span>
                        <span className={styles.logTokens}>
                          {entry.tokens > 0 ? formatNumber(entry.tokens) + ' tok' : ''}
                        </span>
                        {entry.failover && <span className={styles.logFailover}>failover</span>}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* 📖 Test Router — the shared PlaygroundChat core, routed through
              `fcm` so the user can sanity-check the priority-first router right
              from this view. The router's Primary pick is passed as targetLabel
              so it appears under the user bubble; the served model (+ ms / tok /
              t/s) appears under the reply and reveals any failover. Only shown
              when running (needs the daemon). */}
          {running && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <IconSend size={14} />
                Test Router
                <span className={styles.miniPgHint}>routes through <code>fcm</code> — try the fallback chain</span>
              </h3>
              <PlaygroundChat
                model="fcm"
                variant="mini"
                disabled={!running}
                targetLabel={nextToServeKey || 'fcm'}
                placeholder="Test the router… (e.g. write a haiku about TypeScript)"
                emptyHint="Send a message to see which model the router picks, with latency + TPS."
              />
            </div>
          )}

          {/* Server health (small chip at the bottom for visibility) */}
          <div className={styles.section} style={{ marginBottom: 0, marginTop: 16 }}>
            <span className={styles.saveStatus}>
              {stats?.tokenStats ? `${formatNumber(stats.tokenStats.all_time?.total_tokens || 0)} tokens routed lifetime` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SaveBadge({ status }) {
  if (!status || status.kind === 'idle') return null
  if (status.kind === 'saving') {
    return <span className={styles.saveStatus}>saving…</span>
  }
  if (status.kind === 'saved') {
    return <span className={`${styles.saveStatus} ${styles.saveStatusOk}`}>✓ saved</span>
  }
  if (status.kind === 'error') {
    return <span className={`${styles.saveStatus} ${styles.saveStatusErr}`} title={status.message}>
      ⚠ {status.message?.slice(0, 40) || 'error'}
    </span>
  }
  return null
}
