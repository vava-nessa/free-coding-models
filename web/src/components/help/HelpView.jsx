/**
 * @file web/src/components/help/HelpView.jsx
 * @description Help modal — M2 parity with the TUI's `K` / `I` help overlay.
 * 📖 Renders the same content the TUI help overlay does, as JSX, with a live
 * 📖 search bar at the top. The TUI source-of-truth is `src/tui/cli-help.js`
 * 📖 (CLI flags) and `src/tui/overlays.js` `renderHelp` (key bindings) — we
 * 📖 re-render those lists statically here to avoid a TUI-engine import that
 * 📖 would pull chalk into the Web bundle.
 *
 * 📖 The header's overflow menu and the ⌘K palette expose "Help" as a page;
 * 📖 this component is rendered as a full-screen modal inside the Web.
 *
 * @functions
 *   → HelpView → main modal component
 */
import { useState, useMemo } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import styles from './HelpView.module.css'
import { useI18n } from '../../i18n.jsx'

const SECTIONS = [
  { id: 'navigation', icon: '🧭', titleKey: 'help.navigation', items: [
    ['navigation.rows', '↑ / ↓'], ['navigation.details', 'Enter'], ['navigation.close', 'Esc'],
  ] },
  { id: 'filters', icon: '🔍', titleKey: 'help.filters', items: [
    ['filters.tier', 'Tier chip'], ['filters.status', 'Status chip'], ['filters.verdict', 'Verdict chip'],
    ['filters.health', 'Health chip'], ['filters.visibility', 'Visibility'], ['filters.provider', 'Provider dropdown'],
    ['filters.text', 'Custom text filter'], ['filters.reset', 'Reset button'],
  ] },
  { id: 'sort', icon: '📶', titleKey: 'help.sort', items: [
    ['sort.columns', 'Click any column header'], ['sort.resize', 'Resizable columns'],
  ] },
  { id: 'favorites', icon: '⭐', titleKey: 'help.favorites', items: [
    ['favorites.row', 'Star button (per row)'], ['favorites.detail', 'Detail panel'],
    ['favorites.pinned', 'Pinned mode'], ['favorites.shared', 'Shared with TUI'],
  ] },
  { id: 'benchmark', icon: '🤖', titleKey: 'help.speedTest', items: [
    ['benchmark.global', 'Header button'], ['benchmark.single', 'AI Lat. cell'], ['benchmark.detail', 'Detail panel'],
    ['benchmark.tps', 'TPS column'], ['benchmark.latency', 'Latency column'],
  ] },
  { id: 'tools', icon: '🧰', titleKey: 'help.toolMode', items: [['tools.shipped', 'M3 shipped']] },
  { id: 'palette', icon: '⚡', titleKey: 'help.palette', items: [
    ['palette.shortcut', '⌘K / Ctrl+P'], ['palette.search', 'Type to search'],
    ['palette.execute', '↑ / ↓ + Enter'], ['palette.close', 'Esc'],
  ] },
  { id: 'theme', icon: '🌗', titleKey: 'help.theme', items: [['theme.cycle', 'Theme button (header)'], ['theme.auto', 'Auto mode']] },
  { id: 'ping', icon: '⚡', titleKey: 'help.pingMode', items: [['ping.cadence', 'Speed / Normal / Slow / Forced'], ['ping.countdown', 'Next ping countdown']] },
  { id: 'url', icon: '🔗', titleKey: 'help.deepLinks', items: [['url.filters', '?tier=S+&sort=verdict&origin=groq&view=dashboard']] },
  { id: 'cli', icon: '⌨️', titleKey: 'help.cliParity', items: [['cli.storage', 'Same storage'], ['cli.engine', 'Same engine']] },
  { id: 'how-router-works', icon: '🌐', titleKey: 'help.routerHow', items: [
    ['router.smart', 'Smart router'], ['router.prePrompt', 'Pre-prompt'], ['router.probes', 'Probes'],
    ['router.breaker', 'Circuit breaker'], ['router.failover', 'Failover order'],
    ['router.autoHeal', 'Auto-heal'], ['router.rateLimits', 'Rate limits'],
  ] },
].map((section) => ({
  ...section,
  items: section.items.map(([id, fallbackLabel]) => ({
    labelKey: `help.item.${id}.label`,
    descriptionKey: `help.item.${id}.description`,
    fallbackLabel,
  })),
}))

export default function HelpView({ onClose }) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')

  // 📖 Filter every section's items by the live query. Case-insensitive
  // 📖 substring match on the key or description. Empty results hide the
  // 📖 section entirely.
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    const localized = SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        label: t(item.labelKey),
        description: t(item.descriptionKey),
      })),
    }))
    if (!q) return localized
    return localized.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => `${item.label} ${item.description} ${item.fallbackLabel}`.toLowerCase().includes(q),
      ),
    })).filter((section) => section.items.length > 0)
  }, [query, locale, t])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>❓ {t('help.title')} · {t('help.shortcuts')}</h2>
            <button className={styles.closeBtn} onClick={onClose} aria-label={t('help.close')}>
              <IconX size={18} stroke={1.5} />
            </button>
          </div>
          <div className={styles.searchBar}>
            <IconSearch size={14} stroke={1.5} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder={t('help.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <p className={styles.note}>
            {t('help.note')} <kbd>⌘K</kbd> / <kbd>Ctrl+P</kbd>
          </p>
        </div>
        <div className={styles.body}>
          {filteredSections.length === 0 ? (
            <div className={styles.empty}>{t('help.noMatches', { query })}</div>
          ) : (
            filteredSections.map((section) => (
              <section key={section.id} className={styles.section}>
                <h3 className={styles.sectionTitle}>{section.icon} {t(section.titleKey)}</h3>
                <ul className={styles.itemList}>
                  {section.items.map((item) => (
                    <li key={item.labelKey} className={styles.item}>
                      <span className={styles.itemKey}>{item.label}</span>
                      <span className={styles.itemDesc}>{item.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
