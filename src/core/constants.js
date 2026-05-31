/**
 * @file constants.js
 * @description Pure terminal/TUI constants extracted from bin/free-coding-models.js.
 *
 * @details
 *   This module centralises every "magic number" and escape-sequence constant that
 *   the TUI rendering pipeline depends on.  Having them here means:
 *   - They are importable by unit tests without pulling in the entire CLI entry point.
 *   - A single source of truth for column widths, timing values, overlay colours, etc.
 *   - `msCell` and `spinCell` live here too because they only depend on `CELL_W`,
 *     `FRAMES`, and chalk — all of which are available at module scope.
 *
 *   ⚙️ Key configuration:
 *   - `PING_TIMEOUT` / `PING_INTERVAL` control how aggressive the health-check loop is.
 *   - `FPS` controls animation frame rate (braille spinner).
 *   - `COL_MODEL` / `COL_MS` control legacy ping-column widths (retained for compat).
 *   - `CELL_W` is derived from `COL_MS` and used by `msCell` / `spinCell`.
 *   - `TABLE_HEADER_LINES` and footer line counts must stay in sync with the
 *     actual number of lines rendered by `renderTable()`.
 *   - `WIDTH_WARNING_MIN_COLS` controls when the narrow-terminal startup warning appears.
 *   - Overlay background colours (chalk.bgRgb) make each overlay panel visually distinct.
 *
 * @functions
 *   → msCell(ms)       — Formats a latency value into a fixed-width coloured cell string
 *   → spinCell(f, o)   — Returns a braille spinner cell at frame f with optional offset o
 *
 * @exports
 *   ALT_ENTER, ALT_LEAVE, ALT_HOME,
 *   PING_TIMEOUT, PING_INTERVAL,
 *   FPS, COL_MODEL, COL_MS, CELL_W,
 *   FRAMES, TIER_CYCLE,
 *   SETTINGS_OVERLAY_BG, HELP_OVERLAY_BG, RECOMMEND_OVERLAY_BG, LOG_OVERLAY_BG,
 *   OVERLAY_PANEL_WIDTH,
 *   WIDTH_WARNING_MIN_COLS,
 *   TABLE_HEADER_LINES, TABLE_FOOTER_LINES, TABLE_FIXED_LINES,
 *   msCell, spinCell
 *
 * @see bin/free-coding-models.js  — main entry point that imports these constants
 * @see src/tier-colors.js         — TIER_COLOR map (chalk-dependent, separate module)
 */

import chalk from 'chalk'

// 📖 Alternate screen ANSI escape sequences used to enter/leave the TUI buffer.
// 📖 \x1b[?1049h = enter alt screen  \x1b[?1049l = leave alt screen
// 📖 \x1b[?25l   = hide cursor        \x1b[?25h   = show cursor
// 📖 \x1b[H      = cursor to top
// 📖 \x1b[?7l disables auto-wrap so wide rows clip at the right edge instead of
// 📖 wrapping to the next line (which would double the row height and overflow).
// 📖 Mouse tracking sequences are appended/prepended so clicks and scroll work in the TUI.
import { MOUSE_ENABLE, MOUSE_DISABLE } from '../tui/mouse.js'

export const ALT_ENTER = '\x1b[?1049h\x1b[?25l\x1b[?7l' + MOUSE_ENABLE
export const ALT_LEAVE = MOUSE_DISABLE + '\x1b[?7h\x1b[?1049l\x1b[?25h'
export const ALT_HOME  = '\x1b[H'

// 📖 Timing constants — control how fast the health-check loop runs.
export const PING_TIMEOUT  = 15_000  // 📖 15s per attempt before abort
// 📖 PING_INTERVAL is the baseline "normal" cadence. Startup can still temporarily
// 📖 boost to faster modes, but steady-state uses 10s unless the user picks another mode.
export const PING_INTERVAL = 10_000

// 📖 Animation and column-width constants.
export const FPS       = 12
export const COL_MODEL = 22
// 📖 COL_MS = dashes in hline per ping column = visual width including 2 padding spaces.
// 📖 Max value: 12001ms = 7 chars. padStart(COL_MS-2) fits content, +2 spaces = COL_MS dashes.
export const COL_MS    = 11

// 📖 CELL_W = visual content width of a single ms/spinner cell (COL_MS minus 2 border spaces).
export const CELL_W = COL_MS - 2  // 📖 9 chars of content per ms cell

// 📖 Braille spinner frames for the "pinging..." animation.
export const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']

// 📖 TIER_CYCLE: ordered list of tier-filter states cycled by the T key.
// 📖 Index 0 = no filter (show all), then each tier name in descending quality order.
export const TIER_CYCLE = [null, 'S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C']

// 📖 VERDICT_CYCLE: cycles through health verdict labels (0=All, then each verdict).
// 📖 Based on VERDICT_ORDER from utils.js — includes all possible getVerdict() values.
export const VERDICT_CYCLE = [null, 'Perfect', 'Normal', 'Slow', 'Spiky', 'Very Slow', 'Overloaded', 'Unstable', 'Not Active', 'Pending']

// 📖 HEALTH_CYCLE: cycles through ping status states (0=All, then each status).
// 📖 Based on the status values in the app: up, timeout, down, auth_error, noauth, pending.
export const HEALTH_CYCLE = [null, 'up', 'timeout', 'down', 'auth_error', 'noauth', 'pending']

// 📖 Overlay background chalk functions — each overlay panel has a distinct tint
// 📖 so users can tell Settings, Help, Recommend, and Log panels apart at a glance.
export const SETTINGS_OVERLAY_BG  = chalk.bgRgb(0, 0, 0)
export const HELP_OVERLAY_BG      = chalk.bgRgb(0, 0, 0)
export const RECOMMEND_OVERLAY_BG = chalk.bgRgb(0, 0, 0)  // 📖 Green tint for Smart Recommend
export const LOG_OVERLAY_BG       = chalk.bgRgb(0, 0, 0)  // 📖 Dark blue-green tint for Log page

// 📖 OVERLAY_PANEL_WIDTH: fixed character width of all overlay panels so background
// 📖 tint fills the panel consistently regardless of content length.
export const OVERLAY_PANEL_WIDTH = 116

// 📖 Narrow-terminal warning appears only below this width.
export const WIDTH_WARNING_MIN_COLS = 80

// 📖 Table row-budget constants — must stay in sync with renderTable()'s actual output.
// 📖 If this drifts, model rows overflow and can push the title row out of view.
export const TABLE_HEADER_LINES = 2  // 📖 title, column headers
export const TABLE_FOOTER_LINES = 3  // 📖 actions, links, speed test
export const TABLE_FIXED_LINES  = TABLE_HEADER_LINES + TABLE_FOOTER_LINES

// ─── Small cell-formatting helpers ────────────────────────────────────────────

/**
 * 📖 msCell: Renders a latency measurement into a right-padded coloured cell.
 * 📖 null  → dim dash (not yet pinged)
 * 📖 'TIMEOUT' → red TIMEOUT text
 * 📖 <500ms → bright green, <1500ms → yellow, else red
 * @param {number|string|null} ms
 * @returns {string}
 */
export const msCell = (ms) => {
  if (ms === null) return chalk.dim('—'.padStart(CELL_W))
  const str = String(ms).padStart(CELL_W)
  if (ms === 'TIMEOUT') return chalk.red(str)
  if (ms < 500)  return chalk.greenBright(str)
  if (ms < 1500) return chalk.yellow(str)
  return chalk.red(str)
}

/**
 * 📖 spinCell: Returns a braille spinner character padded to CELL_W.
 * 📖 f = current frame index, o = row offset so each row animates differently.
 * @param {number} f - global frame counter
 * @param {number} [o=0] - per-row offset to stagger animation
 * @returns {string}
 */
export const spinCell = (f, o = 0) => chalk.dim.yellow(FRAMES[(f + o) % FRAMES.length].padEnd(CELL_W))
