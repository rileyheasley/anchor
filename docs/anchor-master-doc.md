# Anchor — Master Doc

## Purpose

A personal project management app, built because existing tools (Notion, Obsidian) never *felt* good to use, and nothing made Riley want to come back to them daily. The goal isn't more features, it's an app with genuine tactile polish, smooth animation, satisfying sound, so daily use feels rewarding rather than functional-but-flat.

## Philosophy

- **Local-first, Obsidian-style.** No forced cloud account, no big hosted backend. Data lives on the user's own machine.
- **MVP over feature parity.** Not trying to rebuild Notion. Scoped tightly to Riley's actual daily needs first.
- **Feel is the differentiator.** Most productivity tools are built by engineers optimising for function. Anchor leads with interaction and motion design as the core value, not a nice-to-have layered on top.

## Core Concept

A personal (not team) project manager:

- **Home page** — general notes + a list of projects (name, progress bar, due date countdown), sorted by highest priority first then A–Z. Clicking a project opens its kanban board.
- **Per-project kanban board** — default columns: To Do / In Progress / Done (user can rename, add, remove). Cards show title + metadata; clicking a card opens its backing note.
- **Cards** — each card is a title + metadata (points, priority, due date, status) backed by a markdown note file. Every card auto-creates its `.md` file on creation. Cards are manually ordered within columns via drag-and-drop, with sort options (priority, due date, points, alphabetical, date created).
- **Notes** — markdown files on disk in a user-chosen vault folder. A note can be standalone (general) or linked to a project — linking makes it appear in both places without moving it.
- **Signature interaction** — smooth animation on even small details (checking things off, moving cards), paired with subtle sound effects. Moving a card to Done is a "completion moment" with a dedicated animation/sound.

## Data Model

### IDs & Timestamps

All entities use UUIDs. All entities have `created_at` and `updated_at` timestamps.

### Projects

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | text | |
| priority | enum | None / Low / Medium / High |
| due_date | date | Manually set |
| archived | boolean | Archived projects hidden from home, still accessible |
| deleted_at | timestamp | Soft delete — auto-purged after 30 days |

Progress bar on home page = sum of points on done cards ÷ total points in project.

### Kanban Columns

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | UUID | FK → projects |
| name | text | |
| position | integer | Display order |

Default set created with each new project: To Do, In Progress, Done. User can rename, add, remove.

### Cards

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | UUID | FK → projects |
| column_id | UUID | FK → kanban_columns |
| title | text | |
| points | integer | 1–5, effort estimate |
| priority | enum | None / Low / Medium / High |
| due_date | date | Optional |
| position | integer | Manual order within column |
| note_filename | text | Path to backing `.md` file relative to vault |
| deleted_at | timestamp | Soft delete — 30-day auto-purge |

No WIP limits on columns.

### Notes

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | text | Display title (filename is separate) |
| filename | text | Path relative to vault root |
| project_id | UUID | FK → projects, nullable (null = standalone/general) |
| card_id | UUID | FK → cards, nullable (null = not a card-backing note) |
| deleted_at | timestamp | Soft delete — 30-day auto-purge |

Content lives in `.md` files on disk, not in the database.

### Vault Folder Structure

User chooses a vault folder on first launch. Layout:

```
vault/
  notes/                    ← general standalone notes
  projects/
    Project Name/           ← card-backing notes for that project
```

### Note–Project Linking

A standalone note can be linked to a project. Linking sets `project_id` — the note then appears in both the general notes list and under the project. It does not move the file on disk.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron | Native desktop, local file/DB access, proven for exactly this use case (Obsidian is built on it) |
| UI | React + Tailwind | High AI-assisted-coding support, fast iteration |
| Animation | Motion for React (`motion`) | Successor to Framer Motion — same spring/easing API, smaller bundle |
| Data | `sql.js` (SQLite compiled to WASM) | Real SQL without native compilation — works cross-platform, no rebuild step |
| Notes | Markdown files on disk | Readable/portable outside the app, matches Obsidian-style ownership |
| Repo | GitHub — `github.com/rileyheasley/anchor` | Standard version control |

## Current State

- Electron + React scaffold running (`npm run dev` launches a working desktop window)
- Full data layer live: schema, project/column/card CRUD, soft delete, progress calculation
- Home page built: project list, priority, progress bars, create/delete
- Kanban board built: columns, cards, points, priority, move between columns
- Motion animations and sound effects wired in (Motion for React + Web Audio API)
- Codebase cleaned: typed `Priority` union, removed raw IPC exposure, no dead files

## Goal / Roadmap

1. ~~Scaffold Electron + React app~~ ✅
2. ~~Prove local data persistence works end to end~~ ✅
3. ~~Build out real data model (projects, columns, cards, notes)~~ ✅
4. ~~Build home page (project list with priority + progress bars)~~ ✅
5. ~~Build per-project kanban board with points system~~ ✅
6. ~~Layer in signature interaction (motion + sound)~~ ✅
7. Notes system — vault folder setup, markdown files on disk, link notes to cards/projects
8. Recycle bin — view and restore soft-deleted projects/cards/notes, auto-purge after 30 days
9. Archive view — browse and unarchive projects
10. Polish home page — due date countdown, project sort, empty states
11. Polish kanban board — drag-and-drop reorder, card detail view (expand to full note)
12. App shell polish — window chrome, app icon, consistent spacing/typography
13. Production build — packaging via `electron-builder`, test on Mac + Windows

## Notes / Learnings

- **Dev-mode data path:** When running unpackaged (`!app.isPackaged`), the database writes to `test-data/anchor.db` (gitignored, auto-created) instead of `app.getPath('userData')`. Production builds use the standard `userData` path.
- **`sql.js` is in-memory:** Loaded on startup, explicitly written to disk (`db.export()` → `fs.writeFileSync`) after every mutation. No native file locking — sufficient for a single-user desktop app.
- **`sql.js` must be external in the Vite build:** Mark it in `rollupOptions.external` — otherwise Vite bundles it into ESM and its `__dirname`-based WASM loader breaks.
- **Avoid native Node modules in Electron.** `better-sqlite3` required compiling against Electron's bundled Node ABI, which caused SIGSEGV crashes across machines. `sql.js` (pure WASM) sidesteps this entirely.
- **`npm install-scripts approve <pkg>`** may be needed to let Electron's own postinstall script run.
- **Committed a large file before `.gitignore` caught it?** `git rm --cached` removes it from tracking but not from history. If the commits haven't been pushed, `git reset --mixed origin/main` undoes them cleanly (keeps working tree changes) so you can recommit once.

---
*Working title: Anchor. Living doc, update as decisions are made.*
