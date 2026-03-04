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
 *   @exports nvidiaNim, groq, cerebras, sambanova, openrouter, huggingface, replicate, deepinfra, fireworks, codestral, hyperbolic, scaleway, googleai, siliconflow, together, cloudflare, perplexity, qwen, iflow — model arrays per provider
 *   @exports sources — map of { nvidia, groq, cerebras, sambanova, openrouter, huggingface, replicate, deepinfra, fireworks, codestral, hyperbolic, scaleway, googleai, siliconflow, together, cloudflare, perplexity, qwen, iflow } each with { name, url, models }

 *   @exports MODELS — flat array of [modelId, label, tier, sweScore, ctx, providerKey]
 *
 *   📖 MODELS now includes providerKey as 6th element so ping() knows which
 *      API endpoint and API key to use for each model.
 */

// 📖 NIM source - https://build.nvidia.com
export const nvidiaNim = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['deepseek-ai/deepseek-v3.2',                    'DeepSeek V3.2',       'S+', '73.1%', '128k'],
  ['moonshotai/kimi-k2.5',                         'Kimi K2.5',           'S+', '76.8%', '128k'],
  ['z-ai/glm5',                                    'GLM 5',               'S+', '77.8%', '128k'],
  ['z-ai/glm4.7',                                  'GLM 4.7',             'S+', '73.8%', '200k'],
  ['moonshotai/kimi-k2-thinking',                  'Kimi K2 Thinking',    'S+', '71.3%', '256k'],
  ['minimaxai/minimax-m2.1',                       'MiniMax M2.1',        'S+', '74.0%', '200k'],
  ['stepfun-ai/step-3.5-flash',                    'Step 3.5 Flash',      'S+', '74.4%', '256k'],
  ['qwen/qwen3-coder-480b-a35b-instruct',          'Qwen3 Coder 480B',    'S+', '70.6%', '256k'],
  ['qwen/qwen3-235b-a22b',                         'Qwen3 235B',          'S+', '70.0%', '128k'],
  ['mistralai/devstral-2-123b-instruct-2512',      'Devstral 2 123B',     'S+', '72.2%', '256k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['deepseek-ai/deepseek-v3.1-terminus',           'DeepSeek V3.1 Term',  'S',  '68.4%', '128k'],
  ['moonshotai/kimi-k2-instruct',                  'Kimi K2 Instruct',    'S',  '65.8%', '128k'],
  ['minimaxai/minimax-m2',                         'MiniMax M2',          'S',  '69.4%', '128k'],
  ['qwen/qwen3-next-80b-a3b-thinking',             'Qwen3 80B Thinking',  'S',  '68.0%', '128k'],
  ['qwen/qwen3-next-80b-a3b-instruct',             'Qwen3 80B Instruct',  'S',  '65.0%', '128k'],
  ['qwen/qwen3.5-397b-a17b',                       'Qwen3.5 400B VLM',    'S',  '68.0%', '128k'],
  ['openai/gpt-oss-120b',                          'GPT OSS 120B',        'S',  '60.0%', '128k'],
  ['meta/llama-4-maverick-17b-128e-instruct',      'Llama 4 Maverick',    'S',  '62.0%', '1M'],
  ['deepseek-ai/deepseek-v3.1',                    'DeepSeek V3.1',       'S',  '62.0%', '128k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['nvidia/llama-3.1-nemotron-ultra-253b-v1',      'Nemotron Ultra 253B', 'A+', '56.0%', '128k'],
  ['mistralai/mistral-large-3-675b-instruct-2512', 'Mistral Large 675B',  'A+', '58.0%', '256k'],
  ['qwen/qwq-32b',                                 'QwQ 32B',             'A+', '50.0%', '131k'],
  ['igenius/colosseum_355b_instruct_16k',          'Colosseum 355B',      'A+', '52.0%', '16k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['mistralai/mistral-medium-3-instruct',          'Mistral Medium 3',    'A',  '48.0%', '128k'],
  ['mistralai/magistral-small-2506',               'Magistral Small',     'A',  '45.0%', '32k'],
  ['nvidia/llama-3.3-nemotron-super-49b-v1.5',     'Nemotron Super 49B',  'A',  '49.0%', '128k'],
  ['meta/llama-4-scout-17b-16e-instruct',          'Llama 4 Scout',       'A',  '44.0%', '10M'],
  ['nvidia/nemotron-3-nano-30b-a3b',               'Nemotron Nano 30B',   'A',  '43.0%', '128k'],
  ['deepseek-ai/deepseek-r1-distill-qwen-32b',     'R1 Distill 32B',      'A',  '43.9%', '128k'],
  ['openai/gpt-oss-20b',                           'GPT OSS 20B',         'A',  '42.0%', '128k'],
  ['qwen/qwen2.5-coder-32b-instruct',              'Qwen2.5 Coder 32B',   'A',  '46.0%', '32k'],
  ['meta/llama-3.1-405b-instruct',                 'Llama 3.1 405B',      'A',  '44.0%', '128k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['meta/llama-3.3-70b-instruct',                  'Llama 3.3 70B',       'A-', '39.5%', '128k'],
  ['deepseek-ai/deepseek-r1-distill-qwen-14b',     'R1 Distill 14B',      'A-', '37.7%', '64k'],
  ['bytedance/seed-oss-36b-instruct',              'Seed OSS 36B',        'A-', '38.0%', '32k'],
  ['stockmark/stockmark-2-100b-instruct',          'Stockmark 100B',      'A-', '36.0%', '32k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['mistralai/mixtral-8x22b-instruct-v0.1',        'Mixtral 8x22B',       'B+', '32.0%', '64k'],
  ['mistralai/ministral-14b-instruct-2512',        'Ministral 14B',       'B+', '34.0%', '32k'],
  ['ibm/granite-34b-code-instruct',                'Granite 34B Code',    'B+', '30.0%', '32k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['deepseek-ai/deepseek-r1-distill-llama-8b',     'R1 Distill 8B',       'B',  '28.2%', '32k'],
  ['deepseek-ai/deepseek-r1-distill-qwen-7b',      'R1 Distill 7B',       'B',  '22.6%', '32k'],
  // ── C tier — SWE-bench Verified <20% or lightweight edge models ──
  ['google/gemma-2-9b-it',                         'Gemma 2 9B',          'C',  '18.0%', '8k'],
  ['microsoft/phi-3.5-mini-instruct',              'Phi 3.5 Mini',        'C',  '12.0%', '128k'],
  ['microsoft/phi-4-mini-instruct',                'Phi 4 Mini',          'C',  '14.0%', '128k'],
]

// 📖 Groq source - https://console.groq.com
// 📖 Free API keys available at https://console.groq.com/keys
export const groq = [
  ['llama-3.3-70b-versatile',              'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['meta-llama/llama-4-scout-17b-16e-preview', 'Llama 4 Scout',  'A',  '44.0%', '10M'],
  ['meta-llama/llama-4-maverick-17b-128e-preview', 'Llama 4 Maverick', 'S', '62.0%', '1M'],
  ['deepseek-r1-distill-llama-70b',        'R1 Distill 70B',     'A',  '43.9%', '128k'],
  ['qwen-qwq-32b',                         'QwQ 32B',            'A+', '50.0%', '131k'],
  ['moonshotai/kimi-k2-instruct',          'Kimi K2 Instruct',   'S',  '65.8%', '131k'],
  ['llama-3.1-8b-instant',                 'Llama 3.1 8B',       'B',  '28.8%', '128k'],
  ['openai/gpt-oss-120b',                  'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['openai/gpt-oss-20b',                   'GPT OSS 20B',        'A',  '42.0%', '128k'],
  ['qwen/qwen3-32b',                       'Qwen3 32B',          'A+', '50.0%', '131k'],
]

// 📖 Cerebras source - https://cloud.cerebras.ai
// 📖 Free API keys available at https://cloud.cerebras.ai
export const cerebras = [
  ['llama3.3-70b',                         'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['llama-4-scout-17b-16e-instruct',       'Llama 4 Scout',      'A',  '44.0%', '10M'],
  ['qwen-3-32b',                           'Qwen3 32B',          'A+', '50.0%', '128k'],
  ['gpt-oss-120b',                         'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['qwen-3-235b-a22b',                     'Qwen3 235B',         'S+', '70.0%', '128k'],
  ['llama3.1-8b',                          'Llama 3.1 8B',       'B',  '28.8%', '128k'],
  ['glm-4.6',                              'GLM 4.6',            'A-', '38.0%', '128k'],
]

// 📖 SambaNova source - https://cloud.sambanova.ai
// 📖 Free trial: $5 credits for 3 months — API keys at https://cloud.sambanova.ai/apis
// 📖 OpenAI-compatible API, supports all major coding models including DeepSeek V3/R1, Qwen3, Llama 4
export const sambanova = [
  // ── S+ tier ──
  ['Qwen3-235B-A22B-Instruct-2507',        'Qwen3 235B',         'S+', '70.0%', '128k'],
  // ── S tier ──
  ['DeepSeek-R1-0528',                     'DeepSeek R1 0528',   'S',  '61.0%', '128k'],
  ['DeepSeek-V3.1',                        'DeepSeek V3.1',      'S',  '62.0%', '128k'],
  ['DeepSeek-V3-0324',                     'DeepSeek V3 0324',   'S',  '62.0%', '128k'],
  ['Llama-4-Maverick-17B-128E-Instruct',   'Llama 4 Maverick',   'S',  '62.0%', '1M'],
  ['gpt-oss-120b',                         'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['deepseek-ai/DeepSeek-V3.1-Terminus',   'DeepSeek V3.1 Term', 'S',  '68.4%', '128k'],
  // ── A+ tier ──
  ['Qwen3-32B',                            'Qwen3 32B',          'A+', '50.0%', '128k'],
  // ── A tier ──
  ['DeepSeek-R1-Distill-Llama-70B',        'R1 Distill 70B',     'A',  '43.9%', '128k'],
  // ── A- tier ──
  ['Meta-Llama-3.3-70B-Instruct',          'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  // ── B tier ──
  ['Meta-Llama-3.1-8B-Instruct',           'Llama 3.1 8B',       'B',  '28.8%', '128k'],
  // ── A tier — requested Llama3-Groq coding tuned family ──
  ['Llama-3-Groq-70B-Tool-Use',            'Llama3-Groq 70B',    'A',  '43.0%', '128k'],
]

// 📖 OpenRouter source - https://openrouter.ai
// 📖 Free :free models with shared quota — 50 free req/day
// 📖 API keys at https://openrouter.ai/keys
export const openrouter = [
  ['qwen/qwen3-coder:480b-free',               'Qwen3 Coder 480B',   'S+', '70.6%', '256k'],
  ['mistralai/devstral-2-free',                'Devstral 2',         'S+', '72.2%', '256k'],
  ['mimo-v2-flash-free',                       'Mimo V2 Flash',      'A',  '45.0%', '128k'],
  ['stepfun/step-3.5-flash:free',              'Step 3.5 Flash',     'S+', '74.4%', '256k'],
  ['deepseek/deepseek-r1-0528:free',           'DeepSeek R1 0528',   'S',  '61.0%', '128k'],
  ['qwen/qwen3-next-80b-a3b-instruct:free',    'Qwen3 80B Instruct', 'S',  '65.0%', '128k'],
  ['openai/gpt-oss-120b:free',                 'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['openai/gpt-oss-20b:free',                  'GPT OSS 20B',        'A',  '42.0%', '128k'],
  ['nvidia/nemotron-3-nano-30b-a3b:free',      'Nemotron Nano 30B',  'A',  '43.0%', '128k'],
  ['meta-llama/llama-3.3-70b-instruct:free',   'Llama 3.3 70B',      'A-', '39.5%', '128k'],
]

// 📖 Hugging Face Inference source - https://huggingface.co
// 📖 OpenAI-compatible endpoint via router.huggingface.co/v1
// 📖 Free monthly credits on developer accounts (~$0.10) — token at https://huggingface.co/settings/tokens
export const huggingface = [
  ['deepseek-ai/DeepSeek-V3-Coder',            'DeepSeek V3 Coder',  'S',  '62.0%', '128k'],
  ['bigcode/starcoder2-15b',                   'StarCoder2 15B',     'B',  '25.0%', '16k'],
]

// 📖 Replicate source - https://replicate.com
// 📖 Uses predictions endpoint (not OpenAI chat-completions) with token auth
export const replicate = [
  ['codellama/CodeLlama-70b-Instruct-hf',      'CodeLlama 70B',      'A-', '39.0%', '16k'],
]

// 📖 DeepInfra source - https://deepinfra.com
// 📖 OpenAI-compatible endpoint: https://api.deepinfra.com/v1/openai/chat/completions
export const deepinfra = [
  ['mistralai/Mixtral-8x22B-Instruct-v0.1',    'Mixtral Code',       'B+', '32.0%', '64k'],
  ['meta-llama/Meta-Llama-3.1-70B-Instruct',   'Llama 3.1 70B',      'A-', '39.5%', '128k'],
]

// 📖 Fireworks AI source - https://fireworks.ai
// 📖 OpenAI-compatible endpoint: https://api.fireworks.ai/inference/v1/chat/completions
// 📖 Free trial credits: $1 for new developers
export const fireworks = [
  ['accounts/fireworks/models/deepseek-v3',    'DeepSeek V3',        'S',  '62.0%', '128k'],
  ['accounts/fireworks/models/deepseek-r1',    'DeepSeek R1',        'S',  '61.0%', '128k'],
]

// 📖 Mistral Codestral source - https://codestral.mistral.ai
// 📖 Free coding model — 30 req/min, 2000/day (phone number required for key)
// 📖 API keys at https://codestral.mistral.ai
export const codestral = [
  ['codestral-latest',                         'Codestral',          'B+', '34.0%', '256k'],
]

// 📖 Hyperbolic source - https://app.hyperbolic.ai
// 📖 $1 free trial credits — API keys at https://app.hyperbolic.xyz/settings
export const hyperbolic = [
  ['qwen/qwen3-coder-480b-a35b-instruct',      'Qwen3 Coder 480B',   'S+', '70.6%', '256k'],
  ['deepseek-ai/DeepSeek-R1-0528',             'DeepSeek R1 0528',   'S',  '61.0%', '128k'],
  ['moonshotai/Kimi-K2-Instruct',              'Kimi K2 Instruct',   'S',  '65.8%', '131k'],
  ['openai/gpt-oss-120b',                      'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['Qwen/Qwen3-235B-A22B',                     'Qwen3 235B',         'S+', '70.0%', '128k'],
  ['qwen/qwen3-next-80b-a3b-instruct',         'Qwen3 80B Instruct', 'S',  '65.0%', '128k'],
  ['deepseek-ai/DeepSeek-V3-0324',             'DeepSeek V3 0324',   'S',  '62.0%', '128k'],
  ['Qwen/Qwen2.5-Coder-32B-Instruct',          'Qwen2.5 Coder 32B',  'A',  '46.0%', '32k'],
  ['meta-llama/Llama-3.3-70B-Instruct',        'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['meta-llama/Meta-Llama-3.1-405B-Instruct',  'Llama 3.1 405B',     'A',  '44.0%', '128k'],
]

// 📖 Scaleway source - https://console.scaleway.com
// 📖 1M free tokens — API keys at https://console.scaleway.com/iam/api-keys
export const scaleway = [
  ['devstral-2-123b-instruct-2512',            'Devstral 2 123B',    'S+', '72.2%', '256k'],
  ['qwen3-235b-a22b-instruct-2507',            'Qwen3 235B',         'S+', '70.0%', '128k'],
  ['gpt-oss-120b',                             'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['qwen3-coder-30b-a3b-instruct',             'Qwen3 Coder 30B',    'A+', '55.0%', '32k'],
  ['llama-3.3-70b-instruct',                   'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['deepseek-r1-distill-llama-70b',            'R1 Distill 70B',     'A',  '43.9%', '128k'],
  ['mistral-small-3.2-24b-instruct-2506',      'Mistral Small 3.2',  'B+', '30.0%', '128k'],
]

// 📖 Google AI Studio source - https://aistudio.google.com
// 📖 Free Gemma models — 14.4K req/day, API keys at https://aistudio.google.com/apikey
export const googleai = [
  ['gemma-3-27b-it',                           'Gemma 3 27B',        'B',  '22.0%', '128k'],
  ['gemma-3-12b-it',                           'Gemma 3 12B',        'C',  '15.0%', '128k'],
  ['gemma-3-4b-it',                            'Gemma 3 4B',         'C',  '10.0%', '128k'],
]

// 📖 ZAI source - https://open.z.ai
// 📖 Free API keys available at https://open.z.ai — GLM frontier models
// 📖 OpenAI-compatible endpoint for coding tasks
export const zai = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['zai/glm-5',                                           'GLM-5',               'S+', '77.8%', '128k'],
  ['zai/glm-4.7',                                         'GLM-4.7',             'S+', '73.8%', '200k'],
  ['zai/glm-4.5',                                         'GLM-4.5',             'S+', '75.0%', '128k'],
  ['zai/glm-4.5-air',                                     'GLM-4.5-Air',         'S+', '72.0%', '128k'],
  ['zai/glm-4.6',                                         'GLM-4.6',             'S+', '70.0%', '128k'],
]

// 📖 SiliconFlow source - https://cloud.siliconflow.cn
// 📖 OpenAI-compatible endpoint: https://api.siliconflow.com/v1/chat/completions
// 📖 Free model quotas vary by model and can change over time.
export const siliconflow = [
  ['Qwen/Qwen3-Coder-480B-A35B-Instruct',      'Qwen3 Coder 480B',   'S+', '70.6%', '256k'],
  ['deepseek-ai/DeepSeek-V3.2',                'DeepSeek V3.2',      'S+', '73.1%', '128k'],
  ['Qwen/Qwen3-235B-A22B',                     'Qwen3 235B',         'S+', '70.0%', '128k'],
  ['deepseek-ai/DeepSeek-R1',                  'DeepSeek R1',        'S',  '61.0%', '128k'],
  ['Qwen/Qwen3-Coder-30B-A3B-Instruct',        'Qwen3 Coder 30B',    'A+', '55.0%', '32k'],
  ['Qwen/Qwen2.5-Coder-32B-Instruct',          'Qwen2.5 Coder 32B',  'A',  '46.0%', '32k'],
]

// 📖 Together AI source - https://api.together.ai
// 📖 OpenAI-compatible endpoint: https://api.together.xyz/v1/chat/completions
// 📖 Credits/promotions vary by account and region; verify current quota in console.
export const together = [
  ['moonshotai/Kimi-K2.5',                     'Kimi K2.5',          'S+', '76.8%', '128k'],
  ['Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8',  'Qwen3 Coder 480B',   'S+', '70.6%', '256k'],
  ['deepseek-ai/DeepSeek-V3.1',                'DeepSeek V3.1',      'S',  '62.0%', '128k'],
  ['deepseek-ai/DeepSeek-R1',                  'DeepSeek R1',        'S',  '61.0%', '128k'],
  ['openai/gpt-oss-120b',                      'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['openai/gpt-oss-20b',                       'GPT OSS 20B',        'A',  '42.0%', '128k'],
  ['meta-llama/Llama-3.3-70B-Instruct-Turbo',  'Llama 3.3 70B',      'A-', '39.5%', '128k'],
]

// 📖 Cloudflare Workers AI source - https://developers.cloudflare.com/workers-ai
// 📖 OpenAI-compatible endpoint requires account id:
// 📖 https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
// 📖 Free plan includes daily neuron quota and provider-level request limits.
export const cloudflare = [
  ['@cf/openai/gpt-oss-120b',                  'GPT OSS 120B',       'S',  '60.0%', '128k'],
  ['@cf/qwen/qwen2.5-coder-32b-instruct',      'Qwen2.5 Coder 32B',  'A',  '46.0%', '32k'],
  ['@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', 'R1 Distill 32B', 'A',  '43.9%', '128k'],
  ['@cf/openai/gpt-oss-20b',                   'GPT OSS 20B',        'A',  '42.0%', '128k'],
  ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B',      'A-', '39.5%', '128k'],
  ['@cf/meta/llama-3.1-8b-instruct',           'Llama 3.1 8B',       'B',  '28.8%', '128k'],
]

// 📖 Perplexity source - https://docs.perplexity.ai
// 📖 Chat Completions endpoint: https://api.perplexity.ai/chat/completions
// 📖 Sonar models focus on search/reasoning and have tiered API rate limits.
export const perplexity = [
  ['sonar-reasoning-pro',                      'Sonar Reasoning Pro', 'A+', '50.0%', '128k'],
  ['sonar-reasoning',                          'Sonar Reasoning',     'A',  '45.0%', '128k'],
  ['sonar-pro',                                'Sonar Pro',           'B+', '32.0%', '128k'],
  ['sonar',                                    'Sonar',               'B',  '25.0%', '128k'],
]

// 📖 Alibaba Cloud (DashScope) source - https://dashscope-intl.aliyuncs.com
// 📖 OpenAI-compatible endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
// 📖 Free tier: 1M tokens per model (Singapore region only), valid for 90 days
// 📖 Get API key: https://modelstudio.console.alibabacloud.com
// 📖 Env var: DASHSCOPE_API_KEY
// 📖 Qwen3-Coder models: optimized coding models with excellent SWE-bench scores
export const qwen = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['qwen3-coder-plus',                        'Qwen3 Coder Plus',    'S+', '69.6%', '256k'],
  ['qwen3-coder-480b-a35b-instruct',          'Qwen3 Coder 480B',    'S+', '70.6%', '256k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen3-coder-max',                         'Qwen3 Coder Max',     'S',  '67.0%', '256k'],
  ['qwen3-coder-next',                        'Qwen3 Coder Next',    'S',  '65.0%', '256k'],
  ['qwen3-235b-a22b-instruct',                'Qwen3 235B',          'S',  '70.0%', '256k'],
  ['qwen3-next-80b-a3b-instruct',             'Qwen3 80B Instruct',  'S',  '65.0%', '128k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['qwen3-32b',                               'Qwen3 32B',           'A+', '50.0%', '128k'],
  ['qwen2.5-coder-32b-instruct',              'Qwen2.5 Coder 32B',   'A',  '46.0%', '32k'],
]

// 📖 iFlow source - https://platform.iflow.cn
// 📖 OpenAI-compatible endpoint: https://apis.iflow.cn/v1/chat/completions
// 📖 Free for individual users with no request limits (API key expires every 7 days)
// 📖 Provides high-performance models including DeepSeek, Qwen3, Kimi K2, GLM, and TBStars2
export const iflow = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['TBStars2-200B-A13B',                      'TBStars2 200B',       'S+', '77.8%', '128k'],
  ['deepseek-v3.2',                           'DeepSeek V3.2',       'S+', '73.1%', '128k'],
  ['qwen3-coder-plus',                        'Qwen3 Coder Plus',    'S+', '72.0%', '256k'],
  ['qwen3-235b-a22b-instruct',                'Qwen3 235B',          'S+', '70.0%', '256k'],
  ['deepseek-r1',                             'DeepSeek R1',         'S+', '70.6%', '128k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['kimi-k2',                                 'Kimi K2',             'S',  '65.8%', '128k'],
  ['kimi-k2-0905',                            'Kimi K2 0905',        'S',  '68.0%', '256k'],
  ['glm-4.6',                                 'GLM 4.6',             'S',  '62.0%', '200k'],
  ['deepseek-v3',                             'DeepSeek V3',         'S',  '62.0%', '128k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['qwen3-32b',                               'Qwen3 32B',           'A+', '50.0%', '128k'],
  ['qwen3-max',                               'Qwen3 Max',           'A+', '55.0%', '256k'],
]

// 📖 All sources combined - used by the main script
// 📖 Each source has: name (display), url (API endpoint), models (array of model tuples)
export const sources = {
  nvidia: {
    name: 'NIM',
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
  sambanova: {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    models: sambanova,
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: openrouter,
  },
  huggingface: {
    name: 'Hugging Face',
    url: 'https://router.huggingface.co/v1/chat/completions',
    models: huggingface,
  },
  replicate: {
    name: 'Replicate',
    url: 'https://api.replicate.com/v1/predictions',
    models: replicate,
  },
  deepinfra: {
    name: 'DeepInfra',
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    models: deepinfra,
  },
  fireworks: {
    name: 'Fireworks',
    url: 'https://api.fireworks.ai/inference/v1/chat/completions',
    models: fireworks,
  },
  codestral: {
    name: 'Codestral',
    url: 'https://codestral.mistral.ai/v1/chat/completions',
    models: codestral,
  },
  hyperbolic: {
    name: 'Hyperbolic',
    url: 'https://api.hyperbolic.xyz/v1/chat/completions',
    models: hyperbolic,
  },
  scaleway: {
    name: 'Scaleway',
    url: 'https://api.scaleway.ai/v1/chat/completions',
    models: scaleway,
  },
  googleai: {
    name: 'Google AI',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: googleai,
  },
  zai: {
    name: 'ZAI',
    url: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
    models: zai,
  },
  siliconflow: {
    name: 'SiliconFlow',
    url: 'https://api.siliconflow.com/v1/chat/completions',
    models: siliconflow,
  },
  together: {
    name: 'Together AI',
    url: 'https://api.together.xyz/v1/chat/completions',
    models: together,
  },
  cloudflare: {
    name: 'Cloudflare AI',
    url: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions',
    models: cloudflare,
  },
  perplexity: {
    name: 'Perplexity',
    url: 'https://api.perplexity.ai/chat/completions',
    models: perplexity,
  },
  qwen: {
    name: 'Alibaba Cloud (DashScope)',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: qwen,
  },
  iflow: {
    name: 'iFlow',
    url: 'https://apis.iflow.cn/v1/chat/completions',
    models: iflow,
  },
}

// 📖 Flatten all models from all sources — each entry includes providerKey as 6th element
// 📖 providerKey lets the main CLI know which API key and URL to use per model
export const MODELS = []
for (const [sourceKey, sourceData] of Object.entries(sources)) {
  for (const [modelId, label, tier, sweScore, ctx] of sourceData.models) {
    MODELS.push([modelId, label, tier, sweScore, ctx, sourceKey])
  }
}
