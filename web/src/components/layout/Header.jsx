/**
 * @file web/src/components/layout/Header.jsx
 * @description Top header bar — global navigation + search + actions.
 * 📖 Layout refactor (M1): no more left sidebar. All navigation lives here.
 * 📖 - Always-visible nav buttons: Dashboard, Settings, Analytics, Recommend, Router
 * 📖 - Overflow menu (kebab): Help, Changelog, Install Endpoints, Installed Models
 * 📖 - Right side: ⌘K (command palette), AI Latency, theme, export
 * 📖 Each unimplemented feature shows a friendly "Coming in M2/M3/M4" toast so
 * 📖 the menu structure is honest and complete from day one.
 */
import { useEffect, useRef, useState } from 'react'
import {
  IconBolt, IconSearch, IconDownload, IconSettings, IconMoon, IconSun,
  IconPlayerPlay, IconCommand, IconLayoutDashboard, IconActivity,
  IconSparkles, IconRoute, IconDots, IconQuestionMark, IconHistory,
  IconPlug, IconFolders,
} from '@tabler/icons-react'
import styles from './Header.module.css'

// 📖 Top-level nav items — always visible as buttons. Inlined here so the
// 📖 order, icon, and "coming soon" milestone are colocated with the
// 📖 rendering code. When a view ships, remove the `comingIn` field.
const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: IconLayoutDashboard },
  { id: 'settings',    label: 'Settings',    icon: IconSettings },
  { id: 'analytics',   label: 'Analytics',   icon: IconActivity },
  { id: 'recommend',   label: 'Recommend',   icon: IconSparkles,   comingIn: 'M3' },
  { id: 'router',      label: 'Router',      icon: IconRoute,      comingIn: 'M4' },
]

// 📖 Overflow menu items — Help, Changelog, Install Endpoints, Installed Models.
const MENU_ITEMS = [
  { id: 'help',              label: 'Help',               icon: IconQuestionMark, comingIn: 'M2' },
  { id: 'changelog',         label: 'Changelog',          icon: IconHistory,      comingIn: 'M2' },
  { id: 'install-endpoints', label: 'Install Endpoints',  icon: IconPlug,         comingIn: 'M4' },
  { id: 'installed-models',  label: 'Installed Models',   icon: IconFolders,      comingIn: 'M4' },
]

export default function Header({
  searchQuery, onSearchChange,
  currentView, onNavigate,
  onToggleTheme, onOpenExport, onOpenCommandPalette,
  onBenchmark, benchmarkRunning, benchmarkTotal, benchmarkCompleted,
  modelsCount, theme, onToast,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // 📖 Close the overflow menu on outside click or Esc.
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleNavClick = (item) => {
    if (item.comingIn) {
      onToast?.(`${item.label} arrives in milestone ${item.comingIn}.`, 'info')
      return
    }
    onNavigate(item.id)
  }

  const handleMenuClick = (item) => {
    setMenuOpen(false)
    if (item.comingIn) {
      onToast?.(`${item.label} arrives in milestone ${item.comingIn}.`, 'info')
      return
    }
    onNavigate(item.id)
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>&gt;</span>
          <span className={styles.logoText}>
            <span className={styles.logoTextHighlight}>free</span>
            <span>-coding-models</span>
            <span className={styles.logoTextHighlight}>_</span>
          </span>
        </div>
        <span className={styles.version}>v{__APP_VERSION__}</span>

        {/* Always-visible primary nav (replaces the old left sidebar) */}
        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                className={`${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}
                onClick={() => handleNavClick(item)}
                title={item.comingIn ? `${item.label} — coming in ${item.comingIn}` : item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={14} stroke={1.5} />
                <span>{item.label}</span>
                {item.comingIn && <span className={styles.comingBadge}>{item.comingIn}</span>}
              </button>
            )
          })}

          {/* Overflow menu (kebab) — hidden features & occasional flows */}
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              className={`${styles.navBtn} ${styles.menuTrigger}`}
              onClick={() => setMenuOpen((o) => !o)}
              title="More features"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <IconDots size={16} stroke={1.5} />
            </button>
            {menuOpen && (
              <div className={styles.menuPopover} role="menu">
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      className={styles.menuItem}
                      onClick={() => handleMenuClick(item)}
                      role="menuitem"
                    >
                      <Icon size={14} stroke={1.5} />
                      <span>{item.label}</span>
                      {item.comingIn && <span className={styles.comingBadge}>{item.comingIn}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className={styles.center}>
        <div className={styles.searchBar}>
          <span className={styles.searchIcon}><IconSearch size={16} stroke={1.5} /></span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search models, providers, tiers..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className={styles.right}>
        {/* ⌘K — the only global keyboard shortcut, opens the command palette */}
        <button
          className={styles.cmdkBtn}
          onClick={onOpenCommandPalette}
          title="Command palette (⌘K / Ctrl+P)"
          aria-label="Open command palette"
        >
          <IconCommand size={14} stroke={1.5} />
          <span className={styles.cmdkLabel}>⌘K</span>
        </button>

        <button
          className={`${styles.benchmarkBtn} ${benchmarkRunning ? styles.benchmarkActive : ''}`}
          onClick={onBenchmark}
          disabled={benchmarkRunning}
          title={benchmarkRunning ? `AI Speed Test running — ${benchmarkCompleted}/${benchmarkTotal}` : `Run AI Latency benchmark on ${modelsCount} visible models`}
        >
          <IconPlayerPlay size={14} stroke={1.5} />
          {benchmarkRunning ? (
            <span className={styles.benchmarkRunning}>
              <span className={styles.spinner} />
              RUN {benchmarkCompleted}/{benchmarkTotal}
            </span>
          ) : (
            <span>AI Latency</span>
          )}
        </button>

        <button className={styles.iconBtn} onClick={onToggleTheme} title={`Theme: ${theme} (click to cycle auto / dark / light)`}>
          {theme === 'light' ? <IconMoon size={16} stroke={1.5} /> : <IconSun size={16} stroke={1.5} />}
        </button>
        <button className={styles.iconBtn} onClick={onOpenExport} title="Export Data">
          <IconDownload size={16} stroke={1.5} />
        </button>
      </div>
    </header>
  )
}
