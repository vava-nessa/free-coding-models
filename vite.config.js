/**
 * @file vite.config.js
 * @description Vite+ configuration for the free-coding-models web dashboard.
 * 📖 Uses React plugin, builds to web/dist/, proxies API requests to Node server.
 * @see https://viteplus.dev/config/
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  plugins: [react()],
  root: 'web',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5179,
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
