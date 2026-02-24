/**
 * @file lib/utils.js
 * @description Pure utility functions extracted from the main CLI for testability.
 *
 * 📖 This file was created to separate the "brain" of the app from the "body" (TUI, I/O, chalk).
 *    Every function here is a pure function — no side effects, no process.exit, no console output.
 *    This makes them trivial to unit test with `node:test` without mocking anything.
 *
 * 📖 The main CLI (bin/free-coding-models.js) imports everything from here.
 *    If you need to add new logic (calculations, data transforms, parsing),
 *    add it here so tests can cover it.
 *
 * 📖 Data flow:
 *    sources.js → MODELS array → main CLI creates result objects → these utils process them
 *
 * 📖 Result object shape (created by the main CLI, consumed by these functions):
 *    {
 *      idx: number,          // 1-based index for display
 *      modelId: string,      // e.g. "deepseek-ai/deepseek-v3.2"
 *      label: string,        // e.g. "DeepSeek V3.2" (human-friendly name)
 *      tier: string,         // e.g. "S+", "A", "B+" — from sources.js
 *      sweScore: string,     // e.g. "49.2%", "73.1%" — SWE-bench Verified score
 *      status: string,       // "pending" | "up" | "down" | "timeout"
 *      pings: Array<{ms: number, code: string}>,  // full ping history since start
 *      httpCode: string|null // last HTTP status code (for detecting 429 rate limits)
 *    }
 *
 * @functions
 *   → getAvg(result) — Calculate average latency from successful pings only
 *   → getVerdict(result) — Determine model health verdict based on avg latency and status
 *   → getUptime(result) — Calculate uptime percentage (successful / total pings)
 *   → sortResults(results, sortColumn, sortDirection) — Sort model results by any column
 *   → filterByTier(results, tierLetter) — Filter results by tier letter (S/A/B/C)
 *   → findBestModel(results) — Pick the best model by status → avg → uptime priority
 *   → parseArgs(argv) — Parse CLI arguments into structured flags and values
 *   → findFallbackModel(results, overloadedModel, options) — Find best alternative when rate-limited
 *
 * @exports getAvg, getVerdict, getUptime, sortResults, filterByTier, findBestModel, findFallbackModel, parseArgs
 * @exports TIER_ORDER, VERDICT_ORDER, TIER_LETTER_MAP
 *
 * @see bin/free-coding-models.js — main CLI that imports these utils
 * @see sources.js — model definitions consumed by these functions
 * @see test/test.js — unit tests that validate all these functions
 */

// ─── Constants ────────────────────────────────────────────────────────────────

// 📖 Tier sort order — defines the hierarchy from best to worst.
// 📖 Used by sortResults to compare tiers numerically via indexOf.
// 📖 S+ (elite frontier coders) is index 0, C (lightweight edge) is index 7.
// 📖 This must stay in sync with the tiers defined in sources.js.
export const TIER_ORDER = ['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']

// 📖 Verdict strings in order from healthiest to unhealthiest.
// 📖 Used by sortResults when sorting by the "verdict" column.
// 📖 "Perfect" means < 400ms avg, "Pending" means no data yet.
// 📖 The order matters — it determines sort rank in the TUI table.
export const VERDICT_ORDER = ['Perfect', 'Normal', 'Slow', 'Very Slow', 'Overloaded', 'Unstable', 'Not Active', 'Pending']

// 📖 Maps a CLI tier letter (--tier S/A/B/C) to the full tier strings it includes.
// 📖 Example: --tier A matches A+, A, and A- models (all "A-family" tiers).
// 📖 This avoids users needing to know the exact sub-tier names.
// 📖 Used by filterByTier() and the --tier CLI flag.
export const TIER_LETTER_MAP = {
  'S': ['S+', 'S'],      // 📖 Frontier coders — top Aider polyglot scores
  'A': ['A+', 'A', 'A-'], // 📖 Excellent alternatives — strong at most coding tasks
  'B': ['B+', 'B'],       // 📖 Solid performers — good for targeted programming
  'C': ['C'],              // 📖 Lightweight/edge models — code completion on constrained infra
}

// ─── Core Logic Functions ────────────────────────────────────────────────────

// 📖 getAvg: Calculate average latency from ONLY successful pings (HTTP 200).
// 📖 Failed pings (timeouts, 429s, 500s) are excluded to avoid skewing the average.
// 📖 Returns Infinity when no successful pings exist — this sorts "unknown" models to the bottom.
// 📖 The rounding to integer avoids displaying fractional milliseconds in the TUI.
//
// 📖 Example:
//   pings = [{ms: 200, code: '200'}, {ms: 0, code: '429'}, {ms: 400, code: '200'}]
//   → getAvg returns 300 (only the two 200s count: (200+400)/2)
export const getAvg = (r) => {
  const successfulPings = (r.pings || []).filter(p => p.code === '200')
  if (successfulPings.length === 0) return Infinity
  return Math.round(successfulPings.reduce((a, b) => a + b.ms, 0) / successfulPings.length)
}

// 📖 getVerdict: Determine a human-readable health verdict for a model.
// 📖 This is the "Status" column label shown in the TUI table.
//
// 📖 Decision priority (first match wins):
//   1. HTTP 429 → "Overloaded" (rate limited by NVIDIA, not a latency issue)
//   2. Timeout/down BUT was previously up → "Unstable" (it worked before, now it doesn't)
//   3. Timeout/down and never worked → "Not Active" (model might be offline)
//   4. No successful pings yet → "Pending" (still waiting for first response)
//   5. Avg < 400ms → "Perfect"
//   6. Avg < 1000ms → "Normal"
//   7. Avg < 3000ms → "Slow"
//   8. Avg < 5000ms → "Very Slow"
//   9. Avg >= 5000ms → "Unstable"
//
// 📖 The "wasUpBefore" check is key — it distinguishes between a model that's
//    temporarily flaky vs one that was never reachable in the first place.
export const getVerdict = (r) => {
  const avg = getAvg(r)
  const wasUpBefore = r.pings.length > 0 && r.pings.some(p => p.code === '200')

  if (r.httpCode === '429') return 'Overloaded'
  if ((r.status === 'timeout' || r.status === 'down') && wasUpBefore) return 'Unstable'
  if (r.status === 'timeout' || r.status === 'down') return 'Not Active'
  if (avg === Infinity) return 'Pending'
  if (avg < 400) return 'Perfect'
  if (avg < 1000) return 'Normal'
  if (avg < 3000) return 'Slow'
  if (avg < 5000) return 'Very Slow'
  if (avg < 10000) return 'Unstable'
  return 'Unstable'
}

// 📖 getUptime: Calculate the percentage of successful pings (code 200) over total pings.
// 📖 Returns 0 when no pings have been made yet (avoids division by zero).
// 📖 Displayed as "Up%" column in the TUI — e.g., "85%" means 85% of pings got HTTP 200.
// 📖 This metric is useful for identifying models that are technically "up" but flaky.
export const getUptime = (r) => {
  if (r.pings.length === 0) return 0
  const successful = r.pings.filter(p => p.code === '200').length
  return Math.round((successful / r.pings.length) * 100)
}

// 📖 sortResults: Sort the results array by any column the user can click/press in the TUI.
// 📖 Returns a NEW array — never mutates the original (important for React-style re-renders).
//
// 📖 Supported columns (matching the keyboard shortcuts in the TUI):
//   - 'rank'    (R key) — original index from sources.js
//   - 'tier'    (T key) — tier hierarchy (S+ first, C last)
//   - 'origin'  (O key) — provider name (all NIM for now, future-proofed)
//   - 'model'   (M key) — alphabetical by display label
//   - 'ping'    (L key) — last ping latency (only successful ones count)
//   - 'avg'     (A key) — average latency across all successful pings
//   - 'swe'     (S key) — SWE-bench score (higher is better)
//   - 'ctx'     (N key) — context window size (larger is better)
//   - 'condition' (H key) — health status (alphabetical)
//   - 'verdict' (V key) — verdict order (Perfect → Pending)
//   - 'uptime'  (U key) — uptime percentage
//
// 📖 sortDirection 'asc' = ascending (smallest first), 'desc' = descending (largest first)
export const sortResults = (results, sortColumn, sortDirection) => {
  return [...results].sort((a, b) => {
    let cmp = 0

    switch (sortColumn) {
      case 'rank':
        cmp = a.idx - b.idx
        break
      case 'tier':
        // 📖 Compare by position in TIER_ORDER — lower index = better tier
        cmp = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
        break
      case 'origin':
        // 📖 Sort by providerKey (or fallback to modelId prefix) for multi-provider support
        cmp = (a.providerKey ?? 'nvidia').localeCompare(b.providerKey ?? 'nvidia')
        break
      case 'model':
        cmp = a.label.localeCompare(b.label)
        break
      case 'ping': {
        // 📖 Sort by LAST ping only — gives a real-time "right now" snapshot
        // 📖 Failed last pings sort to the bottom (Infinity)
        const aLast = a.pings.length > 0 ? a.pings[a.pings.length - 1] : null
        const bLast = b.pings.length > 0 ? b.pings[b.pings.length - 1] : null
        const aPing = aLast?.code === '200' ? aLast.ms : Infinity
        const bPing = bLast?.code === '200' ? bLast.ms : Infinity
        cmp = aPing - bPing
        break
      }
      case 'avg':
        cmp = getAvg(a) - getAvg(b)
        break
      case 'swe': {
        // 📖 Sort by SWE-bench score — higher is better
        // 📖 Parse percentage strings like "49.2%", "73.1%" or use 0 for missing values
        const parseSwe = (score) => {
          if (!score || score === '—') return 0
          const num = parseFloat(score.replace('%', ''))
          return isNaN(num) ? 0 : num
        }
        cmp = parseSwe(a.sweScore) - parseSwe(b.sweScore)
        break
      }
      case 'ctx': {
        // 📖 Sort by context window size — larger is better
        // 📖 Parse strings like "128k", "32k", "1m" into numeric tokens
        const parseCtx = (ctx) => {
          if (!ctx || ctx === '—') return 0
          const str = ctx.toLowerCase()
          // 📖 Handle millions (1m = 1000k)
          if (str.includes('m')) {
            const num = parseFloat(str.replace('m', ''))
            return num * 1000
          }
          // 📖 Handle thousands (128k)
          if (str.includes('k')) {
            const num = parseFloat(str.replace('k', ''))
            return num
          }
          return 0
        }
        cmp = parseCtx(a.ctx) - parseCtx(b.ctx)
        break
      }
      case 'condition':
        cmp = a.status.localeCompare(b.status)
        break
      case 'verdict': {
        // 📖 Sort by verdict order — "Perfect" first, "Pending" last
        const aVerdict = getVerdict(a)
        const bVerdict = getVerdict(b)
        cmp = VERDICT_ORDER.indexOf(aVerdict) - VERDICT_ORDER.indexOf(bVerdict)
        break
      }
      case 'uptime':
        cmp = getUptime(a) - getUptime(b)
        break
    }

    // 📖 Flip comparison for descending order
    return sortDirection === 'asc' ? cmp : -cmp
  })
}

// 📖 filterByTier: Filter model results by a single tier letter.
// 📖 Uses TIER_LETTER_MAP to expand the letter into matching tier strings.
// 📖 Returns null if the tier letter is invalid — the caller decides how to handle
//    (the main CLI exits with an error message, tests can assert null).
//
// 📖 Example: filterByTier(results, 'A') → returns only models with tier A+, A, or A-
export function filterByTier(results, tierLetter) {
  const letter = tierLetter.toUpperCase()
  const allowed = TIER_LETTER_MAP[letter]
  if (!allowed) return null
  return results.filter(r => allowed.includes(r.tier))
}

// 📖 findBestModel: Pick the single best model from a results array.
// 📖 Used by --fiable mode to output the most reliable model after 10s of analysis.
//
// 📖 Selection priority (tri-key sort):
//   1. Status: "up" models always beat non-up models
//   2. Average latency: faster average wins (lower is better)
//   3. Uptime %: higher uptime wins as tiebreaker
//
// 📖 Returns null if the array is empty.
export function findBestModel(results) {
  const sorted = [...results].sort((a, b) => {
    const avgA = getAvg(a)
    const avgB = getAvg(b)
    const uptimeA = getUptime(a)
    const uptimeB = getUptime(b)

    // 📖 Priority 1: Models that are currently responding beat those that aren't
    if (a.status === 'up' && b.status !== 'up') return -1
    if (a.status !== 'up' && b.status === 'up') return 1

    // 📖 Priority 2: Lower average latency = faster = better
    if (avgA !== avgB) return avgA - avgB

    // 📖 Priority 3: Higher uptime = more reliable = better (tiebreaker)
    return uptimeB - uptimeA
  })

  return sorted.length > 0 ? sorted[0] : null
}

// 📖 findFallbackModel: Find the best alternative model when a model is overloaded (429).
// 📖 Used by the TUI to suggest alternatives when rate limiting occurs.
//
// 📖 Selection priority:
//   1. Must be currently "up" (not overloaded, not down, not timeout)
//   2. Same tier preferred, then lower tiers (never suggest higher tier)
//   3. Lower average latency = faster = better
//   4. Higher uptime = more reliable = better (tiebreaker)
//
// 📖 Parameters:
//   - results: array of all model results
//   - overloadedModel: the model that returned 429 (rate limited)
//   - options: { sameTierOnly: boolean } - if true, only suggest same tier
//
// 📖 Returns null if no suitable fallback is found.
export function findFallbackModel(results, overloadedModel, options = {}) {
  const { sameTierOnly = false } = options
  
  // 📖 Get the tier index of the overloaded model
  const overloadedTierIdx = TIER_ORDER.indexOf(overloadedModel.tier)
  
  // 📖 Filter candidates: must be "up" and not the same model
  const candidates = results.filter(r => {
    // 📖 Skip the overloaded model itself
    if (r.modelId === overloadedModel.modelId && r.providerKey === overloadedModel.providerKey) {
      return false
    }
    
    // 📖 Must be currently responding (status === 'up')
    if (r.status !== 'up') return false
    
    // 📖 Must not be rate-limited itself
    if (r.httpCode === '429') return false
    
    // 📖 Check tier constraints
    const candidateTierIdx = TIER_ORDER.indexOf(r.tier)
    
    if (sameTierOnly) {
      // 📖 Only same tier
      return candidateTierIdx === overloadedTierIdx
    } else {
      // 📖 Same tier or lower (higher index = lower tier)
      return candidateTierIdx >= overloadedTierIdx
    }
  })
  
  if (candidates.length === 0) return null
  
  // 📖 Sort candidates: prefer same tier, then by latency, then by uptime
  const sorted = candidates.sort((a, b) => {
    const aTierIdx = TIER_ORDER.indexOf(a.tier)
    const bTierIdx = TIER_ORDER.indexOf(b.tier)
    
    // 📖 Priority 1: Prefer same tier as original
    const aSameTier = aTierIdx === overloadedTierIdx ? 0 : 1
    const bSameTier = bTierIdx === overloadedTierIdx ? 0 : 1
    if (aSameTier !== bSameTier) return aSameTier - bSameTier
    
    // 📖 Priority 2: Lower average latency = faster = better
    const avgA = getAvg(a)
    const avgB = getAvg(b)
    if (avgA !== avgB) return avgA - avgB
    
    // 📖 Priority 3: Higher uptime = more reliable = better (tiebreaker)
    return getUptime(b) - getUptime(a)
  })
  
  return sorted[0]
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

// 📖 parseArgs: Parse process.argv into a structured object of flags and values.
// 📖 Expects the full argv array (including 'node' and 'script' at indices 0-1).
// 📖 Slices from index 2 to get user-provided arguments only.
//
// 📖 Argument types:
//   - API key: first positional arg that doesn't start with "--" (e.g., "nvapi-xxx")
//   - Boolean flags: --best, --fiable, --opencode, --opencode-desktop, --openclaw, --no-telemetry (case-insensitive)
//   - Value flag: --tier <letter> (the next non-flag arg is the tier value)
//
// 📖 Returns:
//   { apiKey, bestMode, fiableMode, openCodeMode, openCodeDesktopMode, openClawMode, noTelemetry, tierFilter }
//
// 📖 Note: apiKey may be null here — the main CLI falls back to env vars and saved config.
export function parseArgs(argv) {
  const args = argv.slice(2)
  let apiKey = null
  const flags = []

  // Determine which arg index is consumed by --tier so we skip it
  const tierIdx = args.findIndex(a => a.toLowerCase() === '--tier')
  const tierValueIdx = (tierIdx !== -1 && args[tierIdx + 1] && !args[tierIdx + 1].startsWith('--'))
    ? tierIdx + 1
    : -1

  for (const [i, arg] of args.entries()) {
    if (arg.startsWith('--')) {
      flags.push(arg.toLowerCase())
    } else if (i === tierValueIdx) {
      // Skip -- this is the --tier value, not an API key
    } else if (!apiKey) {
      apiKey = arg
    }
  }

  const bestMode = flags.includes('--best')
  const fiableMode = flags.includes('--fiable')
  const openCodeMode = flags.includes('--opencode')
  const openCodeDesktopMode = flags.includes('--opencode-desktop')
  const openClawMode = flags.includes('--openclaw')
  const noTelemetry = flags.includes('--no-telemetry')

  let tierFilter = tierValueIdx !== -1 ? args[tierValueIdx].toUpperCase() : null

  return { apiKey, bestMode, fiableMode, openCodeMode, openCodeDesktopMode, openClawMode, noTelemetry, tierFilter }
}
