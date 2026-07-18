/**
 * @file pi-progress-renderer.js
 * @description Pi status-bar renderer for FCM scan progress events.
 *
 * @details
 *   The shared core emits structured progress events (phase/percent/activeModels);
 *   it never renders. This module owns the Pi footer presentation: a magenta
 *   Braille spinner animated on a timer, the yellow phase label, and the branded
 *   `> free-coding-models` badge in the exact green/white-on-black colours of
 *   the main FCM TUI header logo. The live `%` and `(completed/total)` counter
 *   stay beside the badge.
 *
 *   One renderer = one scan. `start()` begins the 80ms spinner animation,
 *   `update(event)` is fed by the core's `onProgress`, and `stop()` clears the
 *   Pi footer again (FCM stays silent unless a scan is actively running).
 *
 * @functions
 *   - createPiStatusRenderer → Build { start, update, stop } for one scan
 */

import chalk from 'chalk'

// 📖 Brand logo colours — mirror the main FCM TUI header (dark theme palette)
// 📖 so the footer badge looks identical to the `> free-coding-models_` header.
const HEADER_BG = [0, 0, 0]
const HEADER_GREEN = [118, 185, 0]
const HEADER_WHITE = [255, 255, 255]

const hBold = (color, text) => chalk.rgb(...color).bgRgb(...HEADER_BG).bold(text)

// 📖 Pre-built brand badge: `> free-coding-models` (green > free, white -coding-models)
const BADGE = `${hBold(HEADER_GREEN, '> ')}${hBold(HEADER_GREEN, 'free')}${hBold(HEADER_WHITE, '-coding-models')}`

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const DEFAULT_INTERVAL_MS = 80

/**
 * 📖 Build a Pi status renderer for one scan lifecycle.
 *
 * @param {object} options
 * @param {function} options.setStatus - Pi `ctx.ui.setStatus('fcm', string|undefined)`
 * @param {number} [options.intervalMs=80] - Spinner animation refresh rate
 * @returns {{ start: Function, update: Function, stop: Function }}
 */
export function createPiStatusRenderer({ setStatus, intervalMs = DEFAULT_INTERVAL_MS }) {
  const safeSetStatus = typeof setStatus === 'function' ? setStatus : () => {}
  let frame = 0
  let latest = null
  let timer = null

  const render = () => {
    const spinner = chalk.bold.magenta(SPINNER_FRAMES[frame])
    const ev = latest || { phase: 'idle' }

    let line
    if (ev.phase === 'probing' || ev.phase === 'benchmarking') {
      const action = chalk.bold.yellow(`${ev.action || (ev.phase === 'probing' ? 'Probing' : 'Benchmarking')}:`)
      const pctStr = chalk.bold.cyan(`${ev.percent ?? 0}%`)
      const counterStr = chalk.gray(`(${ev.completed ?? 0}/${ev.total ?? 0})`)
      line = `${spinner} ${action} ${BADGE} — ${pctStr} ${counterStr}`
    } else if (ev.phase === 'error') {
      line = `${spinner} ${chalk.red(ev.message || 'FCM scan error')}`
    } else if (ev.phase === 'done') {
      // 📖 Done is rendered briefly then cleared by stop(); keep a quiet line.
      line = `${spinner} ${chalk.dim('FCM scan complete')}`
    } else if (ev.message) {
      // 📖 daemon-check and other plain-message phases
      line = `${spinner} ${ev.message}`
    } else {
      line = `${spinner} ${chalk.gray('FCM…')}`
    }

    safeSetStatus(line)
  }

  return {
    start() {
      if (timer) return
      timer = setInterval(() => {
        frame = (frame + 1) % SPINNER_FRAMES.length
        render()
      }, intervalMs)
      render()
    },

    update(event) {
      latest = event || latest
      if (event?.phase === 'done' || event?.phase === 'error') frame = frame // keep last frame feel
      render()
    },

    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      latest = null
      try {
        safeSetStatus(undefined)
      } catch (err) {
        // 📖 UI cleanup must never break the agent lifecycle.
      }
    }
  }
}
