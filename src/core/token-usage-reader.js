/**
 * @file token-usage-reader.js
 * @description Reads historical token usage snapshots and aggregates them by exact provider + model pair.
 *
 * @details
 *   The TUI already shows live latency and quota state, but that does not tell
 *   you how much you've actually consumed on a given Origin. This module reads
 *   the persistent JSONL request log once at startup and builds a compact
 *   `provider::model -> totalTokens` map for table display.
 *
 *   Why this exists:
 *   - `token-stats.json` is the only remaining source of truth for historical
 *     totals now that the older JSONL accounting pipeline has been removed.
 *   - Startup-only parsing keeps runtime overhead negligible during TUI redraws.
 *
 * @functions
 *   → `buildProviderModelTokenKey` — creates a stable aggregation key
 *   → `loadTokenUsageByProviderModel` — reads token snapshots and returns total tokens by provider+model
 *   → `formatTokenTotalCompact` — renders totals as raw ints or compact K / M strings with 2 decimals
 *
 * @exports buildProviderModelTokenKey, loadTokenUsageByProviderModel, formatTokenTotalCompact
 * @see src/render-table.js
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEFAULT_DATA_DIR = join(homedir(), '.free-coding-models')
const STATS_FILE = join(DEFAULT_DATA_DIR, 'token-stats.json')

// 📖 buildProviderModelTokenKey keeps provider-scoped totals isolated even when
// 📖 multiple Origins expose the same model ID.
export function buildProviderModelTokenKey(providerKey, modelId) {
  return `${providerKey}::${modelId}`
}

// 📖 loadTokenUsageByProviderModel reads the aggregated stats file produced by
// 📖 the quota/accounting pipeline. Missing or malformed files are treated as empty.
export function loadTokenUsageByProviderModel({ statsFile = STATS_FILE } = {}) {
  const totals = {}

  try {
    if (existsSync(statsFile)) {
      const stats = JSON.parse(readFileSync(statsFile, 'utf8'))
      // 📖 Aggregate byAccount entries (which use providerKey/slug/keyIdx as ID)
      // 📖 into providerKey::modelId buckets.
      if (stats.byAccount && typeof stats.byAccount === 'object') {
        for (const [accountId, acct] of Object.entries(stats.byAccount)) {
          const tokens = Number(acct.tokens) || 0
          if (tokens <= 0) continue

          // 📖 Extract providerKey and modelId from accountId (provider/model/index)
          const parts = accountId.split('/')
          if (parts.length >= 2) {
            const providerKey = parts[0]
            const modelId = parts[1]
            const key = buildProviderModelTokenKey(providerKey, modelId)
            totals[key] = (totals[key] || 0) + tokens
          }
        }
      }
    }
  } catch {}

  return totals
}

// 📖 formatTokenTotalCompact keeps token counts readable in the table:
// 📖 0-999 => raw integer, 1k-999k => N.NNk, 1m+ => N.NNM.
export function formatTokenTotalCompact(totalTokens) {
  const safeTotal = Number(totalTokens) || 0
  if (safeTotal >= 999_500) return `${(safeTotal / 1_000_000).toFixed(2)}M`
  if (safeTotal >= 1_000) return `${(safeTotal / 1_000).toFixed(2)}k`
  return String(Math.floor(safeTotal))
}
