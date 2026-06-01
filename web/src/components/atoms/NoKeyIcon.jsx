/**
 * @file web/src/components/atoms/NoKeyIcon.jsx
 * @description Compact "no API key" indicator — yellow key with a red diagonal strikethrough.
 *
 * 📖 Used in two places to surface the missing-key state without duplicating the
 * 📖 verbose "NO KEY" pill that used to live next to the model label:
 * 📖   1. Inline next to the model name in the Model cell (replaces the old orange pill)
 * 📖   2. Inside the Health cell, sitting next to the "NO KEY" text label
 *
 * 📖 The strikethrough is rendered as an inline SVG `<line>` on top of the Tabler
 * 📖 `IconKey`. Doing it in SVG (instead of CSS) keeps the line aligned with the
 * 📖 icon at any size and avoids the CSS overflow quirks that come with rotating
 * 📖 a pseudo-element inside a flex parent.
 *
 * 📖 `size` defaults to 14px which is the same as the Tabler icons used in Settings;
 * 📖 pass a smaller value (e.g. 11) for inline use next to model names where space is tight.
 *
 * @functions
 *   → NoKeyIcon — renders a yellow key with a red strikethrough
 * @exports NoKeyIcon
 */
import { IconKey } from '@tabler/icons-react'
import styles from './NoKeyIcon.module.css'

export default function NoKeyIcon({ size = 14, title = 'No API key configured' }) {
  // 📖 Stroke width follows the rest of the dashboard's icon style (1.5).
  // 📖 The key is yellow (warning palette); the slash is a bright red so it reads
  // 📖 as a "blocked" state at a glance even in peripheral vision.
  const strokeWidth = 1.5
  const slashPadding = Math.max(1, Math.round(size * 0.07))

  return (
    <span
      className={styles.wrapper}
      style={{ width: `${size}px`, height: `${size}px` }}
      role="img"
      aria-label={title}
      title={title}
    >
      <IconKey
        size={size}
        stroke={strokeWidth}
        className={styles.key}
      />
      <svg
        className={styles.slash}
        width={size + slashPadding * 2}
        height={size + slashPadding * 2}
        viewBox={`0 0 ${size + slashPadding * 2} ${size + slashPadding * 2}`}
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1={slashPadding + 1}
          y1={slashPadding + 1}
          x2={slashPadding + size - 1}
          y2={slashPadding + size - 1}
          stroke="var(--color-danger, #ff4444)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
