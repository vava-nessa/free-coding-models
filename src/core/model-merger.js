const TIER_RANK = { 'S+': 0, 'S': 1, 'A+': 2, 'A': 3, 'A-': 4, 'B+': 5, 'B': 6, 'C': 7 }

function parseCtxK(ctx) {
  if (!ctx) return 0
  const s = ctx.toLowerCase()
  if (s.endsWith('m')) return parseFloat(s) * 1000
  return parseFloat(s) || 0
}

function parseSwePercent(swe) {
  return parseFloat(swe) || 0
}

/**
 * Generate a unique slug from a label.
 * "DeepSeek V3.2" → "deepseek-v3-2"
 * Appends suffix if collision detected.
 */
function slugify(label, existingSlugs) {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let slug = base
  let i = 2
  while (existingSlugs.has(slug)) {
    slug = `${base}-${i++}`
  }
  existingSlugs.add(slug)
  return slug
}

/**
 * Build merged model list from flat MODELS array.
 * Groups by display label. Each merged entry contains all providers.
 *
 * @param {Array} models - Flat array of [modelId, label, tier, sweScore, ctx, providerKey]
 * @returns {Array<MergedModel>}
 *
 * MergedModel: {
 *   slug: string,           // unique URL-safe identifier
 *   label: string,          // display name
 *   tier: string,           // best tier across providers
 *   sweScore: string,       // highest SWE score
 *   ctx: string,            // largest context window
 *   providerCount: number,
 *   providers: Array<{ modelId: string, providerKey: string, tier: string }>
 * }
 */
export function buildMergedModels(models) {
  const groups = new Map()

  for (const [modelId, label, tier, sweScore, ctx, providerKey] of models) {
    if (!groups.has(label)) {
      groups.set(label, { label, tier, sweScore, ctx, providers: [] })
    }

    const group = groups.get(label)
    group.providers.push({ modelId, providerKey, tier })

    // Keep best tier
    if ((TIER_RANK[tier] ?? 99) < (TIER_RANK[group.tier] ?? 99)) {
      group.tier = tier
    }
    // Keep highest SWE score
    if (parseSwePercent(sweScore) > parseSwePercent(group.sweScore)) {
      group.sweScore = sweScore
    }
    // Keep largest context
    if (parseCtxK(ctx) > parseCtxK(group.ctx)) {
      group.ctx = ctx
    }
  }

  const existingSlugs = new Set()
  return Array.from(groups.values()).map(g => ({
    ...g,
    slug: slugify(g.label, existingSlugs),
    providerCount: g.providers.length,
  }))
}
