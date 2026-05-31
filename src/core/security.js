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
 *    - Offers auto-fix option with user confirmation
 *    - Fixes permissions securely (chmod 600 = user read/write only)
 *
 * 📖 Secure permissions:
 *    - 0o600 (octal 600) = user:rw, group:---, world:---
 *    - Only the file owner can read or write
 *    - This is the standard for files containing secrets (SSH keys, API keys, etc.)
 *
 * 📖 Why this matters:
 *    - Shared systems: Other users could read your API keys
 *    - Git accidents: File could be committed with wrong permissions
 *    - Backup tools: Might copy files with permissions intact
 *
 * @functions
 *   → checkConfigSecurity() — Main security check, prompts for auto-fix if needed
 *   → getConfigPermissions() — Returns file mode object for config
 *   → isConfigSecure() — Boolean check if permissions are correct
 *   → fixConfigPermissions() — Applies chmod 600 to config file
 *   → promptSecurityFix() — Interactive prompt asking user to fix permissions
 *
 * @exports checkConfigSecurity, isConfigSecure, fixConfigPermissions
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

// 📖 Config file path — matches the path used in config.js
function getConfigPath() {
  return path.join(os.homedir(), '.free-coding-models.json')
}

// 📖 Secure file permissions: user read/write only (0o600 = 384 in decimal)
// 📖 This means: owner can read+write, group and others have no permissions
const SECURE_MODE = 0o600

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
// 📖 Returns true if successful, false otherwise
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
function formatMode(mode) {
  return (mode & 0o777).toString(8).padStart(3, '0')
}

// 📖 Format permission mode in human-readable rwx format (e.g., 0o644 → "rw-r--r--")
function formatModeRwx(mode) {
  const perms = []
  const types = ['r', 'w', 'x']

  for (let i = 6; i >= 0; i -= 3) {
    for (let j = 0; j < 3; j++) {
      if (mode & (1 << (i + j))) {
        perms.push(types[j])
      } else {
        perms.push('-')
      }
    }
  }

  return [
    perms.slice(0, 3).join(''),  // Owner permissions
    perms.slice(3, 6).join(''),  // Group permissions
    perms.slice(6, 9).join('')   // Others permissions
  ].join(' / ')
}

// 📖 Check security and prompt for auto-fix if needed
// 📖 Call this on startup before loading config
// 📖 Returns: { wasSecure: boolean, wasFixed: boolean, error?: string }
export function checkConfigSecurity() {
  const perms = getConfigPermissions()

  // 📖 No file yet = nothing to check
  if (!perms) {
    return { wasSecure: true, wasFixed: false }
  }

  // 📖 Permissions are already secure
  if (perms.isSecure) {
    return { wasSecure: true, wasFixed: false }
  }

  // 📖 Security issue detected! Show warning and offer fix.
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
  console.error('Recommended: Fix permissions to 600 (rw-------) — owner read/write only')

  return promptSecurityFix()
}

// 📖 Interactive prompt asking user if they want to auto-fix
// 📖 Returns: { wasSecure: boolean, wasFixed: boolean, error?: string }
async function promptSecurityFix() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  try {
    const answer = await new Promise((resolve) => {
      rl.question('Fix permissions automatically? (Y/n): ', resolve)
    })

    rl.close()

    // 📖 Default to yes if user just presses Enter
    if (answer.toLowerCase() === 'y' || answer === '') {
      const success = fixConfigPermissions()

      if (success) {
        console.error('')
        console.error('✅ Permissions fixed! Your API keys are now secure.')
        console.error('')
        return { wasSecure: false, wasFixed: true }
      } else {
        console.error('')
        console.error('❌ Failed to fix permissions automatically.')
        console.error('')
        console.error('Run this command manually:')
        console.error(`  chmod 600 ${getConfigPath()}`)
        console.error('')
        return { wasSecure: false, wasFixed: false, error: 'chmod_failed' }
      }
    } else {
      console.error('')
      console.error('⚠️  Permissions not fixed. Your API keys may be at risk.')
      console.error('')
      console.error('To fix later, run:')
      console.error(`  chmod 600 ${getConfigPath()}`)
      console.error('')
      return { wasSecure: false, wasFixed: false, error: 'user_declined' }
    }
  } catch (err) {
    rl.close()
    // 📖 If we can't prompt (e.g., non-interactive TTY), just warn and continue
    console.error('')
    console.error('⚠️  Unable to prompt for permission fix (non-interactive terminal?)')
    console.error('')
    console.error('To fix manually, run:')
    console.error(`  chmod 600 ${getConfigPath()}`)
    console.error('')
    return { wasSecure: false, wasFixed: false, error: 'no_tty' }
  }
}
