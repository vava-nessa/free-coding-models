/**
 * @file mouse.js
 * @description Terminal mouse tracking infrastructure for the TUI.
 *
 * @details
 *   Provides SGR (mode 1006) mouse event parsing and tracking enable/disable sequences.
 *   SGR mode is preferred over X10/normal because it supports coordinates > 223
 *   and distinguishes press vs release events cleanly.
 *
 *   Mouse events arrive as raw escape sequences on stdin when tracking is enabled:
 *     Press:   \x1b[<Btn;X;YM
 *     Release: \x1b[<Btn;X;Ym
 *
 *   Button encoding (Btn field):
 *     0 = left click, 1 = middle click, 2 = right click
 *     32 = left drag, 33 = middle drag, 34 = right drag
 *     64 = scroll up, 65 = scroll down
 *     +4 = Shift held, +8 = Meta/Alt held, +16 = Control held
 *
 *   Coordinates are 1-based in SGR mode (col 1, row 1 = top-left).
 *
 *   ⚙️ Key configuration:
 *   - MOUSE_ENABLE: appended to ALT_ENTER to start mouse tracking on TUI init
 *   - MOUSE_DISABLE: prepended to ALT_LEAVE to stop mouse tracking on TUI exit
 *   - DOUBLE_CLICK_MS: maximum gap between two clicks to count as double-click
 *
 * @functions
 *   → parseMouseEvent(data)      — Parse raw stdin buffer into structured mouse event
 *   → createMouseHandler(opts)   — Create a stdin 'data' listener that emits mouse events
 *
 * @exports
 *   MOUSE_ENABLE, MOUSE_DISABLE,
 *   parseMouseEvent, createMouseHandler
 *
 * @see src/app.js          — wires the mouse data listener alongside keypress
 * @see src/key-handler.js  — receives parsed mouse events for UI actions
 * @see src/constants.js    — ALT_ENTER / ALT_LEAVE include mouse sequences
 */

// 📖 SGR mouse mode (1006) sends coordinates as decimal numbers terminated by M/m,
// 📖 supporting terminals wider than 223 columns (unlike X10 mode).
// 📖 Mode 1000 = basic button tracking (press + release).
// 📖 Mode 1002 = button-event tracking (adds drag reporting).
// 📖 Mode 1003 = any-event tracking (adds mouse movement) — intentionally NOT used
// 📖 because movement floods stdin and we don't need hover.
export const MOUSE_ENABLE  = '\x1b[?1000h\x1b[?1002h\x1b[?1006h'
export const MOUSE_DISABLE = '\x1b[?1006l\x1b[?1002l\x1b[?1000l'

// 📖 Double-click detection window in milliseconds.
const DOUBLE_CLICK_MS = 400

// 📖 Regex to match SGR mouse sequences: \x1b[<Btn;Col;Row[Mm]
// 📖 Groups: 1=button, 2=column(x), 3=row(y), 4=M(press)|m(release)
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g

/**
 * 📖 parseMouseEvents: Extract all SGR mouse events from a raw stdin data chunk.
 * 📖 A single data chunk can contain multiple mouse events (e.g. rapid scrolling).
 * @param {string|Buffer} data — raw stdin data
 * @returns {Array<{button: number, x: number, y: number, type: string, shift: boolean, meta: boolean, ctrl: boolean}>}
 */
export function parseMouseEvents(data) {
  const str = typeof data === 'string' ? data : data.toString('utf8')
  const events = []
  let match

  // 📖 Reset regex lastIndex for reuse
  SGR_MOUSE_RE.lastIndex = 0

  while ((match = SGR_MOUSE_RE.exec(str)) !== null) {
    const rawBtn = parseInt(match[1], 10)
    const x = parseInt(match[2], 10) // 📖 1-based column
    const y = parseInt(match[3], 10) // 📖 1-based row
    const isRelease = match[4] === 'm'

    // 📖 Extract modifier keys from the button field
    const shift = !!(rawBtn & 4)
    const meta  = !!(rawBtn & 8)
    const ctrl  = !!(rawBtn & 16)

    // 📖 Strip modifier bits to get the base button
    const baseBtn = rawBtn & ~(4 | 8 | 16)

    let type, button

    if (baseBtn === 64) {
      type = 'scroll-up'
      button = 'scroll-up'
    } else if (baseBtn === 65) {
      type = 'scroll-down'
      button = 'scroll-down'
    } else if (baseBtn >= 32 && baseBtn <= 34) {
      type = 'drag'
      button = baseBtn === 32 ? 'left' : baseBtn === 33 ? 'middle' : 'right'
    } else if (isRelease) {
      type = 'release'
      button = baseBtn === 0 ? 'left' : baseBtn === 1 ? 'middle' : 'right'
    } else {
      type = 'press'
      button = baseBtn === 0 ? 'left' : baseBtn === 1 ? 'middle' : 'right'
    }

    events.push({ type, button, x, y, shift, meta, ctrl })
  }

  return events
}

/**
 * 📖 containsMouseSequence: Quick check if a data chunk contains any SGR mouse sequence.
 * 📖 Used to prevent the keypress handler from processing mouse data as keypresses.
 * @param {string|Buffer} data
 * @returns {boolean}
 */
export function containsMouseSequence(data) {
  const str = typeof data === 'string' ? data : data.toString('utf8')
  return str.includes('\x1b[<')
}

/**
 * 📖 createMouseHandler: Factory that returns a stdin 'data' callback for mouse events.
 * 📖 Handles double-click detection internally by tracking the last click position/time.
 *
 * @param {object} opts
 * @param {function} opts.onMouseEvent — callback receiving structured mouse events:
 *   { type: 'click'|'double-click'|'scroll-up'|'scroll-down'|'drag', button, x, y, shift, meta, ctrl }
 * @returns {function} — attach to process.stdin.on('data', returnedFn)
 */
export function createMouseHandler({ onMouseEvent }) {
  // 📖 Double-click tracking state
  let lastClickX = -1
  let lastClickY = -1
  let lastClickTime = 0

  return (data) => {
    const str = typeof data === 'string' ? data : data.toString('utf8')

    // 📖 Only process data that contains mouse sequences
    if (!str.includes('\x1b[<')) return

    const events = parseMouseEvents(str)

    for (const evt of events) {
      // 📖 Scroll events are emitted immediately (no press/release distinction)
      if (evt.type === 'scroll-up' || evt.type === 'scroll-down') {
        onMouseEvent(evt)
        continue
      }

      // 📖 Drag events forwarded as-is
      if (evt.type === 'drag') {
        onMouseEvent(evt)
        continue
      }

      // 📖 Only emit click on release (not press) to match expected click semantics.
      // 📖 This prevents double-firing and feels more natural to the user.
      if (evt.type === 'release' && evt.button === 'left') {
        const now = Date.now()
        const isDoubleClick =
          (now - lastClickTime) < DOUBLE_CLICK_MS &&
          evt.x === lastClickX &&
          evt.y === lastClickY

        if (isDoubleClick) {
          onMouseEvent({ ...evt, type: 'double-click' })
          // 📖 Reset so a third click doesn't count as another double-click
          lastClickTime = 0
          lastClickX = -1
          lastClickY = -1
        } else {
          onMouseEvent({ ...evt, type: 'click' })
          lastClickTime = now
          lastClickX = evt.x
          lastClickY = evt.y
        }
        continue
      }

      // 📖 Right-click and middle-click: emit on release
      if (evt.type === 'release') {
        onMouseEvent({ ...evt, type: 'click' })
      }
    }
  }
}
