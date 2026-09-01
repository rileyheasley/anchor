# Anchor — Master Doc

## Purpose

A personal project management app, built because existing tools (Notion, Obsidian) never *felt* good to use, and nothing made Riley want to come back to them daily. The goal isn't more features, it's an app with genuine tactile polish, smooth animation, satisfying sound, so daily use feels rewarding rather than functional-but-flat.

## Philosophy

- **Local-first, Obsidian-style.** No forced cloud account, no big hosted backend. Data lives on the user's own machine.
- **MVP over feature parity.** Not trying to rebuild Notion. Scoped tightly to Riley's actual daily needs first.
- **Feel is the differentiator.** Most productivity tools are built by engineers optimising for function. Anchor leads with interaction and motion design as the core value, not a nice-to-have layered on top.

## Core Concept

A personal (not team) project manager:

- **Home** — an actionable overview, not just a stats dashboard: active project count, total points, completion %, and a this-week-vs-last-week points trend up top; a **Needs Attention** list of due/overdue cards across all projects; a **Could Use a Look** nudge for on-hold or untouched (14+ day) projects; a project status breakdown bar; a standalone **to-do list** (see Data Model); "Recent Projects" and "Recent Notes" shortlists; quick-action buttons (new project, new note, search); and a recycle-bin nudge when items are pending permanent deletion.
- **Projects** — the full project list, name + status badge + priority badge + due date countdown + points progress bar + tasks-done count per project. Switchable between **list** and **grid** layouts (remembered across sessions), sortable by priority / status / due date / name, and filterable by status and/or priority via a popover (multi-select, badge shows active filter count). Clicking a project opens its kanban board.
- **Per-project kanban board** — default columns: To Do / In Progress / Done (user can rename, add, remove). Cards show title + metadata; clicking a card opens a detail panel (points, priority, column, backing note). Cards can be dragged to reorder within a column, not just moved between columns.
- **Cards** — each card is a title + metadata (points, priority, due date) backed by a markdown note file. A card's *status* is implicit — which column it sits in — not a separate field. Every card auto-creates its `.md` file on creation. Cards are manually ordered within columns via drag-and-drop.
- **Notes** — markdown files on disk in a user-chosen vault folder. A note can be standalone (general) or linked to a project — linking makes it appear in both places without moving it.
- **Canvas** — flowchart/diagram documents (React Flow: shape nodes, connectors) stored as JSON on disk, architected as a sibling of Notes — its own sidebar tab with folders, standalone or project-scoped, and the same link/unlink-into-a-project mechanic. A project's Notes and Canvases live together under one "Resources" section in the project header; its "+" button opens a small type picker (Note / Canvas) rather than creating one type directly.
- **Right-click context menus** — quick-edit affordances everywhere a menu exists: e.g. a project or card's priority (and a project's status) can be set from a hover submenu directly in the context menu, without opening the item.
- **Signature interaction** — smooth animation on even small details (checking things off, moving cards), paired with subtle sound effects. Moving a card to Done is a "completion moment" with a dedicated animation/sound.
- **Design language** — deliberately not "generic AI dashboard": no colored left-border accent bars on cards/rows (priority and status are communicated only via the tag/badge inside the item, never a side stripe). Two-typeface system: Space Grotesk for headings and every title (page/section/modal titles, project/card/column/note names), Inter for body copy, labels, and metadata.

## Data Model

### IDs & Timestamps

All entities use UUIDs. All entities have `created_at` and `updated_at` timestamps.

### Projects

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | text | |
| priority | enum | None / Low / Medium / High |
| status | enum | Planning / In Progress / On Hold / Done — default `planning` |
| due_date | date | Manually set |
| archived | boolean | Archived projects hidden from home, still accessible |
| deleted_at | timestamp | Soft delete — auto-purged after 30 days |

Progress bar = sum of points on done cards ÷ total points in project. Alongside it, a tasks indicator (`done_cards`/`total_cards`, e.g. "10/23 tasks") counts cards rather than points — both are derived at query time (`projects:list` / `archive:list`), not stored columns.

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

### Canvases

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| title | text | Display title — explicit, not derived from content (no "first line" equivalent for a graph) |
| filename | text | Path relative to vault root, `.canvas.json` extension |
| project_id | UUID | FK → projects, nullable (null = standalone) |
| linked_project_id | UUID | FK → projects, nullable — set by linking a standalone canvas into a project (mirrors note linking) |
| folder_id | UUID | FK → canvas_folders, nullable |
| position | integer | Manual order |
| deleted_at | timestamp | Soft delete — 30-day auto-purge |

Content (`{ nodes, edges, viewport }`, React Flow's own shape) lives in `.canvas.json` files on disk, not in the database — same DB-row-is-metadata/file-is-content split as Notes. No `card_id` — canvases don't attach to kanban cards (v1 scope). `canvas_folders` is a separate nestable folder table, structurally identical to `folders` (notes' own), so the two document types keep independent folder trees.

v1 node/edge feature set: rectangle / diamond / text shape nodes with 4-side handles and double-click-to-edit labels, curved or straight connectors with arrowheads, a 6-swatch color picker per node. Deferred: thumbnails/previews, content search-indexing beyond title, real-time collab, templates, freehand drawing/image embeds, export-to-image, card-level canvases.

### Todos

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| text | text | |
| priority | enum | None / Low / Medium / High |
| due_date | date | Optional |
| done | boolean | |
| position | integer | Manual order — done items sort after not-done, then by position |

A standalone checklist on the Home page — not tied to any project or card. No soft delete/recycle bin integration; deleting a to-do is permanent. Priority and due date (quick presets: today/tomorrow/in 3 days/next week/clear) are set via the item's right-click context menu, not inline controls.

### Vault Folder Structure

User chooses a vault folder on first launch. Layout:

```
vault/
  notes/                    ← general standalone notes
  canvases/                 ← general standalone canvases
  projects/
    Project Name/           ← card-backing notes and canvases for that project
```

### Note/Canvas–Project Linking

A standalone note or canvas can be linked to a project. Linking sets `linked_project_id` (notes) — the item then appears in both its own general list and under the project, without moving the file on disk. UI: the project header's "Resources" section has one link button/dropdown covering both — two labeled sub-sections ("Notes" / "Canvases", each with a type icon) listing unlinked standalone items of that type; unlinking is available via right-click on the resource card, or the "Unlink" action in its edit modal when it's a linked item.

### Search

`search:query(q)` (IPC) does a case-insensitive substring match (SQLite `LIKE`, `%`/`_`/`\` escaped) against project names, card titles, note titles, and canvas titles — titles/names only, not markdown file contents (and canvases have no content-scan fallback at all, since their body is a JSON graph, not readable text). Returns up to 8 of each, projects and cards each carry enough to navigate directly; a note or canvas carries a `resolved_project_id` (its own `project_id`, or — for notes — its parent card's project if card-scoped) so the picker can tell a standalone item (opens in the Notes/Canvas view) from a project-scoped one (opens the parent project — no deep link into the note/canvas modal itself yet).

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron | Native desktop, local file/DB access, proven for exactly this use case (Obsidian is built on it) |
| UI | React + Tailwind | High AI-assisted-coding support, fast iteration |
| Animation | Motion for React (`motion`) | Successor to Framer Motion — same spring/easing API, smaller bundle |
| Data | `sql.js` (SQLite compiled to WASM) | Real SQL without native compilation — works cross-platform, no rebuild step |
| Notes | Markdown files on disk, edited via TipTap + `tiptap-markdown` | WYSIWYG rich-text editing (Obsidian-style) while `.md` stays the on-disk source of truth |
| Canvas | `@xyflow/react` (React Flow v12), JSON graph on disk | Node-based flowchart editor scoped to diagrams (not a full Miro-style freeform whiteboard); `.canvas.json` stays the on-disk source of truth, same split as Notes |
| Styling | Tailwind v4 + single `@theme` token file (`src/theme.css`) | One master source for all color tokens — components consume semantic classes, never raw palette colors |
| Tests | Vitest, against `electron/db.ts` directly (no Electron/GUI dependency) | The GUI can't be launched in a headless/sandboxed shell; the DB layer is plain functions over `sql.js` so it's testable without one |
| Repo | GitHub — `github.com/rileyheasley/anchor` | Standard version control |

## Current State

- Frameless window with custom drag bar (`titleBarStyle: 'hidden'`); Windows uses a native titlebar overlay whose colors are synced to the app theme via IPC (`window:setTitleBarTheme`), Mac uses native traffic lights
- Two-typeface system: Space Grotesk Variable (`@fontsource-variable/space-grotesk`) for headings/titles, Inter Variable (`@fontsource-variable/inter`) for body/labels — both loaded offline, set via `--font-heading`/`--font-sans` tokens in `src/theme.css` and a `font-heading` Tailwind utility applied per-element (not blanket `h1`–`h4` styling, since several heading tags are actually small-caps labels); `user-select: none` globally, restored on inputs
- `createWindow()` has sensible defaults: 1280×800, min 960×600
- Full data layer live: schema, project/column/card CRUD, soft delete, progress calculation, project status
- Home page (overview dashboard) and Projects page (the sortable/filterable/viewable list) built as separate nav destinations
- Projects page: list/grid view toggle (persisted to `localStorage`), sort by priority/status/due date/name, filter popover (status + priority, multi-select, active-count badge), status + priority badges per project, points progress bar + tasks-done count
- Project status field (`planning`/`in_progress`/`on_hold`/`done`) — settable from the project header, from a "Create Project" picker, and via a right-click submenu on a project row
- Archive view has the same status/priority badges and tasks-done count as the Projects list (previously showed only name + progress bar)
- Kanban board built: columns, cards, points, priority, move between columns, drag-to-reorder within a column, sort cards within every column by priority/due date/points/name/date created (a "Manual" mode keeps drag-reorder; picking any other sort disables same-column drag, since it'd just be overridden)
- Right-click context menus support nested hover-submenus (`ContextMenu.tsx`'s `ContextMenuSubmenu` entry type) for quick-editing without opening the item — used for project status/priority and card priority/move-to-column
- No colored left-border/side-stripe on project or kanban cards — priority and status are shown only via the tag/badge inside the card, a deliberate anti-"generic AI dashboard" decision
- Global search (`Mod+K`, or the sidebar search icon): one popover searching project names, card titles, and note titles at once; selecting a project or card navigates straight to it (a card opens its detail panel directly — `focusCardId` prop threaded through `App.tsx` → `ProjectBoard`), a standalone note opens directly in the Notes view (`focusNoteId` prop → `NotesPage`) — see the Search section under Data Model for what it does and doesn't cover
- Notes system built: vault folder setup, standalone + project + card-scoped notes, soft delete, linking an existing standalone note to a project from the project header
- Notes editor is WYSIWYG rich-text (TipTap), not a plain textarea — headings, bold/italic, bullet/numbered/task lists, quotes, code blocks, via right-click context menu (now viewport-clamped and Escape-closeable); content still round-trips to plain `.md` on disk
- Canvas system built as a full sibling of Notes: its own sidebar tab (labeled "Canvas" in the nav, `canvases:*`/`canvasFolders:*` IPC + `canvas_folders`/`canvases` tables underneath), nestable folders, standalone or project-scoped creation, soft delete/recycle bin, and project-linking — all mirroring the Notes implementation pattern file-for-file rather than a shared abstraction (see Notes / Learnings)
- Canvas editor (`CanvasEditor.tsx`, React Flow) — rectangle/diamond/text shape nodes with double-click-to-edit labels and 4-side handles (`connectionMode="loose"` so any handle starts or receives a connection), curved/straight connector toggle with arrowheads, 6-swatch color picker applied to the current selection; autosaves via the same 1500ms-debounce pattern as the markdown editor
- Project header's Notes and Canvases sections were merged into one "Resources" section — a single combined card list plus one "+" button that opens a small type-picker dropdown (Note / Canvas) instead of two separate create buttons; the link button/dropdown stays type-aware (two labeled sub-sections) since it draws from two different standalone lists
- Global search extended to cover canvases (title-only — no content-scan fallback, since a canvas body is a JSON graph, not readable text) with their own results section and deep-link support
- Design tokens centralized in `src/theme.css` — all semantic colors (surface/border/ink/primary/accent/success/warning/danger/special) defined once via Tailwind v4 `@theme`; dark-mode badge tokens (`accent/danger/special-strong`) were WCAG-audited and fixed to meet AA contrast on their `-subtle` backgrounds; dark theme's `ink-muted`/`ink-faint` were also found and fixed swapped (faint was reading as higher-contrast than muted)
- Design assets scaffolded under `src/assets/` (`icons/`, `logos/`, `images/`) with a README on when to use these vs. top-level `public/`; app logo (`logo.svg`) is in place and wired into the title bar (theme-aware via CSS mask) and window favicon
- Custom themed scrollbar replaces the OS default everywhere: track is always fully transparent (no visible background in either state), thumb is rounded and only fades in (`border-strong`, darkening to `ink-faint` on direct hover) while its container is hovered/scrolled — a hover-reveal, overlay-like feel without relying on the deprecated `overflow: overlay`. Applied via both the WebKit scrollbar pseudo-elements and the standard `scrollbar-color`/`scrollbar-width` properties
- Motion animations and sound effects wired in (Motion for React + Web Audio API); sounds redesigned for a deep "thocky" mechanical-keyboard character (filtered noise transient + pitch-dropping lowpass tone body). Full app-wide audit pass closed the remaining gaps: every modal (card/project creation, note editor, settings, search) now enters/exits via `AnimatePresence` + spring-scale instead of popping in/out instantly; the two floating menus that had zero transition (`ContextMenu`, the markdown editor's right-click formatting menu) now animate too; drag-reorder actions that were silent (cards within a column, columns, project notes) now play `moveSound()`; the sidebar/notes-sidebar auto-collapse snap plays `clickSound()`; and effectively every "utility" button (dropdown triggers/items, toggle chips, inline icon buttons) got `whileHover`/`whileTap` feedback to match the cards, which already had it
- Home page redesigned into an actionable overview (see Core Concept) — due/stale nudges, status breakdown, points trend, recent notes, and a standalone to-do list are all computed server-side via one `overview:get` IPC query (`electron/main.ts`) rather than assembled client-side from separate calls
- Standalone to-do list on the Home page (see Data Model → Todos) — own `todos` table and IPC surface, independent of projects/cards; priority and due date are set via right-click, reusing the same `ContextMenuSubmenu` hover-flyout pattern as project/card priority menus
- Modals (note editor, project creation, settings, confirm dialogs) are consistent: all close on backdrop click, all carry `role="dialog"`/`aria-modal`, all trap Tab focus (`useFocusTrap` hook)
- Codebase cleaned: typed `Priority`/`ProjectStatus` unions, removed raw IPC exposure, no dead files
- `electron/db.ts` holds the schema, migrations, and the two project-list queries as plain functions (no `ipcMain`/`app` dependency); `electron/main.ts`'s handlers call into it. Covered by a Vitest suite (`electron/db.test.ts`) — schema/CHECK constraints, the exact status-column migration this app hit in production, and both list queries (filtering, sort order, points/task aggregation)
- A `redesign` branch exists for exploring a non-generic-AI visual treatment (surface finish: radius/border/shadow/badge shape); no direction has been finalized yet — see that branch's history for rejected explorations

## Goal / Roadmap

1. ~~Scaffold Electron + React app~~ ✅
2. ~~Prove local data persistence works end to end~~ ✅
3. ~~Build out real data model (projects, columns, cards, notes)~~ ✅
4. ~~Build home page (project list with priority + progress bars)~~ ✅
5. ~~Build per-project kanban board with points system~~ ✅
6. ~~Layer in signature interaction (motion + sound)~~ ✅
7. ~~Notes system — vault folder setup, markdown files on disk, WYSIWYG rich-text editing~~ ✅
8. ~~Recycle bin — view and restore soft-deleted projects/cards/notes, auto-purge after 30 days~~ ✅
9. ~~Archive view — browse and unarchive projects~~ ✅
10. ~~Polish home/projects page — due date countdown, project sort + filter, list/grid views, empty states~~ ✅
11. Polish kanban board — drag-and-drop reorder ✅, per-column card sort ✅, card detail view still a side panel rather than an expand-to-full-note view
12. ~~App shell polish — frameless window, drag bar, window defaults~~ ✅
13. ~~Design system pass — centralize colors into a single token file~~ ✅
14. ~~Explicit UI to link an existing standalone note to a project~~ ✅ (project header → "Link an existing note"; no unlink UI yet)
15. ~~Branding — logo asset, design asset folders, dark-mode contrast audit, themed scrollbar~~ ✅
16. ~~Sound design pass — "thocky" character, full button coverage~~ ✅
17. ~~Project statuses (Planning/In Progress/On Hold/Done) — settable, sortable, filterable~~ ✅
18. ~~Grid view for the Projects list, remembered per session~~ ✅
19. Visual redesign (`redesign` branch) — non-generic-AI surface treatment; direction still undecided
20. ~~Cross-entity search (projects/cards/notes by name/title)~~ ✅ — titles/names only, doesn't search markdown file contents
21. ~~Automated tests for the DB layer~~ ✅ (Vitest + `sql.js`, no Electron dependency) — currently schema/migration/list-query coverage only; the rest of `main.ts`'s IPC handlers (create/update/delete, notes, recycle bin, columns/cards) are still untested
22. Production build — packaging via `electron-builder`, test on Mac + Windows (still needs a platform icon — logo is currently SVG-only)
23. ~~Home page — actionable overview (needs-attention/stale-project nudges, status breakdown, points trend, recent notes, quick actions)~~ ✅
24. ~~Standalone to-do list on Home, with priority/due date via right-click~~ ✅
25. ~~Sound/animation audit pass — every modal and floating menu animates, all reorder actions have a sound, hover/tap feedback on utility buttons~~ ✅
26. ~~Canvas — flowchart/diagram documents (React Flow), full sibling of Notes: sidebar tab, folders, standalone/project-scoped, project-linking, search~~ ✅ — v1 scope only (see Data Model → Canvases for what's deferred)

## Notes / Learnings

- **Dev-mode data path:** When running unpackaged (`!app.isPackaged`), the database writes to `test-data/anchor.db` (gitignored, auto-created) instead of `app.getPath('userData')`. Production builds use the standard `userData` path.
- **`sql.js` is in-memory:** Loaded on startup, explicitly written to disk (`db.export()` → `fs.writeFileSync`) after every mutation. No native file locking — sufficient for a single-user desktop app.
- **`sql.js` must be external in the Vite build:** Mark it in `rollupOptions.external` — otherwise Vite bundles it into ESM and its `__dirname`-based WASM loader breaks.
- **Avoid native Node modules in Electron.** `better-sqlite3` required compiling against Electron's bundled Node ABI, which caused SIGSEGV crashes across machines. `sql.js` (pure WASM) sidesteps this entirely.
- **`npm install-scripts approve <pkg>`** may be needed to let Electron's own postinstall script run.
- **Committed a large file before `.gitignore` caught it?** `git rm --cached` removes it from tracking but not from history. If the commits haven't been pushed, `git reset --mixed origin/main` undoes them cleanly (keeps working tree changes) so you can recommit once.
- **Tailwind v4 preflight sets `list-style: none` on all `ul`/`ol`.** Any custom-rendered markup relying on real bullets/numbers (e.g. rich-text editor output) needs `list-style` explicitly restored in scoped CSS — otherwise list commands "work" structurally but render with no visible marker.
- **Seed/sample data must follow the same file-path convention the app's own write logic uses.** The initial seed inserted DB rows with bare filenames while runtime note creation writes to `vault/notes/…` — keep seed logic and runtime logic sharing one convention, or seeded rows silently point at the wrong path.
- **Theme is toggled via `data-theme` attribute, not a `.dark` class** — Tailwind's `dark:` variant doesn't apply here. For anything that needs to track theme (icon fills, etc.), use a CSS custom property (e.g. `currentColor`/mask against `--color-ink-*`) instead of a `dark:` prefix.
- **Electron's `titleBarOverlay` colors are static** — they don't auto-follow renderer CSS/theme changes. Update them from the main process via `win.setTitleBarOverlay()` over IPC whenever the theme toggles.
- **When auditing contrast, check "-strong" text on "-subtle" background pairs, not just text-on-surface** — that badge pattern (priority pills, type tags) is where dark-mode tokens are most likely to fail AA, since both colors are usually built independently at design time.
- **SQLite's `ALTER TABLE ADD COLUMN` can't carry a `CHECK` constraint.** The `projects.status` migration adds the column with just a `DEFAULT`; validity is only enforced by the fresh `CREATE TABLE` schema (new installs) and by the app only ever sending values from the `ProjectStatus` union. Migrated existing databases don't get the DB-level check.
- **A debounced autosave must capture the just-produced value directly, not read it back off component state.** `NoteEditModal`'s autosave scheduled `setTimeout(() => handleSave())` after `setContent(markdown)` — the timer's closure still saw the previous render's `content`, so the last keystroke(s) before the debounce fired were silently dropped. Fix: pass the value straight into the scheduled call (`() => handleSave(markdown)`).
- **An async handler that writes to shared UI state must re-check its target hasn't changed after the `await`.** E.g. creating a card's note: capture the card id up front, and compare it against a ref tracking the *currently selected* card right before applying the result — otherwise a fast card-switch mid-request can apply the wrong note to whatever's now open.
- **Hover submenus can rely on DOM containment, not JS timers.** A flyout positioned `left-full`/`right-full` off its trigger row, with zero margin/gap between them, never triggers the trigger's `mouseleave` while the pointer is over the flyout — even though the flyout is absolutely positioned outside the trigger's own box — because `mouseenter`/`mouseleave` follow the DOM tree, not layout containment. Any visual gap between trigger and flyout reintroduces the classic dead-zone flicker.
- **This dev sandbox sets `ELECTRON_RUN_AS_NODE=1`**, which makes the `electron` binary behave as plain Node (no GUI, `require('electron')` doesn't expose `BrowserWindow` etc.) — that's why `npm run dev`'s `vite-plugin-electron` spawn intermittently crashes with "does not provide an export named 'BrowserWindow'" here (it only succeeds when the plugin happens to respawn without inheriting that env var). To reliably launch the actual GUI for visual verification: build for production (`npx tsc && npx vite build`), then launch directly with the var stripped — `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe .` — which opens a real window that can be screenshotted/driven. To verify DB/query changes without a live app at all, run a standalone Node script against `sql.js` directly, pointed at a **copy** of the real `test-data/anchor.db` — exercises the actual migration path and query shapes against real data without risking the working dev database.
- **`AnimatePresence` needs its child's condition to survive the prop that nulls out alongside it.** A modal driven by `isOpen={x !== null}` / `data={x}` (same source, e.g. `NoteEditModal`) has both go false/null on the same render when closing — gate the animated child on `isOpen && data` (not `isOpen` alone) and stop reading `data` directly in the JSX below that point, or the exit animation's extra render cycle crashes/blanks on the now-null value.
- **`main.ts`'s IPC handlers aren't unit-testable as-is** — they close over a module-level `db` and the file calls `app.whenReady()` at import time, so importing it outside Electron doesn't work. The fix that actually pays off: pull the pure SQL logic (schema, migrations, query building) out into a plain module (`electron/db.ts`) with no `electron` import, have `main.ts`'s handlers call into it. That module is directly testable with Vitest + `sql.js`; `main.ts` itself still isn't, but the highest-regression-risk logic now is.
- **SQLite `LIKE` needs its wildcards escaped when the pattern comes from user input**, or a literal `%`/`_` typed into a search box behaves as a wildcard instead of a literal character. Escape `\`, `%`, `_` in the input and add `ESCAPE '\'` to the query.
- **A "jump to X" deep link across independently-loaded views needs a target-id prop plus an effect that fires once the target's list has loaded, not on mount.** E.g. search "opening" a card: `App.tsx` sets `focusCardId`, hands it to `ProjectBoard` as a prop; `ProjectBoard` doesn't know when its own async `loadBoard()` will resolve, so the effect watches `[focusCardId, cards]` and only acts once the id shows up in the loaded list, then reports back via `onFocusCardHandled` so `App.tsx` clears it. Same shape for notes in `NotesPage`, and canvases in `CanvasesPage`/`ProjectHeader`.
- **Canvas was built by duplicating the Notes pattern file-for-file (`CanvasesPage`/`CanvasesTree`/`CanvasCard` alongside `NotesPage`/`NotesTree`/`NoteCard`), not by genericizing Notes over a shared type.** The existing Notes code is hardcoded to the `Note`/`NoteFolder` shape; forcing a generic abstraction now would touch and risk-regress all of Notes for a v1 feature. Worth revisiting once both are stable — the only piece already shared is `sortByMode` (generic on `{position, created_at, updated_at}`), re-exported from `canvasTree.ts`.
- **A React Flow custom node shouldn't reach into `useReactFlow().setNodes` from inside itself when its parent already holds nodes as controlled state via `useNodesState`.** That produces two competing writers to the same graph. `CanvasEditor`'s shape nodes instead take an `onLabelChange(id, value)` callback injected into `node.data` by the parent (`nodesWithHandlers` in `CanvasEditor.tsx`) — the callback closes over the parent's own `setNodes`, so there's one writer.

---
*Working title: Anchor. Living doc, update as decisions are made.*
