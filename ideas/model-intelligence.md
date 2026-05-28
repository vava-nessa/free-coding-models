# Model Intelligence and Ranking Ideas

## Goal

Make FCM answer user-intent questions, not only display technical metrics.

Current metrics like latency, stability, SWE score, context window, and uptime are valuable. The next step is to translate them into decisions users actually want to make:

- “What should I use right now?”
- “What is best for a large refactor?”
- “What is fastest for a small fix?”
- “What works with my current API keys?”
- “What is least likely to hit rate limits?”
- “What is best if I do not want to add a credit card?”

## Current Strengths

The project already has:

- Model tiers.
- SWE-bench score metadata.
- Context window metadata.
- Live latency samples.
- Stability score.
- Uptime.
- Provider metadata.
- Tool compatibility.
- Favorites.
- Smart Recommend logic.
- Router health and failure data.

This is enough to build much stronger recommendation surfaces.

## Recommended New Recommendation Modes

### 1. Best With My Keys

Default user-centric recommendation.

Scoring should only consider providers that are configured and enabled.

Factors:

- Current availability.
- Stability score.
- Latency.
- SWE score.
- Context window.
- Recent provider failures.
- Tool compatibility.

Output example:

```text
Best with your keys: Groq / GPT OSS 120B
Why: healthy, fast, stable, strong coding score, compatible with your current tool.
```

### 2. Best for Quick Fixes

Optimized for small edits and fast response.

Weighting:

- High latency weight.
- Moderate stability weight.
- Lower context window weight.
- Lower SWE score weight than refactor mode.

### 3. Best for Refactors

Optimized for larger coding tasks.

Weighting:

- High SWE score weight.
- High context window weight.
- High stability weight.
- Moderate latency weight.

### 4. Best for Large Codebase

Optimized for long context and multi-file work.

Weighting:

- Very high context window weight.
- High stability weight.
- Moderate SWE score.
- Latency still matters, but should not dominate.

### 5. Best No-Credit-Card Setup

Useful for new users.

This requires provider metadata:

- No credit card required.
- Free tier permanence.
- Practical daily/monthly limits.
- Setup difficulty.

Output:

```text
Recommended no-credit-card providers:
1. Groq — easy key, strong speed, daily request limits.
2. NVIDIA NIM — broad catalog, good free RPM.
3. Cerebras — very fast, smaller catalog.
```

### 6. Best Router Set

Automatically recommend a balanced failover set.

Example output:

```text
Recommended router set:
#1 Groq / GPT OSS 120B — fastest healthy primary
#2 NVIDIA / DeepSeek V4 Flash — strong fallback catalog
#3 Cerebras / Qwen3 235B — high-speed alternate
#4 OpenRouter / Qwen Coder — backup when direct providers fail
```

Rules:

- Avoid too many models from the same provider.
- Prefer provider diversity.
- Prefer configured keys.
- Prefer different rate-limit pools.
- Avoid currently degraded models.

## Quota-Aware Ranking

Latency alone can be misleading if a provider is close to quota exhaustion.

Add optional quota-aware scoring where possible:

- Remaining requests.
- Remaining tokens.
- Rate-limit reset time.
- Recent 429 frequency.
- Provider-specific free-tier caps.

Suggested labels:

- `Plenty quota`.
- `Quota unknown`.
- `Near limit`.
- `Rate limited`.
- `Cooldown`.

Do not penalize unknown quota too heavily. Some providers do not expose reliable quota data.

## Reliability Memory

Current session metrics are useful, but longer-term local memory could improve recommendations.

Store a small rolling local history:

- Provider/model availability by day.
- 429 frequency.
- Auth failures.
- Timeout frequency.
- Median latency.
- p95 latency.

Potential file:

```text
~/.free-coding-models-health.json
```

Retention:

- Keep 30 or 90 days.
- Store aggregates only.
- Do not store prompts or responses.

Use this to answer:

- “This model is fast now but unreliable historically.”
- “This provider is often rate-limited for you.”
- “This model is usually stable on your network.”

## Explanations Matter

Every recommendation should include a short reason.

Bad:

```text
Recommended: model X
```

Better:

```text
Recommended: Groq / GPT OSS 120B
Reason: fastest healthy configured model, 96 stability score, strong coding tier, compatible with Crush.
```

For rejected models:

```text
Skipped NVIDIA / DeepSeek V4 Flash: currently rate-limited.
Skipped Gemini CLI model: incompatible with current OpenAI-compatible tool mode.
```

This makes the recommendation trustworthy.

## Web UI Surfaces

### Recommendation Card

Show at the top of local dashboard:

```text
Best right now
Groq / GPT OSS 120B
420ms avg · 96 stability · S tier
[Use as primary] [Add to router set]
```

### Recommendation Wizard

A simple wizard:

```text
What are you doing?
- Quick bug fix
- Large refactor
- Generate tests
- Analyze big repo
- Low quota usage
```

Then:

```text
What matters most?
- Speed
- Quality
- Stability
- Long context
- Provider diversity
```

### Router Set Builder

Recommend a model set instead of a single model:

```text
Build a balanced router set from my configured providers.
```

## CLI Surfaces

Potential commands:

```bash
free-coding-models --recommend
free-coding-models recommend --task refactor
free-coding-models recommend --task quickfix --json
free-coding-models recommend-router-set
```

Potential output:

```text
Best model for refactor:
NVIDIA / DeepSeek V4 Flash

Why:
- S+ tier
- 200k context
- Healthy provider
- Good stability in this session

Alternatives:
1. Groq / GPT OSS 120B — faster, smaller context
2. Cerebras / Qwen3 235B — very fast, quota-sensitive
```

## Scoring Model Sketch

A recommendation score can be a weighted sum:

```text
score =
  qualityWeight * normalizedSweScore +
  speedWeight * normalizedLatencyScore +
  stabilityWeight * stabilityScore +
  contextWeight * normalizedContextScore +
  quotaWeight * quotaScore +
  compatibilityWeight * compatibilityScore +
  diversityWeight * providerDiversityScore
```

Use explicit presets rather than one magic score.

Example presets:

| Preset | Quality | Speed | Stability | Context | Quota |
|---|---:|---:|---:|---:|---:|
| Quick fix | 20 | 40 | 25 | 5 | 10 |
| Refactor | 35 | 15 | 25 | 20 | 5 |
| Large codebase | 25 | 10 | 25 | 35 | 5 |
| Low quota risk | 20 | 15 | 25 | 10 | 30 |

## Implementation Plan

### Phase 1

- Formalize recommendation presets.
- Add explanation strings.
- Add tests for scoring behavior.

### Phase 2

- Add CLI recommendation modes.
- Add local dashboard recommendation card.
- Add router set recommendation.

### Phase 3

- Add quota-aware scoring where provider data exists.
- Add local reliability memory.

### Phase 4

- Add website pages around recommendation categories.
- Add public static “best models by use case” pages generated from catalog metadata.

## Success Criteria

- Users trust recommendations because reasons are visible.
- New users can pick a provider/model without understanding every metric.
- Router sets become easier to build.
- The website can produce useful SEO pages from recommendation categories.
