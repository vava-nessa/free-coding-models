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

const SECTIONS = [
  {
    id: 'navigation',
    title: '🧭 Navigation',
    items: [
      { key: '↑ / ↓', desc: 'Navigate rows in the main table (planned — currently mouse-only)' },
      { key: 'Enter', desc: 'Open the detail panel for the focused row' },
      { key: 'Esc', desc: 'Close any open modal or detail panel' },
    ],
  },
  {
    id: 'filters',
    title: '🔍 Filters',
    items: [
      { key: 'Tier chip', desc: 'Click to cycle: All → S+ → S → A+ → A → A- → B+ → B → C → All' },
      { key: 'Status chip', desc: 'Click to cycle: All → Up → Down → Pending' },
      { key: 'Verdict chip', desc: 'Click to cycle: All → Perfect → Normal → Spiky → Slow → Overloaded → Down → Unstable → Pending' },
      { key: 'Health chip', desc: 'Click to cycle: All → Up → Timeout → Down → Pending → No key → Auth err' },
      { key: 'Visibility', desc: 'Normal (all) / Configured only (hide no-key) / Usable only (UP + good verdict)' },
      { key: 'Provider dropdown', desc: 'Filter by provider' },
      { key: 'Custom text filter', desc: 'Apply via ⌘K palette or `Apply text filter` — clear with the X chip' },
      { key: 'Reset button', desc: 'Clears every active filter + sort back to defaults' },
    ],
  },
  {
    id: 'sort',
    title: '📶 Sort',
    items: [
      { key: 'Click any column header', desc: 'Sort asc → desc → reset (no sort, default order)' },
      { key: 'Resizable columns', desc: 'Drag the right edge of any header to resize. Double-click resets one column.' },
    ],
  },
  {
    id: 'favorites',
    title: '⭐ Favorites',
    items: [
      { key: 'Star button (per row)', desc: 'Click to favorite / unfavorite the model (TUI: F key)' },
      { key: 'Detail panel', desc: 'Favorite + Up/Down reorder + current priority rank (TUI: Shift+↑/↓)' },
      { key: 'Pinned mode', desc: 'In the Settings view, toggle "Pinned + always visible" (TUI: Y key)' },
      { key: 'Shared with TUI', desc: 'Favorites are persisted in the same ~/.free-coding-models.json the TUI uses' },
    ],
  },
  {
    id: 'benchmark',
    title: '🤖 AI Speed Test (benchmark)',
    items: [
      { key: 'Header button', desc: 'Run a global AI Speed Test on every visible model' },
      { key: 'AI Lat. cell', desc: 'Click any AI Lat. cell to benchmark just that model (TUI: Ctrl+A)' },
      { key: 'Detail panel', desc: 'Dedicated "AI Speed Test" button (TUI: Ctrl+A)' },
      { key: 'TPS column', desc: 'Tokens per second for the model — appears after a benchmark run' },
      { key: 'Latency column', desc: 'Real completion latency (not just ping) for the model' },
    ],
  },
  {
    id: 'tools',
    title: '🧰 Tool mode (M3)',
    items: [
      { key: 'M3 shipped', desc: 'Endpoint target picker, per-row Install Endpoint button, and incompatible-target fallback modal' },
    ],
  },
  {
    id: 'palette',
    title: '⚡ Command palette',
    items: [
      { key: '⌘K / Ctrl+P', desc: 'The Web\'s only global keyboard shortcut — toggles the command palette' },
      { key: 'Type to search', desc: 'Fuzzy match across all filters, sorts, tools, pages, and theme / ping / reset actions' },
      { key: '↑ / ↓ + Enter', desc: 'Navigate the results and execute the highlighted command' },
      { key: 'Esc', desc: 'Close the palette without running anything' },
    ],
  },
  {
    id: 'theme',
    title: '🌗 Theme',
    items: [
      { key: 'Theme button (header)', desc: 'Click to cycle: auto → dark → light (TUI: G key)' },
      { key: 'Auto mode', desc: 'Follows the OS prefers-color-scheme preference and updates live' },
    ],
  },
  {
    id: 'ping',
    title: '⚡ Ping mode',
    items: [
      { key: 'Speed / Normal / Slow / Forced', desc: 'Ping cadence (2s / 10s / 30s / 4s) — TUI: W key' },
      { key: 'next ping in Xs', desc: 'Live countdown shown in the FilterBar (TUI footer style)' },
    ],
  },
  {
    id: 'url',
    title: '🔗 URL deep-linking',
    items: [
      { key: '?tier=S+&sort=verdict&origin=groq&view=dashboard', desc: 'Every filter / sort / view is reflected in the URL — share pre-filtered links' },
    ],
  },
  {
    id: 'cli',
    title: '⌨️ CLI parity',
    items: [
      { key: 'Same storage', desc: 'The Web reads + writes the same ~/.free-coding-models.json as the TUI' },
      { key: 'Same engine', desc: 'All model parsing, ping, and benchmark code is shared with the TUI' },
    ],
  },
  {
    id: 'how-router-works',
    title: '🌐 How the FCM Router works',
    items: [
      { key: 'Smart router', desc: 'Point any OpenAI client at http://localhost:19280/v1 with model: "fcm". The daemon picks the healthiest model in the active set and forwards the request with automatic failover.' },
      { key: 'Pre-prompt', desc: 'A first-class system message is injected on every proxied request. The default introduces the assistant as the FCM routing agent. Edit from Settings.' },
      { key: 'Probes', desc: 'Every 10s/30s/120s (eco/balanced/aggressive) the daemon sends a 1-token chat-completion ping to every model in the active set. The probe measures latency + status code, not just URL reachability — so a wrong API key is caught and the circuit opens.' },
      { key: 'Circuit breaker', desc: 'Per-model state. Healthy (green) = last probe 2xx, route here. Down (red) = last 3 probes failed, skip until cooldown. Recovering (yellow) = cooldown expired, retrying. Auth error (orange) = 401/403, your key is wrong. Deprecated (gray) = removed from catalog, will be replaced by auto-heal.' },
      { key: 'Failover order', desc: 'Models are tried in priority order. A model in Recovering/Down/Auth error is skipped — the request goes to the next healthy one. If ALL fail, you get 503 with the "models_tried" list in the error body.' },
      { key: 'Auto-heal', desc: 'On daemon start, every Auth-error / Deprecated model in the active set is swapped for a working alternative (same provider first, then cross-provider). The first time you add/remove/reorder a model, auto-heal switches off.' },
      { key: 'Rate limits', desc: 'Each provider has its own quota. Common free-tier limits: Groq 14 400 RPD, Mistral 1 RPS, NVIDIA ~40 RPM, OpenRouter 50 RPD. When a provider returns 429, the router fails over. When daily quota is exhausted, the model goes Auth error and auto-heal swaps it out next start.' },
    ],
  },
]

export default function HelpView({ onClose }) {
  const [query, setQuery] = useState('')

  // 📖 Filter every section's items by the live query. Case-insensitive
  // 📖 substring match on the key or description. Empty results hide the
  // 📖 section entirely.
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SECTIONS
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.key.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q),
      ),
    })).filter((section) => section.items.length > 0)
  }, [query])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>❓ Help & Keyboard Shortcuts</h2>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close help">
              <IconX size={18} stroke={1.5} />
            </button>
          </div>
          <div className={styles.searchBar}>
            <IconSearch size={14} stroke={1.5} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search help (filters, hotkeys, TUI parity)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <p className={styles.note}>
            The Web Dashboard is mouse-first. The only global keyboard shortcut is{' '}
            <kbd>⌘K</kbd> / <kbd>Ctrl+P</kbd> for the command palette — everything else
            lives here, in the header menu, or in modals.
          </p>
        </div>
        <div className={styles.body}>
          {filteredSections.length === 0 ? (
            <div className={styles.empty}>No help matches "{query}".</div>
          ) : (
            filteredSections.map((section) => (
              <section key={section.id} className={styles.section}>
                <h3 className={styles.sectionTitle}>{section.title}</h3>
                <ul className={styles.itemList}>
                  {section.items.map((item) => (
                    <li key={item.key + item.desc} className={styles.item}>
                      <span className={styles.itemKey}>{item.key}</span>
                      <span className={styles.itemDesc}>{item.desc}</span>
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
