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

export function createSchema(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
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
    note_filename TEXT,
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
    position INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
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

  const projectColumns = queryAll(db, 'PRAGMA table_info(projects)')
  const hasStatus = projectColumns.some((col) => col.name === 'status')
  if (!hasStatus) {
    db.run("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'planning'")
  }
}

const PROJECT_LIST_COLUMNS = `
  p.id, p.name, p.priority, p.status, p.due_date, p.archived,
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
