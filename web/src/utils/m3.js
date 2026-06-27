/**
 * @file web/src/utils/m3.js
 * @description Small pure helpers for M3 Web parity tests. They keep payload
 * validation/formatting deterministic without importing React components.
 *
 * @functions
 *   → recommendScoreShape — validates `/api/recommend` Top 3 payload shape
 *   → toolInstallSummary — formats a tool install plan for display
 * @exports INSTALL_ENDPOINT_TOOL_MODES, recommendScoreShape, toolInstallSummary
 */

export const INSTALL_ENDPOINT_TOOL_MODES = [
  'opencode',
  'opencode-desktop',
  'opencode-web',
  'openclaw',
  'crush',
  'goose',
  'pi',
  'aider',
  'qwen',
  'openhands',
  'amp',
  'forgecode',
  'fcm_router',
  'zcode',
]

export function recommendScoreShape(payload) {
  const top3 = Array.isArray(payload?.top3) ? payload.top3 : []
  return top3.every((entry) => {
    const result = entry?.result
    return Boolean(result)
      && typeof result.providerKey === 'string'
      && typeof result.modelId === 'string'
      && typeof result.label === 'string'
      && typeof entry.score === 'number'
      && entry.score >= 0
      && entry.score <= 100
      && typeof entry.reason === 'string'
      && entry.reason.length > 0
  })
}

export function toolInstallSummary(plan) {
  if (!plan || typeof plan !== 'object') {
    return { supported: false, title: 'Unknown tool', command: null, docsUrl: null, note: null }
  }
  return {
    supported: plan.supported === true,
    title: plan.summary || plan.reason || `Install ${plan.mode || 'tool'}`,
    command: typeof plan.shellCommand === 'string' ? plan.shellCommand : null,
    docsUrl: typeof plan.docsUrl === 'string' ? plan.docsUrl : null,
    note: typeof plan.note === 'string' ? plan.note : null,
  }
}
