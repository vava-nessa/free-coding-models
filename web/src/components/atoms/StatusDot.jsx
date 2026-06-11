/**
 * @file web/src/components/atoms/StatusDot.jsx
 * @description Renders a colored status indicator dot (green=up, red=down, gray=pending).
 * 📖 When a model is not in the active router set and still pending, we show
 * 📖 a muted gray dot instead of the animated yellow — this makes it visually
 * 📖 clear that the model is *not being tested* rather than *still loading*.
 */
import styles from './StatusDot.module.css'

export default function StatusDot({ status, inRouterSet = true }) {
  const cls = status === 'up' ? styles.up : status === 'timeout' ? styles.timeout : status === 'down' ? styles.down : (status === 'pending' && !inRouterSet) ? styles.notInSet : styles.pending
  return <span className={`${styles.dot} ${cls}`} />
}
