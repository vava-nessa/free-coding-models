# Smart Model Router

> ⚠️ **ALPHA** — The router is functional but still under active development. APIs and behavior may change between versions.

The **FCM Router** is a local OpenAI-compatible daemon that keeps running after the TUI closes. Point your coding tool at one localhost endpoint and let FCM route each request to the best available model from your favorites.

## Quick Start

```bash
# Start the router in the background (or press 'S' in the Router Dashboard)
free-coding-models --daemon-bg

# Check status
free-coding-models --daemon-status

# Stop it cleanly
free-coding-models --daemon-stop
```

## Configuration

Open the Router Dashboard with **Shift+R** from the main table. The dashboard shows:

1. **Status Banner** — red (stopped), green (running), or orange (starting)
2. **Quick Setup** — copy these into your coding tool:

| Field | Value |
|-------|-------|
| Base URL | `http://localhost:19280/v1` |
| Model | `fcm` |
| API key | `fcm-local` |

3. **Router Models** — your favorited models from the main table, in fallback order

### Managing Router Models

Your **favorites** (star models with `F` in the main table) automatically become the router's model pool. The order determines fallback priority:

- **#1** is tried first for every request
- **#2** is the first fallback if #1 fails
- And so on...

Use **Shift+↑/↓** in the Router Dashboard to reorder models.

### Health Check Speed

Press **I** in the Router Dashboard to cycle through health check speeds:
- **Slow** (eco) — minimal background probing
- **Normal** (balanced) — default
- **Fast** (aggressive) — frequent health checks

## Routing Behavior

- Priority order works immediately on cold start, then probes refine health scores over time.
- Transient failures (`429`, `500`, `502`, `503`, timeouts) fail over to the next model.
- Authentication problems (`401`, `403`, missing keys) are marked separately so bad credentials do not poison the health tracking; after one provider returns an auth error, the router skips the rest of that provider for the current request.
- Upstream HTML maintenance pages and malformed successful JSON are treated as retryable provider failures instead of being forwarded to your coding tool.
- Quota and rate-limit failures include retry headers in the final router `503` payload when providers expose them.
- If a coding tool disconnects mid-request, the daemon aborts the upstream request without counting it as a provider failure.
- Streaming requests retry before the first byte; after partial output starts, the daemon records the failure and lets the current stream finish as safely as possible.

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/chat/completions` | Route through the active model pool |
| `GET /v1/models` | Return virtual models (`fcm`) |
| `GET /health` | Daemon status JSON |
| `GET /stats` | Routing, health, request log, and token stats |
| `GET /stream/events` | Live SSE events |
| `POST /daemon/probe-mode` | Set health check speed: `{ "probeMode": "eco" | "balanced" | "aggressive" }` |
| `GET /` | Web dashboard (same port) |
| `GET /api/models` | Model data with latency stats |
| `GET /api/config` | Provider config (keys masked) |
| `GET /api/events` | Live SSE for dashboard |
| `POST /api/settings` | Save API keys and provider toggles |
