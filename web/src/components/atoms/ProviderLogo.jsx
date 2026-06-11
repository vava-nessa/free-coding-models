/**
 * @file web/src/components/atoms/ProviderLogo.jsx
 * @description Renders a provider cell as [icon + text-wordmark] on a single line.
 *
 * @details
 *   - Looks up the provider's assets under `web/assets/providers/<folder>/`.
 *   - Prefers the **color** icon when available (recognizable + lively in both themes);
 *     falls back to the **mono** (currentColor) icon when no color variant exists.
 *   - Renders the **text** wordmark (`<id>-text.svg`) next to the icon when available.
 *     Text wordmarks use `fill="currentColor"`, so they automatically adapt to the
 *     active theme (white in dark mode, black in light mode) without any JS.
 *   - For providers without a text wordmark (legacy OVH / Scaleway SVGs, or models
 *     like Codestral that share a parent's brand), shows the graphic icon + the
 *     human-readable caption as plain text.
 *   - Inlines the SVGs as raw strings via `import.meta.glob(..., { as: 'raw' })` so
 *     `currentColor` resolves against the cell's text color. Using `<img src>` would
 *     sandbox the SVG and break the theme inheritance.
 *   - Constrained to a single row height (~22px) via `--pl-max-h` so the cell never
 *     grows taller than the rest of the table, regardless of which variant is shown.
 *
 * @param {object} props
 * @param {string} props.providerKey - The kebab-case key from sources.js (e.g. 'nvidia', 'github-models', 'opencode-zen', 'googleai').
 * @param {string} props.origin      - Human-readable name from sources.js, used as fallback text / tooltip.
 * @functions
 *   → ProviderLogo (default export)
 *   → getSvg (internal) – raw-string lookup keyed by asset path
 * @see  web/src/components/dashboard/ModelTable.jsx (consumer)
 * @see  web/assets/providers/ (asset source)
 * @see  https://lobehub.com/icons (variant inventory source)
 */
import styles from './ProviderLogo.module.css'

// 📖 Eager raw import of every provider SVG. The key is a relative path from this
// 📖 file; the value is the SVG markup as a string. Vite bundles it at build time.
// 📖 Path resolves to `web/assets/providers/**/*.svg` (3 levels up from atoms/).
const svgModules = import.meta.glob('../../../assets/providers/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// 📖 Provider key → asset folder + variant availability.
// 📖 `folder` MUST match the directory name under web/assets/providers/.
// 📖 `hasColor` / `hasText` are derived from the lobe-icons static-svg inventory
// 📖 (see https://lobehub.com/icons). `legacy` marks providers that ship with a
// 📖 single graphic SVG and no wordmark — for those we render icon + caption.
// 📖 Keys MUST match the `providerKey` field sent by the backend (kebab-case for
// 📖 compound names like `github-models` / `opencode-zen` — see sources.js).
const PROVIDER_CONFIG = {
  nvidia:           { folder: 'nvidia',      hasColor: true,  hasText: true  },
  groq:             { folder: 'groq',        hasColor: false, hasText: true  },
  cerebras:         { folder: 'cerebras',    hasColor: true,  hasText: true  },
  googleai:         { folder: 'aistudio',    hasColor: false, hasText: true  },
  'github-models':  { folder: 'github',      hasColor: false, hasText: true  },
  mistral:          { folder: 'mistral',     hasColor: true,  hasText: true  },
  cloudflare:       { folder: 'cloudflare',  hasColor: true,  hasText: true  },
  openrouter:       { folder: 'openrouter',  hasColor: false, hasText: true  },
  sambanova:        { folder: 'sambanova',   hasColor: true,  hasText: true  },
  // 📖 OVH's logo is itself a full wordmark ("OVHcloud") — adding the origin
  // 📖 name "OVHcloud AI" as a caption would be redundant. `noCaption` skips
  // 📖 the text label and lets the wordmark stand on its own. The user pointed
  // 📖 us to https://www.ovhcloud.com/.../OVHcloud_logo.svg#ocmscloud_logo for
  // 📖 the international wordmark; we extract the inner <symbol> and save it as
  // 📖 a renderable <svg> with the same viewBox.
  ovhcloud:         { folder: 'ovhcloud',    hasColor: false, hasText: false, legacy: true, noCaption: true },
  // 📖 Scaleway's pre-existing asset is `ScalewayLogo.svg` (capitalized) inside
  // 📖 `scalewaylogo/`. The default filename lookup would look for
  // 📖 `scalewaylogo/scalewaylogo.svg` which doesn't exist, so `iconFile`
  // 📖 overrides it. The wordmark IS the brand name ("Scaleway") so adding
  // 📖 the origin name as a separate caption is redundant — `noCaption` skips it.
  // 📖 `iconClass: 'scalewayLogo'` attaches a global class so CSS can swap to
  // 📖 a lighter purple in dark mode (the brand #521094 is barely visible on
  // 📖 the near-black background). SVG paths were rewritten to use
  // 📖 `fill="currentColor"` for this CSS control.
  scaleway:         { folder: 'scalewaylogo', iconFile: 'ScalewayLogo', iconClass: 'scalewayLogo', hasColor: false, hasText: false, legacy: true, noCaption: true },
  zai:              { folder: 'zai',         hasColor: false, hasText: true  },
  qwen:             { folder: 'qwen',        hasColor: true,  hasText: true  },
  'opencode-zen':   { folder: 'opencode',    hasColor: false, hasText: true  },
  // 📖 Codestral intentionally reuses Mistral's branding — the colored Mistral
  // 📖 icon (so the brand association is visible) + the literal caption
  // 📖 "Codestral" as plain text. `iconFile` overrides the default filename
  // 📖 lookup (we want mistral-color, not codestral-color which doesn't exist),
  // 📖 and `caption` overrides the origin so we don't show "Codestral" twice.
  codestral:        { folder: 'mistral',     iconFile: 'mistral-color', hasColor: true, hasText: false, legacy: true, caption: 'Codestral' },
}

function getSvg(folder, filename) {
  if (!folder || !filename) return null
  return svgModules[`../../../assets/providers/${folder}/${filename}.svg`] || null
}

export default function ProviderLogo({ providerKey, origin }) {
  const cfg = PROVIDER_CONFIG[providerKey]

  // 📖 Unknown / unmapped provider: fall back to plain text. Same as the old
  // 📖 `.providerPill` so we don't visually regress on rows we couldn't classify.
  if (!cfg) {
    return <span className={styles.fallback}>{origin}</span>
  }

  // 📖 Pick the best icon: prefer the colorful variant, fall back to mono.
  // 📖 Mono uses currentColor → inherits the cell's text color → theme-adaptive.
  // 📖 `cfg.iconFile` overrides the default filename so providers like Codestral
  // 📖 can borrow another provider's icon (e.g. mistral-color for brand parity).
  const iconSvg =
    (cfg.iconFile && getSvg(cfg.folder, cfg.iconFile)) ||
    (cfg.hasColor && getSvg(cfg.folder, `${cfg.folder}-color`)) ||
    getSvg(cfg.folder, cfg.folder)

  // 📖 Pick the text wordmark (currentColor-based, theme-adaptive).
  const textSvg = cfg.hasText ? getSvg(cfg.folder, `${cfg.folder}-text`) : null

  // ─── Layouts ─────────────────────────────────────────────────────────────
  // 📖 Single horizontal row: [icon | gap | wordmark], all in --pl-max-h tall.
  // 📖 `overflow: hidden` on the row is a safety net for the rare case where
  // 📖 a particularly wide wordmark (e.g. cloudflare ~145px) still overflows
  // 📖 the column even at 12px height — better clipped than warping the table.
  if (iconSvg && textSvg) {
    return (
      <span className={styles.row} title={origin}>
        <span
          className={styles.icon}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
        <span
          className={styles.textLogo}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: textSvg }}
        />
      </span>
    )
  }

  // 📖 Legacy providers (Scaleway, OVH by default): graphic only, no wordmark SVG.
  // 📖 Show the graphic + a caption as plain text so the cell stays scannable
  // 📖 in the table. `cfg.caption` overrides the origin name (Codestral wants
  // 📖 its own label, not whatever sources.js returns). `cfg.noCaption` skips
  // 📖 the caption entirely (OVH's graphic is itself a full wordmark, and
  // 📖 Scaleway's wordmark already contains the brand name).
  // 📖 `cfg.iconClass` (when set) is appended to the icon span — used to attach
  // 📖 a global class for per-theme color overrides (e.g. Scaleway's lighter
  // 📖 purple in dark mode).
  if (iconSvg) {
    const captionText = cfg.caption ?? origin
    if (cfg.noCaption) {
      const wordmarkClass = cfg.iconClass
        ? `${styles.iconLegacyWordmark} ${cfg.iconClass}`
        : styles.iconLegacyWordmark
      return (
        <span className={styles.row} title={origin}>
          <span
            className={wordmarkClass}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: iconSvg }}
          />
        </span>
      )
    }
    return (
      <span className={styles.row} title={origin}>
        <span
          className={styles.icon}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
        <span className={styles.fallback}>{captionText}</span>
      </span>
    )
  }

  // 📖 Icon-only fallback (shouldn't happen with current assets, but safe).
  if (textSvg) {
    return (
      <span className={styles.row} title={origin}>
        <span
          className={styles.textLogo}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: textSvg }}
        />
      </span>
    )
  }

  // 📖 No assets at all (e.g. codestral without icon). Plain text fallback.
  return <span className={styles.fallback}>{origin}</span>
}
