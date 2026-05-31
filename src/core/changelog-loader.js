/**
 * @file changelog-loader.js
 * @description Load and parse per-version changelog files from the changelog/ directory
 *
 * Each version has its own file: changelog/vX.Y.Z.md
 * The file starts with `# Changelog vX.Y.Z - YYYY-MM-DD` followed by
 * `### Added`, `### Fixed`, `### Changed` sections with bullet points.
 *
 * @functions
 *   → loadChangelog() — Read and parse all changelog files into structured format
 *   → getLatestChanges(version) — Return changelog for a specific version
 *   → formatChangelogForDisplay(version) — Format for TUI rendering
 *
 * @exports loadChangelog, getLatestChanges, formatChangelogForDisplay
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CHANGELOG_DIR = join(__dirname, '..', 'changelog')

/**
 * 📖 loadChangelog: Read and parse all per-version changelog files
 * @returns {Object} { versions: { '0.2.11': { added: [], fixed: [], changed: [] }, ... } }
 */
export function loadChangelog() {
  if (!existsSync(CHANGELOG_DIR)) return { versions: {} }

  const versions = {}
  const files = readdirSync(CHANGELOG_DIR).filter(f => f.endsWith('.md'))

  for (const file of files) {
    const filePath = join(CHANGELOG_DIR, file)
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    let currentSection = null
    let currentItems = []

    // 📖 Extract version from filename (e.g. v0.3.67.md → 0.3.67)
    const verMatch = file.match(/^v([\d.]+)\.md$/)
    if (!verMatch) continue
    const currentVersion = verMatch[1]

    for (const line of lines) {
      // 📖 Match section headers: ### Added, ### Fixed, ### Changed
      const sectionMatch = line.match(/^### (Added|Fixed|Changed|Updated)/)
      if (sectionMatch) {
        if (currentSection && currentItems.length > 0) {
          if (!versions[currentVersion]) versions[currentVersion] = {}
          versions[currentVersion][currentSection] = currentItems
        }
        currentSection = sectionMatch[1].toLowerCase()
        currentItems = []
        continue
      }

      // 📖 Match bullet points: - **text**: description
      if (line.match(/^- /) && currentSection) {
        currentItems.push(line.replace(/^- /, ''))
      }
    }

    // 📖 Save the last section
    if (currentSection && currentItems.length > 0) {
      if (!versions[currentVersion]) versions[currentVersion] = {}
      versions[currentVersion][currentSection] = currentItems
    }
  }

  return { versions }
}

/**
 * 📖 getLatestChanges: Return changelog for a specific version
 * @param {string} version (e.g. '0.2.11')
 * @returns {Object|null}
 */
export function getLatestChanges(version) {
  const { versions } = loadChangelog()
  return versions[version] || null
}

/**
 * 📖 formatChangelogForDisplay: Format changelog section as array of strings for TUI
 * @param {string} version
 * @returns {string[]} formatted lines
 */
export function formatChangelogForDisplay(version) {
  const changes = getLatestChanges(version)
  if (!changes) return []

  const lines = [
    `📋 Changelog for v${version}`,
    '',
  ]

  const sections = { added: 'Added', fixed: 'Fixed', changed: 'Changed', updated: 'Updated' }
  for (const [key, label] of Object.entries(sections)) {
    if (changes[key] && changes[key].length > 0) {
      lines.push(`✨ ${label}:`)
      for (const item of changes[key]) {
        // 📖 Wrap long lines for display
        const maxWidth = 70
        let item_text = item.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
        if (item_text.length > maxWidth) {
          item_text = item_text.substring(0, maxWidth - 3) + '...'
        }
        lines.push(`  • ${item_text}`)
      }
      lines.push('')
    }
  }

  return lines
}
