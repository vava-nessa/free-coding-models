/**
 * @file web/src/components/tools/ToolPicker.jsx
 * @description Header/dropdown control for the active Web endpoint-install target.
 * Mirrors the TUI install target flow with a mouse-first dropdown and cycle button.
 *
 * @functions
 *   → ToolPicker — renders active tool, cycle control, and selectable tool list
 * @exports ToolPicker
 */
import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'
import { TOOL_METADATA, getToolMeta } from '../../../../src/core/tool-metadata.js'
import { INSTALL_ENDPOINT_TOOL_MODES } from '../../utils/m3.js'
import { useI18n } from '../../i18n.jsx'
import styles from './ToolPicker.module.css'

export default function ToolPicker({ toolMode = 'opencode', onSetToolMode, onCycleToolMode, compact = false, tools = INSTALL_ENDPOINT_TOOL_MODES }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const active = getToolMeta(toolMode)

  useEffect(() => {
    if (!open) return
    const onPointer = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('dashboard.installTargetTitle', { tool: active.label })}
      >
        <span className={styles.emoji}>{active.emoji}</span>
        <span className={styles.label}>{compact ? active.label.replace(/ CLI$/, '') : active.label}</span>
        <IconChevronDown size={13} stroke={1.7} />
      </button>
      <button
        type="button"
        className={styles.cycle}
        onClick={onCycleToolMode}
        title={t('dashboard.cycleEndpointTarget')}
        aria-label={t('dashboard.cycleEndpointTarget')}
      >
        <IconRefresh size={13} stroke={1.7} />
      </button>

      {open && (
        <div className={styles.menu} role="listbox" aria-label={t('dashboard.endpointInstallTarget')}>
          {tools.map((mode) => {
            const meta = TOOL_METADATA[mode]
            const activeMode = mode === toolMode
            return (
              <button
                type="button"
                key={mode}
                className={`${styles.item} ${activeMode ? styles.itemActive : ''}`}
                onClick={() => { onSetToolMode?.(mode); setOpen(false) }}
                role="option"
                aria-selected={activeMode}
              >
                <span className={styles.itemEmoji}>{meta.emoji}</span>
                <span className={styles.itemText}>
                  <strong>{meta.label}</strong>
                  <small>{meta.flag}</small>
                </span>
                {activeMode && <span className={styles.activeDot}>●</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
