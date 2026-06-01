/**
 * @file web/src/components/palette/CommandPalette.jsx
 * @description ⌘K / Ctrl+P command palette — M1 placeholder, M2 ships the full version.
 * 📖 M1 keeps the modal opening, the ⌘K wiring, and a small launcher that exposes
 * 📖 the most-used actions (cycle theme, reset view, navigate views, change ping mode).
 * 📖 M2 will replace this with the TUI-aligned palette that consumes
 * 📖 `src/tui/command-palette.js` via `getCommandPaletteSnapshot()` for full parity.
 *
 * @functions
 *   → CommandPalette — main modal component
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { IconSearch, IconCommand, IconBolt, IconArrowRight, IconArrowsExchange } from '@tabler/icons-react'
import styles from './CommandPalette.module.css'

const PING_MODE_CYCLE = ['speed', 'normal', 'slow', 'forced']

export default function CommandPalette({
  onClose, onNavigate, onCycleTheme, onResetView,
  onSetPingMode, onToast, onExport,
  currentView, theme, pingMode,
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // 📖 Static command list for M1 — these are the universal "no matter what view
  // 📖 I'm in, this is what I want" actions. M2 will replace this with the TUI
  // 📖 registry import.
  const commands = useMemo(() => {
    const items = [
      { id: 'view.dashboard',   label: 'Go to Dashboard',     icon: IconArrowRight, run: () => onNavigate('dashboard') },
      { id: 'view.settings',    label: 'Go to Settings',      icon: IconArrowRight, run: () => onNavigate('settings') },
      { id: 'view.analytics',   label: 'Go to Analytics',     icon: IconArrowRight, run: () => onNavigate('analytics') },
      { id: 'view.recommend',   label: 'Open Smart Recommend (coming in M3)', icon: IconArrowRight, disabled: true },
      { id: 'view.router',      label: 'Open Router Dashboard (coming in M4)', icon: IconArrowRight, disabled: true },
      { id: 'view.help',        label: 'Open Help (coming in M2)', icon: IconArrowRight, disabled: true },
      { id: 'view.changelog',   label: 'Open Changelog (coming in M2)', icon: IconArrowRight, disabled: true },
      { id: 'action.cycle-theme', label: `Cycle theme (current: ${theme})`, icon: IconArrowsExchange, run: onCycleTheme },
      { id: 'action.reset-view',  label: 'Reset view (filters + sort)', icon: IconArrowsExchange, run: onResetView },
      { id: 'action.ping.speed',  label: 'Ping mode → Speed (2s)',  icon: IconBolt, run: () => onSetPingMode('speed') },
      { id: 'action.ping.normal', label: 'Ping mode → Normal (10s)', icon: IconBolt, run: () => onSetPingMode('normal') },
      { id: 'action.ping.slow',   label: 'Ping mode → Slow (30s)',   icon: IconBolt, run: () => onSetPingMode('slow') },
      { id: 'action.ping.forced', label: 'Ping mode → Forced (4s)',  icon: IconBolt, run: () => onSetPingMode('forced') },
      { id: 'action.export',      label: 'Export models…', icon: IconArrowRight, run: onExport },
    ]
    return items
  }, [onNavigate, onCycleTheme, onResetView, onSetPingMode, onExport, theme])

  // 📖 Fuzzy filter: substring match (case-insensitive). Good enough for M1's small set.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((cmd) => cmd.label.toLowerCase().includes(q))
  }, [commands, query])

  // 📖 Focus the search input on open.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 📖 Keyboard handler — Esc, arrows, Enter.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(filtered.length - 1, c + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[cursor]
        if (item && !item.disabled) {
          item.run?.()
          onClose()
        } else if (item?.disabled) {
          onToast?.(`${item.label} is not available yet.`, 'info')
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filtered, cursor, onClose, onToast])

  // 📖 Reset cursor when query changes.
  useEffect(() => { setCursor(0) }, [query])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <IconSearch size={16} stroke={1.5} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <span className={styles.kbd}><IconCommand size={10} stroke={1.5} />K</span>
        </div>

        <ul className={styles.list} ref={listRef} role="listbox">
          {filtered.length === 0 && (
            <li className={styles.empty}>No matching command.</li>
          )}
          {filtered.map((cmd, idx) => {
            const Icon = cmd.icon
            return (
              <li
                key={cmd.id}
                className={`${styles.item} ${idx === cursor ? styles.itemActive : ''} ${cmd.disabled ? styles.itemDisabled : ''}`}
                onClick={() => {
                  if (cmd.disabled) { onToast?.(`${cmd.label} is not available yet.`, 'info'); return }
                  cmd.run?.()
                  onClose()
                }}
                onMouseEnter={() => setCursor(idx)}
                role="option"
                aria-selected={idx === cursor}
              >
                <Icon size={14} stroke={1.5} className={styles.itemIcon} />
                <span className={styles.itemLabel}>{cmd.label}</span>
                {idx === cursor && <span className={styles.itemEnter}>↵</span>}
              </li>
            )
          })}
        </ul>

        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
