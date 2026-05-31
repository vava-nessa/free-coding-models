/**
 * @file src/tool-metadata.js
 * @description Shared metadata for supported launch targets and mode ordering.
 *
 * @details
 *   📖 The TUI now supports more than the historical OpenCode/OpenClaw trio.
 *   Centralizing mode metadata keeps the header badge, help screen, key handler,
 *   and CLI parsing aligned instead of hard-coding tool names in multiple files.
 *
 *   📖 The metadata here is intentionally small:
 *   - display label for the active tool badge
 *   - optional emoji for compact UI hints
 *   - flag name used in CLI help
 *
 *   📖 External tool integrations are still implemented elsewhere. This file only
 *   answers "what modes exist?" and "how should they be presented to the user?".
 *
 * @functions
 *   → `getToolMeta` — return display metadata for one mode
 *   → `getToolModeOrder` — stable mode cycle order for the `Z` hotkey
 *
 * @exports TOOL_METADATA, TOOL_MODE_ORDER, COMPAT_COLUMN_SLOTS, getToolMeta, getToolModeOrder
 */
// 📖 Each tool has a unique `color` RGB tuple used for the "Compatible with" column
// 📖 and for coloring the tool name in the Z cycle header badge.
// 📖 `emoji` is the unique icon shown everywhere (header badge, compat column, palette, overlays).
// 📖 OpenCode CLI and Desktop share 📦 — they are the same platform, split only for launch logic.
export const TOOL_METADATA = {
  opencode:          { label: 'OpenCode CLI',     emoji: '📦', flag: '--opencode',         color: [110, 214, 255] },
  'opencode-desktop': { label: 'OpenCode Desktop', emoji: '📦', flag: '--opencode-desktop', color: [149, 205, 255] },
  'opencode-web':     { label: 'OpenCode Web',     emoji: '📦', flag: '--opencode-web',     color: [180, 220, 255] },
  openclaw:          { label: 'OpenClaw',          emoji: '🦞', flag: '--openclaw',         color: [255, 129, 129] },
  crush:             { label: 'Crush',             emoji: '💘', flag: '--crush',            color: [255, 168, 209] },
  goose:             { label: 'Goose',             emoji: '🪿', flag: '--goose',            color: [132, 235, 168] },
  pi:                { label: 'Pi',                emoji: 'π',  flag: '--pi',               color: [173, 216, 230] },
  aider:             { label: 'Aider',             emoji: '🛠', flag: '--aider',            color: [255, 208, 102] },
  kilo:              { label: 'Kilo CLI',          emoji: '⚡️', flag: '--kilo',             color: [255, 107, 107] },
  qwen:              { label: 'Qwen Code',         emoji: '🐉', flag: '--qwen',             color: [255, 213, 128] },
  openhands:         { label: 'OpenHands',         emoji: '🤲', flag: '--openhands',        color: [228, 191, 239] },
  amp:               { label: 'Amp',               emoji: '⚡', flag: '--amp',              color: [255, 232, 98] },
  hermes:            { label: 'Hermes',            emoji: '🔮', flag: '--hermes',           color: [200, 160, 255] },
  'continue':        { label: 'Continue CLI',     emoji: '▶️', flag: '--continue',         color: [255, 100, 100] },
  cline:             { label: 'Cline',             emoji: '🧠', flag: '--cline',            color: [100, 220, 180] },
  rovo:              { label: 'Rovo Dev CLI',      emoji: '🦘', flag: '--rovo',             color: [148, 163, 184], cliOnly: true },
  gemini:            { label: 'Gemini CLI',        emoji: '♊', flag: '--gemini',           color: [66, 165, 245],  cliOnly: true },
  caveman:           { label: 'Caveman Code',      emoji: '🪨', flag: '--caveman',          color: [180, 130, 80] },
  jcode:             { label: 'jcode',              emoji: '🪼', flag: '--jcode',             color: [255, 140, 0]  },
  xcode:             { label: 'Xcode Intelligence',emoji: '🛠️', flag: '--xcode',            color: [20, 126, 251] },
  fcm_router:        { label: 'FCM Router',        emoji: '🧭', flag: '--fcm-router',        color: [80, 200, 120] },
  copilot:           { label: 'Copilot CLI',       emoji: '🤖', flag: '--copilot',          color: [200, 220, 255] },
  forgecode:         { label: 'ForgeCode',         emoji: '🔥', flag: '--forgecode',        color: [255, 120, 50] },
}

// 📖 Deduplicated emoji order for the "Compatible with" column.
// 📖 OpenCode CLI + Desktop are merged into a single 📦 slot since they share compatibility.
// 📖 Each slot maps to one or more toolKeys for compatibility checking.
export const COMPAT_COLUMN_SLOTS = [
  { emoji: '📦', toolKeys: ['opencode', 'opencode-desktop', 'opencode-web'], color: [110, 214, 255] },
  { emoji: '🦞', toolKeys: ['openclaw'],                     color: [255, 129, 129] },
  { emoji: '💘', toolKeys: ['crush'],                        color: [255, 168, 209] },
  { emoji: '🪿', toolKeys: ['goose'],                        color: [132, 235, 168] },
  { emoji: 'π',  toolKeys: ['pi'],                           color: [173, 216, 230] },
  { emoji: '🛠', toolKeys: ['aider'],                        color: [255, 208, 102] },
  { emoji: '⚡️', toolKeys: ['kilo'],                         color: [255, 107, 107] },
  { emoji: '🐉', toolKeys: ['qwen'],                         color: [255, 213, 128] },
  { emoji: '🤲', toolKeys: ['openhands'],                    color: [228, 191, 239] },
  { emoji: '⚡', toolKeys: ['amp'],                          color: [255, 232, 98] },
  { emoji: '🔮', toolKeys: ['hermes'],                       color: [200, 160, 255] },
  { emoji: '▶️', toolKeys: ['continue'],                     color: [255, 100, 100] },
  { emoji: '🧠', toolKeys: ['cline'],                        color: [100, 220, 180] },
  { emoji: '🧭', toolKeys: ['fcm_router'],                  color: [80, 200, 120] },
  { emoji: '🦘', toolKeys: ['rovo'],                        color: [148, 163, 184] },
  { emoji: '♊', toolKeys: ['gemini'],                       color: [66, 165, 245] },
  { emoji: '🪨', toolKeys: ['caveman'],                      color: [180, 130, 80] },
  { emoji: '🪼', toolKeys: ['jcode'],                        color: [255, 140, 0]  },
  { emoji: '🛠️', toolKeys: ['xcode'],                        color: [20, 126, 251] },
  { emoji: '🤖', toolKeys: ['copilot'],                      color: [200, 220, 255] },
  { emoji: '🔥', toolKeys: ['forgecode'],                    color: [255, 120, 50] },
]

export const TOOL_MODE_ORDER = [
  'opencode',
  'pi',
  'jcode',
  'opencode-desktop',
  'opencode-web',
  'openclaw',
  'crush',
  'goose',
  'aider',
  'kilo',
  'qwen',
  'openhands',
  'amp',
  'hermes',
  'continue',
  'cline',
  'xcode',
  'fcm_router',
  'rovo',
  'gemini',
  'caveman',
  'copilot',
  'forgecode',
]

export function getToolMeta(mode) {
  return TOOL_METADATA[mode] || { label: mode, emoji: '•', flag: null }
}

export function getToolModeOrder() {
  return [...TOOL_MODE_ORDER]
}

// 📖 Regular tools: all tools EXCEPT rovo, gemini (which are CLI-only exclusives).
// 📖 Used as the default compatible set for normal provider models.
const REGULAR_TOOLS = Object.keys(TOOL_METADATA).filter(k => !TOOL_METADATA[k].cliOnly)

// 📖 Zen models use OpenAI-compatible endpoints (https://opencode.ai/zen/v1/chat/completions)
// 📖 and can be used by ANY tool that supports custom OpenAI-compatible providers.
// 📖 They are NOT locked to OpenCode — confirmed by OpenCode's own "no lock-in" design goal.
// 📖 Only CLI-only tools (rovo, gemini) are excluded since they have their own exclusive models.

/**
 * 📖 Returns the list of tool keys a model is compatible with.
 *   - Rovo models → only 'rovo'
 *   - Gemini models → only 'gemini'
 *   - OpenCode Zen models → all non-cliOnly tools (Zen uses OpenAI-compatible endpoints)
 *   - Regular models → all non-cliOnly tools
 * @param {string} providerKey — the source key from sources.js (e.g. 'nvidia', 'rovo', 'opencode-zen')
 * @returns {string[]} — array of compatible tool keys
 */
export function getCompatibleTools(providerKey) {
  if (providerKey === 'rovo') return ['rovo']
  if (providerKey === 'gemini') return ['gemini']
  // 📖 Zen models use /v1/chat/completions — compatible with any OpenAI-compatible tool
  if (providerKey === 'opencode-zen') return REGULAR_TOOLS
  return REGULAR_TOOLS
}

/**
 * 📖 Checks whether a model from the given provider can run on the specified tool mode.
 * @param {string} providerKey — source key
 * @param {string} toolMode — active tool mode
 * @returns {boolean}
 */
export function isModelCompatibleWithTool(providerKey, toolMode) {
  return getCompatibleTools(providerKey).includes(toolMode)
}

/**
 * 📖 Finds compatible models with a similar SWE score to the selected one.
 * 📖 Used by the incompatibility fallback overlay to suggest alternatives.
 * @param {string} selectedSwe — SWE score string like '72.0%' or '-'
 * @param {string} toolMode — current active tool mode
 * @param {Array} allResults — the state.results array (each has .providerKey, .modelId, .label, .tier, .sweScore)
 * @param {number} [maxResults=3] — max suggestions to return
 * @returns {{ modelId: string, label: string, tier: string, sweScore: string, providerKey: string, sweDelta: number }[]}
 */
export function findSimilarCompatibleModels(selectedSwe, toolMode, allResults, maxResults = 3) {
  const targetSwe = parseFloat(selectedSwe) || 0
  return allResults
    .filter(r => !r.hidden && isModelCompatibleWithTool(r.providerKey, toolMode))
    .map(r => ({
      modelId: r.modelId,
      label: r.label,
      tier: r.tier,
      sweScore: r.sweScore || '-',
      providerKey: r.providerKey,
      sweDelta: Math.abs((parseFloat(r.sweScore) || 0) - targetSwe),
    }))
    .sort((a, b) => a.sweDelta - b.sweDelta)
    .slice(0, maxResults)
}
