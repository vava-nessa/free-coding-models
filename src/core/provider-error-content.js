/**
 * @file provider-error-content.js
 * @description Detect provider billing/account notices that arrive as the
 * CONTENT of an HTTP 200 completion instead of as an error status.
 *
 * @details
 *   📖 Free gateways sometimes answer `200 OK` with their billing notice as
 *   the assistant message. Two consumers care, and they must agree on what the
 *   notice looks like:
 *   1. The probe path (`src/core/ping.js`, issue #190): turning a fake-healthy
 *      200 into a 402 so the TUI row shows a failure.
 *   2. The router path (issue #209): a credits notice forwarded as the model
 *      answer ends up in the user's chat, and the circuit breaker, autoHeal and
 *      family failover never fire because the request "succeeded".
 *
 *   📖 Why a provider-scoped table instead of one global keyword list: a real
 *   model legitimately writes sentences like "not enough credits" when the user
 *   asks about billing code. Sniffing every provider would corrupt genuine
 *   answers. Only providers documented to leak their billing text belong here.
 *
 *   📖 Two strictness levels, because the cost of a false positive differs:
 *   - `loose`: any historical marker fragment (used by ping/probes, where a
 *     false 402 only hides a model for one probe cycle).
 *   - `strict` (default for callers that must not corrupt answers): the message
 *     must READ like a notice, i.e. start with a known notice prefix after
 *     stripping leading quotes/markdown, or contain an unambiguous provider
 *     billing phrase in a short message. The router uses this mode.
 *
 * @functions
 *   → detectProviderErrorContent(providerKey, content, opts) - Classify content
 *     as a provider notice; returns { detected, code, marker, pending }
 *   → hasProviderErrorContentRules(providerKey) - Whether a provider is sniffed
 *   → extractCompletionContent(payload) - First assistant text of a 200 body
 *   → detectProviderErrorContentInPayload(providerKey, payload, opts) - Same,
 *     from a parsed chat-completion payload
 *
 * @exports PROVIDER_ERROR_CODES, PROVIDER_ERROR_CONTENT_RULES,
 *          detectProviderErrorContent, hasProviderErrorContentRules,
 *          extractCompletionContent, detectProviderErrorContentInPayload
 *
 * @see {@link ./ping.js} probe-side consumer (issue #190)
 * @see {@link ./router-daemon.js} router-side consumer (issue #209)
 */

/**
 * 📖 Stable error code surfaced to API clients when a provider reports an
 * exhausted account. Kept provider-agnostic so tools can branch on one value.
 */
export const PROVIDER_ERROR_CODES = Object.freeze({
  CREDIT_EXHAUSTED: 'provider_credit_exhausted',
})

/**
 * 📖 Per-provider notice rules.
 *   - noticePrefixes: the first words of the whole assistant message. Matched
 *     after leading quotes, markdown bullets and whitespace are stripped.
 *   - billingPhrases: phrases that only appear in a provider billing notice.
 *   - looseMarkers: historical fragments kept for probe compatibility.
 *   - maxNoticeChars: a notice is short; longer content is treated as a real
 *     answer that merely mentions the words.
 */
export const PROVIDER_ERROR_CONTENT_RULES = Object.freeze({
  pollinations: Object.freeze({
    code: PROVIDER_ERROR_CODES.CREDIT_EXHAUSTED,
    // 📖 Observed on gen.pollinations.ai: "The account behind this API key
    // 📖 doesn't have enough credits. Please top up ..." (issue #209).
    noticePrefixes: Object.freeze([
      'the account behind this api key',
      'not enough credits',
      'no credits left',
      'insufficient pollen',
      'you do not have enough pollen',
    ]),
    billingPhrases: Object.freeze([
      'needs paid pollen',
    ]),
    looseMarkers: Object.freeze([
      'have enough credits',
      'needs paid pollen',
    ]),
    maxNoticeChars: 400,
  }),
})

const DEFAULT_MAX_NOTICE_CHARS = 400
// 📖 Shortest partial fragment worth holding a stream for: a few characters of
// an answer are not enough to guess, and holding every stream for "The" would
// add pointless latency to normal traffic.
const MIN_PENDING_CHARS = 6
const NO_MATCH = Object.freeze({ detected: false, code: null, marker: null, pending: false })

/**
 * 📖 Strip the cosmetics providers put in front of a notice ("**", ">",
 * quotes, list bullets) so a prefix match works on `> "The account behind..."`.
 * @param {string} text
 * @returns {string}
 */
function normalizeNoticeStart(text) {
  return text.trimStart().replace(/^[>"'`*_\-\s]+/, '').toLowerCase()
}

/**
 * 📖 Normalize the whole message for phrase matching: lowercase and collapse
 * whitespace so line-wrapped notices still match.
 * @param {string} text
 * @returns {string}
 */
function normalizeNoticeBody(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * 📖 True when the text currently ENDS with a prefix of one of the phrases.
 * Used while streaming: the notice may arrive in several deltas, so the router
 * must hold the buffer until the phrase either completes or proves harmless.
 * @param {string} body - normalized accumulated text
 * @param {readonly string[]} phrases
 * @returns {boolean}
 */
function endsWithPartialPhrase(body, phrases) {
  const maxTail = Math.max(...phrases.map((phrase) => phrase.length)) - 1
  const tail = body.slice(-Math.max(maxTail, MIN_PENDING_CHARS))
  if (tail.length < MIN_PENDING_CHARS) return false
  for (let size = Math.min(tail.length, maxTail); size >= MIN_PENDING_CHARS; size -= 1) {
    const slice = tail.slice(-size)
    if (phrases.some((phrase) => phrase.startsWith(slice))) return true
  }
  return false
}

/**
 * 📖 True when this provider has notice rules at all. Lets hot paths (the ping
 * loop clones + parses every 200 body) skip the work for the 24 providers that
 * never leak billing text.
 * @param {string} providerKey
 * @returns {boolean}
 */
export function hasProviderErrorContentRules(providerKey) {
  return typeof providerKey === 'string' && Object.hasOwn(PROVIDER_ERROR_CONTENT_RULES, providerKey)
}

/**
 * 📖 Classify a completion text as a provider error notice.
 *
 * @param {string} providerKey - provider key as used in `sources.js`
 * @param {string} content - assistant message text from the upstream 200 body
 * @param {{ mode?: 'strict'|'loose' }} [opts]
 *   - strict (default): the text must read like a notice (prefix or billing
 *     phrase, short message). Safe for user-facing routing.
 *   - loose: any loose marker fragment. Kept for probe compatibility.
 * @returns {{ detected: boolean, code: string|null, marker: string|null, pending: boolean }}
 *   `pending` is strict-mode only: the text so far could still turn into a
 *   notice (a streamed message split mid-notice). Callers that buffer should
 *   hold one more delta instead of forwarding.
 */
export function detectProviderErrorContent(providerKey, content, { mode = 'strict' } = {}) {
  if (typeof providerKey !== 'string' || typeof content !== 'string') return NO_MATCH
  if (!hasProviderErrorContentRules(providerKey)) return NO_MATCH
  const rule = PROVIDER_ERROR_CONTENT_RULES[providerKey]
  const trimmed = content.trim()
  if (trimmed.length === 0) return NO_MATCH

  if (mode === 'loose') {
    const body = normalizeNoticeBody(trimmed)
    const marker = rule.looseMarkers.find((fragment) => body.includes(fragment))
    return marker ? { detected: true, code: rule.code, marker, pending: false } : NO_MATCH
  }

  const maxChars = rule.maxNoticeChars || DEFAULT_MAX_NOTICE_CHARS
  const start = normalizeNoticeStart(trimmed)
  // 📖 A notice PREFIX is definitive regardless of length: the provider may add
  // long top-up instructions after its opening sentence.
  const prefix = rule.noticePrefixes.find((candidate) => start.startsWith(candidate))
  if (prefix) return { detected: true, code: rule.code, marker: prefix, pending: false }

  // 📖 The phrase heuristics and the pending hold only make sense on short
  // messages: a long answer that quotes a notice is a real answer.
  if (trimmed.length > maxChars) return NO_MATCH

  const body = normalizeNoticeBody(trimmed)
  const phrase = rule.billingPhrases.find((candidate) => body.includes(candidate))
  if (phrase) return { detected: true, code: rule.code, marker: phrase, pending: false }

  // 📖 Still undecided: hold the stream only when the text could plausibly
  // become a notice with one more delta.
  const pendingPrefix = start.length > 0
    && rule.noticePrefixes.some((candidate) => candidate.startsWith(start))
  const pendingPhrase = endsWithPartialPhrase(body, rule.billingPhrases)
  const pending = pendingPrefix || pendingPhrase
  return pending
    ? { detected: false, code: rule.code, marker: null, pending: true }
    : NO_MATCH
}

/**
 * 📖 Extract the first assistant text from a parsed chat-completion payload.
 * Returns '' for tool-call / empty / non-string content so callers can pass the
 * result straight to the detector.
 * @param {unknown} payload
 * @returns {string}
 */
export function extractCompletionContent(payload) {
  const content = payload?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}

/**
 * 📖 Convenience wrapper for non-streaming 200 bodies.
 * @param {string} providerKey
 * @param {unknown} payload
 * @param {{ mode?: 'strict'|'loose' }} [opts]
 * @returns {{ detected: boolean, code: string|null, marker: string|null, pending: boolean }}
 */
export function detectProviderErrorContentInPayload(providerKey, payload, opts = {}) {
  return detectProviderErrorContent(providerKey, extractCompletionContent(payload), opts)
}
