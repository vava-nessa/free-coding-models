# fcm-agent-core

Shared scan / ranking / cache / provider-config core for the **FCM coding-agent extensions** ([`fcm-pi`](../fcm-pi), [`fcm-opencode`](../fcm-opencode)).

> ⚠️ **BETA** — Not yet published to npm. Consumed via local path inside this repo. A future release may publish it as `@free-coding-models/agent-core`.

## Why this exists

`fcm-pi` and `fcm-opencode` need the exact same logic: scan candidate models (daemon or direct), rank them by a composite score, cache results, resolve API keys, and build provider descriptors for their host. This package is that shared logic. The adapters only own what is truly host-specific:

- **Pi adapter** — `pi.registerProvider`, `pi.setModel`, `~/.pi/agent/*.json` disk writes, Pi status-bar rendering.
- **OpenCode adapter** — OpenCode config mutation (`config.provider`, `config.model`), command hooks, toasts.

## Public API

```js
import {
  scanBestFcmModel,      // orchestrator: daemon-first, direct fallback
  directScan,            // low-level ping + benchmark
  rankModels, formatModelLine,
  isContextUsable, parseContextWindow, getMaxTokens,
  getKeyForProvider, loadAllApiKeys,
  isDaemonRunning, queryDaemon,
  createCacheStore,
  buildPiProviderDescriptor, buildOpenCodeProviderDescriptor, buildSmartRouterDescriptor,
} from 'fcm-agent-core'
```

### Scan

```js
const result = await scanBestFcmModel({
  mode: 'auto',        // 'auto' | 'daemon' | 'direct'
  target: 'pi',        // 'pi' | 'opencode' | 'agent' (diagnostics only)
  onProgress(event) {}, // structured events, no ANSI
  onNotify(msg, type) {},
  signal,              // AbortSignal
})

// result: { source, scannedAt, ranked, bestModel, diagnostics }
```

Progress events are plain objects — rendering is the adapter's job:

```js
{ phase: 'daemon-check' | 'probing' | 'benchmarking' | 'done' | 'error',
  percent, completed, total, activeModels: [{ label, providerName }], message }
```

### Cache

```js
const cache = createCacheStore({
  filePath: '/path/to/cache.json',
  legacyPaths: ['/old/path.json'], // read fallback (cross-tool cache sharing)
  ttlMs: 10 * 60 * 1000,
})
cache.read()   // normalized payload or null
cache.write(result)
```

### Provider descriptors

```js
buildPiProviderDescriptor(model)         // → { providerId, provider, modelDescriptor }
buildOpenCodeProviderDescriptor(model)   // → { providerId, provider, envName, modelRef }
buildSmartRouterDescriptor({ target: 'pi' | 'opencode' })
```

## Local setup (why a self-link is needed)

This package imports the catalog and ping/benchmark modules from the `free-coding-models` package by name (it's a `peerDependency`). When used via local path inside this repo, Node needs a self-link to resolve `free-coding-models` from the `packages/` tree. Create it once:

```bash
cd packages
mkdir -p node_modules
ln -s ../../ node_modules/free-coding-models
```

(The legacy `pi-extension/` uses the same trick at `pi-extension/node_modules/free-coding-models`.)

When `fcm-agent-core` is eventually published to npm, `free-coding-models` resolves as a normal peer dependency and the self-link is no longer needed.

## Layout

```
src/
├── index.js                     ← public barrel
├── scan-orchestrator.js         ← scanBestFcmModel (daemon-first)
├── direct-scanner.js            ← parallel ping + benchmark
├── daemon-client.js             ← localhost:19280 client
├── ranker.js                    ← composite score + sort
├── model-config.js              ← context parse + token caps + safety filter
├── api-keys.js                  ← env + config-file key resolver
├── cache.js                     ← namespaced cache store
└── provider-config-builders.js  ← Pi / OpenCode / router descriptor builders
```

## Notes

- **No rendering here.** The core never imports `chalk` or emits ANSI. Adapters render progress events.
- **No secrets logged.** Provider descriptors reference keys by value for runtime use only; OpenCode descriptors use `{env:NAME}` placeholders so keys never land in config files.
- See `.kandown/tasks/t2.md` for the architecture rationale and the longer-term plan to publish this as a standalone package.
