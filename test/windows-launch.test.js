/**
 * @file test/windows-launch.test.js
 * @description Regression tests for the shared launcher spawn path (GitHub #210).
 *
 * @details
 *   📖 The bug: every harness failed to launch on Windows when the user profile
 *   path contained a space, because FCM spawned tools with `shell: true` and Node
 *   joined command + args into one unquoted cmd.exe line. Dropping the shell alone
 *   breaks npm `.cmd` shims, which CreateProcess cannot execute.
 *
 *   📖 These tests pin the contract of `src/core/process-spawn.js`:
 *   - POSIX behaviour is unchanged: direct spawn, no shell, args untouched.
 *   - Windows native executables are spawned directly (works with spaces).
 *   - Windows batch shims and bare names go through `cmd.exe /d /s /c` with every
 *     token quoted, so a spaced path is never split.
 *   - Arguments cmd.exe cannot quote safely are rejected, never interpolated.
 *
 *   📖 A real Windows machine was not available for this run: the win32 branch is
 *   verified by unit tests over the exact argv/command line that would be handed
 *   to cmd.exe, plus a POSIX integration test that proves spaced paths still work.
 *
 * @see src/core/process-spawn.js
 * @see src/core/tool-launchers.js
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  UNSAFE_WINDOWS_ARGUMENT_CODE,
  buildToolSpawnInvocation,
  buildWindowsShimCommandLine,
  formatWindowsArgumentError,
  isUnsafeWindowsArgumentError,
  isWindowsBatchShim,
  quoteWindowsCommandToken,
  requiresWindowsShellHost,
  spawnToolProcess,
} from '../src/core/process-spawn.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const LINUX = { platform: 'linux' }
const DARWIN = { platform: 'darwin' }
const WINDOWS = { platform: 'win32', comspec: 'C:\\Windows\\system32\\cmd.exe' }

const SPACED_NPM_SHIM = 'C:\\Users\\John Doe\\AppData\\Roaming\\npm\\pi.cmd'
const SPACED_NATIVE_EXE = 'C:\\Program Files\\nodejs\\node.exe'

// 📖 Runs a command to completion and returns its exit code + captured stdout.
function runChild(file, args, runtime) {
  return new Promise((resolve, reject) => {
    const child = spawnToolProcess(file, args, { stdio: ['ignore', 'pipe', 'pipe'] }, runtime)
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk })
    child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

describe('process-spawn — POSIX behaviour is preserved', () => {
  it('spawns the resolved binary directly, without a shell', () => {
    for (const runtime of [LINUX, DARWIN]) {
      const invocation = buildToolSpawnInvocation(
        '/Users/John Doe/Library/pnpm/pi',
        ['--provider', 'groq', '--model', 'openai/gpt-oss-120b'],
        { stdio: 'inherit', env: { A: '1' } },
        runtime
      )

      assert.equal(invocation.file, '/Users/John Doe/Library/pnpm/pi')
      assert.deepEqual(invocation.args, ['--provider', 'groq', '--model', 'openai/gpt-oss-120b'])
      assert.equal(invocation.options.shell, false)
      assert.equal(invocation.options.windowsVerbatimArguments, undefined)
      assert.equal(invocation.shellHost, false)
      // 📖 Non-shell options must survive untouched.
      assert.equal(invocation.options.stdio, 'inherit')
      assert.deepEqual(invocation.options.env, { A: '1' })
    }
  })

  it('never shell-hosts a POSIX command, even one that looks like a batch file', () => {
    const invocation = buildToolSpawnInvocation('/opt/tools/weird.cmd', ['--flag'], {}, LINUX)
    assert.equal(invocation.file, '/opt/tools/weird.cmd')
    assert.deepEqual(invocation.args, ['--flag'])
    assert.equal(invocation.options.shell, false)
    assert.equal(invocation.shellHost, false)
  })

  it('keeps spaced paths and spaced arguments intact end to end', async () => {
    const base = mkdtempSync(join(tmpdir(), 'fcm space-'))
    const binDir = join(base, 'My Tools')
    const scriptPath = join(binDir, 'echo-argv')

    try {
      mkdirSync(binDir, { recursive: true })
      // 📖 The fixture prints its own argv, so any re-splitting would show up.
      writeFileSync(
        scriptPath,
        '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)))\n'
      )
      chmodSync(scriptPath, 0o755)

      const expected = ['--provider', 'groq', '--model', 'openai/gpt-oss-120b', 'two words', 'say "hi"']
      const { code, stdout } = await runChild(scriptPath, expected)

      assert.equal(code, 0)
      assert.deepEqual(JSON.parse(stdout.trim()), expected)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })
})

describe('process-spawn — Windows native executables', () => {
  it('spawns a resolved .exe directly so Node quotes the spaced path', () => {
    const invocation = buildToolSpawnInvocation(
      SPACED_NATIVE_EXE,
      ['--version'],
      { stdio: 'inherit' },
      WINDOWS
    )

    assert.equal(invocation.file, SPACED_NATIVE_EXE)
    assert.deepEqual(invocation.args, ['--version'])
    assert.equal(invocation.options.shell, false)
    assert.equal(invocation.options.windowsVerbatimArguments, undefined)
    assert.equal(invocation.shellHost, false)
  })

  it('spawns a resolved path without extension directly', () => {
    const invocation = buildToolSpawnInvocation('C:\\Program Files\\Tool\\tool', ['--x'], {}, WINDOWS)
    assert.equal(invocation.file, 'C:\\Program Files\\Tool\\tool')
    assert.equal(invocation.shellHost, false)
  })

  it('treats .exe and .com paths as direct executables', () => {
    assert.equal(requiresWindowsShellHost('C:\\Tools\\a.exe'), false)
    assert.equal(requiresWindowsShellHost('C:\\Tools\\a.com'), false)
    assert.equal(isWindowsBatchShim('C:\\Tools\\a.exe'), false)
  })
})

describe('process-spawn — Windows npm .cmd shims', () => {
  it('routes a spaced .cmd shim through cmd.exe instead of a raw shell join', () => {
    const invocation = buildToolSpawnInvocation(
      SPACED_NPM_SHIM,
      ['--provider', 'groq'],
      { stdio: 'inherit', env: { A: '1' } },
      WINDOWS
    )

    assert.equal(invocation.file, 'C:\\Windows\\system32\\cmd.exe')
    assert.equal(invocation.args.length, 4)
    assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c'])
    assert.equal(
      invocation.args[3],
      '"' + '"' + SPACED_NPM_SHIM + '" --provider groq' + '"'
    )
    assert.equal(invocation.options.shell, false)
    assert.equal(invocation.options.windowsVerbatimArguments, true)
    assert.equal(invocation.options.stdio, 'inherit')
    assert.deepEqual(invocation.options.env, { A: '1' })
    assert.equal(invocation.shellHost, true)
  })

  it('recognises both batch extensions and keeps bare names on cmd.exe', () => {
    assert.equal(isWindowsBatchShim(SPACED_NPM_SHIM), true)
    assert.equal(isWindowsBatchShim('C:\\tools\\legacy.BAT'), true)
    // 📖 Bare names keep the old PATHEXT lookup, so an npm shim is still found.
    assert.equal(requiresWindowsShellHost('pi'), true)
    assert.equal(requiresWindowsShellHost('node'), true)
    // 📖 A bare name with an explicit extension is resolved by CreateProcess.
    assert.equal(requiresWindowsShellHost('pi.exe'), false)
  })

  it('quotes every argument as its own token', () => {
    const line = buildWindowsShimCommandLine(SPACED_NPM_SHIM, [
      'repl',
      '--model',
      'openai/gpt-oss-120b',
      'two words',
    ])

    assert.equal(
      line,
      '""C:\\Users\\John Doe\\AppData\\Roaming\\npm\\pi.cmd" repl --model openai/gpt-oss-120b "two words""'
    )
  })

  it('keeps cmd.exe metacharacters inert inside their quoted token', () => {
    const line = buildWindowsShimCommandLine(SPACED_NPM_SHIM, ['a&calc', 'b|c', '>out.txt'])

    assert.equal(
      line,
      '""C:\\Users\\John Doe\\AppData\\Roaming\\npm\\pi.cmd" "a&calc" "b|c" ">out.txt""'
    )

    // 📖 `cmd /s /c` strips the outer quote pair, so unwrap it the same way and
    // 📖 then walk the rest with quote awareness: no separator may sit outside a
    // 📖 quoted token.
    const payload = line.slice(1, -1)
    let inQuotes = false
    let unquoted = ''
    for (const char of payload) {
      if (char === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (!inQuotes) unquoted += char
    }
    assert.equal(unquoted.trim(), '')
    assert.equal(inQuotes, false)
  })

  it('quotes empty arguments and doubles trailing backslashes inside quotes', () => {
    assert.equal(quoteWindowsCommandToken(''), '""')
    assert.equal(quoteWindowsCommandToken('C:\\dir with space\\'), '"C:\\dir with space\\\\"')
    assert.equal(quoteWindowsCommandToken('plain-value'), 'plain-value')
  })

  it('falls back to cmd.exe when %ComSpec% is not set', () => {
    const previous = process.env.ComSpec
    delete process.env.ComSpec
    try {
      const invocation = buildToolSpawnInvocation(SPACED_NPM_SHIM, [], {}, { platform: 'win32' })
      assert.match(invocation.file, /cmd\.exe$/i)
    } finally {
      if (previous !== undefined) process.env.ComSpec = previous
    }
  })
})

describe('process-spawn — no unsafe shell interpolation', () => {
  const hostile = [
    ['a" & calc', /double quote/i],
    ['100%PATH%', /percent/i],
    ['caret^escape', /caret/i],
    ['bang!like', /exclamation/i],
    ['line\nbreak', /control character/i],
  ]

  for (const [argument, reason] of hostile) {
    it(`rejects ${JSON.stringify(argument)} instead of interpolating it`, () => {
      assert.throws(
        () => buildToolSpawnInvocation(SPACED_NPM_SHIM, [argument], {}, WINDOWS),
        (error) => {
          assert.equal(error.code, UNSAFE_WINDOWS_ARGUMENT_CODE)
          assert.match(error.message, reason)
          assert.equal(error.message.includes(argument), false)
          assert.equal(isUnsafeWindowsArgumentError(error), true)
          assert.equal(formatWindowsArgumentError(error), `  X ${error.message}`)
          return true
        }
      )
      assert.throws(() => quoteWindowsCommandToken(argument))
    })
  }

  it('rejects an unsafe executable path too', () => {
    assert.throws(
      () => buildToolSpawnInvocation('C:\\Users\\John Doe\\a"b\\pi.cmd', [], {}, WINDOWS),
      (error) => error.code === UNSAFE_WINDOWS_ARGUMENT_CODE
    )
  })

  it('ignores unrelated errors in the formatter', () => {
    const generic = new Error('boom')
    assert.equal(isUnsafeWindowsArgumentError(generic), false)
    assert.equal(isUnsafeWindowsArgumentError(null), false)
    assert.equal(formatWindowsArgumentError(generic), null)
  })
})

describe('process-spawn — launcher modules use the shared helper', () => {
  const launcherModules = [
    'src/core/tool-launchers.js',
    'src/core/opencode.js',
    'src/core/kilo.js',
    'src/core/openclaw.js',
  ]

  for (const relativePath of launcherModules) {
    it(`${relativePath} never spawns through an unquoted shell`, () => {
      const source = readFileSync(join(ROOT, relativePath), 'utf8')
      const codeOnly = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n')

      // 📖 `shell: true` is the exact construct that broke GitHub #210.
      assert.doesNotMatch(codeOnly, /shell:\s*(true|isWindows)\b/)
      assert.match(codeOnly, /buildToolSpawnInvocation|spawnToolProcess/)
    })
  }
})
