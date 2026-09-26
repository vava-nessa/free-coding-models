/**
 * @file web/src/components/atoms/VerdictBadge.jsx
 * @description Renders a verdict badge matching exactly the TUI format.
 * 📖 Shows emoji + text: 🟩 Perfect, 🟢 Normal, 🟡 Spiky, 🟠 Slow, 🔴 Very Slow, 🔥 Overloaded, 🟥 Unstable, ⚫ Not Active, ⏳ Pending.
 */
import styles from './VerdictBadge.module.css'
import { useI18n } from '../../i18n.jsx'

// ─── Emoji map matching TUI render-table.js verdictIcon ──────────────────────────
const VERDICT_WITH_EMOJI = {
  Perfect:     { emoji: '🟩', key: 'filters.verdict.perfect', cls: 'perfect' },
  Normal:      { emoji: '🟢', key: 'filters.verdict.normal', cls: 'normal' },
  Spiky:       { emoji: '🟡', key: 'filters.verdict.spiky', cls: 'spiky' },
  Slow:        { emoji: '🟠', key: 'filters.verdict.slow', cls: 'slow' },
  'Very Slow': { emoji: '🔴', key: 'filters.verdict.verySlow', cls: 'veryslow' },
  Overloaded:  { emoji: '🔥', key: 'filters.verdict.overloaded', cls: 'overloaded' },
  Unstable:    { emoji: '🟥', key: 'filters.verdict.unstable', cls: 'unstable' },
  'Not Active':{ emoji: '⚫', key: 'filters.verdict.notActive', cls: 'notactive' },
  Pending:     { emoji: '⏳', key: 'filters.verdict.pending', cls: 'pending' },
}

const DEFAULT_ENTRY = { emoji: '❔', key: 'filters.verdict.pending', cls: 'pending' }

export default function VerdictBadge({ verdict, httpCode }) {
  const { t } = useI18n()
  // Handle 429 rate limit from HTTP code (TUI shows 🔥 429 TRY LATER in Health column)
  // In Verdict column, TUI shows 'Overloaded' for 429 — keep same behavior
  const entry = verdict
    ? (VERDICT_WITH_EMOJI[verdict] || { emoji: '❔', label: verdict, cls: 'pending' })
    : DEFAULT_ENTRY

  return (
    <span className={`${styles.badge} ${styles[entry.cls]}`}>
      <span className={styles.emoji}>{entry.emoji}</span>
      <span className={styles.text}>{entry.key ? t(entry.key) : entry.label}</span>
    </span>
  )
}
