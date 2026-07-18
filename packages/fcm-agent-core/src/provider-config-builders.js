/**
 * @file provider-config-builders.js
 * @description Provider/model descriptor builders for each agent target (shared core).
 *
 * @details
 *   Both the Pi and OpenCode adapters need to turn a scanned FCM model into the
 *   exact provider+model shape their host expects (disk JSON for Pi, live config
 *   object for OpenCode). The shapes used to be duplicated across the adapters
 *   (and even twice inside the Pi adapter — runtime registration vs. disk write).
 *   Centralizing them here means a provider-shape fix lands in one place.
 *
 *   Builders return plain data only. They never touch disk or the host runtime —
 *   the adapter decides whether to registerProvider(), write JSON, or mutate a
 *   config object. No API key is ever logged here.
 *
 * @functions
 *   - normalizeBaseUrl → Strip /chat/completions | /completions | /responses
 *   - getProviderId → Normalize a provider key to its `fcm-*` ID
 *   - getOpenCodeEnvName → Stable FCM_*_API_KEY env var name for a provider
 *   - buildPiProviderDescriptor → Pi provider + model shape (disk + runtime)
 *   - buildOpenCodeModelDescriptor → One OpenCode model entry
 *   - buildOpenCodeProviderDescriptor → OpenCode provider + model shape
 *   - buildSmartRouterDescriptor → Local FCM daemon router descriptor per target
 */

import { parseContextWindow, getMaxTokens, getReasoningFlag } from './model-config.js'

/**
 * 📖 Strip trailing OpenAI-compatible completion paths so the base URL is a
 * 📖 clean `https://host/v1` root. Prevents 404s when the host appends its own
 * 📖 `/chat/completions`.
 *
 * @param {string} [url='']
 * @returns {string} Cleaned base URL
 */
export function normalizeBaseUrl(url = '') {
  return url
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/responses$/i, '')
}

/**
 * 📖 Normalize a provider key to its FCM-managed provider ID (`fcm-*`), so
 * 📖 built-in host providers stay untouched and stale winners clean up safely.
 *
 * @param {string|object} providerKeyOrModel - Provider key or a model object
 * @returns {string} Provider ID like `fcm-groq`
 */
export function getProviderId(providerKeyOrModel) {
  const key = typeof providerKeyOrModel === 'string'
    ? providerKeyOrModel
    : providerKeyOrModel?.providerKey
  return key?.startsWith('fcm-') ? key : `fcm-${key}`
}

/**
 * 📖 Stable env-var name OpenCode reads an API key from for a provider.
 *
 * @param {string} providerKey
 * @returns {string} e.g. `FCM_GROQ_API_KEY`
 */
export function getOpenCodeEnvName(providerKey) {
  return `FCM_${String(providerKey || 'provider').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/**
 * 📖 Build the Pi provider+model descriptor. Identical shape is used for both
 * 📖 runtime `pi.registerProvider()` and disk writes to ~/.pi/agent/models.json,
 * 📖 which is why it must live in one place.
 *
 * @param {object} model - Scanned model payload
 * @returns {{ providerId: string, provider: object, modelDescriptor: object }}
 */
export function buildPiProviderDescriptor(model) {
  const providerId = getProviderId(model.providerKey)
  const baseUrl = normalizeBaseUrl(model.providerUrl || '')
  const contextWindow = parseContextWindow(model.ctxWindow)
  const maxTokens = getMaxTokens(contextWindow)
  const providerName = model.providerName || model.providerKey

  const modelDescriptor = {
    id: model.modelId,
    name: `${model.label} (${providerName}) [FCM ${model.tier || '?'}]`,
    contextWindow,
    maxTokens,
    reasoning: getReasoningFlag(),
    input: ['text'], // 📖 Critical: Pi throws if `input` is undefined on boot
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  }

  const provider = {
    name: `FCM ${providerName}`,
    baseUrl,
    api: 'openai-completions',
    apiKey: model.apiKey || '',
    models: [modelDescriptor]
  }

  return { providerId, provider, modelDescriptor }
}

/**
 * 📖 Build one OpenCode model entry (the value side of provider.models[id]).
 *
 * @param {object} model - Scanned model payload
 * @returns {object} OpenCode model descriptor
 */
export function buildOpenCodeModelDescriptor(model) {
  const contextWindow = parseContextWindow(model.ctxWindow)
  const outputLimit = getMaxTokens(contextWindow)
  const providerName = model.providerName || model.providerKey
  return {
    id: model.modelId,
    name: `${model.label} (${providerName}) [FCM ${model.tier || '?'}]`,
    reasoning: getReasoningFlag(),
    tool_call: true,
    temperature: true,
    cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    limit: { context: contextWindow, output: outputLimit },
    modalities: { input: ['text'], output: ['text'] }
  }
}

/**
 * 📖 Build the OpenCode provider+model descriptor. The adapter merges this into
 * 📖 the live OpenCode config object; the API key is referenced via env, never
 * 📖 inlined, so it never leaks into config files or logs.
 *
 * @param {object} model - Scanned model payload
 * @returns {{ providerId: string, provider: object, envName: string, modelRef: string }}
 */
export function buildOpenCodeProviderDescriptor(model) {
  const providerId = getProviderId(model.providerKey)
  const envName = getOpenCodeEnvName(model.providerKey)
  const providerName = model.providerName || model.providerKey
  const modelDescriptor = buildOpenCodeModelDescriptor(model)

  const provider = {
    npm: '@ai-sdk/openai-compatible',
    name: `FCM ${providerName}`,
    env: [envName],
    options: {
      baseURL: normalizeBaseUrl(model.providerUrl),
      apiKey: `{env:${envName}}`
    },
    models: { [model.modelId]: modelDescriptor }
  }

  return { providerId, provider, envName, modelRef: `${providerId}/${model.modelId}` }
}

/**
 * 📖 Build a descriptor for the local FCM Smart Router daemon, per host target.
 * 📖 The router fronts every FCM provider with auto-failover.
 *
 * @param {object} [options]
 * @param {'pi'|'opencode'} [options.target='pi']
 * @returns {object} Target-specific router descriptor
 */
export function buildSmartRouterDescriptor({ target = 'pi' } = {}) {
  const providerId = 'fcm-router'
  const modelId = 'fcm'
  const baseURL = `http://localhost:${process.env.FCM_ROUTER_PORT || '19280'}/v1`
  const modelDisplayName = 'FCM Auto-Router (best available)'

  if (target === 'opencode') {
    return {
      providerId,
      modelRef: `${providerId}/${modelId}`,
      provider: {
        npm: '@ai-sdk/openai-compatible',
        name: 'FCM Smart Router',
        options: { baseURL, apiKey: 'fcm-local' },
        models: {
          [modelId]: {
            id: modelId,
            name: modelDisplayName,
            reasoning: false,
            tool_call: true,
            temperature: true,
            cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
            limit: { context: 200000, output: 8192 },
            modalities: { input: ['text'], output: ['text'] }
          }
        }
      }
    }
  }

  // 📖 Pi router shape (runtime registerProvider + disk)
  return {
    providerId,
    provider: {
      name: 'FCM Smart Router',
      baseUrl: baseURL,
      apiKey: 'fcm-local',
      api: 'openai-completions',
      models: [{
        id: modelId,
        name: modelDisplayName,
        contextWindow: 200000,
        maxTokens: 8192,
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
      }]
    },
    modelRef: `${providerId}/${modelId}`
  }
}
