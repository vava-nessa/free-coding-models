/**
 * @file web/src/components/dashboard/ExpandedDetailRow.jsx
 * @description Expandable 3-column detail row rendered below a model's table row.
 * 📖 Left column: key stats (tier, SWE, context, provider, status, avg ping, stability, verdict, uptime)
 *    with favorite toggle + launch button at the bottom.
 * 📖 Center column: mini chat playground — sends a user message to the model via SSE streaming
 *    and displays the response in real time.
 * 📖 Right column: AI latency benchmark — POSTs to /api/benchmark-stream, parses SSE events
 *    (start/token/done/error), and shows live metrics (latency, tokens, TPS), a progress bar,
 *    and the streaming generated text preview.
 * 📖 When the model has no API key configured, a banner is shown instead of the 3 columns.
 * @functions ExpandedDetailRow → main component
 */
import { useState, useRef, useCallback } from 'react'
import { IconPlayerPlayFilled, IconStar, IconStarFilled, IconLoader } from '@tabler/icons-react'
import TierBadge from '../atoms/TierBadge.jsx'
import VerdictBadge from '../atoms/VerdictBadge.jsx'
import StatusDot from '../atoms/StatusDot.jsx'
import StabilityCell from '../atoms/StabilityCell.jsx'
import { formatAvg, pingClass } from '../../utils/format.js'
import { sweClass } from '../../utils/ranks.js'
import LaunchButton from '../launch/LaunchButton.jsx'
import PlaygroundChat from '../playground/PlaygroundChat.jsx'
import { useI18n } from '../../i18n.jsx'
import styles from './ExpandedDetailRow.module.css'

/**
 * Single stat item with label + value, used in the info column grid.
 * @param {string} label - Uppercase stat label
 * @param {React.ReactNode} children - Stat value content
 */
function StatItem({ label, children }) {
  return (
    <div className={styles.statItem}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{children}</span>
    </div>
  )
}

/**
 * Expandable detail row with 3 columns: Info, Mini Playground, AI Latency.
 *
 * @param {Object} props
 * @param {Object} props.model - The model data object
 * @param {Object} props.favorites - Favorites controller (isFavorite, toggle)
 * @param {Function} [props.onBenchmark] - Benchmark callback
 * @param {Function} [props.onLaunch] - Launch callback
 * @param {Function} [props.onToast] - Toast notification callback
 * @param {string} [props.toolMode='opencode'] - Current tool mode
 * @param {Function} [props.onSetToolMode] - Set tool mode handler
 * @param {Function} [props.onCycleToolMode] - Cycle tool mode handler
 * @param {Function} [props.onOpenFallback] - Open fallback tool handler
 */
export default function ExpandedDetailRow({
  model,
  favorites,
  onBenchmark,
  onLaunch,
  onToast,
  toolMode = 'opencode',
  onSetToolMode,
  onCycleToolMode,
  onOpenFallback,
}) {
  const { t } = useI18n()
  // ─── AI Latency benchmark state ───
  const [benchState, setBenchState] = useState('idle') // 'idle' | 'running' | 'done' | 'error'
  const [benchMetrics, setBenchMetrics] = useState({ latency: null, tokens: null, tps: null })
  const [benchText, setBenchText] = useState('')
  const [benchProgress, setBenchProgress] = useState(0)
  const benchAbort = useRef(null)

  if (!model) return null

  const isFav = favorites?.isFavorite(model) ?? false
  const avgData = formatAvg(model.avg)
  const avgCls = avgData.cls || pingClass(model.avg)

  // ─── AI Latency: run benchmark ───
  const handleBenchStart = useCallback(async () => {
    if (benchState === 'running') return

    setBenchState('running')
    setBenchMetrics({ latency: null, tokens: null, tps: null })
    setBenchText('')
    setBenchProgress(0)

    // Cancel any previous request
    if (benchAbort.current) benchAbort.current.abort()
    const controller = new AbortController()
    benchAbort.current = controller

    try {
      const res = await fetch('/api/benchmark-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerKey: model.providerKey, modelId: model.modelId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`)
        setBenchState('error')
        setBenchText(`Error: ${errText}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          if (trimmed.startsWith('event: ')) {
            // Event type line — we use data lines for actual content
            continue
          }

          if (trimmed.startsWith('data: ')) {
            const payload = trimmed.slice(6).trim()

            try {
              const json = JSON.parse(payload)
              const eventType = json.type || json.event

              if (eventType === 'token' || json.token !== undefined) {
                // Live token — update streaming text and metrics
                if (json.text) {
                  accumulatedText += json.text
                  setBenchText(accumulatedText)
                }
                if (json.totalMs != null) {
                  setBenchMetrics(prev => ({
                    ...prev,
                    latency: (json.totalMs / 1000).toFixed(2),
                  }))
                }
                if (json.tokens != null) {
                  setBenchMetrics(prev => ({ ...prev, tokens: json.tokens }))
                  setBenchProgress(Math.min(100, Math.round((json.tokens / 140) * 100)))
                }
                if (json.tps != null) {
                  setBenchMetrics(prev => ({ ...prev, tps: json.tps.toFixed(1) }))
                }
              } else if (eventType === 'done') {
                // Benchmark complete
                if (json.totalMs != null) {
                  setBenchMetrics(prev => ({
                    ...prev,
                    latency: (json.totalMs / 1000).toFixed(2),
                  }))
                }
                if (json.outputTokens != null) {
                  setBenchMetrics(prev => ({ ...prev, tokens: json.outputTokens }))
                }
                if (json.tokensPerSecond != null) {
                  setBenchMetrics(prev => ({
                    ...prev,
                    tps: json.tokensPerSecond.toFixed(1),
                  }))
                }
                setBenchProgress(100)
                setBenchState('done')
              } else if (eventType === 'error') {
                setBenchState('error')
                setBenchText(json.message || json.error || 'Unknown error')
              }
            } catch {
              // Non-JSON payload — ignore
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setBenchState('error')
        setBenchText(`Error: ${err.message}`)
      }
    } finally {
      if (benchState === 'running') {
        setBenchState('done')
      }
      benchAbort.current = null
    }
  }, [benchState, model.providerKey, model.modelId])

  // ─── No API key — show banner ───
  if (!model.hasApiKey) {
    return (
      <div className={styles.row}>
        <div className={styles.noKeyBanner}>
          <span className={styles.noKeyIcon}>🔒</span>
          <span>{t('modelDetail.noApiKey', { provider: model.origin })}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <div className={styles.grid}>

        {/* ═══════ Column 1: Info ═══════ */}
        <div className={styles.col}>
          <div className={styles.colTitle}>📊 {t('modelDetail.modelInfo')}</div>
          <div className={styles.statGrid}>
            <StatItem label={t('dashboard.tier')}>
              <TierBadge tier={model.tier} />
            </StatItem>
            <StatItem label="SWE-bench">
              <span className={styles[sweClass(model.sweScore)]}>
                {model.sweScore || '—'}
              </span>
            </StatItem>
            <StatItem label={t('dashboard.context')}>
              {model.ctx || '—'}
            </StatItem>
            <StatItem label={t('dashboard.provider')}>
              {model.origin}
            </StatItem>
            <StatItem label={t('dashboard.status')}>
              <StatusDot status={model.status} />
              <span style={{ fontSize: 11 }}>
                {({
                  up: t('dashboard.working'),
                  down: t('dashboard.down'),
                  timeout: t('filters.health.timeout'),
                  noauth: t('filters.health.noKey'),
                  auth_error: t('filters.health.authError'),
                  pending: t('dashboard.pending'),
                })[model.status] || model.status}
              </span>
            </StatItem>
            <StatItem label={t('dashboard.avgPingShort')}>
              <span className={styles[avgCls]}>
                {avgData.text}
              </span>
            </StatItem>
            <StatItem label={t('dashboard.stability')}>
              <StabilityCell score={model.stability} />
            </StatItem>
            <StatItem label={t('dashboard.verdict')}>
              <VerdictBadge verdict={model.verdict} httpCode={model.httpCode} />
            </StatItem>
            <StatItem label={t('dashboard.uptime')}>
              {model.uptime > 0 ? `${model.uptime}%` : '—'}
            </StatItem>
          </div>
          <div className={styles.infoActions}>
            {favorites && (
              <button
                className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
                onClick={() => favorites.toggle(model)}
                title={t(isFav ? 'dashboard.unfavoriteModelTitle' : 'dashboard.favoriteModelTitle', { model: model.label })}
              >
                {isFav
                  ? <IconStarFilled size={13} stroke={1.5} />
                  : <IconStar size={13} stroke={1.5} />
                }
                <span>{isFav ? t('dashboard.favorited') : t('dashboard.favorite')}</span>
              </button>
            )}
            {onLaunch && (
              <LaunchButton
                model={model}
                toolMode={toolMode}
                onLaunch={onLaunch}
                variant="default"
              />
            )}
          </div>
        </div>

        {/* ═══════ Column 2: Mini Playground (shared PlaygroundChat core) ═══════ */}
        <div className={styles.col}>
          <div className={styles.playgroundHeader}>
            💬 {t('modelDetail.miniPlayground', { model: model.label })}
          </div>
          <div className={styles.playgroundWrap}>
            <PlaygroundChat
              model={`${model.providerKey}/${model.modelId}`}
              variant="mini"
              disabled={!model.hasApiKey}
              placeholder={t('modelDetail.playgroundPlaceholder')}
              emptyTitle={t('modelDetail.testModel', { model: model.label })}
              emptyHint={t('modelDetail.playgroundEmptyHint')}
            />
          </div>
        </div>

        {/* ═══════ Column 3: AI Latency ═══════ */}
        <div className={styles.col}>
          <button
            className={styles.benchBtn}
            onClick={handleBenchStart}
            disabled={benchState === 'running'}
            title={benchState === 'running' ? t('modelDetail.runningBenchmark') : t('modelDetail.testAiLatency')}
          >
            {benchState === 'running' ? (
              <IconLoader size={13} stroke={1.8} className={styles.spinning} />
            ) : (
              <IconPlayerPlayFilled size={13} stroke={1.8} />
            )}
            <span>{benchState === 'running' ? t('modelDetail.running') : t('modelDetail.testAiLatency')}</span>
          </button>

          {/* Live metrics grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{t('dashboard.latency')}</span>
              <span className={styles.metricValue}>
                {benchMetrics.latency != null ? `${benchMetrics.latency}s` : '—'}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{t('modelDetail.tokens')}</span>
              <span className={styles.metricValue}>
                {benchMetrics.tokens != null ? benchMetrics.tokens : '—'}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>TPS</span>
              <span className={styles.metricValue}>
                {benchMetrics.tps != null ? benchMetrics.tps : '—'}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{t('dashboard.status')}</span>
              <span className={styles.metricValue}>
                {benchState === 'idle' && '⏳'}
                {benchState === 'running' && '⚡'}
                {benchState === 'done' && '✅'}
                {benchState === 'error' && '❌'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${benchProgress}%` }}
            />
          </div>

          {/* Streaming text preview */}
          <div className={styles.streamText}>
            {benchText || (
              <span className={styles.responsePlaceholder}>
                {t('modelDetail.generatedText')}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
