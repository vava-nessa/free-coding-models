/**
 * @file ping-loop.js
 * @description Ping cadence management — mode transitions, scheduling, and auto-throttle logic.
 *
 * @details
 *   The ping loop runs forever in the background, probing model endpoints at a cadence
 *   determined by the current "ping mode" (speed / normal / slow / forced).
 *
 *   🎯 Mode transitions:
 *   - **speed**: Active on startup (2s intervals). Auto-falls back to normal after 60s.
 *   - **normal**: Steady state (10s intervals). The default after speed burst expires.
 *   - **slow**: Idle throttle (30s intervals). Activates after 5 minutes of no user interaction.
 *   - **forced**: User-triggered fast burst (4s, W key). Ignores idle / auto slowdowns.
 *
 *   📖 This module exports factory functions that close over the state object,
 *   so each app instance gets its own ping loop with its own timers.
 *
 * @functions
 *   → createPingLoop(state) — Returns { setPingMode, refreshAutoPingMode, noteUserActivity }
 *
 * @exports createPingLoop
 *
 * @see src/tui-state.js — PING_MODE_INTERVALS, SPEED_MODE_DURATION_MS, IDLE_SLOW_AFTER_MS
 * @see src/app.js — calls createPingLoop() and wires into the TUI event loop
 */

import {
  PING_MODE_INTERVALS,
  SPEED_MODE_DURATION_MS,
  IDLE_SLOW_AFTER_MS,
} from '../tui/tui-state.js'

/**
 * 📖 createPingLoop: Build the ping loop control functions for a given TUI state.
 *
 * 📖 Returns an object with all the ping cadence control functions that were previously
 * 📖 inline closures in runApp(). Each function closes over the provided `state` object.
 *
 * @param {object} state — The TUI state object (from createTuiState)
 * @returns {{
 *   setPingMode: (nextMode: string, source?: string) => void,
 *   refreshAutoPingMode: () => void,
 *   noteUserActivity: () => void,
 * }}
 */
export function createPingLoop(state) {
  /**
   * 📖 setPingMode: Switch the active ping mode and update the interval.
   * @param {string} nextMode — 'speed' | 'normal' | 'slow' | 'forced'
   * @param {string} [source='manual'] — Why the mode changed (startup | manual | auto | idle | activity)
   */
  function setPingMode(nextMode, source = 'manual') {
    const modeInterval = PING_MODE_INTERVALS[nextMode] ?? PING_MODE_INTERVALS.normal
    state.pingMode = nextMode
    state.pingModeSource = source
    state.pingInterval = modeInterval
    state.speedModeUntil = nextMode === 'speed' ? Date.now() + SPEED_MODE_DURATION_MS : null
    state.resumeSpeedOnActivity = source === 'idle'
    // 📖 Clear existing timer so the next scheduleNextPing() call picks up the new interval.
    // 📖 The caller (app.js) owns scheduleNextPing and re-schedules after calling setPingMode.
    clearTimeout(state.pingIntervalObj)
  }

  /**
   * 📖 refreshAutoPingMode: Check timers and auto-transition between ping modes.
   * 📖 Called at the start of each ping cycle and each render frame.
   */
  function refreshAutoPingMode() {
    const currentTime = Date.now()
    if (state.pingMode === 'forced') return

    // 📖 Speed burst expired → fall back to normal
    if (state.speedModeUntil && currentTime >= state.speedModeUntil) {
      setPingMode('normal', 'auto')
      return
    }

    // 📖 User idle for too long → slow down
    if (currentTime - state.lastUserActivityAt >= IDLE_SLOW_AFTER_MS) {
      if (state.pingMode !== 'slow' || state.pingModeSource !== 'idle') {
        setPingMode('slow', 'idle')
      } else {
        state.resumeSpeedOnActivity = true
      }
    }
  }

  /**
   * 📖 noteUserActivity: Mark that the user is active (key was pressed).
   * 📖 Restarts a speed burst if the loop was previously slowed by idle.
   */
  function noteUserActivity() {
    state.lastUserActivityAt = Date.now()
    if (state.pingMode === 'forced') return
    if (state.resumeSpeedOnActivity) {
      setPingMode('speed', 'activity')
    }
  }

  return {
    setPingMode,
    refreshAutoPingMode,
    noteUserActivity,
  }
}
