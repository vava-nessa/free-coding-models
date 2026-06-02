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
  IconArrowUp, IconArrowDown, IconTrash, IconList, IconWand,
} from '@tabler/icons-react'
import styles from './RouterView.module.css'

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

function CircuitBadge({ state }) {
  const cls = state === 'CLOSED' ? styles.circuitClosed
    : state === 'OPEN' ? styles.circuitOpen
    : state === 'HALF_OPEN' ? styles.circuitHalfOpen
    : state === 'AUTH_ERROR' ? styles.circuitAuth
    : styles.circuitUnknown
  return <span className={`${styles.circuitBadge} ${cls}`}>{state?.replace('_', ' ') || '?'}</span>
}

const SAVE_STATUS_IDLE = { kind: 'idle' }
const SAVE_STATUS_SAVING = { kind: 'saving' }
const SAVE_STATUS_SAVED = { kind: 'saved' }
const SAVE_STATUS_ERROR = (message) => ({ kind: 'error', message })

export default function RouterView({ onClose, onToast }) {
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
        onToast?.(`Failed to start: ${data.error || 'unknown'}`, 'error')
      }
    } catch (err) {
      onToast?.(`Start failed: ${err.message}`, 'error')
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
                <button className={styles.startBtn} onClick={handleStart} disabled={actionLoading}>
                  <IconPlayerPlay size={14} />
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

          {/* Quick Setup */}
          {running && quickSetup && (
            <div className={styles.quickSetup}>
              <h3 className={styles.sectionTitle}>
                <IconCopy size={14} />
                Quick Setup
              </h3>
              <div className={styles.quickRows}>
                {quickSetup.baseUrl && (
                  <div className={styles.quickRow}>
                    <span className={styles.quickLabel}>Base URL</span>
                    <code className={styles.quickValue}>{quickSetup.baseUrl}</code>
                    <button className={styles.copyBtn} onClick={() => handleCopy(quickSetup.baseUrl, 'url')}>
                      {copied === 'url' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                    </button>
                  </div>
                )}
                <div className={styles.quickRow}>
                  <span className={styles.quickLabel}>Model</span>
                  <code className={styles.quickValue}>{quickSetup.model}</code>
                  <button className={styles.copyBtn} onClick={() => handleCopy(quickSetup.model, 'model')}>
                    {copied === 'model' ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          )}

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

              {localModels.length === 0 ? (
                <div className={styles.setEmpty}>
                  The active set is empty. Add models with the button above to start routing.
                </div>
              ) : (
                <div className={styles.setList} onDragLeave={handleDragLeave}>
                  {localModels.map((m, idx) => {
                    const key = `${m.provider}/${m.model}`
                    const cb = circuitBreakers[key] || {}
                    const isDragging = draggingKey === key
                    const dropAbove = dropPosition?.key === key && dropPosition.side === 'above'
                    const dropBelow = dropPosition?.key === key && dropPosition.side === 'below'
                    return (
                      <div
                        key={key}
                        className={`${styles.setRow} ${isDragging ? styles.setRowDragging : ''} ${dropAbove ? `${styles.setRowDropTarget} ${styles.setRowDropTargetAbove}` : ''} ${dropBelow ? `${styles.setRowDropTarget} ${styles.setRowDropTargetBelow}` : ''}`}
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
                        <span className={styles.setPriority}>#{idx + 1}</span>
                        <span className={styles.setKey}>{key}</span>
                        {m.tier && <span className={styles.setTier}>{m.tier}</span>}
                        <CircuitBadge state={cb.state || m.state} />
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

          {/* Request Log */}
          {running && requestLog.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle} onClick={() => setLogExpanded(!logExpanded)} style={{ cursor: 'pointer' }}>
                <IconActivity size={14} />
                Request Log ({requestLog.length})
                {logExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
              </h3>
              {logExpanded && (
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
              )}
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
