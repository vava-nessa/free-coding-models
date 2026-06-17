/**
 * @file web/src/hooks/useUrlState.js
 * @description URL deep-linking hook — the Web's answer to TUI CLI flags (--tier, --sort, etc.).
 * 📖 M1 = read-only hydration on mount.
 * 📖 M2 = adds write-back: every filter / sort / view / tool-mode / palette
 * 📖 change pushes to the URL via `history.replaceState` so the URL stays
 * 📖 in sync with the visible Web state and any URL is shareable.
 *
 * 📖 URL params (all optional, all shareable):
 * 📖   ?view=dashboard|settings|analytics|recommend|router|help|changelog
 * 📖   ?tier=S+|S|A+|A|A-|B+|B|C|all
 * 📖   ?status=up|down|pending|all
 * 📖   ?provider=<providerKey>|all
 * 📖   ?verdict=<verdict>|all
 * 📖   ?health=<health>|all
 * 📖   ?sort=<col>&dir=asc|desc
 * 📖   ?q=<searchText>
 * 📖   ?toolMode=<toolKey>
 * 📖   ?palette=open        (when the palette should be open on load)
 *
 * @functions
 *   → useUrlState({ currentView, setCurrentView, filterState, paletteOpen, setPaletteOpen })
 *   → buildUrlParams(state) — pure helper exposed for tests
 */
import { useEffect, useRef } from 'react'
import { VALID_TIERS, VALID_STATUS, VALID_SORTS, VALID_VIEWS, VALID_DIRS, VALID_TOOL_MODES } from './urlState.constants.js'

// 📖 Read the current URL params as a normalized object. Returns null on SSR
// 📖 or when the URL is invalid.
function parseUrlParams() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const out = {}
  
  // 📖 Read pathname as the view slug
  const pathname = window.location.pathname.replace(/^\/|\/$/g, '')
  if (pathname && VALID_VIEWS.has(pathname)) {
    out.view = pathname
  } else if (params.has('view') && VALID_VIEWS.has(params.get('view'))) {
    out.view = params.get('view')
  } else {
    out.view = 'dashboard'
  }

  if (params.has('tier') && VALID_TIERS.has(params.get('tier'))) out.tier = params.get('tier')
  if (params.has('status') && VALID_STATUS.has(params.get('status'))) out.status = params.get('status')
  if (params.has('provider')) out.provider = params.get('provider')
  if (params.has('verdict')) out.verdict = params.get('verdict')
  if (params.has('health')) out.health = params.get('health')
  if (params.has('sort') && VALID_SORTS.has(params.get('sort'))) out.sort = params.get('sort')
  if (params.has('dir') && VALID_DIRS.has(params.get('dir'))) out.dir = params.get('dir')
  if (params.has('q')) out.q = params.get('q')
  if (params.has('toolMode') && VALID_TOOL_MODES.has(params.get('toolMode'))) out.toolMode = params.get('toolMode')
  if (params.has('recommend') && ['1', 'true', 'open'].includes(params.get('recommend'))) out.view = 'recommend'
  if (params.has('palette') && params.get('palette') === 'open') out.palette = 'open'
  return out
}

// 📖 Build a URLSearchParams object from the live state. Pure for testing.
export function buildUrlParams(state) {
  const params = new URLSearchParams()
  if (!state) return params
  if (state.currentView && state.currentView !== 'dashboard') params.set('view', state.currentView)
  if (state.filterTier && state.filterTier !== 'all') params.set('tier', state.filterTier)
  if (state.filterStatus && state.filterStatus !== 'all') params.set('status', state.filterStatus)
  if (state.filterProvider && state.filterProvider !== 'all') params.set('provider', state.filterProvider)
  if (state.filterVerdict && state.filterVerdict !== 'all') params.set('verdict', state.filterVerdict)
  if (state.filterHealth && state.filterHealth !== 'all') params.set('health', state.filterHealth)
  if (state.sortColumn) {
    params.set('sort', state.sortColumn)
    if (state.sortDirection) params.set('dir', state.sortDirection)
  }
  if (state.searchQuery) params.set('q', state.searchQuery)
  if (state.toolMode) params.set('toolMode', state.toolMode)
  if (state.paletteOpen) params.set('palette', 'open')
  return params
}

// 📖 Debounced write-back helper. We don't want to push 5 history entries per
// 📖 second when the user is typing in the search box.
function writeUrl(state) {
  if (typeof window === 'undefined') return
  const params = buildUrlParams(state)
  
  // 📖 Extract view from the search params so it becomes the pathname slug instead of a search param!
  const view = params.get('view') || 'dashboard'
  params.delete('view')

  const search = params.toString()
  const path = view !== 'dashboard' ? `/${view}` : '/'
  const newUrl = search
    ? `${path}?${search}${window.location.hash}`
    : `${path}${window.location.hash}`
  // 📖 replaceState (not pushState) so back/forward don't fill up with
  // 📖 every keystroke. The current URL still updates visibly.
  window.history.replaceState({}, '', newUrl)
}

export function useUrlState({
  currentView, setCurrentView,
  filterState = null,
  paletteOpen = false, setPaletteOpen = () => {},
  toolMode = null, setToolMode = () => {},
}) {
  // 📖 Track a debounce handle so we can coalesce rapid filter / sort changes.
  const writeTimerRef = useRef(null)

  // 📖 Hydrate from URL on mount, exactly once. We don't want to re-hydrate
  // 📖 on every render — the user's actions should drive the URL, not vice versa.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    const params = parseUrlParams()
    if (!params) return

    if (params.view && setCurrentView && params.view !== currentView) {
      setCurrentView(params.view)
    }
    if (params.tier && filterState?.setFilterTier) filterState.setFilterTier(params.tier)
    if (params.status && filterState?.setFilterStatus) filterState.setFilterStatus(params.status)
    if (params.provider && filterState?.setFilterProvider) filterState.setFilterProvider(params.provider)
    if (params.verdict && filterState?.setFilterVerdict) filterState.setFilterVerdict(params.verdict)
    if (params.health && filterState?.setFilterHealth) filterState.setFilterHealth(params.health)
    if (params.sort && filterState?.toggleSort) {
      // 📖 Re-trigger sort: pass the column to setSortColumn + setSortDirection
      // 📖 The hook exposes toggleSort which is a 3-state cycle; for hydration
      // 📖 we want a deterministic state, so we use the lower-level setters.
      if (filterState.setSortColumn) filterState.setSortColumn(params.sort)
      if (params.dir && filterState.setSortDirection) filterState.setSortDirection(params.dir)
    }
    if (params.q !== undefined && filterState?.setSearchQuery) filterState.setSearchQuery(params.q)
    if (params.toolMode && setToolMode) setToolMode(params.toolMode)
    if (params.palette === 'open' && setPaletteOpen) setPaletteOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 📖 Write-back: any change to currentView / filter / toolMode / palette
  // 📖 updates the URL. Debounced at 80ms so rapid filter typing doesn't
  // 📖 thrash the history stack.
  useEffect(() => {
    if (!hydratedRef.current) return
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    writeTimerRef.current = setTimeout(() => {
      writeUrl({
        currentView,
        filterTier: filterState?.filterTier,
        filterStatus: filterState?.filterStatus,
        filterProvider: filterState?.filterProvider,
        filterVerdict: filterState?.filterVerdict,
        filterHealth: filterState?.filterHealth,
        sortColumn: filterState?.sortColumn,
        sortDirection: filterState?.sortDirection,
        searchQuery: filterState?.searchQuery,
        toolMode,
        paletteOpen,
      })
    }, 80)
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current)
    }
  }, [
    currentView, paletteOpen, toolMode,
    filterState?.filterTier, filterState?.filterStatus, filterState?.filterProvider,
    filterState?.filterVerdict, filterState?.filterHealth,
    filterState?.sortColumn, filterState?.sortDirection,
    filterState?.searchQuery,
  ])
}
