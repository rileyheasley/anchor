import { describe, it, expect, beforeEach } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'
import { randomUUID } from 'node:crypto'
import { createSchema, migrateSchema, listActiveProjects, listArchivedProjects } from './db'

let db: Database

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
})

function queryAll(sql: string, params?: unknown[]): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function insertProject(overrides: Partial<{
  id: string, name: string, priority: string, status: string,
  due_date: string | null, archived: number, deleted_at: string | null,
}> = {}) {
  const p = {
    id: randomUUID(),
    name: 'Untitled',
    priority: 'none',
    status: 'planning',
    due_date: null as string | null,
    archived: 0,
    deleted_at: null as string | null,
    ...overrides,
  }
  db.run(
    'INSERT INTO projects (id, name, priority, status, due_date, archived, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [p.id, p.name, p.priority, p.status, p.due_date, p.archived, p.deleted_at]
  )
  return p.id
}

function insertColumn(projectId: string, isDone: number) {
  const id = randomUUID()
  db.run(
    'INSERT INTO kanban_columns (id, project_id, name, position, is_done) VALUES (?, ?, ?, ?, ?)',
    [id, projectId, isDone ? 'Done' : 'To Do', 0, isDone]
  )
  return id
}

function insertCard(projectId: string, columnId: string, points: number | null, deletedAt: string | null = null) {
  const id = randomUUID()
  db.run(
    'INSERT INTO cards (id, project_id, column_id, title, points, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, projectId, columnId, 'Card', points, deletedAt]
  )
  return id
}

describe('createSchema', () => {
  it('creates the projects table with a status column defaulting to planning', () => {
    createSchema(db)
    const columns = queryAll('PRAGMA table_info(projects)').map((c) => c.name)
    expect(columns).toContain('status')

    const id = randomUUID()
    db.run('INSERT INTO projects (id, name) VALUES (?, ?)', [id, 'No status given'])
    const [row] = queryAll('SELECT status FROM projects WHERE id = ?', [id])
    expect(row.status).toBe('planning')
  })

  it('rejects a project with an invalid priority or status via CHECK constraints', () => {
    createSchema(db)
    expect(() =>
      db.run('INSERT INTO projects (id, name, priority) VALUES (?, ?, ?)', [randomUUID(), 'Bad', 'urgent'])
    ).toThrow()
    expect(() =>
      db.run('INSERT INTO projects (id, name, status) VALUES (?, ?, ?)', [randomUUID(), 'Bad', 'archived'])
    ).toThrow()
  })

  it('creates kanban_columns, cards, notes, and settings tables', () => {
    createSchema(db)
    const tables = queryAll("SELECT name FROM sqlite_master WHERE type='table'").map((t) => t.name)
    expect(tables).toEqual(expect.arrayContaining(['projects', 'kanban_columns', 'cards', 'notes', 'settings']))
  })
})

describe('migrateSchema', () => {
  it('adds the status column to a pre-existing projects table that lacks it', () => {
    // Simulate a database created before the status column existed.
    db.run(`CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'none',
      due_date TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    db.run('CREATE TABLE notes (id TEXT PRIMARY KEY)')
    const id = randomUUID()
    db.run('INSERT INTO projects (id, name, priority) VALUES (?, ?, ?)', [id, 'Pre-migration project', 'high'])

    migrateSchema(db)

    const columns = queryAll('PRAGMA table_info(projects)').map((c) => c.name)
    expect(columns).toContain('status')
    const [row] = queryAll('SELECT status FROM projects WHERE id = ?', [id])
    expect(row.status).toBe('planning')
  })

  it('is idempotent — running it twice does not error', () => {
    createSchema(db)
    expect(() => migrateSchema(db)).not.toThrow()
    expect(() => migrateSchema(db)).not.toThrow()
  })

  it('adds linked_project_id to a pre-existing notes table that lacks it', () => {
    db.run(`CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'planning',
      due_date TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    db.run('CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL, project_id TEXT, card_id TEXT)')

    migrateSchema(db)

    const columns = queryAll('PRAGMA table_info(notes)').map((c) => c.name)
    expect(columns).toContain('linked_project_id')
  })
})

describe('listActiveProjects', () => {
  beforeEach(() => createSchema(db))

  it('excludes archived and soft-deleted projects', () => {
    insertProject({ name: 'Active' })
    insertProject({ name: 'Archived', archived: 1 })
    insertProject({ name: 'Deleted', deleted_at: new Date().toISOString() })

    const rows = listActiveProjects(db)
    expect(rows.map((r) => r.name)).toEqual(['Active'])
  })

  it('sorts by priority (high, medium, low, none) then name', () => {
    insertProject({ name: 'Zebra', priority: 'high' })
    insertProject({ name: 'Alpha', priority: 'high' })
    insertProject({ name: 'Middle', priority: 'medium' })
    insertProject({ name: 'Bottom', priority: 'none' })

    const rows = listActiveProjects(db)
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Zebra', 'Middle', 'Bottom'])
  })

  it('computes points and task counts from non-deleted cards, points only counting in done columns', () => {
    const projectId = insertProject({ name: 'With cards' })
    const todoCol = insertColumn(projectId, 0)
    const doneCol = insertColumn(projectId, 1)
    insertCard(projectId, todoCol, 3)
    insertCard(projectId, doneCol, 5)
    insertCard(projectId, doneCol, 2)
    insertCard(projectId, todoCol, null, new Date().toISOString()) // soft-deleted, must not count

    const [row] = listActiveProjects(db)
    expect(row.total_points).toBe(10)
    expect(row.done_points).toBe(7)
    expect(row.total_cards).toBe(3)
    expect(row.done_cards).toBe(2)
  })

  it('returns zeroed totals for a project with no cards', () => {
    insertProject({ name: 'Empty' })
    const [row] = listActiveProjects(db)
    expect(row.total_points).toBe(0)
    expect(row.done_points).toBe(0)
    expect(row.total_cards).toBe(0)
    expect(row.done_cards).toBe(0)
  })
})

describe('listArchivedProjects', () => {
  beforeEach(() => createSchema(db))

  it('returns only archived, non-deleted projects, sorted by name', () => {
    insertProject({ name: 'Not archived' })
    insertProject({ name: 'Zebra archived', archived: 1 })
    insertProject({ name: 'Alpha archived', archived: 1 })
    insertProject({ name: 'Deleted archived', archived: 1, deleted_at: new Date().toISOString() })

    const rows = listArchivedProjects(db)
    expect(rows.map((r) => r.name)).toEqual(['Alpha archived', 'Zebra archived'])
  })
})
