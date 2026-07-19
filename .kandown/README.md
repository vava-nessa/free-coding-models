# Kandown

File-based kanban for this project. Zero install, zero backend, plain markdown on disk.

## Layout

```
.kandown/             # config, web UI, agent docs
├── kandown.html      # single-file web app — open this in your browser
├── kandown.json      # project preferences, columns, appearance
├── AGENT.md          # AI agent conventions
├── AGENT_KANDOWN.md  # full agent reference
└── README.md         # this file

tasks/                # source of truth — one .md file per task
├── t1.md
├── t2.md
└── archive/          # archived tasks live here
```

## Usage

1. Open `.kandown/kandown.html` in Chrome, Edge, Brave or Opera (File System Access API required)
2. Click **Select folder** and pick the **project root** (the parent of `.kandown/`), then grant read/write permission
3. That's it

The app remembers the last 10 projects you've opened — no need to re-select the folder each time.

## Settings

Open Settings from the app header to tune this project. Board columns are stored in `.kandown/kandown.json` at `board.columns`. Each task chooses a column with its frontmatter `status`.

## Editing without the app

Everything is plain markdown. Edit files directly in your IDE, Obsidian, or vim. Click **Reload** in the app (or press `R`) to see changes.

## For AI agents

See `AGENT.md` and `AGENT_KANDOWN.md`. The key convention: each task file in `tasks/` is its own source of truth. Moving a task means editing the task's frontmatter `status`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘1` / `Ctrl+1` | Board view |
| `⌘2` / `Ctrl+2` | List view |
| `N` | New task |
| `R` | Reload |
| `/` | Focus search |
| `Esc` | Close drawer / palette |
| `⌘S` | Save current task |
| `⌘⌫` | Delete task (with confirmation) |
