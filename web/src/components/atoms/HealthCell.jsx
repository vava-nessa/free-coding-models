/**
 * @file web/src/components/atoms/HealthCell.jsx
 * @description Detailed health/status column — matches CLI Health column.
 * 📖 Shows the current provider status next to a Tabler icon that matches the
 * 📖 state. The icon is color-coded so a quick glance is enough to know if
 * 📖 the row is healthy, slow, down, blocked, etc.
 * 📖
 * 📖 Icon → state mapping:
 * 📖   ✅ up           → IconChecks         (green)
 * 📖   ⏳ timeout      → IconHourglassOff   (yellow)
 * 📖   ⏳ pending      → IconHourglass      (yellow)
 * 📖   🔐 AUTH FAIL    → IconLock           (red, bold)
 * 📖   🔑 NO KEY       → NoKeyIcon          (yellow key + red slash)
 * 📖   🔥 429          → IconFlame          (red)
 * 📖   🚫 404          → IconError404       (red)
 * 📖   💥 500          → IconAlertOctagon   (red)
 * 📖   🔌 502          → IconPlug           (red)
 * 📖   🔒 503          → IconCloudOff       (red)
 * 📖   ⏰ 504          → IconClock          (red)
 * 📖   ❌ unknown      → IconBan            (red)
 */
import {
  IconChecks,
  IconHourglass,
  IconHourglassOff,
  IconLock,
  IconFlame,
  IconError404,
  IconAlertOctagon,
  IconPlug,
  IconCloudOff,
  IconClock,
  IconBan,
} from '@tabler/icons-react'
import NoKeyIcon from './NoKeyIcon.jsx'
import styles from './HealthCell.module.css'

const ICON_SIZE = 12
const ICON_STROKE = 1.8

// 📖 Themed icon helper: same color palette as the rest of the Health cell text,
// 📖 so the icon + label always match. Reading the CSS var at render time keeps
// 📖 the dark/light palettes aligned with the rest of the dashboard.
const HEALTH_ICON_COLOR = {
  success: 'var(--color-success, #00ff88)',
  warning: 'var(--color-warning, #ffaa00)',
  danger:  'var(--color-danger,  #ff4444)',
  dim:     'var(--color-text-dim, #444)',
}

const ERROR_LABELS = {
  '404': '404 NOT FOUND',
  '410': '410 GONE',
  '429': '429 TRY LATER',
  '500': '500 ERROR',
  '502': '502 ERROR',
  '503': '503 ERROR',
  '504': '504 TIMEOUT',
}

// 📖 Per-HTTP-code icon + color picker. Anything not in this map falls back to
// 📖 the generic down-state rendering below.
const ERROR_ICON = {
  '429': { Icon: IconFlame,        color: HEALTH_ICON_COLOR.danger  },
  '404': { Icon: IconError404,     color: HEALTH_ICON_COLOR.danger  },
  '500': { Icon: IconAlertOctagon, color: HEALTH_ICON_COLOR.danger  },
  '502': { Icon: IconPlug,         color: HEALTH_ICON_COLOR.danger  },
  '503': { Icon: IconCloudOff,     color: HEALTH_ICON_COLOR.danger  },
  '504': { Icon: IconClock,        color: HEALTH_ICON_COLOR.danger  },
}

function statusLabel(status, httpCode) {
  if (status === 'noauth')  return 'NO KEY'
  if (status === 'auth_error') return 'AUTH FAIL'
  if (status === 'pending') return 'wait'
  if (status === 'timeout') return 'TIMEOUT'
  if (status === 'down') {
    return ERROR_LABELS[httpCode] || (httpCode || 'ERROR')
  }
  if (status === 'up') return 'UP'
  return '?'
}

function statusClass(status) {
  if (status === 'noauth')     return styles.noKey
  if (status === 'up')         return styles.up
  if (status === 'down')       return styles.error
  if (status === 'timeout')    return styles.warning
  if (status === 'auth_error') return styles.errorBold
  if (status === 'pending')    return styles.warning
  return styles.dim
}

export default function HealthCell({ status, httpCode }) {
  const text = statusLabel(status, httpCode)
  const cls = statusClass(status)
  const isNoKey = status === 'noauth'

  // 📖 Pick the right icon + color combo for this state.
  let Icon = null
  let iconColor = null
  if (status === 'up') {
    Icon = IconChecks
    iconColor = HEALTH_ICON_COLOR.success
  } else if (status === 'timeout') {
    Icon = IconHourglassOff
    iconColor = HEALTH_ICON_COLOR.warning
  } else if (status === 'pending') {
    Icon = IconHourglass
    iconColor = HEALTH_ICON_COLOR.warning
  } else if (status === 'auth_error') {
    Icon = IconLock
    iconColor = HEALTH_ICON_COLOR.danger
  } else if (status === 'down' && ERROR_ICON[httpCode]) {
    Icon = ERROR_ICON[httpCode].Icon
    iconColor = ERROR_ICON[httpCode].color
  } else if (status === 'down') {
    // 📖 Generic "down" fallback (no recognized HTTP code).
    Icon = IconBan
    iconColor = HEALTH_ICON_COLOR.danger
  }

  return (
    <span className={`${styles.cell} ${cls}`}>
      {isNoKey ? (
        <NoKeyIcon size={15} title="No API key configured for this provider" />
      ) : Icon ? (
        <Icon
          size={ICON_SIZE}
          stroke={ICON_STROKE}
          style={{ color: iconColor, flexShrink: 0 }}
          aria-hidden="true"
        />
      ) : null}
      <span className={isNoKey ? styles.noKeyText : undefined}>{text}</span>
    </span>
  )
}
