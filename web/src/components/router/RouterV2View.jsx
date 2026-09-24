/**
 * @file RouterV2View.jsx
 * @description Web dashboard page for the Smart Model Router v2 (BETA).
 *
 * 📖 Shows what the v1 router page could not: live breaker states including
 * DEGRADED and QUOTA_PAUSED (with expiry), the per-request fallback chain
 * (each attempt with its status/error plus every skipped model and the skip
 * reason), the global last-resort model, and a "test via router" action per
 * model that sends a REAL pinned request through the daemon's full chain
 * (normalization, pre-prompt, content gate), not around it.
 *
 * 📖 Everything here is clearly labelled BETA: v2 runs on its own port next
 * to v1, so this page can be explored with zero risk to the stable router.
 */

import { Fragment, useMemo, useState } from 'react'
import {
  IconPlayerPlay, IconPlayerStop, IconRefresh, IconFlask, IconRoute,
} from '@tabler/icons-react'
import useRouterV2 from '../../hooks/useRouterV2.js'
import styles from './RouterV2View.module.css'
import { useI18n } from '../../i18n.jsx'

function formatUptime(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s < 0) return '-'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatClock(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '-'
  return new Date(t).toLocaleTimeString()
}

function formatMs(ms) {
  const n = Number(ms)
  return Number.isFinite(n) && n > 0 ? `${Math.round(n)}ms` : '-'
}

const STATE_CLASS = {
  CLOSED: 'stateUp',
  DEGRADED: 'stateDegraded',
  HALF_OPEN: 'stateHalfOpen',
  OPEN: 'stateOpen',
  AUTH_ERROR: 'stateAuth',
  QUOTA_PAUSED: 'stateQuota',
  STALE: 'stateStale',
  UNSUPPORTED: 'stateStale',
}

const STATE_LABEL = {
  CLOSED: 'dashboard.working',
  DEGRADED: 'router.circuit.degraded',
  HALF_OPEN: 'router.circuit.probing',
  OPEN: 'router.circuit.down',
  AUTH_ERROR: 'router.circuit.authError',
  QUOTA_PAUSED: 'router.circuit.quotaPaused',
  STALE: 'router.circuit.deprecated',
  UNSUPPORTED: 'router.circuit.unsupported',
}

function OutcomeBadge({ outcome }) {
  const { t } = useI18n()
  const cls = outcome === 'served'
    ? styles.outcomeServed
    : outcome === 'client_aborted'
      ? styles.outcomeAborted
      : styles.outcomeFailed
  return <span className={cls}>{t(outcome === 'served' ? 'router.v2.outcome.served' : (outcome === 'client_aborted' ? 'router.v2.outcome.aborted' : 'router.v2.outcome.failed'))}</span>
}

export default function RouterV2View({ onClose, onToast }) {
  const { t } = useI18n()
  const { status, stats, history, loading, lastError, refresh, start, stop, testModel } = useRouterV2()
  const [testingKey, setTestingKey] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [expanded, setExpanded] = useState(null)

  const running = status?.ok === true
  const routingOrder = useMemo(() => (Array.isArray(stats?.routingOrder) ? stats.routingOrder : []), [stats])
  const models = useMemo(() => {
    const list = Array.isArray(stats?.models) ? stats.models : []
    return new Map(list.map((m) => [m.key, m]))
  }, [stats])
  const historyEntries = useMemo(() => (Array.isArray(history?.entries) ? history.entries : []), [history])
  const stateCounts = stats?.modelStates || {}

  const handleTest = async (key) => {
    const slashIdx = key.indexOf('/')
    if (slashIdx <= 0) return
    const provider = key.slice(0, slashIdx)
    const model = key.slice(slashIdx + 1)
    setTestingKey(key)
    try {
      const result = await testModel(provider, model)
      setTestResults((prev) => ({ ...prev, [key]: result }))
      if (result.ok) onToast?.(`${key} · ${t('router.v2.testViaRouter')} · ${formatMs(result.latencyMs)}`, 'success')
      else onToast?.(`${key} · ${t('router.v2.failed')}: ${result.error || t('common.unknown')}`, 'error')
      void refresh()
    } finally {
      setTestingKey(null)
    }
  }

  const handleTestTopThree = async () => {
    for (const entry of routingOrder.slice(0, 3)) {
      await handleTest(entry.key)
    }
  }

  return (
    <div className={styles.wrap} data-testid="router-v2-view">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <IconRoute size={22} stroke={1.6} />
          <h2 className={styles.title}>{t('router.v2.title')}</h2>
          <span className={styles.betaChip}>{t('router.v2.beta')}</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.ghostBtn} onClick={() => void refresh()} title={t('common.refresh')}>
            <IconRefresh size={15} stroke={1.6} /> {t('common.refresh')}
          </button>
          {running ? (
            <button className={styles.stopBtn} onClick={() => void stop().then((r) => onToast?.(r.ok ? 'Router v2 stopped' : (r.error || 'Stop failed'), r.ok ? 'info' : 'error'))}>
              <IconPlayerStop size={15} stroke={1.6} /> {t('router.stop')}
            </button>
          ) : (
            <button className={styles.startBtn} onClick={() => void start().then((r) => onToast?.(r.ok ? 'Router v2 started' : (r.error || 'Start failed'), r.ok ? 'success' : 'error'))}>
              <IconPlayerPlay size={15} stroke={1.6} /> {t('router.start')}
            </button>
          )}
        </div>
      </div>

      <p className={styles.betaBanner}>
        {t('router.v2.betaDescription', { port: status?.port || 19380 })}
      </p>

      {!running && (
        <div className={styles.stoppedCard}>
          {loading ? (
            <p>{t('router.v2.checking')}</p>
          ) : (
            <>
              <p>
                {lastError
                  ? <>{t('router.v2.notReachable', { error: lastError })}</>
                  : <>{t('router.v2.notRunning')}</>}
              </p>
              <code className={styles.codeBlock}>free-coding-models --router-v2-bg</code>
              <p className={styles.dim}>
                {t('router.v2.startStableHint')}
              </p>
            </>
          )}
        </div>
      )}

      {running && (
        <>
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>{t('router.uptime')}</span>
              <span className={styles.cardValue}>{formatUptime(stats?.uptimeSeconds)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>{t('router.v2.requestsRouted')}</span>
              <span className={styles.cardValue}>{stats?.requestsRouted ?? 0}</span>
              <span className={styles.cardSub}>{t('router.v2.failoverNeeded', { percent: Math.round((stats?.history?.failover_rate ?? 0) * 100) })}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>{t('router.v2.chainHealth')}</span>
              <span className={styles.cardValue}>
                <span className={styles.stateUp}>{t('router.v2.up', { count: stateCounts.CLOSED ?? 0 })}</span>{' '}
                <span className={styles.stateDegraded}>{t('router.v2.degraded', { count: stateCounts.DEGRADED ?? 0 })}</span>{' '}
                <span className={styles.stateOpen}>{t('router.v2.open', { count: stateCounts.OPEN ?? 0 })}</span>
              </span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>{t('router.v2.validation')}</span>
              <span className={styles.cardValue}>{stats?.failover?.contentValidation || t('router.v2.strict')}</span>
              <span className={styles.cardSub}>
                {t('router.v2.lastResort', { model: stats?.failover?.lastResortModel || t('common.disabled').toLowerCase() })}
              </span>
            </div>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>{t('router.v2.fallbackChain')}</h3>
              <span className={styles.sectionHint}>{t('router.v2.exactOrder')}</span>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('router.model')}</th>
                  <th>{t('router.state')}</th>
                  <th>{t('router.uptime')}</th>
                  <th>{t('router.v2.lastLatency')}</th>
                  <th>{t('router.v2.testViaRouter')}</th>
                </tr>
              </thead>
              <tbody>
                {routingOrder.length === 0 && (
                  <tr><td colSpan={6} className={styles.empty}>{t('router.v2.emptyCandidates')}</td></tr>
                )}
                {routingOrder.map((entry, i) => {
                  const health = models.get(entry.key) || {}
                  const state = health.state || entry.state || 'UNKNOWN'
                  const test = testResults[entry.key]
                  return (
                    <tr key={entry.key} className={i === 0 ? styles.primaryRow : ''}>
                      <td>{i === 0 ? '▶' : ''} {entry.priority ?? i + 1}</td>
                      <td className={styles.modelCell}>{entry.key}</td>
                      <td>
                        <span className={styles[STATE_CLASS[state]] || styles.stateUnknown}>
                          {STATE_LABEL[state] ? t(STATE_LABEL[state]) : state}
                        </span>
                        {health.quota_paused_until && (
                          <span className={styles.pauseUntil}> until {formatClock(health.quota_paused_until)}</span>
                        )}
                      </td>
                      <td>{health.uptime != null ? `${Math.round(health.uptime * 100)}%` : '-'}</td>
                      <td>{formatMs(health.last_latency_ms)}</td>
                      <td>
                        <button
                          className={styles.testBtn}
                          disabled={testingKey === entry.key}
                          onClick={() => void handleTest(entry.key)}
                          title={t('router.v2.testTitle')}
                        >
                          <IconFlask size={13} stroke={1.6} />
                          {testingKey === entry.key ? t('router.v2.testing') : (test ? (test.ok ? `OK ${formatMs(test.latencyMs)}` : t('router.v2.failed')) : t('router.v2.test'))}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {routingOrder.length > 0 && (
              <div className={styles.sectionActions}>
                <button className={styles.ghostBtn} disabled={testingKey !== null} onClick={() => void handleTestTopThree()}>
                  <IconFlask size={14} stroke={1.6} /> {t('router.v2.testTopThree')}
                </button>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>{t('router.v2.requestChains')}</h3>
              <span className={styles.sectionHint}>{t('router.v2.attemptsHint')}</span>
            </div>
            {historyEntries.length === 0 ? (
              <p className={styles.empty}>{t('router.noRequests')} <code>http://localhost:{status?.port || 19380}/v1</code> · <code>fcm</code></p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('router.time')}</th>
                    <th>{t('router.activeSetLabel')}</th>
                    <th>{t('router.v2.outcome')}</th>
                    <th>{t('router.v2.fallbackChain')}</th>
                    <th>{t('router.v2.wallTime')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map((entry) => {
                    const id = entry.request_id || entry.at
                    const isOpen = expanded === id
                    return (
                      <Fragment key={id}>
                        <tr onClick={() => setExpanded(isOpen ? null : id)} className={styles.chainRow}>
                          <td>{formatClock(entry.at)}</td>
                          <td>{entry.set || '-'}</td>
                          <td><OutcomeBadge outcome={entry.outcome} /></td>
                          <td className={styles.chainCell}>{entry.summary || entry.served_model || '-'}</td>
                          <td>{formatMs(entry.wall_ms)}</td>
                          <td>{entry.last_resort_used ? <span className={styles.lastResort}>{t('router.v2.lastResortTag')}</span> : null}</td>
                        </tr>
                        {isOpen && (
                          <tr className={styles.detailRow}>
                            <td colSpan={6}>
                              <div className={styles.detailBody}>
                                <div>
                                  <strong>{t('router.v2.attempts')}:</strong>
                                  <ol>
                                    {(entry.attempts || []).map((a, i) => (
                                      <li key={`${id}-a${i}`}>
                                        <code>{a.model}</code>
                                        {a.status != null && ` status ${a.status}`}
                                        {a.latency_ms != null && ` · ${formatMs(a.latency_ms)}`}
                                        {a.error && <span className={styles.stateOpen}> · {a.error}</span>}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                                <div>
                                  <strong>{t('router.v2.skipped')}:</strong>
                                  {(entry.skipped || []).length === 0
                                    ? <span> {t('common.none')}</span>
                                    : (
                                      <ul>
                                        {entry.skipped.map((s, i) => (
                                          <li key={`${id}-s${i}`}><code>{s.model}</code> · {s.reason}</li>
                                        ))}
                                      </ul>
                                    )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>{t('router.quickSetup')}</h3>
            </div>
            <div className={styles.setupGrid}>
              <div>
                <span className={styles.cardLabel}>{t('router.v2.openAiTools')}</span>
                <code className={styles.codeBlock}>
                  base_url: http://localhost:{status?.port || 19380}/v1{'\n'}model: fcm{'\n'}api_key: fcm-local
                </code>
              </div>
              <div>
                <span className={styles.cardLabel}>{t('router.v2.anthropicTools')}</span>
                <code className={styles.codeBlock}>
                  base_url: http://localhost:{status?.port || 19380}{'\n'}POST /v1/messages{'\n'}model: fcm (or fcm:@provider/model)
                </code>
              </div>
            </div>
            <p className={styles.dim}>
              {t('router.v2.pinOneHint')} <code>model: "fcm:@{routingOrder[0]?.key || 'provider/model'}"</code>
            </p>
          </section>
        </>
      )}
    </div>
  )
}
