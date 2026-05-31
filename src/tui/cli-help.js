/**
 * @file src/cli-help.js
 * @description Shared CLI help builder for the startup `--help` flag and the in-app help overlay.
 *
 * @details
 *   📖 Keeping CLI help text in one module avoids the classic drift where the TUI overlay
 *   📖 documents one set of flags while `--help` prints another. New flags should be added
 *   📖 here once, then both entry points stay aligned.
 *
 *   📖 The builder accepts an optional `chalk` instance. When omitted, it returns plain text,
 *   📖 which keeps unit tests simple and makes the function safe for non-TTY contexts.
 *
 * @functions
 *   → `buildCliHelpLines` — build formatted help lines with optional colors and indentation
 *   → `buildCliHelpText` — join the help lines into one printable string
 *
 * @exports buildCliHelpLines, buildCliHelpText
 * @see ./tool-metadata.js — source of truth for launcher modes and their CLI flags
 */

import { getToolModeOrder, getToolMeta } from '../core/tool-metadata.js'

const ANALYSIS_FLAGS = [
  { flag: '--best', description: 'Show only top tiers (A+, S, S+)' },
  { flag: '--fiable', description: 'Run the 10s reliability analysis mode' },
  { flag: '--json', description: 'Output results as JSON for scripts/automation' },
  { flag: '--tier <S|A|B|C>', description: 'Filter models by tier family' },
  { flag: '--recommend', description: 'Open Smart Recommend immediately on startup' },
  { flag: '--premium', description: 'Start with S-tier filter + verdict sort (you can reset it in-app)' },
  { flag: '--sort <column>', description: 'Sort by column (rank, tier, origin, model, ping, avg, swe, ctx, condition, verdict, uptime, stability, aiLatency, tps)' },
  { flag: '--desc | --asc', description: 'Set sort direction (descending or ascending)' },
  { flag: '--origin <provider>', description: 'Filter models by provider origin' },
  { flag: '--ping-interval <ms>', description: 'Override ping interval in milliseconds' },
  { flag: '--hide-unconfigured', description: 'Hide models without configured API keys' },
  { flag: '--show-unconfigured', description: 'Show all models regardless of API key config' },
]

const CONFIG_FLAGS = [
  { flag: '--daemon', description: 'Start the FCM Router daemon + web dashboard (same port)' },
  { flag: '--daemon-bg', description: 'Start the FCM Router daemon in the background' },
  { flag: '--daemon-status', description: 'Print FCM Router daemon status JSON' },
  { flag: '--daemon-stop', description: 'Gracefully stop the FCM Router daemon' },
  { flag: '--sync-set [name]', description: 'Auto-discover and live-probe models into a router set' },
  { flag: '--no-telemetry', description: 'Disable anonymous telemetry for this run' },
  { flag: '--help, -h', description: 'Print this help and exit' },
]

const EXAMPLES = [
  'free-coding-models --help',
  'free-coding-models --daemon',
  'free-coding-models --daemon-bg',
  'free-coding-models --daemon-status',
  'free-coding-models --sync-set',
  'free-coding-models --sync-set my-coding-set',
  'free-coding-models --openclaw --tier S',
  "free-coding-models --json | jq '.[0]'",
]

function paint(chalk, formatter, text) {
  if (!chalk || !formatter) return text
  return formatter(text)
}

function formatEntry(label, description, { chalk = null, indent = '', labelWidth = 40 } = {}) {
  const coloredLabel = paint(chalk, chalk?.cyan, label.padEnd(labelWidth))
  const coloredDescription = paint(chalk, chalk?.dim, description)
  return `${indent}${coloredLabel} ${coloredDescription}`
}

export function buildCliHelpLines({ chalk = null, indent = '', title = 'CLI Help' } = {}) {
  const lines = []
  const launchFlags = getToolModeOrder()
    .map((mode) => getToolMeta(mode))
    .filter((meta) => meta.flag)
    .map((meta) => ({ flag: meta.flag, description: `${meta.label} mode` }))

  lines.push(`${indent}${paint(chalk, chalk?.bold, title)}`)
  lines.push(`${indent}${paint(chalk, chalk?.dim, 'Usage: free-coding-models [apiKey] [options]')}`)
  lines.push('')
  lines.push(`${indent}${paint(chalk, chalk?.bold, 'Tool Flags')}`)
  for (const entry of launchFlags) {
    lines.push(formatEntry(entry.flag, entry.description, { chalk, indent }))
  }
  lines.push('')
  lines.push(`${indent}${paint(chalk, chalk?.bold, 'Analysis Flags')}`)
  for (const entry of ANALYSIS_FLAGS) {
    lines.push(formatEntry(entry.flag, entry.description, { chalk, indent }))
  }
  lines.push('')
  lines.push(`${indent}${paint(chalk, chalk?.bold, 'Config & Maintenance')}`)
  for (const entry of CONFIG_FLAGS) {
    lines.push(formatEntry(entry.flag, entry.description, { chalk, indent }))
  }
  lines.push('')
  lines.push(`${indent}${paint(chalk, chalk?.dim, 'Default launcher with no tool flag: OpenCode CLI')}`)
  lines.push(`${indent}${paint(chalk, chalk?.dim, 'Flags can be combined: --openclaw --tier S --json')}`)
  lines.push('')
  lines.push(`${indent}${paint(chalk, chalk?.bold, 'Examples')}`)
  for (const example of EXAMPLES) {
    lines.push(`${indent}${paint(chalk, chalk?.cyan, example)}`)
  }

  return lines
}

export function buildCliHelpText(options = {}) {
  return buildCliHelpLines(options).join('\n')
}
