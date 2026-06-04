#!/usr/bin/env node
/**
 * @file scripts/dev-web.mjs
 * @description Dev: kill ports 3333+5179, spawn backend, spawn Vite. One command.
 */
import { createServer } from 'node:net'
import { exec, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const API_PORT = 3333

// ─── Port helpers ────────────────────────────────────────────────────────────
function isPortUsed(port) {
  return new Promise((resolve) => {
    const s = createServer()
    s.once('error', (err) => resolve(err.code === 'EADDRINUSE'))
    s.once('listening', () => s.close(() => resolve(false)))
    s.listen(port)
  })
}

function execp(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 8000 }, (err, out, err2) => resolve({ err, out, err2 }))
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n  ⚡ free-coding-models dev:web\n')

  // Kill whatever on 3333 and 5179
  for (const port of [API_PORT, 5179]) {
    const used = await isPortUsed(port)
    if (used) {
      const { err } = await execp(`lsof -ti:${port} 2>/dev/null | xargs kill -9 2>/dev/null; echo ok`)
      await new Promise(r => setTimeout(r, 600))
      console.log(`  🔪 Killed port ${port}`)
    } else {
      console.log(`  ✅ Port ${port} free`)
    }
  }

  // Write a small wrapper script so we can spawn it cleanly
  // (avoids ESM require() issues with stdio piping)
  const wrapperPath = join(ROOT, '.dev-backend-tmp.mjs')
  writeFileSync(wrapperPath, `
import { startWebServer } from './web/server.js'
startWebServer(${API_PORT}, { open: false, startPingLoop: true }).then(() => {}).catch(console.error)
`)

  // Spawn backend
  console.log(`\n  🚀 Backend on :${API_PORT}...\n`)
  const api = spawn('node', [wrapperPath], { stdio: 'inherit', cwd: ROOT })

  // Wait for port to be ready (poll)
  let portReady = false
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300))
    portReady = await isPortUsed(API_PORT)
    if (portReady) break
  }

  if (!portReady) {
    console.log('  ⚠️  Backend may still be starting...')
  }

  // Spawn Vite directly (no pnpm exec overhead)
  const viteBin = join(ROOT, 'node_modules/vite/bin/vite.js')
  console.log('  🚀 Vite on :5179...\n')
  const vite = spawn('node', [viteBin, '--host'], { stdio: 'inherit', cwd: ROOT })

  api.on('error', e => console.error('  ❌ API err:', e.message))
  vite.on('error', e => console.error('  ❌ Vite err:', e.message))

  process.on('SIGINT', () => {
    console.log('\n  🛑 Shutting down...')
    api.kill()
    vite.kill()
    try { import('node:fs').then(m => m.unlinkSync(wrapperPath)) } catch {}
    process.exit(0)
  })
}

main().catch(e => { console.error(e); process.exit(1) })