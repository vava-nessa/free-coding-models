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
 *   @exports nvidiaNim, groq, cerebras, sambanova, openrouter, githubModels, mistral, codestral, scaleway, googleai, zai, qwen, cloudflare, ovhcloud, opencodeZen, kilo, llm7, routeway, novita, ollamaCloud — model arrays per active provider
 *   @exports sources — map of active free/free-limited providers, each with { name, url, models }

 *   @exports MODELS — flat array of [modelId, label, tier, sweScore, ctx, providerKey]
 *
 *   📖 MODELS now includes providerKey as 6th element so ping() knows which
 *      API endpoint and API key to use for each model.
 */

// 📖 NIM source - https://build.nvidia.com
export const nvidiaNim = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['minimaxai/minimax-m2.7', 'MiniMax M2.7', 'S+', '78.0%', '200k'],
  ['z-ai/glm-5.2', 'GLM 5.1', 'S+', '82.8%', '128k'],
  ['moonshotai/kimi-k2.6', 'Kimi K2.6', 'S+', '80.2%', '262k'],
  ['deepseek-ai/deepseek-v4-pro', 'DeepSeek V4 Pro', 'S+', '80.6%', '1M'],
  ['deepseek-ai/deepseek-v4-flash', 'DeepSeek V4 Flash', 'S+', '79.0%', '1M'],
  ['stepfun-ai/step-3.7-flash', 'Step 3.7 Flash', 'S+', '74.4%', '256k'],
  ['nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra', 'S+', '71.9%', '1M'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['openai/gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  ['meta/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick', 'S+', '74.8%', '1M'],
  ['mistralai/mistral-medium-3.5-128b', 'Mistral Medium 3.5', 'S+', '77.6%', '128k'],
  ['mistralai/mistral-small-4-119b-2603', 'Mistral Small 4', 'S', '60.0%', '256k'],
  ['minimaxai/minimax-m3', 'MiniMax M3', 'S+', '78.4%', '1M'],
  ['qwen/qwen3-coder-480b-a35b-instruct', 'Qwen3 Coder 480B', 'S', '69.6%', '262k'],
  ['nvidia/mistral-nemotron', 'Mistral Nemotron', 'S', '-', '-'],
  ['deepseek-ai/deepseek-v3.2', 'DeepSeek V3.2', 'S+', '70.0%', '160k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['mistralai/mistral-large-3-675b-instruct-2512', 'Mistral Large 675B', 'A+', '58.0%', '256k'],
  ['nvidia/nemotron-3-super-120b-a12b', 'Nemotron 3 Super', 'S', '60.5%', '128k'],
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'Nemotron 3 Omni', 'A+', '52.0%', '128k'],
  ['meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 'B', '28.0%', '10M'],
  ['nvidia/llama-3.3-nemotron-super-49b-v1.5', 'Llama 3.3 Nemotron Super 49B v1.5', 'A+', '-', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['nvidia/nemotron-3-nano-30b-a3b', 'Nemotron Nano 30B', 'A-', '38.8%', '1M'],
  ['openai/gpt-oss-20b', 'GPT OSS 20B', 'A+', '50.3%', '128k'],
  ['google/gemma-4-31b-it', 'Gemma 4 31B', 'A+', '52.0%', '256k'],
  ['qwen/qwen2.5-coder-32b-instruct', 'Qwen2.5 Coder 32B', 'A', '47.0%', '128k'],
  ['mistralai/magistral-small-2506', 'Magistral Small 2506', 'A', '45.0%', '128k'],
  ['nvidia/nemotron-3-nano', 'Nemotron 3 Nano', 'A-', '38.8%', '256k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['bytedance/seed-oss-36b-instruct', 'Seed OSS 36B', 'A+', '56.0%', '32k'],
  ['stockmark/stockmark-2-100b-instruct', 'Stockmark 100B', 'A-', '36.0%', '32k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['mistralai/ministral-14b-instruct-2512', 'Ministral 14B', 'B+', '34.0%', '32k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['meta/llama-3.2-11b-vision-instruct', 'Llama 3.2 11B Vision', 'B', '28.0%', '128k'],
  // ── C tier — lightweight/edge models ──
  ['microsoft/phi-4-mini-instruct', 'Phi 4 Mini', 'C', '14.0%', '128k'],
]

// 📖 Groq source - https://console.groq.com
// 📖 Free API keys available at https://console.groq.com/keys
export const groq = [
  ['llama-3.3-70b-versatile',              'Llama 3.3 70B',      'B', '22.0%', '131k'],
  ['meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout',  'B',  '28.0%', '131k'],
  ['llama-3.1-8b-instant',                 'Llama 3.1 8B',       'C',  '18.0%', '131k'],
  ['openai/gpt-oss-120b',                  'GPT OSS 120B',       'S',  '62.4%', '131k'],
  ['openai/gpt-oss-20b',                   'GPT OSS 20B',        'A+',  '50.3%', '131k'],
  ['qwen/qwen3-32b',                       'Qwen3 32B',          'B+', '30.0%', '131k'],
  ['qwen/qwen3.6-27b',                     'Qwen3.6 27B',        'S+',  '77.2%',     '131k'],
  ['groq/compound',                        'Groq Compound',      'A',  '45.0%', '131k'],
  ['groq/compound-mini',                   'Groq Compound Mini', 'B+', '32.0%', '131k'],
]

// 📖 Cerebras source - https://cloud.cerebras.ai
// 📖 Free API keys available at https://cloud.cerebras.ai
export const cerebras = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['zai-glm-4.7', 'GLM 4.7', 'S+', '73.8%', '128k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['gemma-4-31b', 'Gemma 4 31B', 'A+', '52.0%', '128k'],
]

// 📖 SambaNova source - https://cloud.sambanova.ai
// 📖 Developer tier limits are small but still useful for smoke tests and occasional coding.
// 📖 Keep this catalog conservative: only models surfaced in current SambaNova docs.
export const sambanova = [
  // ── S+ tier ──
  ['MiniMax-M2.7',                         'MiniMax M2.7',       'S+', '78.0%', '192k'],
  // ── S tier ──
  ['DeepSeek-V3.1',                        'DeepSeek V3.1',      'S',  '66.0%', '128k'],
  ['DeepSeek-V3.2',                        'DeepSeek V3.2',      'S+', '70.0%', '32k'],
  ['gpt-oss-120b',                         'GPT OSS 120B',       'S',  '62.4%', '128k'],
  // ── A tier ──
  ['gemma-4-31B-it',                       'Gemma 4 31B',        'A+',  '52.0%', '128k'],
  // ── A- tier ──
  ['Meta-Llama-3.3-70B-Instruct',          'Llama 3.3 70B',      'B', '22.0%', '128k'],
  // ── B+ tier ──
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
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra', 'S+', '71.9%', '1M'],
  ['poolside/laguna-m.1:free', 'Poolside Laguna M.1', 'S+', '72.5%', '262k'],
  ['poolside/laguna-xs.2:free', 'Poolside Laguna XS.2', 'S', '68.2%', '262k'],
  ['poolside/laguna-xs-2.1:free', 'Poolside Laguna XS 2.1', 'S+', '70.9%', '262k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['openai/gpt-oss-120b:free', 'GPT OSS 120B', 'S', '62.4%', '131k'],
  ['cohere/north-mini-code:free', 'North Mini Code', 'S', '-', '256k'],
  ['tencent/hy3:free', 'Tencent Hy3', 'S', '-', '262k'],
  ['qwen/qwen3-coder:free', 'Qwen3 Coder', 'S', '69.6%', '1M'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['nvidia/nemotron-3-super-120b-a12b:free', 'Nemotron 3 Super', 'S', '60.5%', '1M'],
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'Nemotron 3 Omni', 'A+', '52.0%', '256k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['openai/gpt-oss-20b:free', 'GPT OSS 20B', 'A+', '50.3%', '131k'],
  ['nvidia/nemotron-3-nano-30b-a3b:free', 'Nemotron Nano 30B', 'A-', '38.8%', '256k'],
  ['nvidia/nemotron-nano-12b-v2-vl:free', 'Nemotron Nano 12B VL', 'A', '20.0%', '128k'],
  ['google/gemma-4-31b-it:free', 'Gemma 4 31B', 'A+', '52.0%', '262k'],
  ['google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B MoE', 'A', '38.0%', '262k'],
  ['meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B Instruct', 'B', '22.0%', '131k'],
  ['nousresearch/hermes-3-llama-3.1-405b:free', 'Hermes 3 Llama 3.1 405B', 'A', '-', '131k'],
  ['qwen/qwen3-next-80b-a3b-instruct:free', 'Qwen3 Next 80B A3B', 'S+', '70.6%', '262k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['nvidia/nemotron-nano-9b-v2:free', 'Nemotron Nano 9B', 'B+', '18.0%', '128k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['openrouter/free', 'OpenRouter Free', 'B', '-', '200k'],
  ['meta-llama/llama-3.2-3b-instruct:free', 'Llama 3.2 3B Instruct', 'B', '-', '131k'],
  ['cognitivecomputations/dolphin-mistral-24b-venice-edition:free', 'Dolphin Mistral 24B Venice', 'B', '-', '32k'],
  // ── C tier — lightweight/edge models ──
  ['nvidia/nemotron-3.5-content-safety:free', 'Nemotron 3.5 Content Safety', 'C', '-', '128k'],
  ['liquid/lfm-2.5-1.2b-instruct:free', 'LFM 2.5 1.2B Instruct', 'C', '-', '32k'],
  ['liquid/lfm-2.5-1.2b-thinking:free', 'LFM 2.5 1.2B Thinking', 'C', '-', '32k'],
]

// 📖 GitHub Models source - https://models.github.ai
// 📖 OpenAI-compatible endpoint: https://models.github.ai/inference/chat/completions
// 📖 Free usage is quota-limited by GitHub/Copilot tier, but no separate provider billing is needed.
export const githubModels = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['openai/gpt-4.1', 'GPT-4.1', 'A+', '54.6%', '1M'],
  ['openai/gpt-5', 'GPT-5', 'S+', '74.9%', '200k'],
  ['openai/gpt-5-chat', 'GPT-5 Chat (preview)', 'S+', '-', '200k'],
  ['openai/o3', 'OpenAI o3', 'S', '69.1%', '200k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['openai/gpt-4.1-mini', 'GPT-4.1 Mini', 'B', '23.6%', '1M'],
  ['deepseek/deepseek-v3-0324', 'DeepSeek V3 0324', 'A', '45.4%', '128k'],
  ['meta/llama-4-maverick-17b-128e-instruct-fp8', 'Llama 4 Maverick', 'S+', '74.8%', '1M'],
  ['openai/gpt-5-mini', 'GPT-5 Mini', 'S', '60.0%', '200k'],
  ['openai/gpt-4o', 'GPT-4o', 'B+', '33.2%', '128k'],
  ['openai/o4-mini', 'OpenAI o4-mini', 'S', '68.1%', '200k'],
  ['openai/o1', 'OpenAI o1', 'A', '48.9%', '200k'],
  ['deepseek/deepseek-r1', 'DeepSeek-R1', 'A', '49.2%', '128k'],
  ['deepseek/deepseek-r1-0528', 'DeepSeek-R1-0528', 'A+', '57.6%', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['openai/gpt-4.1-nano', 'GPT-4.1 Nano', 'A', '-', '1M'],
  ['meta/meta-llama-3.1-405b-instruct', 'Llama 3.1 405B', 'A', '40.6%', '128k'],
  ['meta/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 'B', '28.0%', '10M'],
  ['mistral-ai/mistral-medium-2505', 'Mistral Medium 2505', 'A', '48.0%', '128k'],
  ['openai/gpt-5-nano', 'GPT-5 Nano', 'A', '-', '200k'],
  ['openai/gpt-4o-mini', 'GPT-4o Mini', 'A', '-', '128k'],
  ['openai/o3-mini', 'OpenAI o3-mini', 'A', '49.3%', '200k'],
  ['openai/o1-preview', 'OpenAI o1-preview', 'A', '41.3%', '128k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['meta/llama-3.3-70b-instruct', 'Llama 3.3 70B', 'B', '22.0%', '128k'],
  ['meta/llama-3.2-90b-vision-instruct', 'Llama 3.2 90B Vision', 'A-', '-', '128k'],
  ['cohere/cohere-command-a', 'Cohere Command A', 'C', '7.8%', '128k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['mistral-ai/codestral-2501', 'Codestral 2501', 'B+', '34.0%', '256k'],
  ['mistral-ai/mistral-small-2503', 'Mistral Small 2503', 'B+', '30.0%', '128k'],
  ['openai/o1-mini', 'OpenAI o1-mini', 'B+', '-', '128k'],
  ['microsoft/phi-4', 'Phi-4', 'B+', '-', '16k'],
  ['microsoft/phi-4-reasoning', 'Phi-4-reasoning', 'B+', '-', '32k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['meta/llama-3.2-11b-vision-instruct', 'Llama 3.2 11B Vision', 'B', '-', '128k'],
  ['meta/meta-llama-3.1-8b-instruct', 'Llama 3.1 8B', 'C', '18.0%', '128k'],
  ['microsoft/phi-4-mini-instruct', 'Phi-4-mini-instruct', 'B', '-', '128k'],
  ['microsoft/phi-4-mini-reasoning', 'Phi-4-mini-reasoning', 'B', '-', '128k'],
  ['microsoft/phi-4-multimodal-instruct', 'Phi-4-multimodal-instruct', 'B', '-', '128k'],
  // ── C tier — lightweight/edge models ──
  ['mistral-ai/ministral-3b', 'Ministral 3B', 'C', '-', '128k'],
]

// 📖 Mistral La Plateforme source - https://console.mistral.ai
// 📖 Experiment plan is free for evaluation/prototyping and exposes general + coding models.
// 📖 Keep Codestral as a separate provider key for backward compatibility with existing configs.
export const mistral = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['mistral-large-2512', 'Mistral Large 3', 'S+', '70.0%', '256k'],
  ['mistral-medium-3-5', 'Mistral Medium 3.5', 'S+', '77.6%', '256k'],
  ['devstral-2512', 'Devstral 2', 'S+', '72.2%', '256k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['mistral-small-2603', 'Mistral Small 4', 'A', '48.0%', '256k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['ministral-3-14b-25-12', 'Ministral 3 14B', 'B+', '-', '128k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['ministral-3-8b-25-12', 'Ministral 3 8B', 'B', '-', '128k'],
  ['ministral-3-3b-25-12', 'Ministral 3 3B', 'B', '-', '128k'],
]

// 📖 Mistral Codestral source - https://codestral.mistral.ai
// 📖 Free coding model — 30 req/min, 2000/day (phone number required for key)
// 📖 API keys now use the Mistral platform key format; CODESTRAL_API_KEY remains supported as an alias.
export const codestral = [
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['codestral-2508', 'Codestral', 'A', '40.0%', '128k'],
  ['codestral-2', 'Codestral 2', 'B+', '-', '128k'],
]

// 📖 Scaleway source - https://console.scaleway.com
// 📖 1M free tokens — API keys at https://console.scaleway.com/iam/api-keys
export const scaleway = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['devstral-2-123b-instruct-2512', 'Devstral 2 123B', 'S+', '72.2%', '200k'],
  ['qwen3-235b-a22b-instruct-2507', 'Qwen3 235B', 'A', '45.2%', '250k'],
  ['glm-5.2', 'GLM 5.2', 'S+', '82.8%', '256k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen3.5-397b-a17b', 'Qwen3.5 400B VLM', 'S+', '76.2%', '250k'],
  ['gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  ['mistral-medium-3.5-128b', 'Mistral Medium 3.5 128B', 'S+', '77.6%', '256k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['mistral-large-3-675b-instruct-2512', 'Mistral Large 675B', 'A+', '58.0%', '250k'],
  ['qwen3-coder-30b-a3b-instruct', 'Qwen3 Coder 30B', 'A+', '51.6%', '128k'],
  ['qwen3.6-35b-a3b', 'Qwen3.6 35B MoE', 'S+', '73.4%', '256k'],
  ['holo2-30b-a3b', 'Holo2 30B', 'A+', '52.0%', '22k'],
  ['gemma-4-26b-a4b-it', 'Gemma 4 26B MoE', 'A+', '-', '256k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['llama-3.3-70b-instruct', 'Llama 3.3 70B', 'B', '22.0%', '100k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['mistral-small-3.2-24b-instruct-2506', 'Mistral Small 3.2', 'B', '20.0%', '128k'],
  ['pixtral-12b-2409', 'Pixtral 12B', 'B+', '-', '128k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['gemma-3-27b-it', 'Gemma 3 27B', 'B', '22.0%', '40k'],
]

// 📖 Google AI Studio source - https://aistudio.google.com
// 📖 OpenAI-compatible endpoint exposes Gemini models; free quotas vary by model and region.
export const googleai = [
  ['gemini-3.5-flash',                          'Gemini 3.5 Flash',             'S+', '78.0%',     '1M'],
  ['gemini-3.1-pro-preview',                    'Gemini 3.1 Pro Preview',       'S+', '80.6%', '1M'],
  ['gemini-3-flash-preview',                    'Gemini 3 Flash Preview',       'S+',  '78.0%', '1M'],
  ['gemini-3.1-flash-lite',                     'Gemini 3.1 Flash Lite',        'S', '62.8%', '1M'],
  ['gemini-2.5-pro',                            'Gemini 2.5 Pro',               'S', '63.8%', '1M'],
  ['gemini-2.5-flash',                          'Gemini 2.5 Flash',             'A+', '54.0%', '1M'],
  ['gemini-2.5-flash-lite',                     'Gemini 2.5 Flash Lite',        'A',  '42.6%', '1M'],
]

// 📖 ZAI source - https://open.z.ai
// 📖 Free tier is limited to Flash models; paid GLM models are intentionally excluded.
export const zai = [
  // ── S tier — SWE-bench Verified 60–70% ──
  ['zai/glm-4.7-flash', 'GLM-4.7-Flash', 'A+', '59.2%', '203k'],
  ['zai/glm-4.5-flash', 'GLM-4.5-Flash', 'S', '59.2%', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['zai/glm-4.6v-flash', 'GLM-4.6V-Flash', 'A', '-', '128k'],
]

// 📖 Alibaba Cloud (DashScope) source - https://dashscope-intl.aliyuncs.com
// 📖 OpenAI-compatible endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
// 📖 Free tier: 1M tokens per model (Singapore region only), valid for 90 days
// 📖 Get API key: https://modelstudio.console.alibabacloud.com
// 📖 Env var: DASHSCOPE_API_KEY
// 📖 Qwen3-Coder models: optimized coding models with excellent SWE-bench scores
export const qwen = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['qwen3.7-max', 'Qwen3.7 Max', 'S+', '80.4%', '1M'],
  ['qwen3-max', 'Qwen3 Max', 'S+', '78.8%', '256k'],
  ['qwen3.6-plus', 'Qwen3.6 Plus', 'S+', '78.8%', '1M'],
  ['qwen3-235b-a22b', 'Qwen3 235B', 'S+', '70.0%', '128k'],
  ['qwen3.7-plus', 'Qwen3.7 Plus', 'S+', '-', '1M'],
  ['qwen3.6-max-preview', 'Qwen3.6 Max Preview', 'S+', '80.9%', '256k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen3.5-plus', 'Qwen3.5 Plus', 'S+', '80.0%', '1M'],
  ['qwen3-coder-plus', 'Qwen3 Coder Plus', 'S', '69.6%', '1M'],
  ['qwen3-coder-next', 'Qwen3 Coder Next', 'S+', '70.6%', '256k'],
  ['qwen3-coder-480b-a35b-instruct', 'Qwen3 Coder 480B', 'S', '69.6%', '256k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['qwen3.6-flash', 'Qwen3.6 Flash', 'A+', '60.0%', '1M'],
  ['qwen3.5-flash', 'Qwen3.5 Flash', 'S', '64.4%', '1M'],
  ['qwen3-coder-flash', 'Qwen3 Coder Flash', 'A+', '55.0%', '1M'],
  ['qwen3-32b', 'Qwen3 32B', 'B+', '30.0%', '128k'],
  ['qwen3.5-397b-a17b', 'Qwen3.5 397B A17B', 'S+', '76.2%', '256k'],
  ['qwen3.5-122b-a10b', 'Qwen3.5 122B A10B', 'S+', '72.0%', '256k'],
  ['qwen3.5-35b-a3b', 'Qwen3.5 35B A3B', 'S', '69.2%', '256k'],
  ['qwen3-next-80b-a3b-thinking', 'Qwen3 Next 80B Thinking', 'S+', '70.6%', '128k'],
  ['qwen3-next-80b-a3b-instruct', 'Qwen3 Next 80B Instruct', 'S+', '70.6%', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['qwen3.5-27b', 'Qwen3.5 27B', 'S+', '72.4%', '256k'],
  ['qwen3-30b-a3b', 'Qwen3 30B A3B', 'B', '25.2%', '128k'],
]

// 📖 Cloudflare Workers AI source - https://developers.cloudflare.com/workers-ai
// 📖 OpenAI-compatible endpoint requires account id:
// 📖 https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
// 📖 Free plan includes daily neuron quota and provider-level request limits.
export const cloudflare = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['@cf/moonshotai/kimi-k2.6', 'Kimi K2.6', 'S+', '80.2%', '262k'],
  ['@cf/moonshotai/kimi-k2.7-code', 'Kimi K2.7 Code', 'S', '60.4%', '262k'],
  ['@cf/zai-org/glm-5.2', 'GLM-5.2', 'S+', '82.8%', '262k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['@cf/zai-org/glm-4.7-flash', 'GLM-4.7-Flash', 'A+', '59.2%', '131k'],
  ['@cf/openai/gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['@cf/nvidia/nemotron-3-120b-a12b', 'Nemotron 3 Super', 'S', '60.5%', '128k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['@cf/meta/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout', 'B', '28.0%', '131k'],
  ['@cf/qwen/qwen3-30b-a3b-fp8', 'Qwen3 30B MoE', 'B', '25.2%', '128k'],
  ['@cf/qwen/qwen2.5-coder-32b-instruct', 'Qwen2.5 Coder 32B', 'A', '47.0%', '128k'],
  ['@cf/openai/gpt-oss-20b', 'GPT OSS 20B', 'A+', '50.3%', '128k'],
  ['@cf/qwen/qwq-32b', 'QwQ 32B', 'A', '-', '128k'],
  ['@cf/deepseek/deepseek-r1-distill-qwen-32b', 'DeepSeek R1 Distill Qwen 32B', 'A', '-', '128k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B', 'B', '22.0%', '128k'],
  ['@cf/google/gemma-4-26b-a4b-it', 'Gemma 4 26B MoE', 'A-', '38.0%', '128k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['@cf/mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1', 'B+', '30.0%', '128k'],
  ['@cf/ibm/granite-4.0-h-micro', 'Granite 4.0 Micro', 'B+', '30.0%', '128k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['@cf/meta/llama-3.1-8b-instruct-fast', 'Llama 3.1 8B Instruct (Fast)', 'C', '18.0%', '128k'],
]

// 📖 OVHcloud AI Endpoints - https://endpoints.ai.cloud.ovh.net
// 📖 OpenAI-compatible API with European data sovereignty (GDPR)
// 📖 Free sandbox: 2 req/min per IP per model (no API key needed), 400 RPM with API key
// 📖 Env var: OVH_AI_ENDPOINTS_ACCESS_TOKEN
export const ovhcloud = [
  ['Qwen3.5-397B-A17B',                         'Qwen3.5 397B MoE',    'S+',  '76.2%',     '262k'],
  ['Qwen3.6-27B',                               'Qwen3.6 27B',         'S+',  '77.2%',     '262k'],
  ['Qwen3-Coder-30B-A3B-Instruct',             'Qwen3 Coder 30B MoE',  'A+', '51.6%', '256k'],
  ['gpt-oss-120b',                              'GPT OSS 120B',         'S',  '62.4%', '131k'],
  ['gpt-oss-20b',                               'GPT OSS 20B',          'A+',  '50.3%', '131k'],
  ['Meta-Llama-3_3-70B-Instruct',               'Llama 3.3 70B',        'B', '22.0%', '131k'],
  ['Qwen3-32B',                                 'Qwen3 32B',            'B+', '30.0%', '32k'],
  ['Mistral-Small-3.2-24B-Instruct-2506',       'Mistral Small 3.2',    'B', '20.0%', '128k'],
  ['Mistral-7B-Instruct-v0.3',                  'Mistral 7B Instruct',  'B',  '25.0%', '127k'],
  ['Mistral-Nemo-Instruct-2407',                'Mistral Nemo',         'B+', '30.0%', '118k'],
  ['Qwen3.5-9B',                                'Qwen3.5 9B',           'B+', '30.0%', '262k'],
  // ── Embeddings ──
  ['Qwen3-Embedding-8B',                        'Qwen3 Embedding 8B',   'B',  '-',     '-'],
  ['bge-m3',                                    'BGE M3',               'B',  '-',     '-'],
  ['bge-multilingual-gemma2',                   'BGE Multilingual Gemma2','B','-',     '-'],
  // Fix (2026-05-26): Qwen3.5-9B ctx 128k→262k, Mistral-Small ctx 131k→128k, Mistral-Nemo ctx 128k→118k, Mistral-7B ctx 32k→127k
]



// 📖 OpenCode Zen free models — hosted AI gateway accessed through OpenCode CLI/Desktop
// 📖 Endpoint: https://opencode.ai/zen/v1/... — requires OpenCode Zen API key
// 📖 These models are FREE on the Zen platform and only run on OpenCode CLI or OpenCode Desktop
// 📖 Login: https://opencode.ai/auth — get your Zen API key
// 📖 Config: set provider to opencode/<model-id> in OpenCode config
export const opencodeZen = [
  ['big-pickle',                       'Big Pickle',              'S+', '72.0%', '200k'],
  ['deepseek-v4-flash-free',           'DeepSeek V4 Flash Free',  'S+', '79.0%', '200k'],
  ['mimo-v2.5-free',                   'MiMo-V2.5 Free',          'S+', '-',     '200k'],
  ['nemotron-3-ultra-free',            'Nemotron 3 Ultra Free',   'S+', '71.9%',     '200k'],
  ['north-mini-code-free',             'North Mini Code Free',    'B+', '-',     '200k'],
]

// 📖 Kilo source - https://api.kilo.ai/api/gateway
// 📖 OpenAI-compatible gateway. `kilo-auto/free` works without a key and routes to Kilo's current free model pool.
// 📖 Keep only the stable router model here; individual promo `:free` models churn too quickly.
export const kilo = [
  ['kilo-auto/free',                         'Kilo Auto Free',      'A+', '-',     '256k'],
]

// 📖 LLM7 source - https://api.llm7.io/v1
// 📖 Free unauthenticated tier works with tight shared limits; optional free token at https://token.llm7.io
// 📖 Pro-tagged models from /v1/models are intentionally excluded.
export const llm7 = [
  // 📖 LLM7 live /v1/models: only `turbo` tier is free (noKeyNeeded). All `pro` models are usage-based paid.
  // ── S tier — SWE-bench Verified 60–70% ──
  ['devstral-small-2:24b', 'Devstral Small 2', 'S', '68.0%', '255k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['codestral-latest', 'Codestral Latest', 'A', '40.0%', '32k'],
]

// 📖 Routeway source - https://api.routeway.ai/v1/models
// 📖 OpenAI-compatible gateway with explicit zero-price `:free` chat models.
// 📖 Live catalog checked 2026-06-11; only chat-completions models with free pricing are listed.
export const routeway = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['deepseek-v4-flash:free', 'DeepSeek V4 Flash', 'S+', '79.0%', '1M'],
  ['step-3.5-flash:free', 'Step 3.5 Flash', 'S+', '74.4%', '256k'],
  ['laguna-m.1:free', 'Poolside Laguna M.1', 'S+', '72.5%', '131k'],
  ['laguna-xs.2:free', 'Poolside Laguna XS.2', 'S', '68.2%', '131k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['ling-2.6-flash:free', 'Ling 2.6 Flash', 'S', '61.2%', '262k'],
  ['gpt-oss-120b:free', 'GPT OSS 120B', 'S', '60.0%', '131k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['gemma-4-31b-it:free', 'Gemma 4 31B', 'A+', '52.0%', '262k'],
  ['nemotron-3-nano-30b-a3b:free', 'Nemotron Nano 30B', 'A-', '38.8%', '256k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['llama-3.3-70b-instruct:free', 'Llama 3.3 70B', 'B', '22.0%', '131k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['nemotron-nano-9b-v2:free', 'Nemotron Nano 9B', 'B+', '18.0%', '128k'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['llama-3.1-8b-instruct:free', 'Llama 3.1 8B', 'C', '18.0%', '16k'],
  ['llama-3.2-3b-instruct:free', 'Llama 3.2 3B', 'B', '20.0%', '16k'],
  // ── C tier — lightweight/edge models ──
  ['llama-3.2-1b-instruct:free', 'Llama 3.2 1B', 'C', '-', '16k'],
]

// 📖 Novita AI source - https://api.novita.ai/openai/v1/models
// 📖 Novita is mostly paid/trial-credit, so this catalog only includes live chat models reporting 0 input/output price.
// 📖 Test/dev/placeholder zero-price IDs were intentionally excluded.
export const novita = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['qwen/qwen3.6-plus', 'Qwen3.6 Plus', 'S+', '78.8%', '1M'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen/qwen3.5-plus', 'Qwen3.5 Plus', 'S+', '80.0%', '1M'],
  ['nex-agi/nex-n2-pro', 'Nex N2 Pro', 'S', '-', '262k'],
  ['minimax/m2-her', 'MiniMax M2 HER', 'S', '-', '66k'],
]

// 📖 Ollama Cloud source - https://ollama.com/pricing and https://ollama.com/v1/models
// 📖 Free plan includes cloud model access with session/weekly limits. This list keeps coding-relevant cloud models only.
export const ollamaCloud = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['devstral-2:123b', 'Devstral 2 123B', 'S+', '72.2%', '256k'],
  ['qwen3-coder:480b', 'Qwen3 Coder 480B', 'S', '69.6%', '256k'],
  ['nemotron-3-ultra', 'Nemotron 3 Ultra', 'S+', '71.9%', '256k'],
  ['glm-4.7', 'GLM 4.7', 'S+', '73.8%', '200k'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen3-coder-next', 'Qwen3 Coder Next', 'S+', '70.6%', '256k'],
  ['gpt-oss:120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  ['minimax-m3', 'MiniMax M3', 'S+', '78.4%', '512k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['nemotron-3-super', 'Nemotron 3 Super', 'S', '60.5%', '256k'],
  ['cogito-2.1:671b', 'Cogito 2.1 671B', 'A+', '-', '160k'],
  // ── A tier — SWE-bench Verified 40–50% ──
  ['gemma4:31b', 'Gemma 4 31B', 'A+', '52.0%', '256k'],
  ['gpt-oss:20b', 'GPT OSS 20B', 'A+', '50.3%', '128k'],
  ['glm-4.6', 'GLM 4.6', 'A', '-', '200k'],
  ['qwen3-next:80b', 'Qwen3 Next 80B', 'S+', '70.6%', '256k'],
  ['qwen3-vl:235b', 'Qwen3 VL 235B', 'A', '-', '256k'],
  ['qwen3-vl:235b-instruct', 'Qwen3 VL 235B Instruct', 'A', '-', '256k'],
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['devstral-small-2:24b', 'Devstral Small 2 24B', 'S', '68.0%', '256k'],
  ['gemma3:27b', 'Gemma 3 27B', 'B', '22.0%', '128k'],
  ['minimax-m2', 'MiniMax M2', 'S', '69.4%', '200k'],
  ['minimax-m2.1', 'MiniMax M2.1', 'S+', '74.0%', '200k'],
  ['minimax-m2.5', 'MiniMax M2.5', 'S+', '80.2%', '200k'],
  ['ministral-3:8b', 'Ministral 3 8B', 'A-', '-', '256k'],
  ['ministral-3:14b', 'Ministral 3 14B', 'A-', '-', '256k'],
  ['nemotron-3-nano:30b', 'Nemotron 3 Nano 30B', 'A-', '38.8%', '1M'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['gemma3:4b', 'Gemma 3 4B', 'B+', '-', '128k'],
  ['gemma3:12b', 'Gemma 3 12B', 'B+', '-', '128k'],
  ['ministral-3:3b', 'Ministral 3 3B', 'B+', '-', '256k'],
  ['rnj-1:8b', 'RNJ 1 8B', 'B+', '-', '32k'],
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

  'opencode-zen': {
    name: 'OpenCode Zen',
    url: 'https://opencode.ai/zen/v1/chat/completions',
    models: opencodeZen,
    zenOnly: true,
  },
  kilo: {
    name: 'Kilo',
    url: 'https://api.kilo.ai/api/gateway/chat/completions',
    models: kilo,
    noKeyNeeded: true,
  },
  llm7: {
    name: 'LLM7',
    url: 'https://api.llm7.io/v1/chat/completions',
    models: llm7,
    noKeyNeeded: true,
  },
  routeway: {
    name: 'Routeway',
    url: 'https://api.routeway.ai/v1/chat/completions',
    models: routeway,
  },
  novita: {
    name: 'Novita AI',
    url: 'https://api.novita.ai/openai/v1/chat/completions',
    models: novita,
  },
  'ollama-cloud': {
    name: 'Ollama Cloud',
    url: 'https://ollama.com/v1/chat/completions',
    models: ollamaCloud,
  },
}

// 📖 Flatten all models from all sources — each entry includes providerKey as 6th element
// 📖 providerKey lets the main CLI know which API key and URL to use per model
export const MODELS = [];
for (const [sourceKey, sourceData] of Object.entries(sources)) {
  if (!sourceData || !sourceData.models) continue
  for (const model of sourceData.models) {
    const [modelId, label, tier, sweScore, ctx, addedDate] = model
    MODELS.push([modelId, label, tier, sweScore, ctx, sourceKey, addedDate || null])
  }
}
