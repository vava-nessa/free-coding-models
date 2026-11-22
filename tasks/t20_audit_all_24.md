---
id: t20
title: Audit all 24 model providers with DeepSeek
status: Done
created: 2026-11-22
updated: 2026-11-22T16:32:04Z
---

## Goal
Audit all 24 current providers against official live sources using DeepSeek V4.1 Flash, one provider at a time.

## Constraints
Follow .pi/skills/update_models/SKILL.md. Research only until consolidation. Preserve unverified models and never infer free availability from model weights alone. No concurrent researchers.

## Acceptance criteria
- [x] Audit all 24 providers with source-backed JSON differences.
- [x] Consolidate changes for user review.
- [x] Apply approved differences and update audit state and relevant docs.
- [x] Run required tests, build/typecheck and runtime verification.
- [x] Review final diff and record publication status accurately.

## Progress
- Skill located and read. User selected all 24 providers.
- Order: nvidia, groq, cerebras, googleai, mistral, cloudflare, openrouter, sambanova, ovhcloud, codestral, scaleway, qwen, opencode-zen, kilo, llm7, routeway, novita, pollinations, siliconflow, requesty, orcarouter, vercel-gateway, ollama-cloud, runcrate.
- NVIDIA research starting.

### NVIDIA research completed
Proposals, not applied: replace moonshotai/kimi-k2.6 with moonshotai/kimi-k3.1-pro (1M, score unknown); correct meta/muse-glimmer-30b score to 76.0% and openai/gpt-oss-20b to 60.7%. Associated tier proposals S+ and S. New Kimi S+ tier is inferred, needs review. Official evidence: https://build.nvidia.com/models, https://integrate.api.nvidia.com/v1/models and .md model cards under https://build.nvidia.com/qc69jvmznzxy/ .
Unconfirmed, retain: google/diffusiongemma-26b-a4b-it, openai/gpt-oss-20b, deepseek-ai/deepseek-v4.1-flash, nvidia/nemotron-3-super-120b-a12b. Catalog listing incomplete. Gemma and Nano Omni existing scores disputed without authoritative replacement.
Full structured researcher result is in the parent conversation. No catalog edits yet.
Next: groq.

### Groq research completed (2/24)
All 3 current models confirmed; no additions/removals/config changes. Evidence: https://console.groq.com/docs/models, /docs/rate-limits, /docs/model/openai/gpt-oss-120b, /docs/model/openai/gpt-oss-20b, /docs/model/qwen/qwen3.8-27b .
Review correction: gpt-oss-20b tier A+ inconsistent with published 60.7% Verified (S band). Qwen score remains unknown; only Pro benchmark published. Optional provider quota correction: all 3 free models 30 RPM rather than 30-50.
Excluded enterprise-only Muse Spark, MiniMax M2.7, Llama models, and safety/audio models. No catalog edits yet.
Next: cerebras.

### Cerebras research completed (3/24)
Both current models confirmed, no changes proposed. Public API https://api.cerebras.ai/public/v1/models returns exactly gpt-oss-120b and qwen-3.8-27b. Hosted free trial contexts remain 65k and 64k. $5 / 30-day trial requiring payment method confirmed at https://inference-docs.cerebras.ai/support/rate-limits and /support/pricing . New enterprise Dedicated models excluded.
Optional cosmetic A/A+ section comment mismatch, no tier downgrade justified by missing benchmark alone. GPT OSS score uses high reasoning convention; Qwen Verified remains unknown.
Next: googleai.

### Google AI research completed (4/24)
Proposed addition gemini-4-hydrogen (1M, unknown Verified score, provisional S+), free on https://ai.google.dev/gemini-api/docs/pricing#gemini-4-hydrogen and released 2026-11-12. OpenAI-compatible endpoint support unverified, must check before addition.
Proposed fix: remove shutdown date 2026-12-01 from gemini-2.5-flash-lite; https://ai.google.dev/gemini-api/docs/deprecations#gemini-2.5-flash-models explicitly says no date. Other 2.5 Pro/Flash shutdown dates retained.
Disputed score correction: gemini-2.5-pro 63.8% experimental snapshot vs GA 59.6% (own official card) or 60.4% (Flash card). Needs review, no change yet. Gemini 3.5 Flash Lite tier S inconsistent with stored 75.0%; newer Gemini Verified scores unconfirmed officially (Pro/DeepSWE are different benchmarks). Gemma free candidates lack verified IDs, excluded pending evidence.
Next: mistral.

### Mistral research completed (5/24)
Major eligibility finding: official https://docs.mistral.ai/admin/billing-usage/usage-limits and /subscriptions say Free mode excludes API, requires activated billing and pay-as-you-go. Researcher proposes retiring all 7 Mistral pairs, pending parent review. No catalog changes applied.
Tuple proposals if retained: mistral-small-2603 score 48.0% -> unknown (no official Verified source); ministral-3b-2512 ctx 128k -> 256k (docs conflict with previous live probe); mistral-code-latest and mistral-code-fim-latest ctx 256k -> 128k (alias resolution from third-party snapshots, needs stronger API evidence). Sources: https://docs.mistral.ai/models.md and individual model cards.
No new eligible free model. Codestral audit must independently confirm free endpoint retirement and context. Parent must verify material policy change before shipping.
Next: cloudflare.

### Cloudflare research completed (6/24)
Proposed removals: @cf/nvidia/nemotron-3-120b-a12b and @cf/qwen/qwen3-30b-a3b-fp8 retired 2026-11-20, per https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/ and model Deprecated badges. 11 survivors confirmed with matching hosted contexts and free daily allowance; no eligible additions. New frontier replacements paid-gated.
Proposed score correction @cf/openai/gpt-oss-120b 62.0% -> 62.4% (OpenAI official high reasoning model card). GPT OSS 20B 50.3% conflicts with official 60.7% high reasoning and other provider rows, review globally. No Cloudflare-specific benchmark published.
Stale comments claiming llama-3.1-8b remains / qwq and deepseek-r1-distill still free need updating: retired 2026-11-20. Keep model ordering edits minimal. No catalog changes applied.
Next: openrouter.

### OpenRouter research completed (7/24)
Live https://openrouter.ai/api/v1/models fetched twice, 476 models; per-ID public endpoints checked. 8 existing free pairs confirmed, matching contexts.
Proposed removal of 6 free routes: xingchen-agi/xing4.0-29b-a4b:free, cohere/north-mini-code:free, liquid/lfm-2.5-2.6b:free, thinkingmachines/inkling:free, thinkingmachines/inkling-small:free, dots-studio/dots-3-note-preview:free. Absent from API plus empty free endpoints; cached pages remain 200, keyed probe suggested before deletion.
Proposed additions: baidu/ernie-5.5-flash-preview:free (A, unknown score, 1M), inclusionai/ling-3.2-flash:free (B+, unknown, 1M), liquid/lfm-3-1.7b:free (A, 43.4% Verified OpenCode scaffold, 262k), particle-ai/particle-1:free (A-, unknown, 1M). All public endpoints zero input/output pricing. Evidence per-ID https://openrouter.ai/api/v1/models/{id}/endpoints ; LFM score https://huggingface.co/LiquidAI/LFM3-1.7B . Unknown-score tiers provisional.
Review static/dynamic metadata parity: src/core/analysis.js OPENROUTER_TIER_MAP differs for Gemma 31B and lacks new additions (defaults B/25%). Must avoid inventing scores. No catalog edits yet.
Next: sambanova.

### SambaNova research completed (8/24)
Proposed removals: DeepSeek-V3.1 and DeepSeek-V3.2 retired 2026-11-03; Meta-Llama-3.3-70B-Instruct retired 2026-11-17. Official https://docs.sambanova.ai/docs/en/models/deprecations plus public https://api.sambanova.ai/v1/models (4 IDs).
Confirmed survivors gpt-oss-120b (131k), MiniMax-M3.1-Flash (1M), gemma-4-31B-it (131k).
Candidate addition GLM-5.3 (1M, S+, proposed 95.4% independent Vals SWE-bench Verified). Free eligibility unresolved: docs say all developer accounts but Free Tier table only lists GPT OSS and Gemma. MiniMax free eligibility similarly unresolved. Official plans page requires payment method/credits while rate-limit docs define no-card Free Tier. Do not mark new GLM pair verified free without resolving contradiction. Score unusually high and scaffold differs, review rather than copy across providers.
Sources https://docs.sambanova.ai/docs/en/models/sambacloud-models, /rate-limits and https://www.vals.ai/benchmarks/swebench . No catalog changes applied.
Next: ovhcloud.

### OVHcloud research completed (9/24)
Proposed removals: bge-m3, Qwen3-Embedding-8B, bge-multilingual-gemma2 embedding-only; bge-m3 anonymous chat 404 while embeddings 200. Qwen3Guard x2 are moderation only, product-scope exclusion to review.
Proposed additions: DeepSeek-V4.1-Flash-1017 (S provisional, unknown score, 1M), qwen3.6-35b-a3b (S+,73.4%,256k), laguna-xs-2.1 (S+,70.9%,128k), gemma-4-26b-a4b (A- provisional,unknown,256k), nemotron3-nano-30b (A-,38.8%,256k), nemotron3-omni-30b (B+ provisional,unknown,128k), qwen3-vl-30b-a3b (B+ provisional,unknown,32k). Six anonymous chat 200s; Omni not probed due 429.
Fix proposals: gpt-oss-20b 50.3%/A+ ->60.7%/S; remove stale 2026-11-04 shutdown from Mistral-Small-3.2-24B-Instruct-2506 (live chat 200, official catalog no EOL); add 2027-02-10 shutdown for Meta-Llama-3_3-70B-Instruct, Qwen2.5-VL-72B-Instruct, Qwen3.6-27B.
Evidence: https://catalog.endpoints.ai.ovh.net/rest/v1/models_v2 , https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models , official per-model readmes and upstream model cards. Free sandbox anonymous 2RPM; keyed 400RPM requires payment method and is billed. Important final verification: FCM actually uses eligible anonymous path; do not imply keyed calls free.
No catalog edits applied. Next: codestral.

### Codestral research completed (10/24)
Independent confirmation of platform-wide Mistral free API loss: https://docs.mistral.ai/admin/billing-usage/usage-limits explicitly excludes API from Free mode; API-key quickstart requires billing. Old codestral.mistral.ai/v1/models 404, unified api.mistral.ai requires auth. Consider Mistral and Codestral eligibility together, not one-sided removal.
codestral-2508 live GA, but paid-only. Proposed metadata if retained: ctx 256k ->128k per https://docs.mistral.ai/models/codestral-25-08 and /models.md ; score 40.0% ->unknown (no official Verified source), quota paid. Context conflicts with models.dev 256000, authenticated metadata read would settle without paid generation. No paid probe authorized by this audit.
Legacy-key free access not proved either way. Existing LLM7 Codestral route must be audited separately, do not assume old October access still valid.
No catalog changes applied. Next: scaleway.

### Scaleway research completed (11/24)
No additions/removals. Proposed ID fix deepseek-v4.1-flash ->deepseek-v4.1-flash-1017 per official pricing, supported-models and playground URL. Alias acceptance unknown without auth.
All 12 hosted context caps match. Existing benchmark scores not independently reconfirmed (vendor pages blocked); preserve pending review.
1M pooled Serverless free tokens confirmed; no reset/expiry stated, card requirement unknown. Dedicated excluded. Sources https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/ , https://www.scaleway.com/en/pricing/model-as-a-service/#generative-apis-serverless , /en/docs/generative-apis/faq/ .
No catalog edits applied. Next: qwen.

### DashScope research completed (12/24)
Proposed 13 removals for loss of Singapore trial quota: qwen3.6-plus, qwen3.5-plus, qwen3.8-max-0902, qwen3.6-flash, qwen3.5-flash, qwen3-coder-flash, qwen3.5-397b-a17b, qwen3.5-122b-a10b, qwen3.5-35b-a3b, qwen3.5-27b, qwen3.6-27b, qwen3.6-35b-a3b, kimi-k2.7-code. Batch notice 2026-10-29; max snapshot quota removed 2026-11-15. Flash pricing cells conflict with removal notice, medium confidence.
Proposed addition qwen4-max (S+ provisional,unknown Verified,1M) released 2026-11-16; Singapore 1M free quota confirmed.
12 survivors listed; qwen3.8-omni-flash quota not proven, Flash 3.7/3.8 section note conflicts with quota cells, review before calling them free. Held deepseek-v4-pro-0813 (free dated snapshot) for parent decision: snapshot alone is not an exclusion rule.
Evidence https://www.alibabacloud.com/help/en/model-studio/model-pricing , /new-free-quota , /models and /qwen4-max . Quota 1M/model/90 days Singapore retained, Coding Plan keys excluded. Endpoint migration mentioned, existing host still authenticates.
No catalog changes applied. Next: opencode-zen.

### OpenCode Zen research completed (13/24)
Proposed removals: glm-5.3-flash-free retired 2026-11-18; pulse-alpha-free retired 2026-11-06; jev-1.13-free LIVE but decision-only System One (typed state/questions, not chat/completions; actual ctx64k). Source https://opencode.ai/docs/console/models/#deprecated-models and public https://opencode.ai/inference/v1/models (legacy /zen alias works).
Proposed additions: tidepool-alpha-free (S,unknown,1M), iceman-free (S,unknown,262k), longcat-2.5-free (A+,unknown,1M), hy4-flash-free (A+,unknown,1M). Tiers provisional. Big Pickle score72.0 ->unknown proposed as unsourced stealth score.
Critical compatibility finding: official docs require OpenCode client for free models, external chat probes get429 FreeUsageLimitError even with session header. Account-bound free access, API key does not unlock outside OpenCode. Must review zenOnly integration routing before additions; quota 'Zen key required' misleading. Paid Go excluded.
7 current chat survivors confirmed zero-price and matching hosted contexts. No catalog changes applied. Next: kilo.

### Kilo research completed (14/24)
Live catalog470 entries /13 isFree:true, anonymous per-ID probes. Proposed removals: thinkingmachines/inkling-small:free, thinkingmachines/inkling:free, xingchen-agi/xing4.0-29b-a4b:free, cohere/north-mini-code:free, dots-studio/dots-3-note-preview:free, liquid/lfm-2.5-2.6b:free (404 model_not_found); google/gemma-4-31b-it:free 404 unavailable_model, temporary disable possible, review before removal.
Additions proposed particle-ai/particle-1:free (A+ provisional,unknown,1M), liquid/lfm-3-1.7b:free (A,43.4%,262k), baidu/ernie-5.5-flash-preview:free (A+ provisional,unknown,1M), inclusionai/ling-3.2-flash:free (A+ provisional,unknown,1M; upstream429). Unknown tiers differ from OpenRouter proposals, normalize on review.
Fix proposals: Lightning score51.6% BF16 /52.8% NVFP4 with A+ tier; Ultra score70.7% BF16 vs71.9% NIM (contested, checkpoint-dependent); Flint74.2%/S+ vs current unknown/A-. Verify checkpoint before copying numbers. Beam published80.9 superseded by checkpoint-specific figures.
Free no key/card,200req/hour/IP. Sources https://api.kilo.ai/api/gateway/models and https://ai-gateway.kilo.ai/api/v1/models (identical). Important isFree flag, zero price alone insufficient: some zero-priced base IDs require paid auth.
No catalog edits applied. Next: llm7.

### LLM7 research completed (15/24)
Proposed removals status=retired plus catalog history and anonymous400: GLM-5.3-Flash (2026-11-14), DeepSeek-V4-Flash-0731 and minimax-m2.7 (2026-11-18), nemotron-3-nano:30b (2026-11-09). Paid lowercase replacements excluded.
Proposed addition gemma-3-27b (B provisional,unknown,262k), turbo new2026-11-17, anonymous200. Confirmed anonymous200 survivors mistral-Nemo-Instruct-2407 (128k), gpt-oss:20b (128k), codestral-latest (32k); exact Codestral checkpoint unknown, no score transfer from2508.
Evidence https://api.llm7.io/v1/models and /public/v1/models/{slug}/history ; turbo-only free, pro usage_based_only=false does not imply free. No key/account/card required in observed calls, undocumented in updated quickstart.1 concurrent request, roughly1RPS, daily cap unknown. Update stale provider comments later.
No catalog edits applied. Next: routeway.

### Routeway research completed (16/24)
Proposed removal deepseek-v4.1-flash:free absent from live282-model catalog and public catalog, detail route blank; no handler-level proof (Cloudflare403 for live/bogus), recheck if key available. Eight zero-price routes remain, no additions.
Proposed Muse Glimmer score unknown/B+ ->76.0%/S+; official Meta card https://huggingface.co/meta-models/Muse-Glimmer-30B and https://arxiv.org/html/2610.24628 high reasoning. Routeway owned_by Meta with reasoning_effort support; served quantization unknown. MiniMax remains score unknown, no peer-vendor score substitution; Gemma finetunes no base-score transfer.
Sources https://api.routeway.ai/v1/models and https://docs.routeway.ai/getting-started/{models,rate-limits,faq,billing,authentication}.md .200RPD confirmed,5vs20RPM vendor conflict, account/key required, no payment for free documented.
No catalog edits applied. Next: novita.

### Novita research completed (17/24)
Proposed removal of all5: dev/glm46, apodex/apodex-1.1-mini, bunny, nvrouter/auto, nvrouter/fusion. Absent from public78-model API, identical product feed, pricing/catalog, per-model pages404; no official retirement announcement or keyed proof. Zero zero-price pairs today. Provider eligibility review required.
Evidence https://api.novita.ai/openai/v1/models , https://api-server.novita.ai/v1/product/model/list , https://novita.ai/pricing and https://docs.novita.ai/guides/llm-faq.md . Ling marketing FREE badges contradicted by paid API pricing, excluded. New-user voucher amount/LLM eligibility unknown; sandbox$100 promo not LLM free quota. Router downstream billing never documented.
No catalog edits applied. Next: pollinations.

### Pollinations research completed (18/24)
Proposed removal qwen/qwen3.8-2.4t-a95b now paid_only=true (Quest cannot pay).29 current routes retained incl corrected gpt-oss alias ->OpenAI20B score50.3->60.7 (tier cascade review).
Additions proposed moonshotai/kimi-k3.1-pro(S+ provisional,unknown,1M), minimax/minimax-m3.1-flash(S+ provisional,unknown,1M), deepseek/deepseek-v4.1-flash-1017(A+ provisional,unknown,1M), meta/muse-spark-open(A+ provisional,unknown,1M); optional older openai/gpt-5-nano(B provisional,unknown,400k). All paid_only=false. Existing aliases unchanged.
Critical quota correction: no daily grant, one-time Quest credit (no card), secret key required. Approxnew-account$1.50-$2.50 via quests, no documented expiry, account restrictions possible. quotaCode should reflect finite credit rather than recurring free on review. Evidence https://gen.pollinations.ai/models and /docs/llm.txt , official GitHub APIDOCS.md and enter.pollinations.ai/POLLEN_FAQ.md plus quest source. No authenticated generation proof.
No catalog edits applied. Next: siliconflow.

### SiliconFlow research completed (19/24)
All7 CN routes confirmed rendered免费/免费 with matching contexts; no additions/removals. Proposed XingChenAGI/Xing4.0-29B scoreunknown/A- ->75.0%/S+ per official https://huggingface.co/XingChen-AGI/Xing4.0-29B-A4B ; hosted description confirms same checkpoint.
Important eligibility: mandatory real-name verification since2026-05-15, not SMS-only; accepted regional IDs or offline alternative.1000RPM L0 confirmed,40k-80kTPM. No card but identity gate must be documented.
Evidence https://www.siliconflow.cn/pricing (rendered) and /models plus official CN docs authentication/rate-limit/release-notes. GLM5.3Flash JSON0/0 stale, rendered paid, excluded. Translation/OCR additions excluded as product-fit. Quota fetcher /v1/user/info reportedly retired2026-08-14, outside catalog scope, note for later instead of expanding audit.
No catalog edits applied. Next: requesty.

### Requesty research completed (20/24)
Proposed removals poolside/laguna-xs.2, poolside/laguna-m.1, nvidia/nemotron-3-super-120b-a12b, novita/inclusionai/ling-3.0-tiny absent global+EU787-model catalogs and public directory; free docs stale, no keyed completion proof.
8 survivors zero input/output single pricing tier, hosted contexts unchanged; no additions.200RPD/20RPM per new organization, no card/balance required confirmed. Account/key required.
Fix proposals Muse Glimmer unknown/C->76.0%/S+ (official Meta); Nano Omni52.0->unknown (unpublished); Lightning unknown/B+->A+, checkpoint51.6BF16 vs52.8NVFP4 unresolved (do not silently infer serving quantization).
Sources https://router.requesty.ai/v1/models , https://router.eu.requesty.ai/v1/models , https://requesty.ai/models and https://docs.requesty.ai/features/free-models.md . Update stale comments on integration.
No catalog edits applied. Next: orcarouter.

### OrcaRouter research completed (21/24)
Proposed removal orca/orcaverify-text1.0-free: explicit model_not_found for free+paid, absent catalogs/free package/pages; decision detector not chat anyway.
Fix DeepSeekV4.1 score74.2->unknown:74.2 is DeepSWEv1.1 not Verified.6 survivors confirmed by documented free billing, five$0 routes plus free-only router, no additions. Contexts unchanged.
Sources https://api.orcarouter.ai/v1/models , /api/pricing , /api/free-package/public and https://docs.orcarouter.ai/routing/free-models .10RPM/50RPD fresh account, Hy4 has50RPM/250RPD, no card/balance but aged linked GitHub gate. Fusion remains billed downstream, excluded.
No catalog edits applied. Next: vercel-gateway.

### Vercel Gateway research completed (22/24)
Proposed removal inclusionai/ling-3.1-flash-1019 now$0.30/$0.90 perM. Addition recursive/flint-v1.0(S+,74.2%,262k) zero-price endpoints; optional humansand/ampersand-v0.1(B provisional,unknown,1M) collaboration model whose plain chat compatibility/product fit unresolved.
Fix proposals Beam80.9->81.6 finalBF16 vs80.2FP8/80.7NVFP4, served precision unknown; Lightning54.3 unsupported, replace withunknown or checkpoint-specific52.8/51.6 only with justification. Keep A+ band.
Critical metadata: $5/month free credit now requires payment method, subset-only eligibility, ends after first credit purchase. Zero-cost promotional routes separate, post-credit-zero behavior undocumented; avoid claiming permanent/no-card access. Sources https://ai-gateway.vercel.sh/v1/models (517 entries), per-ID/endpoints and https://vercel.com/docs/ai-gateway/{pricing,getting-started,faq}. Sixzero-price language IDs incl duplicate Beam; five unique promotions.
Tests ID allowlist must permit confirmed Flint (no -free suffix). Website/core metadata repeat stale no-card claim; scope needed on integration. No catalog edits applied. Next: ollama-cloud.

### Ollama Cloud research completed (23/24)
Proposed removals minimax-m2.7 explicit retired2026-11-09, mistral-large-3:675b absent tags/models/pricing+page404, nemotron-3-nano:30b local-only no cloud badge/catalog.
Add candidates kimi-k3.1-pro(S+ provisional,unknown,1M), hy4(S provisional,unknown,1M), inkling-2-small(A+ provisional,unknown,1M), deepseek-v4.1-flash:1017(S+ provisional,unknown,1M). All live cloud IDs but FREE eligibility unproven.
Critical: pricing changed Aug31 to token billing and monthly small starter-model allowance, no enumerated free starter set. Cannot call all23 free verified. Keep additions pending eligibility. quota session/weekly caps describes legacy plan, change to limited allowance only after review.
Score fixes GPTOSS20B50.3/A+->60.7/S and MiniMaxM3 78.4->80.5 official Verified. KimiK2.7Code60.4 vs Vals78.2 disputed, defer.
Evidence https://ollama.com/v1/models and /api/tags (25IDs identical), library pages, https://ollama.com/pricing and /blog/transparent-pricing . Account/key needed, card unknown, no authenticated completions.
No catalog edits applied. Next: runcrate (last).

### Runcrate research completed (24/24)
All6 current pairs confirmed free_tier:true across public121-model catalog, pricing.md and page config; zero additions/removals/fixes. Eligibility metadata: GitHub account>=30days no card, weekly workspace allowance resets Monday, quota amount unpublished. Google signup requires nonprepaid card. With credit, overage billed, no claim of unlimited free use.
Sources https://www.runcrate.ai/inference/free , /pricing.md , /api/models/catalog , https://api.runcrate.ai/v1/models and official FAQ.
Research phase complete. Next consolidate proposals, independently review material policy findings, exclude unresolved additions/benchmark substitutions, then present application scope under skill phase3. No sources.js changes made.

### Approved implementation scope
User approved supported changes with unresolved cases held. Two DeepSeek workers own sources.js and provider-metadata/generator respectively; parent owns tests, dynamic OpenRouter parity, audit state and website/docs sync.
Hold Google Hydrogen (chat endpoint unverified), SambaNova GLM (free eligibility), OVH Omni (no successful probe), Vercel Ampersand (chat compatibility), all Ollama additions (starter free set unknown), optional old Nano. Retain ambiguous Kilo Gemma route, conflicting DashScope3.5/3.6Flash quota rows. Do not pick checkpoint-specific Lightning/Beam scores without serving evidence; unsupported Lightning54.3 becomes unknown. No new fabricated Verified scores.
Mistral/Codestral API-free loss independently confirmed from official admin docs; retire keys from active source map but preserve backward-compatible exports/config metadata. No file deletion planned.

### Local integration verified
- Catalog now21 providers/221 live models (baseline24/258). ID-set delta27 added/64 removed includes one Scaleway ID rename.
- Held uncertainty as approved; pending entries recorded in audit_state.json. Corrected NVIDIA MiniMax DeepSWE73.7 mislabeled as Verified to unknown.
- Dynamic OpenRouter discovery derives ratings from sources.js; mocked test verifies catalog parity and unknown-score fallback.
- Preserved Mistral normalizer integration coverage with isolated fixture after retiring its catalog provider.
- pnpm test:1207 pass,0fail (245suites), /tmp/fcm-audit-tests-final.log.
- pnpm build:web passes; pnpm --prefix website typecheck and build pass. Existing bundle-size advisories only.
- pnpm start rendered real TUI with updated models in tmux and was stopped with Ctrl+C.
- Isolated real dashboard HTTP /api/models returned200 and221 rows.
- npm pack tarball0.6.2 installed into /tmp/fcm-audit-artifacts/install; installed binary help succeeded. This is local tarball verification, NOT registry publication.
- Local website pnpm dev running on4328; headless Chrome inspected /models,/docs/providers,/docs/core/providers, Kilo filter14rows, no pageerrors. Corrected misleading placeholder GitHub/OpenRouter branding to actual gateway names.
- Screenshot /tmp/fcm-audit-artifacts/catalog.png reviewed.
- Publication status: NOT pushed or published. User confirmation needed before production-relevant push per supplied Git rules. Registry/global-install verification and tweet proposal remain release-phase work.

### Combined release authorized
User requested publishing this audit together with all four fixes from triage thread04f1b53d-297a-40ad-a5a5-fb15becd3134 in one0.6.2 release. Integrated six local commits for208/209/210/211, preserving both Pollinations and Windows follow-up fixes. CheapLLM brings final catalog to22providers/222models. Reconciled duplicate task20 by renaming issue208 task to21.
Combined checks:1254tests pass,252suites; dashboard build, website typecheck and website build pass. Runtime and npm registry verification follow before release confirmation.
Known limits unchanged: native Windows launch not exercised on this Mac; CheapLLM authenticated generation not tested.

### Publication confirmed
Combined code pushed in373ae64, single tag/releasev0.6.2. GitHub release notes exactly match changelog/v0.6.2.md and include audit plus208/209/210/211. Release workflow45043429546 successful, CI tests45043429472 successful on Node20/22, Docker image workflow successful.
npm registry latest0.6.2 confirmed. After registry processing/negative-cache delay, npm install -g free-coding-models@0.6.2 succeeded; global --help exited0. Installed published sources contain22providers/222models including CheapLLM; provider-error-content.js and process-spawn.js both present. Repository clean before recording this evidence. Native Windows execution and CheapLLM authenticated generation remain untested, as documented.
