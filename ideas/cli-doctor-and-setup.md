# CLI Doctor and Guided Setup Ideas

## Goal

Add diagnostics and guided onboarding so users can quickly answer:

- Is my FCM install healthy?
- Are my API keys valid?
- Are my tools installed?
- Is the router running?
- Is the local endpoint usable by my coding tool?
- What should I do next?

This reduces support load and makes the project feel more professional.

## Feature 1: `free-coding-models doctor`

### Command

```bash
free-coding-models doctor
```

Possible aliases:

```bash
free-coding-models --doctor
free-coding-models check
```

### What It Checks

#### System

- Node.js version.
- Package version.
- Latest npm version.
- Operating system.
- Terminal environment.
- Package manager availability.

#### Config

- Config file exists.
- Config JSON is valid.
- Config file permissions are safe.
- Provider keys are present.
- Provider toggles are valid.
- Router config is valid.
- Favorites and router sets reference existing models.

#### API Keys

For each configured provider:

- Key exists.
- Key format looks plausible.
- Auth endpoint accepts it when available.
- A known-good model can be probed.
- Rate-limit/auth errors are classified separately.

#### Tools

Check installed tools:

- OpenCode CLI.
- OpenClaw.
- Crush.
- Goose.
- Aider.
- Kilo CLI.
- Qwen Code.
- OpenHands.
- Amp.
- Hermes.
- Continue.
- Cline.
- Pi.
- Gemini CLI.
- Rovo Dev CLI.
- Copilot CLI.
- ForgeCode.

For each tool:

- Installed or missing.
- Detected version if available.
- Config file path exists.
- FCM provider entry exists if relevant.
- Recommended install command if missing.

#### Router

- PID file exists.
- PID is alive.
- Port file exists.
- Port is listening.
- `/health` responds.
- `/v1/models` responds.
- Active set exists.
- At least one model in active set is usable.
- Log path exists.
- Last errors from daemon log.

#### Web UI

- Dashboard build exists.
- Static assets are present.
- Dashboard health endpoint works.
- SSE endpoint works.
- Browser URL is printed.

### Output Style

Use a clear summary first:

```text
FCM Doctor

Status: 3 issues found

✅ Node.js 24.0.0 supported
✅ Config file valid
✅ Groq key valid
⚠️ NVIDIA key missing
❌ Router daemon not running
✅ OpenCode installed
⚠️ Crush not installed
```

Then show fixes:

```text
Recommended fixes:

1. Start the router:
   free-coding-models --daemon-bg

2. Add an NVIDIA key:
   free-coding-models
   Press P → NVIDIA NIM → Add key

3. Install Crush:
   npm install -g @charmland/crush
```

### Exit Codes

Useful for CI and scripts:

- `0`: healthy.
- `1`: warnings only.
- `2`: blocking errors.
- `3`: internal doctor failure.

### JSON Output

```bash
free-coding-models doctor --json
```

Useful for debugging and issue reports.

Recommended payload:

```json
{
  "status": "warning",
  "version": "0.3.78",
  "checks": [
    {
      "id": "router.running",
      "status": "error",
      "message": "Router daemon is not running",
      "fix": "Run free-coding-models --daemon-bg"
    }
  ]
}
```

## Feature 2: Guided First-Run Setup

### Goal

Replace a generic API-key prompt with a guided setup that understands the user’s intent.

### Suggested Flow

```text
What do you want to do?

1. Use one best model directly in my coding tool
2. Use the Smart Router local endpoint with failover
3. Only benchmark free models
4. I am not sure, recommend the best setup
```

Then:

```text
Which coding tool do you use?

1. OpenCode
2. Crush
3. Continue
4. Cline
5. Aider
6. Other OpenAI-compatible tool
```

Then:

```text
Which providers do you already have keys for?

[ ] Groq
[ ] NVIDIA NIM
[ ] OpenRouter
[ ] Google AI Studio
[ ] Cerebras
[ ] GitHub Models
```

Then FCM can recommend:

- Direct tool config.
- Router setup.
- Providers to add first.
- No-credit-card provider choices.

### Recommended Default

For most users:

```text
Recommended setup:

Start the Smart Router and point your tool at one local endpoint.
FCM will automatically fail over between your configured free providers.
```

Then show:

```text
Base URL: http://localhost:19280/v1
Model: fcm
API key: fcm-local
```

### Provider Recommendations

Add simple beginner recommendations:

- “Best first key: Groq” for easy setup and speed.
- “Best broad catalog: NVIDIA NIM”.
- “Best fallback catalog: OpenRouter”.
- “Best high-speed provider: Cerebras”.
- “Best Google models: Google AI Studio”.

Make sure the recommendations stay honest and mention free-tier caveats.

## Feature 3: Issue Report Bundle

Add:

```bash
free-coding-models doctor --report
```

This should generate a sanitized report users can paste into GitHub issues.

Must not include:

- API keys.
- Prompts.
- Local source code.
- Private file paths unless necessary.

Should include:

- OS.
- Node version.
- FCM version.
- Config shape with masked keys.
- Provider enabled/disabled status.
- Router health.
- Tool install status.
- Last relevant daemon errors with secrets stripped.

## Feature 4: Auto-Fix Mode

Optional advanced command:

```bash
free-coding-models doctor --fix
```

Possible safe fixes:

- Repair invalid permissions on config files.
- Remove stale PID files when process is dead.
- Rebuild default router set from valid favorites.
- Recreate missing dashboard dist assets if running from repo.
- Clean obsolete local proxy entries if already supported by existing cleanup logic.

Avoid destructive fixes unless confirmed.

## Implementation Plan

### Phase 1 — Read-only Doctor

- Add argument parsing.
- Add system/config/router checks.
- Add human-readable output.
- Add tests for check result formatting.

### Phase 2 — Provider and Tool Checks

- Reuse existing provider key test helpers.
- Reuse tool bootstrap detection.
- Add install suggestions.

### Phase 3 — JSON and Report Output

- Add `--json`.
- Add `--report`.
- Add secret masking tests.

### Phase 4 — Guided Setup

- Add wizard flow.
- Save recommended config.
- Offer to start daemon.
- Offer to open local dashboard.

## Success Criteria

- Users can diagnose most setup failures without asking for help.
- GitHub issues include useful sanitized diagnostics.
- First-run users understand whether they should use direct mode or router mode.
- Router setup becomes copy-paste simple.
