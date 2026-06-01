/**
 * @file web/src/components/dashboard/FilterBar.jsx
 * @description Filter controls for the model table — TUI parity chips.
 * 📖 M1 parity: tier (T) / status / provider (D) / verdict (V) / health (H) / visibility (E)
 * 📖 + custom text filter chip with "X" clear + reset view button (N).
 * 📖 Each chip is a cycling button matching the TUI single-key behavior.
 * 📖 The "Next ping in Xs" countdown still shows the live status.
 */
import { useState, useEffect, useMemo } from 'react'
import { IconRefresh, IconX, IconFilter, IconCircleCheck, IconAlertTriangle, IconActivity, IconEye, IconStar } from '@tabler/icons-react'
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
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s === 1) return '1s'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m${rem > 0 ? rem + 's' : ''}`
}

function ChipRow({ items, value, onChange, label }) {
  return (
    <div className={styles.group}>
      {label && <label className={styles.filterLabel}>{label}</label>}
      <div className={styles.chipRow}>
        {items.map((item) => (
          <button
            key={item.key}
            className={`${styles.chip} ${value === item.key ? styles.chipActive : ''}`}
            onClick={() => onChange(item.key)}
            title={item.hint || item.label}
          >
            {item.label}
          </button>
        ))}
      </div>
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
}) {
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    if (nextPingAt == null) return
    const tick = () => {
      const rem = nextPingAt - Date.now()
      setCountdown(rem > 0 ? rem : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextPingAt])

  const countdownDisplay = countdown !== null ? formatCountdown(countdown) : null

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

      <ChipRow label="Tier" items={TIERS} value={filterTier} onChange={setFilterTier} />
      <ChipRow label="Status" items={STATUSES} value={filterStatus} onChange={setFilterStatus} />
      <ChipRow label="Verdict" items={VERDICTS} value={filterVerdict} onChange={setFilterVerdict} />
      <ChipRow label="Health" items={HEALTHS} value={filterHealth} onChange={setFilterHealth} />

      <div className={styles.group}>
        <label className={styles.filterLabel}>Visibility</label>
        <select
          className={styles.select}
          value={visibilityMode}
          onChange={(e) => setVisibilityMode(e.target.value)}
          title={VISIBILITY_MODES.find((v) => v.key === visibilityMode)?.hint}
        >
          {VISIBILITY_MODES.map((v) => (
            <option key={v.key} value={v.key}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.filterLabel}>Provider</label>
        <select
          className={styles.providerSelect}
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
        >
          <option value="all">All Providers</option>
          {providers.map((p) => (
            <option key={p.key} value={p.key}>{p.name} ({p.count})</option>
          ))}
        </select>
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

      {/* ── Ping interval selector ── */}
      <div className={styles.group}>
        <label className={styles.filterLabel}>Ping</label>
        <div className={styles.pingRow}>
          {PING_MODES.map((m) => (
            <button
              key={m.key}
              className={`${styles.pingBtn} ${pingMode === m.key ? styles.pingBtnActive : ''}`}
              style={pingMode === m.key ? { '--ping-active-color': m.color } : {}}
              onClick={() => setPingMode(m.key)}
              title={`${m.interval} interval`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

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
          {isPinging && <span className={styles.pingingDot} aria-hidden="true" />}
        </div>
      </div>
    </section>
  )
}
