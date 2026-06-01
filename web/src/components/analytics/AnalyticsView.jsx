/**
 * @file web/src/components/analytics/AnalyticsView.jsx
 * @description Analytics dashboard page showing provider health, fastest models leaderboard, and tier distribution.
 * 📖 Purely derived from the `models` SSE data. No API calls needed beyond the live model feed.
 * @functions AnalyticsView → renders the three analytics cards
 */
import { useMemo } from 'react'
import { IconActivity, IconTrophy } from '@tabler/icons-react'
import TierBadge from '../atoms/TierBadge.jsx'
import styles from './AnalyticsView.module.css'

// 📖 TIER_COLORS is now derived from CSS custom properties so the chart fills
// 📖 swap to AA-contrast shades in light mode automatically. The keys stay
// 📖 the same; the values come from --tier-splus / --tier-s / etc.
function readTierColor(name, fallback) {
  if (typeof window === 'undefined' || !window.document?.documentElement) return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const TIER_COLOR_KEYS = {
  'S+': '--tier-splus',
  'S':  '--tier-s',
  'A+': '--tier-aplus',
  'A':  '--tier-a',
  'A-': '--tier-aminus',
  'B+': '--tier-bplus',
  'B':  '--tier-b',
  'C':  '--tier-c',
}

const TIER_COLOR_FALLBACKS = {
  'S+': '#ffd700', S: '#ff8c00', 'A+': '#00c8ff', A: '#3ddc84',
  'A-': '#7ecf7e', 'B+': '#a8a8c8', B: '#808098', C: '#606078',
}

// 📖 Resolve the tier color at render time. Memoizing the map per theme switch
// 📖 would be more efficient, but the cost is one getComputedStyle per tier and
// 📖 the chart only re-renders when `models` changes, so the extra work is
// 📖 imperceptible.
function tierColor(key) {
  return readTierColor(TIER_COLOR_KEYS[key], TIER_COLOR_FALLBACKS[key])
}
const TIERS = ['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']

export default function AnalyticsView({ models }) {
  const providerHealth = useMemo(() => {
    const map = {}
    models.forEach((m) => {
      if (!map[m.origin]) map[m.origin] = { total: 0, online: 0, key: m.providerKey }
      map[m.origin].total++
      if (m.status === 'up') map[m.origin].online++
    })
    return Object.entries(map).sort((a, b) => (b[1].online / b[1].total) - (a[1].online / a[1].total))
  }, [models])

  const leaderboard = useMemo(() => {
    const online = models.filter((m) => m.status === 'up' && m.avg !== Infinity && m.avg < 99000)
    return [...online].sort((a, b) => a.avg - b.avg).slice(0, 10)
  }, [models])

  const tierCounts = useMemo(() => {
    const counts = {}
    models.forEach((m) => { counts[m.tier] = (counts[m.tier] || 0) + 1 })
    const maxCount = Math.max(...Object.values(counts), 1)
    return TIERS.map((t) => ({ tier: t, count: counts[t] || 0, pct: ((counts[t] || 0) / maxCount) * 100 }))
  }, [models])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <IconActivity size={24} stroke={1.5} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Analytics
        </h1>
        <p className={styles.pageSubtitle}>Real-time insights across all providers and models</p>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardWide}`}>
          <h3 className={styles.cardTitle}>Provider Health Overview</h3>
          <div className={styles.cardBody}>
            {providerHealth.length === 0 ? (
              <div className={styles.empty}>Waiting for data...</div>
            ) : (
              providerHealth.map(([name, data]) => {
                const pct = data.total > 0 ? Math.round((data.online / data.total) * 100) : 0
                const pctCls = pct > 70 ? styles.pctFast : pct > 30 ? styles.pctMedium : styles.pctSlow
                return (
                  <div key={name} className={styles.healthItem}>
                    <span className={styles.healthName}>{name}</span>
                    <div className={styles.healthBar}>
                      <div className={styles.healthFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`${styles.healthPct} ${pctCls}`}>{pct}%</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconTrophy size={16} stroke={1.5} />
            Fastest Models
          </h3>
          <div className={styles.cardBody}>
            {leaderboard.length === 0 ? (
              <div className={styles.empty}>Waiting for ping data...</div>
            ) : (
              leaderboard.map((m, i) => {
                const rankCls = i < 3 ? styles[`rank${i + 1}`] : ''
                return (
                  <div key={m.modelId} className={styles.leaderItem}>
                    <div className={`${styles.leaderRank} ${rankCls}`}>{i + 1}</div>
                    <span className={styles.leaderName}>{m.label}</span>
                    <span className={styles.leaderLatency}>{m.avg}ms</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Tier Distribution</h3>
          <div className={styles.cardBody}>
            {tierCounts.map(({ tier, count, pct }) => (
              <div key={tier} className={styles.tierItem}>
                <div className={styles.tierBadge}><TierBadge tier={tier} /></div>
                <div className={styles.tierBar}>
                  <div className={styles.tierFill} style={{ width: `${pct}%`, background: tierColor(tier) }} />
                </div>
                <span className={styles.tierCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
