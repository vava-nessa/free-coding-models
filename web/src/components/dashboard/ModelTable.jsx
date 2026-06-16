/**
 * @file web/src/components/dashboard/ModelTable.jsx
 * @description Main data table with ALL CLI columns powered by TanStack Table.
 * 📖 Full CLI column parity: ⭐(fav) | ❔(mood) | # | Tier | SWE% | Ctx | Model | Provider | Last Ping | Avg | Health | Verdict | Stability | Up% | AI Lat. | TPS | Trend
 * 📖 M1 additions:
 *   - ⭐/☆ star button per row (TUI `F` key)
 *   - Clickable AI Lat. cell → per-row benchmark (TUI `Ctrl+A`)
 *   - Dark-red row class for incompatible models when `toolMode` is set
 *     (TUI behavior; tool mode picker ships in M3, but the class is ready now)
 * 📖 Clickable headers for sorting, medal rankings for top 3, horizontal scroll.
 * 📖 Sorting is handled by useFilter hook which pushes null/Infinity values to bottom.
 * 📖 Columns are user-resizable: drag the right edge of any header to resize.
 * 📖 Custom widths persist in localStorage via the useColumnSizing hook and survive reloads.
 * 📖 A "Reset columns" button appears in the toolbar only when the user has custom widths.
 */
import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { IconStar, IconStarFilled, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useColumnSizing } from '../../hooks/useColumnSizing.js'

import MoodCell from '../atoms/MoodCell.jsx'
import TierBadge from '../atoms/TierBadge.jsx'
import StatusDot from '../atoms/StatusDot.jsx'
import LastPingCell from '../atoms/LastPingCell.jsx'
import HealthCell from '../atoms/HealthCell.jsx'
import StabilityCell from '../atoms/StabilityCell.jsx'
import VerdictBadge from '../atoms/VerdictBadge.jsx'
import Sparkline from '../atoms/Sparkline.jsx'
import AILatencyCell from '../atoms/AILatencyCell.jsx'
import TPSCell from '../atoms/TPSCell.jsx'
import NoKeyIcon from '../atoms/NoKeyIcon.jsx'
import ProviderLogo from '../atoms/ProviderLogo.jsx'
import LaunchButton from '../launch/LaunchButton.jsx'

import { pingClass } from '../../utils/format.js'
import { sweClass } from '../../utils/ranks.js'
// 📖 Pure-JS, browser-safe import of the TUI's tool compatibility helper. Same
// 📖 file the TUI uses; both surfaces share the source of truth for which
// 📖 providers are compatible with which tools.
import { getCompatibleTools } from '../../../../src/core/tool-metadata.js'
import ExpandedDetailRow from './ExpandedDetailRow.jsx'
import styles from './ModelTable.module.css'

const colHelper = createColumnHelper()

const SORTABLE_COLUMN_IDS = new Set([
  'mood', 'idx', 'tier', 'sweScore', 'ctx', 'label', 'origin', 'latestPing',
  'avg', 'condition', 'verdict', 'stability', 'uptime', 'aiLatency', 'tps', 'trend',
])

// ─── Cell renderers ───────────────────────────────────────────────────────────
function MoodCellRenderer({ row }) {
  return <MoodCell verdict={row.original.verdict} />
}

function RankCellRenderer({ row }) {
  return <span className={styles.rankNum}>{row.original.idx ?? row.index + 1}</span>
}

function ModelCellRenderer({ row }) {
  const m = row.original
  const showNoKey = !m.hasApiKey && !m.cliOnly
  return (
    <div className={styles.modelCell}>
      <StatusDot status={m.status} inRouterSet={m.inRouterSet} />
      <div className={styles.modelMeta}>
        <div className={styles.modelHeader}>
          <span className={styles.modelName}>{m.label}</span>
          {showNoKey && (
            <NoKeyIcon
              size={14}
              title="No API key configured — health will stay in 'NO KEY' state"
            />
          )}
        </div>
        <div className={styles.modelId}>{m.modelId}</div>
      </div>
    </div>
  )
}

function SWECellRenderer({ row }) {
  const m = row.original
  const cls = sweClass(m.sweScore)
  return <span className={`${styles.swe} ${styles[cls]}`}>{m.sweScore || '—'}</span>
}

function CtxCellRenderer({ row }) {
  return <span className={styles.ctx}>{row.original.ctx || '—'}</span>
}

function ProviderCellRenderer({ row }) {
  // 📖 Renders the provider as [icon + text-wordmark] on a single row-height
  // 📖 line. Replaces the old bordered `.providerPill` text label. See
  // 📖 atoms/ProviderLogo.jsx for the asset resolution + theme logic.
  return <ProviderLogo providerKey={row.original.providerKey} origin={row.original.origin} />
}

function LastPingCellRenderer({ row }) {
  const m = row.original
  const hist = m.pingHistory || m.pings || []
  const latest = hist.length > 0 ? hist[hist.length - 1] : null
  return <LastPingCell ms={latest?.ms ?? null} isPinging={Boolean(m.isPinging)} />
}

function AvgPingCellRenderer({ row }) {
  const m = row.original
  const cls = pingClass(m.avg)
  return (
    <span className={`${styles.ping} ${styles[cls]}`}>
      {m.avg == null || m.avg === Infinity || m.avg > 99000 ? '—' : m.avg}
    </span>
  )
}

function HealthCellRenderer({ row }) {
  const m = row.original
  return <HealthCell status={m.status} httpCode={m.httpCode} inRouterSet={m.inRouterSet} />
}

function VerdictCellRenderer({ row }) {
  const m = row.original
  return <VerdictBadge verdict={m.verdict} httpCode={m.httpCode} />
}

function StabilityCellRenderer({ row }) {
  return <StabilityCell score={row.original.stability} />
}

function UptimeCellRenderer({ row }) {
  const m = row.original
  return <span className={styles.uptime}>{m.uptime > 0 ? `${m.uptime}%` : '—'}</span>
}

function AILatencyCellRenderer({ row }) {
  const m = row.original
  const isRunning = Boolean(m.isBenchmarking)
  return (
    <div
      className={`${styles.aiLatencyWrap} ${isRunning ? styles.aiLatencyRunning : ''}`}
      onClick={(e) => {
        // 📖 Click anywhere in the cell = fire per-row benchmark (TUI: Ctrl+A).
        e.stopPropagation()
        const handler = window.__fcmRowBenchmarkHandler
        if (typeof handler === 'function') handler(m)
      }}
      title={isRunning ? 'Benchmarking…' : 'Click to run AI Speed Test (TUI: Ctrl+A)'}
    >
      <AILatencyCell result={m.benchmark || null} isRunning={isRunning} />
      {!isRunning && (
        <span className={styles.aiLatencyPlay} aria-hidden="true">
          <IconPlayerPlayFilled size={10} stroke={1.5} />
        </span>
      )}
    </div>
  )
}

function TPSCellRenderer({ row }) {
  const m = row.original
  return <TPSCell result={m.benchmark || null} isRunning={Boolean(m.isBenchmarking)} />
}

function TrendCellRenderer({ row }) {
  return <Sparkline history={row.original.pingHistory} />
}

// ─── Column definitions ──────────────────────────────────────────────────────
// 📖 Note: `favorites` / `onBenchmarkRow` are read by the cell renderers below
// 📖 via closure. We rebuild the columns list whenever any of these change so
// 📖 the cells always see fresh values.
const buildColumns = ({ favorites, onBenchmarkRow, onSelectModel, onLaunch, toolMode }) => [
  // 📖 Star column — leftmost, mirrors the TUI's `F` key.
  // 📖 First column = bookmarks (TUI `F` key). Widened from 32→104 so the
  // 📖 "BOOKMARKS" header label fits horizontally without clipping.
  colHelper.display({
    id: 'fav',
    header: 'BOOKMARKS',
    size: 104,
    enableSorting: false,
    cell: ({ row }) => {
      const m = row.original
      const isFav = favorites.isFavorite(m)
      return (
        <button
          className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
          onClick={(e) => { e.stopPropagation(); favorites.toggle(m) }}
          title={isFav ? `Unfavorite ${m.label} (TUI: F)` : `Favorite ${m.label} (TUI: F)`}
          aria-label={isFav ? `Unfavorite ${m.label}` : `Favorite ${m.label}`}
          aria-pressed={isFav}
        >
          {isFav ? <IconStarFilled size={14} stroke={1.5} /> : <IconStar size={14} stroke={1.5} />}
        </button>
      )
    },
  }),
  colHelper.display({
    id: 'mood',
    header: '❔',
    size: 28,
    cell: MoodCellRenderer,
    enableSorting: true,
  }),
  colHelper.accessor('idx', {
    header: '#',
    size: 36,
    enableSorting: true,
    cell: ({ getValue, row }) => (
      <span className={styles.rankNum}>{getValue() ?? row.index + 1}</span>
    ),
  }),
  colHelper.accessor('tier', {
    header: 'Tier',
    size: 48,
    enableSorting: true,
    cell: ({ getValue }) => <TierBadge tier={getValue()} />,
  }),
  colHelper.accessor('sweScore', {
    header: 'SWE%',
    size: 52,
    enableSorting: true,
    cell: SWECellRenderer,
  }),
  colHelper.accessor('ctx', {
    header: 'CTX',
    size: 48,
    enableSorting: true,
    cell: CtxCellRenderer,
  }),
  colHelper.accessor('label', {
    header: 'Model',
    size: 200,
    enableSorting: true,
    cell: ModelCellRenderer,
  }),
  colHelper.accessor('origin', {
    header: 'Provider',
    // 📖 150px fits the widest wordmark (cloudflare ~145px) at 12px height,
    // 📖 with a small buffer. Users can still drag the column wider if they
    // 📖 want a larger render. The default before this was 110px, but the
    // 📖 icon+wordmark layout needs more horizontal room.
    size: 150,
    enableSorting: true,
    cell: ProviderCellRenderer,
  }),
  colHelper.display({
    id: 'latestPing',
    header: 'Last Ping',
    size: 80,
    cell: LastPingCellRenderer,
    enableSorting: true,
  }),
  colHelper.accessor('avg', {
    header: 'Avg',
    size: 72,
    enableSorting: true,
    cell: AvgPingCellRenderer,
  }),
  colHelper.accessor('status', {
    id: 'condition',
    header: 'Health',
    size: 120,
    enableSorting: true,
    cell: HealthCellRenderer,
  }),
  colHelper.accessor('verdict', {
    header: 'Verdict',
    size: 100,
    enableSorting: true,
    cell: VerdictCellRenderer,
  }),
  colHelper.accessor('stability', {
    header: 'Stability',
    size: 90,
    enableSorting: true,
    cell: StabilityCellRenderer,
  }),
  colHelper.accessor('uptime', {
    header: 'Up%',
    size: 48,
    enableSorting: true,
    cell: UptimeCellRenderer,
  }),
  colHelper.display({
    id: 'aiLatency',
    header: 'AI Lat.',
    size: 80,
    cell: AILatencyCellRenderer,
    enableSorting: true,
  }),
  colHelper.display({
    id: 'tps',
    header: 'TPS',
    size: 48,
    cell: TPSCellRenderer,
    enableSorting: true,
  }),
  colHelper.display({
    id: 'trend',
    header: 'Trend',
    size: 96,
    cell: TrendCellRenderer,
    enableSorting: true,
  }),
  colHelper.display({
    id: 'launch',
    header: '🔌',
    size: 42,
    enableSorting: false,
    cell: ({ row }) => (
      <div className={styles.launchCell}>
        <LaunchButton model={row.original} toolMode={toolMode} onLaunch={onLaunch} variant="icon" />
      </div>
    ),
  }),
]

// 📖 DEFAULT_COLUMN_SIZING: extracted from the columns above. This is the single
// 📖 source of truth for both the table layout and the useColumnSizing hook's reset target.
// 📖 The 'Reset columns' button restores these exact widths.
// 📖 We build a placeholder columns list (no callbacks needed) to extract sizes.
const PLACEHOLDER_COLUMNS = buildColumns({ favorites: { isFavorite: () => false, toggle: () => {} }, onBenchmarkRow: null, onSelectModel: null, onLaunch: null, toolMode: 'opencode' })
export const DEFAULT_COLUMN_SIZING = PLACEHOLDER_COLUMNS.reduce((acc, c) => {
  if (c.id) acc[c.id] = c.size ?? 80
  return acc
}, {})

// 📖 RESIZE_MIN/MAX bounds (px) — used by the handle's drag preview and mirrored in
// 📖 the hook's clamp. Keep them in sync if you change one.
const COLUMN_RESIZE_MIN = 24
const COLUMN_RESIZE_MAX = 1200

// ─── Sort icon component ────────────────────────────────────────────────────
function SortIcon({ column }) {
  if (!column.getCanSort()) return null
  const sorted = column.getIsSorted()
  if (!sorted) return <span className={styles.sortIcon}>⇅</span>
  return <span className={styles.sortIconActive}>{sorted === 'asc' ? '↑' : '↓'}</span>
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ModelTable({
  filtered, onSelectModel, onBenchmarkRow, onLaunch, favorites,
  sortColumn, sortDirection, onSort,
  toolMode = null,
  onToast, onSetToolMode, onCycleToolMode, onOpenFallback,
}) {
  // 📖 Expand row state — only one row expanded at a time (accordion)
  const [expandedRowId, setExpandedRowId] = useState(null)

  // 📖 scrollRef is the internal scroll container — shared by the sticky
  // 📖 <thead> header and the row virtualizer (only visible rows are in the
  // 📖 DOM; off-screen rows stay in React state so live pings/probes keep
  // 📖 updating them and re-render correctly when scrolled into view).
  const scrollRef = useRef(null)

  const toggleExpand = useCallback((model) => {
    const key = `${model.providerKey}/${model.modelId}`
    setExpandedRowId((prev) => prev === key ? null : key)
  }, [])
  // Compute top3 for medal rows
  const top3Ids = useMemo(() => {
    const online = filtered.filter(m => m.status === 'up' && m.avg != null && m.avg !== Infinity && m.avg < 99000)
    return new Set([...online].sort((a, b) => a.avg - b.avg).slice(0, 3).map(m => m.modelId))
  }, [filtered])

  // 📖 Wire the per-row benchmark handler through a window-level ref so the
  // 📖 AI Lat. cell can call it without prop-drilling through TanStack's
  // 📖 cell render context. Cleaner than threading `meta` through 17 columns.
  useEffect(() => {
    if (typeof onBenchmarkRow !== 'function') {
      window.__fcmRowBenchmarkHandler = null
      return
    }
    window.__fcmRowBenchmarkHandler = onBenchmarkRow
    return () => {
      if (window.__fcmRowBenchmarkHandler === onBenchmarkRow) {
        window.__fcmRowBenchmarkHandler = null
      }
    }
  }, [onBenchmarkRow])

  // 📖 Build the columns with the current favorites/onBenchmarkRow handlers.
  // 📖 Re-derive when favorites reference changes so the star cells re-render.
  const columns = useMemo(
    () => buildColumns({ favorites, onBenchmarkRow, onSelectModel, onLaunch, toolMode }),
    [favorites, onBenchmarkRow, onSelectModel, onLaunch, toolMode]
  )

  // 📖 Column sizing state with localStorage persistence (see useColumnSizing.js).
  // 📖 onColumnSizingChange + state.columnSizing are TanStack's contract for resize.
  const { columnSizing, setColumnSizing, resetColumnSizing, hasCustomSizing } =
    useColumnSizing(DEFAULT_COLUMN_SIZING)

  // TanStack Table — no getSortedRowModel, sorting lives in useFilter
  const table = useReactTable({
    data: filtered,
    columns,
    defaultColumn: { enableSorting: true },
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
  })

  const rows = table.getRowModel().rows

  // 📖 Flatten rows + any expanded detail panel into a single virtualized
  // 📖 list. One <tr> per item keeps TanStack Virtual's dynamic measurement
  // 📖 clean (one measured element per virtual item). The expand item only
  // 📖 exists for the single accordion-open row, so count changes by at most 1.
  const flatRows = useMemo(() => {
    const out = []
    for (const row of rows) {
      const m = row.original
      const key = `${m.providerKey}/${m.modelId}`
      out.push({ type: 'row', row, key })
      if (expandedRowId === key) {
        out.push({ type: 'expand', row, key: `${key}__expand` })
      }
    }
    return out
  }, [rows, expandedRowId])

  // 📖 Row virtualizer: renders only the ~15-25 rows in the viewport (+overscan)
  // 📖 instead of all 190+. Spacer <tr>s above/below preserve the full scroll
  // 📖 height. This is a RENDER-only optimization — ALL model data (including
  // 📖 live pings/probes for off-screen rows) still lives in React state via
  // 📖 useSocket, so updates continue uninterrupted and show fresh values the
  // 📖 moment a row scrolls back into view. Nothing about probing changes.
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (flatRows[i]?.type === 'expand' ? 260 : 47),
    overscan: 10,
    getItemKey: (i) => flatRows[i].key,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const padTop = virtualItems.length ? Math.max(0, virtualItems[0].start) : 0
  const lastVi = virtualItems.length ? virtualItems[virtualItems.length - 1] : null
  const padBottom = lastVi ? Math.max(0, totalSize - lastVi.end) : 0

  // 📖 Total table width = sum of all column sizes. Used to drop the min-width
  // 📖 override once the user has manually tuned the columns, so horizontal
  // 📖 scrolling reflects the user's layout rather than the 1200px default.
  const totalTableWidth = useMemo(
    () => table.getAllColumns().reduce((sum, c) => sum + c.getSize(), 0),
    // 📖 Re-derive when the sizing state object changes (a new object is created per change).
    [columnSizing]
  )

  // 📖 Global cursor lock: when the user is dragging a resize handle, the cursor
  // 📖 can leave the handle briefly. Adding a body class keeps the col-resize
  // 📖 cursor visible AND blocks accidental text selection until the drag ends.
  const isResizing = Boolean(table.getState().columnSizingInfo?.isResizingColumn)
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isResizing) {
      document.body.classList.add('col-resizing')
    } else {
      document.body.classList.remove('col-resizing')
    }
    return () => {
      document.body.classList.remove('col-resizing')
    }
  }, [isResizing])

  if (rows.length === 0) {
    return <div className={styles.empty}>No models match your filters</div>
  }

  return (
    <div className={styles.container}>
      {/* 📖 resizeToolbar lives OUTSIDE the scroller so it never overlaps the
          📖 sticky table header (thead th sticks to the top of scrollInner). */}
      {hasCustomSizing && (
        <div className={styles.resizeToolbar}>
          <span className={styles.resizeToolbarHint}>
            📐 Custom column widths · total <strong>{Math.round(totalTableWidth)}px</strong>
          </span>
          <button
            type="button"
            className={styles.resizeResetButton}
            onClick={resetColumnSizing}
            title="Restore the default column widths"
          >
            ↺ Reset columns
          </button>
        </div>
      )}
      {/* 📖 scrollInner is the actual scroller. It is the scroll element for
          📖 both the sticky <thead> header and the row virtualizer. Bounded by
          📖 .dashboardView (viewport height) so the table scrolls internally. */}
      <div className={styles.scrollInner} ref={scrollRef}>
      <table
        className={styles.table}
        style={hasCustomSizing ? { minWidth: `${totalTableWidth}px` } : undefined}
      >
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const col = header.column
                const canSort = SORTABLE_COLUMN_IDS.has(col.id)
                const isResizing = col.getIsResizing?.() === true
                const sizePx = `${header.getSize()}px`
                return (
                  <th
                    key={header.id}
                    className={styles.th}
                    onClick={canSort ? () => onSort(header.id) : undefined}
                    style={{ width: sizePx, minWidth: sizePx, maxWidth: sizePx, cursor: canSort ? 'pointer' : 'default' }}
                    title={`Sort ${col.columnDef.header}: asc → desc → reset`}
                  >
                    <div className={styles.thInner}>
                      <span className={styles.thLabel}>
                        {flexRender(col.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className={
                            sortColumn === col.id
                              ? styles.sortIconActive
                              : styles.sortIcon
                          }>
                            {sortColumn === col.id
                              ? (sortDirection === 'asc' ? '↑' : '↓')
                              : '⇅'}
                          </span>
                        )}
                      </span>
                      {/* 📖 Resize handle: full-height grab zone on the right edge of every header.
                          📖 TanStack's column.getResizeHandler() wires mouse + touch to the
                          📖 table's columnSizing state via the onColumnSizingChange callback. */}
                      <span
                        className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => {
                          // 📖 Double-click resets just this column to its declared default width.
                          setColumnSizing((prev) => ({ ...prev, [col.id]: DEFAULT_COLUMN_SIZING[col.id] }))
                        }}
                        title={`Drag to resize ${col.columnDef.header} (double-click to reset this column)`}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${col.columnDef.header} column`}
                      />
                    </div>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {/* 📖 Top spacer: represents the scroll height of all virtualized-out
              📖 rows ABOVE the viewport. aria-hidden + empty cell keeps it
              📖 invisible while preserving table column layout. */}
          {padTop > 0 && (
            <tr aria-hidden="true" style={{ height: padTop }}>
              <td style={{ height: padTop, padding: 0, border: 0 }} />
            </tr>
          )}
          {virtualItems.map((vi) => {
            const item = flatRows[vi.index]
            // 📖 Expanded detail panel row — its own virtual item so dynamic
            // 📖 measurement stays one-element-per-item (clean heights).
            if (item.type === 'expand') {
              return (
                <tr
                  key={item.key}
                  className={styles.expandRowWrapper}
                  data-index={vi.index}
                  ref={rowVirtualizer.measureElement}
                >
                  <td colSpan={item.row.getVisibleCells().length} className={styles.expandRowCell}>
                    <ExpandedDetailRow
                      model={item.row.original}
                      favorites={favorites}
                      onBenchmark={onBenchmarkRow}
                      onLaunch={onLaunch}
                      onToast={onToast}
                      toolMode={toolMode}
                      onSetToolMode={onSetToolMode}
                      onCycleToolMode={onCycleToolMode}
                      onOpenFallback={onOpenFallback}
                    />
                  </td>
                </tr>
              )
            }
            const row = item.row
            const m = row.original
            const isExpanded = expandedRowId === item.key
            const rankIdx = [...top3Ids].indexOf(m.modelId)
            const rowClasses = []
            if (rankIdx >= 0) rowClasses.push(styles[`rank${rankIdx + 1}`])
            if (m.isBenchmarking) rowClasses.push(styles.benchRow)
            if (isExpanded) rowClasses.push(styles.expandedRow)
            if (toolMode) {
              const compat = getCompatibleTools(m.providerKey)
              if (!compat.includes(toolMode)) {
                rowClasses.push(styles.incompatible)
              }
            }
            if (m.status === 'noauth' || m.status === 'auth_error') {
              rowClasses.push(styles.unusable)
            }
            if (m.status === 'pending' && m.inRouterSet === false) {
              rowClasses.push(styles.notInSetRow)
            }
            return (
              <tr
                key={item.key}
                className={rowClasses.join(' ')}
                onClick={() => toggleExpand(m)}
                data-index={vi.index}
                ref={rowVirtualizer.measureElement}
              >
                {row.getVisibleCells().map(cell => {
                  const sizePx = `${cell.column.getSize()}px`
                  return (
                    <td
                      key={cell.id}
                      className={styles.td}
                      style={{ width: sizePx, minWidth: sizePx, maxWidth: sizePx }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {/* 📖 Bottom spacer: scroll height of all virtualized-out rows BELOW. */}
          {padBottom > 0 && (
            <tr aria-hidden="true" style={{ height: padBottom }}>
              <td style={{ height: padBottom, padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}