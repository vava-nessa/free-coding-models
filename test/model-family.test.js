/**
 * @file test/model-family.test.js
 * @description Tests for src/core/model-family.js — family detection + family-preserving failover.
 *
 * Covers:
 *   - detectFamily for every brand family (claude, deepseek, gemini, gpt, nemotron, llama,
 *     minimax, qwen, kimi, glm, mistral, openai-o)
 *   - Case-insensitive matching over id + label + provider haystacks
 *   - Router candidate objects ({ provider, model, catalog }) are understood
 *   - Ordering traps: gpt-oss is GPT (not openai-o), llama-3.1-nemotron is Nemotron (not Llama)
 *   - o1/o3 word-boundary matching (no false positives inside unrelated ids)
 *   - Unknown models return null
 *   - pickNextCandidate: family hop across providers, set-order fallback,
 *     familyFailover:false, blocked providers, exhausted candidates
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BRAND_MAPPINGS,
  detectFamily,
  getModelFamilyHaystack,
  pickNextCandidate,
} from '../src/core/model-family.js'

describe('getModelFamilyHaystack', () => {
  it('lowercases a plain string id', () => {
    assert.equal(getModelFamilyHaystack('DeepSeek-V3.1'), 'deepseek-v3.1')
  })

  it('joins id, label and provider fields of an object', () => {
    const haystack = getModelFamilyHaystack({
      model: 'DeepSeek-V3.1',
      label: 'DeepSeek V3.1',
      provider: 'sambanova',
    })
    assert.equal(haystack, 'deepseek-v3.1 deepseek v3.1 sambanova')
  })

  it('reads the nested catalog of a router candidate', () => {
    const haystack = getModelFamilyHaystack({
      provider: 'nvidia',
      model: 'openai/gpt-oss-120b',
      catalog: { label: 'GPT-OSS 120B' },
    })
    assert.ok(haystack.includes('gpt-oss'))
    assert.ok(haystack.includes('gpt-oss 120b'))
  })

  it('returns empty string for null, numbers and empty objects', () => {
    assert.equal(getModelFamilyHaystack(null), '')
    assert.equal(getModelFamilyHaystack(42), '')
    assert.equal(getModelFamilyHaystack({}), '')
  })
})

describe('detectFamily', () => {
  it('detects every family from a bare model id', () => {
    const cases = {
      'claude-sonnet-4.5': 'claude',
      'deepseek-v4-pro': 'deepseek',
      'deepseek-ai/deepseek-v4-flash-0731': 'deepseek',
      'gemini-3.0-flash': 'gemini',
      'gpt-oss-120b': 'gpt',
      'openai/gpt-oss-20b': 'gpt',
      'llama-4-scout': 'llama',
      'MiniMax-M2': 'minimax',
      'qwen/qwen3.6-27b': 'qwen',
      'kimi-k2.6': 'kimi',
      'moonshot-v1-8k': 'kimi',
      'glm-4.7': 'glm',
      'chatglm3-6b': 'glm',
      'mistral-large-2512': 'mistral',
      'mixtral-8x7b': 'mistral',
      'o3-mini': 'openai-o',
    }
    for (const [id, expected] of Object.entries(cases)) {
      assert.equal(detectFamily(id), expected, `${id} should map to ${expected}`)
    }
  })

  it('is case-insensitive across the whole haystack', () => {
    assert.equal(detectFamily({ model: 'DeepSeek-V3.1', provider: 'SambaNova' }), 'deepseek')
    assert.equal(detectFamily({ model: 'KIMI-K2', provider: 'NVIDIA' }), 'kimi')
  })

  it('classifies llama-3.1-nemotron as Nemotron, not Llama (ordering trap)', () => {
    assert.equal(detectFamily('nvidia/llama-3.1-nemotron-70b-instruct'), 'nemotron')
  })

  it('never classifies gpt ids as openai-o (ordering trap)', () => {
    assert.equal(detectFamily('openai/gpt-oss-120b'), 'gpt')
    assert.equal(detectFamily('gpt-oss-20b-o3-preview'), 'gpt')
  })

  it('matches o1/o3 only on word boundaries', () => {
    assert.equal(detectFamily('o1-preview'), 'openai-o')
    assert.equal(detectFamily('openai/o1-mini'), 'openai-o')
    assert.equal(detectFamily('proxol1x-9b'), null, 'o1 inside a word must not match')
    assert.equal(detectFamily('fello3z-model'), null, 'o3 inside a word must not match')
  })

  it('uses the provider label as evidence too', () => {
    // 📖 DeepInfra hosts many models; the provider name alone must NOT force
    // a family, but an unknown id from kimi-branded provider still matches kimi.
    assert.equal(detectFamily({ model: 'something-unknown', provider: 'kimi' }), 'kimi')
    assert.equal(detectFamily({ model: 'something-unknown', provider: 'deepinfra' }), null)
  })

  it('returns null for unknown models and empty input', () => {
    assert.equal(detectFamily('arcee-blend'), null)
    assert.equal(detectFamily(''), null)
    assert.equal(detectFamily(null), null)
    assert.equal(detectFamily(undefined), null)
  })

  it('covers exactly the 12 documented families', () => {
    const ids = BRAND_MAPPINGS.map((m) => m.familyId)
    assert.equal(ids.length, 12)
    assert.equal(new Set(ids).size, 12, 'family ids must be unique')
  })
})

describe('pickNextCandidate', () => {
  // 📖 A set whose priority order mixes families: GPT on nvidia first, then a
  // Qwen on groq, then the same GPT family on cerebras. Candidates mirror the
  // router's getRoutingCandidates output (already ordered, already healthy).
  const candidates = [
    { key: 'nvidia/openai/gpt-oss-120b', provider: 'nvidia', model: 'openai/gpt-oss-120b', priority: 1 },
    { key: 'groq/qwen/qwen3.6-27b', provider: 'groq', model: 'qwen/qwen3.6-27b', priority: 2 },
    { key: 'cerebras/gpt-oss-120b', provider: 'cerebras', model: 'gpt-oss-120b', priority: 3 },
  ]

  it('hops to the same family on another provider, skipping the Qwen entry', () => {
    const pick = pickNextCandidate({
      candidates,
      failedCandidate: candidates[0],
      triedKeys: new Set(['nvidia/openai/gpt-oss-120b']),
      blockedProviders: new Set(),
    })
    assert.equal(pick.reason, 'family_failover')
    assert.equal(pick.candidate.key, 'cerebras/gpt-oss-120b')
  })

  it('keeps user priority order inside the same family (first family match wins)', () => {
    const withTwo = [
      candidates[0],
      { key: 'sambanova/gpt-oss-120b', provider: 'sambanova', model: 'gpt-oss-120b', priority: 2 },
      candidates[2],
    ]
    const pick = pickNextCandidate({
      candidates: withTwo,
      failedCandidate: withTwo[0],
      triedKeys: new Set(['nvidia/openai/gpt-oss-120b']),
      blockedProviders: new Set(),
    })
    assert.equal(pick.candidate.key, 'sambanova/gpt-oss-120b')
  })

  it('does not count the same provider as a family alternative', () => {
    const sameProviderAlt = { key: 'nvidia/openai/gpt-oss-20b', provider: 'nvidia', model: 'openai/gpt-oss-20b', priority: 2 }
    const pick = pickNextCandidate({
      candidates: [candidates[0], sameProviderAlt],
      failedCandidate: candidates[0],
      triedKeys: new Set(['nvidia/openai/gpt-oss-120b']),
      blockedProviders: new Set(),
    })
    // 📖 Stage 1 has no cross-provider GPT left, so Stage 2 falls back to
    // set order, which still picks the next healthy entry (same provider).
    assert.equal(pick.reason, 'set_order')
    assert.equal(pick.candidate.key, 'nvidia/openai/gpt-oss-20b')
  })

  it('falls back to set order when no same-family alternative exists', () => {
    // 📖 A DeepSeek-first set with no other DeepSeek entry: the family stage
    // finds nothing, so Stage 2 picks the next entry in priority order.
    const deepseekFirst = [
      { key: 'nvidia/deepseek-ai/deepseek-v4-flash-0731', provider: 'nvidia', model: 'deepseek-ai/deepseek-v4-flash-0731', priority: 1 },
      { key: 'groq/qwen/qwen3.6-27b', provider: 'groq', model: 'qwen/qwen3.6-27b', priority: 2 },
      { key: 'cerebras/gpt-oss-120b', provider: 'cerebras', model: 'gpt-oss-120b', priority: 3 },
    ]
    const pick = pickNextCandidate({
      candidates: deepseekFirst,
      failedCandidate: deepseekFirst[0],
      triedKeys: new Set([deepseekFirst[0].key]),
      blockedProviders: new Set(),
    })
    assert.equal(pick.reason, 'set_order')
    assert.equal(pick.candidate.key, 'groq/qwen/qwen3.6-27b')
  })

  it('falls back to set order when familyFailover is disabled', () => {
    const pick = pickNextCandidate({
      candidates,
      failedCandidate: candidates[0],
      triedKeys: new Set(['nvidia/openai/gpt-oss-120b']),
      blockedProviders: new Set(),
      familyFailover: false,
    })
    assert.equal(pick.reason, 'set_order')
    assert.equal(pick.candidate.key, 'groq/qwen/qwen3.6-27b')
  })

  it('skips blocked providers in both stages', () => {
    const pick = pickNextCandidate({
      candidates,
      failedCandidate: candidates[0],
      triedKeys: new Set(['nvidia/openai/gpt-oss-120b']),
      blockedProviders: new Set(['cerebras']),
    })
    assert.equal(pick.reason, 'set_order')
    assert.equal(pick.candidate.key, 'groq/qwen/qwen3.6-27b')
  })

  it('returns null when every candidate is tried or blocked', () => {
    const pick = pickNextCandidate({
      candidates,
      failedCandidate: candidates[0],
      triedKeys: new Set(candidates.map((c) => c.key)),
      blockedProviders: new Set(),
    })
    assert.equal(pick, null)
  })

  it('returns null for an empty candidate list', () => {
    const pick = pickNextCandidate({
      candidates: [],
      failedCandidate: candidates[0],
      triedKeys: new Set(),
      blockedProviders: new Set(),
    })
    assert.equal(pick, null)
  })

  it('tolerates plain arrays as tried/blocked inputs', () => {
    const pick = pickNextCandidate({
      candidates,
      failedCandidate: candidates[0],
      triedKeys: ['nvidia/openai/gpt-oss-120b'],
      blockedProviders: [],
    })
    assert.equal(pick.reason, 'family_failover')
  })
})
