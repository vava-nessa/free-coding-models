/**
 * @file web/src/components/dashboard/ProviderDropdown.jsx
 * @description Custom dropdown for provider filtering with inline SVG logos + health indicator.
 *
 * @details
 *   - Replaces the native `<select>` for providers with a custom dropdown that
 *     renders each provider as [SVG icon + wordmark + health dot + model count].
 *   - Uses the same `ProviderLogo` component as the model table so branding is
 *     visually consistent across the dashboard.
 *   - The health indicator dot shows:
 *     🟢 Green (glow) — provider has at least one model with status 'up' (key works).
 *     🟡 Yellow — provider has keys configured but no models are 'up' yet (pending).
 *     🔴 Red — provider has keys but models are down / auth errors.
 *     ⚪ Gray — provider has no API key configured at all.
 *   - Theme-aware: colors adapt for both dark and light modes via CSS variables.
 *   - Click-outside + Escape to close, keyboard-friendly, scrollable for long lists.
 *
 * @param {object} props
 * @param {Array}   props.providers     — Array of { key, name, count, hasKey, anyUp }
 * @param {string}  props.value         — Currently selected provider key ('all' for no filter).
 * @param {function} props.onChange      — Callback with new provider key.
 *
 * @functions
 *   → ProviderDropdown (default export)
 *
 * @see  web/src/components/dashboard/FilterBar.jsx (consumer)
 * @see  web/src/components/atoms/ProviderLogo.jsx (logo renderer)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import ProviderLogo from '../atoms/ProviderLogo.jsx'
import styles from './ProviderDropdown.module.css'

/**
 * 📖 Derives the health indicator state from aggregated provider data.
 * Returns one of: 'active' | 'pending' | 'down' | 'nokey'.
 */
function providerHealthState(provider) {
  if (!provider.hasKey) return 'nokey'
  if (provider.anyUp) return 'active'
  return 'down'
}

function HealthIndicator({ state }) {
  const cls = styles[`dot_${state}`] || styles.dot_nokey
  const titles = {
    active: 'API key works — at least one model is UP',
    pending: 'API key set — waiting for health data',
    down: 'API key set — models are DOWN or have auth errors',
    nokey: 'No API key configured',
  }
  return <span className={`${styles.healthDot} ${cls}`} title={titles[state] || ''} />
}

export default function ProviderDropdown({ providers, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const listRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  // 📖 Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close()
    }
    const handleKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, close])

  // 📖 Scroll selected item into view when dropdown opens.
  useEffect(() => {
    if (!open || !listRef.current) return
    const selected = listRef.current.querySelector(`[data-active="true"]`)
    if (selected) selected.scrollIntoView({ block: 'nearest' })
  }, [open])

  const selectedProvider = providers.find(p => p.key === value)
  const isFiltered = value !== 'all'

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        className={`${styles.trigger} ${isFiltered ? styles.triggerActive : ''} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={isFiltered ? `Provider: ${selectedProvider?.name || value}` : 'All providers'}
      >
        <span className={styles.triggerContent}>
          {isFiltered && selectedProvider ? (
            <>
              <span className={styles.triggerLogo}>
                <ProviderLogo providerKey={selectedProvider.key} origin={selectedProvider.name} />
              </span>
              <span className={styles.triggerCount}>{selectedProvider.count}</span>
            </>
          ) : (
            <span className={styles.triggerLabel}>All Providers</span>
          )}
        </span>
        <IconChevronDown
          size={12}
          stroke={2}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <div className={styles.menu} role="listbox" ref={listRef}>
          {/* ── "All Providers" option ── */}
          <button
            role="option"
            aria-selected={value === 'all'}
            data-active={value === 'all'}
            className={`${styles.option} ${value === 'all' ? styles.optionActive : ''}`}
            onClick={() => { onChange('all'); close() }}
          >
            <span className={styles.optionLabel}>All Providers</span>
            <span className={styles.optionCount}>{providers.reduce((s, p) => s + p.count, 0)}</span>
          </button>

          <div className={styles.separator} />

          {/* ── Per-provider options ── */}
          {providers.map((p) => {
            const healthState = providerHealthState(p)
            return (
              <button
                key={p.key}
                role="option"
                aria-selected={value === p.key}
                data-active={value === p.key}
                className={`${styles.option} ${value === p.key ? styles.optionActive : ''}`}
                onClick={() => { onChange(p.key); close() }}
                title={`${p.name} — ${p.count} model${p.count !== 1 ? 's' : ''}`}
              >
                <span className={styles.optionLogo}>
                  <ProviderLogo providerKey={p.key} origin={p.name} />
                </span>
                <HealthIndicator state={healthState} />
                <span className={styles.optionCount}>{p.count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
