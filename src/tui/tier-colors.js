/**
 * @file tier-colors.js
 * @description Theme-aware Chalk colour functions for each tier level.
 *
 * @details
 *   The tier system maps model quality tiers (S+, S, A+, A, A-, B+, B, C) to a
 *   green → yellow → orange → red gradient.  Keeping these colour definitions in their
 *   own module allows the renderer, overlays, and any future CLI tools to share a
 *   single, consistent visual language without depending on the whole TUI entry point.
 *
 *   The gradient is deliberately designed so that the higher the tier the more
 *   The previous palette used very dark reds and bright yellows directly, which
 *   became muddy on dark terminals and nearly invisible on light ones. This
 *   module now delegates to the semantic theme palette so tier colours stay
 *   readable in both modes while keeping the same best→worst ordering.
 *
 * @exports
 *   TIER_COLOR — object mapping tier string → chalk colouring function
 *
 * @see src/constants.js   — TIER_CYCLE ordering that drives the T-key filter
 * @see bin/free-coding-models.js — renderTable() uses TIER_COLOR per row
 */

import chalk from 'chalk'
import { getTierRgb } from './theme.js'

// 📖 TIER_COLOR remains object-like for existing call sites, but every access is
// 📖 resolved lazily from the live theme so `G`/Settings theme switches repaint
// 📖 the whole TUI without rebuilding import-time constants.
export const TIER_COLOR = new Proxy({}, {
  get(_target, tier) {
    if (typeof tier !== 'string') return undefined
    return (text) => chalk.bold.rgb(...getTierRgb(tier))(text)
  },
})
