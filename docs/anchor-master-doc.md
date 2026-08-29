# Anchor — Master Doc

## Purpose

A personal project management app, built because existing tools (Notion, Obsidian) never *felt* good to use, and nothing made Riley want to come back to them daily. The goal isn't more features, it's an app with genuine tactile polish, smooth animation, satisfying sound, so daily use feels rewarding rather than functional-but-flat.

## Philosophy

- **Local-first, Obsidian-style.** No forced cloud account, no big hosted backend. Data lives on the user's own machine.
- **MVP over feature parity.** Not trying to rebuild Notion. Scoped tightly to Riley's actual daily needs first.
- **Feel is the differentiator.** Most productivity tools are built by engineers optimising for function. Anchor leads with interaction and motion design as the core value, not a nice-to-have layered on top.

## Core Concept

A personal (not team) project manager:

- **Home page** — general notes + a list of projects (name, progress bar, due date countdown), sorted by priority then alphabetically. Clicking a project opens its kanban board.
- **Per-project kanban board** — cards use a Jira-style effort points system (1–5, linear scale; meaning of the number, effort vs time, left open to the user).
- **Notes** — both project-level notes and general/unattached notes.
- **Signature interaction** — smooth animation on even small details (checking things off, moving cards), paired with subtle sound effects (e.g. clicks) for tactile feedback.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron | Native desktop, local file/DB access, proven for exactly this use case (Obsidian is built on it) |
| UI | React + Tailwind | High AI-assisted-coding support, fast iteration |
| Animation | Framer Motion | Built for the spring/easing-based interactions Anchor needs |
| Data | `sql.js` (SQLite compiled to WASM) | Real SQL without native compilation — works cross-platform, no rebuild step |
| Notes | Markdown files on disk (planned) | Readable/portable outside the app, matches Obsidian-style ownership |
| Repo | GitHub — `github.com/rileyheasley/anchor` | Standard version control |

## Current State

- Electron + React scaffold running (`npm run dev` launches a working desktop window)
- End-to-end data persistence working: input → save → persist to disk → reload on restart
- `sql.js` storage layer proven and stable

## Goal / Roadmap

1. ~~Scaffold Electron + React app~~ ✅
2. ~~Prove local data persistence works end to end~~ ✅
3. Build out real data model (projects, cards, notes) on top of `sql.js`
4. Build home page (notes + project list)
5. Build per-project kanban board with points system
6. Layer in signature interaction (motion + sound) once core functionality works

## Open Decisions / Things to Revisit

- Whether general notes can convert into project notes, or stay separate
- Whether points and priority should be linked or fully independent stats
- Whether project due dates are set manually or derived from card due dates
- Whether future multi-device sync is ever wanted (local-first now, but data model kept clean enough not to block it later — UUIDs, `updated_at` timestamps, notes referenced not duplicated)

## Notes / Learnings

- **Dev-mode data path:** When running unpackaged (`!app.isPackaged`), the database writes to `test-data/anchor.db` (gitignored, auto-created) instead of `app.getPath('userData')`. Production builds use the standard `userData` path.
- **`sql.js` is in-memory:** Loaded on startup, explicitly written to disk (`db.export()` → `fs.writeFileSync`) after every mutation. No native file locking — sufficient for a single-user desktop app.
- **`sql.js` must be external in the Vite build:** Mark it in `rollupOptions.external` — otherwise Vite bundles it into ESM and its `__dirname`-based WASM loader breaks.
- **Avoid native Node modules in Electron.** `better-sqlite3` required compiling against Electron's bundled Node ABI, which caused SIGSEGV crashes across machines. `sql.js` (pure WASM) sidesteps this entirely.
- **`npm install-scripts approve <pkg>`** may be needed to let Electron's own postinstall script run.
- **Committed a large file before `.gitignore` caught it?** `git rm --cached` removes it from tracking but not from history. If the commits haven't been pushed, `git reset --mixed origin/main` undoes them cleanly (keeps working tree changes) so you can recommit once.

---
*Working title: Anchor. Living doc, update as decisions are made.*
