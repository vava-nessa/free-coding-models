/**
 * @file catalog-discovery.test.js
 * @description Protect audited OpenRouter ratings when live discovery replaces static rows.
 * @functions test -> checks catalog parity and unknown-score fallback without network access.
 * @exports none
 * @see src/core/analysis.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sources } from '../sources.js'
import { fetchOpenRouterFreeModels } from '../src/core/analysis.js'

test('live discovery preserves audited ratings and never fabricates an unknown score', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const known = sources.openrouter.models
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        ...known.map(([id]) => ({ id, context_length: 262144, pricing: { prompt: '0', completion: '0' } })),
        { id: 'test/unknown:free', context_length: 32768, pricing: { prompt: '0', completion: '0' } },
      ],
    }),
  })
  const discovered = await fetchOpenRouterFreeModels()
  for (const [id, , tier, score] of known) {
    const row = discovered.find((m) => m[0] === id)
    assert.deepEqual(row.slice(2, 4), [tier, score], id)
  }
  assert.deepEqual(discovered.at(-1).slice(2, 4), ['B', '-'])
})
