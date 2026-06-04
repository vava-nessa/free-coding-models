/**
 * @file web/src/components/dashboard/FilterBar.jsx
 * @description Filter controls for the model table — TUI parity chips.
 * 📖 M1 parity: tier (T) / status / provider (D) / verdict (V) / health (H) / visibility (E)
 * 📖 + custom text filter chip with "X" clear + reset view button (N).
 * 📖 Each chip is a cycling button matching the TUI single-key behavior.
 * 📖 The "Next ping in Xs" countdown still shows the live status.
 * 📖 Filter groups (Tier, Status, Verdict, Health) are collapsible by default
 *     — click the trigger to expand the chip row, click again or outside to close.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { IconRefresh, IconX, IconFilter, IconChevronDown } from '@tabler/icons-react'
import { getToolMeta } from '../../../../src/core/tool-metadata.js'
import ProviderDropdown from './ProviderDropdown.jsx'
import styles from './FilterBar.module.css'

// 📖 Chip sets match the TUI cycles 1:1 (see useFilter.js). Keep these in sync.
const TIERS = [
  { key: 'all', label: 'All' },
  { key: 'S+', label: 'S+' },
  { key: 'S', label: 'S' },
  { key: 'A+', label: 'A+' },
  { key: 'A', label: 'A' },
  { key: 'A-', label: 'A-' },
  { key: 'B+', label: 'B+' },
  { key: 'B', label: 'B' },
  { key: 'C', label: 'C' },
]
const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'up', label: 'Up' },
  { key: 'down', label: 'Down' },
  { key: 'pending', label: 'Pending' },
]
const VERDICTS = [
  { key: 'all', label: 'All' },
  { key: 'Perfect', label: 'Perfect' },
  { key: 'Normal', label: 'Normal' },
  { key: 'Spiky', label: 'Spiky' },
  { key: 'Slow', label: 'Slow' },
  { key: 'Overloaded', label: 'Overloaded' },
  { key: 'Down', label: 'Down' },
  { key: 'Unstable', label: 'Unstable' },
  { key: 'Pending', label: 'Pending' },
]
const HEALTHS = [
  { key: 'all', label: 'All' },
  { key: 'up', label: 'Up' },
  { key: 'timeout', label: 'Timeout' },
  { key: 'down', label: 'Down' },
  { key: 'pending', label: 'Pending' },
  { key: 'noauth', label: 'No key' },
  { key: 'auth_error', label: 'Auth err' },
]
// 📖 TUI's E key cycle. The Web mirrors the same 3-state machine.
const VISIBILITY_MODES = [
  { key: 'normal',     label: 'All models',       hint: 'Show everything' },
  { key: 'configured', label: 'Configured only',  hint: 'Hide models with no key or auth errors' },
  { key: 'usable',     label: 'Usable only',      hint: 'Only Health UP + good verdict' },
]

const PING_MODES = [
  { key: 'speed',  label: '⚡ Speed', interval: '2s',  color: '#00ff88' },
  { key: 'normal', label: '● Normal', interval: '10s', color: '#ffaa00' },
  { key: 'slow',   label: '🐢 Slow',  interval: '30s', color: '#ff6644' },
  { key: 'forced', label: '🔥 Forced', interval: '4s',  color: '#ff4466' },
]

function formatCountdown(ms) {
  if (ms == null) return null
  const totalSec = Math.max(0, ms / 1000)
  if (totalSec < 60) return `${totalSec.toFixed(2)}s`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${s.toFixed(2)}s`
}

/**
 * 📖 FilterGroup — collapsible chip selector. Shows label + active value as a compact
 *     trigger. Click to expand a dropdown with all options grouped as a segmented control.
 *     Click outside or pick a value to collapse. Designed to keep the filter bar minimal
 *     by default while exposing the full chip set on demand.
 */
function FilterGroup({ label, items, value, onChange, colorMap }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close()
    }
    const keyHandler = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open, close])

  const activeItem = items.find(i => i.key === value)
  const activeLabel = activeItem?.label ?? value ?? 'All'
  const isFiltered = value !== 'all'

  return (
    <div className={styles.filterGroup} ref={ref}>
      <button
        className={`${styles.filterTrigger} ${isFiltered ? styles.filterTriggerActive : ''} ${open ? styles.filterTriggerExpanded : ''}`}
        onClick={() => setOpen(!open)}
        title={`${label}: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={styles.filterTriggerLabel}>{label}</span>
        <span className={styles.filterTriggerSep}>:</span>
        <span className={styles.filterTriggerValue}>{activeLabel}</span>
        <IconChevronDown
          size={12}
          stroke={2}
          className={`${styles.filterTriggerChevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>
      {open && (
        <div className={styles.filterDropdown} role="listbox">
          <div className={styles.filterChipRow}>
            {items.map((item, i) => {
              const active = value === item.key
              const customColor = colorMap?.[item.key]
              return (
                <button
                  key={item.key}
                  role="option"
                  aria-selected={active}
                  className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                  style={active && customColor ? { '--chip-active-color': customColor } : {}}
                  onClick={() => { onChange(item.key); close() }}
                  title={item.hint || item.label}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FilterBar({
  filterTier, setFilterTier,
  filterStatus, setFilterStatus,
  filterProvider, setFilterProvider,
  filterVerdict, setFilterVerdict,
  filterHealth, setFilterHealth,
  visibilityMode, setVisibilityMode,
  customTextFilter, setCustomTextFilter,
  searchQuery,
  onResetView,
  providers,
  pingMode, setPingMode,
  nextPingAt,
  isPinging,
  globalBenchmarkRunning,
  globalBenchmarkTotal,
  globalBenchmarkCompleted,
  toolMode = 'opencode',
}) {
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    if (nextPingAt == null) return
    const tick = () => {
      const rem = nextPingAt - Date.now()
      setCountdown(rem > 0 ? rem : 0)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [nextPingAt])

  const countdownDisplay = countdown !== null ? formatCountdown(countdown) : null
  const activeTool = getToolMeta(toolMode)

  // 📖 Custom text filter chip — sticks to the right of the search bar, with
  // 📖 an "X" to clear (TUI's `X` key behavior).
  const customFilterActive = Boolean(customTextFilter && customTextFilter.trim().length > 0)

  const benchmarkPct = globalBenchmarkRunning && globalBenchmarkTotal > 0
    ? Math.round((globalBenchmarkCompleted / globalBenchmarkTotal) * 100)
    : 0

  // 📖 Count of active non-default filters to show on the Reset button.
  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filterTier !== 'all') n++
    if (filterStatus !== 'all') n++
    if (filterProvider !== 'all') n++
    if (filterVerdict !== 'all') n++
    if (filterHealth !== 'all') n++
    if (visibilityMode !== 'normal') n++
    if (customFilterActive) n++
    if (searchQuery && searchQuery.trim().length > 0) n++
    return n
  }, [filterTier, filterStatus, filterProvider, filterVerdict, filterHealth, visibilityMode, customFilterActive, searchQuery])

  return (
    <section className={styles.filters}>
      {/* ── Global benchmark progress bar (Ctrl+U) ── */}
      {globalBenchmarkRunning && (
        <div className={styles.benchmarkBar}>
          <div className={styles.benchmarkLabel}>
            <span className={styles.benchmarkSpinner} />
            <span>AI Speed Test</span>
            <span className={styles.benchmarkCount}>{globalBenchmarkCompleted}/{globalBenchmarkTotal}</span>
          </div>
          <div className={styles.benchmarkTrack}>
            <div className={styles.benchmarkFill} style={{ width: `${benchmarkPct}%` }} />
          </div>
          <span className={styles.benchmarkPct}>{benchmarkPct}%</span>
        </div>
      )}

      <FilterGroup label="Tier" items={TIERS} value={filterTier} onChange={setFilterTier} />
      <FilterGroup label="Status" items={STATUSES} value={filterStatus} onChange={setFilterStatus} />
      <FilterGroup label="Verdict" items={VERDICTS} value={filterVerdict} onChange={setFilterVerdict} />
      <FilterGroup label="Health" items={HEALTHS} value={filterHealth} onChange={setFilterHealth} />

      <div className={styles.group}>
        <label className={styles.filterLabel} htmlFor="visibility-select">Visibility</label>
        <select
          id="visibility-select"
          className={styles.select}
          value={visibilityMode}
          onChange={(e) => setVisibilityMode(e.target.value)}
          title={VISIBILITY_MODES.find((v) => v.key === visibilityMode)?.hint}
          aria-label="Visibility mode"
        >
          {VISIBILITY_MODES.map((v) => (
            <option key={v.key} value={v.key}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.filterLabel}>Provider</label>
        <ProviderDropdown
          providers={providers}
          value={filterProvider}
          onChange={setFilterProvider}
        />
      </div>

      <div className={styles.group}>
        <label className={styles.filterLabel}>Endpoint target</label>
        <div className={styles.toolStatus} title="Active endpoint install target from the Header picker">
          <span>{activeTool.emoji}</span>
          <strong>{activeTool.label}</strong>
        </div>
      </div>

      <div className={styles.spacer} />

      {/* ── Custom text filter chip (TUI's Ctrl+P "Apply text filter") ── */}
      {customFilterActive && (
        <div className={styles.group}>
          <label className={styles.filterLabel}>Text</label>
          <div className={styles.customFilterChip} title="Click X to clear (TUI: X key)">
            <span className={styles.customFilterIcon}><IconFilter size={12} stroke={1.5} /></span>
            <span className={styles.customFilterLabel}>{customTextFilter}</span>
            <button
              className={styles.customFilterClear}
              onClick={() => setCustomTextFilter(null)}
              title="Clear custom text filter (TUI: X)"
              aria-label="Clear custom text filter"
            >
              <IconX size={12} stroke={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Reset view (TUI: N) — only visible when filters are active ── */}
      {activeFilterCount > 0 && (
        <button
          className={styles.resetBtn}
          onClick={onResetView}
          title={`Reset ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'} (TUI: N)`}
        >
          <IconRefresh size={12} stroke={1.5} />
          <span>Reset</span>
          <span className={styles.resetBadge}>{activeFilterCount}</span>
        </button>
      )}

      {/* ── Ping interval selector (collapsible group) ── */}
      <FilterGroup
        label="Ping"
        items={PING_MODES}
        value={pingMode}
        onChange={setPingMode}
        colorMap={Object.fromEntries(PING_MODES.map(m => [m.key, m.color]))}
      />

      {/* ── Next ping countdown (TUI parity: always show the delay) ──
          📖 The TUI footer always renders `next : Xs` regardless of whether
          📖 a ping is in flight — users care about the delay until the next
          📖 cycle, not the "is pinging right now" boolean. We follow the same
          📖 model: a single countdown line, with a small pulsing dot when
          📖 `isPinging` is true so the LIVE state is still visible without
          📖 resorting to the "Pinging…" text. */}
      <div className={styles.group}>
        <div className={styles.nextPing} title="Next ping countdown">
          <span className={styles.nextPingLabel}>next ping in</span>
          <span className={styles.nextPingTime}>{countdownDisplay ?? '—'}</span>
        </div>
      </div>
    </section>
  )
}
