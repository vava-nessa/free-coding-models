/**
 * @file model-config.js
 * @description Shared agent model-safety helpers (context + token budgets).
 *
 * @details
 *   Coding agents (Pi, OpenCode, …) send a real agent prompt with system
 *   instructions, tool schemas, and compaction metadata. A model can pass a
 *   tiny `hi` ping or AI latency benchmark but still be unusable if its context
 *   is only 8k. These helpers centralize the agent model policy so every FCM
 *   adapter applies identical rules: context parsing, a safe completion cap, a
 *   minimum-context filter, and the OpenAI-compatible reasoning flag.
 *
 * @functions
 *   - parseContextWindow → Convert FCM context labels like `8k` or `1M` to numbers
 *   - getMaxTokens → Pick a completion cap that leaves prompt room
 *   - isContextUsable → Hide models too small for agent sessions
 *   - getReasoningFlag → Keep OpenAI-compatible FCM models in non-thinking mode
 */

export const DEFAULT_CONTEXT_WINDOW = 128000

/**
 * 📖 Minimum context window an agent session can realistically use. Below this,
 * 📖 the system prompt + tool schemas alone overflow the model.
 */
export const MIN_CONTEXT_WINDOW = 16000

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
 * 📖 Agents need room for both prompt/tool schemas and the answer. A max output
 * 📖 equal to the whole context window makes 8k providers instantly overflow,
 * 📖 so cap completions to a conservative slice of the context.
 *
 * @param {number} contextWindow - Parsed context window in tokens
 * @returns {number} Safe max output tokens
 */
export function getMaxTokens(contextWindow) {
  const safeContext = Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : DEFAULT_CONTEXT_WINDOW
  const quarterContext = Math.floor(safeContext * 0.25)
  return Math.max(512, Math.min(8192, quarterContext))
}

/**
 * 📖 Tiny-context models can pass direct API probes but fail an agent session
 * 📖 immediately because the agent prompt itself is too large. Hide them.
 *
 * @param {object} model - FCM scanned model payload
 * @param {number} [minWindow=MIN_CONTEXT_WINDOW] - Configurable floor
 * @returns {boolean} Whether the model has enough context for agent sessions
 */
export function isContextUsable(model, minWindow = MIN_CONTEXT_WINDOW) {
  const contextWindow = parseContextWindow(model?.ctxWindow ?? model?.ctx)
  return contextWindow >= minWindow
}

/**
 * 📖 FCM providers are OpenAI-compatible gateways, not native reasoning
 * 📖 integrations. `reasoning: true` can make an agent send incompatible
 * 📖 thinking controls, especially to Cerebras/Groq/Mistral. Keep it disabled.
 *
 * @returns {false} Reasoning flag for FCM-managed models
 */
export function getReasoningFlag() {
  return false
}
