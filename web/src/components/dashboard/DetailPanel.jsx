/**
 * @file web/src/components/dashboard/DetailPanel.jsx
 * @description Slide-in detail panel showing full model stats, metrics, and a latency chart.
 * 📖 Rendered as a fixed overlay on the right side. Controlled by `model` prop (null = hidden).
 * Displays model ID, provider, tier, SWE score, context, status, pings, stability, verdict, uptime,
 * ping count, API key status, a larger SVG latency trend chart, and an M1 favorites + benchmark
 * 📖 action section (star + reorder + per-row AI Speed Test button).
 * @functions DetailPanel → main panel component, buildDetailChart → SVG chart builder
 */
import { useMemo } from 'react'
import { IconStar, IconStarFilled, IconChevronUp, IconChevronDown, IconPlayerPlayFilled } from '@tabler/icons-react'
import TierBadge from '../atoms/TierBadge.jsx'
import VerdictBadge from '../atoms/VerdictBadge.jsx'
import StatusDot from '../atoms/StatusDot.jsx'
import StabilityCell from '../atoms/StabilityCell.jsx'
import { formatPing, formatAvg, pingClass } from '../../utils/format.js'
import { sweClass } from '../../utils/ranks.js'
import styles from './DetailPanel.module.css'

function buildDetailChart(history) {
  if (!history || history.length < 2) {
    return <div className={styles.chartEmpty}>Waiting for ping data...</div>
  }

  const valid = history.filter(p => p.code === '200' || p.code === '401')
  if (valid.length < 2) {
    return <div className={styles.chartEmpty}>Not enough data yet...</div>
  }

  const values = valid.map(p => p.ms)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 340, h = 100
  const padding = 4

  const points = values.map((v, i) => {
    const x = padding + i * ((w - 2 * padding) / (values.length - 1))
    const y = padding + (h - 2 * padding) - ((v - min) / range) * (h - 2 * padding)
    return [x.toFixed(1), y.toFixed(1)]
  })

  const linePoints = points.map(p => p.join(',')).join(' ')
  const areaPoints = `${points[0][0]},${h - padding} ${linePoints} ${points[points.length - 1][0]},${h - padding}`
  const lastPt = points[points.length - 1]

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon fill="url(#chart-grad)" points={areaPoints} />
      <polyline fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={linePoints} />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="1.5" />
      <text x={padding} y={h - 2} fontSize="9" fill="var(--color-text-dim)" fontFamily="var(--font-mono)">{min}ms</text>
      <text x={w - padding} y={padding + 8} fontSize="9" fill="var(--color-text-dim)" fontFamily="var(--font-mono)" textAnchor="end">{max}ms</text>
    </svg>
  )
}

function StatRow({ label, children }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{children}</span>
    </div>
  )
}

export default function DetailPanel({ model, onClose, favorites, onBenchmark, onToast }) {
  if (!model) return null

  const chartSvg = buildDetailChart(model.pingHistory)
  const isFav = favorites?.isFavorite(model) ?? false
  const favRank = favorites?.favoriteRank(model) ?? Number.MAX_SAFE_INTEGER
  const isFavAtTop = isFav && favRank === 0
  const isFavAtBottom = isFav && favRank === (favorites?.favorites.length ?? 0) - 1

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>{model.label}</h3>
        <button className={styles.closeBtn} onClick={onClose}>&times;</button>
      </div>
      <div className={styles.body}>
        <StatRow label="Model ID">
          <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{model.modelId}</span>
        </StatRow>
        <StatRow label="Provider">{model.origin}</StatRow>
        <StatRow label="Tier"><TierBadge tier={model.tier} /></StatRow>
        <StatRow label="SWE-bench Score">
          <span className={`${styles.swe} ${styles[sweClass(model.sweScore)]}`}>{model.sweScore || '—'}</span>
        </StatRow>
        <StatRow label="Context Window">{model.ctx || '—'}</StatRow>
        <StatRow label="Status">
          <StatusDot status={model.status} /> {model.status}
        </StatRow>
        <StatRow label="Latest Ping">
          <span className={`${styles.ping} ${styles[pingClass(model.latestPing)]}`}>
            {formatPing(model.latestPing, model.latestCode).text}
          </span>
        </StatRow>
        <StatRow label="Average Latency">
          <span className={`${styles.ping} ${styles[pingClass(model.avg)]}`}>
            {formatAvg(model.avg).text}
          </span>
        </StatRow>
        <StatRow label="P95 Latency">
          {model.p95 != null && model.p95 !== Infinity ? `${model.p95}ms` : '—'}
        </StatRow>
        <StatRow label="Jitter (σ)">
          {model.jitter != null && model.jitter !== Infinity ? `${model.jitter}ms` : '—'}
        </StatRow>
        <StatRow label="Stability Score">
          <StabilityCell score={model.stability} />
        </StatRow>
        <StatRow label="Verdict">
          <VerdictBadge verdict={model.verdict} httpCode={model.httpCode} />
        </StatRow>
        <StatRow label="Uptime">
          {model.uptime > 0 ? `${model.uptime}%` : '—'}
        </StatRow>
        <StatRow label="Ping Count">{model.pingCount}</StatRow>
        <StatRow label="API Key">
          {model.hasApiKey ? '✅ Configured' : '❌ Missing'}
        </StatRow>

        {/* ── M1: favorites + per-row benchmark action section ── */}
        {(favorites || onBenchmark) && (
          <div className={styles.actions}>
            {favorites && (
              <div className={styles.favBlock}>
                <button
                  className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
                  onClick={() => favorites.toggle(model)}
                  title={isFav ? `Unfavorite ${model.label} (TUI: F)` : `Favorite ${model.label} (TUI: F)`}
                >
                  {isFav ? <IconStarFilled size={14} stroke={1.5} /> : <IconStar size={14} stroke={1.5} />}
                  <span>{isFav ? 'Favorited' : 'Add to favorites'}</span>
                </button>
                {isFav && (
                  <div className={styles.reorderRow}>
                    <button
                      className={styles.reorderBtn}
                      disabled={isFavAtTop}
                      onClick={() => favorites.reorder(model, 'up')}
                      title="Move up in router priority (TUI: Shift+↑)"
                      aria-label="Move favorite up"
                    >
                      <IconChevronUp size={12} stroke={1.5} /> Up
                    </button>
                    <button
                      className={styles.reorderBtn}
                      disabled={isFavAtBottom}
                      onClick={() => favorites.reorder(model, 'down')}
                      title="Move down in router priority (TUI: Shift+↓)"
                      aria-label="Move favorite down"
                    >
                      <IconChevronDown size={12} stroke={1.5} /> Down
                    </button>
                    <span className={styles.rankBadge}>#{favRank + 1}</span>
                  </div>
                )}
              </div>
            )}
            {onBenchmark && (
              <button
                className={styles.benchBtn}
                onClick={() => {
                  onBenchmark(model)
                  onToast?.(`Benchmark started for ${model.label}…`, 'info')
                }}
                title="Run AI Speed Test on this model (TUI: Ctrl+A)"
              >
                <IconPlayerPlayFilled size={12} stroke={1.5} />
                <span>AI Speed Test</span>
              </button>
            )}
          </div>
        )}

        <div className={styles.chart}>
          <div className={styles.chartTitle}>Latency Trend (last 20 pings)</div>
          {chartSvg}
        </div>
      </div>
    </div>
  )
}
