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
 *   @exports nvidiaNim, groq, cerebras, sambanova, openrouter, githubModels, mistral, codestral, scaleway, googleai, zai, qwen, cloudflare, ovhcloud, opencodeZen, kilo, llm7, routeway, novita, ollamaCloud, pollinations, siliconflow, requesty, orcarouter, vercelGateway, onomeo, runcrate — model arrays per active provider
 *   📖 Retired providers (mistral, codestral, novita) stay exported as empty arrays so
 *      provider-metadata/config imports keep working, but they are absent from the
 *      `sources` map since the 2026-11-22 audit.
 *   @exports sources — map of active free/free-limited providers, each with { name, url, models }

 *   @exports MODELS — flat array of [modelId, label, tier, sweScore, ctx, providerKey]
 *
 *   📖 MODELS now includes providerKey as 6th element so ping() knows which
 *      API endpoint and API key to use for each model.
 */

// 📖 NIM source - https://build.nvidia.com
export const nvidiaNim = [
  // Audit (2026-09-09): GET /v1/models lists 80 ids but most are ghost catalog entries that
  // answer 404 "Function not found" to a 1-token chat completion on the free integrate API.
  // All 46 chat-capable candidates were probed live: only the models kept below respond, so
  // ghost ids stay out even though the public catalog lists them (issue #181).
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-08-23): z-ai/glm-5.2 (GLM 5.1) — no longer in integrate.api.nvidia.com/v1/models (102 models live)
  // Removed (2026-09-05): moonshotai/kimi-k2.6 (Kimi K2.6) - Model page returns 404 and model is absent from the NVIDIA model catalog; could not verify existence
  // Removed (2026-08-30): deepseek-ai/deepseek-v4-pro (DeepSeek V4 Pro) — 410 Gone per NVIDIA NIM forum; replaced by deepseek-v4-flash:0731 (forums.developer.nvidia.com/t/deepseek-v4-pro-flash-removed/379558)
  // Removed (2026-09-21): deepseek-ai/deepseek-v4-flash-0731 (DeepSeek V4 Flash) — NVIDIA deprecation banner on the model page: deprecated 2026-09-19, no longer supported after 2026-09-21; DeepSeek retired V4 Flash in favor of V4.1 Flash (not registered on NIM)
  // Removed (2026-10-17 audit): moonshotai/kimi-k3 (Kimi K3) — officially deprecated on the NIM model card (deprecated 2026-10-14, unsupported after 2026-10-15) and absent from /v1/models; no Moonshot model remains usable on NIM (kimi-k2.6 endpoint was shut down 2026-07-07 and its catalog page 404s)
  ['z-ai/glm-5.3-flash', 'GLM-5.3-Flash', 'S+', '-', '1M'], // Added (2026-09-22) — live on NIM /v1/models (needed a 230s cold start on first probe)
  // Removed (2026-11-03 audit): z-ai/glm-5.3 (GLM 5.3) — API returns HTTP 410 Gone: end of life 2026-10-28T08:00:00Z, absent from the live /v1/models; replacement: z-ai/glm-5.3-flash (still live)
  ['nvidia/nemotron-3.5-super-vl-120b-a12b', 'Nemotron 3.5 Super VL', 'S+', '71.07%', '262k'], // Added (2026-10-17 audit) — new hosted model, live on /v1/models + build.nvidia.com; multimodal 120B/12B MoE, SWE-bench Verified 71.07% per the NVIDIA model card
  ['stepfun-ai/step-5-preview', 'Step 5 Preview', 'S', '-', '1M'], // Added (2026-10-17 audit) — new StepFun flagship preview (600B/27B-active MoE), live on /v1/models, 1M ctx; mirrors the Step 5 rollout on other gateways
  // Removed (2026-09-28 audit re-check): deepseek-ai/deepseek-v4-pro, deepseek-ai/deepseek-v4-flash-0731, minimaxai/minimax-m2.7, stepfun-ai/step-3.7-flash, nvidia/nemotron-3-nano-30b-a3b re-appear in the public catalog but were all probed 410/404 here 2026-09-05..21 — ghost catalog entries again, still excluded (issue #181 policy)
  // Removed (2026-08-30): stepfun-ai/step-3.7-flash (Step 3.7 Flash) — 410 Gone per NVIDIA NIM TUI ping (no replacement listed; superseded by step-3.7-flash via Routeway `step-3.7-flash:free`)
  ['nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra', 'S+', '71.9%', '1M'],
  ['poolside/laguna-xs-2.1', 'Laguna XS 2.1', 'S+', '70.9%', '262k'], // Added (2026-08-13)
  ['moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', 'S+', '-', '1M'], // Replaced (2026-11-22 audit): moonshotai/kimi-k2.6 -> moonshotai/kimi-k3.1-pro (Kimi K3.1 Pro) - K2.6 delisted from the live catalog; K3.1 Pro is the current hosted Moonshot entry (1M ctx), no published SWE-bench Verified yet
  ['minimaxai/minimax-m3.1-flash', 'MiniMax M3.1 Flash', 'S+', '-', '262k'], // Added (2026-11-03 audit) — new Oct 2026 hosted model, live on /v1/models + build.nvidia.com; DeepSWE v1.1 73.7%, no published SWE-bench Verified
  ['mistralai/mistral-large-4-1t-a52b', 'Mistral Large 4', 'S+', '-', '262k'], // Added (2026-11-03 audit) — new hosted 1T MoE flagship, live on /v1/models + build.nvidia.com
  ['meta/muse-glimmer-30b', 'Muse Glimmer 30B', 'S+', '76.0%', '131k'], // Added (2026-09-02); Fixed (2026-11-22 audit): sweScore '-' -> '76.0%' and tier B+ -> S+ (Meta official model card, high reasoning); ctx 131k unchanged
  // Removed (2026-09-21): deepseek-ai/deepseek-v4-pro-0813 (DeepSeek V4 Pro) — 410 Gone on live probe: end of life 2026-09-14T08:00:00Z; absent from /v1/models
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-09-05): openai/gpt-oss-120b (GPT OSS 120B) - NVIDIA deprecation notice on model page: API deprecated on 09/02/2026 and no longer supported
  // Removed (2026-07-27): meta/llama-4-maverick-17b-128e-instruct (Llama 4 Maverick) — EOL 2026-07-27 (HTTP 410 Gone)
  // Removed (2026-08-23): mistralai/mistral-medium-3.5-128b (Mistral Medium 3.5) — no longer in integrate.api.nvidia.com/v1/models (still on Mistral LP directly)
  // Removed (2026-07-27): mistralai/mistral-small-4-119b-2603 (Mistral Small 4) — EOL 2026-07-27 (HTTP 410 Gone)
  // Removed (2026-09-09): minimaxai/minimax-m3 (MiniMax M3) - 410 Gone per live chat probe: reached end of life 2026-09-09T09:00:00Z (shutdown was announced in-file on 2026-09-08)
  // Removed (2026-09-29 audit): mistralai/mistral-nemotron (Mistral Nemotron) — 410 Gone on live probe: end of life 2026-09-28T08:00:00Z
  // Removed (2026-09-29 audit): moonshotai/kimi-k2-thinking (Kimi K2 Thinking) — 410 Gone on live probe: end of life 2026-05-12T00:00:00Z; replaced by moonshotai/kimi-k2.6 (re-added below)
  // Removed (2026-10-10 audit): moonshotai/kimi-k2.6 (Kimi K2.6) — catalog page 404 again and absent from the build.nvidia.com hosted list; only a stale entry lingers in the public /v1/models union. The 2026-09-29 "listed + 401 probe" re-add was the weak signal; page 404 is authoritative (same evidence pattern as the 2026-09-05 removal). Replacement: moonshotai/kimi-k3
  // Removed (2026-07-27): deepseek-ai/deepseek-v3.2 (DeepSeek V3.2) — HTTP 404
  // Removed (2026-09-21): qwen/qwen3-coder-480b-a35b-instruct (Qwen3 Coder 480B) — 410 Gone on live probe: end of life 2026-06-11; the 2026-09-15 re-add was erroneous (model was never alive on NIM in September). Free 480B coder is still on DashScope as qwen3-coder-480b-a35b-instruct
  // ── A+ tier — SWE-bench Verified 50–60% ──
  // Removed (2026-07-27): mistralai/mistral-large-3-675b-instruct-2512 (Mistral Large 675B) — EOL 2026-07-23 (HTTP 410 Gone)
  ['nvidia/nemotron-3-super-120b-a12b', 'Nemotron 3 Super', 'S', '60.5%', '1M'],
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'Nemotron 3 Omni', 'A+', '52.0%', '262k'], // Fixed (2026-09-21): ctx '256k' → '262k' (official contextLength 262144)
  // Removed (2026-07-27): meta-llama/llama-4-scout-17b-16e-instruct (Llama 4 Scout) — HTTP 404
  // Removed (2026-08-30): nvidia/llama-3.3-nemotron-super-49b-v1.5 (Llama 3.3 Nemotron Super 49B) — 410 Gone per NVIDIA NIM TUI ping
  // Removed (2026-09-21): minimaxai/minimax-m3 (MiniMax M3 Preview) — 410 Gone on live probe: end of life 2026-09-09T09:00:00Z (same EOL already documented in-file on 2026-09-09; the 2026-09-15 re-add was erroneous)
  ['nvidia/nemotron-3.5-lightning-30b-a3b', 'Nemotron 3.5 Lightning 30B', 'A+', '52.8%', '1M'],
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-05): nvidia/nemotron-nano-3-30b-a3b (Nemotron Nano 30B) - Model page returns 404 and model is absent from the NVIDIA model catalog; superseded by Nemotron 3.5 Lightning
  ['deepseek-ai/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'S+', '-', '1M'], // Added (2026-09-29 audit) — live on NIM, 552B/8B-active MoE, ctx 1M per NVIDIA docs; DeepSWE v1.1 74.2 + Terminal-Bench 2.1 90.6, no published SWE-bench Verified (score '-' pending)
  // Removed (2026-10-10 audit): nvidia/nemotron-nano-3-30b-a3b (Nemotron Nano 3 30B) — catalog page 404 under every id variant, absent from the hosted list; replaced in the 30B A3B class by nemotron-3.5-lightning. 2026-09-29 re-add reversed (same ghost-entry pattern as issue #181)
  // Removed (2026-10-10 audit): mistralai/codestral-22b-instruct-v0.1 (Codestral 22B) — catalog page 404, old v0.1 retired from NIM, no newer Codestral hosted; use Codestral `codestral-2508` via Mistral LP
  ['openai/gpt-oss-20b', 'GPT OSS 20B', 'S', '60.7%', '131k'], // Fixed (2026-11-22 audit): sweScore '50.3%' -> '60.7%' (official high-reasoning card) and tier A+ -> S; ctx 131k confirmed
  ['google/gemma-4-31b-it', 'Gemma 4 31B', 'A+', '52.0%', '262k'], // Fixed (2026-09-21): ctx '256k' → '262k' (official contextLength 262144)
  // Removed (2026-08-30): mistralai/mistral-large-2-instruct (Mistral Large 2) — 404 NOT FOUND per NVIDIA NIM TUI ping (model not in NIM catalog; use Mistral LP `mistral-large-2512`)
  // Removed (2026-07-27): qwen/qwen2.5-coder-32b-instruct (Qwen2.5 Coder 32B) — EOL 2026-05-12 (HTTP 410 Gone)
  // Removed (2026-07-27): deepseek-ai/deepseek-r1 (DeepSeek R1) — HTTP 404
  // Removed (2026-07-27): nvidia/nemotron-3-nano (Nemotron 3 Nano) — HTTP 404 (replaced by nvidia/nvidia-nemotron-nano-9b-v2)
  // Removed (2026-08-30): nvidia/nvidia-nemotron-nano-9b-v2 (Nemotron Nano 9B v2) — 410 Gone per NVIDIA NIM TUI ping (superseded by nvidia/nemotron-nano-3-30b-a3b)
  // Removed (2026-08-30): meta/llama-3.3-70b-instruct (Llama 3.3 70B) — 410 Gone per NVIDIA NIM TUI ping (no longer in NIM catalog)
  // Removed (2026-08-30): deepseek-ai/deepseek-coder-6.7b-instruct (DeepSeek Coder 6.7B) — 404 NOT FOUND per NVIDIA NIM TUI ping
  // Removed (2026-08-30): meta/codellama-70b (CodeLlama 70B) — 404 NOT FOUND per NVIDIA NIM TUI ping (docs.nvidia.com still lists CodeLlama but not via NIM `integrate.api` free tier)
  // Removed (2026-08-30): mistralai/codestral-22b-instruct-v0.1 (Codestral 22B) — 404 NOT FOUND per NVIDIA NIM TUI ping (use Codestral `codestral-2508` via Mistral LP)
  // Removed (2026-08-30): ibm/granite-34b-code-instruct (Granite 34B Code) — 404 NOT FOUND per NVIDIA NIM TUI ping
  // Removed (2026-09-21): minimaxai/minimax-m2.7 (MiniMax M2.7) — 410 Gone on live probe: end of life 2026-07-27T00:00:00Z; the 2026-09-15 re-add was erroneous. Still free on SambaNova/Routeway
  // ── A- tier — SWE-bench Verified 35–40% ──
  // Removed (2026-07-27): bytedance/seed-oss-36b-instruct (Seed OSS 36B) — EOL 2026-07-27 (HTTP 410 Gone)
  // Removed (2026-07-27): stockmark/stockmark-2-100b-instruct (Stockmark 100B) — EOL 2026-07-15 (HTTP 410 Gone)
  // ── B+ tier — SWE-bench Verified 30–35% ──
  // Removed (2026-07-27): mistralai/ministral-14b-instruct-2512 (Ministral 14B) — EOL 2026-07-27 (HTTP 410 Gone)
  // Removed (2026-08-30): thinkingmachines/inkling (Inkling) — 410 Gone per NVIDIA NIM TUI ping (per Model Deprecation Request 378412)
  ['google/diffusiongemma-26b-a4b-it', 'DiffusionGemma 26B', 'B+', '-', '262k'], // Fixed (2026-09-21): ctx '256k' → '262k' (official contextLength 262144)
  ['nvidia/nemotron-3.5-bolt-e4b', 'Nemotron 3.5 Bolt E4B', 'B+', '-', '64k'], // Added (2026-11-03 audit) — new lightweight edge model, live on /v1/models + build.nvidia.com
  // ── B tier — SWE-bench Verified 20–30% ──
  // Removed (2026-09-05): meta/llama-3.2-11b-vision-instruct (Llama 3.2 11B Vision) - Model page on build.nvidia.com has no hosted endpoint at all (no Free Endpoint, no Partner Endpoint, no endpointData payload); docs page remains but the free API endpoint is gone
  // Removed (2026-08-30): nvidia/nemotron-mini-4b-instruct (Nemotron Mini 4B) — 410 Gone per NVIDIA NIM TUI ping
  // ── C tier — lightweight/edge models ──
  // Removed (2026-07-27): microsoft/phi-4-mini-instruct (Phi 4 Mini) — EOL 2026-07-15 (HTTP 410 Gone)
]

// 📖 Groq source - https://console.groq.com
// 📖 Free API keys available at https://console.groq.com/keys
export const groq = [
  // Removed (2026-08-13): llama-3.3-70b-versatile (Llama 3.3 70B) — Groq deprecation, shutdown 2026-08-16
  // Removed (2026-08-13): llama-3.1-8b-instant (Llama 3.1 8B) — Groq deprecation, shutdown 2026-08-16
  // Removed (2026-09-21): llama-3.3-70b-versatile + llama-3.1-8b-instant re-removed — the 2026-09-15 re-add resurrected models Groq had shut down on 2026-08-16 (absent from the live /models list, deprecated 06/17/26 for free and developer tier)
  // Removed (2026-09-21): minimaxai/minimax-m2.7 (MiniMax M2.7) — enterprise-only on Groq (Contact Sales pricing, no developer-plan rate limits; live API returns model_not_found on a developer-tier key); the 2026-09-15 add was erroneous. Still free on SambaNova/Routeway
  // Removed (2026-09-21): groq/compound + groq/compound-mini — on Groq's official deprecation page with shutdown date 2026-09-21
  ['openai/gpt-oss-120b',                  'GPT OSS 120B',       'S',  '62.4%', '131k'],
  ['openai/gpt-oss-20b', 'GPT OSS 20B', 'S', '60.7%', '131k'], // Fixed (2026-11-22 audit): tier A+ -> S (60.7% sits in the S band); all 3 free ids reconfirmed
  // Removed (2026-09-15): qwen/qwen3.6-27b (Qwen3.6 27B) — rotated out of Groq catalog, superseded by qwen/qwen3.8-27b; replacement: qwen/qwen3.8-27b
  ['qwen/qwen3.8-27b', 'Qwen3.8 27B', 'A+', '-', '131k'], // Confirmed (2026-09-28 audit) — now preview-only on Groq
]

// 📖 Cerebras source - https://cloud.cerebras.ai
// 📖 Free API keys available at https://cloud.cerebras.ai
export const cerebras = [
  // Removed (2026-08-23): zai-glm-4.7 (GLM 4.7) — shutdown 2026-08-17 per Cerebras official notice
  // ── S tier — SWE-bench Verified 60–70% ──
  ['gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '65k'], // Fixed (2026-07-27): ctx '128k' → '65k' (free tier per official docs)
  // Removed (2026-09-05): MiniMax-M3 (MiniMax M3) — HTTP 404 "Model does not exist" per live API ping (PR #178 addition reverted)
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-05): gemma-4-31b (Gemma 4 31B) - Official deprecation notice dated 2026-09-03: gemma-4-31b is no longer available on Cerebras public endpoints; it remains only on paid Dedicated Endpoints, so it no longer has a free access tier
  ['qwen-3.8-27b', 'Qwen 3.8 27B', 'A+', '-', '64k'],
  // Removed (2026-09-21): qwen-3-235b-a22b-instruct-2507 (Qwen3 235B A22B Instruct 2507) — deprecated by Cerebras 2026-05-27, no longer on public endpoints; official catalog lists only gpt-oss-120b and qwen-3.8-27b. The 2026-09-15 re-add was erroneous
]

// 📖 SambaNova source - https://cloud.sambanova.ai
// 📖 Developer tier limits are small but still useful for smoke tests and occasional coding.
// 📖 Keep this catalog conservative: only models surfaced in current SambaNova docs.
export const sambanova = [
  // ── S+ tier ──
  // Audit (2026-11-22): gpt-oss-120b and gemma-4-31B-it have documented free access; MiniMax-M3.1-Flash is retained pending eligibility confirmation (DeepSeek-V3.1/V3.2 and Llama 3.3 70B retired, see below). No GLM addition: free eligibility is unproven
  // ── S tier ──
  // Removed (2026-11-22 audit): DeepSeek-V3.1 - retired 2026-11-03 per the official deprecations page and absent from the public /v1/models
  // Removed (2026-11-22 audit): DeepSeek-V3.2 - retired 2026-11-03 per the official deprecations page and absent from the public /v1/models
  ['gpt-oss-120b',                         'GPT OSS 120B',       'S',  '62.4%', '131k'], // Fixed (2026-07-27): ctx '128k' → '131k'
  ['MiniMax-M3.1-Flash',                   'MiniMax M3.1 Flash', 'S',  '-',     '1M'], // Added (2026-11-03 audit) — new Preview model (released 2026-10-19) in the docs catalog, fills the MiniMax slot left by M2.7's 2026-10-01 deprecation; text+image, 1M ctx
  // ── A tier ──
  ['gemma-4-31B-it',                       'Gemma 4 31B',        'A+',  '52.0%', '131k'], // Fixed (2026-07-27): ctx '128k' → '131k'
  // ── A- tier ──
  // Removed (2026-11-22 audit): Meta-Llama-3.3-70B-Instruct - retired 2026-11-17 per the official deprecations page and absent from the public /v1/models
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
  // Removed (2026-11-03 audit): poolside/laguna-xs-2.1:free (Poolside Laguna XS 2.1) — fully delisted from OpenRouter (zero poolside/laguna entries remain in the live catalog, free or paid); replacement: recursive/flint-v1.0:free (added below)
  // Removed (2026-11-03 audit): poolside/laguna-s-2.1:free (Poolside Laguna S 2.1) — fully delisted from OpenRouter (zero poolside/laguna entries remain in the live catalog, free or paid); replacement: recursive/flint-v1.0:free (added below)
  // Removed (2026-11-22 audit): xingchen-agi/xing4.0-29b-a4b:free (Xing4.0 29B A4B) - absent from the live catalog and its free endpoint is empty
  ['recursive/flint-v1.0:free', 'Recursive Flint', 'S+', '74.2%', '262k'], // Added (2026-11-03 audit) — new :free coding model (40B MoE, 2.5B active, purpose-built for coding agents), SWE-bench Verified 74.2% per the published card; fills the delisted Poolside Laguna slots
  // Removed (2026-09-15): minimax/minimax-m2.7:free (MiniMax M2.7) — no longer free on OpenRouter
  // Removed (2026-09-15): minimax/minimax-m3:free (MiniMax M3) — no longer free on OpenRouter
  // Removed (2026-09-28 audit): z-ai/glm-5.2:free (GLM-5.2) — gone from the live :free catalog (now paid-only)
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-11-22 audit): cohere/north-mini-code:free (North Mini Code) - absent from the live catalog and its free endpoint is empty
  // Removed (2026-11-03 audit): nvidia/nemotron-3-super-120b-a12b:free (Nemotron 3 Super) — :free variant delisted; the paid variant remains ($0.30/M prompt, ctx now 1M); replacement: nvidia/nemotron-3.5-super-vl:free
  // Removed (2026-10-17 audit): inclusionai/ling-3.1-flash (Ling 3.1 Flash) — no longer $0/$0: now bills $0.075/M in + $0.225/M out with no :free variant; reverses the 2026-10-10 add
  // Removed (2026-10-10 audit): qwen/qwen3.8-27b:free (Qwen3.8 27B) — deleted from the live :free catalog (Kilo mirror dropped it the same day); no free Qwen replacement
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'Nemotron 3 Omni', 'A+', '52.0%', '256k'],
  ['nvidia/nemotron-3.5-super-vl:free', 'Nemotron 3.5 Super VL', 'S+', '71.1%', '1M'], // Added (2026-10-17 audit) — new :free entry, 1M ctx per the live API; SWE score follows the same model on NVIDIA NIM (71.07% rounded per family reads), S+ on the documented scale
  ['google/gemma-4-31b-it:free', 'Gemma 4 31B', 'A+', '52.0%', '262k'],
  ['google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B MoE', 'A', '38.0%', '262k'],
  ['baidu/ernie-5.5-flash-preview:free', 'Baidu ERNIE 5.5 Flash Preview', 'A', '-', '1M'], // Added (2026-11-22 audit) - new :free route, $0/$0 on the public endpoint, no published SWE-bench Verified (tier provisional)
  ['liquid/lfm-3-1.7b:free', 'LiquidAI LFM3-1.7B', 'A', '43.4%', '262k'], // Added (2026-11-22 audit) - new :free route, SWE-bench Verified 43.4% per the LiquidAI model card
  ['particle-ai/particle-1:free', 'Particle 1', 'A-', '-', '1M'], // Added (2026-11-22 audit) - new :free route, $0/$0 on the public endpoint, no published SWE-bench Verified (tier provisional)
  // Removed (2026-09-28 audit): nex-agi/nex-n2.5-pro:free — nex-agi dropped from the live :free catalog entirely
  // ── B+ tier — SWE-bench Verified 30–35% ──
  // Removed (2026-11-22 audit): liquid/lfm-2.5-2.6b:free (LFM2.5-2.6B) - absent from the live catalog, replaced by liquid/lfm-3-1.7b:free
  ['nvidia/nemotron-3.5-lightning:free', 'NVIDIA Nemotron 3.5 Lightning', 'B+', '-', '1M'],
  ['inclusionai/ling-3.2-flash:free', 'Ling 3.2 Flash', 'B+', '-', '1M'], // Added (2026-11-22 audit) - new :free route, $0/$0 on the public endpoint, no published SWE-bench Verified (tier provisional)
  // Removed (2026-09-29 audit): inclusionai/ling-3.0-flash-fin:free — :free variant gone from the live catalog, base id now bills $0.06/M prompt; replacement: inclusionai/ling-3.0-flash-sante:free
  // Removed (2026-11-22 audit): thinkingmachines/inkling:free (Inkling) - absent from the live catalog and its free endpoint is empty
  // Removed (2026-10-10 audit): inclusionai/ling-3.0-flash-sante:free — :free variant removed, base id now bills per-token; replacement: inclusionai/ling-3.1-flash ($0/$0)
  // Removed (2026-10-10 audit): stealth/space-bunny-alpha — stealth preview rotated out of the live list, no stealth model currently live (next stealth slot: glyph-cluster on Kilo/Vercel)
  // Removed (2026-10-17 audit): apodex/apodex-1.1-mini:free — delisted from OpenRouter entirely (no free or paid listing in the live API); the model moved to Novita as a zero-price partner launch
  ['openrouter/free', 'Free Models Router', 'A', '-', '200k'], // Added (2026-09-29 audit) — OpenRouter's meta-router, $0 but routes to a RANDOM free model per request (utility pick, quality varies)
  // Removed (2026-09-28 audit): nex-agi/nex-n2.5-mini:free — nex-agi dropped from the live :free catalog entirely
  // Removed (2026-09-28 audit): inclusionai/ling-3.0-flash-vl:free — :free variant removed from the live catalog (base model now billed)
  // ── B tier — SWE-bench Verified 20–30% ──
  // Removed (2026-11-22 audit): thinkingmachines/inkling-small:free (Inkling Small) - absent from the live catalog and its free endpoint is empty
  // Removed (2026-11-22 audit): dots-studio/dots-3-note-preview:free (Dots 3 Note Preview) - absent from the live catalog and its free endpoint is empty
  // ── C tier — lightweight/edge models ──
  // Removed (2026-10-10 audit): nvidia/nemotron-3.5-content-safety:free — moderation classifier, not coding-capable (catalog hygiene; same cleanup on Kilo/Requesty)
]

// 📖 GitHub Models source - https://models.github.ai
// 📖 ⚠️ RETIRED 2026-07-30 — GitHub Models fully shut down (playground, catalog, inference API, BYOK all gone)
// 📖 Catalog returns HTTP 410 Gone with `github_models_retirement_brownout` error.
// 📖 https://github.blog/changelog/2026-07-01-github-models-retirement
// 📖 Kept as an empty array so downstream provider-metadata/config code that imports
// 📖 `githubModels` and references `'github-models'` doesn't crash; the entry is also
// 📖 commented out of the `sources` map below so it won't appear in the catalog.
export const githubModels = [
  // All 35 entries retired 2026-07-30 — see comment above.
]

// 📖 Mistral La Plateforme source - https://console.mistral.ai
// 📖 ⚠️ RETIRED 2026-11-22 - Mistral's Free mode no longer includes API access: the official
// 📖 https://docs.mistral.ai/admin/billing-usage/usage-limits page excludes the API from Free mode
// 📖 and requires an activated billing account (pay-as-you-go). No free Mistral API tier is left.
// 📖 Kept as an empty array so downstream provider-metadata/config code that imports
// 📖 `mistral` and references the 'mistral' key (MISTRAL_API_KEY) doesn't crash; the entry is
// 📖 also commented out of the `sources` map below so it won't appear in the catalog.
export const mistral = [
  // Removed (2026-11-22 audit): all 7 entries - mistral-large-4, mistral-small-2603,
  // ministral-14b-2512, ministral-8b-2512, ministral-3b-2512, mistral-code-latest,
  // mistral-code-fim-latest. Retired provider-wide by the official usage-limits policy.
]

// 📖 Mistral Codestral source - https://codestral.mistral.ai
// 📖 ⚠️ RETIRED 2026-11-22 - same platform-wide policy change as Mistral La Plateforme: the
// 📖 admin usage-limits page excludes the API from Free mode, the legacy codestral.mistral.ai
// 📖 endpoint is gone and api.mistral.ai requires billing. Kept as an empty array for the same
// 📖 backward-compatibility reason as `mistral` above.
export const codestral = [
  // Removed (2026-11-22 audit): codestral-2508 (Codestral) - no free API tier left.
]

// 📖 Scaleway source - https://console.scaleway.com
// 📖 1M free tokens — API keys at https://console.scaleway.com/iam/api-keys
export const scaleway = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-11-03 audit): glm-5.2 (GLM 5.2) — deprecated by Scaleway 2026-10-16, EOL 2026-11-16; requests already route to glm-5.3 (already in the catalog); replacement: glm-5.3
  ['glm-5.3', 'GLM 5.3', 'S+', '-', '256k'], // Added (2026-10-17 audit) — free Serverless on the official supported-models page; score pending a published SWE-bench Verified figure
  ['deepseek-v4-flash-0731', 'DeepSeek V4 Flash', 'S+', '-', '256k'], // Added (2026-08-13)
  ['deepseek-v4.1-flash-1017', 'DeepSeek V4.1 Flash', 'S+', '-', '256k'], // Fixed (2026-11-22 audit): id 'deepseek-v4.1-flash' -> 'deepseek-v4.1-flash-1017' per the official supported-models and pricing pages
  // Removed (2026-09-05): devstral-2-123b-instruct-2512 (Devstral 2 123B) - Deprecated 2026-07-01, End of Life 2026-08-01; after EOL the model is no longer accessible on Generative APIs Serverless
  // ── S tier — SWE-bench Verified 60–70% ──
  ['qwen3.5-397b-a17b', 'Qwen3.5 400B VLM', 'S+', '76.2%', '250k'],
  ['gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  ['mistral-medium-3.5-128b', 'Mistral Medium 3.5 128B', 'S+', '77.6%', '180k'], // Fixed (2026-07-27): ctx '256k' → '180k' (Serverless tier)
  // ── A+ tier — SWE-bench Verified 50–60% ──
  // ⚠️ DEPRECATED - Scaleway EOL 2026-10-01
  // Removed (2026-09-15): qwen3-coder-30b-a3b-instruct (Qwen3 Coder 30B) — Deprecated 2026-07-01, EOL 2026-10-01; replacement: qwen3.6-35b-a3b
  // Audit (2026-09-28): all 11 entries confirmed live; qwen3-coder-30b-a3b-instruct still EOL 2026-10-01, not re-added
  ['qwen3.6-35b-a3b', 'Qwen3.6 35B MoE', 'S+', '73.4%', '256k'],
  // Removed (2026-11-03 audit): qwen3-coder-30b-a3b-instruct (Qwen3 Coder 30B) — the 2026-10-17 re-add did not survive: gone from the supported-models page again, requests route to qwen3.6-35b-a3b (EOL 2026-10-01 re-confirmed); replacement: qwen3.6-35b-a3b
  // Removed (2026-09-05): holo2-30b-a3b (Holo2 30B) - Deprecated 2026-07-09, End of Life 2026-08-09; after EOL the model is no longer accessible on Generative APIs Serverless
  ['gemma-4-26b-a4b-it', 'Gemma 4 26B MoE', 'A+', '-', '256k'],
  // Removed (2026-09-02): gemma-4-31b-it (Gemma 4 31B IT) — Dedicated tier only, not available on Serverless
  ['qwen3-235b-a22b-instruct-2507', 'Qwen3 235B', 'A', '45.2%', '250k'], // Restored (2026-09-05) — still Serverless per official docs (silently dropped by PR #178)
  ['qwen3.8-27b', 'Qwen3.8 27B', 'A+', '-', '256k'], // Added (2026-09-22) — new Serverless model on the official catalog (agentic/coding optimized)
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['llama-3.3-70b-instruct', 'Llama 3.3 70B', 'B', '22.0%', '100k'], // Fixed (2026-08-13): ctx '128k' → '100k' (Serverless tier per official catalog)
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['mistral-small-3.2-24b-instruct-2506', 'Mistral Small 3.2', 'B', '20.0%', '128k'],
  // ⚠️ DEPRECATED - Scaleway EOL 2026-10-01
  // Removed (2026-09-15): pixtral-12b-2409 (Pixtral 12B) — Deprecated 2026-07-01, EOL 2026-10-01; replacement: mistral-small-3.2-24b-instruct-2506
  // ── B tier — SWE-bench Verified 20–30% ──
  // Removed (2026-09-05): gemma-3-27b-it (Gemma 3 27B) - Deprecated 2026-07-01, End of Life 2026-08-01; after EOL the model is no longer accessible on Generative APIs Serverless
]

// 📖 Google AI Studio source - https://aistudio.google.com
// 📖 OpenAI-compatible endpoint exposes Gemini models; free quotas vary by model and region.
export const googleai = [
  ['gemini-3.8-flash',                          'Gemini 3.8 Flash',             'S+', '80.0%',     '1M'], // Added (2026-09-02) — free tier per official pricing page; Fixed (2026-11-03 audit): sweScore '-' → '80.0%' (SWE-bench Verified per the Vals.ai leaderboard)
  // Removed (2026-11-03 audit): gemini-3.7-flash (Gemini 3.7 Flash) — deprecated 2026-10-08, endpoint auto-routes to gemini-3.8-flash (duplicate entry); replacement: gemini-3.8-flash
  ['gemini-3.6-flash',                          'Gemini 3.6 Flash',             'S+', '79.6%',     '1M'], // Added (2026-07-27); Fixed (2026-11-03 audit): sweScore '-' → '79.6%' (SWE-bench Verified per the Vals.ai leaderboard)
  // Removed (2026-11-03 audit): gemini-3.5-flash (Gemini 3.5 Flash) — deprecated 2026-10-08, endpoint auto-routes to gemini-3.6-flash (duplicate entry); replacement: gemini-3.6-flash
  ['gemini-3.5-flash-lite',                     'Gemini 3.5 Flash Lite',        'S', '75.0%',      '1M'], // Added (2026-07-27); Fixed (2026-11-03 audit): sweScore '-' → '75.0%' (SWE-bench Verified per the Vals.ai leaderboard)
  ['gemini-3.1-flash-lite',                     'Gemini 3.1 Flash Lite',        'S', '62.8%', '1M', null, '2027-05-07'], // ⚠️ DEPRECATED — shutdown 2027-05-07 (Google deprecation schedule, 2026-09-29 audit); 2026-11-03 audit: date moved into the 7th tuple element so the catalog auto-filters it
  ['gemini-2.5-flash',                          'Gemini 2.5 Flash',             'A+', '54.0%', '1M', null, '2026-12-01'], // ⚠️ DEPRECATED — Google deprecation 2026-11-02, requests auto-route to gemini-3.5-flash-lite from 2026-12-01; closed to new users since 2026-09-18
  ['gemini-2.5-flash-lite',                     'Gemini 2.5 Flash Lite',        'A',  '42.6%', '1M'], // Fixed (2026-11-22 audit): dropped the unfounded 2026-12-01 shutdown date, the official deprecations page lists no shutdown date for 2.5 Flash Lite; still closed to new users since 2026-09-18
  ['gemini-3-flash-preview',                    'Gemini 3 Flash Preview',       'S+',  '75.0%', '1M'], // Restored (2026-09-05) — free tier confirmed per official pricing page; Fixed (2026-11-03 audit): sweScore '78.0%' → '75.0%' (Vals.ai leaderboard)
  ['gemini-2.5-pro',                            'Gemini 2.5 Pro',               'S', '63.8%', '1M', null, '2026-12-01'], // ⚠️ DEPRECATED — Google deprecation 2026-11-02, requests auto-route to gemini-3.8-flash from 2026-12-01; closed to new users since 2026-09-18
  // Removed (2026-09-02): gemini-3.1-pro-preview (Gemini 3.1 Pro Preview) — free tier "Not available" per official pricing page (rechecked 2026-09-05)
  // Removed (2026-09-21): gemini-3.1-pro-preview re-removed — the 2026-09-15 re-add resurrected a paid-only model (free tier "Not available" on the official pricing page since ~April 2026); best free alternative: gemini-3.5-flash
  // Removed (2026-09-05): gemini-2.0-flash — not listed on the official pricing page (PR #178 addition reverted)
  // Audit (2026-11-22): the official deprecations page carries no shutdown date for 2.5 Flash Lite, so only 2.5 Flash and 2.5 Pro keep their announced 2026-12-01 date
  // Audit (2026-09-28): all 10 entries confirmed live at 1M ctx; gemini-2.5 API access now restricted to past users per the docs. gemini-3.1-pro-preview stays excluded (paid-only, confirmed again on 2026-09-28)
  // Removed (2026-09-21): gemma-4-31b-it + gemma-4-26b-a4b-it (Gemma 4 entries) — Gemma pages are gone from ai.google.dev (404 on /gemini-api/docs/models/gemma), Gemma is no longer served via the Gemini API free tier; the free Gemma route is now NVIDIA NIM
]

// 📖 ZAI source - https://open.z.ai
// 📖 ⚠️ NO FREE TIER LEFT (2026-10-17 audit) — the GLM Coding Plan devpack free window
// 📖 (zero-quota 23:00-09:00 SGT, ran 2026-09-03 → 2026-10-07) is over and the plan is
// 📖 now paid-only (Lite/Pro/Max, from $18/mo; docs.z.ai/devpack/overview). GLM-5.3-Flash
// 📖 bills $0.15/$0.50 per 1M on the pay-per-token API. Free GLM-5.3-Flash remains on
// 📖 NVIDIA NIM / OpenRouter / Pollinations / OrcaRouter / onomeo gateways.
// 📖 Kept as an empty array so downstream provider-metadata/config code that imports
// 📖 `zai` and references the 'zai' key (id normalizers, ZAI_API_KEY) doesn't crash; the
// 📖 entry is also commented out of the `sources` map below so it won't appear in the catalog.
export const zai = [
  // Removed (2026-10-17 audit): zai/glm-5.3-flash (GLM-5.3-Flash) — the Coding Plan devpack free window ended 2026-10-07 and the GLM Coding Plan is paid-only (Lite $18/mo+); the id now serves a paid model. Free GLM-5.3-Flash: z-ai/glm-5.3-flash on NVIDIA NIM
  // Removed (2026-09-29 audit): zai/glm-5.3 (GLM-5.3) — paid-only on the API ($1.4/$4.4 per 1M) and needs the paid $18/mo Coding Plan; docs pricing page has no free column for it (provider premise: Flash models only)
  // Removed (2026-09-21): zai/glm-5.2 + zai/glm-5.1 — Coding Plan requests for both are now silently redirected to GLM-5.3 (official docs.z.ai plan update), so the ids no longer serve a distinct free model; both remain paid-API models
  // Removed (2026-09-28 audit): zai/glm-5 — legacy id, Coding Plan auto-routes GLM-5 requests to GLM-5.3
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-09-28 audit): zai/glm-4.7-flash + zai/glm-4.5-flash + zai/glm-5-turbo + zai/glm-4.7 + zai/glm-4.6 — legacy ids, the Coding Plan now serves only GLM-5.3 / GLM-5.3-Flash (docs.z.ai devpack overview); old ids silently redirect
  // 2026-09-29 audit re-check: glm-4.7-flash still shows "Free" on the pricing page but Coding Plan requests for it redirect to GLM-5.3-Flash (2026-09-28 finding), stays excluded as a redirect-ghost
  // Removed (2026-08-23): zai/glm-4.7-flashx, zai/glm-5v-turbo, zai/glm-4.6v — now paid-only ("Insufficient balance or no resource package" per ping test)
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-28 audit): zai/glm-4.6v-flash + zai/glm-4.7-flashx — legacy ids, superseded by GLM-5.3-Flash (multimodal included) / GLM-5.3-FlashX
  // Removed (2026-09-29 audit): zai/glm-5.3-flashx (GLM-5.3-FlashX) — docs explicitly state it is not available on the Coding Plan and the API bills $0.37/$1.25 per 1M: paid-only, reverses the 2026-09-28 add
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
  // Removed (2026-09-15): qwen3-max (Qwen3 Max) — unstable alias, legacy shutdown stream; replacement: qwen3.7-max
  // Removed (2026-11-22 audit): qwen3.6-plus - Singapore free trial quota removed for this id in the 2026-10-29 batch notice
  // Removed (2026-09-15): qwen3-235b-a22b (Qwen3 235B) — legacy base, Oct 10 2026 shutdown; replacement: qwen3.5-397b-a17b
  ['qwen3.7-plus', 'Qwen3.7 Plus', 'S+', '-', '1M'],
  // Removed (2026-10-10 audit): qwen3.6-max-preview (Qwen3.6 Max Preview) — retired 2026-10-10 per Alibaba decommissioning notice 1950 (the ⚠️ date below hit); replacement: qwen3.7-max
  ['qwen3.8-max', 'Qwen3.8 Max', 'S+', '-', '1M'],
  ['qwen4-max', 'Qwen4 Max', 'S+', '-', '1M'], // Added (2026-11-22 audit) - released 2026-11-16, Singapore 1M-token free quota confirmed; no published SWE-bench Verified yet
  ['qwen3.8-2.4t-a95b', 'Qwen3.8 2.4T A95B', 'S+', '-', '1M'],
  // Removed (2026-11-22 audit): qwen3.8-max-0902 - snapshot max quota removed 2026-11-15, id no longer on the free billing page
  ['glm-5.3', 'GLM-5.3', 'S+', '-', '1M'], // Added (2026-11-03 audit) — third-party model now hosted on DashScope intl Model Studio
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-11-22 audit): qwen3.5-plus - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-11-22 audit): kimi-k2.7-code - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-10-10 audit): qwen3-coder-plus (Qwen3 Coder Plus) — retired 2026-10-10 per Alibaba decommissioning notice 1950 (the ⚠️ date below hit); replacement: qwen3.7-plus
  // Removed (2026-10-10 audit): qwen3-coder-next (Qwen3 Coder Next) — retired 2026-10-10 per Alibaba decommissioning notice 1949 (the ⚠️ date below hit); replacement: qwen3.7-plus
  // Removed (2026-09-15): qwen3-coder-480b-a35b-instruct (Qwen3 Coder 480B) — legacy, superseded by qwen3-coder-next; replacement: qwen3-coder-next
  // Removed (2026-10-10 audit): qwen3-coder-480b-a35b-instruct (Qwen3 Coder 480B) — the 2026-09-21 re-add ended today: retired 2026-10-10 per Alibaba decommissioning notice 1949 (the ⚠️ date below hit); replacement: qwen3.7-plus
  ['qwen3.8-27b', 'Qwen3.8 27B', 'S', '-', '1M'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['qwen3.7-flash', 'Qwen3.7 Flash', 'A+', '-', '1M'], // Added (2026-07-27)
  ['qwen3.6-flash', 'Qwen3.6 Flash', 'A+', '60.0%', '1M'],
  ['qwen3.5-flash', 'Qwen3.5 Flash', 'S', '64.4%', '1M'],
  // Removed (2026-11-22 audit): qwen3-coder-flash - free trial quota removed in the 2026-10-29 batch notice
  ['deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'A+', '-', '1M'], // Added (2026-11-03 audit) — third-party DeepSeek now hosted on DashScope intl Model Studio; tier follows the same model on pollinations
  // Removed (2026-10-10 audit): qwen3-vl-flash (Qwen3 VL Flash) — retired 2026-10-10 per Alibaba decommissioning notice 1950 (the ⚠️ date below hit); only qwen3-vl-plus survives in the VL tier; replacement: qwen3.6-flash
  ['qwen3-vl-plus', 'Qwen3 VL Plus', 'A+', '-', '256k'], // Added (2026-09-21) — on the official free billing page (1M-token free quota)
  // Removed (2026-10-10 audit): qwen3-coder-30b-a3b-instruct (Qwen3 Coder 30B A3B) — EOL 2026-10-10 per Alibaba decommissioning notice 1949 (the ⚠️ date below hit; same EOL hit Scaleway 2026-10-01); replacement: qwen3.7-plus
  // Removed (2026-09-15): qwen3-32b (Qwen3 32B) — legacy, Oct 10 2026 shutdown (aliyun notice 118434); replacement: qwen3.8-27b
  // Removed (2026-11-22 audit): qwen3.5-397b-a17b - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-11-22 audit): qwen3.5-122b-a10b - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-11-22 audit): qwen3.5-35b-a3b - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-09-15): qwen3-next-80b-a3b-thinking (Qwen3 Next 80B Thinking) — retired in 2026 legacy cleanup; replacement: qwen3.8-flash
  // Removed (2026-09-15): qwen3-next-80b-a3b-instruct (Qwen3 Next 80B Instruct) — retired in 2026 legacy cleanup; replacement: qwen3.8-flash
  ['qwen3.8-flash', 'Qwen3.8 Flash', 'A+', '-', '1M'],
  // Removed (2026-10-10 audit): qwen3.8-flash-next (Qwen3.8 Flash Next) — phantom entry: 404 detail page, absent from the Model List product index, never appears in release lifecycle or retirement notices; replacement: qwen3.8-flash
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-11-22 audit): qwen3.5-27b - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-09-15): qwen3-30b-a3b (Qwen3 30B A3B) — legacy, Oct 10 2026 shutdown; replacement: qwen3.5-35b-a3b
  ['qwen3.5-omni-plus', 'Qwen3.5 Omni Plus', 'B+', '-', '256k'], // Fixed (2026-10-10 audit): ctx '32k' → '256k' (official model page; the "omni-family 32k" precedent was wrong)
  ['qwen3.8-omni-flash', 'Qwen3.8 Omni Flash', 'B+', '-', '1M'], // Fixed (2026-10-10 audit): ctx '32k' → '1M' (official model page)
  // Removed (2026-11-22 audit): qwen3.6-27b - free trial quota removed in the 2026-10-29 batch notice
  // Removed (2026-11-22 audit): qwen3.6-35b-a3b - free trial quota removed in the 2026-10-29 batch notice
]

// 📖 Cloudflare Workers AI source - https://developers.cloudflare.com/workers-ai
// 📖 OpenAI-compatible endpoint requires account id:
// 📖 https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
// 📖 Free plan includes daily neuron quota and provider-level request limits.
export const cloudflare = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-09-05): @cf/moonshotai/kimi-k2.6 (Kimi K2.6) - model still exists but docs state it is not available through standard Workers Free billing; requires Workers Paid plan or prepaid AI Gateway credits, so unusable within the free 10k neurons/day tier
  // Removed (2026-09-05): @cf/moonshotai/kimi-k2.7-code (Kimi K2.7 Code) - model still exists but docs state it is not available through standard Workers Free billing; requires Workers Paid plan or prepaid AI Gateway credits
  // Removed (2026-09-05): @cf/zai-org/glm-5.2 (GLM-5.2) - model still exists but docs state it is not available through standard Workers Free billing; requires Workers Paid plan or prepaid AI Gateway credits
  // Removed (2026-09-21): @cf/zai-org/glm-5.3-flash + @cf/zai-org/glm-5.3 — both now carry the "Paid access required: not available through standard Workers Free billing" badge on the official docs pages; the 2026-09-15 re-add was erroneous
  // ── S tier — SWE-bench Verified 60–70% ──
  ['@cf/zai-org/glm-4.7-flash', 'GLM-4.7-Flash', 'A+', '59.2%', '131k'],
  ['@cf/openai/gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '128k'], // Fixed (2026-11-22 audit): sweScore '62.0%' -> '62.4%' (OpenAI official high-reasoning card), reverting the 2026-09-28 read
  // Removed (2026-09-21): @cf/zai-org/glm-5.2, @cf/deepseek-ai/deepseek-v4-pro-0813, @cf/deepseek-ai/deepseek-v4-flash-0731, @cf/moonshotai/kimi-k2.7-code, @cf/moonshotai/kimi-k2.6 re-removed — all five carry the "Paid access required: not available through standard Workers Free billing" badge on their official docs pages; the 2026-09-15 re-adds regressed the 2026-09-05 paid-only policy
  // ── A+ tier — SWE-bench Verified 50–60% ──
  // Removed (2026-11-22 audit): @cf/nvidia/nemotron-3-120b-a12b (Nemotron 3 Super) - retired 2026-11-20 per the official planned-model-deprecations changelog; the model page carries the Deprecated badge
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-28 audit): @cf/meta/llama-4-scout-17b-16e-instruct (Llama 4 Scout) — no longer in the Workers AI catalog
  // Removed (2026-11-22 audit): @cf/qwen/qwen3-30b-a3b-fp8 (Qwen3 30B MoE) - retired 2026-11-20 per the official planned-model-deprecations changelog; Deprecated badge on the model page
  ['@cf/qwen/qwen2.5-coder-32b-instruct', 'Qwen2.5 Coder 32B', 'A', '45.7%', '32k'], // Fixed (2026-09-28 audit): sweScore '47.0%' → '45.7%',
  ['@cf/openai/gpt-oss-20b', 'GPT OSS 20B', 'S', '60.7%', '128k'], // Fixed (2026-11-22 audit): sweScore '50.3%' -> '60.7%' (official high-reasoning card) and tier A+ -> S, aligned with the other GPT OSS 20B rows
  // Removed (2026-09-28 audit): @cf/qwen/qwq-32b (QwQ 32B) — deprecated, superseded by qwen3/qwen3.8 reasoning models
  // Removed (2026-09-28 audit): @cf/deepseek-ai/deepseek-r1-distill-qwen-32b (DeepSeek R1 Distill Qwen 32B) — removed from the catalog, replaced by DeepSeek V4 models
  // Audit (2026-11-22): qwq-32b + deepseek-r1-distill-qwen-32b were themselves retired 2026-11-20 per the planned-deprecations changelog, so the 2026-09-29 "still listed free" note is obsolete
  // Audit (2026-09-28): the catalog also lists @cf/zai-org/glm-5.3-flash, @cf/moonshotai/kimi-k2.7-code, @cf/deepseek-ai/deepseek-v4-flash-0731, @cf/deepseek-ai/deepseek-v4-pro-0813 but these keep the paid-only policy exclusion (previously removed for Workers-Paid-only billing)
  // ── A- tier — SWE-bench Verified 35–40% ──
  ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B', 'B', '22.0%', '24k'],
  ['@cf/google/gemma-4-26b-a4b-it', 'Gemma 4 26B MoE', 'A-', '38.0%', '256k'], // Fixed (2026-07-27): ctx '128k' → '256k' (April 2026 changelog)
  ['@cf/qwen/qwen3.8-27b', 'Qwen3.8 27B', 'A-', '-', '262k'],
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['@cf/mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1', 'B+', '30.0%', '128k'],
  ['@cf/ibm-granite/granite-4.0-h-micro', 'Granite 4.0 Micro', 'B+', '30.0%', '131k'], // Fixed (2026-07-27): namespace 'ibm' → 'ibm-granite'
  ['@cf/aisingapore/gemma-sea-lion-v4-27b-it', 'Gemma SEA-LION V4 27B', 'B+', '-', '128k'], // Added (2026-09-21) — new in the free catalog; SEA-language focused, secondary for coding
  // ── C tier — lightweight/edge models ──
  ['@cf/meta/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout MoE', 'C', '-', '131k'], // Re-added (2026-11-03 audit) — back in the Workers AI catalog per the official docs page (reverses the 2026-09-28 removal); weak coding model, kept for breadth. Note (2026-11-03 audit): every new 2026 flagship (GLM-5.x, Kimi K2.6/K2.7, DeepSeek V4) is Workers-Paid-only since 2026-07-28, so nothing stronger was eligible
  // ── B tier — SWE-bench Verified 20–30% ──
  // Removed (2026-09-15): @cf/meta/llama-3.1-8b-instruct-fast (Llama 3.1 8B Instruct (Fast)) - delisted; Audit (2026-11-22): no llama-3.1 8B variant remains in the free catalog (retired 2026-11-20), so the old "fp8 remains" note is dropped
  // Removed (2026-08-30): @cf/google/gemma-3-12b-it (Gemma 3 12B IT) — Deprecated 2026-05-30 per Cloudflare Workers AI docs (developers.cloudflare.com/workers-ai/models/gemma-3-12b-it)
  // Removed (2026-08-30): @cf/moonshotai/kimi-k2.5 (Kimi K2.5) — Deprecated 2026-05-30 per Cloudflare changelog; replaced by @cf/moonshotai/kimi-k2.6 (developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations)
]

// 📖 OVHcloud AI Endpoints - https://endpoints.ai.cloud.ovh.net
// 📖 OpenAI-compatible API with European data sovereignty (GDPR)
// 📖 Free anonymous sandbox: 2 req/min per IP per model (no API key needed); keyed access needs a
// 📖 payment method and is billed (400 RPM), so only the anonymous path is a free tier
// 📖 Env var: OVH_AI_ENDPOINTS_ACCESS_TOKEN
export const ovhcloud = [
  ['Qwen3.5-397B-A17B',                         'Qwen3.5 397B MoE',    'S+',  '76.4%',     '262k'], // Fixed (2026-09-29 audit): sweScore '76.2%' → '76.4%' per OVH's own benchmark block
  ['Qwen3.6-27B',                               'Qwen3.6 27B',         'S+',  '77.2%',     '262k', null, '2027-02-10'], // ⚠️ DEPRECATED - OVHcloud end of service 2027-02-10 per the official catalog; auto-filtered by the 7th tuple element
  ['qwen3.6-35b-a3b', 'Qwen3.6 35B MoE', 'S+', '73.4%', '256k'], // Added (2026-11-22 audit) - anonymous chat 200 on the free sandbox, SWE-bench Verified 73.4% per the model card
  ['laguna-xs-2.1', 'Laguna XS 2.1', 'S+', '70.9%', '128k'], // Added (2026-11-22 audit) - anonymous chat 200 on the free sandbox, SWE-bench Verified 70.9% per the Poolside model card
  // Removed (2026-07-27): Qwen3-Coder-30B-A3B-Instruct (Qwen3 Coder 30B MoE) — no longer in catalog
  // Removed (2026-09-21): Qwen3-Coder-30B-A3B-Instruct (Qwen3 Coder 30B A3B) — absent from the official AI Endpoints catalog page (20 models, no coder model); the 2026-09-21 morning re-add was erroneous
  // Removed (2026-10-10 audit): Qwen3-Coder-30B-A3B-Instruct (Qwen3 Coder 30B A3B) — the 2026-09-29 "live router API" re-add is dead: chat endpoint returns model_not_found and the id is gone from /v1/models; replacement: Qwen3.8-27B
  ['gpt-oss-120b',                              'GPT OSS 120B',         'S',  '62.4%', '131k'],
  ['DeepSeek-V4.1-Flash-1017', 'DeepSeek V4.1 Flash 1017', 'S', '-', '1M'], // Added (2026-11-22 audit) - anonymous chat 200 on the free sandbox, 1M ctx, no published SWE-bench Verified (tier provisional)
  ['gpt-oss-20b',                               'GPT OSS 20B',          'S',  '60.7%', '131k'], // Fixed (2026-11-22 audit): sweScore '50.3%' -> '60.7%' (official high-reasoning card) and tier A+ -> S
  ['Meta-Llama-3_3-70B-Instruct',               'Llama 3.3 70B',        'B', '22.0%', '131k', null, '2027-02-10'], // ⚠️ DEPRECATED - OVHcloud end of service 2027-02-10 per the official catalog
  // Removed (2026-07-27): Qwen3-32B (Qwen3 32B) — no longer in catalog
  // Removed (2026-08-13): Mistral-Small-3.2-24B-Instruct-2506 (Mistral Small 3.2) — no longer in OVHcloud public catalog (endpoint still reachable but not listed)
  // Removed (2026-07-27): Mistral-7B-Instruct-v0.3 (Mistral 7B Instruct) — no longer in catalog
  // Removed (2026-08-13): Mistral-Nemo-Instruct-2407 (Mistral Nemo) — no longer in OVHcloud public catalog
  // Removed (2026-09-21): Mistral-Small-3.2-24B-Instruct-2506 + Mistral-Nemo-Instruct-2407 + Mistral-7B-Instruct-v0.3 re-removed — none of the three Mistral models appear on the official AI Endpoints catalog page; the 2026-09-21 morning re-adds were erroneous
  ['Mistral-Small-3.2-24B-Instruct-2506',       'Mistral Small 3.2 24B','B+', '20.0%', '131k'], // Fixed (2026-11-22 audit): dropped the stale 2026-11-04 shutdown (live chat still answers 200 and the official catalog shows no EOL), so the row is no longer auto-filtered
  ['Qwen3.5-9B',                                'Qwen3.5 9B',           'B+', '30.0%', '262k'],
  ['Qwen2.5-VL-72B-Instruct', 'Qwen2.5-VL 72B', 'S', '-', '32k', null, '2027-02-10'], // ⚠️ DEPRECATED - OVHcloud end of service 2027-02-10 per the official catalog
  // Removed (2026-11-22 audit): Qwen3-Embedding-8B - embedding-only model with no documented chat route; out of scope for a coding chat catalog
  // Removed (2026-11-22 audit): bge-m3 - embedding-only model, chat returns 404; out of scope for a coding chat catalog
  // Removed (2026-11-22 audit): bge-multilingual-gemma2 - embedding-only model, out of scope for a coding chat catalog
  // Fix (2026-05-26): Qwen3.5-9B ctx 128k→262k, Mistral-Small ctx 131k→128k, Mistral-Nemo ctx 128k→118k, Mistral-7B ctx 32k→127k
  ['Qwen3Guard-Gen-8B', 'Qwen3Guard Gen 8B (moderation, beta)', 'C', '-', '32k'],
  ['Qwen3Guard-Gen-0.6B', 'Qwen3Guard Gen 0.6B (moderation, beta)', 'C', '-', '32k'],
  ['Qwen3.8-27B', 'Qwen3.8 27B', 'A+', '-', '262k'], // Added (2026-09-15) — verified via live audit
  ['gemma-4-26b-a4b', 'Gemma 4 26B MoE', 'A-', '-', '256k'], // Added (2026-11-22 audit) - anonymous chat 200 on the free sandbox, no published SWE-bench Verified (tier provisional)
  ['nemotron3-nano-30b', 'Nemotron 3 Nano 30B', 'A-', '38.8%', '256k'], // Added (2026-11-22 audit) - anonymous chat 200 on the free sandbox, SWE-bench Verified 38.8% per the NVIDIA model card
  ['qwen3-vl-30b-a3b', 'Qwen3 VL 30B A3B', 'B+', '-', '32k'], // Added (2026-11-22 audit) - anonymous chat 200 on the free sandbox, no published SWE-bench Verified (tier provisional)
]



// 📖 OpenCode Zen free models — hosted AI gateway accessed through OpenCode CLI/Desktop
// 📖 Endpoint: https://opencode.ai/zen/v1/... - free access only works inside the OpenCode client
// 📖 These models are FREE on the Zen platform and only run on OpenCode CLI or OpenCode Desktop
// 📖 Login: https://opencode.ai/auth - free usage is account-bound, an API key does not unlock it outside OpenCode
// 📖 Config: set provider to opencode/<model-id> in OpenCode config
export const opencodeZen = [
  ['big-pickle',                       'Big Pickle',              'S+', '-', '200k'], // Fixed (2026-11-22 audit): sweScore '72.0%' -> '-' (unsourced stealth score); tier kept provisional
  // Removed (2026-09-29 audit): deepseek-v4-flash-free (DeepSeek V4 Flash Free) — live chat probe returns 400 "Upstream request failed: Model is unavailable" and it is gone from the docs free table; the 2026-09-21 re-add said "re-verify at next audit", verified dead
  // Removed (2026-10-10 audit): mimo-v2.5-free (MiMo-V2.5 Free) — live chat probe returns 401 ModelError "not supported" and it is absent from the /v1/models list (docs table from Oct 8 is stale on this one); replacement: mimo-v2.6-flash-free
  ['mimo-v2.6-flash-free', 'MiMo-V2.6 Flash Free', 'S+', '-', '200k'], // Added (2026-09-22) — new free promo model on the live Zen /v1/models list
  // Removed (2026-10-17 audit): step-5-preview-free (Step 5 Preview Free) — live chat probe returns "Upstream request failed: Model is unavailable", deprecated in the models.dev opencode registry, absent from the docs free table; reverses the 2026-10-10 add (Step 5 stays free on NVIDIA NIM)
  // Removed (2026-10-17 audit): ling-3.1-flash-free (Ling 3.1 Flash Free) — live chat probe returns "Model is unavailable", deprecated in the models.dev registry, absent from the docs free table
  // Removed (2026-10-17 audit): ling-3.0-flash-fin-free (Ling 3.0 Flash Fin Free) — live chat probe returns "Model is unavailable", deprecated in the models.dev registry, absent from the docs free table
  // Removed (2026-11-03 audit): nemotron-3-ultra-free (Nemotron 3 Ultra Free) — absent from the live /v1/models catalog; completion probe returns the same upstream-unavailable error as a bogus id (docs table is stale on this one); replacements: nemotron-3.5-lightning-free / nemotron-3.5-super-vl-free
  ['nemotron-3.5-lightning-free', 'Nemotron 3.5 Lightning Free', 'S+', '-', '262k'], // Added (2026-08-13)
  // Removed (2026-09-05): laguna-s-2.1-free (Laguna S 2.1 Free) - deprecated: marked status=deprecated in the models.dev registry (2026-09-05) and absent from both the Zen /v1/models endpoint and the docs free-models list; the limited-time promo ended
  // Removed (2026-10-17 audit): muse-spark-1.3-contributor-free (Muse Spark 1.3 Contributor Free) — gateway returns an explicit ModelDeprecated error; the contributor promo ended and only the paid muse-spark-1.3 ($1.25/$4.25 per 1M) remains
  // Removed (2026-11-22 audit): jev-1.13-free - live but decision-only (System One typed judgments, not chat/completions), so it is not usable as a coding model here
  // Removed (2026-11-03 audit): space-bunny-free (Space Bunny Free) — absent from the live /v1/models catalog, probe returns upstream-unavailable; the free stealth rotation ended
  // Removed (2026-11-03 audit): longcat-2.5-preview-free (LongCat 2.5 Preview Free) — absent from the live /v1/models catalog, probe returns upstream-unavailable; preview rotation ended
  // Added (2026-10-17 audit) — new free promo wave on the live Zen list (verified via FreeTierError chat probes + models.dev; note /v1/models omits some still-live free ids):
  ['beam-free', 'Beam Free', 'S+', '80.9%', '1M'], // Added (2026-10-17 audit) — Reflection Beam 1.0 (501B MoE), SWE-bench Verified 80.9% per reflection.ai; also free on Kilo/Vercel/Ollama
  // Removed (2026-11-03 audit): exo-free (Exo Free) — absent from the live /v1/models catalog, probe returns upstream-unavailable
  ['nemotron-3.5-super-vl-free', 'Nemotron 3.5 Super VL Free', 'S+', '71.1%', '1M'], // Added (2026-10-17 audit) — 1M ctx on Zen; SWE score follows the same model on NVIDIA NIM, S+ on the documented scale
  ['deepseek-v4.1-flash-free', 'DeepSeek V4.1 Flash Free', 'S+', '-', '200k'], // Added (2026-10-17 audit) — capped at 200k on Zen
  // Removed (2026-11-22 audit): glm-5.3-flash-free - retired 2026-11-18 per the official deprecated-models table
  // Added (2026-11-03 audit) — 2 new free models on the live Zen list (4 tracked ids died the same day):
  ['flint-40b-free', 'Flint 40B Free', 'S+', '74.2%', '262k'], // Added (2026-11-03 audit) — open-weight Recursive Flint (40B MoE, 2.5B active), vendor-reported SWE-bench Verified 74.2%; same model as recursive/flint-v1.0:free on OpenRouter
  // Added (2026-11-22 audit) - 4 new free ids on the live Zen list, tiers provisional (no published SWE-bench Verified):
  ['tidepool-alpha-free', 'Tidepool Alpha Free', 'S', '-', '1M'], // Added (2026-11-22 audit) - 1M ctx
  ['iceman-free', 'Iceman Free', 'S', '-', '262k'], // Added (2026-11-22 audit) - 262k ctx
  ['longcat-2.5-free', 'LongCat 2.5 Free', 'A+', '-', '1M'], // Added (2026-11-22 audit) - 1M ctx
  ['hy4-flash-free', 'Hy4 Flash Free', 'A+', '-', '1M'], // Added (2026-11-22 audit) - 1M ctx
  // Removed (2026-11-22 audit): pulse-alpha-free - retired 2026-11-06 per the official deprecated-models table
  // 2026-09-29 audit: the free-tier gate hardened since issue #181 — 403 FreeTierError even WITH the x-opencode-session header, only space-bunny-free answers plain requests; if TUI probes fail, use a real Zen key
  // Audit (2026-11-22): free access needs the OpenCode client (external probes get 429 FreeUsageLimitError even with the session header), the account is bound and an API key does not unlock it outside OpenCode; jev-1.13-free removed as decision-only
]

// 📖 Kilo source - https://api.kilo.ai/api/gateway
// 📖 OpenAI-compatible gateway. `kilo-auto/free` works without a key and routes to Kilo's current free model pool.
// 📖 Keep only the stable router model here; individual promo `:free` models churn too quickly.
export const kilo = [
  ['kilo-auto/free',                         'Kilo Auto Free',      'A+', '-',     '256k'],
  // Removed (2026-09-05): kilo-auto/small (Kilo Auto Small) - no longer free: gateway now lists it with isFree=false and paid pricing ($0.05/M prompt, $0.40/M completion); it routes to paid small models
  // Removed (2026-11-22 audit): thinkingmachines/inkling-small:free - 404 model_not_found on the live gateway
  ['reflection/beam-free', 'Reflection Beam 1.0 (free)', 'S+', '80.9%', '1M'], // Added (2026-10-17 audit) — new free flagship on the live gateway (501B MoE, released ~2026-10-05), SWE-bench Verified 80.9% per reflection.ai
  // Removed (2026-10-17 audit): stepfun/step-5-preview-free (StepFun Step 5 Preview (free)) — free endpoint delisted from the gateway, stepfun/step-5-preview now lists isFree:false with per-token pricing; reverses the 2026-10-10 add (Step 5 stays free on NVIDIA NIM)
  // Removed (2026-10-10 audit): stepfun/step-3.7-flash:free — :free variant gone from the gateway (390 models checked), only paid step-3.7-flash remains; replacement: stepfun/step-5-preview-free
  // Removed (2026-11-03 audit): poolside/laguna-s-2.1:free (Poolside Laguna S 2.1 (free)) — removed entirely from the gateway catalog (0 poolside/laguna entries in the live models list; the KiloBench leaderboard entry remains but the gateway no longer serves it). Mirrors the OpenRouter delisting
  ['nvidia/nemotron-3-ultra-550b-a55b:free', 'NVIDIA Nemotron 3 Ultra (free)', 'A+', '-', '1M'],
  // Removed (2026-11-22 audit): thinkingmachines/inkling:free - 404 model_not_found on the live gateway
  ['recursive/flint-v1.0:free', 'Recursive Flint (free)', 'S+', '74.2%', '262k'], // Fixed (2026-11-22 audit): tier A- -> S+ and sweScore '-' -> '74.2%' (Recursive model card)
  ['google/gemma-4-31b-it:free', 'Google Gemma 4 31B (free)', 'B+', '-', '262k'], // Added (2026-11-03 audit) — new free Gemma 4 31B slot on the gateway
  ['baidu/ernie-5.5-flash-preview:free', 'Baidu ERNIE 5.5 Flash Preview (free)', 'A', '-', '1M'], // Added (2026-11-22 audit) - new $0 gateway entry, tier provisional (no published SWE-bench Verified), same read as OpenRouter
  ['liquid/lfm-3-1.7b:free', 'LiquidAI LFM3-1.7B (free)', 'A', '43.4%', '262k'], // Added (2026-11-22 audit) - new $0 gateway entry, SWE-bench Verified 43.4% per the LiquidAI model card
  ['particle-ai/particle-1:free', 'Particle 1 (free)', 'A-', '-', '1M'], // Added (2026-11-22 audit) - new $0 gateway entry, tier provisional, same read as OpenRouter
  ['inclusionai/ling-3.2-flash:free', 'Ling 3.2 Flash (free)', 'B+', '-', '1M'], // Added (2026-11-22 audit) - new $0 gateway entry, tier provisional, same read as OpenRouter
  ['nvidia/nemotron-3.5-super-vl:free', 'NVIDIA Nemotron 3.5 Super VL (free)', 'S+', '71.1%', '1M'], // Added (2026-10-17 audit) — new $0 entry on the live gateway, 1M ctx; SWE score follows the same model on NVIDIA NIM, S+ on the documented scale
  // Removed (2026-11-22 audit): xingchen-agi/xing4.0-29b-a4b:free - 404 model_not_found on the live gateway
  // Removed (2026-09-15): minimax/minimax-m2.7:free (MiniMax M2.7 (free)) — no longer free on Kilo gateway
  // Removed (2026-11-22 audit): cohere/north-mini-code:free - 404 model_not_found on the live gateway
  // Removed (2026-11-03 audit): nvidia/nemotron-3-super-120b-a12b:free (NVIDIA Nemotron 3 Super (free)) — :free variant retired, only the paid variant remains ($0.08/$0.45 per M, 1M ctx); replacement: nvidia/nemotron-3-ultra-550b-a55b:free
  // Removed (2026-11-03 audit): poolside/laguna-xs-2.1:free (Poolside Laguna XS 2.1 (free)) — removed entirely from the gateway catalog (0 poolside/laguna entries; leaderboard keeps a KiloBench 26.7% entry but the gateway no longer serves it)
  ['nvidia/nemotron-3.5-lightning:free', 'NVIDIA Nemotron 3.5 Lightning (free)', 'B+', '-', '1M'],
  // Removed (2026-11-22 audit): dots-studio/dots-3-note-preview:free - 404 model_not_found on the live gateway
  ['openrouter/free', 'OpenRouter Free Models Router', 'B', '-', '200k'], // Fixed (2026-10-17 audit): ctx '-' → '200k' (live gateway metadata exposes context_length again; reverses the 2026-10-10 read)
  // Removed (2026-09-15): minimax/minimax-m3:free (MiniMax M3 (free)) — free variant removed from gateway
  // Removed (2026-09-15): thinkingmachines/inkling:free (Inkling (free)) — free variant no longer exposed
  // Removed (2026-11-22 audit): liquid/lfm-2.5-2.6b:free - 404 model_not_found on the live gateway, replaced by liquid/lfm-3-1.7b:free
  // Removed (2026-09-28 audit): z-ai/glm-5.2:free (GLM 5.2 (free)) — no longer free on Kilo: now billed $1.40/$4.40 per M
  // Removed (2026-09-29 audit): inclusionai/ling-3.0-flash-fin:free (Ling 3.0 Flash Fin (free)) — :free variant gone from the catalog (395 models checked), id survives only as paid ($0.075/M prompt); replacement: ling-3.0-flash-sante:free
  // Removed (2026-10-10 audit): inclusionai/ling-3.0-flash-sante:free — :free variant gone from the gateway (only paid remains), and it is a health/medicine-specialized model anyway
  // Removed (2026-10-17 audit): inclusionai/ling-3.1-flash (Ling 3.1 Flash (free)) — listing now shows isFree:false with paid per-token pricing, no free variant; reverses the 2026-10-10 add
  // Removed (2026-09-28 audit): inclusionai/ling-3.0-flash-vl:free — :free variant removed from the Kilo catalog (base now billed)
  // Removed (2026-09-28 audit): nex-agi/nex-n2.5-mini:free + nex-agi/nex-n2.5-pro:free — nex-agi provider dropped from the Kilo catalog entirely
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'NVIDIA Nemotron 3 Nano Omni (free)', 'A+', '-', '256k'], // Fixed (2026-09-28 audit): ctx '262k' → '256k', // Added (2026-09-21) — new in the live free gateway list
  // Removed (2026-10-10 audit): qwen/qwen3.8-27b:free — :free variant removed from the gateway (mirrors its OpenRouter deletion the same day); only paid qwen/qwen3.8-27b remains
  ['stealth/glyph-cluster', 'Glyph Cluster (stealth, free)', 'A+', '-', '256k'], // Added (2026-10-10 audit) — new free stealth coding model, replaces the rotated-out space-bunny-alpha slot (also live on Vercel gateway)
  // Removed (2026-10-10 audit): stealth/space-bunny-alpha — deleted entirely from the gateway, stealth slot replaced by glyph-cluster
  // Removed (2026-10-10 audit): nvidia/nemotron-3.5-content-safety:free — moderation classifier, not a coding model (catalog hygiene; matches OpenRouter/Requesty cleanup)
]

// 📖 LLM7 source - https://api.llm7.io/v1
// 📖 Free unauthenticated tier works with tight shared limits; optional free token at https://token.llm7.io
// 📖 Pro-tagged models from /v1/models are intentionally excluded.
export const llm7 = [
  // 📖 LLM7 live /v1/models: only `turbo` tier is free (noKeyNeeded). All `pro` models are usage-based paid.
  // 📖 Verified live 2026-11-22 (audit): free tier = mistral-Nemo-Instruct-2407 (128k), gpt-oss:20b (128k),
  // 📖 codestral-latest (32k) and the new gemma-3-27b (262k) - all turbo, usage_based_only=false. Only the turbo tier is free.
  // Removed (2026-09-05): glm-5.3, glm-5.3-flash, gemini-3.5-flash-low, gpt-5.4, gpt-5.4-mini, gpt-5.5, gpt-5.6-sol, grok-4.5, grok-4.6 — tier=pro usage_based_only (paid) or nonexistent on /v1/models (PR #178 additions reverted)
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-10-10 audit): minimax-m2.7 (MiniMax M2.7) — gone from the live /v1/models; successor minimax-m3 is usage_based_only=true (paid), so no free MiniMax remains
  // Removed (2026-11-22 audit): GLM-5.3-Flash - status=retired (2026-11-14) in the official catalog history, anonymous probe returns 400
  // Removed (2026-11-22 audit): DeepSeek-V4-Flash-0731 - status=retired (2026-11-18) in the official catalog history; only the paid lowercase replacement remains
  // ── A+ tier — SWE-bench Verified 50–60% ──
  // Removed (2026-09-05): gemini-3.1-flash-lite (Gemini 3.1 Flash Lite) — now tier=pro usage_based_only (paid) per live /v1/models
  // Removed (2026-11-03 audit): kimi-k2.7-code (Kimi K2.7 Code) — flipped to paid-only: API now reports tier=pro usage_based_only=true ($0.48/$2.00 per 1M); free nil-token probe returns 401
  // Removed (2026-11-03 audit): kimi-k2.6 (Kimi K2.6) — flipped to paid-only: API now reports tier=pro usage_based_only=true ($0.20/$0.90 per 1M); free nil-token probe returns 401. Still free on NVIDIA NIM / Pollinations / Ollama Cloud
  ['mistral-Nemo-Instruct-2407', 'Mistral Nemo 12B Instruct', 'A-', '-', '128k'], // Added (2026-08-13)
  ['gpt-oss:20b', 'GPT-OSS 20B', 'B+', '-', '128k'], // Added (2026-10-10 audit) — open-weights 20B reasoning, turbo tier usage_based_only=false
  ['gemma-3-27b', 'Gemma 3 27B', 'B', '-', '262k'], // Added (2026-11-22 audit) - turbo tier, anonymous probe returns 200; no published SWE-bench Verified (tier provisional)
  // Removed (2026-11-22 audit): minimax-m2.7 - status=retired (2026-11-18) in the official catalog history
  // Removed (2026-11-22 audit): nemotron-3-nano:30b - status=retired (2026-11-09) in the official catalog history
  // ── A tier — SWE-bench Verified 40–50% ──
  ['codestral-latest', 'Codestral Latest', 'A', '40.0%', '32k'],
]

// 📖 Routeway source - https://api.routeway.ai/v1/models
// 📖 OpenAI-compatible gateway with explicit zero-price `:free` chat models.
// 📖 Live catalog checked 2026-06-11; only chat-completions models with free pricing are listed.
export const routeway = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-11-03 audit): deepseek-v4-flash:free (DeepSeek V4 Flash) — :free variant gone from the live API, the base id now bills $0.12/$0.25 per M; replacement: deepseek-v4.1-flash:free
  // Removed (2026-11-03 audit): minimax-m2.7:free (MiniMax M2.7) — id gone from the live API entirely (closest paid: minimax-m2.5); replacement: minimax-m3.1-flash:free
  // Removed (2026-11-22 audit): deepseek-v4.1-flash:free - absent from the live 282-model catalog and from the public catalog, detail route blank
  ['minimax-m3.1-flash:free', 'MiniMax M3.1 Flash', 'S+', '-', '42k'], // Added (2026-11-03 audit) — the free MiniMax slot moved to the M3.1 generation, $0/$0, 42k ctx
  ['muse-glimmer-30b:free', 'Muse Glimmer 30B', 'S+', '76.0%', '131k'], // Fixed (2026-11-22 audit): tier B+ -> S+ and sweScore '-' -> '76.0%' per the official Meta model card (high reasoning)
  // Added (2026-09-28 audit) — 6 free Gemma 4 26B A4B community finetunes, 62k ctx, vision + tools + reasoning:
  ['gemma-4-26b-a4b-it-chimerax:free', 'Gemma 4 26B A4B ChimeraX', 'B+', '-', '62k'],
  ['gemma-4-26b-a4b-it-darksoul:free', 'Gemma 4 26B A4B Darksoul', 'B+', '-', '62k'],
  ['gemma-4-26b-a4b-it-luminous:free', 'Gemma 4 26B A4B Luminous', 'B+', '-', '62k'],
  ['gemma-4-26b-a4b-it-moonlight:free', 'Gemma 4 26B A4B Moonlight', 'B+', '-', '62k'],
  ['gemma-4-26b-a4b-it-musica:free', 'Gemma 4 26B A4B Musica', 'B+', '-', '62k'],
  ['gemma-4-26b-a4b-it-meromero:free', 'Gemma 4 26B A4B Meromero', 'B+', '-', '62k'],
  // Removed (2026-09-15): kimi-k2.6:free (Kimi K2.6) — free variant removed, now paid-only; replacement: minimax-m2.7:free
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-09-05): laguna-xs.2:free (Poolside Laguna XS.2) - laguna-xs.2 no longer offered in any form, superseded by paid laguna-s-2.1
  // Removed (2026-09-05): gpt-oss-120b:free (GPT OSS 120B) - free variant discontinued, only paid gpt-oss-120b remains ($0.04/$0.30 per M)
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-05): gemma-4-31b-it:free (Gemma 4 31B) - free variant discontinued, only paid gemma-4-31b-it remains ($0.11/$0.33 per M)
  // Removed (2026-09-05): nemotron-3-nano-30b-a3b:free (Nemotron Nano 30B) - free variant discontinued, only paid nemotron-3-nano-30b-a3b remains ($0.10/$0.15 per M)
  // ── A- tier — SWE-bench Verified 35–40% ──
  // Removed (2026-09-05): llama-3.3-70b-instruct:free (Llama 3.3 70B) - free variant discontinued, only paid llama-3.3-70b-instruct remains ($0.13/$0.39 per M)
  // ── B+ tier — SWE-bench Verified 30–35% ──
  // Removed (2026-09-05): nemotron-nano-9b-v2:free (Nemotron Nano 9B) - free variant discontinued, only paid nemotron-nano-9b-v2 remains ($0.02/$0.04 per M)
  // ── B tier — SWE-bench Verified 20–30% ──
  // Removed (2026-09-05): llama-3.1-8b-instruct:free (Llama 3.1 8B) - free variant discontinued, only paid llama-3.1-8b-instruct remains ($0.09/$0.09 per M)
  // Removed (2026-09-05): llama-3.2-3b-instruct:free (Llama 3.2 3B) - free variant discontinued, only paid llama-3.2-3b-instruct remains ($0.02/$0.05 per M)
  // ── C tier — lightweight/edge models ──
  // Removed (2026-09-05): llama-3.2-1b-instruct:free (Llama 3.2 1B) - free variant discontinued, only paid llama-3.2-1b-instruct remains ($0.15/$0.07 per M)
]

// 📖 Novita AI source - https://api.novita.ai/openai/v1/models
// 📖 ⚠️ RETIRED 2026-11-22 - none of the 5 tracked zero-price ids is left: they are absent from the
// 📖 live public catalog (78 ids), every per-model page 404s and the pricing/catalog feeds expose no
// 📖 $0/$0 chat pair. Kept as an empty array so downstream provider-metadata/config code that imports
// 📖 `novita` and references the 'novita' key (NOVITA_API_KEY) doesn't crash; the entry is also
// 📖 commented out of the `sources` map below so it won't appear in the catalog.
export const novita = [
  // Removed (2026-11-22 audit): all 5 entries - dev/glm46, apodex/apodex-1.1-mini, bunny,
  // nvrouter/auto, nvrouter/fusion. No free route remains.
]

// 📖 Pollinations AI source - https://gen.pollinations.ai
// 📖 OpenAI-compatible endpoint: https://gen.pollinations.ai/v1/chat/completions
// 📖 Quota (2026-11-22 audit): there is no recurring daily grant - a new account gets a ONE-TIME Quest
// 📖 credit (roughly $1.50-$2.50, no card) and a free API key from https://enter.pollinations.ai is required.
// 📖 Since 2026-09 the /v1/chat/completions endpoint requires a free API key (401 without one); the legacy
// 📖 anonymous path only reaches the default model via GET /text. Once the Quest credit is spent, paid Pollen is needed.
// 📖 Verified live 2026-09-21 via GET /v1/models (411 models): the old short ids (openai, deepseek, kimi,
// 📖 laguna...) are no longer primary ids but still resolve as aliases of the canonical namespaced models.
// 📖 Note (2026-09-21): the anonymous tier (text.pollinations.ai/models) now lists ONLY openai-fast;
// 📖 the models below need the free API key + Pollen credits (gen.pollinations.ai). Re-check the Pollen
// 📖 free-grant policy at next audit: if grants stop covering these models, this list must shrink to openai-fast.
// 📖 Note (2026-09-26, issue #190): a subset of models now requires PAID Pollen even with a free key — they
// 📖 return HTTP 200 with the error embedded in the completion content ("not enough credits / needs paid
// 📖 Pollen"), so status-code-only probes see them as healthy. 6 such models were removed; when auditing
// 📖 Pollinations, sniff the completion content for that message, not just the HTTP status.
export const pollinations = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-09-28 audit): laguna (Laguna S 2.1) — now paid_only in the Pollinations catalog (Pollen pricing)
  // Removed (2026-09-26): minimax-m2.7 (MiniMax M2.7) — now requires paid Pollen: HTTP 200 with an embedded "not enough credits, this model needs paid Pollen" error on free-tier keys (issue #190); replacement: minimax (MiniMax M3, still free via Pollen grants)
  ['glm-5.3', 'Z.ai GLM-5.3', 'S+', '-', '1M'],
  ['kimi', 'Moonshot Kimi K2.6', 'S+', '80.2%', '262k'],
  ['minimax', 'MiniMax M3', 'S+', '80.5%', '524k'],
  ['moonshotai/kimi-k3', 'Moonshot Kimi K3', 'S+', '76.8%', '1M'], // Added (2026-09-21) — canonical id, healthy on live /v1/models; score follows the Kimi K3 entry on NVIDIA
  ['moonshotai/kimi-k3.1-pro', 'Moonshot Kimi K3.1 Pro', 'S+', '-', '1M'], // Added (2026-11-22 audit) - new free listing (paid_only=false), no published SWE-bench Verified (tier provisional)
  ['minimax/minimax-m3.1-flash', 'MiniMax M3.1 Flash', 'S+', '-', '1M'], // Added (2026-11-22 audit) - new free listing (paid_only=false), no published SWE-bench Verified (tier provisional)
  // Removed (2026-09-28 audit): deepseek/deepseek-v4-pro — now paid_only in the Pollinations catalog; still free on NVIDIA NIM
  // Removed (2026-09-26): qwen/qwen3.8-max (Qwen3.8 Max) — requires paid Pollen (embedded credits error on free-tier keys, issue #190); still free on DashScope
  // Removed (2026-09-26): google/gemini-3.1-pro-preview (Gemini 3.1 Pro Preview) — requires paid Pollen (embedded credits error on free-tier keys, issue #190); no free Gemini Pro tier anywhere
  ['openai/gpt-5.5', 'OpenAI GPT-5.5', 'S+', '-', '1M'], // Added (2026-09-21) — canonical id, healthy on live /v1/models
  ['openai/gpt-6-astra', 'OpenAI GPT-6 Astra', 'S+', '-', '1M'], // Added (2026-09-21) — canonical id, healthy on live /v1/models
  ['openai/gpt-5.6-sol', 'OpenAI GPT-5.6 Sol', 'S+', '-', '1M'], // Added (2026-11-03 audit) — new free listing on live /v1/models (paid_only=false)
  ['z-ai/glm-5.3-flash', 'Z.ai GLM-5.3 Flash', 'S+', '-', '1M'], // Added (2026-09-21) — canonical id, healthy on live /v1/models
  // Removed (2026-09-26): nvidia/nemotron-3-ultra (NVIDIA Nemotron 3 Ultra) — requires paid Pollen (embedded credits error on free-tier keys, issue #190); still free on NVIDIA NIM
  // Removed (2026-09-28 audit): anthropic/claude-opus-5 — now paid_only in the Pollinations catalog
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-09-28 audit): anthropic/claude-sonnet-5 — now paid_only in the Pollinations catalog
  // Removed (2026-10-17 audit): qwen-coder (Qwen3 Coder 30B) — flipped to paid: qwen/qwen3-coder-30b-a3b-instruct now carries paid_only=true and anonymous calls 401; still free on Scaleway
  ['deepseek', 'DeepSeek V4 Flash', 'S+', '79.0%', '1M'], // Fixed (2026-09-21): alias now resolves to deepseek/deepseek-v4-flash (V4 Flash 0731), was V3; re-scored per the V4 Flash family entry
  // Removed (2026-09-28 audit): kimi-code (Kimi K2.7 Code) — now paid_only in the Pollinations catalog
  ['openai', 'OpenAI GPT-5.4 Nano', 'B+', '-', '400k'], // Fixed (2026-09-21): alias now resolves to openai/gpt-5.4-nano (was a generic GPT alias); re-tiered to the nano class
  // Removed (2026-09-26): qwen/qwen3-coder-next (Qwen3 Coder Next) — requires paid Pollen (embedded credits error on free-tier keys, issue #190); still free on DashScope
  ['openai/gpt-5.6-luna', 'OpenAI GPT-5.6 Luna', 'S', '-', '1M'], // Added (2026-09-21) — canonical id, healthy on live /v1/models
  ['openai/gpt-6.1-terra', 'OpenAI GPT-6.1 Terra', 'S', '-', '1M'], // Added (2026-11-03 audit) — new free listing on live /v1/models (added upstream 2026-10-26)
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['deepseek/deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'A+', '-', '1M'], // Added (2026-09-22) — healthy on live /v1/models, successor to V4 Flash
  ['deepseek/deepseek-v4.1-flash-1017', 'DeepSeek V4.1 Flash 1017', 'A+', '-', '1M'], // Added (2026-11-22 audit) - new dated free listing (paid_only=false), tier follows the V4.1 Flash entry above
  ['meta/muse-spark-open', 'Meta Muse Spark Open', 'A+', '-', '1M'], // Added (2026-11-22 audit) - new free listing (paid_only=false), no published SWE-bench Verified (tier provisional)
  ['openai/gpt-5.6-terra', 'OpenAI GPT-5.6 Terra', 'A+', '-', '1M'], // Added (2026-11-03 audit) — new free listing on live /v1/models
  ['stealth/glyph-cluster', 'Glyph Cluster (Stealth)', 'A+', '-', '256k'], // Added (2026-11-03 audit) — experimental coding-focused stealth model (256k ctx, 99.94% success over 1612 requests per live metadata); same stealth slot as Kilo/Vercel/onomeo
  // Removed (2026-09-28 audit): meituan/longcat-2.0 (LongCat 2.0) — now paid_only in the Pollinations catalog
  // Removed (2026-09-26): gemma-4-31b (Gemma 4 31B) — requires paid Pollen (embedded credits error on free-tier keys, issue #190); the free Gemma route is NVIDIA NIM
  ['gpt-oss', 'GPT OSS 20B', 'S', '60.7%', '128k'], // Fixed (2026-11-22 audit): alias resolves to OpenAI GPT OSS 20B, sweScore '50.3%' -> '60.7%' (official high-reasoning card) and tier A+ -> S
  // Removed (2026-09-28 audit): qwen3.7-flash — now paid_only in the Pollinations catalog; still free on DashScope
  // Added (2026-09-28 audit) — 7 new free models on the live gen.pollinations.ai catalog:
  ['openai/gpt-6-sol', 'OpenAI GPT-6 Sol', 'S+', '-', '1M'],
  ['openai/gpt-5.3-codex', 'OpenAI GPT-5.3 Codex', 'S+', '-', '400k'],
  ['openai/gpt-6-luna', 'OpenAI GPT-6 Luna', 'S', '-', '1M'],
  // Removed (2026-10-17 audit): z-ai/glm-5.2 — flipped to paid (paid_only=true, anonymous 401); reverses the 2026-09-28 add
  ['openai/gpt-5.4-mini', 'OpenAI GPT-5.4 Mini', 'A+', '-', '400k'],
  ['x-ai/grok-4.20', 'xAI Grok 4.20', 'A+', '-', '256k'], // Fixed (2026-10-17 audit): ctx '262k' → '256k' (live catalog metadata)
  // Removed (2026-10-17 audit): amazon/nova-2-lite-v1 — flipped to paid (paid_only=true, anonymous 401)
  // Removed (2026-10-17 audit): x-ai/grok-4.7 — flipped to paid (paid_only=true, anonymous 401); reverses the 2026-10-10 add, grok-4.6 is the free successor
  // Removed (2026-10-17 audit): stepfun/step-5-preview — flipped to paid (paid_only=true, anonymous 401); reverses the 2026-10-10 add (Step 5 stays free on NVIDIA NIM)
  // Added (2026-10-10 audit) — 3 new free models on live gen.pollinations.ai/v1/models (the 4 other candidates found the same day were skipped: kimi-k2.7-code, qwen3-coder-next, laguna-s-2.1, longcat-2.0 all carry a 2026-09 "paid Pollen" verdict and the audit did not sniff completions to clear it, see issue #190 note above):
  ['openai/gpt-6.1-sol', 'OpenAI GPT-6.1 Sol', 'S+', '-', '1M'], // Added (2026-10-10 audit) — new in the live catalog, GPT-6 Sol successor, 1M ctx
  // Added (2026-10-17 audit) — 6 new free models on live gen.pollinations.ai/v1/models (5 catalog slots flipped to paid Pollen the same day):
  // Removed (2026-11-22 audit): qwen/qwen3.8-2.4t-a95b - now paid_only=true in the live catalog and the Quest credit cannot cover paid Pollen
  ['x-ai/grok-4.6', 'xAI Grok 4.6', 'A+', '-', '200k'], // Added (2026-10-17 audit) — free successor of the paid-flipped grok-4.7
  ['openai/gpt-5.4', 'OpenAI GPT-5.4', 'S', '-', '1M'], // Added (2026-10-17 audit) — full GPT-5.4 at 1M ctx (the 'openai' alias keeps routing to gpt-5.4-nano)
  ['x-ai/grok-4.3', 'xAI Grok 4.3', 'B+', '-', '200k'], // Added (2026-10-17 audit) — legacy Grok slot back on the free tier
  ['nvidia/nemotron-3-ultra', 'NVIDIA Nemotron 3 Ultra', 'S+', '71.9%', '256k'], // Re-added (2026-10-17 audit) — back to paid_only=false in the live catalog; reverses the 2026-09-26 paid-Pollen removal, score follows the same model on NVIDIA
  ['mistralai/mistral-large-3', 'Mistral Large 3', 'A+', '-', '256k'], // Added (2026-10-17 audit) — new free listing; tier follows mistral-large-3:675b on ollama-cloud
  // Audit (2026-09-28): text.pollinations.ai/models endpoint is down (502); catalog now read from gen.pollinations.ai
  // ── B+ tier ──
  ['nemotron-3.5-lightning', 'Nemotron 3.5 Lightning', 'B+', '-', '256k'], // Fixed (2026-10-17 audit): ctx '262k' → '256k' (live catalog metadata)
  ['meta/llama-3.3-70b-instruct', 'Llama 3.3 70B', 'B', '-', '128k'], // Added (2026-11-03 audit) — new free listing on live /v1/models
]

// 📖 SiliconFlow source - https://api.siliconflow.cn/v1/chat/completions
// 📖 OpenAI-compatible endpoint: https://api.siliconflow.cn/v1
// 📖 Free tier: permanently free models at $0, but since 2026-05-15 a MANDATORY real-name verification
// 📖 is required (regional ID documents or the offline alternative), not SMS only; no card needed.
// 📖 Verified 2026-08-23 via pricing page + docs: THUDM/GLM-Z1-9B-0414 is 免费; Qwen3-8B and DeepSeek-R1-Distill-Qwen-7B
// 📖 documented as free in SiliconFlow guide 2026-06-05 ("Three models are completely free: Qwen3-8B, DeepSeek-R1-Distill-Qwen-7B, DeepSeek-OCR")
// 📖 and still reachable with free-tier rate limits (1000 RPM). Keep only the chat text models here.
export const siliconflow = [
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-21): THUDM/GLM-Z1-9B-0414 + THUDM/GLM-4-9B-0414 — deprecated 2026-03-12 per official release notes, service terminated
  // Removed (2026-09-22): deepseek-ai/DeepSeek-R1-0528-Qwen3-8B (DeepSeek R1 0528 Qwen3 8B) — no longer on the official pricing page free list, deepseek-ai catalog is paid-only now
  // ── B+ tier ──
  // Removed (2026-09-21): Qwen/Qwen3-8B ($0.06/M) + Qwen/Qwen2.5-7B-Instruct ($0.05/M) — no longer free, both now paid on the official model pages; replacement: Qwen/Qwen3.5-4B
  // Removed (2026-09-05): deepseek-ai/DeepSeek-R1-Distill-Qwen-7B (DeepSeek R1 Distill Qwen 7B) - No longer listed on SiliconFlow pricing/catalog page (0 of 184 model records); superseded by the newer R1-0528 Qwen3 distill
  // Removed (2026-09-22): Qwen/Qwen3.5-4B (Qwen3.5 4B) — absent from the official pricing page free list, remaining Qwen3.5 sizes are all paid
  ['XingChenAGI/Xing4.0-29B', 'Xing4.0 29B', 'S+', '75.0%', '256k'], // Fixed (2026-11-22 audit): sweScore '-' -> '75.0%' and tier A- -> S+ per the official TeleAI model card (same checkpoint as the hosted route)
  // Re-added (2026-11-03 audit) — 6 small chat models are 免费 again on the official pricing page with price-0 rows in the console catalog payload (exact ctx verified): reverses the 2026-09 paid/deprecated verdicts. GLM-5.3-Flash stays excluded: the rendered pricing table shows it paid (¥0.80/¥2.80) despite one stale price-0 payload block
  // ── B+ tier ──
  ['Qwen/Qwen3-8B', 'Qwen3 8B', 'B+', '-', '128k'], // Re-added (2026-11-03 audit) — 免费 again on the official pricing page (reverses the 2026-09-21 paid verdict)
  ['deepseek-ai/DeepSeek-R1-0528-Qwen3-8B', 'DeepSeek R1 0528 Qwen3 8B', 'B+', '-', '128k'], // Re-added (2026-11-03 audit) — 免费 again on the official pricing page (reverses the 2026-09-22 removal)
  ['THUDM/GLM-4-9B-0414', 'GLM-4 9B 0414', 'B+', '-', '32k'], // Re-added (2026-11-03 audit) — 免费 again on the official pricing page (reverses the 2026-09-21 deprecation verdict)
  ['THUDM/GLM-Z1-9B-0414', 'GLM-Z1 9B 0414', 'B', '-', '128k'], // Re-added (2026-11-03 audit) — 免费 again on the official pricing page (reverses the 2026-09-21 deprecation verdict)
  ['Qwen/Qwen3.5-4B', 'Qwen3.5 4B', 'B', '-', '256k'], // Re-added (2026-11-03 audit) — 免费 again on the official pricing page (reverses the 2026-09-22 removal)
  ['Qwen/Qwen2.5-7B-Instruct', 'Qwen2.5 7B Instruct', 'C', '-', '32k'], // Re-added (2026-11-03 audit) — 免费 again on the official pricing page (reverses the 2026-09-21 paid verdict)
  // Audit (2026-10-10): Xing4.0-29B re-confirmed 免费 on the official pricing page. The pricing page also lists Qwen3-8B, DeepSeek-R1-0528-Qwen3-8B, Qwen3.5-4B, Qwen2.5-7B-Instruct, GLM-4-9B-0414, GLM-Z1-9B-0414 as 免费 again — NOT re-added: each one carries a recorded paid/deprecated verdict from the 2026-09 audits and the API could not be cross-checked (401 token required, ctx unverified). Re-verify with a real key before re-adding.
  // Removed (2026-09-28 audit): tencent/Hunyuan-MT-7B (Hunyuan MT 7B) — delisted from the SiliconFlow marketplace; only Tencent model left is paid tencent/Hy4-preview
  // Removed (2026-09-21): Qwen/Qwen2.5-Coder-7B-Instruct (Qwen2.5 Coder 7B Instruct) — taken offline by SiliconFlow (official release note 2026-03-10, effective 2026-03-17; 0 of 181 records on today's pricing page); the 2026-09-15 re-add was erroneous. Replacement: Qwen/Qwen3-8B
]

// 📖 Requesty source - https://router.requesty.ai/v1
// 📖 OpenAI-compatible gateway: https://router.requesty.ai/v1/chat/completions
// 📖 Free tier: 200 req/day on zero-price free models (4× OpenRouter), no card, EU residency, routing/caching included.
// 📖 Verified live 2026-08-23 via GET /v1/models (676 models, 12 with input_price=0 & output_price=0).
export const requesty = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['nvidia/nemotron-3-ultra-550b-a55b', 'Nemotron 3 Ultra', 'S+', '71.9%', '1M'],
  // Removed (2026-11-22 audit): poolside/laguna-xs.2 - absent from the global and EU 787-model catalogs and from the public directory
  // ── S tier — SWE-bench Verified 60–70% ──
  // Removed (2026-11-22 audit): nvidia/nemotron-3-super-120b-a12b - absent from the global and EU catalogs, the free docs are stale
  // Removed (2026-11-22 audit): poolside/laguna-m.1 - absent from the global and EU 787-model catalogs and from the public directory
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['google/gemma-4-31b-it', 'Gemma 4 31B', 'A+', '52.0%', '256k'], // Fixed (2026-10-17 audit): ctx '262k' → '256k' (live context_window on router.requesty.ai)
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', 'Nemotron 3 Omni', 'A+', '-', '128k'], // Fixed (2026-11-22 audit): sweScore '52.0%' -> '-' (no published figure backs 52.0 on Requesty)
  // ── A tier — SWE-bench Verified 40–50% ──
  ['nvidia/nemotron-3-nano-30b-a3b', 'Nemotron Nano 30B', 'A-', '38.8%', '256k'], // Fixed (2026-10-17 audit): ctx '262k' → '256k' (live context_window)
  // ── B+ tier — SWE-bench Verified 30–35% ──
  ['nvidia/nemotron-3.5-lightning-30b-a3b', 'Nemotron 3.5 Lightning', 'B+', '-', '1M'],
  // ── B tier — SWE-bench Verified 20–30% ──
  ['mistral/leanstral-1-5', 'Leanstral 1.5', 'B', '-', '256k'], // Fixed (2026-10-17 audit): ctx '262k' → '256k' (live context_window)
  // Removed (2026-11-22 audit): novita/inclusionai/ling-3.0-tiny - absent from the global and EU catalogs and from the public directory
  ['novita/ling-3.1-flash', 'Ling 3.1 Flash', 'B+', '-', '256k'], // Fixed (2026-10-17 audit): id 'novita/inclusionai/ling-3.1-flash' → 'novita/ling-3.1-flash' (silent router rename, the inclusionai path was dropped) + ctx '262k' → '256k' (live context_window); added 2026-10-10
  // ── C tier — other zero-price models (kept for breadth) ──
  // Removed (2026-10-10 audit): nvidia/nemotron-3.5-content-safety — moderation guardrail classifier (Gemma-3-4B fine-tune, tools:false), not a coding model (catalog hygiene; matches OpenRouter/Kilo cleanup)
  ['nvidia/muse-glimmer-30b', 'Muse Glimmer 30B', 'S+', '76.0%', '128k'], // Fixed (2026-11-22 audit): tier C -> S+ and sweScore '-' -> '76.0%' per the official Meta model card
]

// 📖 OrcaRouter source - https://api.orcarouter.ai/v1
// 📖 OpenAI-compatible gateway: https://api.orcarouter.ai/v1/chat/completions
// 📖 Zero-markup AI gateway: token prices are passed through at provider rates, so only
// 📖 the explicitly $-0 models are listed here. Verified live 2026-09-29 via GET /v1/models
// 📖 + GET /api/free-package/public (authoritative free list: exactly the five -free ids).
// 📖 Free tier: 10 req/min, 50 req/day, GitHub account required; hidden per-request prompt cap.
// 📖 The orcarouter/fusion trio was removed 2026-09-29: each fusion request bills the SUM of
// 📖 its paid frontier panel legs (docs /routing/fusion), it was never actually free.
export const orcarouter = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['deepseek/deepseek-v4-flash-free', 'DeepSeek V4 Flash (Free)', 'S+', '79.0%', '1M'],
  ['deepseek/deepseek-v4.1-flash-free', 'DeepSeek V4.1 Flash (Free)', 'S+', '-', '1M'], // Fixed (2026-11-22 audit): sweScore '74.2%' -> '-' (74.2 is the DeepSWE v1.1 figure, not SWE-bench Verified)
  // ── S tier — SWE-bench Verified 60–70% ──
  ['tencent/hy3-free', 'Tencent Hy3 (Free)', 'S', '-', '256k'],
  ['orcarouter/free', 'OrcaRouter Free (difficulty-routed)', 'S', '-', '-'], // Added (2026-09-15) — verified via live audit
  // ── A+ tier — SWE-bench Verified 50–60% ──
  // Removed (2026-09-15): qwen/qwen3.8-27b-free (Qwen3.8 27B (Free)) — no longer in catalog; only paid variant remains; replacement: z-ai/glm-5.3-flash-free
  ['z-ai/glm-5.3-flash-free', 'GLM-5.3 Flash (Free)', 'A+', '-', '1M'], // Added (2026-09-15) — verified via live audit
  // ── A tier — SWE-bench Verified 40–50% ──
  // Removed (2026-09-29 audit): orcarouter/fusion + fusion-mini + fusion-flash — ids still exist but official docs state each fusion request is billed as the sum of its paid frontier panel legs (Claude Opus 4.8, GPT-5.5, Gemini 3.1 Pro) at cost; the 2026-09-22 "$0 per /v1/models" reading was wrong, the pricing endpoint does not reflect fusion billing
  ['tencent/hy4-preview-free', 'Tencent Hy4 Preview (Free)', 'S', '-', '1M'], // Added (2026-09-28 audit) — new free id, 1M ctx, shadows the Hy4 770B MoE flagship
  // Removed (2026-11-22 audit): orca/orcaverify-text1.0-free - explicit model_not_found for both free and paid ids, absent from the catalogs and the free package; decision detector, not chat
]

// 📖 Vercel AI Gateway source - https://vercel.com/docs/ai-gateway
// 📖 OpenAI-compatible gateway: https://ai-gateway.vercel.sh/v1/chat/completions
// 📖 Official Vercel gateway at list prices (zero markup). The $5/month free credit requires a
// 📖 payment method, only covers a subset of the catalog and ends after the first credit purchase;
// 📖 separate zero-price promotional routes (input AND output priced 0) are what this list tracks.
// 📖 Verified live 2026-11-22 via GET /v1/models (517 entries, 6 zero-price language ids).
// 📖 Caveats: eligibility for the credit is subset-only and buying credits once permanently moves
// 📖 the account to the paid tier (official FAQ), which is why this provider is quotaCode 'limited'.
export const vercelGateway = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  // Removed (2026-09-15): minimax/minimax-m3-free (MiniMax M3 (Free)) — free variant removed, now paid-only
  // Removed (2026-09-15): minimax/minimax-m2.7-free (MiniMax M2.7 (Free)) — free variant removed, now paid-only
  // Removed (2026-11-03 audit): poolside/laguna-s-2.1-free (Laguna S 2.1 (Free)) — absent from the live gateway catalog; only the paid poolside/laguna-s-2.1 remains ($0.09/$0.18 per M, 1M ctx). The 2026-09-29 "$0/$0" note is stale; mirrors the OpenRouter delisting
  ['reflection/beam-free', 'Beam 1.0 (Free)', 'S+', '80.9%', '1M'], // Added (2026-10-17 audit) — new $0/$0 flagship (Reflection Beam 1.0, 501B MoE, released 2026-10-05), SWE-bench Verified 80.9% per reflection.ai. 2026-11-03 audit: the base id reflection/beam is ALSO $0/$0 now, not added (duplicate of this entry)
  ['recursive/flint-v1.0', 'Recursive Flint 1.0', 'S+', '74.2%', '262k'], // Added (2026-11-22 audit) - zero-price endpoints on the live gateway, SWE-bench Verified 74.2% per the Recursive model card
  // ── B+ tier — vertical-tuned lightweight (coding secondary) ──
  // Removed (2026-09-28 audit): inclusionai/ling-3.0-flash-fin-free + inclusionai/ling-3.0-flash-vl-free — free variants removed from the gateway, only paid variants remain
  // Removed (2026-10-10 audit): inclusionai/ling-3.0-flash-sante-free — the free slot was upgraded: gateway now serves ling-3.1-flash-free at $0/$0 (paid ling-3.0-flash-sante still listed)
  // Removed (2026-10-17 audit): inclusionai/ling-3.1-flash-free — delisted from the gateway entirely, only the paid inclusionai/ling-3.1-flash remains ($0.30/$0.90 per M); reverses the 2026-10-10 add
  ['nvidia/nemotron-3.5-lightning-free', 'Nemotron 3.5 Lightning (Free)', 'A+', '-', '1M'], // Fixed (2026-11-22 audit): sweScore '54.3%' -> '-' (not supportable); keep the unknown until the checkpoint question is settled
  ['stealth/glyph-cluster', 'Glyph Cluster (stealth)', 'B', '-', '256k'], // Added (2026-10-10 audit) — new anonymous early-access model (~2026-10-07), $0/$0, 256k ctx; replaces the rotated-out pixel-canary slot
  // Removed (2026-11-03 audit): stealth/cat-jam (Cat Jam (stealth)) — absent from the live gateway catalog; the stealth slot rotated out after its stealth period ended
  // Removed (2026-10-10 audit): stealth/pixel-canary — stealth slot rotated, id absent from the live gateway
  // Removed (2026-11-22 audit): inclusionai/ling-3.1-flash-1019 - no longer $0/$0, now bills $0.30/$0.90 per 1M
  // 2026-09-29 audit: list stays strictly $0/$0. Credit-value alternates for the $5/30d credits (paid, NOT added): zai/glm-5.3-flash ($0.15/$0.50 per M, 1M ctx), deepseek/deepseek-v4-flash ($0.13/$0.26 per M, 1M ctx), qwen3.7-flash ($0.03/$0.13 per M, 991k ctx)
]

// 📖 Ollama Cloud source - https://ollama.com/pricing and https://ollama.com/search?c=cloud
// 📖 Pricing moved to token billing on 2026-08-31 with a small monthly STARTER-model allowance; the
// 📖 free starter set is not enumerated, so eligibility of the rows below is UNVERIFIED. The old
// 📖 session/weekly caps describe the legacy plan only. This list keeps coding-relevant cloud models only.
// 📖 Cloud IDs rechecked 2026-11-22; free eligibility remains unresolved for the public starter set.
export const ollamaCloud = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['nemotron-3-ultra', 'Nemotron 3 Ultra', 'S+', '71.9%', '256k'],
  // Removed (2026-09-28 audit): glm-5.1 (GLM 5.1) — no longer in the Ollama Cloud catalog (glm-5.2/5.3/5.3-flash remain)
  ['glm-5.2', 'GLM 5.2', 'S+', '82.8%', '1M'], // Fixed (2026-10-17 audit): ctx '976k' → '1M' (live /v1/models reports the full 1048576); ctx first fixed 2026-07-27
  // Removed (2026-11-22 audit): minimax-m2.7 - explicitly retired 2026-11-09 in the official catalog
  ['minimax-m3', 'MiniMax M3', 'S+', '80.5%', '500k'], // Fixed (2026-11-22 audit): sweScore '78.4%' -> '80.5%' (official Verified figure)
  ['minimax-m3.1-flash', 'MiniMax M3.1 Flash', 'S+', '-', '976k'], // Added (2026-11-03 audit) — new cloud model on live /v1/models, 976k ctx
  // Removed (2026-08-23): minimax-m2.5 (MiniMax M2.5) — no longer in ollama.com/v1/models (19 models live)
  ['kimi-k2.6', 'Kimi K2.6', 'S+', '80.2%', '256k'], // Fixed (2026-07-27): ctx '262k' → '256k'
  // Removed (2026-09-28 audit): deepseek-v4-flash:0731 (DeepSeek V4 Flash) — gone from the cloud catalog, superseded by deepseek-v4.1-flash
  ['deepseek-v4-pro:0813', 'DeepSeek V4 Pro', 'S+', '80.6%', '1M'], // Fixed (2026-08-23): ID 'deepseek-v4-pro' → 'deepseek-v4-pro:0813' (renamed upstream)
  ['glm-5.3', 'GLM 5.3', 'S+', '-', '1M'],
  ['deepseek-v4.1-flash', 'DeepSeek V4.1 Flash', 'S+', '-', '1M'], // Added (2026-09-15) — verified via live audit
  // ── S tier — SWE-bench Verified 60–70% ──
  ['kimi-k2.7-code', 'Kimi K2.7 Code', 'S', '60.4%', '256k'], // Fixed (2026-07-27): ctx '262k' → '256k'
  ['gpt-oss:120b', 'GPT OSS 120B', 'S', '62.4%', '128k'],
  ['nemotron-3-super', 'Nemotron 3 Super', 'S', '60.5%', '256k'],
  ['kimi-k3', 'Kimi K3', 'S+', '76.8%', '1M'], // Fixed (2026-09-29 audit): sweScore '-' → '76.8%' (reused from the same model id on NVIDIA/onomeo; Ollama only publishes DeepSWE/Terminal-Bench)
  // Removed (2026-08-23): gemini-3-flash-preview (Gemini 3 Flash Preview) — no gemini models left in Ollama Cloud API
  ['glm-5.3-flash', 'GLM 5.3 Flash', 'S', '-', '1M'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  // Removed (2026-08-23): kimi-k2.5 (Kimi K2.5) — no longer in ollama.com/v1/models
  ['gemma4:31b', 'Gemma 4 31B', 'A+', '52.0%', '256k'], // Fixed (2026-07-27): ctx '256k' → '128k'
  ['gpt-oss:20b', 'GPT OSS 20B', 'S', '60.7%', '128k'], // Fixed (2026-11-22 audit): sweScore '50.3%' -> '60.7%' (official high-reasoning card), tier A+ -> S
  // Removed (2026-11-22 audit): mistral-large-3:675b - absent from tags/models/pricing and its library page 404s
  ['mistral-large-4', 'Mistral Large 4', 'A+', '-', '1M'], // Added (2026-10-10 audit) — new cloud model (~Oct 4, 1.05T MoE, 1M ctx, thinking + tools); tier follows the Mistral Large family precedent
  ['muse-spark-open', 'Muse Spark Open', 'S+', '-', '1M'], // Added (2026-11-03 audit) — new cloud model on live /v1/models, 1M ctx
  ['mimo-v2.6-pro', 'MiMo V2.6 Pro', 'S+', '-', '1M'], // Added (2026-11-03 audit) — new cloud model on live /v1/models, 1M ctx
  ['mimo-v2.6-flash', 'MiMo V2.6 Flash', 'A+', '-', '1M'], // Added (2026-11-03 audit) — new cloud model on live /v1/models, 1M ctx
  // Removed (2026-09-28 audit): qwen3.5:397b (Qwen 3.5 Cloud) — qwen3.5 is not flagged cloud on ollama.com and is absent from the cloud catalog/pricing page
  // Removed (2026-11-22 audit): nemotron-3-nano:30b - local-only model, no cloud badge and absent from the cloud catalog
  ['beam', 'Beam', 'S+', '81.6%', '1M'], // Added (2026-10-17 audit) — Reflection Beam free on Ollama Cloud for a limited time per the 2026-10-16 blog; SWE-bench Verified 81.6% per Ollama's post
]

// 📖 onomeo source - https://onomeo.com
// 📖 ⚠️ NO FREE TIER LEFT (2026-11-03 audit) — the provider removed its ENTIRE free-model lineup:
// 📖 8 tracked models appear in the "This week's changes" removal list on https://onomeo.com/models
// 📖 (updated 2026-11-03) and the rest were already gone; the current 17-model catalog is 100% paid.
// 📖 The only no-charge access left is earned rewards covering selected answers in browser chat,
// 📖 which is not usable via the API, so the provider no longer qualifies for this catalog.
// 📖 Kept as an empty array so downstream provider-metadata/config code that imports
// 📖 `onomeo` and references the 'onomeo' key (ONOMEO_API_KEY) doesn't crash; the entry is also
// 📖 commented out of the `sources` map below so it won't appear in the catalog.
export const onomeo = [
  // Removed (2026-11-03 audit): ALL 15 entries — deepseek-v4-flash, glm-5.2, gemini-3.7-flash, gemini-3.6-flash,
  // gemini-3.5-flash, gemini-3.1-flash-lite, gpt-oss-20b, gemini-3.5-flash-lite, codestral-latest, glm-4.5-flash,
  // ministral-14b-latest, muse-glimmer-30b, minimax-m2.7, stealth/glyph-cluster, hy4-preview — the whole free
  // lineup is gone; every listed replacement (glm-5.3, gemini-4-argon, mistral-large-4, muse-wonder-1.0,
  // deepseek-flash) is paid, credits-buyers only.
]

// 📖 Runcrate source - https://www.runcrate.ai/docs
// 📖 OpenAI-compatible API: https://api.runcrate.ai/v1/chat/completions (streaming + tool calls)
// 📖 Open models are free with your GitHub account (sign in with GitHub on runcrate.ai);
// 📖 the API keys page shows the free usage left. The rest of the catalog is paid per token.
// 📖 Ids and ctx checked 2026-10-25 against the public https://api.runcrate.ai/v1/models (no key needed)
// 📖 and the free list on https://www.runcrate.ai/inference/free. Tier and SWE-bench values are
// 📖 copied from the existing rows for the same models.
export const runcrate = [
  // ── S+ tier — SWE-bench Verified ≥70% ──
  ['deepseek-ai/DeepSeek-V4.1-Flash', 'DeepSeek V4.1 Flash', 'S+', '-', '1M'],
  ['deepseek-ai/DeepSeek-V4.1-Flash-1017', 'DeepSeek V4.1 Flash 1017', 'S+', '-', '1M'], // Added (2026-11-03 audit) — dated V4.1 Flash snapshot now listed as its own free-tier id in pricing.md
  ['zai-org/GLM-5.3', 'GLM 5.3', 'S+', '-', '1M'],
  ['zai-org/GLM-5.3-Flash', 'GLM-5.3-Flash', 'S+', '-', '1M'],
  // ── S tier — SWE-bench Verified 60–70% ──
  ['openai/gpt-oss-120b', 'GPT OSS 120B', 'S', '62.4%', '131k'],
  // ── A+ tier — SWE-bench Verified 50–60% ──
  ['Qwen/Qwen3.8-Flash', 'Qwen3.8 Flash', 'A+', '-', '1M'],
]

// 📖 All sources combined - used by the main script
// 📖 Each source has: name (display), url (API endpoint), models (array of model tuples)
// 📖 Providers ordered by generosity of free tier (most generous first)
// 📖 See README for full tier-by-tier comparison
// 📖 Each provider now carries a `quota` (human-readable summary) and a
// 📖 `quotaCode` (machine code: 'free' | 'limited' | 'metered') so the website
// 📖 can render a sortable, filterable catalog without re-typing the rules in
// 📖 a second file. The CLI ignores these fields, so this is fully backward-
// 📖 compatible with the existing TUI / router-daemon / OpenCode integration.
export const sources = {
  nvidia: {
    name: 'NVIDIA NIM',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    quota: 'Free · 1000 req/month',
    quotaCode: 'free',
    models: nvidiaNim,
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    quota: 'Free · 30 RPM per model',
    quotaCode: 'free',
    models: groq,
  },
  cerebras: {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    quota: 'Free trial · $5 credits / 30 days · card required',
    quotaCode: 'limited',
    models: cerebras,
  },
  googleai: {
    name: 'Google AI',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    quota: 'Free · Gemini quotas vary by model',
    quotaCode: 'free',
    models: googleai,
  },
  // 'github-models': REMOVED 2026-08-13 — GitHub Models retired 2026-07-30 (HTTP 410 Gone).
  // Provider metadata still references this key for backwards compat in user configs,
  // but it is no longer exposed in the catalog.
  // 'github-models': {
  //   name: 'GitHub Models',
  //   url: 'https://models.github.ai/inference/chat/completions',
  //   quota: 'GitHub / Copilot plan quota',
  //   quotaCode: 'metered',
  //   models: githubModels,
  // },
  // 'mistral': RETIRED 2026-11-22 - Mistral Free mode no longer includes API access (billing
  // required, see the mistral block above). Provider metadata and MISTRAL_API_KEY support stay
  // in src/core for backwards compat with existing configs.
  // 'mistral': {
  //   name: 'Mistral LP',
  //   url: 'https://api.mistral.ai/v1/chat/completions',
  //   quota: 'No free API tier (billing required)',
  //   quotaCode: 'metered',
  //   models: mistral,
  // },
  cloudflare: {
    name: 'Cloudflare AI',
    url: 'https://api.cloudflare.com/client/v4/accounts/{$CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions',
    quota: 'Free · 10k neurons/day',
    quotaCode: 'limited',
    models: cloudflare,
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    quota: '50 free req/day · 1000 with $10 credit',
    quotaCode: 'limited',
    models: openrouter,
  },
  sambanova: {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    quota: 'Small dev tier · light use',
    quotaCode: 'limited',
    models: sambanova,
  },
  ovhcloud: {
    name: 'OVHcloud AI',
    url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions',
    quota: 'Free anonymous sandbox · 2 RPM · keyed access is paid',
    quotaCode: 'free',
    models: ovhcloud,
  },
  // 'codestral': RETIRED 2026-11-22 - same platform-wide policy change as mistral (see the
  // codestral block above). CODESTRAL_API_KEY support stays in src/core for backwards compat.
  // 'codestral': {
  //   name: 'Codestral',
  //   url: 'https://api.mistral.ai/v1/chat/completions',
  //   quota: 'No free API tier (billing required)',
  //   quotaCode: 'metered',
  //   models: codestral,
  // },
  // 'zai': REMOVED 2026-10-17 — GLM Coding Plan free window ended 2026-10-07, plan is
  // paid-only now (no free model left on the coding endpoint). Provider metadata and
  // ZAI_API_KEY support stay in src/core for backwards compat with existing configs.
  // 'zai': {
  //   name: 'ZAI',
  //   url: 'https://api.z.ai/api/coding/paas/v4/chat/completions',
  //   quota: 'Free · Flash models only',
  //   quotaCode: 'free',
  //   models: zai,
  // },
  scaleway: {
    name: 'Scaleway',
    url: 'https://api.scaleway.ai/v1/chat/completions',
    quota: '1M free tokens',
    quotaCode: 'limited',
    models: scaleway,
  },
  qwen: {
    name: 'Alibaba DashScope',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    quota: '1M tokens/model · 90 days (Singapore)',
    quotaCode: 'limited',
    models: qwen,
  },

  'opencode-zen': {
    name: 'OpencodeZen',
    url: 'https://opencode.ai/zen/v1/chat/completions',
    quota: 'Free in OpenCode only · account-bound, no key unlock',
    quotaCode: 'free',
    models: opencodeZen,
    zenOnly: true,
  },
  kilo: {
    name: 'Kilo',
    url: 'https://api.kilo.ai/api/gateway/chat/completions',
    quota: 'Free · no key needed',
    quotaCode: 'free',
    models: kilo,
    noKeyNeeded: true,
  },
  llm7: {
    name: 'LLM7',
    url: 'https://api.llm7.io/v1/chat/completions',
    quota: 'Free · turbo tier only · no key needed',
    quotaCode: 'limited',
    models: llm7,
    noKeyNeeded: true,
  },
  routeway: {
    name: 'Routeway',
    url: 'https://api.routeway.ai/v1/chat/completions',
    quota: 'Free :free models only',
    quotaCode: 'free',
    models: routeway,
  },
  // 'novita': RETIRED 2026-11-22 - no free route left (see the novita block above). Provider
  // metadata and NOVITA_API_KEY support stay in src/core for backwards compat with existing configs.
  // 'novita': {
  //   name: 'Novita AI',
  //   url: 'https://api.novita.ai/openai/v1/chat/completions',
  //   quota: 'No free route left (retired)',
  //   quotaCode: 'metered',
  //   models: novita,
  // },
  pollinations: {
    name: 'Pollinations AI',
    url: 'https://gen.pollinations.ai/v1/chat/completions',
    quota: 'Free start · one-time Quest credit · key required',
    quotaCode: 'limited',
    models: pollinations,
  },
  siliconflow: {
    name: 'SiliconFlow',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    quota: 'Free · 7 models @ $0 · 1000 RPM · real-name verification',
    quotaCode: 'free',
    models: siliconflow,
  },
  requesty: {
    name: 'Requesty',
    url: 'https://router.requesty.ai/v1/chat/completions',
    quota: 'Free · 200 req/day · no card',
    quotaCode: 'free',
    models: requesty,
  },
  orcarouter: {
    name: 'OrcaRouter',
    url: 'https://api.orcarouter.ai/v1/chat/completions',
    quota: 'Free · 5 $0 models + router · 10 rpm · 50 req/day',
    quotaCode: 'free',
    models: orcarouter,
  },
  'vercel-gateway': {
    name: 'Vercel AI Gateway',
    url: 'https://ai-gateway.vercel.sh/v1/chat/completions',
    quota: 'Free · $5 credits/30 days + $0 models · card required',
    quotaCode: 'limited',
    models: vercelGateway,
  },
  'ollama-cloud': {
    name: 'Ollama Cloud',
    url: 'https://ollama.com/v1/chat/completions',
    quota: 'Limited · monthly starter-model allowance · eligibility unverified',
    quotaCode: 'limited',
    models: ollamaCloud,
  },
  // 'onomeo': REMOVED 2026-11-03 — the provider dropped its entire free lineup (catalog now 100% paid,
  // see the onomeo block above). Provider metadata and ONOMEO_API_KEY support stay in src/core for
  // backwards compat with existing configs.
  // 'onomeo': {
  //   name: 'onomeo',
  //   url: 'https://onomeo.com/v1/chat/completions',
  //   quota: 'Free models, no credits · 12 RPM · 30 req/5h',
  //   quotaCode: 'limited',
  //   models: onomeo,
  // },
  runcrate: {
    name: 'Runcrate',
    url: 'https://api.runcrate.ai/v1/chat/completions',
    quota: 'Free · GitHub account 30+ days · weekly allowance',
    quotaCode: 'limited',
    models: runcrate,
  },
}

// 📖 Flatten all models from all sources — each entry includes providerKey as 6th element
// 📖 providerKey lets the main CLI know which API key and URL to use per model
// 📖 Models with a deprecatedAfter date (7th tuple element) are auto-filtered after that date
export const MODELS = [];
const _today = new Date().toISOString().split('T')[0];
for (const [sourceKey, sourceData] of Object.entries(sources)) {
  if (!sourceData || !sourceData.models) continue
  for (const model of sourceData.models) {
    const [modelId, label, tier, sweScore, ctx, addedDate, deprecatedAfter] = model
    if (deprecatedAfter && _today > deprecatedAfter) continue
    MODELS.push([modelId, label, tier, sweScore, ctx, sourceKey, addedDate || null])
  }
}
