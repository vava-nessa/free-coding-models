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
  IconPlug, IconFolders, IconMenu2, IconMessageChatbot,
} from '@tabler/icons-react'
import ToolPicker from '../tools/ToolPicker.jsx'
import styles from './Header.module.css'
import { useI18n } from '../../i18n.jsx'

// 📖 Top-level nav items — always visible as buttons. Inlined here so the
// 📖 order, icon, and "coming soon" milestone are colocated with the
// 📖 rendering code. When a view ships, remove the `comingIn` field.
const NAV_ITEMS = [
  { id: 'dashboard',         labelKey: 'nav.dashboard',       icon: IconLayoutDashboard },
  { id: 'router',            labelKey: 'nav.router',          icon: IconRoute },
  { id: 'router-v2',         labelKey: 'nav.routerV2',        icon: IconRoute, beta: true },
  { id: 'playground',        labelKey: 'nav.playground',      icon: IconMessageChatbot },
  { id: 'help',              labelKey: 'nav.help',            icon: IconQuestionMark },
  { id: 'install-endpoints', labelKey: 'nav.installEndpoints',icon: IconPlug },
]

// 📖 Overflow menu items
const MENU_ITEMS = [
  { id: 'analytics',         labelKey: 'nav.analytics',       icon: IconActivity },
  { id: 'recommend',         label: 'Recommend', labelKey: 'nav.recommend', icon: IconSparkles },
  { id: 'changelog',         labelKey: 'nav.changelog',       icon: IconHistory },
  { id: 'installed-models',  labelKey: 'nav.installedModels', icon: IconFolders },
]

export default function Header({
  searchQuery, onSearchChange,
  currentView, onNavigate,
  onToggleTheme, onOpenExport, onOpenCommandPalette,
  onBenchmark, benchmarkRunning, benchmarkTotal, benchmarkCompleted,
  modelsCount, theme, onToast,
  toolMode = 'opencode', onSetToolMode, onCycleToolMode,
  updateSlot = null,
}) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef(null)

  // 📖 Close the overflow menu on outside click or Esc.
  useEffect(() => {
    if (!menuOpen && !mobileNavOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenuOpen(false); setMobileNavOpen(false) }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, mobileNavOpen])

  const handleNavClick = (item) => {
    if (item.comingIn) {
      onToast?.(`${t(item.labelKey)} arrives in milestone ${item.comingIn}.`, 'info')
      return
    }
    onNavigate(item.id)
    setMobileNavOpen(false)
  }

  const handleMenuClick = (item) => {
    setMenuOpen(false)
    if (item.comingIn) {
      onToast?.(`${t(item.labelKey)} arrives in milestone ${item.comingIn}.`, 'info')
      return
    }
    onNavigate(item.id)
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo} onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
          <svg className={styles.logoIconSvg} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 5L11 12L4 19" stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 5V19M14 5H21M14 11H18" stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={styles.logoText}>
            <span className={styles.logoTextHighlight}>free</span>
            <span>-coding-models</span>
            <span className={styles.logoTextHighlight}>_</span>
          </span>
        </div>
        <span className={styles.version}>v{__APP_VERSION__}</span>

        {/* 📖 M5: Hamburger for narrow viewports (never a sidebar). Shows a
           dropdown with all nav + overflow items on mobile. */}
        <button
          className={styles.hamburgerBtn}
          onClick={() => setMobileNavOpen((o) => !o)}
          aria-label={t('nav.navigationMenu')}
          aria-expanded={mobileNavOpen}
          aria-haspopup="true"
        >
          <IconMenu2 size={18} stroke={1.5} />
        </button>
        {mobileNavOpen && (
          <div className={styles.mobileNav} role="menu">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`${styles.mobileNavItem} ${currentView === item.id ? styles.mobileNavActive : ''}`}
                  onClick={() => handleNavClick(item)}
                  role="menuitem"
                >
                  <Icon size={16} stroke={1.5} />
                  <span>{t(item.labelKey)}</span>
                  {item.beta && <span className={styles.betaBadge}>BETA</span>}
                </button>
              )
            })}
            <div className={styles.mobileNavDivider} />
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={styles.mobileNavItem}
                  onClick={() => handleMenuClick(item)}
                  role="menuitem"
                >
                  <Icon size={16} stroke={1.5} />
                  <span>{t(item.labelKey)}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Always-visible primary nav (replaces the old left sidebar) */}
        <nav className={styles.nav} aria-label={t('nav.primary')}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                className={`${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}
                onClick={() => handleNavClick(item)}
                title={item.comingIn ? `${t(item.labelKey)} — coming in ${item.comingIn}` : t(item.labelKey)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={14} stroke={1.5} />
                <span>{t(item.labelKey)}</span>
                {item.beta && <span className={styles.betaBadge}>BETA</span>}
                {item.comingIn && <span className={styles.comingBadge}>{item.comingIn}</span>}
              </button>
            )
          })}

          {/* Overflow menu (kebab) — hidden features & occasional flows */}
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              className={`${styles.navBtn} ${styles.menuTrigger} ${MENU_ITEMS.some((m) => m.id === currentView) ? styles.navBtnActive : ''}`}
              onClick={() => setMenuOpen((o) => !o)}
              title={t('nav.moreFeatures')}
              aria-label={t('nav.moreFeatures')}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <IconDots size={16} stroke={1.5} />
            </button>
            {menuOpen && (
              <div className={styles.menuPopover} role="menu">
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon
                  const isActive = currentView === item.id
                  return (
                    <button
                      key={item.id}
                      className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
                      onClick={() => handleMenuClick(item)}
                      role="menuitem"
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={14} stroke={1.5} />
                      <span>{t(item.labelKey)}</span>
                      {item.comingIn && <span className={styles.comingBadge}>{item.comingIn}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className={styles.right}>
        <button
          className={`${styles.navBtn} ${currentView === 'settings' ? styles.navBtnActive : ''}`}
          onClick={() => onNavigate('settings')}
          title={t('nav.settings')}
          aria-current={currentView === 'settings' ? 'page' : undefined}
          style={{ marginRight: '2px' }}
        >
          <IconSettings size={14} stroke={1.5} />
          <span>{t('nav.settings')}</span>
        </button>

        <ToolPicker
          toolMode={toolMode}
          onSetToolMode={onSetToolMode}
          onCycleToolMode={onCycleToolMode}
        />

        {/* ⌘K — the only global keyboard shortcut, opens the command palette */}
        <button
          className={styles.cmdkBtn}
          onClick={onOpenCommandPalette}
          title={`${t('nav.commandPalette')} (⌘K / Ctrl+P)`}
          aria-label={`${t('nav.commandPalette')} (⌘K)`}
        >
          <IconCommand size={14} stroke={1.5} />
          <span className={styles.cmdkLabel}>⌘K</span>
        </button>

        <button
          className={`${styles.benchmarkBtn} ${benchmarkRunning ? styles.benchmarkActive : ''}`}
          onClick={onBenchmark}
          disabled={benchmarkRunning}
          title={benchmarkRunning ? t('dashboard.aiSpeedTestRunning', { completed: benchmarkCompleted, total: benchmarkTotal }) : t('dashboard.runBenchmark', { count: modelsCount })}
          aria-label={benchmarkRunning ? t('dashboard.aiSpeedTestRunning', { completed: benchmarkCompleted, total: benchmarkTotal }) : t('dashboard.aiLatency')}
        >
          <IconPlayerPlay size={14} stroke={1.5} />
          {benchmarkRunning ? (
            <span className={styles.benchmarkRunning}>
              <span className={styles.spinner} />
              RUN {benchmarkCompleted}/{benchmarkTotal}
            </span>
          ) : (
            <span>{t('dashboard.aiLatency')}</span>
          )}
        </button>

        {/* 📖 M2: update chip slot. Hidden when no update is available. */}
        {updateSlot}

        <button className={styles.iconBtn} onClick={onToggleTheme} title={t('nav.themeTitle', { theme: t(`settings.theme.${theme}`) })} aria-label={t('nav.themeLabel', { theme: t(`settings.theme.${theme}`) })}>
          {theme === 'light' ? <IconMoon size={16} stroke={1.5} /> : <IconSun size={16} stroke={1.5} />}
        </button>
        <button className={styles.iconBtn} onClick={onOpenExport} title={t('nav.exportData')} aria-label={t('dashboard.exportData')}>
          <IconDownload size={16} stroke={1.5} />
        </button>
      </div>
    </header>
  )
}
