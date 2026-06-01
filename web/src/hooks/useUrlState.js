/**
 * @file web/src/hooks/useUrlState.js
 * @description URL deep-linking hook — the Web's answer to TUI CLI flags (--tier, --sort, etc.).
 * 📖 M1 ships read-only hydration: on mount, parses the query string and hydrates the Web view.
 * 📖 M2 will add write-back (push filter/sort/view changes back to the URL via history.replaceState).
 *
 * 📖 Supported query params (M1 = read-only):
 * 📖   ?tier=S+|S|A+|A|A-|B+|B|C|all  — sets the tier filter
 * 📖   ?status=up|down|pending|all   — sets the health/status filter
 * 📖   ?provider=<providerKey>|all   — sets the provider filter
 * 📖   ?verdict=<verdict>|all        — sets the verdict filter
 * 📖   ?health=<health>|all          — sets the health filter
 * 📖   ?sort=<col>&dir=asc|desc      — sets the sort column + direction
 * 📖   ?view=dashboard|settings|analytics  — sets the active view
 * 📖   ?q=<text>                     — sets the search query
 * 📖   ?tier=S&sort=verdict&dir=asc  — compose freely; the same URL is shareable
 *
 * @functions
 *   → useUrlState({ currentView, setCurrentView, filterState }) — hydrates Web state from URL
 *
 * @see ideas/tui-web-feature-parity.md §5.4 — full CLI-flag ↔ URL-param mapping
 */
import { useEffect } from 'react'

// 📖 Valid enum values for cycle-style params. Keys here determine which params
// 📖 get accepted silently vs ignored. Anything not in the list is dropped.
const VALID_TIERS = new Set(['S+', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'C', 'all'])
const VALID_STATUS = new Set(['up', 'down', 'pending', 'all'])
const VALID_SORTS = new Set([
  'mood', 'idx', 'tier', 'sweScore', 'ctx', 'label', 'origin',
  'latestPing', 'avg', 'condition', 'verdict', 'stability', 'uptime',
  'aiLatency', 'tps', 'trend',
])
const VALID_VIEWS = new Set(['dashboard', 'settings', 'analytics'])
const VALID_DIRS = new Set(['asc', 'desc'])

/**
 * 📖 parseUrlParams: extract a normalized set of params from the current URL.
 * 📖 Returns a flat object with camelCase keys, only including recognized params.
 * @returns {{
 *   tier: string|null, status: string|null, provider: string|null,
 *   verdict: string|null, health: string|null,
 *   sort: string|null, dir: string|null, view: string|null, q: string,
 * }}
 */
function parseUrlParams() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const out = {}
  if (params.has('tier') && VALID_TIERS.has(params.get('tier'))) out.tier = params.get('tier')
  if (params.has('status') && VALID_STATUS.has(params.get('status'))) out.status = params.get('status')
  if (params.has('provider')) out.provider = params.get('provider')
  if (params.has('verdict')) out.verdict = params.get('verdict')
  if (params.has('health')) out.health = params.get('health')
  if (params.has('sort') && VALID_SORTS.has(params.get('sort'))) out.sort = params.get('sort')
  if (params.has('dir') && VALID_DIRS.has(params.get('dir'))) out.dir = params.get('dir')
  if (params.has('view') && VALID_VIEWS.has(params.get('view'))) out.view = params.get('view')
  if (params.has('q')) out.q = params.get('q')
  return out
}

/**
 * 📖 useUrlState: hydrate the Web view from the current URL on mount.
 * 📖 M1 = read-only. Pass setters; the hook calls them once on mount with
 * 📖 whatever the URL declares, then leaves the URL alone.
 *
 * 📖 The hook is intentionally non-intrusive: if the URL has no params, it does
 * 📖 nothing. The caller is free to call the setters independently — the URL
 * 📖 simply becomes the *initial* state.
 *
 * @param {{
 *   currentView: string,
 *   setCurrentView: (view: string) => void,
 *   filterState: object | null,  // wired in M2
 * }} opts
 */
export function useUrlState({ currentView, setCurrentView, filterState }) {
  useEffect(() => {
    const params = parseUrlParams()
    if (!params) return

    if (params.view && params.view !== currentView) {
      setCurrentView(params.view)
    }

    // 📖 Filter hydration is wired through the filterState prop in M2. M1 just
    // 📖 sets the view; the rest of the URL params act as documentation for
    // 📖 the user and get the write-back loop fully closed in M2.
  }, [currentView, setCurrentView, filterState])
}

// 📖 Re-export the parser so M2's write-back path can use the same validator.
export { parseUrlParams, VALID_TIERS, VALID_STATUS, VALID_SORTS, VALID_VIEWS, VALID_DIRS }
