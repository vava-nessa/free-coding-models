#!/usr/bin/env node
/**
 * @file scripts/build-favicons.mjs
 * @description Generate the full favicon asset set for the /web dashboard
 *              from the project root `/icon.png` (1254×1254 PNG).
 *
 * @details
 *   📖 Single source of truth: the top-level `icon.png` in this repo.
 *   This script rasterizes it into every favicon surface modern and legacy
 *   browsers expect:
 *
 *     - favicon.ico                  (multi-size: 16, 32, 48)
 *     - favicon-16x16.png            (browser tabs)
 *     - favicon-32x32.png            (browser tabs HiDPI / Windows taskbar)
 *     - favicon-48x48.png            (Windows site icon)
 *     - favicon-96x96.png            (Android shortcut / Chrome)
 *     - favicon-192x192.png          (Android home screen, PWA)
 *     - favicon-512x512.png          (PWA splash, share preview)
 *     - apple-touch-icon.png         (iOS home screen, 180×180)
 *     - mstile-70x70.png             (Windows small tile)
 *     - mstile-150x150.png           (Windows medium tile)
 *     - mstile-310x310.png           (Windows large tile)
 *     - mstile-512x512.png           (Windows extra-large tile)
 *     - site.webmanifest             (PWA manifest)
 *     - browserconfig.xml            (Microsoft tile schema)
 *
 *   Output goes to `web/public/favicons/` so Vite copies it verbatim to
 *   `web/dist/favicons/` on `vite build`. We also drop a top-level
 *   `web/public/favicon.ico` for legacy browsers that probe `/favicon.ico`.
 *
 *   Zero npm dependencies — uses ImageMagick through `magick` (v7) or
 *   `convert` (v6). GitHub's Ubuntu package currently exposes `convert`, so
 *   supporting both keeps local builds, release CI, and Docker builds aligned.
 *
 * @functions
 *   → main() — entry point, runs the full pipeline
 *
 * @see web/index.html          — consumes the generated assets
 * @see web/server.js           — serves /favicons/* and /favicon.ico in production
 * @see web/vite.config.js      — Vite auto-copies web/public/ to web/dist/
 */

import { execFile } from 'node:child_process'
import { mkdir, writeFile, access, constants } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SOURCE_PNG = resolve(ROOT, 'icon.png')
const OUT_DIR = resolve(ROOT, 'web/public/favicons')
const LEGACY_ICO = resolve(ROOT, 'web/public/favicon.ico')

// 📖 All sizes that ship. The order matters: ico first (multi-image), then
// 📖 individual PNGs, then Microsoft tiles, then manifest/xml.
const SIZES = [16, 32, 48, 96, 192, 512]
const ICO_SIZES = [16, 32, 48]
const APPLE_SIZES = [{ name: 'apple-touch-icon.png', size: 180 }]
const MSTILE_SIZES = [70, 150, 310, 512]

// 📖 PWA manifest. Name, short_name, and theme_color mirror the dashboard
// 📖 dark/light palette so the splash background blends with the launcher.
const MANIFEST = {
  name: 'free-coding-models — Live Dashboard',
  short_name: 'FCM',
  description: 'Find the fastest free coding LLM model in seconds.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#0a0a0a',
  theme_color: '#0a0a0a',
  icons: [
    { src: '/favicons/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/favicons/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}

// 📖 Microsoft tile schema. References the mstile-* PNGs we generate.
const BROWSERCONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="/favicons/mstile-70x70.png"/>
      <square150x150logo src="/favicons/mstile-150x150.png"/>
      <wide310x150logo src="/favicons/mstile-310x150.png"/>
      <square310x310logo src="/favicons/mstile-310x310.png"/>
      <TileColor>#0a0a0a</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`

let imageMagickCommand = null

async function ensureImageMagick() {
  const candidates = ['magick', 'convert']
  const errors = []

  for (const bin of candidates) {
    try {
      const { stdout } = await execFileP(bin, ['-version'], { timeout: 5_000 })
      imageMagickCommand = bin
      return `${stdout.split('\n')[0]?.trim() || 'ImageMagick'} (${bin})`
    } catch (err) {
      errors.push(`${bin}: ${err.code || err.message}`)
    }
  }

  throw new Error(
    'ImageMagick binary not found in PATH (`magick` or `convert`).\n' +
    'Install it: macOS → `brew install imagemagick`, Linux → `apt install imagemagick`.\n' +
    `Checked: ${errors.join(', ')}`,
  )
}

function getImageMagickCommand() {
  if (!imageMagickCommand) throw new Error('ImageMagick was not initialized before conversion')
  return imageMagickCommand
}

async function runImageMagick(args) {
  await execFileP(getImageMagickCommand(), args)
}

async function assertSource() {
  try {
    await access(SOURCE_PNG, constants.R_OK)
  } catch {
    throw new Error(`Source icon not found or unreadable: ${SOURCE_PNG}`)
  }
}

async function magickConvert({ src, dst, size }) {
  // 📖 `-background none` keeps transparency if the source ever has it.
  // 📖 `-strip` removes metadata to keep file size minimal.
  // 📖 `-quality 95` for PNG ≈ visually lossless.
  await runImageMagick([
    src,
    '-background', 'none',
    '-resize', `${size}x${size}`,
    '-gravity', 'center',
    '-extent', `${size}x${size}`,
    '-strip',
    '-quality', '95',
    dst,
  ])
}

async function magickIco({ src, dst, sizes }) {
  // 📖 Build a multi-image .ico by writing one argument per size; ImageMagick
  // 📖 encodes all of them into a single ICO container in one pass.
  const args = []
  for (const size of sizes) {
    const tmp = dst.replace(/\.ico$/, `.ico-${size}.png`)
    await magickConvert({ src, dst: tmp, size })
    args.push(tmp)
  }
  await runImageMagick([...args, dst])
  for (const size of sizes) {
    const tmp = dst.replace(/\.ico$/, `.ico-${size}.png`)
    await execFileP('rm', [tmp])
  }
}

async function main() {
  console.log('\n  🖼  build-favicons — generating web favicon set\n')

  const version = await ensureImageMagick()
  console.log(`     • ImageMagick: ${version}`)
  console.log(`     • source:      ${SOURCE_PNG}`)
  console.log(`     • out:         ${OUT_DIR}`)

  await assertSource()
  await mkdir(OUT_DIR, { recursive: true })

  // 1) Plain PNGs (favicon-NxN.png)
  for (const size of SIZES) {
    const dst = join(OUT_DIR, `favicon-${size}x${size}.png`)
    await magickConvert({ src: SOURCE_PNG, dst, size })
    console.log(`     ✓ favicon-${size}x${size}.png`)
  }

  // 2) Apple touch icon (180×180) — flat color, no transparency per Apple HIG
  for (const { name, size } of APPLE_SIZES) {
    const dst = join(OUT_DIR, name)
    await magickConvert({ src: SOURCE_PNG, dst, size })
    console.log(`     ✓ ${name}`)
  }

  // 3) Microsoft mstile — square tiles
  for (const size of MSTILE_SIZES) {
    const dst = join(OUT_DIR, `mstile-${size}x${size}.png`)
    await magickConvert({ src: SOURCE_PNG, dst, size })
    console.log(`     ✓ mstile-${size}x${size}.png`)
  }

  // 📖 Windows 8/10/11 "wide" tile is 310×150 — we generate it explicitly
  // 📖 (not in the square list) so the browserconfig schema resolves it.
  const wideDst = join(OUT_DIR, 'mstile-310x150.png')
  await runImageMagick([
    SOURCE_PNG,
    '-background', 'none',
    '-resize', '310x150',
    '-gravity', 'center',
    '-extent', '310x150',
    '-strip',
    '-quality', '95',
    wideDst,
  ])
  console.log('     ✓ mstile-310x150.png')

  // 4) Multi-image .ico (16, 32, 48) — both for /favicons/ and the legacy
  //    /favicon.ico root path.
  const icoInFavicons = join(OUT_DIR, 'favicon.ico')
  await magickIco({ src: SOURCE_PNG, dst: icoInFavicons, sizes: ICO_SIZES })
  console.log('     ✓ favicon.ico (16, 32, 48)')

  await magickIco({ src: SOURCE_PNG, dst: LEGACY_ICO, sizes: ICO_SIZES })
  console.log(`     ✓ ${LEGACY_ICO.replace(ROOT + '/', '')} (legacy /favicon.ico)`)

  // 5) PWA manifest
  await writeFile(join(OUT_DIR, 'site.webmanifest'), JSON.stringify(MANIFEST, null, 2) + '\n', 'utf8')
  console.log('     ✓ site.webmanifest')

  // 6) Microsoft browser config
  await writeFile(join(OUT_DIR, 'browserconfig.xml'), BROWSERCONFIG_XML, 'utf8')
  console.log('     ✓ browserconfig.xml')

  console.log('\n  ✅ favicon set generated\n')
}

main().catch((err) => {
  console.error(`\n  ❌ build-favicons failed: ${err.message}\n`)
  process.exit(1)
})
