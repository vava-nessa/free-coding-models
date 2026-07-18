/**
 * @file ranker.js
 * @description Composite ranking + scoring for free coding models (shared core).
 *
 * @details
 *   Scores models with a composite of SWE-bench (60%), latency (20%),
 *   throughput/TPS (10%), and stability/health (10%), then filters to reachable,
 *   keyed models and sorts by score. Also exposes a plain-text menu formatter
 *   (no ANSI/chalk — adapters own colour rendering).
 *
 * @functions
 *   - parseSweScore → Turn '72.0%' / '-' into a number
 *   - computeCompositeScore → 0..1 score for one model
 *   - rankModels → Filter 'up'+keyed, score, sort
 *   - formatModelLine → Plain-text rank line for menus
 */

/**
 * 📖 Parse a SWE-bench percentage string into a float.
 *
 * @param {string} sweStr - SWE score (e.g., '72.0%' or '-')
 * @returns {number} Float representation of percentage (0 to 100)
 */
export function parseSweScore(sweStr) {
  if (!sweStr || sweStr === '-') return 0
  const cleaned = sweStr.replace('%', '').trim()
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * 📖 Compute a composite score (0-1) for a scanned model.
 * 📖 Gives high weight to SWE-bench (coding intelligence) and penalizes latency/jitters.
 *
 * @param {object} model - The model record
 * @returns {number} Score from 0 to 1
 */
export function computeCompositeScore(model) {
  const sweWeight = 0.60
  const latWeight = 0.20
  const tpsWeight = 0.10
  const stabilityWeight = 0.10

  // 📖 Normalize SWE score (0-1)
  const sweVal = parseSweScore(model.sweScore)
  const sweNorm = sweVal / 100

  // 📖 Normalize Latency: lower latency is better. Max penalty reached at 15s.
  const latVal = typeof model.latencyMs === 'number' ? model.latencyMs : 15000
  const latNorm = 1 - Math.min(latVal / 15000, 1)

  // 📖 Normalize TPS (Tokens Per Second): cap at 100 TPS as a perfect score.
  const tpsVal = typeof model.tps === 'number' ? model.tps : 0
  const tpsNorm = Math.min(tpsVal / 100, 1)

  // 📖 Normalize Stability Score (0-100 from daemon/stats)
  const stabilityVal = typeof model.stabilityScore === 'number' ? model.stabilityScore : 100
  const stabilityNorm = stabilityVal / 100

  return (sweWeight * sweNorm) +
         (latWeight * latNorm) +
         (tpsWeight * tpsNorm) +
         (stabilityWeight * stabilityNorm)
}

/**
 * 📖 Filter out unreachable models and sort by composite performance.
 *
 * @param {Array<object>} models - Scanned models list
 * @returns {Array<object>} Sorted list of models with computed composite scores
 */
export function rankModels(models) {
  return models
    .filter(m => m.status === 'up' && m.hasKey)
    .map(m => ({
      ...m,
      compositeScore: computeCompositeScore(m)
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
}

/**
 * 📖 Format a single model line for menus (plain text; adapters add colour).
 *
 * @param {object} model - The ranked model
 * @param {number} rank - Index in the ranked list (1-based)
 * @returns {string} Plain-text model line
 */
export function formatModelLine(model, rank) {
  const medal = ['🥇', '🥈', '🥉'][rank - 1] || `${rank}.`
  const latStr = model.latencyMs ? `${model.latencyMs}ms` : 'n/a'
  const tpsStr = model.tps ? `, ${Math.round(model.tps)} TPS` : ''
  const sweStr = model.sweScore !== '-' ? ` (${model.sweScore} SWE)` : ''

  return `${medal} ${model.label} [${model.tier}]${sweStr} — ${latStr}${tpsStr} [${model.providerKey}]`
}
