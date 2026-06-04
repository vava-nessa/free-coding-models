# Kandown conventions for AI agents

This project uses a file-based Kandown board located in `.kandown/`. Read this file before touching task files.

## Source of truth

Tasks are the source of truth. There is no board index to maintain.

```
.kandown/
├── kandown.json      ← project settings and board columns
├── tasks/
│   ├── t1.md      ← task status, metadata, subtasks, notes, report
│   └── ...
└── kandown.html      ← local web UI
```

Columns are stored in `.kandown/kandown.json` under `board.columns`. A task belongs to a column through its frontmatter `status`.

If a task has no `status`, treat it as `Backlog`.

## Task file format

```markdown
---
id: t1
title: Full task title
status: Todo
priority: P1
tags: [backend, security]
assignee: username
created: 2026-04-10
due: 2026-04-25
ownerType: human
tools: filesystem, cli, websearch
---

# Task title

## Context

Background, links, decisions.

## Subtasks

- [ ] First step
- [ ] Second step

## Notes

Additional information.
```

Frontmatter fields:
- `status` — current board column.
- `order` — optional numeric order inside the column.
- `ownerType: human` — task is meant for a human.
- `ownerType: ai` — task is meant for an AI agent.
- `tools` — free-form tool hints, such as `filesystem, cli, websearch, browser`.

## Working on a task

1. Open the specific task file the user requested.
2. Set `status: In Progress` when you start.
3. Check off subtasks as you complete them.
4. Add a short report below completed subtasks when useful.
5. When done, add or update the completion report and set `status: Done`.

Example completion report in frontmatter:

```yaml
report: |
  ## Changes
  - Created `src/auth.ts` with JWT validation.
  - Added `/api/auth/login`.

  ## Files
  - `src/auth.ts`

  ## Decisions
  - Used RS256 for better key rotation support.
```

## Creating tasks

Create a new `tasks/<id>.md` file. Pick the next available ID by scanning filenames in `.kandown/tasks/`. Task IDs use the format `t<N>` (e.g. `t1`, `t2`, `t45`).

## Mutation rules

| Action | Files to edit |
|---|---|
| Move task between columns | Task file only: update frontmatter `status` |
| Reorder task | Task file only: update frontmatter `order` |
| Change title/priority/tags/assignee | Task file frontmatter only |
| Change ownerType/tools | Task file frontmatter only |
| Edit description/notes/subtasks/report | Task file body/frontmatter only |
| Create task | Create one file in `.kandown/tasks/` |
| Delete task | Delete its file from `.kandown/tasks/` |

## Scope control

If you notice unrelated cleanup while working, create a separate task file instead of fixing it inline. Keep the current task focused.
