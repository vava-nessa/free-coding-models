/**
 * @file src/components/ProviderLogo.tsx
 * @description Inline [icon + wordmark] provider cell, mirroring the look of
 *   the web dashboard at `web/src/components/atoms/ProviderLogo.jsx`.
 *
 *   The SVG assets were copied from `web/assets/providers/` (Lobe Icons
 *   inventory) into `website/public/providers/`. Two flavours ship:
 *
 *   - **Colored icons** (e.g. `nvidia-color.svg`) — hardcoded brand colors,
 *     rendered as `<img>` so the brand palette stays intact.
 *   - **Mono icons + text wordmarks** (e.g. `groq-text.svg`) — ship with
 *     hardcoded black fill. Rendered as `<img>` too, with a CSS
 *     `filter: invert(1)` in dark mode so they read as light text on the
 *     dark background.
 *
 *   📖 Why `<img>` everywhere instead of inlining the SVG? Inline SVGs
 *      carry their own `width`/`height` attributes which can clash with
 *      the cell's flex sizing. `<img>` plays nicely with `max-height`,
 *      `object-fit: contain`, and CSS variables — keeps the layout
 *      predictable for all providers regardless of asset aspect ratio.
 *
 *   Providers without a wordmark SVG (Scaleway, OVH) are marked `legacy:
 *   true` in the config and render only a colored brand monogram in the
 *   brand color so the cell stays scannable.
 *
 *   @exports ProviderLogo
 */

export type ProviderLogoProps = {
  providerKey: string
  providerName: string
  /** Render the colored variant of the icon when available. Defaults to true. */
  colored?: boolean
  /** Whether to show the text wordmark next to the icon. Defaults to true. */
  showWordmark?: boolean
  /** Icon size in px. Defaults to 18. */
  size?: number
  className?: string
}

type ProviderConfig = {
  folder: string
  /** Stem for the colored graphic icon (e.g. `nvidia-color`). */
  colorFile?: string
  /** Stem for the mono icon (e.g. `nvidia`). */
  monoFile: string
  /** Stem for the text wordmark (e.g. `nvidia-text`). */
  textFile?: string
  /** Brand fallback color for the monogram when no SVG is shipped. */
  brandColor: string
  /** When true, the icon is itself a horizontal wordmark — no separate text logo. */
  legacy?: boolean
  /** Override the display caption (e.g. "Codestral" reuses Mistral's icon). */
  caption?: string
}

const PROVIDERS: Record<string, ProviderConfig> = {
  nvidia:           { folder: 'nvidia',       colorFile: 'nvidia-color',     monoFile: 'nvidia',     textFile: 'nvidia-text',     brandColor: '#76b900' },
  groq:             { folder: 'groq',         monoFile: 'groq',              textFile: 'groq-text',              brandColor: '#f55036' },
  cerebras:         { folder: 'cerebras',     colorFile: 'cerebras-color',   monoFile: 'cerebras',   textFile: 'cerebras-text',   brandColor: '#ff5c1c' },
  googleai:         { folder: 'gemini',       colorFile: 'gemini-color',     monoFile: 'gemini',     textFile: 'gemini-text',     brandColor: '#4285f4' },
  'github-models':  { folder: 'github',       monoFile: 'github',            textFile: 'github-text',            brandColor: '#ffffff' },
  mistral:          { folder: 'mistral',      colorFile: 'mistral-color',    monoFile: 'mistral',    textFile: 'mistral-text',    brandColor: '#ff7000' },
  cloudflare:       { folder: 'cloudflare',   colorFile: 'cloudflare-color', monoFile: 'cloudflare', textFile: 'cloudflare-text', brandColor: '#f38020' },
  openrouter:       { folder: 'openrouter',   monoFile: 'openrouter',        textFile: 'openrouter-text',        brandColor: '#6366f1' },
  sambanova:        { folder: 'sambanova',    colorFile: 'sambanova-color',  monoFile: 'sambanova',  textFile: 'sambanova-text',  brandColor: '#ff6e00' },
  ovhcloud:         { folder: 'ovhcloud',     monoFile: 'ovhcloud',                                                       brandColor: '#123fbb', legacy: true },
  codestral:        { folder: 'mistral',      colorFile: 'mistral-color',    monoFile: 'mistral',                                               brandColor: '#ff7000', caption: 'Codestral' },
  zai:              { folder: 'zai',          monoFile: 'zai',               textFile: 'zai-text',               brandColor: '#0066ff' },
  scaleway:         { folder: 'scalewaylogo', monoFile: 'ScalewayLogo',                                                  brandColor: '#a78bfa', legacy: true },
  qwen:             { folder: 'qwen',         colorFile: 'qwen-color',       monoFile: 'qwen',       textFile: 'qwen-text',       brandColor: '#615ced' },
  'opencode-zen':   { folder: 'opencode',     monoFile: 'opencode',          textFile: 'opencode-text',          brandColor: '#8b5cf6' },
  kilo:             { folder: 'github',       monoFile: 'github',            textFile: 'github-text',            brandColor: '#78ffbe' },
  llm7:             { folder: 'github',       monoFile: 'github',            textFile: 'github-text',            brandColor: '#b4ff8c' },
  routeway:         { folder: 'openrouter',   monoFile: 'openrouter',        textFile: 'openrouter-text',        brandColor: '#82d2ff' },
  novita:           { folder: 'openrouter',   monoFile: 'openrouter',        textFile: 'openrouter-text',        brandColor: '#ffb978' },
  'ollama-cloud':   { folder: 'github',       monoFile: 'github',            textFile: 'github-text',            brandColor: '#e6e6e6' },
}

const FALLBACK: ProviderConfig = { folder: 'github', monoFile: 'github', brandColor: '#8fa08f' }

function getConfig(providerKey: string): ProviderConfig {
  return PROVIDERS[providerKey] ?? FALLBACK
}

function iconSrc(cfg: ProviderConfig, colored: boolean): { src: string; isColored: boolean } {
  if (colored && cfg.colorFile) {
    return { src: `/providers/${cfg.folder}/${cfg.colorFile}.svg`, isColored: true }
  }
  return { src: `/providers/${cfg.folder}/${cfg.monoFile}.svg`, isColored: false }
}

function textSrc(cfg: ProviderConfig): string | null {
  return cfg.textFile ? `/providers/${cfg.folder}/${cfg.textFile}.svg` : null
}

function Monogram({ name, color, size }: { name: string; color: string; size: number }) {
  const initials = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '??'
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded font-mono font-bold text-black"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function ProviderLogo({
  providerKey,
  providerName,
  colored = true,
  showWordmark = true,
  size = 18,
  className = '',
}: ProviderLogoProps) {
  const cfg = getConfig(providerKey)
  const icon = iconSrc(cfg, colored)
  // 📖 Reused placeholder assets must not identify Kilo, Ollama or other gateways as GitHub.
  const placeholder = (cfg.folder === 'github' && providerKey !== 'github-models')
    || (cfg.folder === 'openrouter' && providerKey !== 'openrouter')
  const txt = showWordmark && !placeholder ? textSrc(cfg) : null
  const caption = cfg.caption ?? providerName
  const textHeight = Math.max(10, Math.round(size * 0.7))

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 overflow-hidden leading-none ${className}`}
      title={caption}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        {placeholder ? <Monogram name={providerName} color={cfg.brandColor} size={size} /> : <img
          src={icon.src}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="block object-contain"
          style={{
            width: size,
            height: size,
            // 📖 Colored variants keep their brand colors. Mono variants ship
            //    in black and need to flip in dark mode so the wordmark reads
            //    as light text on the dark background.
            filter: icon.isColored ? 'none' : 'invert(1) hue-rotate(180deg)',
          }}
        />}
      </span>
      {showWordmark && (
        cfg.legacy ? null
        : txt ? (
          <img
            src={txt}
            alt={caption}
            width={120}
            height={textHeight}
            loading="lazy"
            decoding="async"
            className="block object-contain"
            style={{
              maxWidth: 120,
              height: textHeight,
              // Same dark-mode flip as the mono icon.
              filter: 'invert(1) hue-rotate(180deg)',
            }}
          />
        ) : (
          <span
            className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted"
            style={{ maxWidth: 120 }}
          >
            {caption}
          </span>
        )
      )}
      {cfg.legacy && showWordmark && (
        <span
          className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted"
          style={{ maxWidth: 120 }}
        >
          {caption}
        </span>
      )}
    </span>
  )
}
