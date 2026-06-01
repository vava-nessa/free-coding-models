/**
 * @file web/src/components/atoms/Sparkline.jsx
 * @description SVG sparkline chart for ping history trend visualization.
 * 📖 Renders a polyline with gradient area fill and endpoint dot.
 * 📖 Colors are theme-aware: reads CSS custom properties from :root so the
 * 📖 stroke/dot swap to the AA-contrast palette in light mode automatically.
 */
import { useMemo } from 'react'

// 📖 Read CSS custom properties at module scope; falls back to dark-mode neon
// 📖 values when running outside the browser (e.g. during server rendering).
function readCssVar(name, fallback) {
  if (typeof window === 'undefined' || !window.document?.documentElement) return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// 📖 Threshold-based color picker that returns the current theme's variant of
// 📖 each color. Reading the variables on every render is fine — they only
// 📖 change when the user toggles the theme, and the memo cache key catches it.
function pickSparkColor(lastVal) {
  if (lastVal < 500)  return readCssVar('--color-success', '#00ff88')
  if (lastVal < 1500) return readCssVar('--color-warning', '#ffaa00')
  return readCssVar('--color-danger', '#ff4444')
}

export default function Sparkline({ history }) {
  const svg = useMemo(() => {
    if (!history || history.length < 2) return null
    const valid = history.filter((p) => p.code === '200' || p.code === '401')
    if (valid.length < 2) return null

    const values = valid.map((p) => p.ms)
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    const w = 80,
      h = 22
    const step = w / (values.length - 1)

    const points = values
      .map((v, i) => {
        const x = i * step
        const y = h - ((v - min) / range) * (h - 4) - 2
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    const lastVal = values[values.length - 1]
    const color = pickSparkColor(lastVal)
    const lastX = ((values.length - 1) * step).toFixed(1)
    const lastY = (h - ((lastVal - min) / range) * (h - 4) - 2).toFixed(1)

    return (
      <svg className="sparkline-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={points} opacity="0.85" />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
    )
  }, [history])

  return svg || null
}
