# free-coding-models Ideas Backlog

This folder collects product, UX, website, and architecture ideas for evolving `free-coding-models` beyond the current CLI/TUI experience.

## Product Direction

The strongest product direction is:

> **FCM should become the free coding-model cockpit: discover, compare, configure, monitor, and route the best free or free-limited coding models from one place.**

The current project already has strong ingredients:

- A curated provider/model catalog.
- Real latency and stability measurements.
- A local OpenAI-compatible router daemon.
- Tool integration flows for many coding agents and CLIs.
- A local web dashboard in `web/`.
- A public website effort in `website/`.

The next step is to make those pieces feel like one cohesive product.

## Recommended Priority Order

### P0 — Make the public website buildable and deployable

See [`public-website.md`](./public-website.md).

The public website should become the growth engine: SEO pages, catalog pages, provider pages, integration guides, and a polished landing page.

### P1 — Turn the local Web UI into the Router Control Center

See [`local-web-ui.md`](./local-web-ui.md).

The local dashboard should not only show pings. It should make the router understandable and operable: status, model set, tokens, health, config copy buttons, and start/stop actions.

### P1 — Add `free-coding-models doctor` and a guided setup wizard

See [`cli-doctor-and-setup.md`](./cli-doctor-and-setup.md).

This would reduce support burden and first-run friction by checking keys, tools, ports, config files, daemon status, and common mistakes.

### P2 — Make rankings more user-intent aware

See [`model-intelligence.md`](./model-intelligence.md).

The app should answer questions like “best for refactoring”, “best for quick fixes”, “best with my keys”, and “best long-context free model”, not only raw latency.

### P2 — Clean up architecture to support faster feature work

See [`architecture-and-maintenance.md`](./architecture-and-maintenance.md).

Some modules have grown very large. A gradual domain-based split would make future changes safer and easier.

## Quick Feature Matrix

| Idea | User Impact | Effort | Priority |
|---|---:|---:|---:|
| Public `/models` catalog | High | Medium | P0 |
| Public provider pages | High | Medium | P0 |
| Public integration pages | High | Medium | P0 |
| Router Control Center in local Web UI | Very high | Medium | P1 |
| Copyable router config panel | Very high | Low | P1 |
| `free-coding-models doctor` | High | Medium | P1 |
| Guided first-run setup | High | Medium | P1 |
| Intent-based recommendations | High | Medium | P2 |
| Quota-aware ranking | High | Medium | P2 |
| Overlay/key-handler refactor | Medium | High | P2 |
| Generated website data from `sources.js` | High | Medium | P2 |

## Suggested Milestones

### Milestone 1 — Website Foundation

- Normalize the `website` source structure.
- Make `pnpm build` reliable inside `website/`.
- Add a polished landing page.
- Add generated static data from `sources.js`.
- Add `/models`, `/providers`, and `/integrations` routes.

### Milestone 2 — Local Dashboard Upgrade

- Add Router status as the dashboard hero card.
- Add copy buttons for Base URL, model name, and API key.
- Add model-set visibility.
- Add token and request summaries.
- Add human-readable provider health.

### Milestone 3 — Setup and Diagnostics

- Add `doctor` command.
- Add first-run wizard.
- Add tool install checks.
- Add config repair suggestions.
- Add daemon troubleshooting messages.

### Milestone 4 — Smarter Recommendations

- Add intent presets.
- Add quota-aware scoring.
- Add provider reliability history.
- Add “best with my keys” and “best no-credit-card” recommendations.

### Milestone 5 — Architecture Hardening

- Split large TUI modules by domain.
- Add a lightweight overlay manager.
- Share model/catalog normalization between CLI, local dashboard, and website.
- Add more focused tests for router UX state and dashboard payloads.
