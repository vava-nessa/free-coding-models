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
 * @exports TOOL_METADATA, TOOL_MODE_ORDER, getToolMeta, getToolModeOrder
 */

export const TOOL_METADATA = {
  opencode: { label: 'OpenCode CLI', emoji: '💻', flag: '--opencode' },
  'opencode-desktop': { label: 'OpenCode Desktop', emoji: '🖥', flag: '--opencode-desktop' },
  openclaw: { label: 'OpenClaw', emoji: '🦞', flag: '--openclaw' },
  crush: { label: 'Crush', emoji: '💘', flag: '--crush' },
  goose: { label: 'Goose', emoji: '🪿', flag: '--goose' },
  // aider: { label: 'Aider', emoji: '🛠', flag: '--aider' },
  // 'claude-code': { label: 'Claude Code', emoji: '🧠', flag: '--claude-code' },
  // codex: { label: 'Codex CLI', emoji: '⌘', flag: '--codex' },
  // gemini: { label: 'Gemini CLI', emoji: '✦', flag: '--gemini' },
  // qwen: { label: 'Qwen Code', emoji: '🌊', flag: '--qwen' },
  // openhands: { label: 'OpenHands', emoji: '🤲', flag: '--openhands' },
  // amp: { label: 'Amp', emoji: '⚡', flag: '--amp' },
  // pi: { label: 'Pi', emoji: 'π', flag: '--pi' },
}

export const TOOL_MODE_ORDER = [
  'opencode',
  'opencode-desktop',
  'openclaw',
  'crush',
  'goose',
  // 'aider',
  // 'claude-code',
  // 'codex',
  // 'gemini',
  // 'qwen',
  // 'openhands',
  // 'amp',
  // 'pi',
]

export function getToolMeta(mode) {
  return TOOL_METADATA[mode] || { label: mode, emoji: '•', flag: null }
}

export function getToolModeOrder() {
  return [...TOOL_MODE_ORDER]
}
