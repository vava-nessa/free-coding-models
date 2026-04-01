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
 *   - Persist the selected model into the tool config before launch so Enter
 *     really means "open this tool on this model right now"
 *   - Keep each launcher isolated so a partial integration does not break others
 *
 *   📖 Goose: writes custom provider JSON + secrets.yaml + updates config.yaml (GOOSE_PROVIDER/GOOSE_MODEL)
 *   📖 Crush: writes crush.json with provider config + models.large/small defaults
 *   📖 Pi: uses --provider/--model CLI flags for guaranteed auto-selection
 *   📖 Aider: writes ~/.aider.conf.yml + passes --model flag
 *
 * @functions
 *   → `resolveLauncherModelId` — choose the provider-specific id for a launch
 *   → `writeGooseConfig` — install provider + set GOOSE_PROVIDER/GOOSE_MODEL in config.yaml
 *   → `writeCrushConfig` — write provider + models.large/small to crush.json
 *   → `prepareExternalToolLaunch` — persist selected-model defaults and compute the launch command
 *   → `startExternalTool` — configure and launch the selected external tool mode
 *
 * @exports resolveLauncherModelId, buildToolEnv, prepareExternalToolLaunch, startExternalTool
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
import { getApiKey } from './config.js'
import { ENV_VAR_NAMES, isWindows } from './provider-metadata.js'
import { getToolMeta, TOOL_METADATA } from './tool-metadata.js'
import { PROVIDER_METADATA } from './provider-metadata.js'
import { resolveToolBinaryPath } from './tool-bootstrap.js'

const OPENAI_COMPAT_ENV_KEYS = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_MODEL',
  'LLM_API_KEY',
  'LLM_BASE_URL',
  'LLM_MODEL',
]
const SANITIZED_TOOL_ENV_KEYS = [...OPENAI_COMPAT_ENV_KEYS]

function ensureDir(filePath) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function getDefaultToolPaths(homeDir = homedir()) {
  return {
    aiderConfigPath: join(homeDir, '.aider.conf.yml'),
    crushConfigPath: join(homeDir, '.config', 'crush', 'crush.json'),
    gooseProvidersDir: join(homeDir, '.config', 'goose', 'custom_providers'),
    gooseSecretsPath: join(homeDir, '.config', 'goose', 'secrets.yaml'),
    gooseConfigPath: join(homeDir, '.config', 'goose', 'config.yaml'),
    qwenConfigPath: join(homeDir, '.qwen', 'settings.json'),
    ampConfigPath: join(homeDir, '.config', 'amp', 'settings.json'),
    piModelsPath: join(homeDir, '.pi', 'agent', 'models.json'),
    piSettingsPath: join(homeDir, '.pi', 'agent', 'settings.json'),
    openHandsEnvPath: join(homeDir, '.fcm-openhands-env'),
  }
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

function deleteEnvKeys(env, keys) {
  for (const key of keys) delete env[key]
}

function cloneInheritedEnv(inheritedEnv = process.env, sanitizeKeys = []) {
  const env = { ...inheritedEnv }
  deleteEnvKeys(env, sanitizeKeys)
  return env
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

function resolveLaunchCommand(mode, fallbackCommand) {
  return resolveToolBinaryPath(mode) || fallbackCommand
}

/**
 * 📖 resolveLauncherModelId returns the provider-native id used by the direct
 * 📖 launchers. Legacy bridge-specific model remapping has been removed.
 *
 * @param {{ label?: string, modelId?: string }} model
 * @returns {string}
 */
export function resolveLauncherModelId(model) {
  return model?.modelId ?? ''
}

export function buildToolEnv(mode, model, config, options = {}) {
  const {
    sanitize = false,
    includeCompatDefaults = true,
    includeProviderEnv = true,
    inheritedEnv = process.env,
  } = options

  if (config.serveModeActive) {
    const env = cloneInheritedEnv(inheritedEnv, sanitize ? SANITIZED_TOOL_ENV_KEYS : [])
    const proxyUrl = 'http://127.0.0.1:8080/v1'
    const proxyKey = 'nokey-localproxy'
    if (includeCompatDefaults) {
      env.OPENAI_API_KEY = proxyKey
      env.OPENAI_BASE_URL = proxyUrl
      env.OPENAI_API_BASE = proxyUrl
      env.OPENAI_MODEL = model.modelId
    }
    return { env, apiKey: proxyKey, baseUrl: proxyUrl }
  }


  const providerKey = model.providerKey
  const providerUrl = sources[providerKey]?.url || ''
  const baseUrl = getProviderBaseUrl(providerKey)
  const apiKey = sanitize ? (config?.apiKeys?.[providerKey] ?? null) : getApiKey(config, providerKey)
  const env = cloneInheritedEnv(inheritedEnv, sanitize ? SANITIZED_TOOL_ENV_KEYS : [])
  const providerEnvName = ENV_VAR_NAMES[providerKey]
  if (includeProviderEnv && providerEnvName && apiKey) env[providerEnvName] = apiKey

  // 📖 OpenAI-compatible defaults reused by multiple CLIs.
  if (includeCompatDefaults && apiKey && baseUrl) {
    env.OPENAI_API_KEY = apiKey
    env.OPENAI_BASE_URL = baseUrl
    env.OPENAI_API_BASE = baseUrl
    env.OPENAI_MODEL = model.modelId
    env.LLM_API_KEY = apiKey
    env.LLM_BASE_URL = baseUrl
    env.LLM_MODEL = `openai/${model.modelId}`
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

function writeAiderConfig(model, apiKey, baseUrl, paths = getDefaultToolPaths()) {
  const filePath = paths.aiderConfigPath
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

function writeCrushConfig(model, apiKey, baseUrl, providerId, paths = getDefaultToolPaths()) {
  const filePath = paths.crushConfigPath
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, { $schema: 'https://charm.land/crush.json' })
  // 📖 Remove legacy disable_default_providers — it can prevent Crush from auto-selecting models
  if (config.options && config.options.disable_default_providers) {
    delete config.options.disable_default_providers
  }
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
  // 📖 Setting both large AND small ensures Crush auto-selects the model in interactive mode.
  config.models = {
    ...(config.models && typeof config.models === 'object' ? config.models : {}),
    large: { model: model.modelId, provider: providerId },
    small: { model: model.modelId, provider: providerId },
  }
  writeJson(filePath, config)
  return { filePath, backupPath }
}

function writeQwenConfig(model, providerKey, apiKey, baseUrl, paths = getDefaultToolPaths()) {
  const filePath = paths.qwenConfigPath
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

function writePiConfig(model, apiKey, baseUrl, paths = getDefaultToolPaths()) {
  // 📖 Write models.json with the selected provider config
  const modelsFilePath = paths.piModelsPath
  const modelsBackupPath = backupIfExists(modelsFilePath)
  const modelsConfig = readJson(modelsFilePath, { providers: {} })
  if (!modelsConfig.providers || typeof modelsConfig.providers !== 'object') modelsConfig.providers = {}
  modelsConfig.providers.freeCodingModels = {
    baseUrl,
    api: 'openai-completions',
    apiKey,
    models: [{ id: model.modelId, name: model.label }],
  }
  writeJson(modelsFilePath, modelsConfig)

  // 📖 Write settings.json to set the model as default on next launch
  const settingsFilePath = paths.piSettingsPath
  const settingsBackupPath = backupIfExists(settingsFilePath)
  const settingsConfig = readJson(settingsFilePath, {})
  settingsConfig.defaultProvider = 'freeCodingModels'
  settingsConfig.defaultModel = model.modelId
  writeJson(settingsFilePath, settingsConfig)

  return { filePath: modelsFilePath, backupPath: modelsBackupPath, settingsFilePath, settingsBackupPath }
}

// 📖 writeGooseConfig: Install/update the provider in Goose's custom_providers/, set the
// 📖 API key in secrets.yaml, and update config.yaml with GOOSE_PROVIDER + GOOSE_MODEL
// 📖 so Goose auto-selects the model on launch.
function writeGooseConfig(model, apiKey, baseUrl, providerKey, paths = getDefaultToolPaths()) {
  const providerId = `fcm-${providerKey}`
  const providerLabel = PROVIDER_METADATA[providerKey]?.label || sources[providerKey]?.name || providerKey
  const secretEnvName = `FCM_${providerKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`

  // 📖 Step 1: Write custom provider JSON (same format as endpoint-installer)
  const providerFilePath = join(paths.gooseProvidersDir, `${providerId}.json`)
  ensureDir(providerFilePath)
  const providerConfig = {
    name: providerId,
    engine: 'openai',
    display_name: `FCM ${providerLabel}`,
    description: `Managed by free-coding-models for ${providerLabel}`,
    api_key_env: secretEnvName,
    base_url: baseUrl?.endsWith('/chat/completions') ? baseUrl : (baseUrl || ''),
    models: [{ name: model.modelId, context_limit: 128000 }],
    supports_streaming: true,
    requires_auth: true,
  }
  writeFileSync(providerFilePath, JSON.stringify(providerConfig, null, 2) + '\n')

  // 📖 Step 2: Write API key to secrets.yaml (simple key: value format)
  const secretsPath = paths.gooseSecretsPath
  let secretsContent = ''
  if (existsSync(secretsPath)) {
    secretsContent = readFileSync(secretsPath, 'utf8')
  }
  // 📖 Replace existing secret or append new one
  const secretLine = `${secretEnvName}: ${JSON.stringify(apiKey)}`
  const secretRegex = new RegExp(`^${secretEnvName}:.*$`, 'm')
  if (secretRegex.test(secretsContent)) {
    secretsContent = secretsContent.replace(secretRegex, secretLine)
  } else {
    secretsContent = secretsContent.trimEnd() + '\n' + secretLine + '\n'
  }
  ensureDir(secretsPath)
  writeFileSync(secretsPath, secretsContent)

  // 📖 Step 3: Update config.yaml — set GOOSE_PROVIDER and GOOSE_MODEL at top level
  const configPath = paths.gooseConfigPath
  const configBackupPath = backupIfExists(configPath)
  let configContent = ''
  if (existsSync(configPath)) {
    configContent = readFileSync(configPath, 'utf8')
  }
  // 📖 Replace or add GOOSE_PROVIDER line
  if (/^GOOSE_PROVIDER:.*/m.test(configContent)) {
    configContent = configContent.replace(/^GOOSE_PROVIDER:.*/m, `GOOSE_PROVIDER: ${providerId}`)
  } else {
    configContent = `GOOSE_PROVIDER: ${providerId}\n` + configContent
  }
  // 📖 Replace or add GOOSE_MODEL line
  if (/^GOOSE_MODEL:.*/m.test(configContent)) {
    configContent = configContent.replace(/^GOOSE_MODEL:.*/m, `GOOSE_MODEL: ${model.modelId}`)
  } else {
    // 📖 Insert after GOOSE_PROVIDER line
    configContent = configContent.replace(/^(GOOSE_PROVIDER:.*)/m, `$1\nGOOSE_MODEL: ${model.modelId}`)
  }
  writeFileSync(configPath, configContent)

  return { providerFilePath, secretsPath, configPath, configBackupPath }
}

function writeAmpConfig(model, baseUrl, paths = getDefaultToolPaths()) {
  const filePath = paths.ampConfigPath
  const backupPath = backupIfExists(filePath)
  const config = readJson(filePath, {})
  config['amp.url'] = baseUrl
  config['amp.model'] = model.modelId
  writeJson(filePath, config)
  return { filePath, backupPath }
}

function writeOpenHandsEnv(model, apiKey, baseUrl, paths = getDefaultToolPaths()) {
  const filePath = paths.openHandsEnvPath
  const backupPath = backupIfExists(filePath)
  const lines = [
    '# 📖 Managed by free-coding-models',
    `export OPENAI_API_KEY="${apiKey}"`,
    `export OPENAI_BASE_URL="${baseUrl}"`,
    `export OPENAI_MODEL="${model.modelId}"`,
    `export LLM_API_KEY="${apiKey}"`,
    `export LLM_BASE_URL="${baseUrl}"`,
    `export LLM_MODEL="openai/${model.modelId}"`,
  ]
  ensureDir(filePath)
  writeFileSync(filePath, lines.join('\n') + '\n')
  return { filePath, backupPath }
}

/**
 * 📖 writeRovoConfig - Configure Rovo Dev CLI model selection
 *
 * Rovo Dev CLI uses ~/.rovodev/config.yml for configuration.
 * We write the model ID to the config file before launching.
 *
 * @param {Object} model - Selected model with modelId
 * @param {string} configPath - Path to Rovo config file
 * @returns {{ filePath: string, backupPath: string | null }}
 */
function writeRovoConfig(model, configPath = join(homedir(), '.rovodev', 'config.yml')) {
  const backupPath = backupIfExists(configPath)
  const config = {
    agent: {
      modelId: model.modelId,
    },
  }

  ensureDir(configPath)
  writeFileSync(configPath, `agent:\n  modelId: "${model.modelId}"\n`)
  return { filePath: configPath, backupPath }
}

/**
 * 📖 buildGeminiEnv - Build environment variables for Gemini CLI
 *
 * Gemini CLI supports OpenAI-compatible APIs via environment variables:
 * - GEMINI_API_BASE_URL: Custom API endpoint
 * - GEMINI_API_KEY: API key for custom endpoint
 *
 * @param {Object} model - Selected model with providerKey
 * @param {Object} config - Full app config
 * @param {Object} options - Env options
 * @returns {NodeJS.ProcessEnv}
 */
function buildGeminiEnv(model, config, options = {}) {
  const providerKey = model.providerKey || 'gemini'
  const apiKey = getApiKey(config, providerKey)
  const baseUrl = getProviderBaseUrl(providerKey)

  const env = cloneInheritedEnv(process.env, SANITIZED_TOOL_ENV_KEYS)

  // If we have a custom API key and base URL, configure OpenAI-compatible mode
  if (apiKey && baseUrl && options.includeProviderEnv) {
    env.GEMINI_API_BASE_URL = baseUrl
    env.GEMINI_API_KEY = apiKey
  }

  return env
}

function printConfigArtifacts(toolName, artifacts = []) {
  for (const artifact of artifacts) {
    if (!artifact?.path) continue
    const label = artifact.label ? `${artifact.label}: ` : ''
    console.log(chalk.dim(`  📄 ${toolName} ${label}${artifact.path}`))
    if (artifact.backupPath) console.log(chalk.dim(`  💾 Backup: ${artifact.backupPath}`))
  }
}

/**
 * 📖 prepareExternalToolLaunch persists the selected model into the target tool's
 * 📖 config before launch, then returns the exact command/env/args that should
 * 📖 be spawned. This makes launcher behavior unit-testable without requiring
 * 📖 the real CLIs in PATH.
 *
 * @param {string} mode
 * @param {{ providerKey: string, modelId: string, label: string }} model
 * @param {Record<string, unknown>} config
 * @param {{
 *   paths?: Partial<ReturnType<typeof getDefaultToolPaths>>,
 *   inheritedEnv?: NodeJS.ProcessEnv,
 * }} [options]
 * @returns {{
 *   blocked?: boolean,
 *   exitCode?: number,
 *   warnings?: string[],
 *   command?: string,
 *   args?: string[],
 *   env?: NodeJS.ProcessEnv,
 *   apiKey?: string | null,
 *   baseUrl?: string | null,
 *   meta: { label: string, emoji: string, flag: string | null },
 *   configArtifacts: Array<{ path: string, backupPath: string | null, label?: string }>
 * }}
 */
export function prepareExternalToolLaunch(mode, model, config, options = {}) {
  const meta = getToolMeta(mode)
  const paths = { ...getDefaultToolPaths(), ...(options.paths || {}) }
  const { env, apiKey, baseUrl } = buildToolEnv(mode, model, config, {
    inheritedEnv: options.inheritedEnv,
  })

  const isCliOnlyTool = TOOL_METADATA[mode]?.cliOnly === true

  if (!apiKey && mode !== 'amp' && !isCliOnlyTool) {
    const providerRgb = PROVIDER_COLOR[model.providerKey] ?? [105, 190, 245]
    const providerName = sources[model.providerKey]?.name || model.providerKey
    const coloredProviderName = chalk.bold.rgb(...providerRgb)(providerName)
    return {
      blocked: true,
      exitCode: 1,
      warnings: [
        `  ⚠ No API key configured for ${coloredProviderName}.`,
        '  Configure the provider first from the Settings screen (P) or via env vars.',
      ],
      meta,
      configArtifacts: [],
    }
  }

  if (mode === 'aider') {
    const result = writeAiderConfig(model, apiKey, baseUrl, paths)
    return {
      command: 'aider',
      args: ['--model', `openai/${model.modelId}`],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [{ path: result.filePath, backupPath: result.backupPath, label: 'config' }],
    }
  }

  if (mode === 'crush') {
    const launchModelId = resolveLauncherModelId(model)
    applyOpenAiCompatEnv(env, apiKey, baseUrl, launchModelId)
    const result = writeCrushConfig({ ...model, modelId: launchModelId }, apiKey, baseUrl, 'freeCodingModels', paths)
    return {
      command: 'crush',
      args: [],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [{ path: result.filePath, backupPath: result.backupPath, label: 'config' }],
    }
  }

  if (mode === 'goose') {
    const gooseBaseUrl = sources[model.providerKey]?.url || baseUrl || ''
    const gooseModelId = resolveLauncherModelId(model)
    const result = writeGooseConfig({ ...model, modelId: gooseModelId }, apiKey, gooseBaseUrl, model.providerKey, paths)
    env.GOOSE_PROVIDER = `fcm-${model.providerKey}`
    env.GOOSE_MODEL = gooseModelId
    applyOpenAiCompatEnv(env, apiKey, gooseBaseUrl.replace(/\/chat\/completions$/, ''), gooseModelId)
    return {
      command: 'goose',
      args: [],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [
        { path: result.providerFilePath, backupPath: null, label: 'provider' },
        { path: result.secretsPath, backupPath: null, label: 'secrets' },
        { path: result.configPath, backupPath: result.configBackupPath || null, label: 'config' },
      ],
    }
  }

  if (mode === 'qwen') {
    const result = writeQwenConfig(model, model.providerKey, apiKey, baseUrl, paths)
    return {
      command: 'qwen',
      args: [],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [{ path: result.filePath, backupPath: result.backupPath, label: 'config' }],
    }
  }

  if (mode === 'openhands') {
    const result = writeOpenHandsEnv(model, apiKey, baseUrl, paths)
    env.LLM_MODEL = model.modelId
    env.LLM_API_KEY = apiKey || env.LLM_API_KEY
    if (baseUrl) env.LLM_BASE_URL = baseUrl
    return {
      command: 'openhands',
      args: ['--override-with-envs'],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [{ path: result.filePath, backupPath: result.backupPath, label: 'env file' }],
    }
  }

  if (mode === 'amp') {
    const result = writeAmpConfig(model, baseUrl, paths)
    return {
      command: 'amp',
      args: [],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [{ path: result.filePath, backupPath: result.backupPath, label: 'config' }],
    }
  }

  if (mode === 'pi') {
    const result = writePiConfig(model, apiKey, baseUrl, paths)
    return {
      command: 'pi',
      args: ['--provider', 'freeCodingModels', '--model', model.modelId, '--api-key', apiKey],
      env,
      apiKey,
      baseUrl,
      meta,
      configArtifacts: [
        { path: result.filePath, backupPath: result.backupPath, label: 'models' },
        { path: result.settingsFilePath, backupPath: result.settingsBackupPath, label: 'settings' },
      ],
    }
  }

  if (mode === 'rovo') {
    const result = writeRovoConfig(model, join(homedir(), '.rovodev', 'config.yml'), paths)
    console.log(chalk.dim(`  📖 Rovo Dev CLI configured with model: ${model.modelId}`))
    return {
      command: 'acli',
      args: ['rovodev', 'run'],
      env,
      apiKey: null,
      baseUrl: null,
      meta,
      configArtifacts: [{ path: result.filePath, backupPath: result.backupPath, label: 'config' }],
    }
  }

  if (mode === 'gemini') {
    const geminiEnv = buildGeminiEnv(model, config, { includeProviderEnv: options.includeProviderEnv })
    console.log(chalk.dim(`  📖 Gemini CLI will use model: ${model.modelId}`))
    return {
      command: 'gemini',
      args: [],
      env: { ...env, ...geminiEnv },
      apiKey: geminiEnv.GEMINI_API_KEY || null,
      baseUrl: geminiEnv.GEMINI_API_BASE_URL || null,
      meta,
      configArtifacts: [],
    }
  }

  return {
    blocked: true,
    exitCode: 1,
    warnings: [chalk.red(`  X Unsupported external tool mode: ${mode}`)],
    meta,
    configArtifacts: [],
  }
}

export async function startExternalTool(mode, model, config) {
  const launchPlan = prepareExternalToolLaunch(mode, model, config)
  const { meta } = launchPlan

  if (launchPlan.blocked) {
    for (const warning of launchPlan.warnings || []) console.log(warning)
    console.log()
    return launchPlan.exitCode || 1
  }

  console.log(chalk.cyan(`  ▶ Launching ${meta.label} with ${chalk.bold(model.label)}...`))
  printConfigArtifacts(meta.label, launchPlan.configArtifacts)

  if (mode === 'aider') {
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'crush') {
    console.log(chalk.dim('  📖 Crush will use the provider directly for this launch.'))
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'goose') {
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'qwen') {
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'openhands') {
    console.log(chalk.dim(`  📖 OpenHands launched with model: ${model.modelId}`))
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'amp') {
    console.log(chalk.dim(`  📖 Amp config updated with model: ${model.modelId}`))
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'pi') {
    // 📖 Pi supports --provider and --model flags for guaranteed auto-selection
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'rovo') {
    console.log(chalk.dim(`  📖 Launching Rovo Dev CLI in interactive mode...`))
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  if (mode === 'gemini') {
    console.log(chalk.dim(`  📖 Launching Gemini CLI...`))
    return spawnCommand(resolveLaunchCommand(mode, launchPlan.command), launchPlan.args, launchPlan.env)
  }

  console.log(chalk.red(`  X Unsupported external tool mode: ${mode}`))
  return 1
}
