/**
 * @file setup.js
 * @description First-run API key setup wizard, extracted from bin/free-coding-models.js.
 *
 * @details
 *   `promptApiKey` is the interactive first-time setup wizard shown when NO provider has
 *   a key configured yet.  It steps through every configured provider in `sources.js`
 *   sequentially, displaying the signup URL and a hint, then asks the user to paste their
 *   key (pressing Enter skips that provider).
 *
 *   The wizard is skipped on subsequent runs because `loadConfig()` finds existing keys in
 *   ~/.free-coding-models.json and the caller (`main()`) only invokes `promptApiKey` when
 *   `Object.values(config.apiKeys).every(v => !v)`.
 *
 *   ⚙️ How it works:
 *   1. Builds a `providers` list from `Object.keys(sources)` so new providers added to
 *      sources.js automatically appear in the wizard without any code changes here.
 *   2. Uses `readline.createInterface` for line-at-a-time input (not raw mode).
 *   3. Asks whether the opt-in startup AI Speed Test should run on every launch.
 *   4. Calls `saveConfig(config)` once after collecting all answers.
 *   5. Returns the nvidia key (or the first entered key) for backward-compatibility with
 *      the `main()` caller that originally checked for `nvidiKey !== null` before continuing.
 *
 * @functions
 *   → promptApiKey(config) — Interactive multi-provider key wizard; returns first found key or null
 *
 * @exports
 *   promptApiKey
 *
 * @see src/provider-metadata.js — PROVIDER_METADATA provides label/color/url/hint per provider
 * @see src/config.js            — saveConfig persists the collected keys
 * @see sources.js               — Object.keys(sources) drives the provider iteration order
 * @see bin/free-coding-models.js — calls promptApiKey when no keys are configured
 */

import chalk from 'chalk'
import { createRequire } from 'module'
import { sources } from '../../sources.js'
import { PROVIDER_METADATA, getProviderBillingNote, getProviderLabelWithBilling } from './provider-metadata.js'
import { saveConfig } from './config.js'

const require = createRequire(import.meta.url)
const readline = require('readline')

/**
 * 📖 promptApiKey: Interactive first-run wizard for multi-provider API key setup.
 * 📖 Shown when NO provider has a key configured yet.
 * 📖 Steps through all configured providers sequentially — each is optional (Enter to skip).
 * 📖 At least one key must be entered to proceed. Keys saved to ~/.free-coding-models.json.
 * 📖 Returns the nvidia key (or null) for backward-compat with the rest of main().
 * @param {Record<string, unknown>} config
 * @returns {Promise<string|null>}
 */
export async function promptApiKey(config) {
  console.log()
  console.log(chalk.bold('  🔑 First-time setup — API keys'))
  console.log(chalk.dim('  Enter keys for any provider you want to use. Press Enter to skip one.'))
  console.log()

  // 📖 Build providers from sources to keep setup in sync with actual supported providers.
  const providers = Object.keys(sources).map((key) => {
    const meta = PROVIDER_METADATA[key] || {}
    return {
      key,
      label: getProviderLabelWithBilling(key, sources[key]?.name || key),
      billingNote: getProviderBillingNote(key),
      color: meta.color || chalk.white,
      url: meta.signupUrl || 'https://example.com',
      hint: meta.signupHint || 'Create API key',
    }
  })

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  // 📖 Ask a single question — returns trimmed string or '' for skip
  const ask = (question) => new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })

  for (const p of providers) {
    console.log(`  ${p.color('●')} ${chalk.bold(p.label)}${p.billingNote ? ' ' + chalk.yellow(p.billingNote) : ''}`)
    console.log(chalk.dim(`    Signup/key page: `) + chalk.cyanBright(p.url))
    console.log(chalk.dim(`    ${p.hint}`))
    const answer = await ask(chalk.dim(`  Enter key (or Enter to skip): `))
    console.log()
    if (answer) {
      config.apiKeys[p.key] = answer
    }
  }

  // 📖 Check at least one key was entered before asking optional behavior questions.
  const anyKey = Object.values(config.apiKeys).some(v => v)
  if (!anyKey) {
    rl.close()
    return null
  }

  console.log(chalk.bold('  ⚡ Startup AI Speed Scan'))
  console.log(chalk.dim('  FCM can automatically run the Ctrl+U benchmark after launch to fill AI Latency + TPS.'))
  console.log(chalk.dim('  This uses real provider requests, so it is opt-in and can be changed later in Settings.'))
  const autoBenchmarkAnswer = await ask(chalk.dim('  Run the AI Speed Scan automatically on every launch? (y/N): '))
  if (!config.settings || typeof config.settings !== 'object') config.settings = {}
  config.settings.runAiSpeedTestOnStartup = ['y', 'yes', 'oui', 'o'].includes(autoBenchmarkAnswer.toLowerCase())
  console.log()

  rl.close()

  saveConfig(config)
  const savedCount = Object.values(config.apiKeys).filter(v => v).length
  console.log(chalk.green(`  ✅ ${savedCount} key(s) saved to ~/.free-coding-models.json`))
  console.log(chalk.dim('  You can add/change keys and toggle Startup AI Speed Scan anytime with the ') + chalk.yellow('P') + chalk.dim(' key in the TUI.'))
  console.log()

  // 📖 Return nvidia key for backward-compat (main() checks it exists before continuing)
  return config.apiKeys.nvidia || Object.values(config.apiKeys).find(v => v) || null
}
