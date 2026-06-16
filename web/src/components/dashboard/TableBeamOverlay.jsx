/**
 * @file web/src/components/dashboard/TableBeamOverlay.jsx
 * @description Animated "grid beam" canvas overlay that travels along the real
 *   borders of the ModelTable — a faithful port of the cult-ui Grid Beam
 *   (https://www.cult-ui.com/docs/components/grid-beam) adapted to this app's
 *   stack (plain React + CSS Modules, no Tailwind/shadcn) and to the table's
 *   non-uniform geometry (user-resizable columns + expandable rows).
 *
 * 📖 Why a bespoke overlay instead of the stock <GridBeam/>:
 *   The stock component assumes a perfectly uniform rows×cols grid. The model
 *   table is NOT uniform — columns are drag-resizable and rows can expand into
 *   tall detail panels. Dropping a uniform grid on top would paint beams across
 *   the middle of cells. Instead we MEASURE the real separator positions
 *   (column right-edges + row bottom-edges) and route the beams along those
 *   exact lines, so the light always sits ON the borders as requested.
 *
 * 📖 How it stays smooth on a 190-row table:
 *   The canvas is sized to the visible viewport only (not the full scroll
 *   height). Each animation frame reads scrollLeft/scrollTop and draws only the
 *   ~15-25 borders currently on screen, so cost is O(visible) not O(rows).
 *
 * 📖 Choices (per user spec):
 *   - Palette: MONO (grayscale), with dark/light variants.
 *   - Behavior: always animated, but fully paused (static single frame) when the
 *     OS "prefers-reduced-motion" setting is on.
 *
 * @functions
 *   → smoothstep, gaussian — easing helpers ported from cult-ui.
 *   → drawFrame() — one canvas frame: traveling blooms + core lines + intersection glows.
 *   → TableBeamOverlay — React component (refs + rAF + ResizeObserver + measure).
 */
import { useEffect, useRef } from 'react'
import styles from './TableBeamOverlay.module.css'

// ─── Mono palette (grayscale) ────────────────────────────────────────────────
// 📖 Ported verbatim from cult-ui's PALETTES.mono. Each band = [r,g,b,opacity].
// Dark uses light grays on black; light uses dark grays on white so the beams
// read subtly in both themes.
const MONO = {
  dark: {
    h: [
      [200, 200, 200, 0.16], [180, 180, 180, 0.13], [190, 190, 190, 0.16],
      [175, 175, 175, 0.13], [195, 195, 195, 0.16], [185, 185, 185, 0.13],
    ],
    v: [
      [185, 185, 185, 0.16], [170, 170, 170, 0.13], [195, 195, 195, 0.16],
      [180, 180, 180, 0.13], [190, 190, 190, 0.16], [175, 175, 175, 0.13],
    ],
  },
  light: {
    h: [
      [90, 90, 90, 0.13], [110, 110, 110, 0.10], [80, 80, 80, 0.13],
      [100, 100, 100, 0.10], [85, 85, 85, 0.13], [95, 95, 95, 0.10],
    ],
    v: [
      [100, 100, 100, 0.13], [80, 80, 80, 0.10], [90, 90, 90, 0.13],
      [110, 110, 110, 0.10], [85, 85, 85, 0.13], [95, 95, 95, 0.10],
    ],
  },
}

// 📖 Easing helpers — identical math to the cult-ui source.
function smoothstep(t) { return t * t * (3 - 2 * t) }
function gaussian(x, s) { return Math.exp(-(x * x) / (2 * s * s)) }

/**
 * Read the resolved color scheme from <html data-theme="...">.
 * useTheme.js keeps this attribute in sync with the actual rendered theme
 * (it writes "light"/"dark", never "auto"), so this always reflects reality.
 */
function readScheme() {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

/**
 * 📖 Sparsity gate: only ~1 in 5 borders carries a traveling beam at any time.
 * Keeps the effect whisper-quiet on a dense 190-row table instead of a wall
 * of moving light. Deterministic per index so a given border doesn't flicker
 * on/off every frame; the multiplier + stride produce a pseudo-random but
 * stable distribution (no rigid stripes).
 */
function isBorderLit(i) {
  return ((i * 53 + 7) % 9) < 2 // ~22% of borders lit
}

/**
 * Render a single animation frame onto the 2D canvas context.
 * Ported from cult-ui's useBeamCanvas draw() — the bloom + core-line + crossing
 * glow recipe is preserved; only the geometry source changes (measured borders
 * + scroll offset instead of a uniform grid).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o
 */
function drawFrame(ctx, o) {
  const {
    elapsed, scrollX, scrollY, viewW, viewH, geom, scheme,
    strength, breathe, duration, fade,
  } = o
  if (fade <= 0) return
  const palette = MONO[scheme] || MONO.dark
  const gs = fade * strength
  const br = breathe
    ? 0.85 + 0.3 * Math.sin(elapsed * 1.4) + 0.1 * Math.sin(elapsed * 2.3)
    : 1

  const avgCellW = geom.avgCellW || 80
  const avgCellH = geom.avgCellH || 40
  const contentW = geom.contentW || viewW
  const contentH = geom.contentH || viewH

  ctx.clearRect(0, 0, viewW, viewH)

  const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${Math.max(0, a).toFixed(4)})`

  // ── Precompute each visible border's traveling-highlight position ──────────
  const hInfo = [] // horizontal separators (between rows): { y, hlX, band }
  for (let r = 0; r < geom.hBorders.length; r++) {
    const y = geom.hBorders[r] - scrollY
    if (y < -8 || y > viewH + 8) { hInfo.push(null); continue }
    // 📖 Sparsity: skip most horizontal borders so only a handful of beams
    // 📖 are alive at once (see isBorderLit). Non-lit borders still show the
    // 📖 table's own CSS border — we just don't paint a traveling highlight.
    if (!isBorderLit(r)) { hInfo.push(null); continue }
    const band = palette.h[r % palette.h.length]
    const speed = 1 + (r % 3) * 0.12
    const offset = r * 0.21 + (r % 2) * 0.35
    const tt = (((elapsed * speed) / duration) + offset) % 1
    const hlX = tt * contentW - scrollX
    hInfo.push({ y, hlX, band })
  }
  const vInfo = [] // vertical separators (between columns): { x, hlY, band }
  for (let c = 0; c < geom.vBorders.length; c++) {
    const x = geom.vBorders[c] - scrollX
    if (x < -8 || x > viewW + 8) { vInfo.push(null); continue }
    if (!isBorderLit(c)) { vInfo.push(null); continue }
    const band = palette.v[c % palette.v.length]
    const speed = 1 + (c % 3) * 0.1
    const offset = c * 0.26 + (c % 2) * 0.4
    const tt = (((elapsed * speed) / (duration * 1.2)) + offset) % 1
    const hlY = tt * contentH - scrollY
    vInfo.push({ x, hlY, band })
  }

  // ── Horizontal beams (travel left → right along each row separator) ────────
  for (const info of hInfo) {
    if (!info) continue
    const { y, hlX, band } = info
    const [cr, cg, cb, op] = band
    // Soft radial bloom (squashed vertically into a thin horizontal smear).
    const bloomLen = Math.max(1, avgCellW * 0.4 * br)
    const bloomH = 4
    const bg = ctx.createRadialGradient(hlX, y, 0, hlX, y, bloomLen)
    bg.addColorStop(0, rgba(cr, cg, cb, op * 0.3 * gs))
    bg.addColorStop(0.4, rgba(cr, cg, cb, op * 0.12 * gs))
    bg.addColorStop(1, 'transparent')
    ctx.save()
    ctx.scale(1, bloomH / bloomLen)
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(hlX, (y * bloomLen) / bloomH, bloomLen, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Bright core line on the border itself.
    const coreLen = avgCellW * 0.4 * br
    if (hlX - coreLen <= viewW && hlX + coreLen >= 0) {
      const lg = ctx.createLinearGradient(hlX - coreLen, y, hlX + coreLen, y)
      lg.addColorStop(0, 'transparent')
      lg.addColorStop(0.12, rgba(cr, cg, cb, op * 0.4 * gs))
      lg.addColorStop(0.35, rgba(Math.min(255, cr + 60), Math.min(255, cg + 60), Math.min(255, cb + 60), op * 0.8 * gs))
      lg.addColorStop(0.5, rgba(Math.min(255, cr + 100), Math.min(255, cg + 100), Math.min(255, cb + 100), op * 1.0 * gs))
      lg.addColorStop(0.65, rgba(Math.min(255, cr + 60), Math.min(255, cg + 60), Math.min(255, cb + 60), op * 0.8 * gs))
      lg.addColorStop(0.88, rgba(cr, cg, cb, op * 0.4 * gs))
      lg.addColorStop(1, 'transparent')
      ctx.strokeStyle = lg
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(hlX - coreLen, y)
      ctx.lineTo(hlX + coreLen, y)
      ctx.stroke()
    }
  }

  // ── Vertical beams (travel top → bottom along each column separator) ───────
  for (const info of vInfo) {
    if (!info) continue
    const { x, hlY, band } = info
    const [cr, cg, cb, op] = band
    const bloomLen = Math.max(1, avgCellH * 0.4 * br)
    const bloomW = 4
    const bg = ctx.createRadialGradient(x, hlY, 0, x, hlY, bloomLen)
    bg.addColorStop(0, rgba(cr, cg, cb, op * 0.3 * gs))
    bg.addColorStop(0.4, rgba(cr, cg, cb, op * 0.12 * gs))
    bg.addColorStop(1, 'transparent')
    ctx.save()
    ctx.scale(bloomW / bloomLen, 1)
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc((x * bloomLen) / bloomW, hlY, bloomLen, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const coreLen = avgCellH * 0.4 * br
    if (hlY - coreLen <= viewH && hlY + coreLen >= 0) {
      const lg = ctx.createLinearGradient(x, hlY - coreLen, x, hlY + coreLen)
      lg.addColorStop(0, 'transparent')
      lg.addColorStop(0.12, rgba(cr, cg, cb, op * 0.4 * gs))
      lg.addColorStop(0.35, rgba(Math.min(255, cr + 60), Math.min(255, cg + 60), Math.min(255, cb + 60), op * 0.8 * gs))
      lg.addColorStop(0.5, rgba(Math.min(255, cr + 100), Math.min(255, cg + 100), Math.min(255, cb + 100), op * 1.0 * gs))
      lg.addColorStop(0.65, rgba(Math.min(255, cr + 60), Math.min(255, cg + 60), Math.min(255, cb + 60), op * 0.8 * gs))
      lg.addColorStop(0.88, rgba(cr, cg, cb, op * 0.4 * gs))
      lg.addColorStop(1, 'transparent')
      ctx.strokeStyle = lg
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, hlY - coreLen)
      ctx.lineTo(x, hlY + coreLen)
      ctx.stroke()
    }
  }

  // ── Intersection glows — where a horizontal + vertical highlight cross ─────
  for (let r = 0; r < hInfo.length; r++) {
    const hi = hInfo[r]
    if (!hi) continue
    for (let c = 0; c < vInfo.length; c++) {
      const vi = vInfo[c]
      if (!vi) continue
      const prox = gaussian((hi.hlX - vi.x) / avgCellW, 0.25) * gaussian((vi.hlY - hi.y) / avgCellH, 0.25)
      if (prox <= 0.05) continue
      const ph = palette.h[r % palette.h.length]
      const pv = palette.v[c % palette.v.length]
      const mr = Math.floor((ph[0] + pv[0]) / 2)
      const mg = Math.floor((ph[1] + pv[1]) / 2)
      const mb = Math.floor((ph[2] + pv[2]) / 2)
      const fr = 3.5 * Math.sqrt(prox)
      const fop = prox * 0.6 * gs
      const fg = ctx.createRadialGradient(vi.x, hi.y, 0, vi.x, hi.y, fr)
      fg.addColorStop(0, rgba(Math.min(255, mr + 140), Math.min(255, mg + 140), Math.min(255, mb + 140), fop))
      fg.addColorStop(0.5, rgba(mr, mg, mb, fop * 0.4))
      fg.addColorStop(1, 'transparent')
      ctx.fillStyle = fg
      ctx.beginPath()
      ctx.arc(vi.x, hi.y, fr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * Measure the table's real separator positions in content (scroll) coordinates.
 * Returns { hBorders:[y…], vBorders:[x…], contentW, contentH, avgCellW, avgCellH }
 * or null if the refs aren't ready.
 */
function measureGeometry(scrollEl, tableEl) {
  if (!scrollEl || !tableEl) return null
  const sRect = scrollEl.getBoundingClientRect()

  // 📖 Vertical separators = right edge of every header cell except the last
  // 📖 (the last column has no right border, matching `.td:last-child`).
  const ths = tableEl.querySelectorAll('thead th')
  const vBorders = []
  ths.forEach((th, i) => {
    if (i === ths.length - 1) return
    const r = th.getBoundingClientRect()
    if (r.width === 0) return
    vBorders.push(r.right - sRect.left + scrollEl.scrollLeft)
  })

  // 📖 Horizontal separators = bottom edge of every row (header + body). This
  // 📖 naturally includes expanded detail rows, so beams stay aligned even when
  // 📖 a row is opened.
  const rowEls = tableEl.querySelectorAll('thead tr, tbody tr')
  const hBorders = []
  rowEls.forEach((tr) => {
    const r = tr.getBoundingClientRect()
    if (r.height === 0) return
    hBorders.push(r.bottom - sRect.top + scrollEl.scrollTop)
  })

  if (vBorders.length === 0 || hBorders.length === 0) return null

  const contentW = tableEl.scrollWidth || scrollEl.scrollWidth
  const contentH = tableEl.scrollHeight || scrollEl.scrollHeight
  return {
    hBorders,
    vBorders,
    contentW,
    contentH,
    avgCellW: contentW / (vBorders.length + 1),
    avgCellH: contentH / hBorders.length,
  }
}

/**
 * Canvas overlay that animates mono grid beams along the table's real borders.
 *
 * @param {object} props
 * @param {React.RefObject<HTMLDivElement>} props.scrollRef — the scrolling
 *   element (reads scrollLeft/scrollTop + viewport size).
 * @param {React.RefObject<HTMLTableElement>} props.tableRef — the <table>
 *   (measures real border positions).
 * @param {number} props.rowCount — visible row count (re-measure trigger).
 * @param {number} props.colCount — column count (re-measure trigger).
 */
export default function TableBeamOverlay({ scrollRef, tableRef, rowCount, colCount }) {
  const canvasRef = useRef(null)
  // 📖 Geometry is kept in a ref so the rAF loop always reads the latest without
  // 📖 restarting the loop (same pattern as cult-ui's configRef).
  const geomRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const scrollEl = scrollRef.current
    if (!canvas || !scrollEl) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let dpr = Math.max(1, window.devicePixelRatio || 1)
    let animRef = null
    let startTs = null
    let disposed = false

    // ── Canvas backing-store sizing (DPR-aware) ───────────────────────────────
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      dpr = Math.max(1, window.devicePixelRatio || 1)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    // ── (Re)measure real border positions ─────────────────────────────────────
    const measure = () => {
      const g = measureGeometry(scrollEl, tableRef.current)
      if (g) geomRef.current = g
    }
    measure()

    // ── Reduced-motion: if the user asked for less motion, render a single
    // 📖 static frame (highlights frozen in content space) and only repaint on
    // 📖 scroll / resize / data change. No rAF loop, no breathing.
    const prefersReduced = () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const paint = (animatedElapsed) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const geom = geomRef.current
      if (!geom) return
      drawFrame(ctx, {
        elapsed: animatedElapsed,
        scrollX: scrollEl.scrollLeft,
        scrollY: scrollEl.scrollTop,
        viewW: rect.width,
        viewH: rect.height,
        geom,
        scheme: readScheme(),
        // 📖 Per-beam brightness. Mono palette base opacity is ~0.16, so at
        // 📖 strength=1.0 the core-line peak is alpha ≈ 41/255 — clearly visible
        // 📖 ON the grid lines yet still tasteful. (Earlier 0.32 gave peak alpha
        // 📖 ≈13 = invisible, which read as "beams don't track the grid".)
        // 📖 Subtlety is controlled SEPARATELY by the isBorderLit() sparsity gate,
        // 📖 which keeps only ~1 in 5 borders lit at once.
        strength: 0.9,
        breathe: !prefersReduced(),
        duration: 3,
        fade: prefersReduced() ? 1 : smoothstep(Math.min(1, (animatedElapsed) / 0.8)),
      })
    }

    const draw = (now) => {
      if (disposed) return
      if (startTs == null) startTs = now
      const elapsed = (now - startTs) / 1000
      paint(elapsed)
      animRef = requestAnimationFrame(draw)
    }

    if (prefersReduced()) {
      // 📖 Static mode: one frozen frame, repainted only when something moves.
      paint(0)
      const repaint = () => paint(0)
      scrollEl.addEventListener('scroll', repaint, { passive: true })
      window.addEventListener('resize', repaint)
      return () => {
        disposed = true
        scrollEl.removeEventListener('scroll', repaint)
        window.removeEventListener('resize', repaint)
      }
    }

    // 📖 Animated mode: continuous rAF loop.
    animRef = requestAnimationFrame(draw)

    // ── Observers: keep canvas size + geometry fresh ──────────────────────────
    const roCanvas = new ResizeObserver(() => { resize(); measure() })
    roCanvas.observe(canvas)
    // 📖 Observe the scroll element too — its viewport changes when the header
    // 📖 or filter bar resizes, even if the canvas box didn't.
    const roScroll = new ResizeObserver(() => { resize(); measure() })
    roScroll.observe(scrollEl)
    // 📖 Observe the table body so expanding a row (changes content height)
    // 📖 re-measures borders promptly.
    let roTable = null
    if (tableRef.current) {
      roTable = new ResizeObserver(() => measure())
      roTable.observe(tableRef.current)
    }

    // 📖 Re-measure on scroll (cheap: just reads positions, no rAF restart) so
    // 📖 borders stay aligned while content height settles (async provider data,
    // 📖 sparklines rendering, etc.). Throttled to once per frame via rAF flag.
    let scrollPending = false
    const onScroll = () => {
      if (scrollPending) return
      scrollPending = true
      requestAnimationFrame(() => { scrollPending = false; measure() })
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })

    // 📖 Safety net: periodic re-measure catches layout changes that ResizeObserver
    // 📖 might miss (e.g. fonts swapping in and shifting row heights).
    const interval = window.setInterval(measure, 800)

    return () => {
      disposed = true
      if (animRef !== null) cancelAnimationFrame(animRef)
      roCanvas.disconnect()
      roScroll.disconnect()
      if (roTable) roTable.disconnect()
      scrollEl.removeEventListener('scroll', onScroll)
      window.clearInterval(interval)
    }
  }, [scrollRef, tableRef, rowCount, colCount])

  return <canvas ref={canvasRef} className={styles.beam} aria-hidden="true" />
}
