/**
 * @file index.js
 * @description OpenCode plugin adapter for free-coding-models.
 *
 * @details
 *   This adapter keeps OpenCode startup lightweight: it only reads the FCM
 *   cache or daemon during config loading, and performs direct provider probes
 *   only when the user explicitly runs `/fcm`. The scan/ranking/cache/key/
 *   provider-descriptor logic is shared with the Pi adapter via `fcm-agent-core`,
 *   so this file owns only OpenCode-specific concerns: config mutation
 *   (`config.provider` / `config.model`), command hooks, toasts, and shell env.
 *
 *   Switching is always explicit: listing models does NOT switch; `/fcm 1`,
 *   `/fcm best`, or `/fcm router` does.
 *
 * @exports FcmOpenCode, default
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  scanBestFcmModel,
  createCacheStore,
  formatModelLine,
  isDaemonRunning,
  loadAllApiKeys,
  getProviderId,
  getOpenCodeEnvName,
  buildOpenCodeProviderDescriptor,
  buildSmartRouterDescriptor,
} from '../fcm-agent-core/src/index.js'

const CACHE_FILE = join(homedir(), '.cache', 'free-coding-models', 'fcm-opencode-cache.json')
const LEGACY_PI_CACHE_FILE = join(homedir(), '.pi', 'agent', 'fcm-cache.json')

/**
 * 📖 One shared cache store for this OpenCode adapter. Reads its own cache first,
 * 📖 then falls back to the Pi cache location so a scan done in either tool helps
 * 📖 the other.
 */
const cache = createCacheStore({ filePath: CACHE_FILE, legacyPaths: [LEGACY_PI_CACHE_FILE] })

function getModelRef(model) {
  return `${getProviderId(model.providerKey)}/${model.modelId}`
}

/**
 * 📖 Inject one FCM model into an OpenCode config object (provider + model).
 * 📖 The API key is referenced via env placeholder (`{env:NAME}`), never inlined,
 * 📖 so it never leaks into config files or logs. The real key is exported into
 * 📖 process.env so OpenCode can resolve it.
 */
function installModelIntoConfig(config, model, { setActive = false } = {}) {
  if (!config.provider || typeof config.provider !== 'object') config.provider = {}

  const desc = buildOpenCodeProviderDescriptor(model)
  if (model.apiKey && !process.env[desc.envName]) process.env[desc.envName] = model.apiKey

  const provider = config.provider[desc.providerId] || {
    npm: '@ai-sdk/openai-compatible',
    name: desc.provider.name,
    env: [],
    options: {},
    models: {},
  }

  provider.npm = '@ai-sdk/openai-compatible'
  provider.name = desc.provider.name
  provider.env = Array.from(new Set([...(provider.env || []), desc.envName]))
  provider.options = { ...provider.options, ...desc.provider.options }
  provider.models = { ...(provider.models || {}), ...desc.provider.models }

  config.provider[desc.providerId] = provider
  if (setActive) config.model = desc.modelRef
  return desc.modelRef
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

/**
 * 📖 Switch OpenCode config to the local FCM Smart Router daemon.
 */
function configureSmartRouter(config, { setActive = true } = {}) {
  if (!config.provider || typeof config.provider !== 'object') config.provider = {}
  const desc = buildSmartRouterDescriptor({ target: 'opencode' })
  config.provider[desc.providerId] = desc.provider
  if (setActive) config.model = desc.modelRef
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
  const result = await scanBestFcmModel({
    mode: 'auto',
    target: 'opencode',
    onNotify: async (message, type) => showToast(client, directory, message, type === 'warning' ? 'warning' : 'info'),
  })
  if (result.ranked.length) cache.write(result)
  return result
}

async function getSelectionResult(client, directory, forceScan) {
  if (!forceScan) {
    const cached = cache.read()
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
    output.parts = [{ type: 'text', text: formatStatus(config, cache.read(), buggedModelRefs), synthetic: true }]
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

/**
 * 📖 OpenCode plugin factory.
 *
 * @param {object} ctx - OpenCode plugin context ({ client, directory })
 */
export const FcmOpenCode = async ({ client, directory }) => {
  const buggedModelRefs = new Set()

  return {
    async config(config) {
      addFcmCommands(config)

      // 📖 Startup is light: cache first, daemon second, never a direct scan.
      const cached = cache.read()
      if (cached?.ranked?.length) {
        installRankedIntoConfig(config, cached.ranked.slice(0, 10), { setActive: false })
        return
      }

      const result = await scanBestFcmModel({ mode: 'daemon', target: 'opencode' })
      if (result.ranked.length) {
        cache.write(result)
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
      // 📖 Export every resolved FCM API key into the shell env by its FCM_*_API_KEY
      // 📖 name, so OpenCode providers can reference `{env:FCM_<PROVIDER>_API_KEY}`.
      for (const [providerKey, apiKey] of loadAllApiKeys()) {
        const envName = getOpenCodeEnvName(providerKey)
        process.env[envName] = process.env[envName] || apiKey
        output.env[envName] = apiKey
      }
    },
  }
}

export default FcmOpenCode
