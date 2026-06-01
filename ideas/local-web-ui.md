# Local Web UI Ideas

> **Status: M1 shipped in v0.5.3 (2026-06-01).** Layout refactor (no sidebar,
> full-width table, header menu, sticky FilterBar) + favorites + per-row
> benchmark + theme tri-state + reset view + URL deep-linking + ⌘K palette
> placeholder are all live. The detailed M2–M5 roadmap below is still
> tracked in `tui-web-feature-parity.md` §6.

## Goal

The local Web UI should evolve from a live model table into a full **Router Control Center**.

The user should be able to open `http://localhost:19280/` and immediately understand:

- Is the router running?
- Which model set is active?
- Which model is currently best?
- Which providers are configured?
- Which providers are failing, rate-limited, or missing keys?
- How many tokens/requests were routed today?
- What configuration should be pasted into an AI coding tool?

## Current Strengths

The existing local dashboard already has valuable pieces:

- Live SSE updates.
- Model table.
- Filtering.
- Settings view.
- Analytics view.
- Export flow.
- Existing daemon endpoints for models, config, stats, events, and settings.

The main opportunity is product framing. The dashboard should feel like the control panel for the router, not only a secondary visualization of the TUI table.

## Main Dashboard Layout

### 1. Router Hero Card

At the top of the dashboard, show a compact but obvious router status panel.

Example content:

```text
Smart Router: RUNNING
Active set: fast-coding · 7 models
Endpoint: http://localhost:19280/v1
Model: fcm
Requests today: 428
Tokens today: 1.2M
```

Actions:

- Copy Base URL.
- Copy model name.
- Copy API key placeholder.
- Start router.
- Stop router.
- Restart router.
- Open logs.

### 2. Quick Setup Panel

This should be impossible to miss.

```text
Use this in your coding tool:

Base URL: http://localhost:19280/v1
Model: fcm
API Key: fcm-local
```

Add copy buttons beside each row and one “Copy all” button.

This helps users avoid reading the README every time.

### 3. Active Model Set

Show the active router set as a prioritized list:

```text
#1 Groq · GPT OSS 120B · Healthy · 420ms
#2 NVIDIA · DeepSeek V4 Flash · Healthy · 610ms
#3 Cerebras · Qwen3 235B · Rate-limited · skipped
```

Important language:

- Use “Priority” instead of internal routing jargon.
- Use “Healthy”, “Rate-limited”, “Auth error”, “Down”, “Cooling down”.
- Avoid exposing circuit-breaker terms unless the user opens an advanced panel.

### 4. Provider Health Cards

Show configured providers as cards:

- Provider name.
- Key status.
- Enabled/disabled.
- Best model.
- Current health.
- Last error.
- Free-tier note.

Example:

```text
Groq
Configured · Enabled
Best now: GPT OSS 120B
Health: Healthy
Quota: 70% remaining
```

### 5. Model Table

Keep the model table, but make it support product workflows:

- Add “Add to router set” action.
- Add “Pin as priority #1” action.
- Add “Test now” action.
- Add “Copy provider config” action.
- Add “Open provider key page” action.

### 6. Request Timeline

A user-friendly request log:

```text
12:41:08 · Groq / GPT OSS 120B · 200 · 1.2s · 3.4k tokens
12:40:55 · NVIDIA / DeepSeek V4 Flash · 429 · failed over
12:40:54 · Cerebras / Qwen3 235B · timeout · failed over
```

Avoid showing UUID request IDs by default. They can live in an advanced debug drawer.

## Important UX Improvements

### Human-readable errors

Replace technical messages with actionable ones.

Examples:

| Technical | Better |
|---|---|
| `Malformed JSON from /stats` | Router returned unexpected data. Try restarting it. |
| `SSE HTTP 503` | Live updates are temporarily unavailable. The dashboard will retry. |
| `Router daemon is not reachable` | Router is not running. Start it from this page or run `free-coding-models --daemon-bg`. |
| `ECONNREFUSED` | Nothing is listening on the router port. Start the daemon. |

### One-click router start

If the dashboard is opened while the router is stopped, show a friendly empty state:

```text
Smart Router is not running yet.

Start it to create one local OpenAI-compatible endpoint that can fail over between your configured free providers.

[Start Router]
```

### Avoid router jargon

Use product language first:

- “Healthy” instead of `CLOSED`.
- “Cooling down” instead of `OPEN`.
- “Recovering” instead of `HALF_OPEN`.
- “Fallback happened” instead of “retry candidate selected”.

Advanced details can be hidden behind a collapsible panel.

## Settings Improvements

The settings page should become more task-focused.

Recommended groups:

1. Provider API Keys.
2. Router behavior.
3. Tool integrations.
4. Data and privacy.
5. Advanced/debug.

Provider rows should include:

- Masked key.
- Test key button.
- Enable/disable toggle.
- Open key page.
- Copy env var name.
- Free-tier summary.

## Router Set Management

Most users do not need a complex set manager. Use a simple model:

- Favorites become default router candidates.
- The currently selected model can be pinned as priority #1.
- Advanced users can create named sets.

Recommended default flow:

1. User stars models in the table.
2. Dashboard says: “These starred models power your router set.”
3. User can drag to reorder.
4. Router tries priority #1 first, then falls back.

This is easier to understand than separate hidden set management.

## Useful Dashboard Tabs

### Dashboard

Status, quick setup, active set, best model, provider health.

### Models

Full model table and filtering.

### Router

Active set, failover policy, request log, probe mode.

### Usage

Tokens, requests, model/provider breakdown, history.

### Settings

Keys, providers, tool setup, privacy.

## Visual Design Direction

Recommended style:

- Developer cockpit.
- Dark-first but readable in light mode.
- Dense but not overwhelming.
- Strong status colors.
- Copyable command/config blocks.
- Minimal animations.

Avoid dashboard bloat. The main page should answer the top questions immediately.

## API Enhancements That Would Help

The Web UI would benefit from compact endpoints tailored for UI use:

### `GET /api/router/summary`

Returns:

- running status.
- port.
- active set.
- request totals.
- token totals.
- best current model.
- degraded providers count.

### `GET /api/router/quick-setup`

Returns:

- base URL.
- model.
- API key placeholder.
- compatible tools.

### `POST /api/router/start`

Starts the daemon if not running.

### `POST /api/router/stop`

Stops it safely.

### `POST /api/router/sets/:name/reorder`

Updates priority order from drag/drop.

## Implementation Plan

### Phase 1 — Router Visibility

- Add Router Hero Card.
- Add Quick Setup Panel.
- Show active model set.
- Improve stopped-daemon state.

### Phase 2 — Provider and Model Actions

- Add provider health cards.
- Add model row actions.
- Add add-to-router-set and pin-as-priority actions.

### Phase 3 — Usage and Request History

- Add token summary.
- Add request timeline.
- Add provider/model breakdown.

### Phase 4 — Advanced Router Controls

- Add set management.
- Add probe mode controls.
- Add advanced debug drawer.

## Success Criteria

- A new user can configure their coding tool from the Web UI without opening the README.
- A user can see whether the router is healthy in under 3 seconds.
- A user can understand why a model was skipped or failed over.
- A user can start/stop and troubleshoot the router from the browser.
