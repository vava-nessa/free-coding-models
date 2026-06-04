# 📦 free-coding-models-web

This directory contains the shared React SPA (Single Page Application) dashboard for `free-coding-models`.

## 🌐 Architecture

The frontend is a single SPA that is served in two distinct scenarios:
1. **Web Dashboard / Docker Mode (`--daemon`):** Served directly by the local Node.js `router-daemon` process on `http://localhost:19280/`.
2. **Desktop Mode (Tauri App):** Loaded locally inside Tauri's native webview from embedded assets in `web/dist/`, communicating via HTTP fetch to the background engine.

To maintain maximum code sharing, **95%+ of all components and logic are kept completely identical** between the two distributions.

---

## ⚡ API & Event Integration

The React app uses a realtime-first connection strategy against the local engine:
* **Socket.IO** is preferred in dev/web-server mode for instant per-model ping and benchmark updates.
* **`GET /api/events` / `EventSource`** is the streaming fallback used by daemon/Docker surfaces.
* **`GET /api/state`** returns the wrapped live dashboard state for REST fallback polling.
* **`GET /api/models`** remains the legacy flat model catalog endpoint for simple clients.
* **`GET /api/config`** retrieves active provider toggles (keys are masked).
* **`POST /api/settings`** updates API keys and provider preferences.
* **`POST /api/global-benchmark`** benchmarks only the models currently visible in the web table, so filters/search control the benchmark scope.

---

## 🛠️ Development & Building

### Prerequisites
Make sure you have `pnpm` installed and dependencies initialized at the root of the project.

### 1. Dev Server (HMR)
To start the React frontend with Vite HMR (Hot Module Replacement):
```bash
cd web
pnpm dev
```
By default, the dev server runs on `http://localhost:5179/`. Ensure a background daemon is running on port `19280` so the API requests proxy correctly.

### 2. Production Build
To compile the production-ready SPA:
```bash
pnpm build
```
This bundles the HTML, JS, and CSS assets into the `web/dist/` directory, which is then embedded inside both the CLI daemon and the Tauri desktop app binary.
