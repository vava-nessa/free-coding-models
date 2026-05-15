/**
 * @file sources.js
 * @description Model sources for AI availability checker.
 *
 * @details
 *   This file contains all model definitions organized by provider/source.
 *   Each source has its own models array with [model_id, display_label, tier, swe_score, ctx].
 *   - model_id: The model identifier for API calls
 *   - display_label: Human-friendly name for display
 *   - tier: Performance tier (S+, S, A+, A, A-, B+, B, C)
 *   - swe_score: SWE-bench Verified score percentage (self-reported by model provider)
 *   - ctx: Context window size in tokens (e.g., "128k", "32k")
 *
 *   Add new sources here to support additional providers beyond NIM.
 *   Public provider catalogs drift often, so these IDs are periodically
 *   refreshed against official docs and live model endpoints when available.
 *
 *   🎯 Tier scale (based on SWE-bench Verified):
 *   - S+: 70%+ (elite frontier coders)
 *   - S:  60-70% (excellent)
 *   - A+: 50-60% (great)
 *   - A:  40-50% (good)
 *   - A-: 35-40% (decent)
 *   - B+: 30-35% (average)
 *   - B:  20-30% (below average)
 *   - C:  <20% (lightweight/edge)
 *
 *   📖 Source: https://www.swebench.com — scores are self-reported unless noted
 *   📖 Secondary: https://swe-rebench.com (independent evals, scores are lower)
 *   📖 Leaderboard tracker: https://www.marc0.dev/en/leaderboard
 *
 *   @exports nvidiaNim, groq, cerebras, sambanova, openrouter, githubModels, mistral, codestral, scaleway, googleai, zai, qwen, cloudflare, ovhcloud, gemini, opencodeZen — model arrays per active provider
 *   @exports sources — map of active free/free-limited providers, each with { name, url, models }

 *   @exports MODELS — flat array of [modelId, label, tier, sweScore, ctx, providerKey]
 *
 *   📖 MODELS now includes providerKey as 6th element so ping() knows which
 *      API endpoint and API key to use for each model.
 */

// 📖 NIM source - https://build.nvidia.com
export const nvidiaNim = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['minimaxai/minimax-m2.7',                       'MiniMax M2.7',        'S+', '80.2%', '200k'],
  ['z-ai/glm-5.1',                                 'GLM 5.1',             'S+', '77.8%', '128k'],
  ['moonshotai/kimi-k2.6',                         'Kimi K2.6',           'S+', '76.8%', '256k'],
  ['deepseek-ai/deepseek-v4-pro',                  'DeepSeek V4 Pro',     'S+', '73.1%', '128k'],
  ['deepseek-ai/deepseek-v4-flash',                'DeepSeek V4 Flash',   'S+', '72.0%', '128k'],
  ['z-ai/glm5',                                    'GLM 5',               'S+', '73.8%', '200k'],
  ['stepfun-ai/step-3.5-flash',                    'Step 3.5 Flash',      'S+', '74.4%', '256k'],
  ['qwen/qwen3-coder-480b-a35b-instruct',          'Qwen3 Coder 480B',    'S+', '70.6%', '256k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['minimaxai/minimax-m2',                         'MiniMax M2',          'S',  '69.4%', '128k'],
  ['qwen/qwen3-next-80b-a3b-thinking',             'Qwen3 80B Thinking',  'S',  '68.0%', '128k'],
  ['qwen/qwen3-next-80b-a3b-instruct',             'Qwen3 80B Instruct',  'S',  '65.0%', '128k'],
  ['qwen/qwen3.5-397b-a17b',                       'Qwen3.5 400B VLM',    'S',  '68.0%', '128k'],
  ['openai/gpt-oss-120b',                          'GPT OSS 120B',        'S',  '60.0%', '128k'],
  ['meta/llama-4-maverick-17b-128e-instruct',      'Llama 4 Maverick',    'S',  '62.0%', '1M'],
  ['mistralai/mistral-medium-3.5-128b',             'Mistral Medium 3.5',  'S',  '66.0%', '128k'],
  ['mistralai/mistral-small-4-119b-2603',           'Mistral Small 4',     'S',  '60.0%', '128k'],
  ['qwen/qwen3.5-122b-a10b',                       'Qwen3.5 122B',        'S',  '64.0%', '128k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['nvidia/llama-3.1-nemotron-ultra-253b-v1',      'Nemotron Ultra 253B', 'A+', '56.0%', '128k'],
  ['mistralai/mistral-large-3-675b-instruct-2512', 'Mistral Large 675B',  'A+', '58.0%', '256k'],
  ['nvidia/nemotron-3-super-120b-a12b',             'Nemotron 3 Super',    'A+', '56.0%', '128k'],
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning','Nemotron 3 Omni',     'A+', '52.0%', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['nvidia/llama-3.3-nemotron-super-49b-v1.5',     'Nemotron Super 49B',  'A',  '49.0%', '128k'],
  ['nvidia/nemotron-3-nano-30b-a3b',               'Nemotron Nano 30B',   'A',  '43.0%', '128k'],
  ['openai/gpt-oss-20b',                           'GPT OSS 20B',         'A',  '42.0%', '128k'],
  ['google/gemma-4-31b-it',                         'Gemma 4 31B',         'A',  '45.0%', '256k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['meta/llama-3.3-70b-instruct',                  'Llama 3.3 70B',       'A-', '39.5%', '128k'],
  ['bytedance/seed-oss-36b-instruct',              'Seed OSS 36B',        'A-', '38.0%', '32k'],
  ['stockmark/stockmark-2-100b-instruct',          'Stockmark 100B',      'A-', '36.0%', '32k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['mistralai/mixtral-8x22b-instruct-v0.1',        'Mixtral 8x22B',       'B+', '32.0%', '64k'],
  ['mistralai/ministral-14b-instruct-2512',        'Ministral 14B',       'B+', '34.0%', '32k'],
  ['ibm/granite-34b-code-instruct',                'Granite 34B Code',    'B+', '30.0%', '32k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['meta/llama-3.1-8b-instruct',                   'Llama 3.1 8B',        'B',  '28.8%', '128k'],
  // ── C tier — SWE-bench Verified <20% or lightweight edge models ──
  ['microsoft/phi-4-mini-instruct',                'Phi 4 Mini',          'C',  '14.0%', '128k'],
]

// 📖 Groq source - https://console.groq.com
// 📖 Free API keys available at https://console.groq.com/keys
export const groq = [
  ['llama-3.3-70b-versatile',              'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout',  'A',  '44.0%', '131k'],
  ['llama-3.1-8b-instant',                 'Llama 3.1 8B',       'B',  '28.8%', '128k'],
  ['openai/gpt-oss-120b',                  'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['openai/gpt-oss-20b',                   'GPT OSS 20B',        'A',  '42.0%', '128k'],
  ['qwen/qwen3-32b',                       'Qwen3 32B',          'A+', '50.0%', '131k'],
  ['groq/compound',                        'Groq Compound',      'A',  '45.0%', '131k'],
  ['groq/compound-mini',                   'Groq Compound Mini', 'B+', '32.0%', '131k'],
]

// 📖 Cerebras source - https://cloud.cerebras.ai
// 📖 Free API keys available at https://cloud.cerebras.ai
export const cerebras = [
  ['gpt-oss-120b',                         'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['qwen-3-235b-a22b-instruct-2507',       'Qwen3 235B',         'S+', '70.0%', '128k'], // ⚠️ Deprecation: May 27, 2026
  ['llama3.1-8b',                          'Llama 3.1 8B',       'B',  '28.8%', '128k'],
  ['zai-glm-4.7',                          'GLM 4.7',            'S+', '73.8%', '200k'],
]

// 📖 SambaNova source - https://cloud.sambanova.ai
// 📖 Developer tier limits are small but still useful for smoke tests and occasional coding.
// 📖 Keep this catalog conservative: only models surfaced in current SambaNova docs.
export const sambanova = [
  // ── S+ tier ──
  ['MiniMax-M2.5',                         'MiniMax M2.5',       'S+', '74.0%', '160k'],
  // ── S tier ──
  ['DeepSeek-V3.1',                        'DeepSeek V3.1',      'S',  '62.0%', '128k'],
  ['DeepSeek-V3.2',                        'DeepSeek V3.2',      'S+', '70.0%', '32k'],
  ['Llama-4-Maverick-17B-128E-Instruct',   'Llama 4 Maverick',   'S',  '62.0%', '1M'],
  ['gpt-oss-120b',                         'GPT OSS 120B',       'S',  '60.0%', '128k'],
  // ── A- tier ──
  ['Meta-Llama-3.3-70B-Instruct',          'Llama 3.3 70B',      'A-', '39.5%', '128k'],
]

// 📖 OpenRouter source - https://openrouter.ai
// 📖 Free :free models with shared quota — 50 free req/day (20 req/min)
// 📖 No credits (or < $10) → 50 requests / day (20 req/min)
// 📖 ≥ $10 in credits → 1000 requests / day (20 req/min)
// 📖 Key things to know:
// 📖 • Free models (:free) never consume your credits. Your $10 stays untouched if you only use :free models.
// 📖 • Failed requests still count toward your daily quota.
// 📖 • Quota resets every day at midnight UTC.
// 📖 • Free-tier popular models may be additionally rate-limited by the provider itself during peak hours.
// 📖 API keys at https://openrouter.ai/keys
export const openrouter = [
  // ── S+ tier — live :free chat/coding models ──
  ['qwen/qwen3-coder:free',                     'Qwen3 Coder 480B',   'S+', '70.6%', '262k'],
  ['minimax/minimax-m2.5:free',                 'MiniMax M2.5',       'S+', '74.0%', '197k'],
  ['z-ai/glm-4.5-air:free',                     'GLM 4.5 Air',        'S+', '72.0%', '131k'],
  ['tencent/hy3-preview:free',                   'Tencent HY3 Preview','S+', '-',     '262k'],
  ['poolside/laguna-m.1:free',                  'Poolside Laguna M.1', 'S+', '-',     '256k'],
  ['poolside/laguna-xs.2:free',                 'Poolside Laguna XS.2','S+', '-',     '256k'],
  // ── S tier — live :free chat/coding models ──
  ['qwen/qwen3-next-80b-a3b-instruct:free',     'Qwen3 80B Instruct', 'S',  '65.0%', '131k'],
  ['openai/gpt-oss-120b:free',                  'GPT OSS 120B',       'S',  '60.0%', '131k'],
  ['inclusionai/ling-2.6-1t:free',              'Ling 2.6 1T',        'S',  '-',     '128k'],
  ['nvidia/nemotron-3-super-120b-a12b:free',    'Nemotron 3 Super',   'A+', '56.0%', '262k'],
  // ── A+ tier — live :free chat/coding models ──
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'Nemotron 3 Omni', 'A+', '52.0%', '128k'],
  ['nvidia/nemotron-nano-12b-v2-vl:free',       'Nemotron Nano 12B VL','A',  '20.0%', '128k'],
  ['openrouter/owl-alpha',                      'Owl Alpha',          'A+', '-',     '128k'],
  // ── A tier — live :free chat/coding models ──
  ['nousresearch/hermes-3-llama-3.1-405b:free', 'Hermes 3 405B',      'A',  '44.0%', '131k'],
  ['openai/gpt-oss-20b:free',                   'GPT OSS 20B',        'A',  '42.0%', '131k'],
  ['nvidia/nemotron-3-nano-30b-a3b:free',       'Nemotron Nano 30B',  'A',  '43.0%', '128k'],
  ['cognitivecomputations/dolphin-mistral-24b-venice-edition:free', 'Dolphin Mistral 24B', 'B+', '30.0%', '33k'],
  ['google/gemma-4-31b-it:free',                'Gemma 4 31B',        'A',  '45.0%', '256k'],
  ['google/gemma-4-26b-a4b-it:free',            'Gemma 4 26B MoE',    'A-', '38.0%', '256k'],
  // ── A- tier — confirmed free ──
  ['meta-llama/llama-3.3-70b-instruct:free',    'Llama 3.3 70B',      'A-', '39.5%', '131k'],
  ['meta-llama/llama-3.2-3b-instruct:free',     'Llama 3.2 3B',       'B',  '20.0%', '128k'],
  // ── B+ tier ──
  ['nvidia/nemotron-nano-9b-v2:free',           'Nemotron Nano 9B',   'B+', '18.0%', '128k'],
  ['google/gemma-3n-e2b-it:free',               'Gemma 3n E2B',       'B+', '-',     '8k'],
  // ── B tier ──
  ['google/gemma-3-27b-it:free',                'Gemma 3 27B',        'B',  '22.0%', '131k'],
  ['google/gemma-4-31b-a4b-it:free',            'Gemma 4 31B MoE',    'B',  '-',     '256k'],
  ['openrouter/free',                           'OpenRouter Free',    'B',  '-',     '128k'],
  // ── C tier ──
  ['google/gemma-3-12b-it:free',                'Gemma 3 12B',        'C',  '15.0%', '131k'],
  ['google/gemma-3n-e4b-it:free',               'Gemma 3n E4B',       'C',  '10.0%', '8k'],
  ['google/gemma-3-4b-it:free',                 'Gemma 3 4B',         'C',  '10.0%', '33k'],
  ['liquid/lfm-2.5-1.2b-instruct:free',         'LFM 2.5 1.2B',       'C',  '-',     '32k'],
  ['liquid/lfm-2.5-1.2b-thinking:free',         'LFM 2.5 Thinking',   'C',  '-',     '32k'],
]

// 📖 GitHub Models source - https://models.github.ai
// 📖 OpenAI-compatible endpoint: https://models.github.ai/inference/chat/completions
// 📖 Free usage is quota-limited by GitHub/Copilot tier, but no separate provider billing is needed.
export const githubModels = [
  ['openai/gpt-4.1',                              'GPT-4.1',             'S+', '-',     '1M'],
  ['openai/gpt-4.1-mini',                         'GPT-4.1 Mini',        'S',  '-',     '1M'],
  ['openai/gpt-4.1-nano',                         'GPT-4.1 Nano',        'A',  '-',     '1M'],
  ['deepseek/deepseek-v3-0324',                   'DeepSeek V3 0324',    'S',  '62.0%', '128k'],
  ['meta/meta-llama-3.1-405b-instruct',           'Llama 3.1 405B',      'A',  '44.0%', '128k'],
  ['meta/llama-4-maverick-17b-128e-instruct-fp8', 'Llama 4 Maverick',    'S',  '62.0%', '1M'],
  ['meta/llama-4-scout-17b-16e-instruct',         'Llama 4 Scout',       'A',  '44.0%', '10M'],
  ['meta/llama-3.3-70b-instruct',                 'Llama 3.3 70B',       'A-', '39.5%', '128k'],
  ['meta/llama-3.2-90b-vision-instruct',          'Llama 3.2 90B Vision','A-', '-',     '128k'],
  ['meta/llama-3.2-11b-vision-instruct',          'Llama 3.2 11B Vision','B',  '-',     '128k'],
  ['meta/meta-llama-3.1-8b-instruct',             'Llama 3.1 8B',        'B',  '28.8%', '128k'],
  ['mistral-ai/codestral-2501',                   'Codestral 2501',      'B+', '34.0%', '256k'],
  ['mistral-ai/mistral-medium-2505',              'Mistral Medium 2505', 'A',  '48.0%', '128k'],
  ['mistral-ai/mistral-small-2503',               'Mistral Small 2503',  'B+', '30.0%', '128k'],
  ['mistral-ai/ministral-3b',                     'Ministral 3B',        'C',  '-',     '32k'],
]

// 📖 Mistral La Plateforme source - https://console.mistral.ai
// 📖 Experiment plan is free for evaluation/prototyping and exposes general + coding models.
// 📖 Keep Codestral as a separate provider key for backward compatibility with existing configs.
export const mistral = [
  ['mistral-large-latest',                        'Mistral Large',       'S+', '70.0%', '256k'],
  ['mistral-medium-latest',                       'Mistral Medium',      'S',  '66.0%', '128k'],
  ['mistral-small-latest',                        'Mistral Small',       'A',  '48.0%', '128k'],
  ['devstral-medium-latest',                      'Devstral Medium',     'S+', '72.2%', '128k'],
  ['devstral-small-latest',                       'Devstral Small',      'A+', '55.0%', '128k'],
  ['magistral-medium-latest',                     'Magistral Medium',    'A+', '52.0%', '128k'],
  ['magistral-small-latest',                      'Magistral Small',     'A',  '45.0%', '128k'],
]

// 📖 Mistral Codestral source - https://codestral.mistral.ai
// 📖 Free coding model — 30 req/min, 2000/day (phone number required for key)
// 📖 API keys now use the Mistral platform key format; CODESTRAL_API_KEY remains supported as an alias.
export const codestral = [
  ['codestral-latest',                         'Codestral',          'B+', '34.0%', '256k'],
]

// 📖 Scaleway source - https://console.scaleway.com
// 📖 1M free tokens — API keys at https://console.scaleway.com/iam/api-keys
export const scaleway = [
  ['devstral-2-123b-instruct-2512',            'Devstral 2 123B',     'S+', '72.2%', '256k'],
  ['qwen3.5-397b-a17b',                        'Qwen3.5 400B VLM',   'S',  '68.0%', '250k'],
  ['mistral/mistral-large-3-675b-instruct-2512','Mistral Large 675B', 'A+', '58.0%', '250k'],
  ['qwen3-235b-a22b-instruct-2507',            'Qwen3 235B',         'S+', '70.0%', '128k'],
  ['gpt-oss-120b',                             'GPT OSS 120B',       'S',  '60.0%', '131k'],
  ['qwen3-coder-30b-a3b-instruct',             'Qwen3 Coder 30B',    'A+', '55.0%', '32k'],
  ['holo2-30b-a3b',                            'Holo2 30B',          'A+', '52.0%', '131k'],
  ['llama-3.3-70b-instruct',                   'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['mistral-small-3.2-24b-instruct-2506',      'Mistral Small 3.2',  'B+', '30.0%', '128k'],
  ['gemma-3-27b-it',                           'Gemma 3 27B',        'B',  '22.0%', '128k'],
]

// 📖 Google AI Studio source - https://aistudio.google.com
// 📖 OpenAI-compatible endpoint exposes Gemini models; free quotas vary by model and region.
export const googleai = [
  ['gemini-3.1-pro-preview',                    'Gemini 3.1 Pro Preview',       'S+', '78.0%', '1M'],
  ['gemini-3-flash-preview',                    'Gemini 3 Flash Preview',       'S',  '65.0%', '1M'],
  ['gemini-3.1-flash-lite-preview',             'Gemini 3.1 Flash Lite Preview','A+', '55.0%', '1M'],
  ['gemini-2.5-pro',                            'Gemini 2.5 Pro',               'S+', '63.2%', '1M'],
  ['gemini-2.5-flash',                          'Gemini 2.5 Flash',             'A+', '50.0%', '1M'],
  ['gemini-2.5-flash-lite',                     'Gemini 2.5 Flash Lite',        'A',  '42.0%', '1M'],
]

// 📖 ZAI source - https://open.z.ai
// 📖 Free tier is limited to Flash models; paid GLM models are intentionally excluded.
export const zai = [
  ['zai/glm-4.7-flash',                                   'GLM-4.7-Flash',       'S',  '59.2%', '200k'],
  ['zai/glm-4.5-flash',                                   'GLM-4.5-Flash',       'S',  '59.2%', '128k'],
]

// 📖 Alibaba Cloud (DashScope) source - https://dashscope-intl.aliyuncs.com
// 📖 OpenAI-compatible endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
// 📖 Free tier: 1M tokens per model (Singapore region only), valid for 90 days
// 📖 Get API key: https://modelstudio.console.alibabacloud.com
// 📖 Env var: DASHSCOPE_API_KEY
// 📖 Qwen3-Coder models: optimized coding models with excellent SWE-bench scores
export const qwen = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['qwen3-max',                               'Qwen3 Max',          'S+', '78.8%', '1M'],
  ['qwen3-235b-a22b-instruct',                'Qwen3 235B',         'S+', '70.0%', '256k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen3.5-plus',                             'Qwen3.5 Plus',      'S',  '68.0%', '1M'],
  ['qwen3-coder-plus',                        'Qwen3 Coder Plus',  'S',  '69.6%', '256k'],
  ['qwen3-coder-next',                        'Qwen3 Coder Next',  'S',  '65.0%', '256k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['qwen3.5-flash',                           'Qwen3.5 Flash',     'A+', '55.0%', '1M'],
  ['qwen3-coder-flash',                       'Qwen3 Coder Flash', 'A+', '55.0%', '256k'],
  ['qwen3-32b',                               'Qwen3 32B',          'A+', '50.0%', '128k'],
  ['qwen2.5-coder-32b-instruct',              'Qwen2.5 Coder 32B',  'A',  '46.0%', '32k'],
]

// 📖 Cloudflare Workers AI source - https://developers.cloudflare.com/workers-ai
// 📖 OpenAI-compatible endpoint requires account id:
// 📖 https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
// 📖 Free plan includes daily neuron quota and provider-level request limits.
export const cloudflare = [
  // ── S+ tier ──
  ['@cf/moonshotai/kimi-k2.6',                'Kimi K2.6',         'S+', '76.8%', '256k'],
  // ── S tier ──
  ['@cf/zai-org/glm-4.7-flash',               'GLM-4.7-Flash',     'S',  '59.2%', '131k'],
  ['@cf/openai/gpt-oss-120b',                 'GPT OSS 120B',      'S',  '60.0%', '128k'],
  // ── A+ tier ──
  ['@cf/qwen/qwq-32b',                        'QwQ 32B',           'A+', '50.0%', '131k'],
  ['@cf/nvidia/nemotron-3-120b-a12b',         'Nemotron 3 Super',  'A+', '56.0%', '128k'],
  // ── A tier ──
  ['@cf/meta/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout',     'A',  '44.0%', '131k'],
  ['@cf/qwen/qwen3-30b-a3b-fp8',              'Qwen3 30B MoE',     'A',  '45.0%', '128k'],
  ['@cf/qwen/qwen2.5-coder-32b-instruct',     'Qwen2.5 Coder 32B', 'A',  '46.0%', '32k'],
  ['@cf/openai/gpt-oss-20b',                  'GPT OSS 20B',       'A',  '42.0%', '128k'],
  // ── A- tier ──
  ['@cf/meta/llama-3.3-70b-instruct-fp8-fast','Llama 3.3 70B',     'A-', '39.5%', '128k'],
  ['@cf/google/gemma-4-31b-it',               'Gemma 4 31B',       'A',  '45.0%', '256k'],
  ['@cf/google/gemma-4-26b-a4b-it',           'Gemma 4 26B MoE',   'A-', '38.0%', '256k'],
  ['@cf/mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1', 'B+', '30.0%', '128k'],
  // ── B tier ──
  ['@cf/ibm/granite-4.0-h-micro',             'Granite 4.0 Micro', 'B+', '30.0%', '128k'],
  ['@cf/meta/llama-3.1-8b-instruct',          'Llama 3.1 8B',      'B',  '28.8%', '128k'],
]

// 📖 OVHcloud AI Endpoints - https://endpoints.ai.cloud.ovh.net
// 📖 OpenAI-compatible API with European data sovereignty (GDPR)
// 📖 Free sandbox: 2 req/min per IP per model (no API key needed), 400 RPM with API key
// 📖 Env var: OVH_AI_ENDPOINTS_ACCESS_TOKEN
export const ovhcloud = [
  ['Qwen3-Coder-30B-A3B-Instruct',             'Qwen3 Coder 30B MoE',  'A+', '55.0%', '256k'],
  ['gpt-oss-120b',                              'GPT OSS 120B',         'S',  '60.0%', '131k'],
  ['gpt-oss-20b',                               'GPT OSS 20B',          'A',  '42.0%', '131k'],
  ['Meta-Llama-3_3-70B-Instruct',               'Llama 3.3 70B',        'A-', '39.5%', '131k'],
  ['Qwen3-32B',                                 'Qwen3 32B',            'A+', '50.0%', '32k'],
  ['Mistral-Small-3.2-24B-Instruct-2506',       'Mistral Small 3.2',    'B+', '34.0%', '131k'],
  ['Mistral-7B-Instruct-v0.3',                  'Mistral 7B Instruct',  'B',  '25.0%', '32k'],
  ['Mistral-Nemo-Instruct-2407',                'Mistral Nemo',         'B+', '30.0%', '128k'],
  ['Qwen3.5-9B',                                'Qwen3.5 9B',           'B+', '30.0%', '128k'],
  ['Llama-3.1-8B-Instruct',                     'Llama 3.1 8B',         'B',  '28.8%', '131k'],
]

// 📖 Gemini CLI source - https://github.com/google-gemini/gemini-cli
// 📖 CLI tool with OpenAI-compatible API support
// 📖 Install: npm install -g @google/gemini-cli
// 📖 Free tier: 1,000 req/day with personal Google account (no credit card)
// 📖 Models track Google AI Studio IDs; no stale google/ prefix.
// 📖 Supports custom OpenAI-compatible providers via GEMINI_API_BASE_URL
export const gemini = [
  ['gemini-3.1-pro-preview',            'Gemini 3.1 Pro Preview',       'S+', '78.0%', '1M'],
  ['gemini-3-flash-preview',            'Gemini 3 Flash Preview',       'S',  '65.0%', '1M'],
  ['gemini-3.1-flash-lite-preview',     'Gemini 3.1 Flash Lite Preview','A+', '55.0%', '1M'],
  ['gemini-2.5-pro',                    'Gemini 2.5 Pro',               'S+', '63.2%', '1M'],
  ['gemini-2.5-flash',                  'Gemini 2.5 Flash',             'A+', '50.0%', '1M'],
  ['gemini-2.5-flash-lite',             'Gemini 2.5 Flash Lite',        'A',  '42.0%', '1M'],
]

// 📖 OpenCode Zen free models — hosted AI gateway accessed through OpenCode CLI/Desktop
// 📖 Endpoint: https://opencode.ai/zen/v1/... — requires OpenCode Zen API key
// 📖 These models are FREE on the Zen platform and only run on OpenCode CLI or OpenCode Desktop
// 📖 Login: https://opencode.ai/auth — get your Zen API key
// 📖 Config: set provider to opencode/<model-id> in OpenCode config
export const opencodeZen = [
  ['big-pickle',                              'Big Pickle',           'S+', '72.0%', '200k'],
  ['minimax-m2.5-free',                       'MiniMax M2.5 Free',   'S+', '80.2%', '200k'],
  ['nemotron-3-super-free',                   'Nemotron 3 Super Free','A+', '52.0%', '1M'],
  ['gpt-5-nano',                              'GPT 5 Nano',          'S',  '65.0%', '400k'],
  ['hy3-preview-free',                        'HY3 Preview Free',    'A+', '-',     '128k'],
  ['ling-2.6-flash-free',                     'Ling 2.6 Flash Free', 'S',  '-',     '128k'],
  ['trinity-mini-free',                       'Trinity Mini Preview', 'A',  '-',     '128k'],
  ['trinity-large-preview-free',              'Trinity Large Preview','S',  '-',     '128k'],
]

// 📖 All sources combined - used by the main script
// 📖 Each source has: name (display), url (API endpoint), models (array of model tuples)
// 📖 Providers ordered by generosity of free tier (most generous first)
// 📖 See README for full tier-by-tier comparison
export const sources = {
  nvidia: {
    name: 'NVIDIA NIM',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: nvidiaNim,
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: groq,
  },
  cerebras: {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    models: cerebras,
  },
  googleai: {
    name: 'Google AI',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: googleai,
  },
  'github-models': {
    name: 'GitHub Models',
    url: 'https://models.github.ai/inference/chat/completions',
    models: githubModels,
  },
  mistral: {
    name: 'Mistral LP',
    url: 'https://api.mistral.ai/v1/chat/completions',
    models: mistral,
  },
  cloudflare: {
    name: 'Cloudflare AI',
    url: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions',
    models: cloudflare,
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: openrouter,
  },
  sambanova: {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    models: sambanova,
  },
  ovhcloud: {
    name: 'OVHcloud AI',
    url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions',
    models: ovhcloud,
  },
  codestral: {
    name: 'Codestral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    models: codestral,
  },
  zai: {
    name: 'ZAI',
    url: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
    models: zai,
  },
  scaleway: {
    name: 'Scaleway',
    url: 'https://api.scaleway.ai/v1/chat/completions',
    models: scaleway,
  },
  qwen: {
    name: 'Alibaba DashScope',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: qwen,
  },
  gemini: {
    name: 'Gemini CLI',
    url: null, // CLI tool - no API endpoint (can use OpenAI-compatible via env)
    models: gemini,
    cliOnly: true,
    installUrl: 'https://github.com/google-gemini/gemini-cli',
    binary: 'gemini',
    checkArgs: ['--version'],
  },
  'opencode-zen': {
    name: 'OpenCode Zen',
    url: 'https://opencode.ai/zen/v1/chat/completions',
    models: opencodeZen,
    zenOnly: true,
  },
}

// 📖 Flatten all models from all sources — each entry includes providerKey as 6th element
// 📖 providerKey lets the main CLI know which API key and URL to use per model
export const MODELS = [];
for (const [sourceKey, sourceData] of Object.entries(sources)) {
  if (!sourceData || !sourceData.models) continue
  for (const [modelId, label, tier, sweScore, ctx] of sourceData.models) {
    MODELS.push([modelId, label, tier, sweScore, ctx, sourceKey])
  }
}
