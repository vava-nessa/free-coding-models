/**
 * @file ui-config.js
 * @description Central configuration helpers for TUI separators and spacing.
 * 
 * @details
 * This module centralizes the shared table separators used by the TUI. The
 * theme can change at runtime, so separators must be generated lazily instead
 * of frozen once at import time.
 * 
 * 📖 Configuration:
 * - `getVerticalSeparator()` — theme-aware vertical divider
 * - `getHorizontalLine()` — theme-aware horizontal divider
 * - `getColumnSpacing()` — formatted spacing wrapper around the divider
 * 
 * @see render-table.js - uses these constants for rendering
 * @see tier-colors.js - for tier-specific color definitions
 */

import { themeColors } from './theme.js'

// 📖 Column separator stays subtle so it improves scanability without turning
// 📖 the table into a bright fence.
export function getVerticalSeparator() {
  return themeColors.border('│')
}

export function getHorizontalLine() {
  return themeColors.dim('─')
}

export function getColumnSpacing() {
  return ` ${getVerticalSeparator()} `
}

export const TABLE_PADDING = 1

export default {
  getVerticalSeparator,
  getHorizontalLine,
  getColumnSpacing,
  TABLE_PADDING
}
