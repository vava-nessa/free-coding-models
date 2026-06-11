/**
 * @file lib/quota-capabilities.js
 * @description Provider quota telemetry and Usage-column behavior map.
 *
 * Describes how we can observe quota state for each provider:
 * - header:   Provider sends x-ratelimit-remaining / x-ratelimit-limit headers
 * - endpoint: Provider has a dedicated usage/quota REST endpoint we can poll
 * - unknown:  No reliable quota signal available
 *
 * The TUI needs an extra distinction beyond telemetry transport:
 * - `usageDisplay: 'percent'` means we can show a trustworthy remaining %.
 * - `usageDisplay: 'ok'` means Usage is not meaningfully measurable as a live %,
 *   so the table shows a green status dot instead of a misleading number.
 *
 * `resetCadence` tells the reader when a stored snapshot should be invalidated
 * even if it is still within the generic freshness TTL.
 *
 * supportsEndpoint (optional, for openrouter/siliconflow):
 *   true  — provider has a known usage endpoint
 *   false — no endpoint, header-only or unknown
 *
 * @exports PROVIDER_CAPABILITIES — full map keyed by providerKey (matches sources.js)
 * @exports getQuotaTelemetry(providerKey) — returns capability object (defaults to unknown)
 * @exports isKnownQuotaTelemetry(providerKey) — true when telemetryType !== 'unknown'
 */

/**
 * @typedef {Object} ProviderCapability
 * @property {'header'|'endpoint'|'unknown'} telemetryType
 * @property {boolean} [supportsEndpoint]
 * @property {'percent'|'ok'} usageDisplay
 * @property {'rolling'|'daily'|'monthly'|'unknown'|'none'} resetCadence
 */

/** @type {Record<string, ProviderCapability>} */
export const PROVIDER_CAPABILITIES = {
  // Providers that return x-ratelimit-remaining / x-ratelimit-limit headers
  nvidia: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'ok',      resetCadence: 'none' },
  groq: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'daily' },
  cerebras: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },
  sambanova: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },
  'github-models': { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },
  mistral: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'monthly' },
  scaleway: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },
  googleai: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'daily' },
  codestral: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'daily' },
  qwen: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },
  ovhcloud: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },

  // Providers that have a dedicated usage/credits endpoint
  openrouter: { telemetryType: 'endpoint', supportsEndpoint: true, usageDisplay: 'percent', resetCadence: 'unknown' },

  // Providers with no reliable quota signal
  cloudflare: { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'daily' },
  zai: { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'none' },
  'opencode-zen': { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'unknown' },
  kilo: { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'unknown' },
  llm7: { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'rolling' },
  routeway: { telemetryType: 'header', supportsEndpoint: false, usageDisplay: 'percent', resetCadence: 'unknown' },
  novita: { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'unknown' },
  'ollama-cloud': { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'rolling' },
}

/** Fallback for unrecognized providers */
const UNKNOWN_CAPABILITY = { telemetryType: 'unknown', supportsEndpoint: false, usageDisplay: 'ok', resetCadence: 'unknown' }

/**
 * Get quota telemetry capability for a provider.
 * Returns `{ telemetryType: 'unknown', supportsEndpoint: false }` for unrecognized providers.
 *
 * @param {string} providerKey - Provider key matching sources.js (e.g. 'groq', 'openrouter')
 * @returns {ProviderCapability}
 */
export function getQuotaTelemetry(providerKey) {
  return PROVIDER_CAPABILITIES[providerKey] ?? UNKNOWN_CAPABILITY
}

/**
 * Returns true when we have a reliable quota telemetry signal for this provider
 * (either via response headers or a dedicated endpoint).
 *
 * Returns false for 'unknown' providers where quota state must be inferred.
 *
 * @param {string} providerKey
 * @returns {boolean}
 */
export function isKnownQuotaTelemetry(providerKey) {
  return getQuotaTelemetry(providerKey).telemetryType !== 'unknown'
}

/**
 * Returns true when the Usage column can show a real remaining percentage for
 * the given provider.
 *
 * @param {string} providerKey
 * @returns {boolean}
 */
export function supportsUsagePercent(providerKey) {
  return getQuotaTelemetry(providerKey).usageDisplay === 'percent'
}

/**
 * Returns true when the provider's quota commonly resets on a daily cadence.
 * This lets the usage reader invalidate yesterday's snapshots immediately
 * after midnight instead of waiting for the generic TTL window to expire.
 *
 * @param {string} providerKey
 * @returns {boolean}
 */
export function usageResetsDaily(providerKey) {
  return getQuotaTelemetry(providerKey).resetCadence === 'daily'
}
