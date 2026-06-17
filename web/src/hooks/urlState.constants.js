/**
 * @file web/src/hooks/urlState.constants.js
 * @description URL param validation tables — extracted from useUrlState for testability.
 * 📖 Keep these in sync with src/tui/tui-state.js TIER_CYCLE / VERDICT_CYCLE /
 * 📖 HEALTH_CYCLE constants so the URL reflects the same filter universe
 * 📖 the TUI uses.
 */
import { TOOL_MODE_ORDER } from '../../../src/core/tool-metadata.js'

const TIER_VALUES = new Set(['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C', 'all'])
const STATUS_VALUES = new Set(['up', 'down', 'pending', 'all'])
const SORT_VALUES = new Set([
  'mood', 'idx', 'tier', 'sweScore', 'ctx', 'label', 'origin',
  'latestPing', 'avg', 'condition', 'verdict', 'stability', 'uptime',
  'aiLatency', 'tps', 'trend',
])
const VIEW_VALUES = new Set(['dashboard', 'settings', 'analytics', 'recommend', 'router', 'help', 'changelog', 'playground', 'install-endpoints', 'installed-models'])
const DIR_VALUES = new Set(['asc', 'desc'])
const TOOL_MODE_VALUES = new Set(TOOL_MODE_ORDER)

export {
  TIER_VALUES as VALID_TIERS,
  STATUS_VALUES as VALID_STATUS,
  SORT_VALUES as VALID_SORTS,
  VIEW_VALUES as VALID_VIEWS,
  DIR_VALUES as VALID_DIRS,
  TOOL_MODE_VALUES as VALID_TOOL_MODES,
}
