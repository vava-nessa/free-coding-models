/**
 * @file web/src/components/analytics/TokenUsagePanel.jsx
 * @description Token Usage sub-section inside Analytics — 7-day chart, top models/providers.
 * 📖 M4: Uses useTokenUsage hook, pure CSS bars (no charting library).
 */
import { useTokenUsage } from '../../hooks/useTokenUsage.js'
import styles from './TokenUsagePanel.module.css'
import { useI18n } from '../../i18n.jsx'

function formatTokens(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

export default function TokenUsagePanel() {
  const { t } = useI18n()
  const { data, loading } = useTokenUsage()

  if (loading) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('analytics.tokenUsage')}</h3>
        <div className={styles.empty}>{t('analytics.loading')}</div>
      </div>
    )
  }

  if (!data || !data.hasData) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('analytics.tokenUsage')}</h3>
        <div className={styles.empty}>{t('analytics.noTokenData')}</div>
      </div>
    )
  }

  const maxDayTokens = Math.max(...data.sevenDays.map(d => d.totalTokens), 1)

  return (
    <>
      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t('analytics.today')}</span>
          <span className={styles.summaryValue}>{formatTokens(data.today.totalTokens)}</span>
          <span className={styles.summarySub}>{t('analytics.requests', { count: data.today.requests })}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>{t('analytics.allTime')}</span>
          <span className={styles.summaryValue}>{formatTokens(data.allTime.totalTokens)}</span>
          <span className={styles.summarySub}>{t('analytics.requests', { count: data.allTime.requests })}</span>
        </div>
      </div>

      {/* 7-day chart */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('analytics.sevenDayUsage')}</h3>
        <div className={styles.chart}>
          {data.sevenDays.map((day) => (
            <div key={day.date} className={styles.chartBar}>
              <div
                className={styles.chartFill}
                style={{ height: `${Math.max(2, (day.totalTokens / maxDayTokens) * 100)}%` }}
                title={`${day.date}: ${t('analytics.tokens', { count: formatTokens(day.totalTokens) })}`}
              />
              <span className={styles.chartLabel}>{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Models */}
      {data.topModels.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>{t('analytics.topModels')}</h3>
          <div className={styles.topList}>
            {data.topModels.map((m) => (
              <div key={m.key} className={styles.topRow}>
                <span className={styles.topKey}>{m.key}</span>
                <span className={styles.topVal}>{t('analytics.tokens', { count: formatTokens(m.total) })}</span>
                <span className={styles.topReq}>{t('analytics.requestsShort', { count: m.requests })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Providers */}
      {data.topProviders.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>{t('analytics.topProviders')}</h3>
          <div className={styles.topList}>
            {data.topProviders.map((p) => (
              <div key={p.key} className={styles.topRow}>
                <span className={styles.topKey}>{p.key}</span>
                <span className={styles.topVal}>{t('analytics.tokens', { count: formatTokens(p.total) })}</span>
                <span className={styles.topReq}>{t('analytics.requestsShort', { count: p.requests })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
