/**
 * @file opencode.js
 * @description OpenCode integration and multi-account proxy lifecycle.
 *
 * @details
 *   This module owns all OpenCode-related behavior:
 *   - Configure opencode.json with selected models/providers
 *   - Launch OpenCode CLI or Desktop
 *   - Manage ZAI proxy bridge for non-standard API paths
 *   - Start/stop the multi-account proxy server (fcm-proxy)
 *   - Auto-start proxy when OpenCode config is already synced
 *
 *   🎯 Key features:
 *   - Provider-aware config setup for OpenCode (NIM, Groq, Cerebras, etc.)
 *   - ZAI proxy bridge to rewrite /v1/* → /api/coding/paas/v4/*
 *   - Auto-pick tmux port for OpenCode sub-agents
 *   - Multi-account proxy with rotation + auto-sync to opencode.json
 *
 *   → Functions:
 *   - `setOpenCodeModelData` — Provide merged model lists for proxy topology
 *   - `startOpenCode` — Launch OpenCode CLI with selected model
 *   - `startOpenCodeDesktop` — Set model and open Desktop app
 *   - `startProxyAndLaunch` — Start fcm-proxy then launch OpenCode
 *   - `autoStartProxyIfSynced` — Auto-start proxy if opencode.json has fcm-proxy
 *   - `ensureProxyRunning` — Ensure proxy is running (start or reuse)
 *   - `isProxyEnabledForConfig` — Check whether proxy mode is opted in
 *
 *   @see src/opencode-sync.js — syncToOpenCode/load/save utilities
 *   @see src/proxy-server.js  — ProxyServer implementation
 */

import chalk from 'chalk'
import { createServer } from 'net'
import { createServer as createHttpServer } from 'http'
import { request as httpsRequest } from 'https'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'
import { copyFileSync, existsSync } from 'fs'
import { sources } from '../sources.js'
import { PROVIDER_COLOR } from './render-table.js'
import { resolveCloudflareUrl } from './ping.js'
import { ProxyServer } from './proxy-server.js'
import { loadOpenCodeConfig, saveOpenCodeConfig, syncToOpenCode } from './opencode-sync.js'
import { getApiKey, getProxySettings, resolveApiKeys } from './config.js'
import { ENV_VAR_NAMES, OPENCODE_MODEL_MAP, isWindows, isMac, isLinux } from './provider-metadata.js'
import { setActiveProxy } from './render-table.js'

// 📖 OpenCode config location: ~/.config/opencode/opencode.json on ALL platforms.
// 📖 OpenCode uses xdg-basedir which resolves to %USERPROFILE%\.config on Windows.
const OPENCODE_CONFIG = join(homedir(), '.config', 'opencode', 'opencode.json')
const OPENCODE_PORT_RANGE_START = 4096
const OPENCODE_PORT_RANGE_END = 5096

// 📖 Module-level proxy state — shared between startProxyAndLaunch and cleanup.
let activeProxy = null
let proxyCleanedUp = false
let exitHandlersRegistered = false

// 📖 Merged model references for proxy topology.
let mergedModelsRef = []
let mergedModelByLabelRef = new Map()

// 📖 setOpenCodeModelData: Provide mergedModels + mergedModelByLabel to this module.
export function setOpenCodeModelData(mergedModels, mergedModelByLabel) {
  mergedModelsRef = Array.isArray(mergedModels) ? mergedModels : []
  mergedModelByLabelRef = mergedModelByLabel instanceof Map ? mergedModelByLabel : new Map()
}

/**
 * 📖 resolveProxyModelId maps a selected provider-specific model to the shared
 * 📖 proxy catalog slug used by `fcm-proxy`. The proxy exposes merged slugs, not
 * 📖 upstream provider ids, so every launcher that targets the proxy must use this.
 *
 * @param {{ label?: string, modelId?: string }} model
 * @returns {string}
 */
export function resolveProxyModelId(model) {
  const merged = mergedModelByLabelRef.get(model?.label)
  return merged?.slug ?? model?.modelId ?? ''
}

// 📖 isTcpPortAvailable: checks if a local TCP port is free for OpenCode.
// 📖 Used to avoid tmux sub-agent port conflicts when multiple projects run in parallel.
function isTcpPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port)
  })
}

// 📖 resolveOpenCodeTmuxPort: selects a safe port for OpenCode when inside tmux.
// 📖 Priority:
// 📖 1) OPENCODE_PORT from env (if valid and available)
// 📖 2) First available port in 4096-5095
async function resolveOpenCodeTmuxPort() {
  const envPortRaw = process.env.OPENCODE_PORT
  const envPort = Number.parseInt(envPortRaw || '', 10)

  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
    if (await isTcpPortAvailable(envPort)) {
      return { port: envPort, source: 'env' }
    }
    console.log(chalk.yellow(`  ⚠ OPENCODE_PORT=${envPort} is already in use; selecting another port for this run.`))
  }

  for (let port = OPENCODE_PORT_RANGE_START; port < OPENCODE_PORT_RANGE_END; port++) {
    if (await isTcpPortAvailable(port)) {
      return { port, source: 'auto' }
    }
  }

  return null
}

function getOpenCodeConfigPath() {
  return OPENCODE_CONFIG
}

// 📖 Map source model IDs to OpenCode built-in IDs when they differ.
function getOpenCodeModelId(providerKey, modelId) {
  if (providerKey === 'nvidia') return modelId.replace(/^nvidia\//, '')
  if (providerKey === 'zai') return modelId.replace(/^zai\//, '')
  return OPENCODE_MODEL_MAP[providerKey]?.[modelId] || modelId
}

// ─── ZAI proxy bridge ─────────────────────────────────────────────────────────

// 📖 createZaiProxy: Localhost reverse proxy bridging ZAI's non-standard API paths
// 📖 to OpenCode's expected /v1/* OpenAI-compatible format.
// 📖 Returns { server, port } — caller must server.close() when done.
async function createZaiProxy(apiKey) {
  const server = createHttpServer((req, res) => {
    let targetPath = req.url
    // 📖 Rewrite /v1/* → /api/coding/paas/v4/*
    if (targetPath.startsWith('/v1/')) {
      targetPath = '/api/coding/paas/v4/' + targetPath.slice(4)
    } else if (targetPath.startsWith('/v1')) {
      targetPath = '/api/coding/paas/v4' + targetPath.slice(3)
    } else {
      // 📖 Non /v1 paths (e.g. /api/v0/ health checks) — reject
      res.writeHead(404)
      res.end()
      return
    }
    const headers = { ...req.headers, host: 'api.z.ai' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`
    // 📖 Remove transfer-encoding to avoid chunked encoding issues with https.request
    delete headers['transfer-encoding']
    const proxyReq = httpsRequest({
      hostname: 'api.z.ai',
      port: 443,
      path: targetPath,
      method: req.method,
      headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', () => { res.writeHead(502); res.end() })
    req.pipe(proxyReq)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return { server, port: server.address().port }
}

// ─── Shared OpenCode spawn helper ─────────────────────────────────────────────

// 📖 spawnOpenCode: Resolve API keys + spawn opencode CLI with correct env.
async function spawnOpenCode(args, providerKey, fcmConfig, existingZaiProxy = null) {
  const envVarName = ENV_VAR_NAMES[providerKey]
  const resolvedKey = getApiKey(fcmConfig, providerKey)
  const childEnv = { ...process.env }
  // 📖 Suppress MaxListenersExceededWarning from @modelcontextprotocol/sdk
  childEnv.NODE_NO_WARNINGS = '1'
  const finalArgs = [...args]
  const hasExplicitPortArg = finalArgs.includes('--port')
  if (envVarName && resolvedKey) childEnv[envVarName] = resolvedKey

  // 📖 ZAI proxy: OpenCode's Go binary doesn't know about ZAI as a provider.
  // 📖 Start proxy if needed, or reuse existing proxy if passed in.
  let zaiProxy = existingZaiProxy
  if (providerKey === 'zai' && resolvedKey && !zaiProxy) {
    const { server, port } = await createZaiProxy(resolvedKey)
    zaiProxy = server
    console.log(chalk.dim(`  🔀 ZAI proxy listening on port ${port} (rewrites /v1/* → ZAI API)`))
  }

  // 📖 In tmux, OpenCode sub-agents need a listening port to open extra panes.
  if (process.env.TMUX && !hasExplicitPortArg) {
    const tmuxPort = await resolveOpenCodeTmuxPort()
    if (tmuxPort) {
      const portValue = String(tmuxPort.port)
      childEnv.OPENCODE_PORT = portValue
      finalArgs.push('--port', portValue)
      if (tmuxPort.source === 'env') {
        console.log(chalk.dim(`  📺 tmux detected — using OPENCODE_PORT=${portValue}.`))
      } else {
        console.log(chalk.dim(`  📺 tmux detected — using OpenCode port ${portValue} for sub-agent panes.`))
      }
    } else {
      console.log(chalk.yellow(`  ⚠ tmux detected but no free OpenCode port found in ${OPENCODE_PORT_RANGE_START}-${OPENCODE_PORT_RANGE_END - 1}; launching without --port.`))
    }
  }

  const { spawn } = await import('child_process')
  const child = spawn('opencode', finalArgs, {
    stdio: 'inherit',
    shell: true,
    detached: false,
    env: childEnv
  })

  return new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (zaiProxy) zaiProxy.close()
      // 📖 ZAI cleanup: remove the ephemeral proxy provider from opencode.json
      if (providerKey === 'zai') {
        try {
          const cfg = loadOpenCodeConfig()
          if (cfg.provider?.zai) delete cfg.provider.zai
          if (typeof cfg.model === 'string' && cfg.model.startsWith('zai/')) delete cfg.model
          saveOpenCodeConfig(cfg)
        } catch { /* best-effort cleanup */ }
      }
      resolve(code)
    })
    child.on('error', (err) => {
      if (zaiProxy) zaiProxy.close()
      if (err.code === 'ENOENT') {
        console.error(chalk.red('\n  X Could not find "opencode" -- is it installed and in your PATH?'))
        console.error(chalk.dim('    Install: npm i -g opencode   or see https://opencode.ai'))
        resolve(1)
      } else {
        reject(err)
      }
    })
  })
}

// ─── Start OpenCode CLI ───────────────────────────────────────────────────────

export async function startOpenCode(model, fcmConfig) {
  const providerKey = model.providerKey ?? 'nvidia'
  const ocModelId = getOpenCodeModelId(providerKey, model.modelId)
  const modelRef = `${providerKey}/${ocModelId}`

  if (providerKey === 'nvidia') {
    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    if (!config.provider) config.provider = {}
    if (!config.provider.nvidia) {
      config.provider.nvidia = {
        npm: '@ai-sdk/openai-compatible',
        name: 'NVIDIA NIM',
        options: {
          baseURL: 'https://integrate.api.nvidia.com/v1',
          apiKey: '{env:NVIDIA_API_KEY}'
        },
        models: {}
      }
      // 📖 Color provider name the same way as in the main table
      const providerRgb = PROVIDER_COLOR['nvidia'] ?? [105, 190, 245]
      const coloredNimName = chalk.bold.rgb(...providerRgb)('NVIDIA NIM')
      console.log(chalk.green(`  + Auto-configured ${coloredNimName} provider in OpenCode`))
    }

    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    config.model = modelRef
    if (!config.provider.nvidia.models) config.provider.nvidia.models = {}
    config.provider.nvidia.models[ocModelId] = { name: model.label }

    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Starting OpenCode...'))
    console.log()

    await spawnOpenCode(['--model', modelRef], providerKey, fcmConfig)
    return
  }

  if (providerKey === 'replicate') {
    console.log(chalk.yellow('  Replicate models are monitor-only for now in OpenCode mode.'))
    console.log(chalk.dim('    Reason: Replicate uses /v1/predictions instead of OpenAI chat-completions.'))
    console.log(chalk.dim('    You can still benchmark this model in the TUI and use other providers for OpenCode launch.'))
    console.log()
    return
  }

  if (providerKey === 'zai') {
    const resolvedKey = getApiKey(fcmConfig, providerKey)
    if (!resolvedKey) {
      console.log(chalk.yellow('  ZAI API key not found. Set ZAI_API_KEY environment variable.'))
      console.log()
      return
    }

    const { server: zaiProxyServer, port: zaiProxyPort } = await createZaiProxy(resolvedKey)
    console.log(chalk.dim(`  ZAI proxy listening on port ${zaiProxyPort} (rewrites /v1/* -> ZAI API)`))

    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    if (!config.provider) config.provider = {}
    config.provider.zai = {
      npm: '@ai-sdk/openai-compatible',
      name: 'ZAI',
      options: {
        baseURL: `http://127.0.0.1:${zaiProxyPort}/v1`,
        apiKey: 'zai-proxy',
      },
      models: {}
    }
    config.provider.zai.models[ocModelId] = { name: model.label }
    config.model = modelRef

    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Starting OpenCode...'))
    console.log()

    await spawnOpenCode(['--model', modelRef], providerKey, fcmConfig, zaiProxyServer)
    return
  }

  console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default...`))
  console.log(chalk.dim(`  Model: ${modelRef}`))
  console.log()

  const config = loadOpenCodeConfig()
  const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

  if (existsSync(getOpenCodeConfigPath())) {
    copyFileSync(getOpenCodeConfigPath(), backupPath)
    console.log(chalk.dim(`  Backup: ${backupPath}`))
  }

  if (!config.provider) config.provider = {}
  if (!config.provider[providerKey]) {
    if (providerKey === 'groq') {
      config.provider.groq = { options: { apiKey: '{env:GROQ_API_KEY}' }, models: {} }
    } else if (providerKey === 'cerebras') {
      config.provider.cerebras = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Cerebras',
        options: { baseURL: 'https://api.cerebras.ai/v1', apiKey: '{env:CEREBRAS_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'sambanova') {
      config.provider.sambanova = {
        npm: '@ai-sdk/openai-compatible',
        name: 'SambaNova',
        options: { baseURL: 'https://api.sambanova.ai/v1', apiKey: '{env:SAMBANOVA_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'openrouter') {
      config.provider.openrouter = {
        npm: '@ai-sdk/openai-compatible',
        name: 'OpenRouter',
        options: { baseURL: 'https://openrouter.ai/api/v1', apiKey: '{env:OPENROUTER_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'huggingface') {
      config.provider.huggingface = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Hugging Face Inference',
        options: { baseURL: 'https://router.huggingface.co/v1', apiKey: '{env:HUGGINGFACE_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'deepinfra') {
      config.provider.deepinfra = {
        npm: '@ai-sdk/openai-compatible',
        name: 'DeepInfra',
        options: { baseURL: 'https://api.deepinfra.com/v1/openai', apiKey: '{env:DEEPINFRA_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'fireworks') {
      config.provider.fireworks = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Fireworks AI',
        options: { baseURL: 'https://api.fireworks.ai/inference/v1', apiKey: '{env:FIREWORKS_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'codestral') {
      config.provider.codestral = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Mistral Codestral',
        options: { baseURL: 'https://api.mistral.ai/v1', apiKey: '{env:CODESTRAL_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'hyperbolic') {
      config.provider.hyperbolic = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Hyperbolic',
        options: { baseURL: 'https://api.hyperbolic.xyz/v1', apiKey: '{env:HYPERBOLIC_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'scaleway') {
      config.provider.scaleway = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Scaleway',
        options: { baseURL: 'https://api.scaleway.ai/v1', apiKey: '{env:SCALEWAY_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'googleai') {
      config.provider.googleai = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Google AI Studio',
        options: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '{env:GOOGLE_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'siliconflow') {
      config.provider.siliconflow = {
        npm: '@ai-sdk/openai-compatible',
        name: 'SiliconFlow',
        options: { baseURL: 'https://api.siliconflow.com/v1', apiKey: '{env:SILICONFLOW_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'together') {
      config.provider.together = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Together AI',
        options: { baseURL: 'https://api.together.xyz/v1', apiKey: '{env:TOGETHER_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'cloudflare') {
      const cloudflareAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
      if (!cloudflareAccountId) {
        console.log(chalk.yellow('  Cloudflare Workers AI requires CLOUDFLARE_ACCOUNT_ID for OpenCode integration.'))
        console.log(chalk.dim('    Export CLOUDFLARE_ACCOUNT_ID and retry this selection.'))
        console.log()
        return
      }
      config.provider.cloudflare = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Cloudflare Workers AI',
        options: { baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`, apiKey: '{env:CLOUDFLARE_API_TOKEN}' },
        models: {}
      }
    } else if (providerKey === 'perplexity') {
      config.provider.perplexity = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Perplexity API',
        options: { baseURL: 'https://api.perplexity.ai', apiKey: '{env:PERPLEXITY_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'iflow') {
      config.provider.iflow = {
        npm: '@ai-sdk/openai-compatible',
        name: 'iFlow',
        options: { baseURL: 'https://apis.iflow.cn/v1', apiKey: '{env:IFLOW_API_KEY}' },
        models: {}
      }
    }
  }

  const isBuiltinMapped = OPENCODE_MODEL_MAP[providerKey]?.[model.modelId]
  if (!isBuiltinMapped) {
    if (!config.provider[providerKey].models) config.provider[providerKey].models = {}
    config.provider[providerKey].models[ocModelId] = { name: model.label }
  }

  config.model = modelRef
  saveOpenCodeConfig(config)

  const savedConfig = loadOpenCodeConfig()
  console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
  console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
  console.log()

  if (savedConfig.model === config.model) {
    console.log(chalk.green(`  Default model set to: ${modelRef}`))
  } else {
    console.log(chalk.yellow(`  Config might not have been saved correctly`))
  }
  console.log()
  console.log(chalk.dim('  Starting OpenCode...'))
  console.log()

  await spawnOpenCode(['--model', modelRef], providerKey, fcmConfig)
}

// ─── Proxy lifecycle ─────────────────────────────────────────────────────────

async function cleanupProxy() {
  if (proxyCleanedUp || !activeProxy) return
  proxyCleanedUp = true
  const proxy = activeProxy
  activeProxy = null
  setActiveProxy(activeProxy)
  try {
    await proxy.stop()
  } catch { /* best-effort */ }
}

function registerExitHandlers() {
  if (exitHandlersRegistered) return
  exitHandlersRegistered = true
  const cleanup = () => { cleanupProxy().catch(() => {}) }
  process.once('SIGINT',  cleanup)
  process.once('SIGTERM', cleanup)
  process.once('exit',    cleanup)
}

export function buildProxyTopologyFromConfig(fcmConfig) {
  const accounts = []
  const proxyModels = {}

  for (const merged of mergedModelsRef) {
    proxyModels[merged.slug] = { name: merged.label }

    for (const providerEntry of merged.providers) {
      const keys = resolveApiKeys(fcmConfig, providerEntry.providerKey)
      const providerSource = sources[providerEntry.providerKey]
      if (!providerSource) continue

      const rawUrl = resolveCloudflareUrl(providerSource.url)
      const baseUrl = rawUrl.replace(/\/chat\/completions$/, '')

      keys.forEach((apiKey, keyIdx) => {
        accounts.push({
          id: `${providerEntry.providerKey}/${merged.slug}/${keyIdx}`,
          providerKey: providerEntry.providerKey,
          proxyModelId: merged.slug,
          modelId: providerEntry.modelId,
          url: baseUrl,
          apiKey,
        })
      })
    }
  }

  return { accounts, proxyModels }
}

/**
 * 📖 Proxy mode is opt-in. Both launch-time proxying and persistent sync rely on
 * 📖 this single helper so settings/profile changes behave consistently.
 *
 * @param {object} fcmConfig
 * @returns {boolean}
 */
export function isProxyEnabledForConfig(fcmConfig) {
  return getProxySettings(fcmConfig).enabled === true
}

export async function ensureProxyRunning(fcmConfig, { forceRestart = false } = {}) {
  registerExitHandlers()
  proxyCleanedUp = false

  if (!isProxyEnabledForConfig(fcmConfig)) {
    throw new Error('Proxy mode is disabled in Settings')
  }

  if (forceRestart && activeProxy) {
    await cleanupProxy()
  }

  const existingStatus = activeProxy?.getStatus?.()
  if (existingStatus?.running === true) {
    const availableModelSlugs = new Set(
      (activeProxy._accounts || []).map(a => a.proxyModelId).filter(Boolean)
    )
    return {
      port: existingStatus.port,
      accountCount: existingStatus.accountCount,
      proxyToken: activeProxy?._proxyApiKey,
      proxyModels: null,
      availableModelSlugs,
    }
  }

  const { accounts, proxyModels } = buildProxyTopologyFromConfig(fcmConfig)
  if (accounts.length === 0) {
    throw new Error('No API keys found for proxy-capable models')
  }

  const proxyToken = `fcm_${randomUUID().replace(/-/g, '')}`
  const proxySettings = getProxySettings(fcmConfig)
  const preferredPort = Number.isInteger(proxySettings.preferredPort) ? proxySettings.preferredPort : 0
  const proxy = new ProxyServer({ port: preferredPort, accounts, proxyApiKey: proxyToken })
  const { port } = await proxy.start()
  activeProxy = proxy
  setActiveProxy(activeProxy)

  const availableModelSlugs = new Set(accounts.map(a => a.proxyModelId).filter(Boolean))
  return { port, accountCount: accounts.length, proxyToken, proxyModels, availableModelSlugs }
}

export async function autoStartProxyIfSynced(fcmConfig, state) {
  try {
    const proxySettings = getProxySettings(fcmConfig)
    if (!proxySettings.enabled || !proxySettings.syncToOpenCode) return

    const ocConfig = loadOpenCodeConfig()
    if (!ocConfig?.provider?.['fcm-proxy']) return

    state.proxyStartupStatus = { phase: 'starting' }

    const started = await ensureProxyRunning(fcmConfig)

    syncToOpenCode(fcmConfig, sources, mergedModelsRef, {
      proxyPort: started.port,
      proxyToken: started.proxyToken,
      availableModelSlugs: started.availableModelSlugs,
    })

    state.proxyStartupStatus = {
      phase: 'running',
      port: started.port,
      accountCount: started.accountCount,
    }
  } catch (err) {
    state.proxyStartupStatus = {
      phase: 'failed',
      reason: err?.message ?? String(err),
    }
  }
}

export async function startProxyAndLaunch(model, fcmConfig) {
  try {
    const started = await ensureProxyRunning(fcmConfig, { forceRestart: true })
    const defaultProxyModelId = resolveProxyModelId(model)

    if (!started.proxyModels || Object.keys(started.proxyModels).length === 0) {
      throw new Error('Proxy model catalog is empty')
    }

    console.log(chalk.dim(`  🔀 Multi-account proxy listening on port ${started.port} (${started.accountCount} accounts)`))
    await startOpenCodeWithProxy(model, started.port, defaultProxyModelId, started.proxyModels, fcmConfig, started.proxyToken)
  } catch (err) {
    console.error(chalk.red(`  ✗ Proxy failed to start: ${err.message}`))
    console.log(chalk.dim('  Falling back to direct single-account flow…'))
    await cleanupProxy()
    await startOpenCode(model, fcmConfig)
  }
}

async function startOpenCodeWithProxy(model, port, proxyModelId, proxyModels, fcmConfig, proxyToken) {
  const config = loadOpenCodeConfig()
  if (!config.provider) config.provider = {}
  const previousProxyProvider = config.provider['fcm-proxy']
  const previousModel = config.model

  const fallbackModelId = Object.keys(proxyModels)[0]
  const selectedProxyModelId = proxyModels[proxyModelId] ? proxyModelId : fallbackModelId

  config.provider['fcm-proxy'] = {
    npm: '@ai-sdk/openai-compatible',
    name: 'FCM Proxy',
    options: {
      baseURL: `http://127.0.0.1:${port}/v1`,
      apiKey: proxyToken
    },
    models: proxyModels
  }
  config.model = `fcm-proxy/${selectedProxyModelId}`
  saveOpenCodeConfig(config)

  console.log(chalk.green(`  Setting ${chalk.bold(model.label)} via proxy as default for OpenCode…`))
  console.log(chalk.dim(`  Model: fcm-proxy/${selectedProxyModelId}  •  Proxy: http://127.0.0.1:${port}/v1`))
  console.log(chalk.dim(`  Catalog: ${Object.keys(proxyModels).length} models available via fcm-proxy`))
  console.log()

  try {
    await spawnOpenCode(['--model', `fcm-proxy/${selectedProxyModelId}`], 'fcm-proxy', fcmConfig)
  } finally {
    try {
      const savedCfg = loadOpenCodeConfig()
      if (!savedCfg.provider) savedCfg.provider = {}

      if (previousProxyProvider) {
        savedCfg.provider['fcm-proxy'] = previousProxyProvider
      } else if (savedCfg.provider['fcm-proxy']) {
        delete savedCfg.provider['fcm-proxy']
      }

      if (typeof previousModel === 'string' && previousModel.length > 0) {
        savedCfg.model = previousModel
      } else if (typeof savedCfg.model === 'string' && savedCfg.model.startsWith('fcm-proxy/')) {
        delete savedCfg.model
      }

      saveOpenCodeConfig(savedCfg)
    } catch { /* best-effort */ }
    await cleanupProxy()
  }
}

// ─── Start OpenCode Desktop ───────────────────────────────────────────────────

export async function startOpenCodeDesktop(model, fcmConfig) {
  const providerKey = model.providerKey ?? 'nvidia'
  const ocModelId = getOpenCodeModelId(providerKey, model.modelId)
  const modelRef = `${providerKey}/${ocModelId}`

  const launchDesktop = async () => {
    const { exec } = await import('child_process')
    let command
    if (isMac) {
      command = 'open -a OpenCode'
    } else if (isWindows) {
      command = 'start "" "%LOCALAPPDATA%\\Programs\\OpenCode\\OpenCode.exe" 2>nul || start "" "%PROGRAMFILES%\\OpenCode\\OpenCode.exe" 2>nul || start OpenCode'
    } else if (isLinux) {
      command = `opencode-desktop --model ${modelRef} 2>/dev/null || flatpak run ai.opencode.OpenCode --model ${modelRef} 2>/dev/null || snap run opencode --model ${modelRef} 2>/dev/null || xdg-open /usr/share/applications/opencode.desktop 2>/dev/null || echo "OpenCode not found"`
    }
    exec(command, (err) => {
      if (err) {
        console.error(chalk.red('  Could not open OpenCode Desktop'))
        if (isWindows) {
          console.error(chalk.dim('    Make sure OpenCode is installed from https://opencode.ai'))
        } else if (isLinux) {
          console.error(chalk.dim('    Install via: snap install opencode OR flatpak install ai.opencode.OpenCode'))
          console.error(chalk.dim('    Or download from https://opencode.ai'))
        } else {
          console.error(chalk.dim('    Is it installed at /Applications/OpenCode.app?'))
        }
      }
    })
  }

  if (providerKey === 'nvidia') {
    const config = loadOpenCodeConfig()
    const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

    if (existsSync(getOpenCodeConfigPath())) {
      copyFileSync(getOpenCodeConfigPath(), backupPath)
      console.log(chalk.dim(`  Backup: ${backupPath}`))
    }

    if (!config.provider) config.provider = {}
    if (!config.provider.nvidia) {
      config.provider.nvidia = {
        npm: '@ai-sdk/openai-compatible',
        name: 'NVIDIA NIM',
        options: {
          baseURL: 'https://integrate.api.nvidia.com/v1',
          apiKey: '{env:NVIDIA_API_KEY}'
        },
        models: {}
      }
      // 📖 Color provider name the same way as in the main table
      const providerRgb = PROVIDER_COLOR['nvidia'] ?? [105, 190, 245]
      const coloredNimName = chalk.bold.rgb(...providerRgb)('NVIDIA NIM')
      console.log(chalk.green(`  + Auto-configured ${coloredNimName} provider in OpenCode`))
    }

    console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default for OpenCode Desktop...`))
    console.log(chalk.dim(`  Model: ${modelRef}`))
    console.log()

    config.model = modelRef
    if (!config.provider.nvidia.models) config.provider.nvidia.models = {}
    config.provider.nvidia.models[ocModelId] = { name: model.label }

    saveOpenCodeConfig(config)

    const savedConfig = loadOpenCodeConfig()
    console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
    console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
    console.log()

    if (savedConfig.model === config.model) {
      console.log(chalk.green(`  Default model set to: ${modelRef}`))
    } else {
      console.log(chalk.yellow(`  Config might not have been saved correctly`))
    }
    console.log()
    console.log(chalk.dim('  Opening OpenCode Desktop...'))
    console.log()

    await launchDesktop()
    return
  }

  if (providerKey === 'replicate') {
    console.log(chalk.yellow('  Replicate models are monitor-only for now in OpenCode Desktop mode.'))
    console.log(chalk.dim('    Reason: Replicate uses /v1/predictions instead of OpenAI chat-completions.'))
    console.log(chalk.dim('    You can still benchmark this model in the TUI and use other providers for Desktop launch.'))
    console.log()
    return
  }

  if (providerKey === 'zai') {
    console.log(chalk.yellow('  ZAI models are supported in OpenCode CLI mode only (not Desktop).'))
    console.log(chalk.dim('    Reason: ZAI requires a localhost proxy that only works with the CLI spawn.'))
    console.log(chalk.dim('    Use OpenCode CLI mode (default) to launch ZAI models.'))
    console.log()
    return
  }

  console.log(chalk.green(`  Setting ${chalk.bold(model.label)} as default for OpenCode Desktop...`))
  console.log(chalk.dim(`  Model: ${modelRef}`))
  console.log()

  const config = loadOpenCodeConfig()
  const backupPath = `${getOpenCodeConfigPath()}.backup-${Date.now()}`

  if (existsSync(getOpenCodeConfigPath())) {
    copyFileSync(getOpenCodeConfigPath(), backupPath)
    console.log(chalk.dim(`  Backup: ${backupPath}`))
  }

  if (!config.provider) config.provider = {}
  if (!config.provider[providerKey]) {
    if (providerKey === 'groq') {
      config.provider.groq = { options: { apiKey: '{env:GROQ_API_KEY}' }, models: {} }
    } else if (providerKey === 'cerebras') {
      config.provider.cerebras = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Cerebras',
        options: { baseURL: 'https://api.cerebras.ai/v1', apiKey: '{env:CEREBRAS_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'sambanova') {
      config.provider.sambanova = {
        npm: '@ai-sdk/openai-compatible',
        name: 'SambaNova',
        options: { baseURL: 'https://api.sambanova.ai/v1', apiKey: '{env:SAMBANOVA_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'openrouter') {
      config.provider.openrouter = {
        npm: '@ai-sdk/openai-compatible',
        name: 'OpenRouter',
        options: { baseURL: 'https://openrouter.ai/api/v1', apiKey: '{env:OPENROUTER_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'huggingface') {
      config.provider.huggingface = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Hugging Face Inference',
        options: { baseURL: 'https://router.huggingface.co/v1', apiKey: '{env:HUGGINGFACE_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'deepinfra') {
      config.provider.deepinfra = {
        npm: '@ai-sdk/openai-compatible',
        name: 'DeepInfra',
        options: { baseURL: 'https://api.deepinfra.com/v1/openai', apiKey: '{env:DEEPINFRA_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'fireworks') {
      config.provider.fireworks = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Fireworks AI',
        options: { baseURL: 'https://api.fireworks.ai/inference/v1', apiKey: '{env:FIREWORKS_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'codestral') {
      config.provider.codestral = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Mistral Codestral',
        options: { baseURL: 'https://api.mistral.ai/v1', apiKey: '{env:CODESTRAL_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'hyperbolic') {
      config.provider.hyperbolic = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Hyperbolic',
        options: { baseURL: 'https://api.hyperbolic.xyz/v1', apiKey: '{env:HYPERBOLIC_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'scaleway') {
      config.provider.scaleway = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Scaleway',
        options: { baseURL: 'https://api.scaleway.ai/v1', apiKey: '{env:SCALEWAY_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'googleai') {
      config.provider.googleai = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Google AI Studio',
        options: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '{env:GOOGLE_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'siliconflow') {
      config.provider.siliconflow = {
        npm: '@ai-sdk/openai-compatible',
        name: 'SiliconFlow',
        options: { baseURL: 'https://api.siliconflow.com/v1', apiKey: '{env:SILICONFLOW_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'together') {
      config.provider.together = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Together AI',
        options: { baseURL: 'https://api.together.xyz/v1', apiKey: '{env:TOGETHER_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'cloudflare') {
      const cloudflareAccountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
      if (!cloudflareAccountId) {
        console.log(chalk.yellow('  Cloudflare Workers AI requires CLOUDFLARE_ACCOUNT_ID for OpenCode integration.'))
        console.log(chalk.dim('    Export CLOUDFLARE_ACCOUNT_ID and retry this selection.'))
        console.log()
        return
      }
      config.provider.cloudflare = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Cloudflare Workers AI',
        options: { baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`, apiKey: '{env:CLOUDFLARE_API_TOKEN}' },
        models: {}
      }
    } else if (providerKey === 'perplexity') {
      config.provider.perplexity = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Perplexity API',
        options: { baseURL: 'https://api.perplexity.ai', apiKey: '{env:PERPLEXITY_API_KEY}' },
        models: {}
      }
    } else if (providerKey === 'iflow') {
      config.provider.iflow = {
        npm: '@ai-sdk/openai-compatible',
        name: 'iFlow',
        options: { baseURL: 'https://apis.iflow.cn/v1', apiKey: '{env:IFLOW_API_KEY}' },
        models: {}
      }
    }
  }

  const isBuiltinMapped = OPENCODE_MODEL_MAP[providerKey]?.[model.modelId]
  if (!isBuiltinMapped) {
    if (!config.provider[providerKey].models) config.provider[providerKey].models = {}
    config.provider[providerKey].models[ocModelId] = { name: model.label }
  }

  config.model = modelRef
  saveOpenCodeConfig(config)

  const savedConfig = loadOpenCodeConfig()
  console.log(chalk.dim(`  Config saved to: ${getOpenCodeConfigPath()}`))
  console.log(chalk.dim(`  Default model in config: ${savedConfig.model || 'NOT SET'}`))
  console.log()

  if (savedConfig.model === config.model) {
    console.log(chalk.green(`  Default model set to: ${modelRef}`))
  } else {
    console.log(chalk.yellow(`  Config might not have been saved correctly`))
  }
  console.log()
  console.log(chalk.dim('  Opening OpenCode Desktop...'))
  console.log()

  await launchDesktop()
}
