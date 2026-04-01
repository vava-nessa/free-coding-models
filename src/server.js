import { createServer } from 'node:http'
import chalk from 'chalk'
import { SOURCES } from '../sources.js'
import { findBestModel } from './utils.js'
import { getApiKey } from './config.js'

export async function startProxyServer(port = 8080, stateRef, config) {
  const server = createServer(async (req, res) => {
    // Basic CORS and Preflight
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    if (req.method !== 'POST' || !req.url.endsWith('/v1/chat/completions')) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Only POST /v1/chat/completions is supported' }))
      return
    }

    let body = ''
    for await (const chunk of req) {
      body += chunk
    }

    let parsedBody
    try {
      parsedBody = JSON.parse(body)
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    // Proxy routing logic
    const results = stateRef.current.results
    // Use the actual models list from state, filtered by what's available
    const availableResults = results.filter(r => r.status === 'up' || r.status === 'pending')
    const bestModelResult = findBestModel(availableResults)

    if (!bestModelResult) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No free models currently available or configured.' }))
      return
    }

    const providerMetadata = SOURCES[bestModelResult.providerKey]
    const apiKey = getApiKey(config, bestModelResult.providerKey)

    if (!apiKey) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `No API key configured for best model provider: ${bestModelResult.providerKey}` }))
        return
    }

    // Modify the payload to use the actual model ID
    parsedBody.model = bestModelResult.modelId

    try {
      // 📖 Important: we do not handle streaming fallback perfectly here yet
      // but we pipe the response exactly as it comes
      const fetchHeaders = {
        'Content-Type': 'application/json',
      }
      if (apiKey !== 'nokey') {
          fetchHeaders['Authorization'] = `Bearer ${apiKey}`
      }

      // 📖 We should forward custom headers if the provider requires it.
      // E.g., OpenRouter requires HTTP-Referer
      if (providerMetadata.headers) {
          Object.assign(fetchHeaders, providerMetadata.headers)
      }

      const providerRes = await fetch(providerMetadata.url, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(parsedBody)
      })

      // Forward status and headers
      const resHeaders = {
         'Content-Type': providerRes.headers.get('content-type') || 'application/json',
      }
      if (providerRes.headers.get('Transfer-Encoding') === 'chunked') {
          resHeaders['Transfer-Encoding'] = 'chunked'
      }
      res.writeHead(providerRes.status, resHeaders)

      if (providerRes.body) {
        // Node 18+ web streams to node streams
        const reader = providerRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
         const text = await providerRes.text()
         res.end(text)
      }

    } catch (err) {
      console.error(chalk.red(`[Proxy Error] Failed to route to ${bestModelResult.modelId}:`), err.message)
      if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal proxy error', details: err.message }))
      } else {
          res.end()
      }
    }
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, port })
    })
  })
}
