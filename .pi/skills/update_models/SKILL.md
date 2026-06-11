---
name: update_models
description: Audit AI model providers in sources.js against live provider APIs. Detects deprecated, new, and config-changed models. Uses lightweight audit state, JSON-based researcher output, and streamlined diff application. Trigger with /skill:update_models or when user says "update models", "audit models", "check models", "verify providers", "bump models".
---

# Update Models — Provider Audit Skill v2

Audits model providers using a lightweight state file + structured JSON diffs. No report files, no archives — git history is the source of truth.

## Architecture

| File | Purpose |
|------|---------|
| `sources.js` | All model definitions per provider — the only file that matters |
| `audit_state.json` | Per-provider audit timestamps + model ID fingerprints (skip unchanged) |
| `changelog/vX.Y.Z.md` | Per-version changelog (still maintained, but audit data lives in git commits |

## Core Principle

**Git IS the archive.** Every `sources.js` change is already committed with a descriptive message. The `provider_updates/` folder and per-version report archives are dead weight — git log already shows what changed and when.

---

## Workflow

### Phase 1: Load State & Plan

```bash
# Read audit state
cat audit_state.json 2>/dev/null || echo '{}'

# Count models per provider in sources.js
node -e "
import {sources} from './sources.js';
for (const [k, v] of Object.entries(sources)) {
  const count = v.models?.length || 0;
  const last = JSON.parse(require('fs').readFileSync('audit_state.json','utf8')||'{}')[k]?.lastAudited||'never';
  console.log(k + '|' + count + '|' + last);
}
"
```

Present a compact table:

```
| # | Provider | Models | Last Audited | Status |
|---|----------|--------|-------------|--------|
| 1 | nvidia   | 26     | 2026-05-26  | ✅ OK  |
| 2 | groq     | 8      | never       | 🔍 Stale |

**Note:** Providers will be audited sequentially (one at a time) to reduce system load.
```

Ask: **"Select providers to audit:\n- all: all providers\n- stale: only stale (never or >30 days)\n- specific: comma-separated keys (e.g., groq,nvidia,openrouter)\nYour choice:"**

---

### Phase 2: Spawn Researchers (Sequential, JSON)

Process providers **one at a time** to avoid overwhelming the system. Each researcher gets the provider's current model list + outputs a structured JSON diff.

For each selected provider in sequence:
1. Spawn a researcher subagent
2. Wait for completion
3. Display a brief summary
4. Proceed to next provider

This prevents resource exhaustion and makes debugging easier.

#### Researcher Prompt Template

```
You are auditing the {PROVIDER_NAME} provider for the free-coding-models npm package.

## Current models in sources.js for {PROVIDER_NAME}:
{PASTE_MODEL_ARRAY_FROM_SOURCES_JS}

## Your task:
1. Search the web for the CURRENT {PROVIDER_NAME} model catalog — official docs, API pages, recent announcements.
2. For EACH model listed above, check if it still exists and what the current config is.
3. Identify any NEW models available that are NOT in the list.
4. Identify any config changes (context window, model ID, score).

## Output format:
Return a JSON object ONLY. No markdown, no explanation outside the JSON.

{
  "provider": "{PROVIDER_KEY}",
  "verificationDate": "{YYYY-MM-DD}",
  "source": "{OFFICIAL_DOCS_URL}",
  "removed": [
    {"modelId": "...", "label": "...", "reason": "...", "replacement": "..."}
  ],
  "added": [
    {"modelId": "...", "label": "...", "tier": "...", "ctx": "...", "sweScore": "-", "url": "..."}
  ],
  "fixed": [
    {"modelId": "...", "field": "ctx|sweScore|id", "oldValue": "...", "newValue": "..."}
  ],
  "confirmed": ["modelId1", "modelId2", ...],
  "summary": {"removed": N, "added": N, "fixed": N, "confirmed": N},
  "keyFinding": "One sentence summary of most important change"
}
```

Only include models in `removed`/`added`/`fixed`/`confirmed` — do not list every model.

#### Provider Reference Table (for building prompts)

| Key | Name | Docs URL |
|-----|------|----------|
| `nvidia` | NVIDIA NIM | https://build.nvidia.com |
| `groq` | Groq | https://console.groq.com/docs/models |
| `cerebras` | Cerebras | https://inference-docs.cerebras.ai |
| `sambanova` | SambaNova | https://docs.sambanova.ai |
| `openrouter` | OpenRouter | https://openrouter.ai/api/v1/models |
| `github-models` | GitHub Models | https://models.github.ai/catalog/models |
| `mistral` | Mistral LP | https://docs.mistral.ai |
| `codestral` | Codestral | https://codestral.mistral.ai |
| `scaleway` | Scaleway | https://www.scaleway.com/en/docs/ |
| `googleai` | Google AI Studio | https://ai.google.dev |
| `zai` | Z.ai | https://docs.z.ai |
| `qwen` | Alibaba DashScope | https://help.aliyun.com/zh/model-studio/ |
| `cloudflare` | Cloudflare Workers AI | https://developers.cloudflare.com/workers-ai/models/ |
| `ovhcloud` | OVHcloud AI | https://endpoints.ai.cloud.ovh.net |
| `opencode-zen` | OpenCode Zen | https://opencode.ai/docs/zen/ |

---

### Phase 3: Parse Diffs & Consolidate Table

After all researchers return, parse the JSON responses and build one consolidated table:

```
| Provider | 🔴 Remove | ➕ Add | ⚠️ Fix | Net | Key Finding |
|----------|-----------|--------|---------|-----|-------------|
| cerebras | 2 | 0 | 2 | -2 | Deprecation May 27 |
| groq     | 0 | 0 | 4 | 0  | Context corrections |
| nvidia   | 1 | 0 | 3 | -1 | Deprecated model removed |
| ...      |   |   |   |    | |
```

Apply `googleai` audit diffs directly to sources.js — no clone needed.

**Gemini CLI was removed** as a separate tool integration; only `googleai` (Google AI Studio / Gemini API) remains in the active free catalog.

Ask: **"Apply changes to sources.js? (Yes / Review diffs / Select providers)"**

---

### Phase 4: Apply Diffs to sources.js

For each approved provider:

1. Read the provider's diff from the parsed JSON
2. Apply removals first — mark removed models with `// Removed (YYYY-MM-DD): {model_id} ({reason})`
3. Apply fixes (ctx, score, ID changes)
4. Insert new models at correct tier position
5. Keep tier comments and structure intact — no file restructuring

**Editing rules:**
- Use `edit` tool with exact `oldText`/`newText` matching
- Never restructure `sources.js` — only swap lines in-place
- Keep all existing comments and tier separators

After all edits:
```bash
node -e "
import {sources, MODELS} from './sources.js';
let total = 0;
for (const [k, v] of Object.entries(sources)) {
  const n = v.models?.length || 0;
  total += n;
  console.log(k + ': ' + n + ' models');
}
console.log('Total: ' + total + ' models');
"
```

Run tests:
```bash
pnpm test
```

---

### Phase 5: Update Audit State & Commit

**Update `audit_state.json`:**

```bash
# Get current state or create empty
STATE=$(cat audit_state.json 2>/dev/null || echo '{}')
# Update each audited provider's lastAudited + fingerprint
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('audit_state.json','utf8')||'{}');
const diffs = JSON.parse(process.argv[1]); // passed as CLI arg
for (const d of diffs) {
  if (!state[d.provider]) state[d.provider] = {};
  state[d.provider].lastAudited = new Date().toISOString().split('T')[0];
  state[d.provider].fingerprint = require('crypto')
    .createHash('md5')
    .update(d.confirmed.join(',') + d.added.map(a=>a.modelId).join(','))
    .digest('hex');
}
fs.writeFileSync('audit_state.json', JSON.stringify(state, null, 2));
" '[{...diffs...}]'
```

**Commit message format:**
```
0.X.Y - audit: groq(-1), nvidia(+2), cerebras(fix:3)

- groq: removed llama-3.1-8b-instant (deprecated)
- nvidia: added minimax-m2.7, qwen3-coder-480b; fixed ctx on 3 models
- cerebras: fixed ctx on all 2 models
```

**Push and verify:**
```bash
git push origin main
# Poll npm for publication (5 min timeout)
for i in $(seq 1 30); do
  sleep 10
  v=$(npm view free-coding-models version 2>/dev/null)
  echo "Attempt $i: npm version = $v"
  if [ "$v" = "NEW_VERSION" ]; then echo "✅ published!"; break; fi
done
# Verify global install
npm install -g free-coding-models@NEW_VERSION
free-coding-models --help | head -5
```

---

## Audit State File Format

`audit_state.json` structure:

```json
{
  "nvidia": {
    "lastAudited": "2026-05-26",
    "fingerprint": "a3f5c8d..."
  },
  "groq": {
    "lastAudited": "2026-05-31",
    "fingerprint": "b7e2f9a..."
  },
  "_meta": {
    "totalModels": 157,
    "lastFullAudit": "2026-05-31"
  }
}
```

**Fingerprint logic:** MD5 hash of `confirmed.sort().join(',') + added.map(a=>a.modelId).join(',')`. If fingerprint unchanged since last audit, skip the provider (already up-to-date).

---

## Special Cases

### OpenCode Zen models are ephemeral

Zen free tier promotions come and go fast. Don't over-engineer tracking — just audit when user asks. The fingerprint will catch real changes.

### Deprecated but not removed

If a model is marked deprecated but still functional (e.g., `gemini-2.5-pro` with Oct 2026 shutdown), mark it in sources.js with a comment:
```js
// ⚠️ DEPRECATED — shutdown YYYY-MM-DD
['gemini-2.5-pro', 'Gemini 2.5 Pro', 'S+', '63.2%', '1M'],
```

Don't remove it — it still works until the shutdown date.

---

## Error Handling

- **Researcher returns invalid JSON:** Re-spawn with a retry message, or manually parse the partial output
- **edit fails (text mismatch):** Re-read sources.js to get exact current text, then retry
- **pnpm test fails:** Revert the problematic change, report to user, skip commit
- **npm publish times out:** Check GitHub Actions logs, retry publish, or skip bump

---

## What Changed from v1

| Old (v1) | New (v2) |
|----------|----------|
| Phase 1-6 with user confirmation gates | Compact 5-phase workflow |
| Per-provider markdown reports in `provider_updates/` | JSON diffs parsed directly from researcher output |
| Archived reports in `provider_updates/archive/vX.Y.Z/` | Git history IS the archive |
| No state tracking — always audits everything | `audit_state.json` + fingerprints skip unchanged providers |
| `gemini` and `googleai` audited separately | Only `googleai` remains; `gemini` clone removed |
| Verbose markdown tables in reports | Minimal JSON diffs |
| Manual file writing from researcher output | Researchers return JSON, agent parses and applies |