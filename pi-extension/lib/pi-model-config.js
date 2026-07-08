/**
 * @file pi-model-config.js
 * @description Shared Pi model safety helpers for FCM provider registration.
 *
 * @details
 *   Pi sends a real agent prompt with system instructions, tool schemas, and
 *   recovery compaction metadata. A model can pass a tiny `hi` ping or AI
 *   latency benchmark but still be unusable for Pi if its context is only 8k.
 *   These helpers centralize the Pi-specific safety policy so runtime provider
 *   registration and disk config writes stay identical.
 *
 * @functions
 *   - parseContextWindow → Convert FCM context labels like `8k` or `1M` to numbers
 *   - getPiMaxTokens → Pick a completion cap that leaves prompt room
 *   - isPiContextUsable → Hide models too small for Pi agent sessions
 *   - getPiReasoningFlag → Keep OpenAI-compatible FCM models in non-thinking mode
 *
 * @exports parseContextWindow, getPiMaxTokens, isPiContextUsable, getPiReasoningFlag, MIN_PI_CONTEXT_WINDOW
 */

export const DEFAULT_CONTEXT_WINDOW = 128000
export const MIN_PI_CONTEXT_WINDOW = 16000

/**
 * 📖 Convert a catalog context value into a numeric token window.
 *
 * @param {string|number|null|undefined} ctx - Context value from FCM metadata
 * @returns {number} Parsed context window in tokens
 */
export function parseContextWindow(ctx) {
  if (typeof ctx === 'number' && Number.isFinite(ctx) && ctx > 0) return Math.round(ctx)
  if (typeof ctx !== 'string' || !ctx.trim()) return DEFAULT_CONTEXT_WINDOW

  const trimmed = ctx.trim().toLowerCase()
  const multiplier = trimmed.endsWith('m') ? 1_000_000 : trimmed.endsWith('k') ? 1_000 : 1
  const numeric = Number.parseFloat(trimmed.replace(/[mk]$/i, ''))
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_CONTEXT_WINDOW
  return Math.round(numeric * multiplier)
}

/**
 * 📖 Pi needs enough room for both prompt/tool schemas and the answer. A max
 * 📖 output equal to the whole context window makes 8k providers instantly
 * 📖 overflow, so cap completions to a conservative slice of the context.
 *
 * @param {number} contextWindow - Parsed context window in tokens
 * @returns {number} Safe max output tokens for Pi
 */
export function getPiMaxTokens(contextWindow) {
  const safeContext = Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : DEFAULT_CONTEXT_WINDOW
  const quarterContext = Math.floor(safeContext * 0.25)
  return Math.max(512, Math.min(8192, quarterContext))
}

/**
 * 📖 Tiny-context models can pass direct API probes but fail Pi immediately
 * 📖 because the agent prompt itself is too large. Hide them from Pi pickers.
 *
 * @param {object} model - FCM scanned model payload
 * @returns {boolean} Whether the model has enough context for Pi sessions
 */
export function isPiContextUsable(model) {
  const contextWindow = parseContextWindow(model?.ctxWindow ?? model?.ctx)
  return contextWindow >= MIN_PI_CONTEXT_WINDOW
}

/**
 * 📖 FCM providers are OpenAI-compatible gateways, not native Pi reasoning
 * 📖 integrations. `reasoning: true` can make Pi send incompatible thinking
 * 📖 controls, especially to Cerebras/Groq/Mistral. Keep it disabled.
 *
 * @returns {false} Pi reasoning flag for FCM-managed models
 */
export function getPiReasoningFlag() {
  return false
}
