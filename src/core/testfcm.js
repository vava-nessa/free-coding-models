/**
 * @file src/testfcm.js
 * @description Shared helpers for the AI-driven `/testfcm` workflow.
 *
 * @details
 *   📖 These helpers stay side-effect free on purpose so the reporting logic can
 *   📖 be unit-tested without spawning a PTY or touching the user's machine.
 *
 *   📖 The runner in `scripts/testfcm-runner.mjs` handles the live terminal work:
 *   📖 copying config into an isolated HOME, driving the TUI, launching a tool,
 *   📖 sending a prompt, collecting logs, and writing the final Markdown report.
 *   📖 This module focuses on the pieces that should remain stable and reusable:
 *   📖 tool metadata, transcript classification, JSON extraction, and report text.
 *
 * @functions
 *   → `normalizeTestfcmToolName` — map aliases like `claude` to canonical FCM tool modes
 *   → `resolveTestfcmToolSpec` — return the runner metadata for one tool mode
 *   → `hasConfiguredKey` — decide whether a config entry really contains an API key
 *   → `createTestfcmRunId` — build a stable timestamp-based run id for artifacts
 *   → `extractJsonPayload` — recover JSON mode output even when logs prefix stdout
 *   → `pickTestfcmSelectionIndex` — pick the most promising preflight row before sending Enter
 *   → `detectTranscriptFindings` — map raw tool output to actionable failure findings
 *   → `classifyToolTranscript` — classify a run as passed, failed, or inconclusive
 *   → `buildFixTasks` — convert findings into concrete follow-up work items
 *   → `buildTestfcmReport` — render the final Markdown report written under `task/`
 *
 * @exports TESTFCM_TOOL_SPECS, normalizeTestfcmToolName, resolveTestfcmToolSpec
 * @exports hasConfiguredKey, createTestfcmRunId, extractJsonPayload, pickTestfcmSelectionIndex
 * @exports detectTranscriptFindings, classifyToolTranscript, buildFixTasks
 * @exports buildTestfcmReport
 */

export const TESTFCM_TOOL_SPECS = {
  crush: {
    mode: 'crush',
    label: 'Crush',
    command: 'crush',
    flag: '--crush',
    prefersProxy: false,
    configPaths: ['.config/crush/crush.json'],
  },
  goose: {
    mode: 'goose',
    label: 'Goose',
    command: 'goose',
    flag: '--goose',
    prefersProxy: false,
    configPaths: ['.config/goose/config.yaml'],
  },
  aider: {
    mode: 'aider',
    label: 'Aider',
    command: 'aider',
    flag: '--aider',
    prefersProxy: false,
    configPaths: ['.aider.conf.yml'],
  },
  qwen: {
    mode: 'qwen',
    label: 'Qwen Code',
    command: 'qwen',
    flag: '--qwen',
    prefersProxy: false,
    configPaths: ['.qwen/settings.json'],
  },
  amp: {
    mode: 'amp',
    label: 'Amp',
    command: 'amp',
    flag: '--amp',
    prefersProxy: false,
    configPaths: ['.config/amp/settings.json'],
  },
  pi: {
    mode: 'pi',
    label: 'Pi',
    command: 'pi',
    flag: '--pi',
    prefersProxy: false,
    configPaths: ['.pi/agent/models.json', '.pi/agent/settings.json'],
  },
  opencode: {
    mode: 'opencode',
    label: 'OpenCode CLI',
    command: 'opencode',
    flag: '--opencode',
    prefersProxy: false,
    configPaths: ['.config/opencode/opencode.json'],
  },
  openhands: {
    mode: 'openhands',
    label: 'OpenHands',
    command: 'openhands',
    flag: '--openhands',
    prefersProxy: false,
    configPaths: [],
  },
}

const TESTFCM_TOOL_ALIASES = {
  opencodecli: 'opencode',
}

const TRANSCRIPT_FINDING_RULES = [
  {
    id: 'terminal_too_small',
    title: 'PTY width warning blocked the TUI flow',
    severity: 'high',
    regex: /please maximize your terminal|terminal is too small|reduce font size or maximize width/i,
    task: 'Run `/testfcm` with a wider PTY (at least 80 columns) before sending Enter.',
  },
  {
    id: 'tool_missing',
    title: 'Tool binary missing',
    severity: 'high',
    regex: /could not find "[^"]+" in path|command not found|enoent/i,
    task: 'Install the requested tool binary or pass `--tool-bin-dir` so FCM can launch it during `/testfcm`.',
  },
  {
    id: 'invalid_api_key',
    title: 'Invalid or missing API auth',
    severity: 'high',
    regex: /invalid api|bad api key|incorrect api key|authentication failed|unauthorized|forbidden|missing api key|no api key|anthropic_auth_token|401\b|403\b/i,
    task: 'Validate the provider key used by the selected model, then re-run `/testfcm` and inspect the generated tool config and transcript.',
  },
  {
    id: 'rate_limited',
    title: 'Provider rate limited',
    severity: 'medium',
    regex: /rate limit|too many requests|quota exceeded|429\b/i,
    task: 'Retry with another configured provider or inspect cooldown handling in the direct launcher flow.',
  },
  {
    id: 'tool_launch_failed',
    title: 'Tool launch failed',
    severity: 'high',
    regex: /failed to launch|failed to start|process exited with code 1|syntaxerror|traceback|fatal:/i,
    task: 'Inspect the tool transcript and generated tool config under the isolated HOME to find the exact launcher failure.',
  },
]

const SUCCESS_PATTERNS = [
  /hello[,! ]/i,
  /how can i help/i,
  /how may i help/i,
  /how can i assist/i,
  /ready to help/i,
]

/**
 * 📖 Normalize a user/tool alias to the canonical FCM tool mode.
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeTestfcmToolName(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const normalized = value.trim().toLowerCase()
  return TESTFCM_TOOL_ALIASES[normalized] || normalized
}

/**
 * 📖 Resolve one `/testfcm` tool spec from user input.
 *
 * @param {string | null | undefined} value
 * @returns {typeof TESTFCM_TOOL_SPECS[keyof typeof TESTFCM_TOOL_SPECS] | null}
 */
export function resolveTestfcmToolSpec(value) {
  const normalized = normalizeTestfcmToolName(value)
  if (!normalized) return null
  return TESTFCM_TOOL_SPECS[normalized] || null
}

/**
 * 📖 Treat both string and multi-key array config entries as "configured" when at
 * 📖 least one non-empty key is present.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasConfiguredKey(value) {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((entry) => typeof entry === 'string' && entry.trim().length > 0)
  return false
}

/**
 * 📖 Build an artifact-friendly run id such as `20260316-184512-123`.
 * 📖 Milliseconds keep concurrent `/testfcm` runs from clobbering each other's
 * 📖 reports and isolated HOME directories when they start in the same second.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function createTestfcmRunId(date = new Date()) {
  const iso = date.toISOString()
  return iso
    .replace(/Z$/, '')
    .replace(/:/g, '')
    .replace(/-/g, '')
    .replace('T', '-')
    .replace(/\.(\d{3})$/, '-$1')
}

/**
 * 📖 Extract the first valid JSON array payload from mixed stdout text.
 *
 * @param {string} text
 * @returns {Array<object> | null}
 */
export function extractJsonPayload(text) {
  const source = String(text || '')
  let offset = source.indexOf('[')
  while (offset !== -1) {
    const candidate = source.slice(offset).trim()
    try {
      const parsed = JSON.parse(candidate)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      offset = source.indexOf('[', offset + 1)
    }
  }
  return null
}

/**
 * 📖 Pick the best row to highlight before the runner presses Enter.
 * 📖 The TUI and `--json` share the same sorted result order, so picking the
 * 📖 first clearly healthy row from the preflight is a cheap way to avoid
 * 📖 wasting E2E runs on obviously dead or auth-failing models.
 *
 * @param {Array<{ label?: string, status?: string, httpCode?: string }>} results
 * @param {{ preferProxy?: boolean }} [options]
 * @returns {number}
 */
export function pickTestfcmSelectionIndex(results, options = {}) {
  if (!Array.isArray(results) || results.length === 0) return 0

  if (options.preferProxy === true) {
    const groups = new Map()

    for (let index = 0; index < results.length; index++) {
      const row = results[index]
      const label = typeof row?.label === 'string' ? row.label.trim() : ''
      if (!label) continue

      if (!groups.has(label)) {
        groups.set(label, {
          rows: [],
          hasUp: false,
          hasAuthFailure: false,
          hasRateLimit: false,
          hasNotFound: false,
        })
      }

      const group = groups.get(label)
      const httpCode = String(row?.httpCode || '')
      group.rows.push({ index, row })
      if (row?.status === 'up') group.hasUp = true
      if (row?.status === 'auth_error' || httpCode === '401' || httpCode === '403') group.hasAuthFailure = true
      if (httpCode === '429') group.hasRateLimit = true
      if (httpCode === '404') group.hasNotFound = true
    }

    for (const row of results) {
      const label = typeof row?.label === 'string' ? row.label.trim() : ''
      const group = groups.get(label)
      if (!group?.hasUp) continue
      if (group.hasAuthFailure || group.hasRateLimit || group.hasNotFound) continue
      const target = group.rows.find((entry) => entry.row?.status === 'up')
      if (target) return target.index
    }

    for (const row of results) {
      const label = typeof row?.label === 'string' ? row.label.trim() : ''
      const group = groups.get(label)
      if (!group?.hasUp || group.hasAuthFailure) continue
      const target = group.rows.find((entry) => entry.row?.status === 'up')
      if (target) return target.index
    }
  }

  const exactUpIndex = results.findIndex((row) => row?.status === 'up' && String(row?.httpCode || '') === '200')
  if (exactUpIndex >= 0) return exactUpIndex

  const upIndex = results.findIndex((row) => row?.status === 'up')
  if (upIndex >= 0) return upIndex

  const okCodeIndex = results.findIndex((row) => String(row?.httpCode || '') === '200')
  if (okCodeIndex >= 0) return okCodeIndex

  return 0
}

/**
 * 📖 Detect known failure patterns in the raw tool transcript.
 *
 * @param {string} output
 * @returns {Array<{ id: string, title: string, severity: string, task: string, excerpt: string }>}
 */
export function detectTranscriptFindings(output) {
  const transcript = String(output || '')
  const findings = []

  for (const rule of TRANSCRIPT_FINDING_RULES) {
    const match = transcript.match(rule.regex)
    if (!match) continue

    findings.push({
      id: rule.id,
      title: rule.title,
      severity: rule.severity,
      task: rule.task,
      excerpt: match[0],
    })
  }

  return findings
}

/**
 * 📖 Decide whether the tool transcript proves success, proves failure, or stays
 * 📖 too ambiguous to trust.
 *
 * @param {string} output
 * @returns {{ status: 'passed' | 'failed' | 'inconclusive', findings: Array<{ id: string, title: string, severity: string, task: string, excerpt: string }>, matchedSuccess: string | null }}
 */
export function classifyToolTranscript(output) {
  const transcript = String(output || '')
  const matchedSuccess = SUCCESS_PATTERNS.find((pattern) => pattern.test(transcript))

  if (matchedSuccess) {
    return {
      status: 'passed',
      findings: [],
      matchedSuccess: matchedSuccess.source,
    }
  }

  const findings = detectTranscriptFindings(transcript)
  if (findings.length > 0) {
    return {
      status: 'failed',
      findings,
      matchedSuccess: null,
    }
  }

  return {
    status: 'inconclusive',
    findings: [],
    matchedSuccess: null,
  }
}

/**
 * 📖 Collapse findings into unique human-readable follow-up tasks.
 *
 * @param {Array<{ task: string }>} findings
 * @returns {string[]}
 */
export function buildFixTasks(findings) {
  const tasks = new Set()
  for (const finding of findings) {
    if (typeof finding?.task === 'string' && finding.task.trim().length > 0) {
      tasks.add(finding.task.trim())
    }
  }
  return [...tasks]
}

/**
 * 📖 Render the final Markdown report saved under `task/reports/`.
 *
 * @param {{
 *   runId: string,
 *   status: 'passed' | 'failed' | 'blocked',
 *   startedAt: string,
 *   finishedAt: string,
 *   toolLabel: string,
 *   toolMode: string,
 *   prompt: string,
 *   configuredProviders: string[],
 *   toolBinaryPath: string | null,
 *   isolatedHome: string,
 *   preflightSummary: string,
 *   findings: Array<{ id: string, title: string, severity: string, excerpt: string }>,
 *   tasks: string[],
 *   evidenceFiles: string[],
 *   requestLogSummary: string[],
 *   notes: string[],
 *   transcriptExcerpt: string
 * }} input
 * @returns {string}
 */
export function buildTestfcmReport(input) {
  const lines = []
  const findings = Array.isArray(input.findings) ? input.findings : []
  const tasks = Array.isArray(input.tasks) ? input.tasks : []
  const evidenceFiles = Array.isArray(input.evidenceFiles) ? input.evidenceFiles : []
  const requestLogSummary = Array.isArray(input.requestLogSummary) ? input.requestLogSummary : []
  const notes = Array.isArray(input.notes) ? input.notes : []
  const configuredProviders = Array.isArray(input.configuredProviders) ? input.configuredProviders : []
  const transcriptExcerpt = String(input.transcriptExcerpt || '').trim()

  lines.push(`# /testfcm Report - ${input.runId}`)
  lines.push('')
  lines.push(`- Status: **${input.status.toUpperCase()}**`)
  lines.push(`- Started: ${input.startedAt}`)
  lines.push(`- Finished: ${input.finishedAt}`)
  lines.push(`- Tool: ${input.toolLabel} (${input.toolMode})`)
  lines.push(`- Prompt sent: \`${input.prompt}\``)
  lines.push(`- Configured providers in isolated run: ${configuredProviders.length > 0 ? configuredProviders.join(', ') : '(none)'}`)
  lines.push(`- Tool binary: ${input.toolBinaryPath || '(not found on PATH)'}`)
  lines.push(`- Isolated HOME: \`${input.isolatedHome}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(input.preflightSummary)
  lines.push('')

  if (findings.length > 0) {
    lines.push('## Bugs Found')
    lines.push('')
    for (const finding of findings) {
      lines.push(`- [${finding.severity}] ${finding.title} - evidence: \`${finding.excerpt}\``)
    }
    lines.push('')
  } else {
    lines.push('## Bugs Found')
    lines.push('')
    lines.push('- No blocking bug pattern matched the captured transcript in this run.')
    lines.push('')
  }

  lines.push('## Tasks To Resolve')
  lines.push('')
  if (tasks.length > 0) {
    for (const task of tasks) {
      lines.push(`- ${task}`)
    }
  } else {
    lines.push('- No follow-up task was generated from the captured evidence.')
  }
  lines.push('')

  lines.push('## Evidence')
  lines.push('')
  if (evidenceFiles.length > 0) {
    for (const file of evidenceFiles) {
      lines.push(`- ${file}`)
    }
  } else {
    lines.push('- No artifact file was captured.')
  }
  lines.push('')

  lines.push('## Runtime Diagnostics')
  lines.push('')
  if (requestLogSummary.length > 0) {
    for (const entry of requestLogSummary) {
      lines.push(`- ${entry}`)
    }
  } else {
    lines.push('- No extra runtime diagnostic summary was captured for this run.')
  }
  lines.push('')

  lines.push('## Notes')
  lines.push('')
  if (notes.length > 0) {
    for (const note of notes) {
      lines.push(`- ${note}`)
    }
  } else {
    lines.push('- No extra notes.')
  }
  lines.push('')

  lines.push('## Transcript Excerpt')
  lines.push('')
  if (transcriptExcerpt) {
    lines.push('```text')
    lines.push(transcriptExcerpt)
    lines.push('```')
  } else {
    lines.push('```text')
    lines.push('(empty transcript excerpt)')
    lines.push('```')
  }
  lines.push('')
  lines.push('## Next Step')
  lines.push('')
  lines.push('Ask the AI to read this report, summarize the blockers, and propose or apply the fixes.')

  return lines.join('\n')
}
