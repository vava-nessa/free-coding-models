import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { CONFIG_PATH, ENV_VARS } from '../src/core/config.js'

function configExists() {
  if (!existsSync(CONFIG_PATH)) return false
  const raw = readFileSync(CONFIG_PATH, 'utf8').trim()
  return raw !== '' && raw !== '{}'
}

if (configExists()) {
  console.log(`Config exists at ${CONFIG_PATH}, skipping generation`)
  process.exit(0)
}

const apiKeys = {}
for (const [providerKey, envVar] of Object.entries(ENV_VARS)) {
  const candidates = Array.isArray(envVar) ? envVar : [envVar]
  for (const candidate of candidates) {
    const value = process.env[candidate]
    if (value && typeof value === 'string' && value.trim()) {
      apiKeys[providerKey] = value.trim()
      break
    }
  }
}

const config = {
  apiKeys,
  providers: {},
  settings: {
    hideUnconfiguredModels: true,
    favoritesPinnedAndSticky: false,
    theme: 'auto',
  },
  favorites: [],
  telemetry: { enabled: false, consentVersion: 1 },
  endpointInstalls: [],
  router: { enabled: true },
}

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
console.log(`Generated config at ${CONFIG_PATH} with ${Object.keys(apiKeys).length} provider(s)`)
