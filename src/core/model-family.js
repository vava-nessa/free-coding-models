/**
 * @file model-family.js
 * @description Model family detection + family-preserving failover picker for the Smart Router.
 *
 * @details
 *   📖 When a routed request fails, the router historically fell back to the
 *   next entry in the set's priority order, which can be a completely different
 *   model family (user asked for DeepSeek-class output and got a Qwen model).
 *   This module normalizes every model to a `family` id and provides a
 *   two-stage failover picker:
 *     Stage 1: retry the same family on a DIFFERENT provider (same brain,
 *              different host, e.g. `nvidiaNim/deepseek-v4` → `together/deepseek-v3`).
 *     Stage 2: the historical set-order fallback (any healthy untried model).
 *
 *   📖 Family detection is a keyword scan over a "haystack" built from the
 *   model id, label, and provider key (lowercased). Mapping ORDER matters:
 *   more specific brands must be checked before generic substrings they
 *   contain. `gpt` precedes `o1`/`o3` so `gpt-oss-120b` is classified as GPT,
 *   and `nemotron` precedes `llama` so `llama-3.1-nemotron-70b` is classified
 *   as Nemotron rather than Llama.
 *
 *   📖 `o1`/`o3` are short numeric keywords that would false-positive inside
 *   ordinary ids (e.g. `mistral-o1x`), so they only match on word boundaries:
 *   preceded/followed by a non-alphanumeric character or string edge.
 *
 * @functions
 *   → detectFamily(model) - Normalize a model (string or object) to a family id
 *   → getModelFamilyHaystack(model) - Lowercased id+label+provider scan string
 *   → pickNextCandidate(opts) - Two-stage failover picker (family first, then set order)
 *
 * @exports BRAND_MAPPINGS, detectFamily, getModelFamilyHaystack, pickNextCandidate
 *
 * @see ./router-daemon.js - pickNextCandidate is used by the routeRequest failover loop
 * @see ../config.js - per-set `familyFailover: true|false` toggle (default true)
 */

/**
 * 📖 BRAND_MAPPINGS - ordered keyword → family table. FIRST match wins, so
 * ordering is part of the contract: more specific keywords must come before
 * generic ones they contain. Keep new entries sorted by specificity, not
 * alphabetically.
 */
export const BRAND_MAPPINGS = [
  { keywords: ['claude'], familyId: 'claude', familyName: 'Claude' },
  { keywords: ['deepseek'], familyId: 'deepseek', familyName: 'DeepSeek' },
  { keywords: ['gemini'], familyId: 'gemini', familyName: 'Gemini' },
  // 📖 'gpt' MUST precede the openai-o entry: gpt-oss-120b contains neither
  // o1 nor o3 on a word boundary, but ordering keeps that guarantee explicit.
  { keywords: ['gpt', 'gpt-oss'], familyId: 'gpt', familyName: 'GPT' },
  { keywords: ['nemotron'], familyId: 'nemotron', familyName: 'Nemotron' },
  { keywords: ['llama'], familyId: 'llama', familyName: 'Llama' },
  { keywords: ['minimax'], familyId: 'minimax', familyName: 'MiniMax' },
  { keywords: ['qwen'], familyId: 'qwen', familyName: 'Qwen' },
  { keywords: ['kimi', 'moonshot'], familyId: 'kimi', familyName: 'Kimi' },
  { keywords: ['glm', 'chatglm'], familyId: 'glm', familyName: 'GLM' },
  { keywords: ['mistral', 'mixtral'], familyId: 'mistral', familyName: 'Mistral' },
  // 📖 o1/o3 are word-boundary matched (see matchesKeyword) to avoid
  // false positives inside unrelated model ids.
  { keywords: ['o1', 'o3'], familyId: 'openai-o', familyName: 'OpenAI o' },
]

/**
 * 📖 getModelFamilyHaystack - build the lowercase scan string for a model.
 * Accepts a plain string (model id) or an object with any of id/model/label/
 * family/provider/providerKey fields, plus a nested `catalog` object as found
 * on router routing candidates.
 *
 * @param {string|object|null} model
 * @returns {string} lowercase haystack, '' when nothing usable is present
 */
export function getModelFamilyHaystack(model) {
  if (typeof model === 'string') return model.toLowerCase()
  if (!model || typeof model !== 'object') return ''
  const catalog = model.catalog && typeof model.catalog === 'object' ? model.catalog : {}
  return [
    model.id,
    model.model,
    model.label,
    model.family,
    model.name,
    model.provider,
    model.providerKey,
    catalog.label,
    catalog.model,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase()
}

/**
 * 📖 matchesKeyword - substring match, except for very short (<= 2 chars) or
 * digit-leading keywords (o1, o3) which require word boundaries so they can
 * never fire inside an unrelated identifier.
 *
 * @param {string} haystack lowercased scan string
 * @param {string} keyword lowercase brand keyword (alphanumeric + dashes only)
 * @returns {boolean}
 */
function matchesKeyword(haystack, keyword) {
  if (keyword.length <= 2 || /^\d/.test(keyword)) {
    const boundary = new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`)
    return boundary.test(haystack)
  }
  return haystack.includes(keyword)
}

/**
 * 📖 detectFamily - map a model to one of the BRAND_MAPPINGS family ids.
 * Case-insensitive; unknown models return null so callers fall back to their
 * default behaviour (for the router: plain set-order failover).
 *
 * @param {string|object|null} model model id, or object with id/label/provider fields
 * @returns {string|null} family id (e.g. 'deepseek') or null
 */
export function detectFamily(model) {
  const haystack = getModelFamilyHaystack(model)
  if (!haystack) return null
  for (const mapping of BRAND_MAPPINGS) {
    if (mapping.keywords.some((keyword) => matchesKeyword(haystack, keyword))) {
      return mapping.familyId
    }
  }
  return null
}

/**
 * 📖 pickNextCandidate - the two-stage failover policy, kept pure so it is
 * unit-testable without the daemon.
 *
 * Stage 1 (family preserving): when `familyFailover` is enabled and the failed
 * candidate's family is detected, pick the first eligible candidate of the SAME
 * family hosted on a DIFFERENT provider. Candidates arrive in routing order
 * (priority, circuit state, health - see getRoutingCandidates) so picking the
 * first match respects the user's ranking inside the family.
 *
 * Stage 2 (set order): otherwise fall back to the historical behaviour - the
 * first eligible candidate in routing order, whatever its family.
 *
 * @param {object} opts
 * @param {Array<object>} opts.candidates routing candidates (ordered, already health-filtered)
 * @param {object|null} opts.failedCandidate the candidate that just failed
 * @param {Set<string>} opts.triedKeys candidate keys already attempted
 * @param {Set<string>} opts.blockedProviders providers skipped for this request (auth failures)
 * @param {boolean} [opts.familyFailover=true] per-set toggle (config.js normalization)
 * @returns {{ candidate: object, reason: 'family_failover'|'set_order' }|null}
 *   null when every candidate is exhausted
 */
export function pickNextCandidate({
  candidates,
  failedCandidate,
  triedKeys,
  blockedProviders,
  familyFailover = true,
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const tried = triedKeys instanceof Set ? triedKeys : new Set(triedKeys || [])
  const blocked = blockedProviders instanceof Set ? blockedProviders : new Set(blockedProviders || [])
  const eligible = candidates.filter((candidate) => {
    if (!candidate || !candidate.key) return false
    if (tried.has(candidate.key)) return false
    if (blocked.has(candidate.provider)) return false
    return true
  })
  if (familyFailover !== false && failedCandidate) {
    const family = detectFamily(failedCandidate)
    if (family) {
      const sameFamily = eligible.find(
        (candidate) => candidate.provider !== failedCandidate.provider && detectFamily(candidate) === family,
      )
      if (sameFamily) return { candidate: sameFamily, reason: 'family_failover' }
    }
  }
  const next = eligible[0]
  return next ? { candidate: next, reason: 'set_order' } : null
}
