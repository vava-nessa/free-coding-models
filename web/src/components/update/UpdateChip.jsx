/**
 * @file web/src/components/update/UpdateChip.jsx
 * @description Header update chip + popover — M2 parity with TUI's auto-update banner.
 * 📖 Sits in the right side of the header (next to AI Latency, theme, export).
 * 📖 Hidden when no update is available; shows "⬆ vX.Y.Z" when one is.
 * 📖 Click → popover with "Update now" + "What's new" (which opens the
 * 📖 Changelog modal pre-focused on the new version).
 *
 * @functions
 *   → UpdateChip — small badge with popover
 */
import { useState, useRef, useEffect } from 'react'
import { IconDownload, IconHistory, IconX, IconExternalLink } from '@tabler/icons-react'
import { useI18n } from '../../i18n.jsx'
import styles from './UpdateChip.module.css'

export default function UpdateChip({ updateAvailable, latestVersion, onRunUpdate, onOpenChangelog, checking }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // 📖 Close on outside click / Esc — same pattern as the header kebab menu.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // 📖 No chip when no update. The M1 plan keeps the chip honest — a fresh
  // 📖 install should look clean, not noisy.
  if (!updateAvailable) {
    if (checking) {
      return (
        <span className={styles.checking} title={t('update.checking')}>
          <span className={styles.dot} />
        </span>
      )
    }
    return null
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        className={styles.chip}
        onClick={() => setOpen((o) => !o)}
        title={t('update.availableTitle', { version: latestVersion })}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <IconDownload size={13} stroke={1.5} />
        <span>v{latestVersion}</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={t('update.available')}>
          <div className={styles.popoverHeader}>
            <div className={styles.popoverTitle}>
              <IconDownload size={14} stroke={1.5} />
              <span>{t('update.available')}</span>
            </div>
            <button
              className={styles.popoverClose}
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <IconX size={14} stroke={1.5} />
            </button>
          </div>
          <p className={styles.popoverBody}>
            {t('update.availableDescription', { version: latestVersion })}
          </p>
          <div className={styles.popoverActions}>
            <button
              className={styles.primaryAction}
              onClick={() => {
                setOpen(false)
                onRunUpdate?.()
              }}
            >
              <IconDownload size={13} stroke={1.5} />
              <span>{t('update.now')}</span>
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() => {
                setOpen(false)
                onOpenChangelog?.(latestVersion)
              }}
            >
              <IconHistory size={13} stroke={1.5} />
              <span>{t('update.whatsNew')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
