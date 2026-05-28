# Public Website Ideas

## Goal

The public website should become the growth layer for `free-coding-models`: a polished landing page, a searchable free coding model catalog, provider pages, integration pages, and SEO-friendly guides.

The CLI solves the practical workflow. The website should solve discovery, trust, education, and conversion.

## Current Observation

The repository currently has two different web surfaces:

- `web/` — local dashboard served by the daemon/package.
- `website/` — public marketing/docs website in progress.

This separation is good. The public website should not depend on the local daemon. It should use static/generated data derived from `sources.js`.

There is also a source-structure mismatch to clean up before serious work: the website appears to have work-in-progress code under `website/src.wip`, while the default tooling expects `website/src`. Before adding features, normalize this so the website has one canonical source directory and one reliable build path.

## Core Pages

### 1. Landing Page

Purpose: explain the product in less than 10 seconds.

Recommended message:

> Find the fastest free coding model, configure your AI coding tool, and optionally route all requests through one local failover endpoint.

Sections:

- Hero with install command.
- Live-looking terminal/demo preview.
- “Why free coding models are hard to choose” problem statement.
- “FCM fixes it” solution statement.
- Provider count, model count, supported tools.
- Smart Router explanation.
- Quick setup cards.
- Testimonials/social proof if available.
- Clear GitHub/npm/Discord CTAs.

### 2. `/models`

A public catalog of all known models.

Features:

- Search by model name.
- Filter by provider.
- Filter by tier.
- Filter by context window.
- Filter by tool compatibility.
- Sort by SWE score, context, provider, tier.
- Clear “free tier type” badges.
- Direct links to provider setup pages.

Important: this page does not need live latency at first. Static catalog data is already valuable for SEO and user education.

Possible future enhancement: show optional public aggregate stats if a privacy-safe backend is ever added.

### 3. `/providers`

Provider index page.

For each provider:

- Name.
- Free-tier summary.
- Credit card required or not.
- Environment variable name.
- Model count.
- Best available tiers.
- Setup link.
- Provider caveats.

### 4. `/providers/:provider`

SEO-friendly provider detail page.

Example pages:

- `/providers/nvidia-nim`
- `/providers/groq`
- `/providers/openrouter`
- `/providers/cerebras`
- `/providers/google-ai-studio`

Page structure:

- What this provider gives you.
- How to get an API key.
- Free limits.
- Best models for coding.
- How to add the key to FCM.
- How to use it with OpenCode, Crush, Continue, etc.
- Known limitations.

### 5. `/integrations`

Tool integration index.

Supported tools can each have a small card:

- OpenCode CLI/Desktop/WebUI.
- OpenClaw.
- Crush.
- Goose.
- Aider.
- Kilo CLI.
- Qwen Code.
- OpenHands.
- Amp.
- Hermes.
- Continue.
- Cline.
- Xcode.
- Pi.
- Rovo.
- Gemini CLI.
- Copilot CLI.
- ForgeCode.

### 6. `/integrations/:tool`

SEO-friendly setup pages for each tool.

Page structure:

- Install the tool.
- Install FCM.
- Pick direct provider mode or router mode.
- Copy config example.
- Troubleshooting.

This can attract searches like “free models for OpenCode”, “use Groq with Crush”, or “OpenAI compatible endpoint for Continue”.

### 7. `/router`

Dedicated Smart Router explanation page.

Explain in plain language:

- One local endpoint.
- Multiple free providers behind it.
- Failover when one provider rate-limits or goes down.
- OpenAI-compatible API.
- Works with most coding tools.

Include copyable setup:

```text
Base URL: http://localhost:19280/v1
Model: fcm
API key: fcm-local
```

### 8. `/docs` or `/guides`

Short high-intent pages:

- Best free coding models right now.
- Best no-credit-card coding APIs.
- How to use free models with OpenCode.
- How to use a local OpenAI-compatible router.
- How to avoid rate limits with fallback routing.

## Data Strategy

Generate static website data from the same catalog used by the CLI.

Recommended generated files:

- `website/src/data/models.generated.ts`
- `website/src/data/providers.generated.ts`
- `website/src/data/integrations.generated.ts`

Generation script idea:

```bash
pnpm generate:website-data
```

The generated data should include:

- Model ID.
- Display label.
- Tier.
- SWE score.
- Context window.
- Provider key.
- Provider display name.
- Tool compatibility metadata.
- Free-tier summary if available.

This prevents drift between README, CLI, local dashboard, and website.

## SEO Opportunities

Target keywords:

- free coding models
- free AI coding models
- free OpenAI compatible API
- free LLM API for coding
- OpenCode free models
- Crush AI free models
- Continue free models
- best free coding LLM
- free alternative to Claude Code
- local AI model router
- OpenAI compatible local router

Recommended SEO pages:

- `Best Free Coding Models`
- `Free OpenAI-Compatible Coding APIs`
- `Free Coding Models for OpenCode`
- `Free Coding Models for Continue`
- `Free Coding Models for Crush`
- `Groq vs NVIDIA NIM for Coding`
- `OpenRouter Free Models for Coding`

## Trust Signals

The website should prominently show:

- MIT license.
- Low dependency count.
- npm provenance/Sigstore if available.
- No prompt logging by the local router.
- API keys stay local.
- GitHub stars and contributors.
- Public source code.
- Security policy.

## UX Tone

Keep the tone practical and direct:

- “One command.”
- “One local endpoint.”
- “Many free providers.”
- “Automatic fallback.”
- “No vendor lock-in.”

Avoid making the website feel like a generic AI SaaS landing page. The project’s strength is developer utility and transparency.

## Implementation Plan

### Phase 1

- Normalize `website/src.wip` into the actual source directory.
- Make `pnpm build` reliable.
- Remove starter/demo copy.
- Add final landing-page content.

### Phase 2

- Add generated catalog data.
- Add `/models` and `/providers` routes.
- Add search/filter UI.

### Phase 3

- Add `/integrations` pages.
- Add `/router` explanation page.
- Add copyable config snippets.

### Phase 4

- Add SEO guides.
- Add sitemap and metadata.
- Add structured data where useful.

## Success Metrics

- Website builds consistently.
- Users can understand the product without reading the full README.
- Users can find provider setup instructions from Google.
- Users can choose a model/provider before installing the CLI.
- The website creates more GitHub stars, npm installs, and Discord joins.
