/**
 * @file updater.js
 * @description Update detection and installation helpers, extracted from bin/free-coding-models.js.
 *
 * @details
 *   This module handles all npm version-check and auto-update logic:
 *
 *   - `checkForUpdateDetailed()` — hits the npm registry to compare the published version
 *     against the locally installed one.  Returns `{ latestVersion, error }` so callers
 *     can surface meaningful status text in the Settings overlay.
 *
 *   - `checkForUpdate()` — thin backward-compatible wrapper used at startup for the
 *     auto-update guard.  Returns `latestVersion` (string) or `null`.
 *
 *   - `runUpdate(latestVersion)` — detects the active package manager (npm/bun/pnpm/yarn),
 *     runs the correct global install command, retrying with `sudo` on EACCES/EPERM.
 *     On success, relaunches the process with the same argv.  On failure, prints manual
 *     instructions (using the correct PM command) and exits with code 1.
 *
 *   ⚙️ Notes:
 *   - `LOCAL_VERSION` is resolved from package.json via `createRequire` so this module
 *     can be imported independently from the bin entry point.
 *   - The auto-update flow in `main()` skips update if `isDevMode` is detected (presence of
 *     a `.git` directory next to the package root) to avoid an infinite update loop in dev.
 *   - `detectPackageManager()` checks the install path, script path, and runtime binary
 *     to determine which package manager (npm/bun/pnpm/yarn) owns the installation.
 *     All install commands, permission probes, and error messages use the detected PM.
 *
 * @functions
 *   → detectPackageManager()             — Detect which PM owns the current installation
 *   → getInstallArgs(pm, version)        — Build correct { bin, args } per package manager
 *   → getManualInstallCmd(pm, version)   — Human-readable install command string for error messages
 *   → checkForUpdateDetailed()           — Fetch npm latest with explicit error info
 *   → checkForUpdate()                   — Startup wrapper, returns version string or null
 *   → runUpdate(latestVersion)           — Install new version via detected PM + relaunch
 * @exports
 *   detectPackageManager, getInstallArgs, getManualInstallCmd,
 *   checkForUpdateDetailed, checkForUpdate, runUpdate, fetchLastReleaseDate
 *
 * @see bin/free-coding-models.js — calls checkForUpdate() at startup and runUpdate() on confirm
 */

import chalk from 'chalk'
import { createRequire } from 'module'
import { accessSync, constants } from 'fs'

const require = createRequire(import.meta.url)
const readline = require('readline')
const pkg = require('../../package.json')
const LOCAL_VERSION = pkg.version

/**
 * 📖 detectPackageManager: figure out which package manager owns the current installation.
 * 📖 Checks import.meta.url (package install path), process.argv[1] (script entry),
 * 📖 and process.execPath (runtime binary) for signatures of bun, pnpm, or yarn.
 * 📖 Falls back to 'npm' when no other signature is found.
 * @returns {'npm' | 'bun' | 'pnpm' | 'yarn'}
 */
export function detectPackageManager() {
  const sources = [import.meta.url, process.argv[1] || '', process.execPath || '']
  const combined = sources.join(' ').toLowerCase()
  if (combined.includes('.bun')) return 'bun'
  if (combined.includes('pnpm')) return 'pnpm'
  if (combined.includes('yarn')) return 'yarn'
  return 'npm'
}

/**
 * 📖 getInstallArgs: return the correct binary and argument list for a given PM.
 * 📖 Each PM has different syntax for global install — this normalises them.
 * @param {'npm' | 'bun' | 'pnpm' | 'yarn'} pm
 * @param {string} version
 * @returns {{ bin: string, args: string[] }}
 */
export function getInstallArgs(pm, version) {
  const pkg = `free-coding-models@${version}`
  switch (pm) {
    case 'bun':   return { bin: 'bun',   args: ['add', '-g', pkg] }
    case 'pnpm':  return { bin: 'pnpm',  args: ['add', '-g', pkg] }
    case 'yarn':  return { bin: 'yarn',  args: ['global', 'add', pkg] }
    default:      return { bin: 'npm',   args: ['i', '-g', pkg, '--prefer-online'] }
  }
}

/**
 * 📖 getManualInstallCmd: human-readable command string for error / fallback messages.
 * @param {'npm' | 'bun' | 'pnpm' | 'yarn'} pm
 * @param {string} version
 * @returns {string}
 */
export function getManualInstallCmd(pm, version) {
  const { bin, args } = getInstallArgs(pm, version)
  return `${bin} ${args.join(' ')}`
}

/**
 * 📖 checkForUpdateDetailed: Fetch npm latest version with explicit error details.
 * 📖 Used by settings manual-check flow to display meaningful status in the UI.
 * @returns {Promise<{ latestVersion: string|null, error: string|null }>}
 */
export async function checkForUpdateDetailed() {
  try {
    const res = await fetch('https://registry.npmjs.org/free-coding-models/latest', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { latestVersion: null, error: `HTTP ${res.status}` }
    const data = await res.json()
    if (data.version && data.version !== LOCAL_VERSION) return { latestVersion: data.version, error: null }
    return { latestVersion: null, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { latestVersion: null, error: message }
  }
}

/**
 * 📖 checkForUpdate: Backward-compatible wrapper for startup update prompt.
 * @returns {Promise<string|null>}
 */
export async function checkForUpdate() {
  const { latestVersion } = await checkForUpdateDetailed()
  return latestVersion
}

/**
 * 📖 fetchLastReleaseDate: Get the human-readable publish date of the latest npm release.
 * 📖 Used in the TUI footer to show users how fresh the package is.
 * @returns {Promise<string|null>} e.g. "Mar 27, 2026, 09:42 PM" or null on failure
 */
export async function fetchLastReleaseDate() {
  try {
    const res = await fetch('https://registry.npmjs.org/free-coding-models', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    const timeMap = data?.time
    if (!timeMap) return null
    const latestKey = data?.['dist-tags']?.latest
    if (!latestKey || !timeMap[latestKey]) return null
    const d = new Date(timeMap[latestKey])
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const hh = d.getHours()
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ampm = hh >= 12 ? 'PM' : 'AM'
    const h12 = hh % 12 || 12
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h12}:${mm} ${ampm}`
  } catch {
    return null
  }
}

/**
 * 📖 detectGlobalInstallPermission: check whether the detected PM's global install paths are writable.
 * 📖 Bun installs to ~/.bun/install/global/ (always user-writable) so sudo is never needed.
 * 📖 For npm/pnpm/yarn we probe their global root/prefix paths and check writability.
 * @param {'npm' | 'bun' | 'pnpm' | 'yarn'} pm
 * @returns {{ needsSudo: boolean, checkedPath: string|null }}
 */
function detectGlobalInstallPermission(pm) {
  if (pm === 'bun') {
    return { needsSudo: false, checkedPath: null }
  }

  const { execFileSync } = require('child_process')
  const candidates = []

  if (pm === 'pnpm') {
    try {
      const root = execFileSync('pnpm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (root) candidates.push(root)
    } catch {}
  } else if (pm === 'yarn') {
    try {
      const dir = execFileSync('yarn', ['global', 'dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (dir) candidates.push(dir)
    } catch {}
  } else {
    try {
      const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (npmRoot) candidates.push(npmRoot)
    } catch {}

    try {
      const npmPrefix = execFileSync('npm', ['prefix', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (npmPrefix) candidates.push(npmPrefix)
    } catch {}
  }

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.W_OK)
    } catch {
      return { needsSudo: true, checkedPath: candidate }
    }
  }

  return { needsSudo: false, checkedPath: candidates[0] || null }
}

/**
 * 📖 hasSudoCommand: lightweight guard so we don't suggest sudo on systems where it does not exist.
 * @returns {boolean}
 */
function hasSudoCommand() {
  const { spawnSync } = require('child_process')
  const result = spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore', shell: false })
  return result.status === 0 || result.status === 1
}

/**
 * 📖 isPermissionError: normalize npm permission failures across platforms and child-process APIs.
 * @param {unknown} err
 * @returns {boolean}
 */
function isPermissionError(err) {
  const message = err instanceof Error ? err.message : String(err || '')
  const stderr = typeof err?.stderr === 'string' ? err.stderr : ''
  const combined = `${message}\n${stderr}`.toLowerCase()
  return (
    err?.code === 'EACCES' ||
    err?.code === 'EPERM' ||
    combined.includes('eacces') ||
    combined.includes('eperm') ||
    combined.includes('permission denied') ||
    combined.includes('operation not permitted')
  )
}

/**
 * 📖 relaunchCurrentProcess: restart free-coding-models with the same user arguments.
 * 📖 Uses spawn with inherited stdio so the new process is interactive and does not require shell escaping.
 */
function relaunchCurrentProcess() {
  const { spawn } = require('child_process')
  console.log(chalk.dim('  🔄 Restarting with new version...'))
  console.log()

  const args = process.argv.slice(1)
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    detached: false,
    shell: false,
    env: process.env,
  })

  child.on('exit', (code) => process.exit(code ?? 0))
  child.on('error', () => process.exit(0))
}

/**
 * 📖 installUpdateCommand: run global install using the detected package manager, optionally prefixed with sudo.
 * @param {string} latestVersion
 * @param {boolean} useSudo
 */
function installUpdateCommand(latestVersion, useSudo) {
  const { execFileSync } = require('child_process')
  const pm = detectPackageManager()
  const { bin, args } = getInstallArgs(pm, latestVersion)

  if (useSudo) {
    execFileSync('sudo', [bin, ...args], { stdio: 'inherit', shell: false })
    return
  }

  execFileSync(bin, args, { stdio: 'inherit', shell: false })
}

/**
 * 📖 runUpdate: Run npm global install to update to latestVersion.
 * 📖 Retries with sudo on permission errors.
 * 📖 Relaunches the process on success, exits with code 1 on failure.
 * @param {string} latestVersion
 */
export function runUpdate(latestVersion) {
  console.log()
  console.log(chalk.bold.cyan('  ⬆ Updating free-coding-models to v' + latestVersion + '...'))
  console.log()

  const pm = detectPackageManager()
  const { needsSudo, checkedPath } = detectGlobalInstallPermission(pm)
  const sudoAvailable = process.platform !== 'win32' && hasSudoCommand()

  if (needsSudo && checkedPath && sudoAvailable) {
    console.log(chalk.yellow(`  ⚠ Global ${pm} path is not writable: ${checkedPath}`))
    console.log(chalk.dim('  Re-running update with sudo so you can enter your password once.'))
    console.log()
  }

  try {
    installUpdateCommand(latestVersion, needsSudo && sudoAvailable)
    console.log()
    console.log(chalk.green(`  ✅ Update complete! Version ${latestVersion} installed.`))
    console.log()
    relaunchCurrentProcess()
    return
  } catch (err) {
    const manualCmd = getManualInstallCmd(pm, latestVersion)
    console.log()
    if (isPermissionError(err) && !needsSudo && sudoAvailable) {
      console.log(chalk.yellow(`  ⚠ Permission denied during ${pm} global install. Retrying with sudo...`))
      console.log()
      try {
        installUpdateCommand(latestVersion, true)
        console.log()
        console.log(chalk.green(`  ✅ Update complete with sudo! Version ${latestVersion} installed.`))
        console.log()
        relaunchCurrentProcess()
        return
      } catch {
        console.log()
        console.log(chalk.red('  ✖ Update failed even with sudo. Try manually:'))
        console.log(chalk.dim(`    sudo ${manualCmd}`))
        console.log()
      }
    } else if (isPermissionError(err) && !sudoAvailable && process.platform !== 'win32') {
      console.log(chalk.red('  ✖ Update failed due to permissions and `sudo` is not available in PATH.'))
      console.log(chalk.dim(`    Try manually: ${manualCmd}`))
      console.log()
    } else {
      console.log(chalk.red(`  ✖ Update failed. Try manually: ${manualCmd}`))
      console.log()
    }
  }
  process.exit(1)
}


