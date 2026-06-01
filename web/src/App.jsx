/**
 * @file web/src/App.jsx
 * @description Root application component — orchestrates all views, header nav, Socket.IO
 * connection, toast notifications, and global state. M1 layout refactor: no more left
 * sidebar. Navigation lives in the Header (always-visible nav + overflow menu).
 *
 * 📖 M1 also wires in:
 *   - StatsBar above the ModelTable (was orphaned)
 *   - URL deep-linking (read-only — ?tier=…&sort=…&origin=…)
 *   - ⌘K command palette (placeholder modal for M1, real palette in M2)
 *   - Favorites hook (per-row star + reorder + display mode toggle)
 *   - Per-model benchmark button (uses existing /api/benchmark)
 *
 * @functions App → root component with all state and layout composition
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useSocket } from './hooks/useSocket.js'
import { useFilter } from './hooks/useFilter.js'
import { useTheme } from './hooks/useTheme.js'
import { useFavorites } from './hooks/useFavorites.js'
import { useUrlState } from './hooks/useUrlState.js'
import Header from './components/layout/Header.jsx'
import Footer from './components/layout/Footer.jsx'
import FilterBar from './components/dashboard/FilterBar.jsx'
import ModelTable from './components/dashboard/ModelTable.jsx'
import DetailPanel from './components/dashboard/DetailPanel.jsx'
import ExportModal from './components/dashboard/ExportModal.jsx'
import SettingsView from './components/settings/SettingsView.jsx'
import AnalyticsView from './components/analytics/AnalyticsView.jsx'
import CommandPalette from './components/palette/CommandPalette.jsx'
import ToastContainer from './components/atoms/ToastContainer.jsx'

let toastIdCounter = 0

// 📖 Map current view to the header nav id. M1 only ships dashboard/settings/analytics;
// 📖 recommend/router/help/changelog/install-endpoints/installed-models are wired but
// 📖 still show a "Coming in M2/M3/M4" toast from the header for now.
const VIEW_TO_NAV = {
  dashboard: 'dashboard',
  settings: 'settings',
  analytics: 'analytics',
  recommend: 'recommend',
  router: 'router',
  help: 'help',
  changelog: 'changelog',
  'install-endpoints': 'install-endpoints',
  'installed-models': 'installed-models',
}

export default function App() {
  const { models, connected, nextPingAt, isPinging, pingMode, globalBenchmarkRunning, globalBenchmarkTotal, globalBenchmarkCompleted } = useSocket()
  const { theme, cycle: cycleTheme } = useTheme()
  const [currentView, setCurrentView] = useState('dashboard')
  const [selectedModel, setSelectedModel] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const lastActivityRef = useRef(Date.now())

  // 📖 URL deep-linking (M1 = read-only hydration on mount; write-back lands in M2).
  // 📖 Syncs `currentView`, filter state, and selection from query params so users
  // 📖 can share pre-configured dashboard URLs.
  useUrlState({
    currentView, setCurrentView,
    filterState: null, // wired in M2
  })

  const {
    filtered,
    filterTier, setFilterTier,
    filterStatus, setFilterStatus,
    filterProvider, setFilterProvider,
    searchQuery, setSearchQuery,
    sortColumn, sortDirection, toggleSort,
    filterVerdict, setFilterVerdict,
    filterHealth, setFilterHealth,
    visibilityMode, setVisibilityMode,
    customTextFilter, setCustomTextFilter,
    resetView,
  } = useFilter(models)

  // 📖 Favorites — single source of truth shared with the TUI via ~/.free-coding-models.json.
  const favorites = useFavorites({ models })

  // 📖 Build the provider list for the FilterBar dropdown.
  const providers = (() => {
    const map = {}
    models.forEach((m) => {
      if (!map[m.providerKey]) map[m.providerKey] = { key: m.providerKey, name: m.origin, count: 0 }
      map[m.providerKey].count++
    })
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  })()

  // ── Global benchmark (AI Speed Test) ─────────────────────────────────────
  const handleBenchmark = useCallback(async () => {
    if (globalBenchmarkRunning) return
    try {
      await fetch('/api/global-benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          models: filtered.map((model) => ({ providerKey: model.providerKey, modelId: model.modelId })),
        }),
      })
    } catch (err) {
      console.error('[Benchmark] Failed to start global benchmark:', err.message)
    }
  }, [filtered, globalBenchmarkRunning])

  // ── Per-model benchmark (M1 parity with TUI Ctrl+A) ──────────────────────
  const handleBenchmarkRow = useCallback(async (model) => {
    try {
      const resp = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerKey: model.providerKey, modelId: model.modelId }),
      })
      if (!resp.ok && resp.status !== 202) {
        const err = await resp.json().catch(() => ({}))
        addToast?.(`Benchmark failed: ${err?.error || resp.statusText}`, 'error')
      }
    } catch (err) {
      console.error('[Benchmark] per-row failed:', err.message)
    }
  }, [])

  // ── Toast helpers ────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ── Selection / detail panel ─────────────────────────────────────────────
  const handleSelectModel = useCallback((model) => {
    setSelectedModel(model)
    lastActivityRef.current = Date.now()
  }, [])

  const handleCloseDetail = useCallback(() => setSelectedModel(null), [])

  // ── Ping mode change → server → broadcast ───────────────────────────────
  const handlePingModeChange = useCallback(async (mode) => {
    try {
      await fetch(`/api/ping-mode?action=${mode}`, { method: 'POST' })
    } catch {}
  }, [])

  // ── Navigation handler (Header nav + overflow menu) ──────────────────────
  const handleNavigate = useCallback((viewId) => {
    setCurrentView(VIEW_TO_NAV[viewId] || viewId)
    lastActivityRef.current = Date.now()
  }, [])

  // ── Reset view (N key equivalent) ────────────────────────────────────────
  const handleResetView = useCallback(() => {
    resetView()
    setSearchQuery('')
    addToast('View reset to defaults.', 'info')
  }, [resetView, setSearchQuery, addToast])

  // ── Keyboard shortcuts: only ⌘K / Ctrl+P for the palette ────────────────
  useEffect(() => {
    const handler = (e) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey
      // ⌘K / Ctrl+K → toggle command palette (the Web's only global shortcut)
      if (cmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      // Ctrl+P is also accepted as a TUI-style alias for the same palette.
      if (cmdOrCtrl && (e.key === 'p' || e.key === 'P') && !e.shiftKey) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      // Esc closes whatever is open.
      if (e.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); return }
        if (selectedModel) { setSelectedModel(null); return }
        if (exportOpen) { setExportOpen(false); return }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [paletteOpen, selectedModel, exportOpen])

  // 📖 Reset view if URL contains the reset flag.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === '1') {
      handleResetView()
      const url = new URL(window.location.href)
      url.searchParams.delete('reset')
      window.history.replaceState({}, '', url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="app-shell">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentView={currentView}
          onNavigate={handleNavigate}
          onToggleTheme={cycleTheme}
          onOpenExport={() => setExportOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onBenchmark={handleBenchmark}
          benchmarkRunning={globalBenchmarkRunning}
          benchmarkTotal={globalBenchmarkTotal}
          benchmarkCompleted={globalBenchmarkCompleted}
          modelsCount={filtered.length}
          theme={theme}
          onToast={addToast}
        />

        <div className="app-content">
          {currentView === 'dashboard' && (
            <div className="view">
              <FilterBar
                filterTier={filterTier}
                setFilterTier={setFilterTier}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterProvider={filterProvider}
                setFilterProvider={setFilterProvider}
                filterVerdict={filterVerdict}
                setFilterVerdict={setFilterVerdict}
                filterHealth={filterHealth}
                setFilterHealth={setFilterHealth}
                visibilityMode={visibilityMode}
                setVisibilityMode={setVisibilityMode}
                customTextFilter={customTextFilter}
                setCustomTextFilter={setCustomTextFilter}
                searchQuery={searchQuery}
                onResetView={handleResetView}
                providers={providers}
                pingMode={pingMode}
                setPingMode={handlePingModeChange}
                nextPingAt={nextPingAt}
                isPinging={isPinging}
                globalBenchmarkRunning={globalBenchmarkRunning}
                globalBenchmarkTotal={globalBenchmarkTotal}
                globalBenchmarkCompleted={globalBenchmarkCompleted}
              />
              <ModelTable
                filtered={filtered}
                onSelectModel={handleSelectModel}
                onBenchmarkRow={handleBenchmarkRow}
                favorites={favorites}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </div>
          )}

          {currentView === 'settings' && (
            <div className="view">
              <SettingsView onToast={addToast} />
            </div>
          )}

          {currentView === 'analytics' && (
            <div className="view">
              <AnalyticsView models={models} />
            </div>
          )}

          <Footer />
        </div>
      </div>

      <DetailPanel
        model={selectedModel}
        onClose={handleCloseDetail}
        favorites={favorites}
        onBenchmark={handleBenchmarkRow}
        onToast={addToast}
      />

      {exportOpen && (
        <ExportModal
          models={filtered}
          onClose={() => setExportOpen(false)}
          onToast={addToast}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={handleNavigate}
          onCycleTheme={cycleTheme}
          onResetView={handleResetView}
          currentView={currentView}
          theme={theme}
          pingMode={pingMode}
          onSetPingMode={handlePingModeChange}
          onToast={addToast}
          onExport={() => setExportOpen(true)}
        />
      )}

      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </>
  )
}
