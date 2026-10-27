/**
 * @file custom-providers.js
 * @description Merge user-defined OpenAI-compatible providers into the live catalog (issue #197).
 *
 * @description
 *   The provider catalog lives in sources.js as static ES module exports
 *   (`sources` map + flat `MODELS` array) consumed by 13+ modules through
 *   static imports: the TUI, the router daemon, tool sync writers (OpenCode,
 *   Kilo, ...), analysis, and the endpoint installer. Instead of refactoring
 *   every consumer, this module MUTATES the exported objects at startup:
 *   ES module bindings are live, so adding keys to `sources`, pushing into
 *   `MODELS`, and extending the metadata maps makes custom providers appear
 *   on every surface (TUI, Web Dashboard, Smart Router, tool configs) with
 *   zero changes to consumer code.
 *
 *   The merge is idempotent: re-running it (config reload, daemon tick)
 *   first removes everything it previously added, then re-applies the
 *   current config. Custom entries are tagged `custom: true` on the source
 *   object so surfaces can distinguish them from the shipped catalog.
 *
 *   Key resolution for custom providers (see getApiKey in config.js):
 *     env var named by `envVar`  >  config.apiKeys[key]  >  `apiKey` field
 *   so a key typed in the Settings UI beats the bootstrap value declared in
 *   the config file, and both beat nothing.
 *
 * 🎯 Features:
 *   - applies normalized customProviders from ~/.free-coding-models.json
 *   - derives a key-test endpoint (GET <base>/models) for OpenAI-compatible urls
 *   - marks keyless endpoints noKeyNeeded so "configured only" hiding keeps them visible
 *   - provider color falls back to the theme accent (no palette entry needed)
 *
 * @functions
 *   → applyCustomProviders(config) — merge custom providers into the live catalog (idempotent)
 *   → getAppliedCustomProviderKeys() — keys currently merged into the catalog
 *   → deriveAuthEndpointFromChatUrl(url) — GET /models endpoint for a chat-completions url
 *   → deriveCustomEnvVarName(key) — deterministic FCM_CUSTOM_* env var name
 *
 * @exports applyCustomProviders, getAppliedCustomProviderKeys, deriveAuthEndpointFromChatUrl, deriveCustomEnvVarName
 *
 * @see sources.js — the static catalog being extended
 * @see src/core/utils.js — normalizeCustomProvidersSection (validation)
 * @see bin/free-coding-models.js, src/core/router-daemon.js — call sites
 */

import { sources, MODELS } from '../../sources.js'
import { PROVIDER_METADATA, ENV_VAR_NAMES } from './provider-metadata.js'
import { PROVIDER_AUTH_ENDPOINTS } from './provider-key-tester.js'
import { normalizeCustomProvidersSection } from './utils.js'

// 📖 Keys this process has merged into the catalog. Kept so re-applications
// 📖 can remove the previous wave first (idempotency: no duplicate MODELS rows,
// 📖 no stale providers surviving a config edit + reload).
const appliedKeys = new Set()

// 📖 The shipped catalog keys, snapshotted at module load (BEFORE any apply).
// 📖 Passed to the normalizer as the collision list: without the snapshot, a
// 📖 re-apply would see the previously merged custom keys inside `sources` and
// 📖 wrongly reject them as builtin collisions, silently dropping the wave.
const BUILTIN_PROVIDER_KEYS = Object.keys(sources)

/**
 * 📖 Derive a key-test endpoint from a chat-completions url.
 * "http://host:11434/v1/chat/completions" → GET "http://host:11434/v1/models".
 * Returns null when the url does not end with /chat/completions (the shape is
 * unexpected, the key tester falls back to its standard ping probe instead).
 *
 * @param {string} url
 * @returns {string|null}
 */
export function deriveAuthEndpointFromChatUrl(url) {
  if (typeof url !== 'string') return null
  const trimmed = url.replace(/\/+$/, '')
  if (!trimmed.endsWith('/chat/completions')) return null
  return `${trimmed.slice(0, -'/chat/completions'.length)}/models`
}

/**
 * 📖 Derive a deterministic env var name for a custom provider key:
 * "ollama-local" → "FCM_CUSTOM_OLLAMA_LOCAL". The FCM_CUSTOM_ prefix can
 * never collide with a built-in provider's env var. Used when the user did
 * not declare an envVar, so tool config writers (OpenCode, Kilo, ...) always
 * have a name to reference the key with ({env:FCM_CUSTOM_...}).
 *
 * @param {string} key
 * @returns {string}
 */
export function deriveCustomEnvVarName(key) {
  return `FCM_CUSTOM_${String(key).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

/**
 * 📖 getAppliedCustomProviderKeys: snapshot of the custom provider keys
 * currently merged into the live catalog (tests + diagnostics).
 *
 * @returns {string[]}
 */
export function getAppliedCustomProviderKeys() {
  return [...appliedKeys]
}

/**
 * 📖 applyCustomProviders: merge the config's customProviders section into the
 * live catalog (sources, MODELS, provider metadata, env var names, key-test
 * endpoints). Idempotent and synchronous; call right after loadConfig() in
 * every long-lived entrypoint (bin CLI, router daemon) BEFORE the first read
 * of the catalog.
 *
 * @param {object} [config] — config object returned by loadConfig()
 * @returns {{ applied: number, keys: string[] }}
 */
export function applyCustomProviders(config) {
  // 📖 Pass the built-in keys so a custom entry can never shadow the shipped
  // 📖 catalog (a user-defined "groq" is ignored, not merged).
  const customs = normalizeCustomProvidersSection(config?.customProviders, BUILTIN_PROVIDER_KEYS)

  // ── Step 1: remove the previous wave (idempotency) ──
  if (appliedKeys.size > 0) {
    for (const key of appliedKeys) {
      delete sources[key]
      delete PROVIDER_METADATA[key]
      delete ENV_VAR_NAMES[key]
      delete PROVIDER_AUTH_ENDPOINTS[key]
    }
    const stale = new Set(appliedKeys)
    let writeIndex = 0
    for (let i = 0; i < MODELS.length; i++) {
      if (!stale.has(MODELS[i][5])) MODELS[writeIndex++] = MODELS[i]
    }
    MODELS.length = writeIndex
    appliedKeys.clear()
  }

  // ── Step 2: apply the current wave ──
  for (const [key, def] of Object.entries(customs)) {
    sources[key] = {
      name: def.name,
      url: def.url,
      quota: def.quota,
      quotaCode: def.quotaCode,
      models: def.models,
      custom: true,
    }
    for (const model of def.models) {
      MODELS.push([model[0], model[1], model[2], model[3], model[4], key, null])
    }

    // 📖 A custom provider with no declared apiKey/envVar is treated as a
    // local keyless endpoint (Ollama, LM Studio, vLLM): noKeyNeeded keeps the
    // "configured only" filter from hiding models the user added on purpose.
    const needsKey = Boolean(def.apiKey || def.envVar)
    PROVIDER_METADATA[key] = {
      label: def.name,
      custom: true,
      ...(needsKey ? {} : { noKeyNeeded: true }),
      rateLimits: def.quota,
      detailedLimits: `${def.quota}\nCustom OpenAI-compatible endpoint defined in the customProviders section of the config file. Models, tiers and context windows are declared by you; latency and uptime are measured live like any other provider.`,
    }
    // 📖 Always register an env var name: tool config writers (OpenCode,
    // Kilo, endpoint installer) skip providers without one. User-declared
    // envVar wins; otherwise a deterministic FCM_CUSTOM_* name is derived.
    ENV_VAR_NAMES[key] = def.envVar || deriveCustomEnvVarName(key)

    const authEndpoint = deriveAuthEndpointFromChatUrl(def.url)
    if (authEndpoint) {
      PROVIDER_AUTH_ENDPOINTS[key] = { url: authEndpoint, method: 'GET' }
    }

    appliedKeys.add(key)
  }

  return { applied: appliedKeys.size, keys: [...appliedKeys] }
}
