/**
 * @file security.js
 * @description Security checks and auto-fix for config file permissions.
 *
 * 📖 Problem: API keys stored in ~/.free-coding-models.json must be protected.
 *    If the file has incorrect permissions (e.g., 644 = world-readable), keys can leak.
 *
 * 📖 This module:
 *    - Checks config file permissions on startup
 *    - Warns user if permissions are too open
 *    - Offers auto-fix option with user confirmation (interactive TTY only)
 *    - Fixes permissions securely (chmod 600 = user read/write only)
 *
 * 📖 Issue #173: this check used to run un-awaited inside runApp, so the TUI
 *    entered raw mode / the alternate screen while the prompt was still pending.
 *    On Windows the warning + prompt were invisible and the app looked frozen.
 *    Now checkConfigSecurity() is async, awaited by the bin entry BEFORE the TUI
 *    starts, and it never prompts on non-TTY stdin or daemon/web/JSON surfaces.
 *
 * 📖 Secure permissions:
 *    - 0o600 (octal 600) = user:rw, group:---, world:---
 *    - Only the file owner can read or write
 *    - This is the standard for files containing secrets (SSH keys, API keys, etc.)
 *
 * 📖 Windows note: Node's chmod on win32 is best-effort (it can only toggle the
 *    read-only attribute, NTFS ACLs still govern real access). We still try,
 *    and the manual hint points at icacls for a real fix.
 *
 * @functions
 *   → checkConfigSecurity() - Async main security check; awaited before the TUI starts
 *   → resolveSecurityAction() - Pure gate deciding auto-fix / prompt / warn-only (in utils.js)
 *   → getConfigPermissions() - Returns file mode object for config
 *   → isConfigSecure() - Boolean check if permissions are correct
 *   → fixConfigPermissions() - Applies chmod 600 to config file (best-effort on Windows)
 *   → promptSecurityFix() - Interactive prompt asking user to fix permissions
 *
 * @exports checkConfigSecurity, isConfigSecure, fixConfigPermissions, formatMode, formatModeRwx
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import { CONFIG_PATH } from './config.js'
import { resolveSecurityAction } from './utils.js'

// 📖 Config file path - matches the path used in config.js (honours the
// 📖 --config-dir / FCM_CONFIG_DIR override when set).
function getConfigPath() {
  return CONFIG_PATH
}

// 📖 Secure file permissions: user read/write only (0o600 = 384 in decimal)
// 📖 This means: owner can read+write, group and others have no permissions
const SECURE_MODE = 0o600

// 📖 True on Windows, where chmod is best-effort (read-only bit only) and the
// 📖 manual fix hint should point at icacls instead of chmod.
const IS_WINDOWS = process.platform === 'win32'

// 📖 Get file stats including permissions for the config file
// 📖 Returns null if file doesn't exist
function getConfigPermissions() {
  const configPath = getConfigPath()

  try {
    if (!fs.existsSync(configPath)) {
      return null
    }

    const stats = fs.statSync(configPath)
    return {
      mode: stats.mode,
      isSecure: (stats.mode & 0o777) === SECURE_MODE,
      path: configPath
    }
  } catch (err) {
    return null
  }
}

// 📖 Check if config file has secure permissions
// 📖 Returns true if file doesn't exist (nothing to secure) or if permissions are correct
export function isConfigSecure() {
  const perms = getConfigPermissions()

  // 📖 No file = nothing to secure
  if (!perms) return true

  return perms.isSecure
}

// 📖 Fix config file permissions to secure mode (chmod 600)
// 📖 Best-effort on Windows (read-only bit); returns true if successful, false otherwise
export function fixConfigPermissions() {
  const configPath = getConfigPath()

  try {
    if (!fs.existsSync(configPath)) {
      return false
    }

    fs.chmodSync(configPath, SECURE_MODE)
    return true
  } catch (err) {
    return false
  }
}

// 📖 Format permission mode in octal (e.g., 0o644 → "644")
// 📖 Exported for unit tests
export function formatMode(mode) {
  return (mode & 0o777).toString(8).padStart(3, '0')
}

// 📖 Format permission mode in human-readable rwx format (e.g., 0o644 → "rw-r--r--")
// 📖 Walks bits 8..0 in groups of three: owner rwx, group rwx, others rwx.
// 📖 Bit 8 = owner read, bit 7 = owner write, bit 6 = owner exec, and so on.
// 📖 Exported for unit tests
export function formatModeRwx(mode) {
  const types = ['r', 'w', 'x']
  const perms = []

  for (let i = 8; i >= 0; i--) {
    perms.push(mode & (1 << i) ? types[(8 - i) % 3] : '-')
  }

  return [
    perms.slice(0, 3).join(''),  // Owner permissions
    perms.slice(3, 6).join(''),  // Group permissions
    perms.slice(6, 9).join('')   // Others permissions
  ].join(' / ')
}

// 📖 Print the insecure-permissions warning (stderr, so --json stdout stays clean)
function printSecurityWarning(perms) {
  const currentMode = formatMode(perms.mode)
  const currentRwx = formatModeRwx(perms.mode)

  console.error('')
  console.error('⚠️  SECURITY WARNING ⚠️')
  console.error('')
  console.error(`Your config file has insecure permissions: ${currentMode} (${currentRwx})`)
  console.error(`File: ${perms.path}`)
  console.error('')
  console.error('This means other users on this system may be able to read your API keys.')
  console.error('')
  console.error('Recommended: Fix permissions to 600 (rw-------) - owner read/write only')
}

// 📖 Print the manual fix hint. On Windows, point at icacls since Node's chmod
// 📖 only toggles the read-only attribute there.
function printManualFixHint() {
  console.error('')
  if (IS_WINDOWS) {
    console.error('To fix manually (PowerShell), run:')
    console.error(`  icacls "${getConfigPath()}" /inheritance:r /grant:r "$env:USERNAME:R,W"`)
  } else {
    console.error('To fix manually, run:')
    console.error(`  chmod 600 ${getConfigPath()}`)
  }
  console.error('')
}

// 📖 Apply the fix and report the outcome. Shared by the prompt path (user said
// 📖 yes) and the auto-fix path (--fix-permissions / --yes / -y).
function applyFixAndReport() {
  const success = fixConfigPermissions()

  if (success) {
    console.error('')
    console.error('✅ Permissions fixed! Your API keys are now secure.')
    console.error('')
    if (IS_WINDOWS) {
      console.error('Note: on Windows this is best-effort (read-only bit). See docs for NTFS ACLs.')
      console.error('')
    }
    return { wasSecure: false, wasFixed: true }
  }

  console.error('')
  console.error('❌ Failed to fix permissions automatically.')
  printManualFixHint()
  return { wasSecure: false, wasFixed: false, error: 'chmod_failed' }
}

// 📖 Check security and handle the fix flow if needed
// 📖 Await this BEFORE starting any terminal UI (issue #173) so the warning and
// 📖 the confirmation prompt are visible and fully resolved before raw mode /
// 📖 the alternate screen take over.
//
// 📖 Options:
//   autoFix       - true when --fix-permissions / --yes / -y was passed: apply the
//                   fix without asking
//   promptAllowed - false on daemon/web/JSON surfaces: never prompt there, at most
//                   warn on stderr
//   stdinIsTTY    - override the stdin TTY detection (tests); defaults to real detection
//
// 📖 Returns: { wasSecure: boolean, wasFixed: boolean, error?: string }
export async function checkConfigSecurity(options = {}) {
  const perms = getConfigPermissions()

  // 📖 No file yet = nothing to check
  if (!perms) {
    return { wasSecure: true, wasFixed: false }
  }

  // 📖 Permissions are already secure
  if (perms.isSecure) {
    return { wasSecure: true, wasFixed: false }
  }

  // 📖 Pure gate (see utils.js): decides auto-fix vs prompt vs warn-only.
  const action = resolveSecurityAction({
    configExists: true,
    isSecure: false,
    autoFixRequested: options.autoFix === true,
    stdinIsTTY: options.stdinIsTTY ?? (process.stdin?.isTTY === true),
    promptAllowed: options.promptAllowed !== false,
  })

  if (action === 'none') {
    return { wasSecure: true, wasFixed: false }
  }

  // 📖 Security issue detected! Print the warning first so it is on screen
  // 📖 no matter which path follows.
  printSecurityWarning(perms)

  if (action === 'auto-fix') {
    return applyFixAndReport()
  }

  if (action === 'warn-only') {
    console.error('Running non-interactively (piped stdin or daemon/web mode), so skipping the prompt.')
    printManualFixHint()
    return { wasSecure: false, wasFixed: false, error: 'non_interactive' }
  }

  return promptSecurityFix()
}

// 📖 Interactive prompt asking user if they want to auto-fix
// 📖 Only reached on a real interactive TTY (gated in checkConfigSecurity)
// 📖 Returns: { wasSecure: boolean, wasFixed: boolean, error?: string }
async function promptSecurityFix() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  try {
    const rawAnswer = await new Promise((resolve) => {
      rl.question('Fix permissions automatically? (Y/n): ', resolve)
    })

    rl.close()

    // 📖 Normalise: readline can resolve with undefined when stdin closes mid-prompt
    const answer = String(rawAnswer ?? '').trim().toLowerCase()

    // 📖 Default to yes if user just presses Enter
    if (answer === 'y' || answer === '') {
      return applyFixAndReport()
    } else {
      console.error('')
      console.error('⚠️  Permissions not fixed. Your API keys may be at risk.')
      printManualFixHint()
      return { wasSecure: false, wasFixed: false, error: 'user_declined' }
    }
  } catch (err) {
    rl.close()
    // 📖 If we can't prompt (e.g., non-interactive TTY), just warn and continue
    console.error('')
    console.error('⚠️  Unable to prompt for permission fix (non-interactive terminal?)')
    printManualFixHint()
    return { wasSecure: false, wasFixed: false, error: 'no_tty' }
  }
}
