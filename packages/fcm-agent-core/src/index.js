/**
 * @file index.js
 * @description Public API barrel for the FCM agent-core package.
 *
 * @details
 *   Single import surface for the Pi and OpenCode adapters. Everything needed
 *   to scan, rank, cache, and build provider descriptors for a coding-agent
 *   host is re-exported here. Adapters should never reach into `./src/*`
 *   subpaths directly — that keeps internal refactors non-breaking.
 *
 * @exports
 *   - scanBestFcmModel, runFcmScan ..... Scan orchestrator (daemon-first)
 *   - directScan ........................ Direct ping+benchmark scanner
 *   - rankModels, computeCompositeScore, parseSweScore, formatModelLine
 *   - parseContextWindow, getMaxTokens, isContextUsable, getReasoningFlag
 *   - DEFAULT_CONTEXT_WINDOW, MIN_CONTEXT_WINDOW
 *   - getKeyForProvider, loadAllApiKeys
 *   - isDaemonRunning, queryDaemon, fetchDaemonModels, DAEMON_PORT, DAEMON_BASE_URL
 *   - createCacheStore, DEFAULT_CACHE_TTL_MS
 *   - normalizeBaseUrl, getProviderId, getOpenCodeEnvName,
 *     buildPiProviderDescriptor, buildOpenCodeProviderDescriptor,
 *     buildOpenCodeModelDescriptor, buildSmartRouterDescriptor
 */

export { scanBestFcmModel, runFcmScan } from './scan-orchestrator.js'
export { directScan } from './direct-scanner.js'
export { rankModels, computeCompositeScore, parseSweScore, formatModelLine } from './ranker.js'
export {
  parseContextWindow,
  getMaxTokens,
  isContextUsable,
  getReasoningFlag,
  DEFAULT_CONTEXT_WINDOW,
  MIN_CONTEXT_WINDOW
} from './model-config.js'
export { getKeyForProvider, loadAllApiKeys } from './api-keys.js'
export { isDaemonRunning, queryDaemon, fetchDaemonModels, DAEMON_PORT, DAEMON_BASE_URL } from './daemon-client.js'
export { createCacheStore, DEFAULT_CACHE_TTL_MS } from './cache.js'
export {
  normalizeBaseUrl,
  getProviderId,
  getOpenCodeEnvName,
  buildPiProviderDescriptor,
  buildOpenCodeProviderDescriptor,
  buildOpenCodeModelDescriptor,
  buildSmartRouterDescriptor
} from './provider-config-builders.js'
