/**
 * @file web/src/components/playground/PlaygroundView.jsx
 * @description Playground chat modal — multi-turn chat through the FCM router
 *   OR directly to a specific model. This is the HOST (chrome) layer; the
 *   actual chat (transcript, input, SSE streaming, metadata) is delegated to
 *   the shared <PlaygroundChat> core so the full playground, the RouterView
 *   "Test Router", and the ExpandedDetailRow "Mini Playground" all look and
 *   behave identically.
 *
 * 📖 What this host still owns:
 * 📖   - Header (title, message/token counter, clear + close)
 * 📖   - Model bar (selector, streaming toggle, pre-prompt toggle, router status)
 * 📖   - Pre-prompt hint (fetched from /api/router/preprompt)
 * 📖   - Router daemon lifecycle (auto-check, 5s auto-start, start button)
 * 📖   - Smart model selection on mount (best "up" model with a key)
 *
 * 📖 What it delegates to <PlaygroundChat>:
 * 📖   - The transcript + input + send/stop
 * 📖   - SSE streaming through /api/playground/chat
 * 📖   - The harmonized metadata row under every reply
 * 📖     (provider/model · ms · tok · t/s)
 *
 * @functions PlaygroundView — full-screen chat modal host wrapping PlaygroundChat
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  IconMessageChatbot,
  IconX,
  IconTrash,
  IconBolt,
  IconAlertTriangle,
  IconPlayerPlay,
  IconLoader,
} from '@tabler/icons-react'
import PlaygroundChat from './PlaygroundChat.jsx'
import styles from './PlaygroundView.module.css'
import { useI18n } from '../../i18n.jsx'

const SUGGESTIONS = [
  'Write a Python fizzbuzz with type hints',
  'Explain Big O notation with three examples',
  'Refactor a deeply nested for-loop into map/filter',
  'Write a tiny Express endpoint that returns JSON',
]

/**
 * 📖 Router status pill shown in the model bar. `daemonRunning` is a tri-state:
 * 📖 null = checking, true = online, false = offline. Kept here because it is
 * 📖 pure chrome (not part of the chat core).
 */
function StatusPill({ routerStatus, daemonRunning }) {
  const { t } = useI18n()
  if (daemonRunning === true) {
    return (
      <span className={styles.metaChip}>
        <IconBolt size={11} />
        {t('playground.routerOnline')}
      </span>
    )
  }
  if (daemonRunning === false) {
    return (
      <span className={`${styles.metaChip} ${styles.error}`}>
        <IconAlertTriangle size={11} />
        {t('playground.routerOffline')}
      </span>
    )
  }
  return (
    <span className={styles.metaChip}>
      <IconLoader size={11} className={styles.spin} />
      {t('playground.checkingRouter')}
    </span>
  )
}

export default function PlaygroundView({ onClose, onToast, models, routerStatus }) {
  const { t } = useI18n()
  // ── Chrome state (host-owned) ──────────────────────────────────────────
  const [model, setModel] = useState(null) // null = computing best model
  const [streamOn, setStreamOn] = useState(true)
  const [prePromptEnabled, setPrePromptEnabled] = useState(true)
  const [prePromptText, setPrePromptText] = useState('')

  // 📖 Router daemon lifecycle (null = checking, true = running, false = down)
  const [daemonRunning, setDaemonRunning] = useState(
    routerStatus?.running === true ? true : null
  )
  const [daemonStarting, setDaemonStarting] = useState(false)
  const [autoStartSec, setAutoStartSec] = useState(5)
  const cooldownRef = useRef(null)
  const daemonCheckRef = useRef(null)
  const autoStartTriggered = useRef(false)

  // 📖 Header counter + empty-state gate. Updated by PlaygroundChat via the
  // 📖 onTurnComplete callback so the host chrome stays in sync with the
  // 📖 chat core it no longer owns directly.
  const [chatStats, setChatStats] = useState({ count: 0, totalTokens: 0 })
  const chatRef = useRef(null)

  // 📖 Fetch the pre-prompt once on mount so the toggle shows the real value
  // 📖 and the hint matches what the router injects server-side.
  useEffect(() => {
    void fetch('/api/router/preprompt')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setPrePromptEnabled(data.enabled === true)
          if (typeof data.text === 'string') setPrePromptText(data.text)
        }
      })
      .catch(() => {})
  }, [])

  // 📖 Smart model selection on mount: pick the best "up" model with an API
  // 📖 key, preferring lower latency and higher tier. Falls back to "fcm" so
  // 📖 the playground opens immediately even without a working model.
  useEffect(() => {
    if (model !== null) return
    const upModels = (Array.isArray(models) ? models : [])
      .filter((m) => m.status === 'up' && m.hasApiKey && !m.isPinging)

    if (upModels.length > 0) {
      const tierOrder = { 'S+': 0, 'S': 1, 'A+': 2, 'A': 3, 'A-': 4, 'B+': 5, 'B': 6, 'C': 7 }
      upModels.sort((a, b) => {
        const ta = tierOrder[a.tier] ?? 99
        const tb = tierOrder[b.tier] ?? 99
        if (ta !== tb) return ta - tb
        const avgA = typeof a.avg === 'number' ? a.avg : 99999
        const avgB = typeof b.avg === 'number' ? b.avg : 99999
        return avgA - avgB
      })
      setModel(`${upModels[0].providerKey}/${upModels[0].modelId}`)
      return
    }
    setModel('fcm')
  }, [models, model])

  // 📖 Check daemon status on mount.
  useEffect(() => {
    let mounted = true
    async function checkDaemon() {
      try {
        const resp = await fetch('/api/router/status')
        const data = await resp.json()
        if (!mounted) return
        setDaemonRunning(data?.running === true)
      } catch {
        if (mounted) setDaemonRunning(false)
      }
    }
    void checkDaemon()
    return () => {
      mounted = false
      if (cooldownRef.current) clearInterval(cooldownRef.current)
      if (daemonCheckRef.current) clearInterval(daemonCheckRef.current)
    }
  }, [])

  // 📖 Start the router daemon, then poll until it is ready.
  const startDaemon = useCallback(async () => {
    if (daemonStarting) return
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null }
    autoStartTriggered.current = true
    setDaemonStarting(true)
    try {
      await fetch('/api/router/start', { method: 'POST' })
      let attempts = 0
      await new Promise((resolve) => {
        daemonCheckRef.current = setInterval(async () => {
          attempts += 1
          try {
            const resp = await fetch('/api/router/status')
            const data = await resp.json()
            if (data?.running) {
              clearInterval(daemonCheckRef.current)
              setDaemonRunning(true)
              setDaemonStarting(false)
              resolve()
            }
          } catch {}
          if (attempts >= 30) {
            clearInterval(daemonCheckRef.current)
            setDaemonStarting(false)
            resolve()
          }
        }, 1000)
      })
    } catch {
      setDaemonStarting(false)
    }
  }, [daemonStarting])

  // 📖 Auto-start the daemon after 5 seconds if it is down, the model is the
  // 📖 "fcm" auto-router, and auto-start hasn't fired yet. The button is always
  // 📖 clickable so the user can trigger it manually at any time.
  useEffect(() => {
    if (daemonRunning !== false || model !== 'fcm' || autoStartTriggered.current) return
    let remaining = 5
    setAutoStartSec(5)
    cooldownRef.current = setInterval(() => {
      remaining -= 1
      setAutoStartSec(remaining)
      if (remaining <= 0) {
        clearInterval(cooldownRef.current)
        autoStartTriggered.current = true
        void startDaemon()
      }
    }, 1000)
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [daemonRunning, model, startDaemon])

  // 📖 Stable list of model identifiers for the dropdown — defaults to `fcm`
  // 📖 (the auto-router) and lets the user pin a specific catalog entry.
  const modelOptions = useMemo(() => {
    const opts = [{ value: 'fcm', label: t('playground.autoRouterRecommended') }]
    if (Array.isArray(models)) {
      for (const m of models.slice(0, 200)) {
        const id = m.modelId || m.id
        if (!id) continue
        const label = m.label || id
        opts.push({ value: `${m.providerKey}/${id}`, label: `${m.providerKey}/${id} (${label})` })
      }
    }
    return opts
  }, [models, t])

  // 📖 PlaygroundChat turn callback → keep the header counter in sync and
  // 📖 drive the daemon-panel gate (only show it when there are no messages).
  const handleTurnComplete = useCallback((summary) => {
    setChatStats({ count: summary.count, totalTokens: summary.totalTokens })
  }, [])

  const handleClear = useCallback(() => {
    chatRef.current?.clear()
    setChatStats({ count: 0, totalTokens: 0 })
  }, [])

  // 📖 Can the user send right now? fcm needs the daemon; a pinned model
  // 📖 routes directly to its provider and works without the daemon.
  const canSend = !(model === 'fcm' && daemonRunning !== true)

  // 📖 Daemon-panel gates. The panels replace the chat area entirely when the
  // 📖 user is on the auto-router, the daemon is down/starting, and there is
  // 📖 no conversation yet to keep on screen.
  const hasMessages = chatStats.count > 0
  const showDaemonStartPanel = model === 'fcm' && !hasMessages && daemonRunning === false && !daemonStarting
  const showDaemonStartingPanel = model === 'fcm' && !hasMessages && daemonStarting
  const showChat = !showDaemonStartPanel && !showDaemonStartingPanel

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-label={t('playground.title')}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerTitle}>
              <IconMessageChatbot size={18} />
              {t('playground.title')}
            </div>
            <div className={styles.headerSubtitle}>
              {t('playground.messagesTokens', { messages: chatStats.count, tokens: chatStats.totalTokens })}
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              onClick={handleClear}
              title={t('playground.clear')}
              disabled={!hasMessages}
            >
              <IconTrash size={16} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={onClose}
              title={`${t('common.close')} (Esc)`}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        <div className={styles.modelBar}>
          <span className={styles.modelLabel}>{t('playground.model')}:</span>
          <select
            className={styles.modelSelect}
            value={model ?? 'fcm'}
            onChange={(e) => setModel(e.target.value)}
            disabled={!showChat}
          >
            {modelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            className={styles.presetChip}
            onClick={() => setStreamOn((v) => !v)}
            title={t('playground.toggleStreaming')}
          >
            {streamOn ? t('playground.streamOn') : t('playground.streamOff')}
          </button>
          <label className={styles.prePromptToggle} title={t('playground.prePromptHint')}>
            <input
              type="checkbox"
              checked={prePromptEnabled}
              onChange={(e) => setPrePromptEnabled(e.target.checked)}
            />
            {t('playground.persona')}
          </label>
          <StatusPill routerStatus={routerStatus} daemonRunning={daemonRunning} />
        </div>

        {prePromptEnabled && prePromptText && (
          <div className={styles.modelBar} style={{ borderTop: 'none', background: 'transparent', paddingTop: 4, paddingBottom: 8, fontSize: 11 }}>
            <span className={styles.modelLabel} style={{ flexShrink: 0 }}>{t('playground.persona')}:</span>
            <span style={{ opacity: 0.7, fontStyle: 'italic' }}>
              {prePromptText.length > 160 ? `${prePromptText.slice(0, 160)}…` : prePromptText}
            </span>
          </div>
        )}

        <div className={styles.chatBody}>
          {showDaemonStartPanel ? (
            <div className={styles.daemonStartPanel}>
              <IconAlertTriangle size={32} style={{ color: '#fbbf24', opacity: 0.8 }} />
              <div className={styles.daemonStartTitle}>{t('playground.daemonStopped')}</div>
              <div className={styles.daemonStartHint}>
                {t('playground.routerHint')}
              </div>
              <button
                className={styles.daemonStartBtn}
                onClick={startDaemon}
                title={t('playground.startDaemon')}
              >
                {daemonStarting ? (
                  <><IconLoader size={14} className={styles.spin} /> {t('playground.startingDaemon')}</>
                ) : (
                  <><IconPlayerPlay size={14} /> {t('playground.startRouter')}{autoStartSec > 0 && !autoStartTriggered.current ? ` (${t('playground.autoStartIn', { seconds: autoStartSec })})` : ''}</>
                )}
              </button>
              <div className={styles.daemonStartAlt}>
                {t('playground.runCommand')} <code>free-coding-models --daemon-bg</code>
              </div>
            </div>
          ) : showDaemonStartingPanel ? (
            <div className={styles.daemonStartPanel}>
              <IconLoader size={32} className={styles.spin} style={{ color: 'var(--accent, #22c55e)' }} />
              <div className={styles.daemonStartTitle}>{t('playground.startingDaemon')}</div>
              <div className={styles.daemonStartHint}>
                {t('playground.waitingForDaemon')}
              </div>
            </div>
          ) : null}

          {showChat && (
            <PlaygroundChat
              ref={chatRef}
              model={model || 'fcm'}
              variant="full"
              stream={streamOn}
              disabled={!canSend}
              onTurnComplete={handleTurnComplete}
              suggestions={SUGGESTIONS}
              emptyTitle={t('playground.emptyTitle')}
              emptyHint={t('playground.emptyHint')}
              emptyIcon={<IconMessageChatbot size={42} style={{ opacity: 0.5 }} />}
              placeholder={t('playground.fullPlaceholder')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
