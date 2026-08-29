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
| Data | Plain JSON file storage (see Decisions Log) | Simple, no native compile issues, fits local-first philosophy |
| Notes | Markdown files on disk (planned) | Readable/portable outside the app, matches Obsidian-style ownership |
| Repo | GitHub — `github.com/rileyheasley/anchor` | Standard version control |

## Current State

- Electron + React scaffold running successfully (`npm run dev` launches a working desktop window)
- Repo connected to GitHub, fully synced, build output properly gitignored
- First end-to-end data test complete: input → save → persist → read back, using JSON file storage
- `better-sqlite3` was tried first for structured data but caused a SIGSEGV crash on macOS (native module ABI mismatch with Electron); pivoted to JSON file storage for now

## Goal / Roadmap

1. ~~Scaffold Electron + React app~~ ✅
2. ~~Prove local data persistence works end to end~~ ✅
3. Build out real data model (projects, cards, notes) on top of the proven JSON storage layer
4. Build home page (notes + project list)
5. Build per-project kanban board with points system
6. Layer in signature interaction (motion + sound) once core functionality works
7. Revisit storage layer if/when scale demands it (candidate: `sql.js`, avoids the native-compile crash `better-sqlite3` hit)

## Open Decisions / Things to Revisit

- Whether general notes can convert into project notes, or stay separate
- Whether points and priority should be linked or fully independent stats
- Whether project due dates are set manually or derived from card due dates
- Whether future multi-device sync is ever wanted (local-first now, but data model kept clean enough not to block it later — UUIDs, `updated_at` timestamps, notes referenced not duplicated)

## Notes / Learnings

- Native modules (like `better-sqlite3`) must compile against Electron's bundled Node version, not the system Node — mismatches can cause hard crashes (SIGSEGV) rather than clean errors
- `npm install-scripts approve <pkg>` may be needed to let Electron's own postinstall script run
- Cross-platform packaging (Mac/Windows binaries) is a solved problem for later via `electron-builder`, not a concern during local dev
- `.gitignore` needs to explicitly list every build output folder (`dist`, `dist-electron`, `release`) — a default template can miss ones specific to your Electron build tool. If a large file already got committed before `.gitignore` catches it, `git rm --cached` alone isn't enough: the file stays in older commit history too. If those commits haven't been pushed yet, `git reset --mixed origin/main` cleanly undoes them (keeping your actual file changes) so you can recommit once, clean.

---
*Working title: Anchor. Living doc, update as decisions are made.*
