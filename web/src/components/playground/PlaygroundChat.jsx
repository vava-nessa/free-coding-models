/**
 * @file web/src/components/playground/PlaygroundChat.jsx
 * @description The SINGLE shared playground chat core used by all three
 *   playgrounds in the web app:
 *     1. PlaygroundView       (full-screen modal, multi-turn)     — variant="full"
 *     2. RouterView           ("Test Router" section)             — variant="mini"
 *     3. ExpandedDetailRow    ("Mini Playground" column)          — variant="mini"
 *
 * 📖 Why this exists: the three playgrounds used to each ship their own copy
 * 📖 of the input/transcript/SSE-parsing/metadata code, which drifted apart —
 * 📖 ExpandedDetailRow showed NO metadata at all, RouterView showed a partial
 * 📖 badge, and PlaygroundView read body fields (x_routed_via / x_latency_ms)
 * 📖 that the daemon never actually emits, so its chips were dead code. This
 * 📖 component is the single source of truth: identical look + identical
 * 📖 metadata on every surface.
 *
 * 📖 Metadata contract (the thing the user asked to harmonize):
 * 📖   • Under every USER bubble → the addressed model (`provider/model`),
 * 📖     or the router's Primary pick when routing through `fcm`.
 * 📖   • Under every ASSISTANT bubble →
 * 📖       `provider/model · 1234ms · 42 tok · 34.1 t/s`
 * 📖     The served model is read from the response header `x-fcm-router-model`
 * 📖     (forwarded by the daemon for `fcm`); for direct routing the served
 * 📖     model is simply the requested model. Latency is measured client-side
 * 📖     (send → stream end); tokens come from the final chunk's `usage`;
 * 📖     TPS = tokens / (latencyMs / 1000).
 *
 * 📖 All traffic goes through `/api/playground/chat` (the proxy in server.js)
 * 📖 so the browser never touches providers directly (no CORS, no exposed keys).
 *
 * @functions
 *   → PlaygroundChat — self-contained chat core (input + transcript + meta)
 *   → parseModelKey  — split "provider/modelId" into { provider, model }
 *   → extractErrorMessage — normalize OpenAI-style error payloads to a string
 *   → renderAssistantText  — render triple-backtick code blocks without a dep
 */
import {
  useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef,
} from 'react'
import {
  IconSend, IconX, IconCopy, IconCheck, IconBolt, IconClock,
  IconAlertTriangle, IconRefresh, IconLoader,
} from '@tabler/icons-react'
import styles from './PlaygroundChat.module.css'
import { useI18n } from '../../i18n.jsx'

/**
 * Split a "provider/modelId" key into its parts. Returns { provider, model }.
 * Tolerant: "fcm" → { provider: 'fcm', model: '' }; "a/b/c" → provider='a', model='b/c'.
 * @param {string|null|undefined} key
 * @returns {{provider:string, model:string}|null}
 */
function parseModelKey(key) {
  if (!key) return null
  const idx = key.indexOf('/')
  if (idx <= 0) return { provider: key, model: '' }
  return { provider: key.slice(0, idx), model: key.slice(idx + 1) }
}

/**
 * 📖 Normalize an OpenAI-style error body to a plain string. Both shapes are
 * 📖 accepted: `{ error: "msg" }` (custom) and `{ error: { message, type, code } }`
 * 📖 (the OpenAI wire format). Returning a string is critical because React
 * 📖 throws if a non-string sneaks into JSX.
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
 * 📖 Render assistant text with triple-backtick code blocks rendered as <pre>.
 * 📖 No markdown dependency — keeps the dashboard zero-dep. Shared by every
 * 📖 playground so code looks identical everywhere.
 * @param {string} text
 * @returns {React.ReactNode}
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

/** Round to one decimal, returns '—' for non-finite numbers. */
function round1(n) {
  return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : '—'
}

/**
 * Shared playground chat core. See file header.
 *
 * @param {Object} props
 * @param {string} props.model — 'fcm' (auto-router) or 'providerKey/modelId' (direct).
 * @param {boolean} [props.disabled=false] — disable the input + send button (e.g. daemon down).
 * @param {'full'|'mini'} [props.variant='mini'] — density/size of the UI.
 * @param {boolean} [props.stream=true] — request SSE streaming vs. one-shot JSON.
 * @param {string} [props.placeholder] — input placeholder.
 * @param {string} [props.targetLabel] — override the "addressed model" label shown under the
 *   user bubble. The RouterView passes its Primary pick here so the user sees which model the
 *   priority-first router will try first. When omitted, the addressed model is derived from `model`.
 * @param {string[]} [props.suggestions] — clickable chips in the empty state.
 * @param {string} [props.emptyTitle] — empty-state title.
 * @param {string} [props.emptyHint] — empty-state hint line.
 * @param {React.ReactNode} [props.emptyIcon] — empty-state icon.
 * @param {React.ReactNode} [props.children] — optional extra node rendered above the transcript
 *   (used by PlaygroundView to host its daemon-start panel / pre-prompt hint).
 * @param {(summary:{count:number,totalTokens:number,lastMeta?:object}) => void} [props.onTurnComplete]
 *   — fired after every turn so hosts can update their own chrome (token counters, etc.).
 * @param {React.Ref} ref — imperative handle exposing { clear(), focus(), getMessages() }.
 */
const PlaygroundChat = forwardRef(function PlaygroundChat({
  model,
  disabled = false,
  variant = 'mini',
  stream = true,
  placeholder,
  targetLabel,
  suggestions = [],
  emptyTitle,
  emptyHint,
  emptyIcon,
  children,
  onTurnComplete,
}, ref) {
  const { t } = useI18n()
  // 📖 Each message: { id, role, content, target?, meta?, error?, aborted?, pending? }
  // 📖 meta = { provider, model, latencyMs, tokens, tps }
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const abortRef = useRef(null)
  const inputRef = useRef(null)
  const transcriptRef = useRef(null)
  // 📖 Ref mirror of `messages` so the imperative handle (below) can read the
  // 📖 live transcript without being recreated on every message change.
  const messagesRef = useRef([])

  useImperativeHandle(ref, () => ({
    /** Stop any in-flight stream and clear the transcript. */
    clear: () => {
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
      setLoading(false)
      setMessages([])
    },
    focus: () => inputRef.current?.focus(),
    // 📖 `getMessages` is a stable ref read, so the handle never has to be
    // 📖 recreated when messages change.
    getMessages: () => messagesRef.current,
  }), [])

  // 📖 Keep the ref mirror in sync with the state transcript.
  useEffect(() => { messagesRef.current = messages }, [messages])

  // 📖 Notify the host after a turn SETTLES (token counters etc.). Gated on
  // 📖 the last message being finalized (meta / error / aborted) so it doesn't
  // 📖 fire on every streamed token — only once per completed exchange.
  useEffect(() => {
    if (typeof onTurnComplete !== 'function') return
    const last = messages[messages.length - 1]
    if (!last || last.pending) return // still streaming
    const settled = last.role === 'assistant' && (!!last.meta || last.error || last.aborted)
    if (!settled) return
    const totalTokens = messages.reduce((sum, m) => sum + (m.meta?.tokens || 0), 0)
    onTurnComplete({ count: messages.length, totalTokens, lastMeta: last.meta })
  }, [messages, onTurnComplete])

  // 📖 Auto-scroll the transcript to the bottom as content streams in.
  useEffect(() => {
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const stop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setLoading(false)
  }, [])

  const sendMessage = useCallback(async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
    if (!text || loading || disabled) return

    setInput('')

    // 📖 Build the addressed-model label for the USER bubble.
    const targetKey = targetLabel || (model === 'fcm' ? 'fcm' : model)

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text, ts: Date.now(), target: targetKey }
    const assistantId = `a-${Date.now()}`
    const assistantMsg = { id: assistantId, role: 'assistant', content: '', pending: true }
    const transcript = [...messages, userMsg]
    setMessages([...transcript, assistantMsg])
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = Date.now()

    // 📖 Patch helpers: update the in-flight assistant bubble in place.
    const patchAssistant = (patch) => setMessages((prev) => prev.map((m) => (
      m.id === assistantId ? { ...m, ...patch } : m
    )))

    // 📖 Served-model resolution. The daemon (fcm route) forwards the real
    // 📖 served model through the `x-fcm-router-model` response header; for
    // 📖 direct routing there is no such header, so the served model is the
    // 📖 requested one. We resolve the header lazily once we have the resp.
    let servedKey = null
    const resolveServed = (resp) => {
      const headerKey = resp.headers.get('x-fcm-router-model')
      servedKey = headerKey || (model !== 'fcm' ? model : null)
      return parseModelKey(servedKey) || { provider: model, model: '' }
    }

    const body = {
      model: model || 'fcm',
      messages: transcript.map(({ role, content }) => ({ role, content })),
      stream,
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
        const errMsg = extractErrorMessage(errBody) || `Request failed (${resp.status})`
        patchAssistant({ pending: false, error: errMsg })
        return
      }

      if (stream) {
        // ── SSE streaming path ─────────────────────────────────────────
        const reader = resp.body?.getReader()
        if (!reader) throw new Error('No stream reader available')
        const decoder = new TextDecoder()
        let buffer = ''
        let acc = ''
        let served = resolveServed(resp)
        let tokens = 0
        let servedKnown = !!servedKey

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          // 📖 Split on blank-line SSE boundaries; keep the trailing partial.
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
                if (typeof delta === 'string' && delta) {
                  acc += delta
                  patchAssistant({ content: acc, pending: false })
                }
                // 📖 Tokens: the final chunk carries usage. Prefer completion
                // 📖 tokens (matches what was generated) over total.
                const usage = json?.usage
                if (usage) {
                  if (typeof usage.completion_tokens === 'number') tokens = usage.completion_tokens
                  else if (typeof usage.total_tokens === 'number') tokens = usage.total_tokens
                }
                // 📖 Some daemons/proxies also forward the served model in the
                // 📖 body — accept it as a fallback to the header.
                if (!servedKnown && json?.x_routed_via) {
                  served = { provider: json.x_routed_via, model: json.x_routed_model || '' }
                  servedKnown = true
                }
              } catch {
                // 📖 Ignore non-JSON keep-alive frames.
              }
            }
          }
        }

        const latencyMs = Date.now() - startedAt
        const tps = tokens > 0 && latencyMs > 0 ? tokens / (latencyMs / 1000) : null
        patchAssistant({
          pending: false,
          meta: {
            provider: served.provider,
            model: served.model,
            latencyMs,
            tokens,
            tps,
          },
        })
      } else {
        // ── One-shot JSON path ─────────────────────────────────────────
        const json = await resp.json().catch(() => null)
        const content = json?.choices?.[0]?.message?.content || ''
        const usage = json?.usage || {}
        const tokens = typeof usage.completion_tokens === 'number'
          ? usage.completion_tokens
          : (usage.total_tokens || 0)
        const served = resolveServed(resp)
        const latencyMs = Date.now() - startedAt
        const tps = tokens > 0 && latencyMs > 0 ? tokens / (latencyMs / 1000) : null
        patchAssistant({
          pending: false,
          content,
          meta: {
            provider: served.provider,
            model: served.model,
            latencyMs,
            tokens,
            tps,
          },
        })
      }

    } catch (err) {
      if (err?.name === 'AbortError') {
        patchAssistant({ pending: false, aborted: true })
      } else {
        patchAssistant({ pending: false, error: err?.message || String(err) })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, loading, disabled, messages, model, stream, targetLabel, onTurnComplete])

  const handleKeyDown = useCallback((e) => {
    // 📖 Enter sends, Shift+Enter inserts a newline (full variant only).
    if (e.key === 'Enter' && !e.shiftKey && variant === 'full') {
      e.preventDefault()
      void sendMessage()
    } else if (e.key === 'Enter' && variant === 'mini') {
      e.preventDefault()
      void sendMessage()
    }
  }, [sendMessage, variant])

  const copyMessage = useCallback(async (idx, content) => {
    try {
      await navigator.clipboard.writeText(content || '')
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch {}
  }, [])

  // 📖 Tiny auto-grow for the textarea so 'full' expands with long prompts.
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value)
    if (variant === 'full') {
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`
    }
  }, [variant])

  const variantClass = variant === 'full' ? styles.full : styles.mini

  return (
    <div className={`${styles.root} ${variantClass}`}>
      {children}

      <div className={styles.transcript} ref={transcriptRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            {emptyIcon && <div className={styles.emptyIcon}>{emptyIcon}</div>}
            {emptyTitle && <div className={styles.emptyTitle}>{emptyTitle}</div>}
            {emptyHint && <div className={styles.emptyHint}>{emptyHint}</div>}
            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map((s) => (
                  <button key={s} className={styles.chip} onClick={() => void sendMessage(s)} type="button">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={m.id || idx} className={`${styles.message} ${styles[m.role] || ''}`}>
              <div className={styles.bubbleRow}>
                <span className={styles.role}>{m.role}</span>
                {m.role === 'assistant' && m.content && (
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyMessage(idx, m.content)}
                    title={t('playground.copyReply')}
                    type="button"
                  >
                    {copiedIdx === idx ? <IconCheck size={11} /> : <IconCopy size={11} />}
                  </button>
                )}
              </div>

              <div className={styles.bubble}>
                {m.role === 'assistant' ? (
                  <>
                    {m.content ? renderAssistantText(m.content) : null}
                    {loading && idx === messages.length - 1 && m.pending && !m.aborted && (
                      <span className={styles.cursor} />
                    )}
                    {!m.content && m.pending && <span className={styles.typing}>…</span>}
                  </>
                ) : (
                  m.content
                )}
              </div>

              {/* ── Metadata row under the USER bubble: addressed model ── */}
              {m.role === 'user' && m.target && (
                <div className={styles.meta}>
                  <span className={`${styles.metaChip} ${styles.target}`} title={t('playground.addressedModel')}>
                    <IconBolt size={11} />
                    {m.target}
                  </span>
                </div>
              )}

              {/* ── Metadata row under the ASSISTANT bubble: served model + ms + tok + t/s ── */}
              {m.role === 'assistant' && !m.pending && m.meta && (
                <div className={styles.meta}>
                  {m.meta.provider && (
                    <span className={`${styles.metaChip} ${styles.modelChip}`} title={t('playground.servedModel')}>
                      <IconBolt size={11} />
                      {m.meta.provider}{m.meta.model ? `/${m.meta.model}` : ''}
                    </span>
                  )}
                  {m.meta.latencyMs != null && (
                    <span className={`${styles.metaChip} ${styles.latencyChip}`} title={t('playground.responseTime')}>
                      <IconClock size={11} />
                      {Math.round(m.meta.latencyMs)}ms
                    </span>
                  )}
                  {m.meta.tokens > 0 && (
                    <span className={styles.metaChip} title={t('playground.completionTokens')}>
                      {m.meta.tokens} tok
                    </span>
                  )}
                  {m.meta.tps != null && m.meta.tps > 0 && (
                    <span className={`${styles.metaChip} ${styles.tpsChip}`} title={t('playground.tokensPerSecond')}>
                      <IconRefresh size={11} />
                      {round1(m.meta.tps)} t/s
                    </span>
                  )}
                </div>
              )}

              {m.role === 'assistant' && m.error && (
                <div className={styles.meta}>
                  <span className={`${styles.metaChip} ${styles.errorChip}`} title="Error">
                    <IconAlertTriangle size={11} />
                    {m.error}
                  </span>
                </div>
              )}
              {m.role === 'assistant' && m.aborted && !m.error && (
                <div className={styles.meta}>
                    <span className={styles.metaChip}>{t('playground.stopped')}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.inputBar}>
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder || (variant === 'full'
            ? t('playground.fullPlaceholder')
            : t('playground.miniPlaceholder'))}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        {loading ? (
          <button className={styles.stopBtn} onClick={stop} title={t('playground.stopGenerating')} type="button">
            <IconLoader size={14} className={styles.spin} />
            {variant === 'full' ? t('playground.stop') : ''}
          </button>
        ) : (
          <button
            className={styles.sendBtn}
            onClick={() => void sendMessage()}
            disabled={disabled || !input.trim()}
            title={t('playground.send')}
            type="button"
          >
            <IconSend size={14} />
            {variant === 'full' ? t('playground.send') : ''}
          </button>
        )}
      </div>
    </div>
  )
})

export default PlaygroundChat
