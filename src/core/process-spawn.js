/**
 * @file src/core/process-spawn.js
 * @description Build child-process invocations that survive Windows paths with spaces.
 *
 * @details
 *   📖 Why this module exists (GitHub #210 — every harness failed to launch on Windows):
 *
 *   `spawn(command, args, { shell: true })` on win32 makes Node join command and
 *   arguments into ONE string and hand it to `cmd.exe`, quoting nothing. The first
 *   space in a path such as
 *   `C:\Users\John Doe\AppData\Roaming\npm\pi.cmd` truncates the command, so every
 *   launcher (Pi, Kilo, OpenCode, OpenClaw, jcode, ...) dies at startup.
 *
 *   📖 Removing the shell is not a fix either: npm installs CLIs as `.cmd` batch
 *   shims, and `CreateProcess` cannot execute a batch file, so a direct `spawn`
 *   fails with EINVAL/ENOENT. Both halves must be handled together.
 *
 *   📖 The contract implemented here:
 *   - POSIX: spawn the resolved binary directly, never through a shell (unchanged).
 *   - Windows native executables (`.exe`, `.com`, or any resolved absolute path
 *     without a batch extension): spawn directly. Node/libuv builds the command
 *     line with proper quoting, so spaces in the executable path are safe and every
 *     argument arrives verbatim.
 *   - Windows batch shims (`.cmd`, `.bat`) and bare command names that still need a
 *     PATHEXT lookup: run them through `%ComSpec% /d /s /c "<quoted line>"` with
 *     `windowsVerbatimArguments`, quoting each token ourselves.
 *
 *   📖 Safety: no user-controlled string is ever parsed as a command separator.
 *   Each token is emitted either bare (only from a conservative allow list) or
 *   wrapped in double quotes, where `&`, `|`, `<`, `>`, `(`, `)` and spaces are
 *   inert for cmd.exe. Characters cmd.exe cannot receive literally inside a quoted
 *   token (`"`, `%`, `^`, `!`, control chars) are rejected with a typed error
 *   instead of being interpolated, so a hostile argument can never chain a command.
 *
 * @functions
 *   → `isWindowsBatchShim` — true when a path points at a `.cmd`/`.bat` batch file
 *   → `requiresWindowsShellHost` — decide if a command must run through cmd.exe
 *   → `quoteWindowsCommandToken` — quote one token for a cmd.exe command line
 *   → `buildWindowsShimCommandLine` — build the `/s /c` payload for cmd.exe
 *   → `buildToolSpawnInvocation` — resolve { file, args, options } for spawn/spawnSync
 *   → `spawnToolProcess` — spawn a tool with the resolved invocation
 *   → `isUnsafeWindowsArgumentError` / `formatWindowsArgumentError` — user-facing errors
 *
 * @exports
 *   UNSAFE_WINDOWS_ARGUMENT_CODE, isWindowsBatchShim, requiresWindowsShellHost,
 *   quoteWindowsCommandToken, buildWindowsShimCommandLine, buildToolSpawnInvocation,
 *   spawnToolProcess, isUnsafeWindowsArgumentError, formatWindowsArgumentError
 *
 * @see src/core/tool-launchers.js
 * @see src/core/tool-bootstrap.js
 * @see src/core/opencode.js
 * @see src/core/kilo.js
 * @see src/core/openclaw.js
 */

import { spawn } from 'node:child_process'
import { extname } from 'node:path'

// 📖 Thrown when an argument cannot be represented on a cmd.exe command line
// 📖 without opening an injection hole. Callers show `formatWindowsArgumentError`.
export const UNSAFE_WINDOWS_ARGUMENT_CODE = 'ERR_UNSAFE_WINDOWS_ARGUMENT'

const BATCH_EXTENSIONS = new Set(['.cmd', '.bat'])
const PATH_SEPARATOR = /[\\/]/

// 📖 Characters cmd.exe cannot carry through a quoted token. A double quote ends
// 📖 the quoted region (and re-exposes `&`/`|`/`>`), `%` is expanded as an env var,
// 📖 `^` and `!` change how the batch interpreter re-parses the line, and control
// 📖 chars (newlines especially) split the command line outright.
const CMD_UNREPRESENTABLE = /["%^!\u0000-\u001f\u007f]/

// 📖 Tokens matching this are emitted bare: no quoting needed and nothing inside
// 📖 them is special to cmd.exe.
const CMD_SAFE_BARE = /^[A-Za-z0-9._\-+=/:@,\\]+$/

const UNREPRESENTABLE_HINTS = {
  '"': 'double quote',
  '%': 'percent',
  '^': 'caret',
  '!': 'exclamation mark',
}

function describeUnrepresentable(value) {
  const found = []
  for (const char of String(value)) {
    if (!CMD_UNREPRESENTABLE.test(char)) continue
    const label = UNREPRESENTABLE_HINTS[char] || 'control character'
    if (!found.includes(label)) found.push(label)
  }
  return found.length > 0 ? found.join(', ') : 'unsupported character'
}

/**
 * 📖 isWindowsBatchShim tells us whether `command` is a batch file. Batch files are
 * 📖 interpreted by cmd.exe only; CreateProcess refuses them, so they must go
 * 📖 through the shell host even when the path has no spaces.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isWindowsBatchShim(command) {
  if (!command) return false
  return BATCH_EXTENSIONS.has(extname(String(command)).toLowerCase())
}

/**
 * 📖 Decides whether a Windows command needs cmd.exe as host.
 * - batch shims: yes (CreateProcess cannot run them)
 * - bare names (`pi`, `node`): yes, because only cmd.exe performs the PATHEXT
 *   lookup, so an npm `.cmd` shim is still found. This keeps the previous
 *   behaviour for binaries FCM could not resolve to an absolute path.
 * - resolved paths to real executables: no, spawn them directly.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function requiresWindowsShellHost(command) {
  const value = String(command || '')
  if (!value) return false
  if (isWindowsBatchShim(value)) return true
  if (PATH_SEPARATOR.test(value)) return false
  return extname(value).length === 0
}

/**
 * 📖 quoteWindowsCommandToken renders one token for a cmd.exe command line.
 *
 * Safe tokens pass through untouched; tokens with spaces or shell punctuation are
 * double-quoted (everything relevant is inert inside quotes); tokens containing
 * characters that cannot be quoted safely throw instead of being interpolated.
 *
 * @param {string} token
 * @returns {string}
 * @throws {Error} with code UNSAFE_WINDOWS_ARGUMENT_CODE
 */
export function quoteWindowsCommandToken(token) {
  const value = String(token)

  if (CMD_UNREPRESENTABLE.test(value)) {
    const error = new Error(
      `Windows cannot pass an argument to cmd.exe safely (contains ${describeUnrepresentable(value)}).`
    )
    error.code = UNSAFE_WINDOWS_ARGUMENT_CODE
    throw error
  }

  if (value.length === 0) return '""'
  if (CMD_SAFE_BARE.test(value)) return value

  // 📖 MSVCRT/CommandLineToArgvW rule: backslashes right before a closing quote
  // 📖 must be doubled, otherwise they escape the quote and the token leaks out.
  const trailingBackslashes = /\\+$/.exec(value)
  const doubled = trailingBackslashes ? value.replace(/\\+$/, (run) => run + run) : value
  return `"${doubled}"`
}

/**
 * 📖 buildWindowsShimCommandLine produces the single argument handed to
 * 📖 `cmd.exe /d /s /c`. The outer pair of quotes is the one Node itself uses:
 * 📖 `/s` strips it, leaving the quoted command followed by its quoted arguments.
 *
 * @param {string} command
 * @param {string[]} [args]
 * @returns {string}
 */
export function buildWindowsShimCommandLine(command, args = []) {
  const tokens = [command, ...args].map((token) => quoteWindowsCommandToken(token))
  return `"${tokens.join(' ')}"`
}

/**
 * 📖 buildToolSpawnInvocation returns exactly what to pass to `spawn`/`spawnSync`:
 * 📖 the file to execute, its argv, and the options to merge in.
 *
 * POSIX callers get their command and args back untouched with `shell: false`, so
 * Unix process trees and argument handling do not change.
 *
 * @param {string} command - resolved binary path or bare command name
 * @param {string[]} [args]
 * @param {Record<string, unknown>} [spawnOptions] - stdio/env/detached/... passthrough
 * @param {{ platform?: string, comspec?: string }} [runtime] - injectable for tests
 * @returns {{ file: string, args: string[], options: Record<string, unknown>, shellHost: boolean }}
 */
export function buildToolSpawnInvocation(command, args = [], spawnOptions = {}, runtime = {}) {
  const platform = runtime.platform || process.platform
  const argv = Array.isArray(args) ? args.map((arg) => String(arg)) : []
  const options = { ...spawnOptions, shell: false }

  if (platform !== 'win32' || !requiresWindowsShellHost(command)) {
    return { file: command, args: argv, options, shellHost: false }
  }

  // 📖 %ComSpec% is the only reliable cmd.exe path; `cmd.exe` alone is the
  // 📖 documented fallback when the variable is missing.
  const comspec = runtime.comspec || process.env.ComSpec || process.env.COMSPEC || 'cmd.exe'

  return {
    file: comspec,
    args: ['/d', '/s', '/c', buildWindowsShimCommandLine(command, argv)],
    // 📖 The payload is already quoted, so Node must not quote it a second time.
    options: { ...options, windowsVerbatimArguments: true },
    shellHost: true,
  }
}

/**
 * 📖 spawnToolProcess is the one-call helper for every launcher. It throws the
 * 📖 typed unsafe-argument error before spawning, so nothing hostile is ever
 * 📖 handed to a shell.
 *
 * @param {string} command
 * @param {string[]} [args]
 * @param {Record<string, unknown>} [spawnOptions]
 * @param {{ platform?: string, comspec?: string }} [runtime]
 * @returns {import('node:child_process').ChildProcess}
 */
export function spawnToolProcess(command, args = [], spawnOptions = {}, runtime = {}) {
  const invocation = buildToolSpawnInvocation(command, args, spawnOptions, runtime)
  return spawn(invocation.file, invocation.args, invocation.options)
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isUnsafeWindowsArgumentError(error) {
  return Boolean(error && typeof error === 'object' && error.code === UNSAFE_WINDOWS_ARGUMENT_CODE)
}

/**
 * 📖 formatWindowsArgumentError turns the typed error into one readable line for
 * 📖 the TUI, or returns null when the error is something else.
 *
 * @param {unknown} error
 * @returns {string|null}
 */
export function formatWindowsArgumentError(error) {
  if (!isUnsafeWindowsArgumentError(error)) return null
  return `  X ${error.message}`
}
