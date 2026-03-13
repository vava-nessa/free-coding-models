/**
 * @file src/tool-launchers.js
 * @description Auto-configure and launch external coding tools from the selected model row.
 *
 * @details
 *   📖 This module extends the existing "pick a model and press Enter" workflow to
 *   external CLIs that can consume OpenAI-compatible or provider-specific settings.
 *
 *   📖 The design is pragmatic:
 *   - Write a small managed config file when the tool's config shape is stable enough
 *   - Always export the runtime environment variables before spawning the tool
 *   - Keep each launcher isolated so a partial integration does not break others
 *
 *   📖 Some tools still have weaker official support for arbitrary custom providers.
 *   For those, we prefer a transparent warning over pretending the integration is
 *   fully official. The user still gets a reproducible env/config handoff.
 *
 * @functions
 *   → `resolveLauncherModelId` — choose the provider-specific id or proxy slug for a launch
 *   → `startExternalTool` — configure and launch the selected external tool mode
 *
 * @exports resolveLauncherModelId, startExternalTool
 *
 * @see src/tool-metadata.js
 * @see src/provider-metadata.js
 * @see sources.js
 */

import chalk from 'chalk'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { spawn } from 'child_process'
import { sources } from '../sources.js'
import { PROVIDER_COLOR } from './render-table.js'
import { getApiKey, getProxySettings } from './config.js'
import { ENV_VAR_NAMES, isWindows } from './provider-metadata.js'
import { getToolMeta } from './tool-metadata.js'
import { ensureProxyRunning, resolveProxyModelId } from './opencode.js'

function ensureDir(filePath) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function backupIfExists(filePath) {
  if (!existsSync(filePath)) return null
  const backupPath = `${filePath}.backup-${Date.now()}`
  copyFileSync(filePath, backupPath)
  return backupPath
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(filePath, value) {
  ensureDir(filePath)
  writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function getProviderBaseUrl(providerKey) {
  const url = sources[providerKey]?.url
  if (!url) return null
  return url
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/predictions$/i, '')
}

function applyOpenAiCompatEnv(env, apiKey, baseUrl, modelId) {
  if (!apiKey || !baseUrl || !modelId) return env
  env.OPENAI_API_KEY = apiKey
  env.OPENAI_BASE_URL = baseUrl
  env.OPENAI_API_BASE = baseUrl
  env.OPENAI_MODEL = modelId
  env.LLM_API_KEY = apiKey
  env.LLM_BASE_URL = baseUrl
  env.LLM_MODEL = `openai/${modelId}`
  return env
}

/**
 * 📖 resolveLauncherModelId keeps proxy-backed launches on the universal
 * 📖 `fcm-proxy` catalog slug instead of leaking a provider-specific upstream id.
 *
 * @param {{ label?: string, modelId?: string }} model
 * @param {boolean} useProxy
 * @returns {string}
 */
export function resolveLauncherModelId(model, useProxy = false) {
  if (useProxy) return resolveProxyModelId(model)
  return model?.modelId ?? ''
}

function buildToolEnv(mode, model, config) {
  const providerKey = model.providerKey
  const providerUrl = sources[providerKey]?.url || ''
  const baseUrl = getProviderBaseUrl(providerKey)
  const apiKey = getApiKey(config, providerKey)
  const env = { ...process.env }
  const providerEnvName = ENV_VAR_NAMES[providerKey]
  if (providerEnvName && apiKey) env[providerEnvName] = apiKey

  // 📖 OpenAI-compatible defaults reused by multiple CLIs.
  if (apiKey && baseUrl) {
    env.OPENAI_API_KEY = apiKey
    env.OPENAI_BASE_URL = baseUrl
    env.OPENAI_API_BASE = baseUrl
    env.OPENAI_MODEL = model.modelId
    env.LLM_API_KEY = apiKey
    env.LLM_BASE_URL = baseUrl
    env.LLM_MODEL = `openai/${model.modelId}`
  }

  // 📖 Provider-specific envs for tools that expect a different wire format.
  if (mode === 'claude-code' && apiKey && baseUrl) {
    env.ANTHROPIC_AUTH_TOKEN = apiKey
    env.ANTHROPIC_BASE_URL = baseUrl
    env.ANTHROPIC_MODEL = model.modelId
  }

  if (mode === 'gemini' && apiKey && baseUrl) {
    env.GOOGLE_API_KEY = apiKey
    env.GOOGLE_GEMINI_BASE_URL = baseUrl
  }

  return { env, apiKey, baseUrl, providerUrl }
}

function spawnCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: isWindows,
      detached: false,
      env,
    })

    child.on('exit', (code) => resolve(code))
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error(chalk.red(`  X Could not find "${command}" in PATH.`))
        resolve(1)
      } else {
        reject(err)
      }
    })
  })
}

function writeAiderConfig(model, apiKey, baseUrl) {
  const filePath = join(homedir(), '.aider.conf.yml')
  const backupPath = backupIfExists(filePath)
  const content = [
    '# 📖 Managed by free-coding-models',
    `openai-api-base: ${baseUrl}`,
    `openai-api-key: ${apiKey}`,
    `model: openai/${model.modelId}`,
    '',
  ].join('\n')
  ensureDir(filePath)
  writeFileSync(filePath, content)
  return { filePath, backupPath }
}

function writeCrushConfig(model, apiKey, baseUrl, providerId) {
  const filePath = join(homedir(), '.config', 'crush', 'crush.json')
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, { $schema: 'https://charm.land/crush.json' })
  if (!config.options || typeof config.options !== 'object') config.options = {}
  config.options.disable_default_providers = true
  if (!config.providers || typeof config.providers !== 'object') config.providers = {}
  config.providers[providerId] = {
    name: 'Free Coding Models',
    type: 'openai-compat',
    base_url: baseUrl,
    api_key: apiKey,
    models: [
      {
        name: model.label,
        id: model.modelId,
      },
    ],
  }
  // 📖 Crush expects structured selected models at config.models.{large,small}.
  // 📖 Root `crush` reads these defaults in interactive mode, unlike `crush run --model`.
  config.models = {
    ...(config.models && typeof config.models === 'object' ? config.models : {}),
    large: { model: model.modelId, provider: providerId },
  }
  writeJson(filePath, config)
  return { filePath, backupPath }
}

function writeGeminiConfig(model) {
  const filePath = join(homedir(), '.gemini', 'settings.json')
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, {})
  config.model = model.modelId
  writeJson(filePath, config)
  return { filePath, backupPath }
}

function writeQwenConfig(model, providerKey, apiKey, baseUrl) {
  const filePath = join(homedir(), '.qwen', 'settings.json')
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, {})
  if (!config.modelProviders || typeof config.modelProviders !== 'object') config.modelProviders = {}
  if (!Array.isArray(config.modelProviders.openai)) config.modelProviders.openai = []
  const nextEntry = {
    id: model.modelId,
    name: model.label,
    envKey: ENV_VAR_NAMES[providerKey] || 'OPENAI_API_KEY',
    baseUrl,
  }
  const filtered = config.modelProviders.openai.filter((entry) => entry?.id !== model.modelId)
  filtered.unshift(nextEntry)
  config.modelProviders.openai = filtered
  config.model = model.modelId
  writeJson(filePath, config)
  return { filePath, backupPath, envKey: nextEntry.envKey, apiKey }
}

function writePiConfig(model, apiKey, baseUrl) {
  const filePath = join(homedir(), '.pi', 'agent', 'models.json')
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, { providers: {} })
  if (!config.providers || typeof config.providers !== 'object') config.providers = {}
  config.providers.freeCodingModels = {
    baseUrl,
    api: 'openai-completions',
    apiKey,
    models: [{ id: model.modelId, name: model.label }],
  }
  writeJson(filePath, config)
  return { filePath, backupPath }
}

function writeAmpConfig(baseUrl) {
  const filePath = join(homedir(), '.config', 'amp', 'settings.json')
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, {})
  config['amp.url'] = baseUrl
  writeJson(filePath, config)
  return { filePath, backupPath }
}

function printConfigResult(toolName, result) {
  if (!result?.filePath) return
  console.log(chalk.dim(`  📄 ${toolName} config updated: ${result.filePath}`))
  if (result.backupPath) console.log(chalk.dim(`  💾 Backup: ${result.backupPath}`))
}

export async function startExternalTool(mode, model, config) {
  const meta = getToolMeta(mode)
  const { env, apiKey, baseUrl } = buildToolEnv(mode, model, config)
  const proxySettings = getProxySettings(config)

  if (!apiKey && mode !== 'amp') {
    // 📖 Color provider name the same way as in the main table
    const providerRgb = PROVIDER_COLOR[model.providerKey] ?? [105, 190, 245]
    const providerName = sources[model.providerKey]?.name || model.providerKey
    const coloredProviderName = chalk.bold.rgb(...providerRgb)(providerName)
    console.log(chalk.yellow(`  ⚠ No API key configured for ${coloredProviderName}.`))
    console.log(chalk.dim('  Configure the provider first from the Settings screen (P) or via env vars.'))
    console.log()
    return 1
  }

  console.log(chalk.cyan(`  ▶ Launching ${meta.label} with ${chalk.bold(model.label)}...`))

  if (mode === 'aider') {
    printConfigResult(meta.label, writeAiderConfig(model, apiKey, baseUrl))
    return spawnCommand('aider', ['--model', `openai/${model.modelId}`], env)
  }

  if (mode === 'crush') {
    let crushApiKey = apiKey
    let crushBaseUrl = baseUrl
    let providerId = 'freeCodingModels'
    let launchModelId = resolveLauncherModelId(model, false)

    if (proxySettings.enabled) {
      const started = await ensureProxyRunning(config)
      crushApiKey = started.proxyToken
      crushBaseUrl = `http://127.0.0.1:${started.port}/v1`
      providerId = 'freeCodingModelsProxy'
      launchModelId = resolveLauncherModelId(model, true)
      console.log(chalk.dim(`  📖 Crush will use the local FCM proxy on :${started.port} for this launch.`))
    } else {
      console.log(chalk.dim('  📖 Crush will use the provider directly for this launch.'))
    }

    const launchModel = { ...model, modelId: launchModelId }
    applyOpenAiCompatEnv(env, crushApiKey, crushBaseUrl, launchModelId)
    printConfigResult(meta.label, writeCrushConfig(launchModel, crushApiKey, crushBaseUrl, providerId))
    return spawnCommand('crush', [], env)
  }

  if (mode === 'goose') {
    let gooseBaseUrl = baseUrl
    let gooseApiKey = apiKey
    let gooseModelId = resolveLauncherModelId(model, false)

    if (proxySettings.enabled) {
      const started = await ensureProxyRunning(config)
      gooseApiKey = started.proxyToken
      gooseBaseUrl = `http://127.0.0.1:${started.port}/v1`
      gooseModelId = resolveLauncherModelId(model, true)
      applyOpenAiCompatEnv(env, gooseApiKey, gooseBaseUrl, gooseModelId)
      console.log(chalk.dim(`  📖 Goose will use the local FCM proxy on :${started.port} for this launch.`))
    }

    env.OPENAI_HOST = gooseBaseUrl
    env.OPENAI_BASE_PATH = 'v1/chat/completions'
    env.OPENAI_MODEL = gooseModelId
    console.log(chalk.dim(`  📖 Goose uses env-based OpenAI-compatible configuration for ${proxySettings.enabled ? 'the proxy' : 'this provider'} launch.`))
    return spawnCommand('goose', [], env)
  }

  if (mode === 'claude-code') {
    console.log(chalk.yellow('  ⚠ Claude Code expects an Anthropic/Bedrock/Vertex-compatible gateway.'))
    console.log(chalk.dim('  This launch passes proxy env vars, but your endpoint must support Claude Code wire semantics.'))
    return spawnCommand('claude', ['--model', model.modelId], env)
  }

  if (mode === 'codex') {
    console.log(chalk.dim('  📖 Codex CLI is launched with proxy env vars for this session.'))
    return spawnCommand('codex', ['--model', model.modelId], env)
  }

  if (mode === 'gemini') {
    printConfigResult(meta.label, writeGeminiConfig(model))
    return spawnCommand('gemini', ['--model', model.modelId], env)
  }

  if (mode === 'qwen') {
    printConfigResult(meta.label, writeQwenConfig(model, model.providerKey, apiKey, baseUrl))
    return spawnCommand('qwen', [], env)
  }

  if (mode === 'openhands') {
    console.log(chalk.dim('  📖 OpenHands is launched with --override-with-envs so the selected model applies immediately.'))
    return spawnCommand('openhands', ['--override-with-envs'], env)
  }

  if (mode === 'amp') {
    printConfigResult(meta.label, writeAmpConfig(baseUrl))
    console.log(chalk.yellow('  ⚠ Amp does not officially expose arbitrary model switching like the other CLIs.'))
    console.log(chalk.dim('  The proxy URL is written, then Amp is launched so you can reuse the current endpoint.'))
    return spawnCommand('amp', [], env)
  }

  if (mode === 'pi') {
    printConfigResult(meta.label, writePiConfig(model, apiKey, baseUrl))
    return spawnCommand('pi', [], env)
  }

  console.log(chalk.red(`  X Unsupported external tool mode: ${mode}`))
  return 1
}
