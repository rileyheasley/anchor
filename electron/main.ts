import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import initSqlJs, { type Database } from 'sql.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db: Database | null = null
let dbPath: string = ''

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

let win: BrowserWindow | null

async function initializeDatabase() {
  try {
    console.log('Starting database initialization...')

    if (app.isPackaged) {
      const userDataPath = app.getPath('userData')
      console.log('User data path:', userDataPath)

      if (!fs.existsSync(userDataPath)) {
        console.log('Creating user data directory...')
        fs.mkdirSync(userDataPath, { recursive: true })
      }

      dbPath = path.join(userDataPath, 'anchor.db')
    } else {
      const testDataDir = path.join(process.env.APP_ROOT, 'test-data')
      console.log('Dev mode — using test-data path:', testDataDir)

      if (!fs.existsSync(testDataDir)) {
        console.log('Creating test-data directory...')
        fs.mkdirSync(testDataDir, { recursive: true })
      }

      dbPath = path.join(testDataDir, 'anchor.db')
    }

    console.log('Database path:', dbPath)

    const SQL = await initSqlJs()

    if (fs.existsSync(dbPath)) {
      console.log('Loading existing database file...')
      const fileBuffer = fs.readFileSync(dbPath)
      db = new SQL.Database(fileBuffer)
    } else {
      console.log('Creating new database...')
      db = new SQL.Database()
    }

    db.run('PRAGMA foreign_keys = ON')
    createSchema()
    saveDatabase()

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

function saveDatabase() {
  try {
    if (!db) return
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  } catch (error) {
    console.error('Failed to save database:', error)
  }
}

function queryAll(sql: string, params?: unknown[]): Record<string, unknown>[] {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

function queryOne(sql: string, params?: unknown[]): Record<string, unknown> | null {
  const rows = queryAll(sql, params)
  return rows[0] || null
}

function execute(sql: string, params?: unknown[]) {
  if (!db) throw new Error('Database not initialized')
  db.run(sql, params)
}

function createSchema() {
  if (!db) return

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high')),
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
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`)
}

function getSetting(key: string): string | null {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key])
  return row ? (row.value as string) : null
}

function setSetting(key: string, value: string) {
  execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  saveDatabase()
}

function getVaultPath(): string | null {
  return getSetting('vault_path')
}

function noteFilePath(filename: string): string | null {
  const vault = getVaultPath()
  if (!vault) return null
  return path.join(vault, filename)
}

function purgeSoftDeleted() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // Delete notes from disk before purging DB rows
  const staleNotes = queryAll(
    'SELECT filename FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?',
    [cutoff]
  )
  for (const note of staleNotes) {
    const fp = noteFilePath(note.filename as string)
    if (fp && fs.existsSync(fp)) {
      try { fs.unlinkSync(fp) } catch { /* ignore */ }
    }
  }
  execute('DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])
  execute('DELETE FROM cards WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])
  execute('DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])
  saveDatabase()
  console.log('Purged soft-deleted items older than 30 days')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#ffffff',
      symbolColor: '#374151',
      height: 40,
    } : false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  try {
    await initializeDatabase()

    // In dev mode, default vault to test-data/ so notes work without setup
    if (!app.isPackaged && !getVaultPath()) {
      const devVault = path.join(process.env.APP_ROOT, 'test-data')
      fs.mkdirSync(path.join(devVault, 'notes'), { recursive: true })
      fs.mkdirSync(path.join(devVault, 'projects'), { recursive: true })
      setSetting('vault_path', devVault)
      console.log('Dev mode — vault set to test-data/')
    }

    purgeSoftDeleted()

    // ── Window control handlers ──

    ipcMain.handle('window:minimize', () => win?.minimize())
    ipcMain.handle('window:maximize', () => {
      if (win?.isMaximized()) win.unmaximize()
      else win?.maximize()
    })
    ipcMain.handle('window:close', () => win?.close())
    ipcMain.handle('window:isMaximized', () => win?.isMaximized() ?? false)

    // ── Settings handlers ──

    ipcMain.handle('settings:get', (_event, key: string) => getSetting(key))

    ipcMain.handle('settings:set', (_event, key: string, value: string) => {
      setSetting(key, value)
    })

    // ── Vault handlers ──

    ipcMain.handle('vault:getPath', () => getVaultPath())

    ipcMain.handle('vault:choose', async () => {
      const result = await dialog.showOpenDialog(win!, {
        title: 'Choose notes vault folder',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || !result.filePaths[0]) return null
      const vaultPath = result.filePaths[0]
      fs.mkdirSync(path.join(vaultPath, 'notes'), { recursive: true })
      fs.mkdirSync(path.join(vaultPath, 'projects'), { recursive: true })
      setSetting('vault_path', vaultPath)
      return vaultPath
    })

    // ── Notes handlers ──

    ipcMain.handle('notes:list', (_event, filter?: { project_id?: string, card_id?: string, standalone?: boolean }) => {
      if (filter?.card_id) {
        return queryAll(
          'SELECT * FROM notes WHERE card_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
          [filter.card_id]
        )
      }
      if (filter?.project_id) {
        return queryAll(
          'SELECT * FROM notes WHERE project_id = ? AND card_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC',
          [filter.project_id]
        )
      }
      if (filter?.standalone) {
        return queryAll(
          'SELECT * FROM notes WHERE project_id IS NULL AND card_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC'
        )
      }
      return queryAll('SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC')
    })

    ipcMain.handle('notes:create', async (_event, data: { title: string, project_id?: string, card_id?: string }) => {
      const vault = getVaultPath()
      if (!vault) throw new Error('No vault configured')

      let relDir = 'notes'
      if (data.card_id) {
        const card = queryOne('SELECT project_id FROM cards WHERE id = ?', [data.card_id])
        const project = card ? queryOne('SELECT name FROM projects WHERE id = ?', [card.project_id]) : null
        const projectName = (project?.name as string | null) ?? 'Unknown'
        relDir = path.join('projects', projectName.replace(/[<>:"/\\|?*]/g, '-'))
      } else if (data.project_id) {
        const project = queryOne('SELECT name FROM projects WHERE id = ?', [data.project_id])
        const projectName = (project?.name as string | null) ?? 'Unknown'
        relDir = path.join('projects', projectName.replace(/[<>:"/\\|?*]/g, '-'))
      }

      fs.mkdirSync(path.join(vault, relDir), { recursive: true })

      const safeTitle = data.title.replace(/[<>:"/\\|?*]/g, '-')
      const filename = path.join(relDir, `${safeTitle}.md`)
      const absPath = path.join(vault, filename)
      fs.writeFileSync(absPath, `# ${data.title}\n`)

      const id = crypto.randomUUID()
      execute(
        'INSERT INTO notes (id, title, filename, project_id, card_id) VALUES (?, ?, ?, ?, ?)',
        [id, data.title, filename, data.project_id ?? null, data.card_id ?? null]
      )
      saveDatabase()
      return queryOne('SELECT * FROM notes WHERE id = ?', [id])
    })

    ipcMain.handle('notes:getContent', (_event, id: string) => {
      const note = queryOne('SELECT filename FROM notes WHERE id = ?', [id])
      if (!note) return null
      const fp = noteFilePath(note.filename as string)
      if (!fp || !fs.existsSync(fp)) return null
      return fs.readFileSync(fp, 'utf-8')
    })

    ipcMain.handle('notes:saveContent', (_event, id: string, content: string) => {
      const note = queryOne('SELECT filename FROM notes WHERE id = ?', [id])
      if (!note) throw new Error('Note not found')
      const fp = noteFilePath(note.filename as string)
      if (!fp) throw new Error('No vault configured')
      fs.writeFileSync(fp, content, 'utf-8')
      execute("UPDATE notes SET updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
    })

    ipcMain.handle('notes:delete', (_event, id: string) => {
      execute("UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    // ── Recycle bin handlers ──

    ipcMain.handle('recycle:list', () => {
      const projects = queryAll("SELECT 'project' AS type, id, name AS title, deleted_at FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      const cards = queryAll("SELECT 'card' AS type, id, title, deleted_at FROM cards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      const notes = queryAll("SELECT 'note' AS type, id, title, deleted_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      return [...projects, ...cards, ...notes].sort((a, b) =>
        (b.deleted_at as string).localeCompare(a.deleted_at as string)
      )
    })

    ipcMain.handle('recycle:restore', (_event, type: string, id: string) => {
      if (type === 'project') execute('UPDATE projects SET deleted_at = NULL WHERE id = ?', [id])
      else if (type === 'card') execute('UPDATE cards SET deleted_at = NULL WHERE id = ?', [id])
      else if (type === 'note') execute('UPDATE notes SET deleted_at = NULL WHERE id = ?', [id])
      saveDatabase()
    })

    ipcMain.handle('recycle:purge', (_event, type: string, id: string) => {
      if (type === 'project') execute('DELETE FROM projects WHERE id = ?', [id])
      else if (type === 'card') execute('DELETE FROM cards WHERE id = ?', [id])
      else if (type === 'note') {
        const note = queryOne('SELECT filename FROM notes WHERE id = ?', [id])
        if (note) {
          const fp = noteFilePath(note.filename as string)
          if (fp && fs.existsSync(fp)) try { fs.unlinkSync(fp) } catch { /* ignore */ }
        }
        execute('DELETE FROM notes WHERE id = ?', [id])
      }
      saveDatabase()
    })

    // ── Archive handlers ──

    ipcMain.handle('archive:list', () => {
      return queryAll(
        `SELECT p.id, p.name, p.priority, p.due_date, p.archived, p.created_at, p.updated_at,
          COALESCE(SUM(CASE WHEN kc.is_done = 1 THEN c.points ELSE 0 END), 0) AS done_points,
          COALESCE(SUM(c.points), 0) AS total_points
        FROM projects p
        LEFT JOIN cards c ON c.project_id = p.id AND c.deleted_at IS NULL
        LEFT JOIN kanban_columns kc ON kc.id = c.column_id
        WHERE p.deleted_at IS NULL AND p.archived = 1
        GROUP BY p.id
        ORDER BY p.name COLLATE NOCASE`
      )
    })

    ipcMain.handle('archive:restore', (_event, id: string) => {
      execute("UPDATE projects SET archived = 0, updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
    })

    ipcMain.handle('projects:list', async () => {
      const projects = queryAll(`
        SELECT 
          p.id, p.name, p.priority, p.due_date, p.archived,
          p.created_at, p.updated_at,
          COALESCE(SUM(CASE WHEN kc.is_done = 1 THEN c.points ELSE 0 END), 0) AS done_points,
          COALESCE(SUM(c.points), 0) AS total_points
        FROM projects p
        LEFT JOIN cards c ON c.project_id = p.id AND c.deleted_at IS NULL
        LEFT JOIN kanban_columns kc ON kc.id = c.column_id
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
      return projects
    })

    ipcMain.handle('projects:create', async (_event, data: { name: string }) => {
      const projectId = crypto.randomUUID()
      execute('INSERT INTO projects (id, name) VALUES (?, ?)', [projectId, data.name])

      const defaultColumns = [
        { name: 'To Do', isDone: 0 },
        { name: 'In Progress', isDone: 0 },
        { name: 'Done', isDone: 1 },
      ]
      for (let i = 0; i < defaultColumns.length; i++) {
        execute(
          'INSERT INTO kanban_columns (id, project_id, name, position, is_done) VALUES (?, ?, ?, ?, ?)',
          [crypto.randomUUID(), projectId, defaultColumns[i].name, i, defaultColumns[i].isDone]
        )
      }

      saveDatabase()
      return queryOne('SELECT * FROM projects WHERE id = ?', [projectId])
    })

    ipcMain.handle('projects:update', async (_event, data: { id: string, name?: string, priority?: string, due_date?: string | null }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
      if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
      if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date) }

      if (fields.length === 0) return null

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values)
      saveDatabase()
      return queryOne('SELECT * FROM projects WHERE id = ?', [data.id])
    })

    ipcMain.handle('projects:archive', async (_event, id: string) => {
      execute("UPDATE projects SET archived = CASE WHEN archived = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    ipcMain.handle('projects:delete', async (_event, id: string) => {
      execute("UPDATE projects SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    // ── Column handlers ──

    ipcMain.handle('columns:list', async (_event, projectId: string) => {
      return queryAll(
        'SELECT * FROM kanban_columns WHERE project_id = ? ORDER BY position',
        [projectId]
      )
    })

    ipcMain.handle('columns:create', async (_event, data: { project_id: string, name: string }) => {
      const maxPos = queryOne(
        'SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_columns WHERE project_id = ?',
        [data.project_id]
      )
      const id = crypto.randomUUID()
      execute(
        'INSERT INTO kanban_columns (id, project_id, name, position) VALUES (?, ?, ?, ?)',
        [id, data.project_id, data.name, (maxPos?.max_pos as number) + 1]
      )
      saveDatabase()
      return queryOne('SELECT * FROM kanban_columns WHERE id = ?', [id])
    })

    ipcMain.handle('columns:update', async (_event, data: { id: string, name?: string, is_done?: number }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
      if (data.is_done !== undefined) { fields.push('is_done = ?'); values.push(data.is_done) }

      if (fields.length === 0) return null

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE kanban_columns SET ${fields.join(', ')} WHERE id = ?`, values)
      saveDatabase()
      return queryOne('SELECT * FROM kanban_columns WHERE id = ?', [data.id])
    })

    ipcMain.handle('columns:reorder', async (_event, data: { project_id: string, column_ids: string[] }) => {
      for (let i = 0; i < data.column_ids.length; i++) {
        execute(
          "UPDATE kanban_columns SET position = ?, updated_at = datetime('now') WHERE id = ? AND project_id = ?",
          [i, data.column_ids[i], data.project_id]
        )
      }
      saveDatabase()
    })

    ipcMain.handle('columns:delete', async (_event, id: string) => {
      execute('DELETE FROM kanban_columns WHERE id = ?', [id])
      saveDatabase()
    })

    // ── Card handlers ──

    ipcMain.handle('cards:list', async (_event, projectId: string) => {
      return queryAll(
        'SELECT * FROM cards WHERE project_id = ? AND deleted_at IS NULL ORDER BY position',
        [projectId]
      )
    })

    ipcMain.handle('cards:create', async (_event, data: { project_id: string, column_id: string, title: string, points?: number, priority?: string, due_date?: string }) => {
      const maxPos = queryOne(
        'SELECT COALESCE(MAX(position), -1) AS max_pos FROM cards WHERE column_id = ? AND deleted_at IS NULL',
        [data.column_id]
      )
      const id = crypto.randomUUID()
      execute(
        'INSERT INTO cards (id, project_id, column_id, title, points, priority, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.project_id, data.column_id, data.title, data.points ?? null, data.priority ?? 'none', data.due_date ?? null, (maxPos?.max_pos as number) + 1]
      )
      saveDatabase()
      return queryOne('SELECT * FROM cards WHERE id = ?', [id])
    })

    ipcMain.handle('cards:update', async (_event, data: { id: string, title?: string, points?: number | null, priority?: string, due_date?: string | null }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
      if (data.points !== undefined) { fields.push('points = ?'); values.push(data.points) }
      if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
      if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date) }

      if (fields.length === 0) return null

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE cards SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values)
      saveDatabase()
      return queryOne('SELECT * FROM cards WHERE id = ?', [data.id])
    })

    ipcMain.handle('cards:move', async (_event, data: { id: string, column_id: string, position: number }) => {
      // Shift cards down in the target column to make room
      execute(
        "UPDATE cards SET position = position + 1, updated_at = datetime('now') WHERE column_id = ? AND position >= ? AND deleted_at IS NULL",
        [data.column_id, data.position]
      )
      // Move the card
      execute(
        "UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        [data.column_id, data.position, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM cards WHERE id = ?', [data.id])
    })

    ipcMain.handle('cards:reorder', async (_event, data: { column_id: string, card_ids: string[] }) => {
      for (let i = 0; i < data.card_ids.length; i++) {
        execute(
          "UPDATE cards SET position = ?, updated_at = datetime('now') WHERE id = ?",
          [i, data.card_ids[i]]
        )
      }
      saveDatabase()
    })

    ipcMain.handle('cards:delete', async (_event, id: string) => {
      execute("UPDATE cards SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })
    
    createWindow()
  } catch (error) {
    console.error('App initialization failed:', error)
    process.exit(1)
  }
}).catch((error) => {
  console.error('App ready promise rejected:', error)
  process.exit(1)
})
