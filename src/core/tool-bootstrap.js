/**
 * @file src/tool-bootstrap.js
 * @description Shared detection and auto-install helpers for external coding tools launched by FCM.
 *
 * @details
 *   📖 This module answers three operational questions for every supported launcher:
 *   - which executable should exist locally before FCM can launch the tool
 *   - how to detect that executable without spawning the full TUI/CLI itself
 *   - which official install command FCM can offer when the tool is missing
 *
 *   📖 The goal is deliberately narrow. We only solve the "binary missing" bootstrap
 *   path so the main TUI can keep the user's selected model, offer a tiny Yes/No
 *   confirmation overlay, then continue with the existing config-write + launch flow.
 *
 *   📖 FCM prefers npm when a tool officially supports it because the binary usually
 *   lands in a predictable global location and works immediately in the same session.
 *   For tools that do not have a maintained npm install path, we use the official
 *   installer script documented by the tool itself.
 *
 * @functions
 *   → `getToolBootstrapMeta` — static metadata for one tool mode
 *   → `resolveToolBinaryPath` — find a launcher executable in PATH or common user bin dirs
 *   → `isToolInstalled` — quick boolean wrapper around binary resolution
 *   → `getToolInstallPlan` — pick the platform-specific install command for a tool
 *   → `installToolWithPlan` — execute the chosen install command with inherited stdio
 *
 * @exports
 *   TOOL_BOOTSTRAP_METADATA, getToolBootstrapMeta, resolveToolBinaryPath,
 *   isToolInstalled, getToolInstallPlan, installToolWithPlan
 *
 * @see src/key-handler.js
 * @see src/tool-launchers.js
 * @see src/opencode.js
 */

import { spawn } from 'child_process'
import { existsSync, statSync } from 'fs'
import { homedir } from 'os'
import { delimiter, extname, join } from 'path'
import { isWindows } from './provider-metadata.js'

const HOME = homedir()

// 📖 Common user-level binary directories that installer scripts frequently use.
// 📖 We search them in addition to PATH so FCM can keep going right after install
// 📖 even if the user's shell profile has not been reloaded yet.
const COMMON_USER_BIN_DIRS = isWindows
  ? [
      join(HOME, '.local', 'bin'),
      join(HOME, 'AppData', 'Roaming', 'npm'),
      join(HOME, 'scoop', 'shims'),
    ]
  : [
      join(HOME, '.local', 'bin'),
      join(HOME, '.bun', 'bin'),
      join(HOME, '.npm-global', 'bin'),
    ]

function uniqueStrings(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))]
}

function pathEntries(env = process.env) {
  return uniqueStrings([
    ...(String(env.PATH || '').split(delimiter)),
    ...(env.npm_config_prefix ? [isWindows ? env.npm_config_prefix : join(env.npm_config_prefix, 'bin')] : []),
    ...COMMON_USER_BIN_DIRS,
  ])
}

function executableSuffixes(env = process.env) {
  if (!isWindows) return ['']
  const raw = String(env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
  return uniqueStrings(raw.split(';').flatMap((ext) => {
    const normalized = ext.trim()
    if (!normalized) return []
    return [normalized.toLowerCase(), normalized.toUpperCase()]
  }))
}

function isRunnableFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile()
  } catch {
    return false
  }
}

function resolveBinaryPath(binaryName, env = process.env) {
  if (!binaryName || typeof binaryName !== 'string') return null

  const entries = pathEntries(env)
  if (entries.length === 0) return null

  const hasExtension = extname(binaryName).length > 0
  const suffixes = isWindows
    ? (hasExtension ? [''] : executableSuffixes(env))
    : ['']

  for (const dir of entries) {
    for (const suffix of suffixes) {
      const candidate = join(dir, `${binaryName}${suffix}`)
      if (isRunnableFile(candidate)) return candidate
    }
  }

  return null
}

export const TOOL_BOOTSTRAP_METADATA = {
  opencode: {
    binary: 'opencode',
    docsUrl: 'https://opencode.ai/download',
    install: {
      default: {
        shellCommand: 'npm install -g opencode-ai',
        summary: 'Install OpenCode CLI globally via npm.',
      },
    },
  },
  'opencode-desktop': {
    binary: null,
    docsUrl: 'https://opencode.ai/download',
    installUnsupported: {
      default: 'OpenCode Desktop uses platform-specific app installers, so FCM does not auto-install it yet.',
    },
  },
  openclaw: {
    binary: 'openclaw',
    docsUrl: 'https://docs.openclaw.ai/install',
    install: {
      default: {
        shellCommand: 'npm install -g openclaw@latest',
        summary: 'Install OpenClaw globally via npm.',
      },
    },
  },
  crush: {
    binary: 'crush',
    docsUrl: 'https://github.com/charmbracelet/crush',
    install: {
      default: {
        shellCommand: 'npm install -g @charmland/crush',
        summary: 'Install Crush globally via npm.',
      },
    },
  },
  goose: {
    binary: 'goose',
    docsUrl: 'https://block.github.io/goose/docs/getting-started/installation/',
    install: {
      default: {
        shellCommand: 'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash',
        summary: 'Install goose CLI with the official installer script.',
      },
      win32: {
        shellCommand: 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri https://raw.githubusercontent.com/block/goose/main/download_cli.ps1 -OutFile $env:TEMP\\download_cli.ps1; & $env:TEMP\\download_cli.ps1"',
        summary: 'Install goose CLI with the official PowerShell installer.',
      },
    },
  },
  aider: {
    binary: 'aider',
    docsUrl: 'https://aider.chat/docs/install.html',
    install: {
      default: {
        shellCommand: 'curl -LsSf https://aider.chat/install.sh | sh',
        summary: 'Install aider with the official installer.',
      },
      win32: {
        shellCommand: 'powershell -ExecutionPolicy ByPass -c "irm https://aider.chat/install.ps1 | iex"',
        summary: 'Install aider with the official PowerShell installer.',
      },
    },
  },
  kilo: {
    binary: 'kilo',
    docsUrl: 'https://kilo.ai/docs/cli',
    install: {
      default: {
        shellCommand: 'npm install -g @kilocode/cli',
        summary: 'Install Kilo CLI globally via npm.',
      },
    },
  },
  qwen: {
    binary: 'qwen',
    docsUrl: 'https://qwenlm.github.io/qwen-code-docs/en/users/quickstart/',
    install: {
      default: {
        shellCommand: 'npm install -g @qwen-code/qwen-code@latest',
        summary: 'Install Qwen Code globally via npm.',
      },
    },
  },
  openhands: {
    binary: 'openhands',
    docsUrl: 'https://docs.openhands.dev/openhands/usage/cli/installation',
    install: {
      default: {
        shellCommand: 'curl -fsSL https://install.openhands.dev/install.sh | sh',
        summary: 'Install OpenHands CLI with the official installer.',
      },
    },
    installUnsupported: {
      win32: 'OpenHands CLI currently recommends installation inside WSL on Windows.',
    },
  },
  amp: {
    binary: 'amp',
    docsUrl: 'https://ampcode.com/manual',
    install: {
      default: {
        shellCommand: 'npm install -g @sourcegraph/amp',
        summary: 'Install Amp globally via npm.',
        note: 'Amp documents npm as a fallback install path. Its plugin API works best with the binary installer from ampcode.com/install.',
      },
    },
  },
  pi: {
    binary: 'pi',
    docsUrl: 'https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md',
    install: {
      default: {
        shellCommand: 'npm install -g @mariozechner/pi-coding-agent',
        summary: 'Install Pi Coding Agent globally via npm.',
      },
    },
  },
  'continue': {
    binary: 'cn',
    docsUrl: 'https://docs.continue.dev/cli/overview',
    install: {
      default: {
        shellCommand: 'npm install -g @continuedev/cli',
        summary: 'Install Continue CLI globally via npm.',
      },
    },
  },
  cline: {
    binary: 'cline',
    docsUrl: 'https://docs.cline.bot/cline-cli/overview',
    install: {
      default: {
        shellCommand: 'npm install -g cline',
        summary: 'Install Cline CLI globally via npm.',
      },
    },
  },
  xcode: {
    binary: 'xcodebuild',
    docsUrl: 'https://developer.apple.com/documentation/Xcode/setting-up-coding-intelligence',
    installUnsupported: {
      default: 'Xcode Intelligence requires manual setup. Go to Xcode > Settings > Intelligence > Add a Chat Provider.',
    },
  },
  hermes: {
    binary: 'hermes',
    docsUrl: 'https://github.com/NousResearch/hermes-agent',
    install: {
      default: {
        shellCommand: 'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash',
        summary: 'Install Hermes Agent via the official Nous Research installer.',
        note: 'Hermes requires Python 3.11+ and git. The installer handles everything else automatically.',
      },
    },
    installUnsupported: {
      win32: 'Hermes Agent does not support native Windows. Use WSL2 instead.',
    },
  },
  caveman: {
    binary: 'caveman',
    docsUrl: 'https://github.com/JuliusBrussee/caveman-code',
    install: {
      default: {
        shellCommand: 'npm install -g @juliusbrussee/caveman-code',
        summary: 'Install Caveman Code globally via npm.',
        note: 'After installation, run `caveman /login` to authenticate with your preferred provider (Claude, ChatGPT, Copilot, etc.).',
      },
    },
  },
  jcode: {
    binary: 'jcode',
    docsUrl: 'https://github.com/1jehuang/jcode',
    install: {
      default: {
        shellCommand: 'curl -fsSL https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh | bash',
        summary: 'Install jcode via the official installer script.',
      },
      win32: {
        shellCommand: 'irm https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.ps1 | iex',
        summary: 'Install jcode via the official PowerShell installer.',
      },
    },
  },
  copilot: {
    binary: 'copilot',
    docsUrl: 'https://github.com/github/copilot',
    install: {
      default: {
        shellCommand: 'npm install -g @github/copilot',
        summary: 'Install GitHub Copilot CLI globally via npm.',
        note: 'After installation, run `copilot` to authenticate with GitHub.',
      },
    },
  },
  forgecode: {
    binary: 'forge',
    docsUrl: 'https://forgecode.dev',
    install: {
      default: {
        shellCommand: 'npm install -g forgecode',
        summary: 'Install ForgeCode globally via npm.',
        note: 'After installation, run `forge` to start. Use `forge provider login` to set up credentials.',
      },
    },
  },
}

export function getToolBootstrapMeta(mode) {
  return TOOL_BOOTSTRAP_METADATA[mode] || null
}

export function resolveToolBinaryPath(mode, options = {}) {
  const meta = getToolBootstrapMeta(mode)
  if (!meta?.binary) return null
  return resolveBinaryPath(meta.binary, options.env || process.env)
}

export function isToolInstalled(mode, options = {}) {
  return Boolean(resolveToolBinaryPath(mode, options))
}

export function getToolInstallPlan(mode, options = {}) {
  const meta = getToolBootstrapMeta(mode)
  const platform = options.platform || process.platform

  if (!meta) {
    return {
      supported: false,
      mode,
      binary: null,
      docsUrl: null,
      reason: `Unknown tool mode: ${mode}`,
    }
  }

  const platformUnsupportedReason = meta.installUnsupported?.[platform]
  if (platformUnsupportedReason) {
    return {
      supported: false,
      mode,
      binary: meta.binary || null,
      docsUrl: meta.docsUrl || null,
      reason: platformUnsupportedReason,
    }
  }

  const installPlan = meta.install?.[platform] || meta.install?.default || null
  if (!installPlan) {
    return {
      supported: false,
      mode,
      binary: meta.binary || null,
      docsUrl: meta.docsUrl || null,
      reason: meta.installUnsupported?.default || 'No auto-install plan is available for this tool on the current platform.',
    }
  }

  return {
    supported: true,
    mode,
    binary: meta.binary || null,
    docsUrl: meta.docsUrl || null,
    shellCommand: installPlan.shellCommand,
    summary: installPlan.summary,
    note: installPlan.note || null,
  }
}

export function installToolWithPlan(plan, options = {}) {
  return new Promise((resolve, reject) => {
    if (!plan?.supported || !plan.shellCommand) {
      resolve({
        ok: false,
        exitCode: 1,
        command: plan?.shellCommand || null,
      })
      return
    }

    const child = spawn(plan.shellCommand, [], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ...(options.env || {}) },
      cwd: options.cwd || process.cwd(),
    })

    child.on('exit', (code) => {
      resolve({
        ok: code === 0,
        exitCode: typeof code === 'number' ? code : 1,
        command: plan.shellCommand,
      })
    })
    child.on('error', reject)
  })
}
