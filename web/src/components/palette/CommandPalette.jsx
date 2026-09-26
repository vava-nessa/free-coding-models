/**
 * @file web/src/components/palette/CommandPalette.jsx
 * @description ⌘K / Ctrl+P command palette — M2 full version, fed by the TUI registry.
 * 📖 M1 shipped a placeholder; this version pulls entries from
 * 📖 `src/tui/command-palette.js` (the TUI's source of truth) so the Web and
 * 📖 TUI palettes always show the same set of commands. Web-only commands
 * 📖 (open modal pages, set the theme, open the help / changelog / etc.) are
 * 📖 appended on top of the TUI list.
 *
 * 📖 The palette is a flat searchable list — the TUI's hierarchical category
 * 📖 tree is preserved as a leading "section" label per entry. We fuzzy-search
 * 📖 using the TUI's `filterCommandPaletteEntries()` so ranking is identical
 * 📖 across both surfaces.
 *
 * @functions
 *   → CommandPalette → main modal component
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { IconSearch, IconCommand, IconBolt, IconArrowsExchange, IconExternalLink } from '@tabler/icons-react'
import { buildCommandPaletteEntries, filterCommandPaletteEntries } from '../../../../src/tui/command-palette.js'
import { useI18n } from '../../i18n.jsx'
import styles from './CommandPalette.module.css'

const SECTION_META = {
  // TUI categories → emoji + label
  'filter':     { icon: '🔍', labelKey: 'palette.section.filter' },
  'sort':       { icon: '📶', labelKey: 'palette.section.sort' },
  'action':     { icon: '⚙️', labelKey: 'palette.section.action' },
  'page':       { icon: '📄', labelKey: 'palette.section.page' },
  'update':     { icon: '⬆️', labelKey: 'palette.section.update' },
  // TUI 'tool' sub-categories
  'tool':       { icon: '🧰', labelKey: 'palette.section.tool' },
}

const PING_MODE_CYCLE = ['speed', 'normal', 'slow', 'forced']

// 📖 Web-only entries (the Web has modals, not TUI overlays, so the palette
// 📖 has a few commands the TUI doesn't). They are appended to the TUI registry
// 📖 after a `Web` separator so the two surfaces stay easy to compare.
function buildWebEntries(deps) {
  const { onCycleTheme, onResetView, onSetPingMode, theme, pingMode, modelsCount, onExport, onNavigate, t } = deps
  const web = [
    // Pages
    { id: 'page.help', section: 'page', label: t('palette.web.openHelp'), keywords: ['help', 'shortcuts', 'reference'], run: () => onNavigate?.('help') },
    { id: 'page.changelog', section: 'page', label: t('palette.web.openChangelog'), keywords: ['changelog', 'release', 'history', 'version'], run: () => onNavigate?.('changelog') },
    { id: 'page.playground', section: 'page', label: t('palette.web.openPlayground'), keywords: ['playground', 'chat', 'try', 'prompt', 'router'], run: () => onNavigate?.('playground') },
    { id: 'page.install-endpoints', section: 'page', label: t('palette.web.openInstallEndpoints'), keywords: ['install', 'endpoint', 'tool', 'configure'], run: () => onNavigate?.('install-endpoints') },
    { id: 'page.installed-models', section: 'page', label: t('palette.web.openInstalledModels'), keywords: ['installed', 'models', 'tools'], run: () => onNavigate?.('installed-models') },

    // Theme
    { id: 'action.theme.cycle', section: 'action', label: t('palette.web.cycleTheme', { theme: t(`settings.theme.${theme}`) }), keywords: ['theme', 'dark', 'light', 'auto'], run: onCycleTheme },

    // Reset
    { id: 'action.reset.view', section: 'action', label: t('palette.web.resetView'), keywords: ['reset', 'view', 'clear', 'filters', 'sort'], run: onResetView },

    // Ping mode (the TUI has these too; Web keeps them for parity)
    { id: 'action.ping.speed',  section: 'action', label: t('palette.web.pingMode', { mode: t('palette.command.action-set-ping-speed') }), keywords: ['ping', 'mode', 'speed', 'fast', '2s'], run: () => onSetPingMode?.('speed') },
    { id: 'action.ping.normal', section: 'action', label: t('palette.web.pingMode', { mode: t('palette.command.action-set-ping-normal') }), keywords: ['ping', 'mode', 'normal', '10s', 'default'], run: () => onSetPingMode?.('normal') },
    { id: 'action.ping.slow',   section: 'action', label: t('palette.web.pingMode', { mode: t('palette.command.action-set-ping-slow') }), keywords: ['ping', 'mode', 'slow', '30s', 'idle'], run: () => onSetPingMode?.('slow') },
    { id: 'action.ping.forced', section: 'action', label: t('palette.web.pingMode', { mode: t('palette.command.action-set-ping-forced') }), keywords: ['ping', 'mode', 'forced', '4s'], run: () => onSetPingMode?.('forced') },

    // Export
    { id: 'action.export', section: 'action', label: t('palette.web.exportModels'), keywords: ['export', 'download', 'json', 'csv', 'clipboard'], run: onExport },
  ]
  // TUI palette entries with a 'page' type → route through the same Web pages.
  return web
}

export default function CommandPalette({
  onClose, onNavigate, onCycleTheme, onResetView,
  onSetPingMode, onOpenHelp, onOpenChangelog, onOpenCommandPalette,
  onToast, onExport, currentView, theme, pingMode, models,
  updateAvailable, latestVersion, onRunUpdate,
}) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // 📖 Build the combined list once per render. TUI registry first (so
  // 📖 its section labels come through), then Web-only entries.
  const allCommands = useMemo(() => {
    const tuiEntries = buildCommandPaletteEntries(models || []).map((entry) => {
      // 📖 The TUI palette doesn't carry a 'section' field; derive one from
      // 📖 the entry id so the Web list can show a category label.
      let section = 'action'
      if (entry.id.startsWith('filter-')) section = 'filter'
      else if (entry.id.startsWith('sort-')) section = 'sort'
      else if (entry.id.startsWith('action-')) section = 'action'
      else if (entry.id.startsWith('action-set-tool-')) section = 'tool'
      else if (entry.id.startsWith('page-') || entry.id === 'open-settings' || entry.id === 'open-help' || entry.id === 'open-changelog') section = 'page'
      return { ...entry, section }
    })
    const webEntries = buildWebEntries({
      onCycleTheme, onResetView, onSetPingMode,
      theme, pingMode, modelsCount: models?.length ?? 0, onExport, onNavigate,
      t,
    })
    // 📖 Update banner entry (only when an update is available) — mirrors
    // 📖 the TUI palette's "auto-prepended when newer version known" rule.
    const updateEntries = []
    if (updateAvailable && latestVersion) {
      updateEntries.push({
        id: 'action.update.run', section: 'update',
        label: `⬆️ ${t('palette.updateNow')} — v${latestVersion} ${t('palette.versionAvailable')}`,
        keywords: ['update', 'upgrade', 'version', 'install', 'new'],
        run: () => onRunUpdate?.(),
      })
    }
    return [...updateEntries, ...tuiEntries, ...webEntries]
  }, [locale, t, models, theme, pingMode, onCycleTheme, onResetView, onSetPingMode, onOpenChangelog, onOpenHelp, onExport, onNavigate, updateAvailable, latestVersion, onRunUpdate])

  // 📖 Filter using the TUI's exact fuzzy rank so the two palettes are 1:1.
  // 📖 Empty query → return everything; non-empty → return ranked matches.
  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    return filterCommandPaletteEntries(allCommands, query)
  }, [allCommands, query])

  // 📖 Group filtered commands by section so the list reads top-down in
  // 📖 the same order as the TUI's hierarchical view.
  const grouped = useMemo(() => {
    const groups = new Map()
    for (const cmd of filtered) {
      if (!groups.has(cmd.section)) groups.set(cmd.section, [])
      groups.get(cmd.section).push(cmd)
    }
    return Array.from(groups.entries())
  }, [filtered])

  // 📖 Build a flat list for keyboard navigation. Cursor is an index into
  // 📖 this flat list, not the grouped structure.
  const flatList = useMemo(() => grouped.flatMap(([, items]) => items), [grouped])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 📖 Clamp cursor whenever the result set changes.
  useEffect(() => {
    if (cursor >= flatList.length) setCursor(0)
  }, [flatList, cursor])

  // 📖 Keyboard handler: Esc, arrows, Enter, Tab (expand/collapse on TUI;
  // 📖 the Web list is flat so Tab cycles focus to the next button — and
  // 📖 Enter runs the highlighted command).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(flatList.length - 1, c + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatList[cursor]
        if (!item) return
        if (item.disabled) { onToast?.(t('palette.notAvailable'), 'info'); return }
        runCommand(item)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatList, cursor, onClose, onToast])

  // 📖 When a command runs, the palette closes. The handler lives in a
  // 📖 useCallback so the keyboard handler doesn't recreate on every render.
  const runCommand = useCallback((item) => {
    // 📖 TUI registry entries carry the action in their own `id` form. We
    // 📖 translate the most common ones to the Web's React callbacks.
    // 📖 For entries that don't have a Web equivalent (e.g. tool cycle, which
    // 📖 ships in M3), we route the user to the right header menu.
    const id = item.id
    if (id === 'open-settings') { onNavigate?.('settings'); onClose(); return }
    if (id === 'open-help') { onNavigate?.('help'); onClose(); return }
    if (id === 'open-changelog') { onNavigate?.('changelog'); onClose(); return }
    if (id === 'open-recommend') { onNavigate?.('recommend'); onClose(); return }
    if (id === 'open-router-dashboard') { onNavigate?.('router'); onClose(); return }
    if (id === 'open-installed-models') { onNavigate?.('installed-models'); onClose(); return }
    if (id === 'open-install-endpoints') { onNavigate?.('install-endpoints'); onClose(); return }
    if (id === 'action-update-now') { onRunUpdate?.(); onClose(); return }
    if (id === 'action-cycle-theme') { onCycleTheme?.(); onClose(); return }
    if (id === 'action-reset-view') { onResetView?.(); onClose(); return }
    if (id === 'action-cycle-ping-mode') {
      const idx = PING_MODE_CYCLE.indexOf(pingMode)
      onSetPingMode?.(PING_MODE_CYCLE[(idx + 1) % PING_MODE_CYCLE.length])
      onClose()
      return
    }
    if (id === 'action-cycle-tool-mode') { onToast?.(t('palette.toolModeNotReady'), 'info'); onClose(); return }
    if (id === 'action-toggle-favorite') { onToast?.(t('palette.favoriteHint'), 'info'); onClose(); return }
    if (id === 'action-toggle-favorite-mode') { onToast?.(t('palette.favoriteModeHint'), 'info'); onClose(); return }
    if (id === 'action-export') { onExport?.(); onClose(); return }
    if (id === 'action-benchmark-row') { onToast?.(t('palette.benchmarkHint'), 'info'); onClose(); return }

    // 📖 Filter / sort / ping mode commands are dispatched to the same Web
    // 📖 callbacks the TUI palette uses (cycle / set). For per-model filter
    // 📖 entries the user typed, we just apply a text filter.
    if (id === 'filter-provider-cycle') { onToast?.(t('palette.providerFilterHint'), 'info'); onClose(); return }
    if (id.startsWith('filter-tier-')) { onToast?.(t('palette.tierFilterHint'), 'info'); onClose(); return }
    if (id.startsWith('filter-provider-')) { onToast?.(t('palette.providerFilterHint'), 'info'); onClose(); return }
    if (id === 'filter-configured-toggle') { onToast?.(t('palette.visibilityFilterHint'), 'info'); onClose(); return }
    if (id.startsWith('sort-')) { onToast?.(t('palette.sortHint'), 'info'); onClose(); return }
    if (id === 'action-set-ping-speed')  { onSetPingMode?.('speed');  onClose(); return }
    if (id === 'action-set-ping-normal') { onSetPingMode?.('normal'); onClose(); return }
    if (id === 'action-set-ping-slow')   { onSetPingMode?.('slow');   onClose(); return }
    if (id === 'action-set-ping-forced') { onSetPingMode?.('forced'); onClose(); return }

    // 📖 Fallback for any TUI command the Web hasn't wired yet.
    if (typeof item.run === 'function') {
      item.run()
      onClose()
      return
    }
    onToast?.(t('palette.notWired'), 'info')
    onClose()
  }, [onNavigate, onClose, onToast, onCycleTheme, onResetView, onSetPingMode, onOpenHelp, onOpenChangelog, onRunUpdate, onExport, pingMode])

  // 📖 Keep the focused item in view as the cursor moves. Mirrors the TUI
  // 📖 palette's "follow the selection" behavior.
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-cmd-index="${cursor}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <IconSearch size={16} stroke={1.5} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder={t('palette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <span className={styles.kbd}><IconCommand size={10} stroke={1.5} />K</span>
        </div>

        <div className={styles.list} ref={listRef} role="listbox">
          {flatList.length === 0 && (
            <div className={styles.empty}>{t('palette.noMatch')}</div>
          )}
          {grouped.map(([section, items]) => {
            const meta = SECTION_META[section] || { icon: '•', labelKey: 'palette.section.action' }
            return (
              <div key={section} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionIcon}>{meta.icon}</span>
                  <span>{t(meta.labelKey)}</span>
                </div>
                {items.map((cmd) => {
                  // 📖 Flat index across all groups so the keyboard cursor is stable.
                  const flatIdx = flatList.indexOf(cmd)
                  const isActive = flatIdx === cursor
                  return (
                    <button
                      key={cmd.id}
                      data-cmd-index={flatIdx}
                      className={`${styles.item} ${isActive ? styles.itemActive : ''} ${cmd.disabled ? styles.itemDisabled : ''}`}
                      onClick={() => runCommand(cmd)}
                      onMouseEnter={() => setCursor(flatIdx)}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={cmd.disabled ? 'true' : undefined}
                    >
                      <span className={styles.itemLabel}>
                        {cmd.label}
                        {cmd.shortcut && <span className={styles.shortcut}>{cmd.shortcut}</span>}
                      </span>
                      {cmd.description && <span className={styles.itemDesc}>{cmd.description}</span>}
                      {isActive && <span className={styles.itemEnter}>↵</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> {t('palette.navigate')}</span>
          <span><kbd>↵</kbd> {t('palette.select')}</span>
          <span><kbd>Esc</kbd> {t('common.close').toLowerCase()}</span>
          <span className={styles.footerRight}>
            {t('palette.poweredByTui')}
            <IconExternalLink size={10} stroke={1.5} style={{ marginLeft: 4 }} />
          </span>
        </div>
      </div>
    </div>
  )
}
