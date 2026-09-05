// Pure DB layer: schema, migrations, and the query logic most likely to regress
// when the schema shifts. Deliberately has no dependency on `electron` (ipcMain,
// app, etc.) so it can be exercised directly in a plain Node test with sql.js —
// this app's GUI can't be launched in CI/sandboxed shells, so this is the layer
// that actually gets covered.
import type { Database } from 'sql.js'

function queryAll(db: Database, sql: string, params?: unknown[]): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function queryOne(db: Database, sql: string, params?: unknown[]): Record<string, unknown> | null {
  return queryAll(db, sql, params)[0] || null
}

export function createSchema(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'done')),
    due_date TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS kanban_columns (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    points INTEGER CHECK (points BETWEEN 1 AND 5),
    priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
    due_date TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
    linked_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS canvas_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_folder_id TEXT REFERENCES canvas_folders(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    linked_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    folder_id TEXT REFERENCES canvas_folders(id) ON DELETE SET NULL,
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
    due_date TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  migrateSchema(db)
}

export function migrateSchema(db: Database) {
  const noteColumns = queryAll(db, 'PRAGMA table_info(notes)')
  const hasPosition = noteColumns.some((col) => col.name === 'position')
  if (!hasPosition) {
    db.run('ALTER TABLE notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0')
  }
  const hasLinkedProjectId = noteColumns.some((col) => col.name === 'linked_project_id')
  if (!hasLinkedProjectId) {
    db.run('ALTER TABLE notes ADD COLUMN linked_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL')
  }

  const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table'").map((t) => t.name)
  if (!tables.includes('folders')) {
    db.run(`CREATE TABLE folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      position INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  }

  const hasFolderId = noteColumns.some((col) => col.name === 'folder_id')
  if (!hasFolderId) {
    db.run('ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL')
  }

  const projectColumns = queryAll(db, 'PRAGMA table_info(projects)')
  const hasStatus = projectColumns.some((col) => col.name === 'status')
  if (!hasStatus) {
    db.run("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'planning'")
  }
  const hasIcon = projectColumns.some((col) => col.name === 'icon')
  if (!hasIcon) {
    db.run('ALTER TABLE projects ADD COLUMN icon TEXT')
  }

  const cardColumns = queryAll(db, 'PRAGMA table_info(cards)')
  const hasNoteFilename = cardColumns.some((col) => col.name === 'note_filename')
  if (hasNoteFilename) {
    // Dead column: card notes are resolved via notes.card_id, this was never read or written.
    db.run('ALTER TABLE cards DROP COLUMN note_filename')
  }
}

const PROJECT_LIST_COLUMNS = `
  p.id, p.name, p.icon, p.priority, p.status, p.due_date, p.archived,
  p.created_at, p.updated_at,
  COALESCE(SUM(CASE WHEN kc.is_done = 1 THEN c.points ELSE 0 END), 0) AS done_points,
  COALESCE(SUM(c.points), 0) AS total_points,
  COUNT(c.id) AS total_cards,
  COALESCE(SUM(CASE WHEN kc.is_done = 1 THEN 1 ELSE 0 END), 0) AS done_cards
`

const PROJECT_LIST_JOIN = `
  FROM projects p
  LEFT JOIN cards c ON c.project_id = p.id AND c.deleted_at IS NULL
  LEFT JOIN kanban_columns kc ON kc.id = c.column_id
`

// Mirrors the `projects:list` IPC handler's query, sorted by priority then name.
export function listActiveProjects(db: Database): Record<string, unknown>[] {
  return queryAll(db, `
    SELECT ${PROJECT_LIST_COLUMNS}
    ${PROJECT_LIST_JOIN}
    WHERE p.deleted_at IS NULL AND p.archived = 0
    GROUP BY p.id
    ORDER BY
      CASE p.priority
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low' THEN 2
        WHEN 'none' THEN 3
      END,
      p.name COLLATE NOCASE
  `)
}

// Mirrors the `archive:list` IPC handler's query, sorted alphabetically.
export function listArchivedProjects(db: Database): Record<string, unknown>[] {
  return queryAll(db, `
    SELECT ${PROJECT_LIST_COLUMNS}
    ${PROJECT_LIST_JOIN}
    WHERE p.deleted_at IS NULL AND p.archived = 1
    GROUP BY p.id
    ORDER BY p.name COLLATE NOCASE
  `)
}

// A note's "owning" project is whichever of these is set: its own project_id, the project of
// the card it belongs to, or the project it's linked into. Shared by `search:query` and
// `overview:get` (recentNotes), which both need to resolve a note back to a project to display it.
export const NOTE_PROJECT_JOIN = `
  LEFT JOIN projects p ON p.id = n.project_id
  LEFT JOIN cards c2 ON c2.id = n.card_id
  LEFT JOIN projects cp ON cp.id = c2.project_id
  LEFT JOIN projects lp ON lp.id = n.linked_project_id
`

export const NOTE_PROJECT_COLUMNS = `
  COALESCE(n.project_id, cp.id, lp.id) AS resolved_project_id,
  COALESCE(p.name, cp.name, lp.name) AS project_name
`

// A canvas's "owning" project is whichever of these is set: its own project_id or the project
// it's linked into. Canvas equivalent of NOTE_PROJECT_JOIN/NOTE_PROJECT_COLUMNS, minus the
// card_id branch since canvases don't attach to kanban cards.
export const CANVAS_PROJECT_JOIN = `
  LEFT JOIN projects p ON p.id = c.project_id
  LEFT JOIN projects lp ON lp.id = c.linked_project_id
`

export const CANVAS_PROJECT_COLUMNS = `
  COALESCE(c.project_id, lp.id) AS resolved_project_id,
  COALESCE(p.name, lp.name) AS project_name
`

// Collects a folder's own id together with every descendant folder id (recursive, non-deleted
// only). Used by `folders:delete` to cascade a delete down the whole subtree.
export function collectFolderSubtreeIds(db: Database, folderId: string): string[] {
  const ids = [folderId]
  for (let i = 0; i < ids.length; i++) {
    const children = queryAll(db, 'SELECT id FROM folders WHERE parent_folder_id = ? AND deleted_at IS NULL', [ids[i]])
    for (const child of children) ids.push(child.id as string)
  }
  return ids
}

// True if moving `folderId` under `targetParentId` would create a cycle — i.e. targetParentId
// is folderId itself or one of folderId's own descendants. Used by `folders:move` to refuse
// drops that would nest a folder inside itself.
export function wouldCreateFolderCycle(db: Database, folderId: string, targetParentId: string | null): boolean {
  let cursor: string | null = targetParentId
  while (cursor != null) {
    if (cursor === folderId) return true
    const parent = queryOne(db, 'SELECT parent_folder_id FROM folders WHERE id = ?', [cursor])
    cursor = (parent?.parent_folder_id as string | null) ?? null
  }
  return false
}

// Canvas-folder equivalents of collectFolderSubtreeIds / wouldCreateFolderCycle above.
export function collectCanvasFolderSubtreeIds(db: Database, folderId: string): string[] {
  const ids = [folderId]
  for (let i = 0; i < ids.length; i++) {
    const children = queryAll(db, 'SELECT id FROM canvas_folders WHERE parent_folder_id = ? AND deleted_at IS NULL', [ids[i]])
    for (const child of children) ids.push(child.id as string)
  }
  return ids
}

export function wouldCreateCanvasFolderCycle(db: Database, folderId: string, targetParentId: string | null): boolean {
  let cursor: string | null = targetParentId
  while (cursor != null) {
    if (cursor === folderId) return true
    const parent = queryOne(db, 'SELECT parent_folder_id FROM canvas_folders WHERE id = ?', [cursor])
    cursor = (parent?.parent_folder_id as string | null) ?? null
  }
  return false
}
