/**
 * @file web/src/components/playground/PlaygroundView.jsx
 * @description Playground chat modal — multi-turn chat through the FCM
 * router. Streams responses, shows the routed-via provider/model on each
 * assistant message, and exposes the configured pre-prompt inline so the
 * user knows what the system says about itself.
 *
 * 📖 All traffic goes through `/api/playground/chat` (a thin proxy in
 * 📖 `web/server.js`) so the browser never talks to the daemon directly
 * 📖 (no CORS, no exposed provider keys).
 *
 * @functions
 *   → PlaygroundView — full-screen chat modal with streaming + metadata
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  IconMessageChatbot,
  IconX,
  IconSend,
  IconTrash,
  IconBolt,
  IconRefresh,
  IconAlertTriangle,
  IconCopy,
  IconCheck,
  IconPlayerPlay,
  IconLoader,
} from '@tabler/icons-react'
import styles from './PlaygroundView.module.css'

const SUGGESTIONS = [
  'Write a Python fizzbuzz with type hints',
  'Explain Big O notation with three examples',
  'Refactor a deeply nested for-loop into map/filter',
  'Write a tiny Express endpoint that returns JSON',
]

/**
 * 📖 Extract a human-readable message from an OpenAI-style error payload.
 * 📖 Both shapes are accepted: `{ error: "string" }` (custom errors) and
 * 📖 `{ error: { message, type, code } }` (the OpenAI wire format used by
 * 📖 the FCM router daemon and every upstream provider).
 *
 * 📖 Returning a string is critical: the playground renders the error
 * 📖 directly inside JSX, and React throws if a non-string child shows up
 * 📖 — which is exactly the bug that was happening when the router was
 * 📖 down and replied with `{ error: { message, type, code, ... } }`.
 *
 * @param {unknown} errBody
 * @returns {string|null}
 */
function extractErrorMessage(errBody) {
  if (!errBody || typeof errBody !== 'object') {
    return typeof errBody === 'string' ? errBody : null
  }
  if (typeof errBody.error === 'string') return errBody.error
  if (errBody.error && typeof errBody.error === 'object' && typeof errBody.error.message === 'string') {
    return errBody.error.message
  }
  if (typeof errBody.message === 'string') return errBody.message
  return null
}

/**
 * 📖 Pretty-print the assistant text. Renders triple-backtick code blocks as
 * 📖 <pre> blocks; falls back to plain text otherwise. We do not pull in a
 * 📖 markdown library to keep the dashboard zero-dep.
 */
function renderAssistantText(text) {
  if (!text) return null
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, idx) => {
    const codeMatch = part.match(/^```([a-zA-Z0-9_-]+)?\n?([\s\S]*?)```$/)
    if (codeMatch) {
      return (
        <pre key={idx} className={styles.codeBlock}>
          <code>{codeMatch[2].replace(/\n$/, '')}</code>
        </pre>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

function MetaChip({ icon, label, tone }) {
  return (
    <span className={`${styles.metaChip} ${tone ? styles[tone] : ''}`}>
      {icon}
      {label}
    </span>
  )
}

function StatusPill({ routerStatus, daemonRunning }) {
  // 📖 Prefer the live daemon state over the stale prop.
  if (daemonRunning === true) {
    return (
      <span className={styles.metaChip}>
        <IconBolt size={11} />
        Router online
      </span>
    )
  }
  if (daemonRunning === false) {
    return (
      <span className={`${styles.metaChip} ${styles.error}`}>
        <IconAlertTriangle size={11} />
        Router offline
      </span>
    )
  }
  // null = checking...
  return (
    <span className={styles.metaChip}>
      <IconLoader size={11} className={styles.spin} />
      Checking router…
    </span>
  )
}

export default function PlaygroundView({ onClose, onToast, models, routerStatus }) {
  const [messages, setMessages] = useState([]) // { role, content, meta? }
  const [input, setInput] = useState('')
  const [model, setModel] = useState(null) // null = computing best model
  const [streamOn, setStreamOn] = useState(true)
  const [prePromptEnabled, setPrePromptEnabled] = useState(true)
  const [prePromptText, setPrePromptText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const abortRef = useRef(null)
  const transcriptRef = useRef(null)

  // 📖 Daemon state: null = checking, true = running, false = down
  const [daemonRunning, setDaemonRunning] = useState(
    routerStatus?.running === true ? true : null
  )
  const [daemonStarting, setDaemonStarting] = useState(false)
  const [autoStartSec, setAutoStartSec] = useState(5)
  const cooldownRef = useRef(null)
  const daemonCheckRef = useRef(null)
  const autoStartTriggered = useRef(false)

  // 📖 Fetch the pre-prompt once on mount so the toggle shows the real
  // 📖 value and the indicator matches what the router will inject.
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

  // 📖 Smart model selection on mount: pick the best "up" model with
  // 📖 an API key, preferring lower latency and higher tier. Falls back
  // 📖 to "fcm" (the auto-router) only if the daemon is already running
  // 📖 or no working model is found. This ensures the playground works
  // 📖 immediately on open, even without the router daemon.
  useEffect(() => {
    if (model !== null) return // already resolved
    const upModels = (Array.isArray(models) ? models : [])
      .filter((m) => m.status === 'up' && m.hasApiKey && !m.isPinging)

    if (upModels.length > 0) {
      // 📖 Sort: best tier first (S+ > S > A+ ...), then lowest avg latency
      const tierOrder = { 'S+': 0, 'S': 1, 'A+': 2, 'A': 3, 'A-': 4, 'B+': 5, 'B': 6, 'C': 7 }
      upModels.sort((a, b) => {
        const ta = tierOrder[a.tier] ?? 99
        const tb = tierOrder[b.tier] ?? 99
        if (ta !== tb) return ta - tb
        const avgA = typeof a.avg === 'number' ? a.avg : 99999
        const avgB = typeof b.avg === 'number' ? b.avg : 99999
        return avgA - avgB
      })
      const best = upModels[0]
      setModel(`${best.providerKey}/${best.modelId}`)
      return
    }

    // 📖 No working model found — if daemon is running, use fcm
    if (routerStatus?.running || daemonRunning === true) {
      setModel('fcm')
      return
    }

    // 📖 Nothing works — default to fcm anyway (will show daemon start panel)
    setModel('fcm')
  }, [models, model, routerStatus, daemonRunning])

  // 📖 Check daemon status on mount. If the daemon is down AND the user
  // 📖 is on the "fcm" auto-router model, start a 5-second countdown to
  // 📖 auto-start the daemon. The "Start Router" button is always
  // 📖 clickable so the user can trigger it manually at any time.
  useEffect(() => {
    let mounted = true

    async function checkDaemon() {
      try {
        const resp = await fetch('/api/router/status')
        const data = await resp.json()
        if (!mounted) return
        if (data?.running) {
          setDaemonRunning(true)
          return
        }
        setDaemonRunning(false)
      } catch {
        if (mounted) setDaemonRunning(false)
      }
    }

    checkDaemon()

    return () => {
      mounted = false
      if (cooldownRef.current) clearInterval(cooldownRef.current)
      if (daemonCheckRef.current) clearInterval(daemonCheckRef.current)
    }
  }, [])

  // 📖 Auto-start the daemon after 5 seconds if: daemon is down, model
  // 📖 is "fcm" (auto-router), and auto-start hasn't been triggered yet.
  // 📖 Countdown ticks every second and shows remaining time on the button.
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
  }, [daemonRunning, model])

  // 📖 Start the router daemon from the playground. After starting,
  // 📖 polls every 1s to detect when the daemon is ready, then
  // 📖 updates the UI so the user can chat immediately.
  const startDaemon = useCallback(async () => {
    if (daemonStarting) return
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null }
    autoStartTriggered.current = true
    setDaemonStarting(true)
    try {
      await fetch('/api/router/start', { method: 'POST' })
      // 📖 Poll until the daemon is confirmed running (max 30s)
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

  // 📖 Auto-scroll the transcript on new content.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isLoading])

  // 📖 Stable list of model identifiers for the dropdown — defaults to
  // 📖 `fcm` (the auto-router) and lets the user pin a specific catalog
  // 📖 entry if they want a manual target.
  const modelOptions = useMemo(() => {
    const opts = [{ value: 'fcm', label: 'fcm — auto router (recommended)' }]
    if (Array.isArray(models)) {
      for (const m of models.slice(0, 200)) {
        const id = m.modelId || m.id
        if (!id) continue
        const label = m.label || id
        opts.push({ value: `${m.providerKey}/${id}`, label: `${m.providerKey}/${id} (${label})` })
      }
    }
    return opts
  }, [models])

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsLoading(false)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    const isFcm = model === 'fcm'
    if (isFcm && daemonRunning !== true) {
      setError('Router daemon is not running. Start it first using the button above or run `free-coding-models --daemon-bg`.')
      return
    }
    setError(null)
    setInput('')

    // 📖 Build the local transcript. We do NOT prepend the pre-prompt here
    // 📖 because the router injects it server-side. We just send the user
    // 📖 turn and let the daemon stamp the persona.
    const userMessage = { role: 'user', content: text, ts: Date.now() }
    const transcript = [...messages, userMessage]
    setMessages(transcript)
    setIsLoading(true)

    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', ts: Date.now() }])

    const controller = new AbortController()
    abortRef.current = controller

    const body = {
      model: model || 'fcm',
      messages: transcript.map(({ role, content }) => ({ role, content })),
      stream: streamOn,
      temperature: 0.7,
    }

    try {
      const resp = await fetch('/api/playground/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null)
        const errMsg = extractErrorMessage(errBody) || `Request failed with status ${resp.status}`
        setError(errMsg)
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId
            ? { ...m, content: m.content, error: errMsg, aborted: true }
            : m
        )))
        setIsLoading(false)
        return
      }

      if (streamOn) {
        // 📖 Read SSE chunks from the proxy. Each chunk may carry several
        // 📖 OpenAI-style "data: ..." lines; we only care about the delta
        // 📖 content and the final routed-via metadata.
        const reader = resp.body?.getReader()
        if (!reader) throw new Error('No stream reader available')
        const decoder = new TextDecoder()
        let buffer = ''
        const routed = {
          provider: null,
          model: null,
          latencyMs: null,
          tokens: 0,
          fallbackAttempts: 0,
        }
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          // 📖 Split on blank-line SSE boundaries.
          const events = buffer.split(/\n\n/)
          buffer = events.pop() || ''
          for (const event of events) {
            const lines = event.split(/\n/)
            for (const line of lines) {
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (payload === '[DONE]') continue
              try {
                const json = JSON.parse(payload)
                const delta = json?.choices?.[0]?.delta?.content
                if (delta) {
                  setMessages((prev) => prev.map((m) => (
                    m.id === assistantId ? { ...m, content: (m.content || '') + delta } : m
                  )))
                }
                if (json?.x_routed_via) routed.provider = json.x_routed_via
                if (json?.x_routed_model) routed.model = json.x_routed_model
                if (json?.x_latency_ms) routed.latencyMs = json.x_latency_ms
                if (json?.x_fallback_attempts) routed.fallbackAttempts = json.x_fallback_attempts
                if (json?.usage?.total_tokens) routed.tokens = json.usage.total_tokens
              } catch {
                // 📖 Ignore non-JSON keep-alive frames.
              }
            }
          }
        }
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, meta: routed } : m
        )))
      } else {
        // 📖 Non-streaming: wait for the full JSON response and append.
        const json = await resp.json()
        const content = json?.choices?.[0]?.message?.content || ''
        const usage = json?.usage || {}
        const routed = {
          provider: json?.x_routed_via || null,
          model: json?.x_routed_model || null,
          latencyMs: json?.x_latency_ms || null,
          tokens: usage?.total_tokens || 0,
          fallbackAttempts: json?.x_fallback_attempts || 0,
        }
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, content, meta: routed } : m
        )))
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, aborted: true } : m
        )))
      } else {
        setError(err.message || String(err))
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, error: err.message || String(err), aborted: true } : m
        )))
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [input, isLoading, messages, model, streamOn, daemonRunning])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }, [sendMessage])

  const clearTranscript = useCallback(() => {
    if (isLoading) stopStream()
    setMessages([])
    setError(null)
  }, [isLoading, stopStream])

  const copyMessage = useCallback(async (idx, content) => {
    try {
      await navigator.clipboard.writeText(content || '')
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch {
      onToast?.('Copy failed', 'error')
    }
  }, [onToast])

  const totalTokens = useMemo(
    () => messages.reduce((sum, m) => sum + (m.meta?.tokens || 0), 0),
    [messages]
  )

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-label="Free Coding Models Playground">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerTitle}>
              <IconMessageChatbot size={18} />
              Playground
            </div>
            <div className={styles.headerSubtitle}>
              Chat with the FCM router · {messages.length} message{messages.length === 1 ? '' : 's'} · {totalTokens} tokens
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.iconBtn}
              onClick={clearTranscript}
              title="Clear conversation"
              disabled={messages.length === 0 && !isLoading}
            >
              <IconTrash size={16} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={onClose}
              title="Close (Esc)"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        <div className={styles.modelBar}>
          <span className={styles.modelLabel}>Model:</span>
          <select
            className={styles.modelSelect}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isLoading}
          >
            {modelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            className={styles.presetChip}
            onClick={() => setStreamOn((v) => !v)}
            title="Toggle streaming"
          >
            {streamOn ? '⚡ Streaming' : '🐢 One-shot'}
          </button>
          <label className={styles.prePromptToggle} title="Router persona injected as the first system message">
            <input
              type="checkbox"
              checked={prePromptEnabled}
              onChange={(e) => setPrePromptEnabled(e.target.checked)}
            />
            Pre-prompt
          </label>
          <StatusPill routerStatus={routerStatus} daemonRunning={daemonRunning} />
        </div>

        {prePromptEnabled && prePromptText && (
          <div className={styles.modelBar} style={{ borderTop: 'none', background: 'transparent', paddingTop: 4, paddingBottom: 8, fontSize: 11 }}>
            <span className={styles.modelLabel} style={{ flexShrink: 0 }}>Persona:</span>
            <span style={{ opacity: 0.7, fontStyle: 'italic' }}>
              {prePromptText.length > 160 ? `${prePromptText.slice(0, 160)}…` : prePromptText}
            </span>
          </div>
        )}

        <div className={styles.transcript} ref={transcriptRef}>
          {daemonRunning === false && !daemonStarting && messages.length === 0 && model === 'fcm' ? (
            <div className={styles.daemonStartPanel}>
              <IconAlertTriangle size={32} style={{ color: '#fbbf24', opacity: 0.8 }} />
              <div className={styles.daemonStartTitle}>Router daemon is not running</div>
              <div className={styles.daemonStartHint}>
                The playground routes your chats through the FCM router daemon. Start it to begin chatting with free coding models, or pick a specific model above.
              </div>
              <button
                className={styles.daemonStartBtn}
                onClick={startDaemon}
                title="Start the router daemon"
              >
                {daemonStarting ? (
                  <><IconLoader size={14} className={styles.spin} /> Starting…</>
                ) : (
                  <><IconPlayerPlay size={14} /> Start Router{autoStartSec > 0 && !autoStartTriggered.current ? ` (auto in ${autoStartSec}s)` : ''}</>
                )}
              </button>
              <div className={styles.daemonStartAlt}>
                Or run <code>free-coding-models --daemon-bg</code> in your terminal
              </div>
            </div>
          ) : daemonStarting && messages.length === 0 && model === 'fcm' ? (
            <div className={styles.daemonStartPanel}>
              <IconLoader size={32} className={styles.spin} style={{ color: 'var(--accent, #22c55e)' }} />
              <div className={styles.daemonStartTitle}>Starting router daemon…</div>
              <div className={styles.daemonStartHint}>
                The daemon is being launched. This usually takes a few seconds. You'll be able to chat as soon as it's ready.
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.empty}>
              <IconMessageChatbot size={42} style={{ opacity: 0.5 }} />
              <div className={styles.emptyTitle}>Try the FCM router in 10 seconds</div>
              <div className={styles.emptyHint}>
                Each request is auto-routed to the healthiest free coding model in your active set.
                The pre-prompt is injected server-side, so even plain <code>curl</code> callers get the same persona.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className={styles.presetChip}
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={m.id || idx} className={`${styles.message} ${styles[m.role] || ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className={styles.messageRole}>{m.role}</div>
                  {m.role === 'assistant' && m.content && (
                    <button
                      className={styles.iconBtn}
                      style={{ padding: 2, border: 'none' }}
                      onClick={() => copyMessage(idx, m.content)}
                      title="Copy reply"
                    >
                      {copiedIdx === idx ? <IconCheck size={11} /> : <IconCopy size={11} />}
                    </button>
                  )}
                </div>
                <div className={styles.bubble}>
                  {m.role === 'assistant' ? (
                    <>
                      {renderAssistantText(m.content)}
                      {isLoading && idx === messages.length - 1 && !m.aborted && (
                        <span className={styles.cursor} />
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === 'assistant' && m.meta && (m.meta.provider || m.meta.model) && (
                  <div className={styles.meta}>
                    {m.meta.provider && (
                      <MetaChip
                        icon={<IconBolt size={11} />}
                        label={`routed via ${m.meta.provider}/${m.meta.model || '?'}`}
                        tone="provider"
                      />
                    )}
                    {m.meta.latencyMs != null && (
                      <MetaChip label={`${m.meta.latencyMs} ms`} />
                    )}
                    {m.meta.tokens > 0 && (
                      <MetaChip label={`${m.meta.tokens} tok`} />
                    )}
                    {m.meta.fallbackAttempts > 0 && (
                      <MetaChip
                        icon={<IconRefresh size={11} />}
                        label={`${m.meta.fallbackAttempts} fallback${m.meta.fallbackAttempts > 1 ? 's' : ''}`}
                      />
                    )}
                  </div>
                )}
                {m.role === 'assistant' && m.error && (
                  <div className={styles.meta}>
                    <MetaChip
                      icon={<IconAlertTriangle size={11} />}
                      label={m.error}
                      tone="error"
                    />
                  </div>
                )}
                {m.role === 'assistant' && m.aborted && !m.error && (
                  <div className={styles.meta}>
                    <MetaChip label="stopped" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {error && (
          <div className={styles.errorBar}>
            <IconAlertTriangle size={14} />
            {error}
          </div>
        )}

        {isLoading && (
          <div className={styles.stopBar}>
            <span>Streaming response…</span>
            <button className={styles.stopBtn} onClick={stopStream}>
              Stop
            </button>
          </div>
        )}

        <div className={styles.inputBar}>
          <textarea
            className={styles.textarea}
            placeholder="Ask the FCM router anything. Enter to send, Shift+Enter for newline."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || (model === 'fcm' && daemonRunning !== true)}
            rows={1}
            data-testid="playground-input"
          />
          <button
            className={styles.sendBtn}
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || (model === 'fcm' && daemonRunning !== true)}
            data-testid="playground-send"
          >
            <IconSend size={14} />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
