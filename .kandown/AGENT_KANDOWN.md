# Kandown — AI Agent Rules

## The System

Kandown is a file-based Kanban backed by plain markdown. All task state lives in `tasks/*.md` at the project root — no separate board index, no database.

```
.kandown/             # config, web UI, agent docs
├── kandown.json      # Board columns + project settings
├── kandown.html      # Web UI (single-file bundle)
├── AGENT.md          # AI-agent conventions
└── AGENT_KANDOWN.md  # (this file) full reference

tasks/                # source of truth — one .md per task
├── t1.md
├── t2.md
└── archive/          # archived tasks (.md files moved here)
    └── t99.md
```

**Board columns** are configured in `kandown.json` at `board.columns`. Tasks without a `status` go to **Backlog**.

---

## Critical: Real-Time Task Updates

⚠️ **ALWAYS keep task files up to date as you work.** This is not optional — it lets the user see exactly what you're doing, what was decided, and what's left.

When you make progress:
1. Check off completed subtasks: `- [ ]` → `- [x]`
2. Add a `report:` under each done subtask with what changed
3. Move the task to the appropriate column by updating `status:` in frontmatter
4. Write a completion `report:` in frontmatter when the task is done

---

## Task Lifecycle

### Start working on a task
Update the task frontmatter: `status: In Progress`

### While working — UPDATE THE TASK FILE AS YOU GO

**This is the most important rule.** Every time you make progress — writing code, making a decision, discovering something — update the task file immediately. Do not wait until the task is done.

For each subtask you complete:
1. Check it off: `- [ ]` → `- [x]`
2. Add a `report:` line under it with what changed

Example subtask with report:
```markdown
- [x] Set up project structure
  report: Created src/, dist/, and bin/. Initialized package.json with dependencies.
- [ ] Add authentication
```

If there are no subtasks yet, add them as you discover what needs to be done. The task file is your real-time work log — the user should be able to open it and see exactly where things stand.

**Never** wait until the end to update the task. If you finish a session without updating, you're leaving the user in the dark.

### Complete a task

When the task is done:
1. Set `status: Done` in the frontmatter
2. Write a completion `report:` in the frontmatter summarizing:
   - **Changes**: What was created/modified/deleted
   - **Decisions**: Why you chose a particular approach
   - **Files**: List of affected files (especially new ones)

```yaml
---
status: Done
report: |
  ## Changes
  - Created src/auth.ts with JWT validation
  - Added /api/auth/login endpoint
  ## Decisions
  - Used RS256 for better key rotation support
  ## Files
  - src/auth.ts (new)
  - src/routes.ts (modified)
---
```

The `report:` field supports markdown and is displayed prominently in the UI. Write it as a real summary, not a placeholder.

---

## Mutation Rules

| Action | File to edit |
|--------|-------------|
| Move task between columns | Task file: update `status:` in frontmatter |
| Reorder task | Task file: update `order:` in frontmatter |
| Change title/priority/tags/assignee | Task file frontmatter |
| Edit description/notes/subtasks | Task file body only |
| Create task | Create one new `tasks/t-NNN.md` |
| Delete task | Delete the task file |
| Create/rename/delete columns | `.kandown/kandown.json` at `board.columns` |

**One task file = one source of truth.** Never maintain a separate board index.

---

## Task File Format

```markdown
---
id: t1
title: Task title
status: Backlog
order: 0
priority: P1
tags: [backend]
assignee: username
created: 2026-04-10
ownerType: human
---

# Task title

## Context

Why this exists, background, links.

## Subtasks

- [ ] First step
- [x] Second step
  report: What changed.

## Notes

Edge cases, gotchas.
```

### Frontmatter fields

| Field | Description |
|-------|-------------|
| `status` | Board column (Backlog, Todo, In Progress, Review, Done) |
| `order` | Sort order within the column |
| `priority` | P1–P4 |
| `tags` | Free-form labels |
| `assignee` | Username or AI agent name |
| `ownerType` | `human` or `ai` |
| `report` | Completion summary (markdown, shown in UI) |
| `depends_on` | Task ids this one is blocked by. Moving to the terminal column (last `board.columns` entry) is rejected while any dependency is unresolved. Archived / terminal / unknown ids do not block. |

---

## Stack

React, Motion, Tailwind, Vite, Zustand, TypeScript, Node.js ESM CLI.
