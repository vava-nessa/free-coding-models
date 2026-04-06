/**
 * @file web/app.js
 * @description Client-side JavaScript for the free-coding-models Web Dashboard.
 *
 * Connects to the SSE endpoint for real-time model updates,
 * renders the data table, handles sorting/filtering, and manages
 * the settings modal and detail panel.
 */

// ─── State ───────────────────────────────────────────────────────────────────

let models = []
let sortColumn = 'avg'
let sortDirection = 'asc'
let filterTier = 'all'
let filterStatus = 'all'
let filterProvider = 'all'
let searchQuery = ''
let selectedModelId = null
let eventSource = null
let updateCount = 0

// ─── DOM References ───────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

const tableBody = $('#table-body')
const searchInput = $('#search-input')
const themeToggle = $('#theme-toggle')
const settingsBtn = $('#settings-btn')
const settingsModal = $('#settings-modal')
const settingsClose = $('#settings-close')
const settingsBody = $('#settings-body')
const detailPanel = $('#detail-panel')
const detailClose = $('#detail-close')
const detailTitle = $('#detail-title')
const detailBody = $('#detail-body')
const providerFilter = $('#provider-filter')

// ─── SSE Connection ──────────────────────────────────────────────────────────

function connectSSE() {
  if (eventSource) eventSource.close()

  eventSource = new EventSource('/api/events')

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      models = data
      updateCount++
      renderTable()
      updateStats()
      if (updateCount === 1) populateProviderFilter()
      if (selectedModelId) updateDetailPanel()
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }

  eventSource.onerror = () => {
    console.warn('SSE connection lost, reconnecting in 3s...')
    setTimeout(connectSSE, 3000)
  }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function getFilteredModels() {
  let filtered = [...models]

  // Tier filter
  if (filterTier !== 'all') {
    filtered = filtered.filter(m => m.tier === filterTier)
  }

  // Status filter
  if (filterStatus !== 'all') {
    filtered = filtered.filter(m => {
      if (filterStatus === 'up') return m.status === 'up'
      if (filterStatus === 'down') return m.status === 'down' || m.status === 'timeout'
      if (filterStatus === 'pending') return m.status === 'pending'
      return true
    })
  }

  // Provider filter
  if (filterProvider !== 'all') {
    filtered = filtered.filter(m => m.providerKey === filterProvider)
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.modelId.toLowerCase().includes(q) ||
      m.origin.toLowerCase().includes(q) ||
      m.tier.toLowerCase().includes(q) ||
      (m.verdict || '').toLowerCase().includes(q)
    )
  }

  // Sort
  filtered.sort((a, b) => {
    let cmp = 0
    const col = sortColumn

    if (col === 'idx') cmp = a.idx - b.idx
    else if (col === 'tier') cmp = tierRank(a.tier) - tierRank(b.tier)
    else if (col === 'label') cmp = a.label.localeCompare(b.label)
    else if (col === 'origin') cmp = a.origin.localeCompare(b.origin)
    else if (col === 'sweScore') cmp = parseSwe(a.sweScore) - parseSwe(b.sweScore)
    else if (col === 'ctx') cmp = parseCtx(a.ctx) - parseCtx(b.ctx)
    else if (col === 'latestPing') cmp = (a.latestPing ?? Infinity) - (b.latestPing ?? Infinity)
    else if (col === 'avg') cmp = (a.avg === Infinity ? 99999 : a.avg) - (b.avg === Infinity ? 99999 : b.avg)
    else if (col === 'stability') cmp = (a.stability ?? -1) - (b.stability ?? -1)
    else if (col === 'verdict') cmp = verdictRank(a.verdict) - verdictRank(b.verdict)
    else if (col === 'uptime') cmp = (a.uptime ?? 0) - (b.uptime ?? 0)

    return sortDirection === 'asc' ? cmp : -cmp
  })

  return filtered
}

function renderTable() {
  const filtered = getFilteredModels()

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr class="loading-row">
        <td colspan="12">
          <div class="loading-spinner">
            <span style="font-size: 24px">🔍</span>
            <span>No models match your filters</span>
          </div>
        </td>
      </tr>`
    return
  }

  // Find top 3 by avg for medals
  const onlineModels = filtered.filter(m => m.status === 'up' && m.avg !== Infinity)
  const sorted = [...onlineModels].sort((a, b) => a.avg - b.avg)
  const top3 = sorted.slice(0, 3).map(m => m.modelId)

  const html = filtered.map((m, i) => {
    const rankClass = top3.indexOf(m.modelId) === 0 ? 'rank-1' :
                      top3.indexOf(m.modelId) === 1 ? 'rank-2' :
                      top3.indexOf(m.modelId) === 2 ? 'rank-3' : ''
    const medal = top3.indexOf(m.modelId) === 0 ? '🥇' :
                  top3.indexOf(m.modelId) === 1 ? '🥈' :
                  top3.indexOf(m.modelId) === 2 ? '🥉' : ''

    return `<tr class="${rankClass}" data-model-id="${m.modelId}" data-provider="${m.providerKey}">
      <td class="td--rank">${medal || (i + 1)}</td>
      <td>${tierBadge(m.tier)}</td>
      <td>
        <div class="model-name">
          <span class="status-dot status-dot--${m.status}"></span>${escapeHtml(m.label)}
          ${!m.hasApiKey && !m.cliOnly ? '<span class="no-key-badge">🔑 NO KEY</span>' : ''}
        </div>
        <div class="model-id">${escapeHtml(m.modelId)}</div>
      </td>
      <td><span class="provider-pill">${escapeHtml(m.origin)}</span></td>
      <td class="swe-score ${sweClass(m.sweScore)}">${m.sweScore || '—'}</td>
      <td class="ctx-value">${m.ctx || '—'}</td>
      <td class="ping-value ${pingClass(m.latestPing)}">${formatPing(m.latestPing, m.latestCode)}</td>
      <td class="ping-value ${pingClass(m.avg)}">${formatAvg(m.avg)}</td>
      <td class="td--stability">${stabilityCell(m.stability)}</td>
      <td>${verdictBadge(m.verdict, m.httpCode)}</td>
      <td class="td--uptime"><span class="uptime-value">${m.uptime > 0 ? m.uptime + '%' : '—'}</span></td>
      <td class="td--sparkline">${sparkline(m.pingHistory)}</td>
    </tr>`
  }).join('')

  tableBody.innerHTML = html

  // Attach row click handlers
  tableBody.querySelectorAll('tr[data-model-id]').forEach(row => {
    row.addEventListener('click', () => {
      selectedModelId = row.dataset.modelId
      showDetailPanel(selectedModelId)
    })
  })
}

// ─── Cell Renderers ──────────────────────────────────────────────────────────

function tierBadge(tier) {
  const cls = tier.replace('+', 'plus').replace('-', 'minus').toLowerCase()
  return `<span class="tier-badge tier-badge--${cls}">${tier}</span>`
}

function sweClass(swe) {
  const val = parseSwe(swe)
  if (val >= 65) return 'swe-high'
  if (val >= 40) return 'swe-mid'
  return 'swe-low'
}

function pingClass(ms) {
  if (ms == null || ms === Infinity) return 'ping-none'
  if (ms < 500) return 'ping-fast'
  if (ms < 1500) return 'ping-medium'
  return 'ping-slow'
}

function formatPing(ms, code) {
  if (ms == null) return '<span class="ping-none">—</span>'
  if (code === '429') return '<span class="ping-slow">429</span>'
  if (code === '000') return '<span class="ping-slow">TIMEOUT</span>'
  return `${ms}ms`
}

function formatAvg(avg) {
  if (avg == null || avg === Infinity || avg > 99000) return '<span class="ping-none">—</span>'
  return `${avg}ms`
}

function stabilityCell(score) {
  if (score == null || score < 0) return '<span class="ping-none">—</span>'
  const cls = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low'
  return `<div class="stability-cell">
    <div class="stability-bar"><div class="stability-bar__fill stability-bar__fill--${cls}" style="width:${score}%"></div></div>
    <span class="stability-value">${score}</span>
  </div>`
}

function verdictBadge(verdict, httpCode) {
  if (!verdict) return '<span class="verdict-badge verdict--pending">Pending</span>'
  if (httpCode === '429') return '<span class="verdict-badge verdict--ratelimited">⚠️ Rate Limited</span>'
  const cls = verdict.toLowerCase().replace(/\s+/g, '').replace('very', 'very')
  const classMap = {
    'perfect': 'perfect', 'normal': 'normal', 'slow': 'slow',
    'spiky': 'spiky', 'veryslow': 'veryslow', 'overloaded': 'overloaded',
    'unstable': 'unstable', 'notactive': 'notactive', 'pending': 'pending'
  }
  return `<span class="verdict-badge verdict--${classMap[cls] || 'pending'}">${verdict}</span>`
}

function sparkline(history) {
  if (!history || history.length < 2) return ''
  const valid = history.filter(p => p.code === '200' || p.code === '401')
  if (valid.length < 2) return ''

  const values = valid.map(p => p.ms)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 80, h = 22
  const step = w / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const lastVal = values[values.length - 1]
  const color = lastVal < 500 ? '#00ff88' : lastVal < 1500 ? '#ffaa00' : '#ff4444'

  return `<svg class="sparkline-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${points}" opacity="0.8"/>
    <circle cx="${((values.length - 1) * step).toFixed(1)}" cy="${(h - ((lastVal - min) / range) * (h - 4) - 2).toFixed(1)}" r="2.5" fill="${color}"/>
  </svg>`
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function updateStats() {
  const total = models.length
  const online = models.filter(m => m.status === 'up').length
  const onlineWithPing = models.filter(m => m.status === 'up' && m.avg !== Infinity && m.avg < 99000)
  const avgLatency = onlineWithPing.length > 0
    ? Math.round(onlineWithPing.reduce((s, m) => s + m.avg, 0) / onlineWithPing.length)
    : null
  const fastest = onlineWithPing.sort((a, b) => a.avg - b.avg)[0]
  const providers = new Set(models.map(m => m.providerKey)).size

  $('#stat-total-value').textContent = total
  $('#stat-online-value').textContent = online
  $('#stat-avg-value').textContent = avgLatency != null ? `${avgLatency}ms` : '—'
  $('#stat-best-value').textContent = fastest ? fastest.label : '—'
  $('#stat-providers-value').textContent = providers
}

// ─── Provider Filter Dropdown ────────────────────────────────────────────────

function populateProviderFilter() {
  const providers = [...new Set(models.map(m => m.providerKey))].sort()
  const origins = {}
  models.forEach(m => { origins[m.providerKey] = m.origin })

  providerFilter.innerHTML = '<option value="all">All Providers</option>' +
    providers.map(p => `<option value="${p}">${origins[p]} (${models.filter(m => m.providerKey === p).length})</option>`).join('')
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function showDetailPanel(modelId) {
  const model = models.find(m => m.modelId === modelId)
  if (!model) return

  detailPanel.removeAttribute('hidden')
  detailTitle.textContent = model.label
  updateDetailPanel()
}

function updateDetailPanel() {
  const model = models.find(m => m.modelId === selectedModelId)
  if (!model) return

  const chartSvg = buildDetailChart(model.pingHistory)

  detailBody.innerHTML = `
    <div class="detail-stat">
      <span class="detail-stat__label">Model ID</span>
      <span class="detail-stat__value" style="font-size:11px; word-break:break-all">${escapeHtml(model.modelId)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Provider</span>
      <span class="detail-stat__value">${escapeHtml(model.origin)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Tier</span>
      <span class="detail-stat__value">${tierBadge(model.tier)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">SWE-bench Score</span>
      <span class="detail-stat__value swe-score ${sweClass(model.sweScore)}">${model.sweScore || '—'}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Context Window</span>
      <span class="detail-stat__value">${model.ctx || '—'}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Status</span>
      <span class="detail-stat__value"><span class="status-dot status-dot--${model.status}"></span>${model.status}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Latest Ping</span>
      <span class="detail-stat__value ${pingClass(model.latestPing)}">${formatPing(model.latestPing, model.latestCode)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Average Latency</span>
      <span class="detail-stat__value ${pingClass(model.avg)}">${formatAvg(model.avg)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">P95 Latency</span>
      <span class="detail-stat__value">${model.p95 != null && model.p95 !== Infinity ? model.p95 + 'ms' : '—'}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Jitter (σ)</span>
      <span class="detail-stat__value">${model.jitter != null && model.jitter !== Infinity ? model.jitter + 'ms' : '—'}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Stability Score</span>
      <span class="detail-stat__value">${stabilityCell(model.stability)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Verdict</span>
      <span class="detail-stat__value">${verdictBadge(model.verdict, model.httpCode)}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Uptime</span>
      <span class="detail-stat__value">${model.uptime > 0 ? model.uptime + '%' : '—'}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">Ping Count</span>
      <span class="detail-stat__value">${model.pingCount}</span>
    </div>
    <div class="detail-stat">
      <span class="detail-stat__label">API Key</span>
      <span class="detail-stat__value">${model.hasApiKey ? '✅ Configured' : '❌ Missing'}</span>
    </div>

    <div class="detail-chart">
      <div class="detail-chart__title">Latency Trend (last 20 pings)</div>
      ${chartSvg}
    </div>
  `
}

function buildDetailChart(history) {
  if (!history || history.length < 2) return '<div style="color:var(--color-text-dim); text-align:center; padding:20px;">Waiting for ping data...</div>'

  const valid = history.filter(p => p.code === '200' || p.code === '401')
  if (valid.length < 2) return '<div style="color:var(--color-text-dim); text-align:center; padding:20px;">Not enough data yet...</div>'

  const values = valid.map(p => p.ms)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const w = 340, h = 100
  const step = w / (values.length - 1)
  const padding = 4

  // Build gradient area
  const points = values.map((v, i) => {
    const x = padding + i * ((w - 2 * padding) / (values.length - 1))
    const y = padding + (h - 2 * padding) - ((v - min) / range) * (h - 2 * padding)
    return [x.toFixed(1), y.toFixed(1)]
  })

  const linePoints = points.map(p => p.join(',')).join(' ')
  const areaPoints = `${points[0][0]},${h - padding} ${linePoints} ${points[points.length - 1][0]},${h - padding}`

  return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block;">
    <defs>
      <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <polygon fill="url(#chart-grad)" points="${areaPoints}"/>
    <polyline fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${linePoints}"/>
    ${points.map(([x, y], i) => i === points.length - 1 ? `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--color-accent)" stroke="var(--color-bg)" stroke-width="1.5"/>` : '').join('')}
    <text x="${padding}" y="${h - 2}" font-size="9" fill="var(--color-text-dim)" font-family="var(--font-mono)">${min}ms</text>
    <text x="${w - padding}" y="${padding + 8}" font-size="9" fill="var(--color-text-dim)" font-family="var(--font-mono)" text-anchor="end">${max}ms</text>
  </svg>`
}

// ─── Settings Modal ──────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const resp = await fetch('/api/config')
    const config = await resp.json()

    settingsBody.innerHTML = Object.entries(config.providers).map(([key, p]) => {
      return `<div class="settings-provider">
        <span class="settings-provider__name">${escapeHtml(p.name)}</span>
        <span class="settings-provider__models">${p.modelCount} models</span>
        <span class="settings-provider__status ${p.hasKey ? 'settings-provider__status--configured' : 'settings-provider__status--missing'}">
          ${p.hasKey ? '✅ Configured' : '🔑 No Key'}
        </span>
      </div>`
    }).join('')
  } catch (e) {
    settingsBody.innerHTML = '<p style="color:var(--color-text-muted)">Failed to load settings</p>'
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

// Theme toggle
themeToggle.addEventListener('click', () => {
  const html = document.documentElement
  const current = html.getAttribute('data-theme')
  html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
})

// Search
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value
  renderTable()
})

// Ctrl+K shortcut
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchInput.focus()
  }
  if (e.key === 'Escape') {
    if (!settingsModal.hidden) settingsModal.hidden = true
    if (!detailPanel.hidden) { detailPanel.hidden = true; selectedModelId = null }
  }
})

// Tier filter buttons
$('#tier-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.tier-btn')
  if (!btn) return
  filterTier = btn.dataset.tier
  $$('.tier-btn').forEach(b => b.classList.remove('tier-btn--active'))
  btn.classList.add('tier-btn--active')
  renderTable()
})

// Status filter buttons
$('#status-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.status-btn')
  if (!btn) return
  filterStatus = btn.dataset.status
  $$('.status-btn').forEach(b => b.classList.remove('status-btn--active'))
  btn.classList.add('status-btn--active')
  renderTable()
})

// Provider filter dropdown
providerFilter.addEventListener('change', (e) => {
  filterProvider = e.target.value
  renderTable()
})

// Table header sorting
$('#models-table thead').addEventListener('click', (e) => {
  const th = e.target.closest('th.sortable')
  if (!th) return
  const col = th.dataset.sort
  if (sortColumn === col) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn = col
    // Default direction based on column type
    sortDirection = ['label', 'origin', 'tier', 'verdict'].includes(col) ? 'asc' : 'asc'
  }
  // Update active header visual
  $$('th.sortable').forEach(t => t.classList.remove('sort-active'))
  th.classList.add('sort-active')
  renderTable()
})

// Settings modal
settingsBtn.addEventListener('click', () => {
  settingsModal.hidden = false
  loadSettings()
})
settingsClose.addEventListener('click', () => { settingsModal.hidden = true })
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.hidden = true
})

// Detail panel close
detailClose.addEventListener('click', () => {
  detailPanel.hidden = true
  selectedModelId = null
})

// ─── Utility Functions ───────────────────────────────────────────────────────

const TIER_RANKS = { 'S+': 0, 'S': 1, 'A+': 2, 'A': 3, 'A-': 4, 'B+': 5, 'B': 6, 'C': 7 }
function tierRank(tier) { return TIER_RANKS[tier] ?? 99 }

const VERDICT_RANKS = { 'Perfect': 0, 'Normal': 1, 'Slow': 2, 'Spiky': 3, 'Very Slow': 4, 'Overloaded': 5, 'Unstable': 6, 'Not Active': 7, 'Pending': 8 }
function verdictRank(verdict) { return VERDICT_RANKS[verdict] ?? 99 }

function parseSwe(s) {
  if (!s || s === '—') return 0
  return parseFloat(s.replace('%', '')) || 0
}

function parseCtx(c) {
  if (!c || c === '—') return 0
  const s = c.toLowerCase()
  if (s.includes('m')) return parseFloat(s) * 1000
  if (s.includes('k')) return parseFloat(s)
  return 0
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Initialize ──────────────────────────────────────────────────────────────

connectSSE()
