/**
 * @file provider-metadata.js
 * @description Provider metadata, environment variable names, and OpenCode model ID mapping.
 *              Extracted from bin/free-coding-models.js to allow shared access by setup wizard,
 *              Settings overlay, and OpenCode integration helpers.
 *
 * @details
 *   This module owns three separate concerns that all relate to "knowing about providers":
 *
 *   1. `PROVIDER_METADATA` — human-readable display info (label, colour, signup URL, rate limits)
 *      used in the setup wizard (`promptApiKey`) and the Settings overlay.
 *
 *   2. `ENV_VAR_NAMES` — maps providerKey → the environment variable name that carries the API key.
 *      Used when spawning OpenCode child processes so that keys stored only in
 *      ~/.free-coding-models.json are also visible to the child via `{env:VAR}` references.
 *
 *   3. `OPENCODE_MODEL_MAP` — sparse mapping of source model IDs to OpenCode built-in model IDs
 *      (only entries where the IDs differ need to be listed).  Groq's API aliases short names
 *      to full names but OpenCode does exact ID matching against its built-in model list.
 *
 *   Platform booleans (`isWindows`, `isMac`, `isLinux`) are also exported here so that
 *   OpenCode Desktop launch logic and auto-update can share them without re-reading `process.platform`.
 *
 * @exports
 *   PROVIDER_METADATA, ENV_VAR_NAMES, OPENCODE_MODEL_MAP,
 *   isWindows, isMac, isLinux
 *
 * @see bin/free-coding-models.js  — consumes all exports from this module
 * @see src/config.js              — resolveApiKeys / getApiKey use ENV_VAR_NAMES indirectly
 */

import chalk from 'chalk'

// 📖 Platform detection — used by Desktop launcher and auto-update to pick the right open/start command.
export const isWindows = process.platform === 'win32'
export const isMac     = process.platform === 'darwin'
export const isLinux   = process.platform === 'linux'

// 📖 ENV_VAR_NAMES: maps providerKey → shell env var name for passing resolved keys to child processes.
// 📖 When a key is stored only in ~/.free-coding-models.json (not in the shell env), we inject it
// 📖 into the child's env so OpenCode's {env:VAR} references still resolve.
export const ENV_VAR_NAMES = {
  nvidia:     'NVIDIA_API_KEY',
  groq:       'GROQ_API_KEY',
  cerebras:   'CEREBRAS_API_KEY',
  sambanova:  'SAMBANOVA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  huggingface:'HUGGINGFACE_API_KEY',
  replicate:  'REPLICATE_API_TOKEN',
  deepinfra:  'DEEPINFRA_API_KEY',
  fireworks:  'FIREWORKS_API_KEY',
  codestral:  'CODESTRAL_API_KEY',
  hyperbolic: 'HYPERBOLIC_API_KEY',
  scaleway:   'SCALEWAY_API_KEY',
  googleai:   'GOOGLE_API_KEY',
  siliconflow:'SILICONFLOW_API_KEY',
  together:   'TOGETHER_API_KEY',
  cloudflare: 'CLOUDFLARE_API_TOKEN',
  perplexity: 'PERPLEXITY_API_KEY',
  zai:        'ZAI_API_KEY',
}

// 📖 OPENCODE_MODEL_MAP: sparse table of model IDs that differ between sources.js and OpenCode's
// 📖 built-in model registry.  Only add entries where they DIFFER — unmapped models pass through as-is.
export const OPENCODE_MODEL_MAP = {
  groq: {
    'moonshotai/kimi-k2-instruct': 'moonshotai/kimi-k2-instruct-0905',
    'meta-llama/llama-4-scout-17b-16e-preview': 'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-preview': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  }
}

// 📖 PROVIDER_METADATA: display info for each provider, used in setup wizard and Settings panel.
// 📖 `color` is a chalk function for visual distinction in the TUI.
// 📖 `signupUrl` / `signupHint` guide users through first-time key generation.
// 📖 `rateLimits` gives a quick reminder of the free-tier quota without opening a browser.
export const PROVIDER_METADATA = {
  nvidia: {
    label: 'NVIDIA NIM',
    color: chalk.rgb(178, 235, 190),
    signupUrl: 'https://build.nvidia.com',
    signupHint: 'Profile → API Keys → Generate',
    rateLimits: 'Free tier (provider quota by model)',
  },
  groq: {
    label: 'Groq',
    color: chalk.rgb(255, 204, 188),
    signupUrl: 'https://console.groq.com/keys',
    signupHint: 'API Keys → Create API Key',
    rateLimits: 'Free dev tier (provider quota)',
  },
  cerebras: {
    label: 'Cerebras',
    color: chalk.rgb(179, 229, 252),
    signupUrl: 'https://cloud.cerebras.ai',
    signupHint: 'API Keys → Create',
    rateLimits: 'Free dev tier (provider quota)',
  },
  sambanova: {
    label: 'SambaNova',
    color: chalk.rgb(255, 224, 178),
    signupUrl: 'https://cloud.sambanova.ai/apis',
    signupHint: 'SambaCloud portal → Create API key',
    rateLimits: 'Dev tier generous quota',
  },
  openrouter: {
    label: 'OpenRouter',
    color: chalk.rgb(225, 190, 231),
    signupUrl: 'https://openrouter.ai/keys',
    signupHint: 'API Keys → Create',
    rateLimits: '50 req/day, 20/min (:free shared quota)',
  },
  huggingface: {
    label: 'Hugging Face Inference',
    color: chalk.rgb(255, 245, 157),
    signupUrl: 'https://huggingface.co/settings/tokens',
    // 📖 Hugging Face serverless inference now expects a fine-grained token with
    // 📖 the dedicated Inference Providers permission, not a generic read token.
    signupHint: 'Settings → Access Tokens → Fine-grained → enable "Make calls to Inference Providers"',
    rateLimits: 'Free monthly credits (~$0.10)',
  },
  replicate: {
    label: 'Replicate',
    color: chalk.rgb(187, 222, 251),
    signupUrl: 'https://replicate.com/account/api-tokens',
    signupHint: 'Account → API Tokens',
    rateLimits: 'Developer free quota',
  },
  deepinfra: {
    label: 'DeepInfra',
    color: chalk.rgb(178, 223, 219),
    signupUrl: 'https://deepinfra.com/login',
    signupHint: 'Login → API keys',
    rateLimits: 'Free dev tier (low-latency quota)',
  },
  fireworks: {
    label: 'Fireworks AI',
    color: chalk.rgb(255, 205, 210),
    signupUrl: 'https://fireworks.ai',
    signupHint: 'Create account → Generate API key',
    rateLimits: '$1 free credits (new dev accounts)',
  },
  codestral: {
    label: 'Mistral Codestral',
    color: chalk.rgb(248, 187, 208),
    signupUrl: 'https://codestral.mistral.ai',
    signupHint: 'API Keys → Create',
    rateLimits: '30 req/min, 2000/day',
  },
  hyperbolic: {
    label: 'Hyperbolic',
    color: chalk.rgb(255, 171, 145),
    signupUrl: 'https://app.hyperbolic.ai/settings',
    signupHint: 'Settings → API Keys',
    rateLimits: '$1 free trial credits',
  },
  scaleway: {
    label: 'Scaleway',
    color: chalk.rgb(129, 212, 250),
    signupUrl: 'https://console.scaleway.com/iam/api-keys',
    signupHint: 'IAM → API Keys',
    rateLimits: '1M free tokens',
  },
  googleai: {
    label: 'Google AI Studio',
    color: chalk.rgb(187, 222, 251),
    signupUrl: 'https://aistudio.google.com/apikey',
    signupHint: 'Get API key',
    rateLimits: '14.4K req/day, 30/min',
  },
  siliconflow: {
    label: 'SiliconFlow',
    color: chalk.rgb(178, 235, 242),
    signupUrl: 'https://cloud.siliconflow.cn/account/ak',
    signupHint: 'API Keys → Create',
    rateLimits: 'Free models: usually 100 RPM, varies by model',
  },
  together: {
    label: 'Together AI',
    color: chalk.rgb(255, 241, 118),
    signupUrl: 'https://api.together.ai/settings/api-keys',
    signupHint: 'Settings → API keys',
    rateLimits: 'Credits/promos vary by account (check console)',
  },
  cloudflare: {
    label: 'Cloudflare Workers AI',
    color: chalk.rgb(255, 204, 128),
    signupUrl: 'https://dash.cloudflare.com',
    signupHint: 'Create AI API token + set CLOUDFLARE_ACCOUNT_ID',
    rateLimits: 'Free: 10k neurons/day, text-gen 300 RPM',
  },
  perplexity: {
    label: 'Perplexity API',
    color: chalk.rgb(244, 143, 177),
    signupUrl: 'https://www.perplexity.ai/settings/api',
    signupHint: 'Generate API key (billing may be required)',
    rateLimits: 'Tiered limits by spend (default ~50 RPM)',
  },
  qwen: {
    label: 'Alibaba Cloud (DashScope)',
    color: chalk.rgb(255, 224, 130),
    signupUrl: 'https://modelstudio.console.alibabacloud.com',
    signupHint: 'Model Studio → API Key → Create (1M free tokens, 90 days)',
    rateLimits: '1M free tokens per model (Singapore region, 90 days)',
  },
  zai: {
    label: 'ZAI (z.ai)',
    color: chalk.rgb(174, 213, 255),
    signupUrl: 'https://z.ai',
    signupHint: 'Sign up and generate an API key',
    rateLimits: 'Free tier (generous quota)',
  },
  iflow: {
    label: 'iFlow',
    color: chalk.rgb(220, 231, 117),
    signupUrl: 'https://platform.iflow.cn',
    signupHint: 'Register → Personal Information → Generate API Key (7-day expiry)',
    rateLimits: 'Free for individuals (no request limits)',
  },
}
