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
