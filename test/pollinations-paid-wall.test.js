/**
 * @file test/pollinations-paid-wall.test.js
 * @description Regression tests for the Pollinations paid-wall probe sniffing
 * (issue #190). Models that left the free tier answer HTTP 200 with the error
 * text embedded in the completion content; ping() must surface 402 instead of
 * a fake-healthy 200. Also guards that the sniffing stays scoped to
 * pollinations so other providers never get false 402s.
 *
 * @functions
 *   → mockFetchOnce / mockFetchSequence — install a temporary global fetch stub
 *   → restoreFetch — always restore the real fetch, even on assertion failure
 * @exports none (node:test suite)
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ping } from '../src/core/ping.js'
import { detectProviderErrorContent, detectProviderErrorContentInPayload, PROVIDER_ERROR_CODES } from '../src/core/provider-error-content.js'

const POLLI_URL = 'https://gen.pollinations.ai/v1/chat/completions'
const OTHER_URL = 'https://api.groq.com/openai/v1/chat/completions'

const realFetch = globalThis.fetch
let fetchCalls = []

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetchSequence(responses) {
  fetchCalls = []
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    const next = responses.shift()
    if (!next) throw new Error('unexpected extra fetch call')
    return typeof next === 'function' ? next() : next
  }
}

describe('ping() Pollinations paid-wall sniffing (issue #190)', () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('reports 402 when a 200 completion carries the paid-Pollen credits error', async () => {
    mockFetchSequence([
      jsonResponse(200, {
        choices: [{ message: { content: 'The account behind this API key doesn\u2019t have enough credits. This model needs paid Pollen, upgrade at enter.pollinations.ai' } }],
      }),
    ])
    const result = await ping('sk-test', 'qwen/qwen3.8-max', 'pollinations', POLLI_URL)
    assert.equal(result.code, '402')
  })

  it('keeps 200 for a genuine completion on the same endpoint', async () => {
    mockFetchSequence([
      jsonResponse(200, {
        choices: [{ message: { content: 'ok' } }],
      }),
    ])
    const result = await ping('sk-test', 'openai/gpt-5.5', 'pollinations', POLLI_URL)
    assert.equal(result.code, '200')
  })

  it('never sniffs non-pollinations providers, even with identical error text', async () => {
    mockFetchSequence([
      jsonResponse(200, {
        choices: [{ message: { content: 'needs paid pollen immediately' } }],
      }),
    ])
    const result = await ping('gsk_test', 'llama-3.3-70b-versatile', 'groq', OTHER_URL)
    assert.equal(result.code, '200')
  })

  it('tolerates an unparseable body and keeps the 200 verdict', async () => {
    mockFetchSequence([
      () => new Response('<html>not json</html>', { status: 200 }),
    ])
    const result = await ping('sk-test', 'laguna', 'pollinations', POLLI_URL)
    assert.equal(result.code, '200')
  })
})

describe('shared provider notice detector (issues #190 / #209)', () => {
  const notice = "The account behind this API key doesn't have enough credits. Please top up your balance or complete a quest."

  it('detects the canonical notice in both modes', () => {
    for (const mode of ['strict', 'loose']) {
      const result = detectProviderErrorContent('pollinations', notice, { mode })
      assert.equal(result.detected, true, `${mode} mode must detect the notice`)
      assert.equal(result.code, PROVIDER_ERROR_CODES.CREDIT_EXHAUSTED)
    }
  })

  it('strict mode ignores a long genuine answer that quotes the notice', () => {
    const answer = `Here is how to handle it. When a provider says "${notice}" it means the balance is empty, so catch the 402 in your client and retry after the daily grant.`
    assert.equal(detectProviderErrorContent('pollinations', answer, { mode: 'strict' }).detected, false)
    // 📖 Loose (probe) mode keeps the historical #190 verdict on any fragment.
    assert.equal(detectProviderErrorContent('pollinations', answer, { mode: 'loose' }).detected, true)
  })

  it('strict mode still catches the notice prefix even with long top-up instructions', () => {
    const longNotice = `${notice} ${'Top up at enter.pollinations.ai or complete a quest to earn more Pollen. '.repeat(10)}`.trim()
    assert.ok(longNotice.length > 400)
    assert.equal(detectProviderErrorContent('pollinations', longNotice, { mode: 'strict' }).detected, true)
  })

  it('strict mode still catches a short billing phrase', () => {
    assert.equal(detectProviderErrorContent('pollinations', 'This model needs paid Pollen.', { mode: 'strict' }).detected, true)
  })

  it('reports pending for a partial notice so a stream can hold the buffer', () => {
    assert.equal(detectProviderErrorContent('pollinations', 'The').pending, true)
    const partial = detectProviderErrorContent('pollinations', 'The account behind this ')
    assert.equal(partial.detected, false)
    assert.equal(partial.pending, true)
    // 📖 Diverging text stops being suspicious immediately.
    assert.equal(detectProviderErrorContent('pollinations', 'The account behind it owns the workspace.').pending, false)
  })

  it('never matches providers outside the table', () => {
    assert.equal(detectProviderErrorContent('groq', notice, { mode: 'loose' }).detected, false)
    assert.equal(detectProviderErrorContent('openrouter', notice, { mode: 'strict' }).detected, false)
    assert.equal(detectProviderErrorContent('constructor', notice).detected, false)
  })

  it('reads the first assistant text from a parsed payload', () => {
    const payload = { choices: [{ message: { role: 'assistant', content: notice } }] }
    assert.equal(detectProviderErrorContentInPayload('pollinations', payload).detected, true)
    assert.equal(detectProviderErrorContentInPayload('pollinations', { choices: [{ message: { tool_calls: [{ id: '1' }] } }] }).detected, false)
    assert.equal(detectProviderErrorContentInPayload('pollinations', null).detected, false)
  })
})
