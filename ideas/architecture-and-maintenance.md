# Architecture and Maintenance Ideas

## Goal

Keep the project easy to evolve as the CLI, TUI, router daemon, local dashboard, and public website grow.

The product has expanded from a simple ping table into a multi-surface tool:

- CLI flags.
- Interactive TUI.
- Provider key management.
- Tool integration management.
- Local OpenAI-compatible router daemon.
- Local web dashboard.
- Public website.
- Provider/model catalog maintenance.

That growth is good, but it needs clearer boundaries to avoid slowing future work.

## Current Risk Areas

Some modules are very large and domain-dense:

- `src/key-handler.js` — many unrelated key flows in one place.
- `src/router-daemon.js` — HTTP daemon, routing, health, token stats, static dashboard serving, security checks.
- `src/overlays.js` — many TUI screens in one file.
- `src/router-dashboard.js` — dashboard client logic, rendering, polling, SSE, set management helpers.
- `src/render-table.js` — table rendering plus footer/status concerns.

Large files are not automatically bad, but they make changes riskier when many product areas overlap.

## Recommended Module Boundaries

### 1. Router Domain

Create a router-focused folder:

```text
src/router/
  daemon.js
  runtime.js
  routing.js
  health.js
  token-stats.js
  sets.js
  static-dashboard.js
  security.js
  errors.js
```

Purpose:

- Keep daemon startup separate from request routing.
- Keep token accounting isolated.
- Keep router sets isolated.
- Make the OpenAI-compatible proxy logic easier to test.

Migration should be gradual. Do not rewrite everything at once.

### 2. TUI Domain

Create a TUI-focused folder:

```text
src/tui/
  state.js
  key-handler.js
  keybindings.js
  overlays/
    settings.js
    help.js
    changelog.js
    recommend.js
    router.js
    feedback.js
  table/
    render-table.js
    columns.js
    footer.js
    layout.js
```

Purpose:

- Split overlay rendering by screen.
- Make keybindings discoverable.
- Avoid one giant key handler.
- Make table layout easier to reason about.

### 3. Shared Catalog Domain

Create a shared catalog/data layer:

```text
src/catalog/
  normalize.js
  providers.js
  compatibility.js
  generated.js
  website-data.js
```

Purpose:

- Share model/provider normalization between CLI, local Web UI, and public website.
- Generate website data from the same source as the CLI.
- Reduce README/website/catalog drift.

### 4. Diagnostics Domain

If `doctor` is added:

```text
src/doctor/
  checks/
    system.js
    config.js
    providers.js
    router.js
    tools.js
    web.js
  format.js
  report.js
  fix.js
```

Purpose:

- Keep diagnostics composable.
- Make check results testable.
- Support text and JSON output from the same check objects.

## Overlay Management

The TUI currently has many mutually exclusive overlay states. A small overlay manager would make this easier.

Concept:

```js
state.overlay = {
  stack: [
    { type: 'settings' },
    { type: 'provider-key-editor', provider: 'groq' }
  ]
}
```

Behavior:

- `openOverlay(type, props)` pushes an overlay.
- `replaceOverlay(type, props)` replaces current overlay.
- `closeOverlay()` pops one overlay.
- `closeAllOverlays()` returns to table.
- Escape closes the top overlay.

Benefits:

- Clear navigation.
- No giant priority chain.
- Breadcrumbs become possible.
- Fewer impossible states.

Possible breadcrumb:

```text
Main Table > Settings > Groq API Key
```

## Keybinding Registry

Create a central registry for keybindings:

```text
src/tui/keybindings.js
```

Each action should include:

- Key.
- Context.
- Label.
- Description.
- Handler ID.
- Whether it appears in footer/help/command palette.

Benefits:

- README key list can be generated or checked.
- Help overlay stays accurate.
- Command palette can reuse action metadata.
- Fewer hidden shortcuts.

Example:

```js
{
  key: 'Ctrl+P',
  context: 'global',
  label: 'Command Palette',
  description: 'Search and run actions',
  visibleInFooter: true,
}
```

## Website Data Generation

The public website should not manually duplicate model/provider data.

Add a script:

```bash
pnpm generate:website-data
```

Outputs:

```text
website/src/data/models.generated.ts
website/src/data/providers.generated.ts
website/src/data/stats.generated.ts
```

Potential source inputs:

- `sources.js`.
- `src/provider-metadata.js`.
- `src/tool-metadata.js`.
- README free-tier summaries if moved into structured metadata.

Benefits:

- Model count is always accurate.
- Provider pages stay current.
- Public catalog reflects actual CLI catalog.
- Easier to add SEO pages.

## Test Strategy Improvements

The existing test suite is strong. Add more focused tests around new boundaries.

### Suggested Tests

#### Doctor checks

- Valid config.
- Invalid JSON.
- Missing provider key.
- Dead daemon PID.
- Port occupied by another app.
- Tool missing with install suggestion.

#### Recommendation engine

- Quick-fix preset favors speed.
- Refactor preset favors quality/context.
- Missing key excludes provider in “best with my keys”.
- Incompatible tool excludes model.
- Rate-limited provider is penalized.

#### Website data generator

- Every model has a provider.
- Every provider page slug is unique.
- Generated data has no functions or secrets.
- Model counts match `MODELS`.

#### Overlay manager

- Escape pops the top overlay.
- Only one active overlay is rendered.
- Breadcrumbs match stack.
- Opening settings from dashboard behaves predictably.

## Maintainability Rules

Recommended internal rules:

1. New pure logic goes into small modules with tests.
2. New UI screens should not be added directly to one giant overlay file.
3. New keybindings must be registered in one central place.
4. New provider metadata should be structured, not README-only.
5. Website-visible catalog data should be generated from source metadata.
6. Router errors should have both technical and user-friendly forms.
7. Any secret-bearing flow must have masking tests.

## Implementation Plan

### Phase 1 — No-risk preparation

- Add architecture notes.
- Add keybinding registry skeleton without changing behavior.
- Add website data generator prototype.
- Add tests around generated data.

### Phase 2 — Extract low-risk modules

- Extract table footer rendering.
- Extract router dashboard formatting helpers.
- Extract provider health label mapping.
- Extract recommendation scoring.

### Phase 3 — Overlay manager

- Add overlay stack behind existing booleans.
- Migrate one overlay at a time.
- Keep compatibility until all overlays are moved.

### Phase 4 — Router split

- Extract token stats.
- Extract router sets.
- Extract error formatting.
- Extract static dashboard serving.
- Keep public exports stable.

## Success Criteria

- New features require fewer edits in huge files.
- Keybindings are easier to audit.
- Website data cannot drift from CLI data.
- Router behavior is easier to test in isolation.
- Contributors can understand where to add features.
