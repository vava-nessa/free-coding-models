/**
 * @file index.js
 * @description OpenCode plugin adapter for free-coding-models.
 *
 * @details
 *   This adapter keeps OpenCode startup lightweight: it only reads the FCM
 *   cache or daemon during config loading, and performs direct provider probes
 *   only when the user explicitly runs `/fcm`. The scan/ranking implementation
 *   is shared with the Pi extension so provider fixes, safety filters, and
 *   benchmark behavior stay in one place while the OpenCode adapter only owns
 *   OpenCode config mutation and TUI notifications.
 *
 * @functions
 *   - FcmOpenCode → OpenCode plugin factory
 *   - handleFcmCommand → Scan/list/select models from `/fcm`
 *   - installModelIntoConfig → Inject an FCM provider into OpenCode config
 *   - configureSmartRouter → Explicitly switch OpenCode to the local FCM daemon router
 *
 * @exports FcmOpenCode, default
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { runFcmScan } from '../pi-extension/lib/scanner.js'
import { formatModelLine } from '../pi-extension/lib/model-ranker.js'
import { getPiMaxTokens, getPiReasoningFlag, parseContextWindow } from '../pi-extension/lib/pi-model-config.js'
import { isDaemonRunning } from '../pi-extension/lib/daemon-client.js'
import { loadAllApiKeys } from '../pi-extension/lib/api-keys.js'

const CACHE_FILE = join(homedir(), '.cache', 'free-coding-models', 'fcm-opencode-cache.json')
const LEGACY_PI_CACHE_FILE = join(homedir(), '.pi', 'agent', 'fcm-cache.json')
const CACHE_TTL_MS = 10 * 60 * 1000
const ROUTER_PROVIDER_ID = 'fcm-router'
const ROUTER_MODEL_ID = 'fcm'

function readCacheFile(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const cache = JSON.parse(readFileSync(filePath, 'utf8'))
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null
    return cache.data || null
  } catch {
    return null
  }
}

function readCache() {
  return readCacheFile(CACHE_FILE) || readCacheFile(LEGACY_PI_CACHE_FILE)
}

function writeCache(data) {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), data }, null, 2), 'utf8')
  } catch {
    // 📖 Cache writes are best-effort; never block OpenCode startup or commands.
  }
}

function stripCompletionsPath(url = '') {
  return url
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/responses$/i, '')
}

function getProviderId(model) {
  return model.providerKey?.startsWith('fcm-') ? model.providerKey : `fcm-${model.providerKey}`
}

function getFcmEnvName(providerKey) {
  return `FCM_${String(providerKey || 'provider').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

function getModelRef(model) {
  return `${getProviderId(model)}/${model.modelId}`
}

function buildModelConfig(model) {
  const contextWindow = parseContextWindow(model.ctxWindow)
  const outputLimit = getPiMaxTokens(contextWindow)
  return {
    id: model.modelId,
    name: `${model.label} (${model.providerName || model.providerKey}) [FCM ${model.tier || '?'}]`,
    reasoning: getPiReasoningFlag(),
    tool_call: true,
    temperature: true,
    cost: {
      input: 0,
      output: 0,
      cache_read: 0,
      cache_write: 0,
    },
    limit: {
      context: contextWindow,
      output: outputLimit,
    },
    modalities: {
      input: ['text'],
      output: ['text'],
    },
  }
}

function installModelIntoConfig(config, model, { setActive = false } = {}) {
  if (!config.provider || typeof config.provider !== 'object') config.provider = {}

  const providerId = getProviderId(model)
  const envName = getFcmEnvName(model.providerKey)
  if (model.apiKey && !process.env[envName]) process.env[envName] = model.apiKey

  const provider = config.provider[providerId] || {
    npm: '@ai-sdk/openai-compatible',
    name: `FCM ${model.providerName || model.providerKey}`,
    env: [envName],
    options: {},
    models: {},
  }

  provider.npm = '@ai-sdk/openai-compatible'
  provider.name = `FCM ${model.providerName || model.providerKey}`
  provider.env = Array.from(new Set([...(provider.env || []), envName]))
  provider.options = {
    ...provider.options,
    baseURL: stripCompletionsPath(model.providerUrl),
    apiKey: `{env:${envName}}`,
  }
  provider.models = {
    ...(provider.models || {}),
    [model.modelId]: buildModelConfig(model),
  }

  config.provider[providerId] = provider
  if (setActive) config.model = getModelRef(model)
  return getModelRef(model)
}

function installRankedIntoConfig(config, ranked, { setActive = false } = {}) {
  if (!Array.isArray(ranked)) return null
  let activeRef = null
  for (const [index, model] of ranked.entries()) {
    const ref = installModelIntoConfig(config, model, { setActive: setActive && index === 0 })
    if (index === 0) activeRef = ref
  }
  return activeRef
}

function configureSmartRouter(config, { setActive = true } = {}) {
  if (!config.provider || typeof config.provider !== 'object') config.provider = {}
  config.provider[ROUTER_PROVIDER_ID] = {
    npm: '@ai-sdk/openai-compatible',
    name: 'FCM Smart Router',
    options: {
      baseURL: `http://localhost:${process.env.FCM_ROUTER_PORT || '19280'}/v1`,
      apiKey: 'fcm-local',
    },
    models: {
      [ROUTER_MODEL_ID]: {
        id: ROUTER_MODEL_ID,
        name: 'FCM Auto-Router (best available)',
        reasoning: false,
        tool_call: true,
        temperature: true,
        cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
        limit: { context: 200000, output: 8192 },
        modalities: { input: ['text'], output: ['text'] },
      },
    },
  }
  if (setActive) config.model = `${ROUTER_PROVIDER_ID}/${ROUTER_MODEL_ID}`
  return config.model
}

async function getRuntimeConfig(client, directory) {
  const response = await client.config.get({ query: { directory } })
  return response?.data || {}
}

async function updateRuntimeConfig(client, directory, config) {
  await client.config.update({ query: { directory }, body: config })
}

async function showToast(client, directory, message, variant = 'info') {
  try {
    await client.tui?.showToast?.({
      query: { directory },
      body: { title: 'FCM', message, variant, duration: 5000 },
    })
  } catch {
    // 📖 Toast support depends on the active OpenCode surface.
  }
}

function parseSelection(args) {
  const raw = String(args || '').trim().toLowerCase()
  if (!raw) return { action: 'list' }
  if (raw === 'best') return { action: 'select', index: 0 }
  if (raw === 'router') return { action: 'router' }
  if (raw === 'status') return { action: 'status' }
  if (raw === 'rescan' || raw === 'scan') return { action: 'list', forceScan: true }
  const index = Number.parseInt(raw, 10)
  if (Number.isInteger(index) && index > 0) return { action: 'select', index: index - 1 }
  return { action: 'help' }
}

function formatSelectionList(result, buggedModelRefs) {
  const lines = [
    `FCM OpenCode scan (${result.source})`,
    '',
    'Run `/fcm 1`, `/fcm 2`, etc. to switch explicitly, or `/fcm best` for #1.',
    '',
  ]

  for (const [index, model] of result.ranked.slice(0, 10).entries()) {
    const prefix = buggedModelRefs.has(getModelRef(model)) ? '🔴 BUGGED — ' : ''
    lines.push(`${prefix}${formatModelLine(model, index + 1)} → ${getModelRef(model)}`)
  }

  return lines.join('\n')
}

function formatStatus(config, cached, buggedModelRefs) {
  const lines = [
    'FCM OpenCode status',
    '',
    `Active OpenCode model: ${config.model || 'not set'}`,
    `Cache file: ${CACHE_FILE}`,
    `Cached models: ${cached?.ranked?.length || 0}`,
  ]

  if (cached?.ranked?.length) {
    lines.push('', 'Top cached models:')
    for (const [index, model] of cached.ranked.slice(0, 5).entries()) {
      const bug = buggedModelRefs.has(getModelRef(model)) ? ' 🔴 BUGGED' : ''
      lines.push(`${index + 1}. ${model.label} [${model.providerKey}]${bug}`)
    }
  }

  return lines.join('\n')
}

async function runExplicitScan(client, directory) {
  await showToast(client, directory, 'Scanning free coding models…', 'info')
  const result = await runFcmScan({
    mode: 'auto',
    onStatus: () => {},
    onNotify: async (message, type) => showToast(client, directory, message, type === 'warning' ? 'warning' : 'info'),
  })
  if (result.ranked.length) writeCache(result)
  return result
}

async function getSelectionResult(client, directory, forceScan) {
  if (!forceScan) {
    const cached = readCache()
    if (cached?.ranked?.length) return cached
  }
  return runExplicitScan(client, directory)
}

async function handleFcmCommand(input, output, ctx, buggedModelRefs) {
  const { client, directory } = ctx
  const selection = parseSelection(input.arguments)

  if (selection.action === 'help') {
    output.parts = [{
      type: 'text',
      text: 'FCM usage: `/fcm` list, `/fcm 1` switch, `/fcm best` switch best, `/fcm rescan`, `/fcm router`, `/fcm status`.',
      synthetic: true,
    }]
    return
  }

  if (selection.action === 'status') {
    const config = await getRuntimeConfig(client, directory)
    output.parts = [{ type: 'text', text: formatStatus(config, readCache(), buggedModelRefs), synthetic: true }]
    return
  }

  if (selection.action === 'router') {
    if (!(await isDaemonRunning())) {
      output.parts = [{ type: 'text', text: 'FCM daemon is offline. Start it with `free-coding-models --daemon-bg` first.', synthetic: true }]
      await showToast(client, directory, 'FCM daemon is offline.', 'warning')
      return
    }
    const config = await getRuntimeConfig(client, directory)
    const ref = configureSmartRouter(config, { setActive: true })
    await updateRuntimeConfig(client, directory, config)
    await showToast(client, directory, `Switched to ${ref}`, 'success')
    output.parts = [{ type: 'text', text: `✅ OpenCode now uses ${ref}.`, synthetic: true }]
    return
  }

  const result = await getSelectionResult(client, directory, selection.forceScan || selection.action === 'list')
  if (!result?.ranked?.length) {
    output.parts = [{ type: 'text', text: 'No usable FCM models found for OpenCode. Check API keys with `free-coding-models`.', synthetic: true }]
    await showToast(client, directory, 'No usable FCM models found.', 'warning')
    return
  }

  if (selection.action === 'list') {
    const config = await getRuntimeConfig(client, directory)
    installRankedIntoConfig(config, result.ranked.slice(0, 10), { setActive: false })
    await updateRuntimeConfig(client, directory, config)
    output.parts = [{ type: 'text', text: formatSelectionList(result, buggedModelRefs), synthetic: true }]
    await showToast(client, directory, 'FCM scan finished. Pick with /fcm 1.', 'success')
    return
  }

  const selected = result.ranked[selection.index]
  if (!selected) {
    output.parts = [{ type: 'text', text: `No FCM model at rank ${selection.index + 1}. Run /fcm to list choices.`, synthetic: true }]
    return
  }

  const config = await getRuntimeConfig(client, directory)
  const ref = installModelIntoConfig(config, selected, { setActive: true })
  await updateRuntimeConfig(client, directory, config)
  await showToast(client, directory, `Switched to ${selected.label}`, 'success')
  output.parts = [{
    type: 'text',
    text: `✅ OpenCode model switched to ${ref}\n${formatModelLine(selected, selection.index + 1)}`,
    synthetic: true,
  }]
}

function addFcmCommands(config) {
  if (!config.command || typeof config.command !== 'object') config.command = {}
  config.command.fcm = {
    description: 'Scan/list/switch free coding models with FCM',
    template: 'FCM command handled by the fcm-opencode plugin. Arguments: $ARGUMENTS',
  }
  config.command['fcm-status'] = {
    description: 'Show FCM OpenCode status',
    template: 'FCM status command handled by the fcm-opencode plugin.',
  }
  config.command['fcm-router'] = {
    description: 'Switch OpenCode to the local FCM Smart Router daemon',
    template: 'FCM router command handled by the fcm-opencode plugin.',
  }
}

export const FcmOpenCode = async ({ client, directory }) => {
  const buggedModelRefs = new Set()

  return {
    async config(config) {
      addFcmCommands(config)

      const cached = readCache()
      if (cached?.ranked?.length) {
        installRankedIntoConfig(config, cached.ranked.slice(0, 10), { setActive: false })
        return
      }

      const result = await runFcmScan({ mode: 'daemon', onStatus: () => {} })
      if (result.ranked.length) {
        writeCache(result)
        installRankedIntoConfig(config, result.ranked.slice(0, 10), { setActive: false })
      }
    },

    async event({ event }) {
      if (event.type !== 'session.error') return
      try {
        const config = await getRuntimeConfig(client, directory)
        if (typeof config.model === 'string' && config.model.startsWith('fcm-')) {
          buggedModelRefs.add(config.model)
          await showToast(client, directory, `Model failed: ${config.model}. Run /fcm.`, 'warning')
        }
      } catch {
        // 📖 Error handling is advisory; never crash OpenCode from an event hook.
      }
    },

    async 'command.execute.before'(input, output) {
      const command = String(input.command || '').replace(/^\//, '')
      if (command === 'fcm-status') input.arguments = 'status'
      if (command === 'fcm-router') input.arguments = 'router'
      if (command !== 'fcm' && command !== 'fcm-status' && command !== 'fcm-router') return
      await handleFcmCommand(input, output, { client, directory }, buggedModelRefs)
    },

    async 'shell.env'(_input, output) {
      for (const [providerKey, apiKey] of loadAllApiKeys()) {
        const envName = getFcmEnvName(providerKey)
        process.env[envName] = process.env[envName] || apiKey
        output.env[envName] = apiKey
      }
    },
  }
}

export default FcmOpenCode
