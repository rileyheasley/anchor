import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import initSqlJs, { type Database } from 'sql.js'
import { ZipArchive } from 'archiver'
import {
  createSchema, listActiveProjects, listArchivedProjects, NOTE_PROJECT_JOIN, NOTE_PROJECT_COLUMNS,
  CANVAS_PROJECT_JOIN, CANVAS_PROJECT_COLUMNS,
  collectFolderSubtreeIds, wouldCreateFolderCycle,
  collectCanvasFolderSubtreeIds, wouldCreateCanvasFolderCycle,
} from './db'
import { deriveTitleFromContent } from '../src/shared/noteTitle'

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
  logError('uncaughtException', error)
  process.exit(1)
})

/**
 * Appends a timestamped line to a small log file next to the database, so a
 * beta tester's "it didn't save" has an actual trail instead of nothing.
 * dbPath isn't known yet at import time, so this falls back to console-only
 * until initializeDatabase() has set it.
 */
function logError(context: string, error: unknown) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  const line = `[${new Date().toISOString()}] ${context}: ${message}\n`
  console.error(line)
  if (!dbPath) return
  try {
    fs.appendFileSync(path.join(path.dirname(dbPath), 'anchor-errors.log'), line)
  } catch {
    // Logging must never itself crash the app.
  }
}

/** Drop-in replacement for ipcMain.handle that logs any thrown error before it reaches the renderer. */
function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await listener(event, ...args)
    } catch (error) {
      logError(`ipc:${channel}`, error)
      throw new Error(error instanceof Error ? error.message : 'Something went wrong. Check the log for details.')
    }
  })
}

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

    const isNewDatabase = !fs.existsSync(dbPath)

    if (fs.existsSync(dbPath)) {
      console.log('Loading existing database file...')
      const fileBuffer = fs.readFileSync(dbPath)
      db = new SQL.Database(fileBuffer)
    } else {
      console.log('Creating new database...')
      db = new SQL.Database()
    }

    db.run('PRAGMA foreign_keys = ON')
    createSchema(db)

    if (isNewDatabase) {
      seedSampleData()
    }

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

function seedSampleData() {
  // Create 4 sample projects
  const projects = [
    {
      id: randomUUID(),
      name: 'Website Redesign',
      priority: 'high',
      status: 'in_progress',
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    {
      id: randomUUID(),
      name: 'Mobile App',
      priority: 'medium',
      status: 'planning',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    {
      id: randomUUID(),
      name: 'API Integration',
      priority: 'medium',
      status: 'on_hold',
      due_date: null,
    },
    {
      id: randomUUID(),
      name: 'Documentation',
      priority: 'low',
      status: 'done',
      due_date: null,
    },
  ]

  projects.forEach((proj) => {
    execute(
      'INSERT INTO projects (id, name, priority, status, due_date) VALUES (?, ?, ?, ?, ?)',
      [proj.id, proj.name, proj.priority, proj.status, proj.due_date]
    )
  })

  // Create columns and cards for each project
  projects.forEach((proj) => {
    // Create default columns
    const todoCol = { id: randomUUID(), project_id: proj.id, name: 'To Do', position: 0, is_done: 0 }
    const inProgCol = { id: randomUUID(), project_id: proj.id, name: 'In Progress', position: 1, is_done: 0 }
    const doneCol = { id: randomUUID(), project_id: proj.id, name: 'Done', position: 2, is_done: 1 }

    ;[todoCol, inProgCol, doneCol].forEach((col) => {
      execute(
        'INSERT INTO kanban_columns (id, project_id, name, position, is_done) VALUES (?, ?, ?, ?, ?)',
        [col.id, col.project_id, col.name, col.position, col.is_done]
      )
    })

    // Create sample cards
    const cardConfigs = [
      { title: 'Setup project structure', col: todoCol, points: 3, priority: 'high' },
      { title: 'Design mockups', col: todoCol, points: 5, priority: 'high' },
      { title: 'Implement authentication', col: inProgCol, points: 5, priority: 'medium' },
      { title: 'Add database schema', col: inProgCol, points: 3, priority: 'medium' },
      { title: 'Write unit tests', col: doneCol, points: 4, priority: 'low' },
      { title: 'Deploy to staging', col: doneCol, points: 2, priority: 'low' },
    ]

    cardConfigs.forEach((config, i) => {
      const cardId = randomUUID()
      execute(
        'INSERT INTO cards (id, project_id, column_id, title, points, priority, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cardId, proj.id, config.col.id, config.title, config.points, config.priority, i]
      )
    })
  })

  // Create sample notes
  const noteConfigs = [
    { title: 'Project kickoff notes', filename: path.join('notes', 'kickoff.md') },
    { title: 'Design system ideas', filename: path.join('notes', 'design-system.md') },
    { title: 'Technical debt', filename: path.join('notes', 'tech-debt.md') },
  ]

  noteConfigs.forEach((note) => {
    execute(
      'INSERT INTO notes (id, title, filename) VALUES (?, ?, ?)',
      [randomUUID(), note.title, note.filename]
    )
  })

  console.log('Seeded sample data')
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

function deleteNoteFile(filename: string) {
  const fp = noteFilePath(filename)
  if (fp && fs.existsSync(fp)) {
    try { fs.unlinkSync(fp) } catch { /* ignore */ }
  }
}

// Canvas content files live in the same vault, just under a different filename extension —
// canvasFilePath/deleteCanvasFile mirror noteFilePath/deleteNoteFile exactly.
function canvasFilePath(filename: string): string | null {
  return noteFilePath(filename)
}

function deleteCanvasFile(filename: string) {
  const fp = canvasFilePath(filename)
  if (fp && fs.existsSync(fp)) {
    try { fs.unlinkSync(fp) } catch { /* ignore */ }
  }
}

// Removes notes (DB rows + files) attached to the given cards. Must run before any hard
// delete that cascades away those cards, otherwise their notes silently become orphaned
// "standalone" notes (notes.card_id is ON DELETE SET NULL, not CASCADE).
function deleteNotesForCards(cardIds: string[]) {
  if (cardIds.length === 0) return
  const placeholders = cardIds.map(() => '?').join(',')
  const notes = queryAll(`SELECT filename FROM notes WHERE card_id IN (${placeholders})`, cardIds)
  for (const note of notes) deleteNoteFile(note.filename as string)
  execute(`DELETE FROM notes WHERE card_id IN (${placeholders})`, cardIds)
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

  const staleCanvases = queryAll(
    'SELECT filename FROM canvases WHERE deleted_at IS NOT NULL AND deleted_at < ?',
    [cutoff]
  )
  for (const canvas of staleCanvases) deleteCanvasFile(canvas.filename as string)
  execute('DELETE FROM canvases WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])

  execute('DELETE FROM cards WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])
  execute('DELETE FROM projects WHERE deleted_at IS NOT NULL AND deleted_at < ?', [cutoff])
  saveDatabase()
  console.log('Purged soft-deleted items older than 30 days')
}

// Titlebar overlay colors, kept in sync with the theme tokens in src/theme.css
const TITLEBAR_OVERLAY = {
  light: { color: '#fdfcf9', symbolColor: '#3d3a30' },
  dark: { color: '#1a1a1e', symbolColor: '#c8c4b8' },
  pink: { color: '#fff5f8', symbolColor: '#4a2338' },
  nord: { color: '#2e3440', symbolColor: '#d8dee9' },
  dracula: { color: '#282a36', symbolColor: '#e2e2dc' },
  solarized: { color: '#002b36', symbolColor: '#93a1a1' },
  sepia: { color: '#f4ecd8', symbolColor: '#5c4a30' },
  forest: { color: '#f2f5ef', symbolColor: '#3d4f33' },
  ocean: { color: '#0a1e2a', symbolColor: '#b8dbe6' },
  contrast: { color: '#ffffff', symbolColor: '#000000' },
  deuteranopia: { color: '#1a1a1e', symbolColor: '#c8c4b8' },
  protanopia: { color: '#1a1a1e', symbolColor: '#c8c4b8' },
  tritanopia: { color: '#1a1a1e', symbolColor: '#c8c4b8' },
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      ...TITLEBAR_OVERLAY.light,
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
      fs.mkdirSync(path.join(devVault, 'canvases'), { recursive: true })
      fs.mkdirSync(path.join(devVault, 'projects'), { recursive: true })
      setSetting('vault_path', devVault)
      console.log('Dev mode — vault set to test-data/')
    }

    purgeSoftDeleted()

    // ── Window control handlers ──

    handle('window:minimize', () => win?.minimize())
    handle('window:maximize', () => {
      if (win?.isMaximized()) win.unmaximize()
      else win?.maximize()
    })
    handle('window:close', () => win?.close())
    handle('window:isMaximized', () => win?.isMaximized() ?? false)
    handle('window:setTitleBarTheme', (_event, theme: keyof typeof TITLEBAR_OVERLAY) => {
      if (process.platform !== 'win32') return
      win?.setTitleBarOverlay({ ...(TITLEBAR_OVERLAY[theme] ?? TITLEBAR_OVERLAY.light), height: 40 })
    })

    // ── App info handlers ──

    handle('app:getVersion', () => app.getVersion())
    handle('app:openLogFolder', async () => {
      if (!dbPath) throw new Error('Log folder not available yet')
      const logPath = path.join(path.dirname(dbPath), 'anchor-errors.log')
      if (fs.existsSync(logPath)) {
        shell.showItemInFolder(logPath)
      } else {
        await shell.openPath(path.dirname(dbPath))
      }
    })
    handle('app:exportVault', async () => {
      const vaultPath = getVaultPath()
      if (!vaultPath) throw new Error('No vault folder set up yet')

      const defaultName = `anchor-backup-${new Date().toISOString().slice(0, 10)}.zip`
      const result = await dialog.showSaveDialog(win!, {
        title: 'Export vault as zip',
        defaultPath: defaultName,
        filters: [{ name: 'Zip archive', extensions: ['zip'] }],
      })
      if (result.canceled || !result.filePath) return null

      saveDatabase()

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(result.filePath!)
        const archive = new ZipArchive({ zlib: { level: 9 } })
        output.on('close', resolve)
        output.on('error', reject)
        archive.on('error', reject)
        archive.pipe(output)
        // In dev mode the vault folder and the database live in the same
        // directory (test-data/), so the directory scan below would otherwise
        // pick up anchor.db/anchor-errors.log as vault content too.
        const excludedFromVault = new Set(['anchor.db', 'anchor-errors.log'])
        archive.directory(vaultPath, 'vault', (entry) =>
          excludedFromVault.has(path.basename(entry.name)) ? false : entry
        )
        if (dbPath && fs.existsSync(dbPath)) {
          archive.file(dbPath, { name: 'anchor.db' })
        }
        archive.finalize()
      })

      return result.filePath
    })

    // ── Settings handlers ──

    handle('settings:get', (_event, key: string) => getSetting(key))

    handle('settings:set', (_event, key: string, value: string) => {
      setSetting(key, value)
    })

    // ── Vault handlers ──

    handle('vault:getPath', () => getVaultPath())

    handle('vault:choose', async () => {
      const result = await dialog.showOpenDialog(win!, {
        title: 'Choose notes vault folder',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || !result.filePaths[0]) return null
      const vaultPath = result.filePaths[0]
      fs.mkdirSync(path.join(vaultPath, 'notes'), { recursive: true })
      fs.mkdirSync(path.join(vaultPath, 'canvases'), { recursive: true })
      fs.mkdirSync(path.join(vaultPath, 'projects'), { recursive: true })
      setSetting('vault_path', vaultPath)
      return vaultPath
    })

    // ── Notes handlers ──

    handle('notes:list', (_event, filter?: { project_id?: string, card_id?: string, standalone?: boolean }) => {
      if (filter?.card_id) {
        return queryAll(
          'SELECT * FROM notes WHERE card_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
          [filter.card_id]
        )
      }
      if (filter?.project_id) {
        return queryAll(
          `SELECT * FROM notes
           WHERE (project_id = ? OR linked_project_id = ?) AND card_id IS NULL AND deleted_at IS NULL
           ORDER BY position ASC, created_at ASC`,
          [filter.project_id, filter.project_id]
        )
      }
      if (filter?.standalone) {
        return queryAll(
          'SELECT * FROM notes WHERE project_id IS NULL AND card_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC'
        )
      }
      return queryAll('SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC')
    })

    handle('notes:create', async (_event, data: { title: string, project_id?: string, card_id?: string }) => {
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

      const id = crypto.randomUUID()
      const filename = path.join(relDir, `${id}.md`)
      const absPath = path.join(vault, filename)
      fs.writeFileSync(absPath, `# ${data.title}\n`)

      // New project notes are appended to the end of the manual stack order
      let position = 0
      if (data.project_id && !data.card_id) {
        const row = queryOne(
          'SELECT MAX(position) AS maxPos FROM notes WHERE (project_id = ? OR linked_project_id = ?) AND card_id IS NULL AND deleted_at IS NULL',
          [data.project_id, data.project_id]
        )
        position = ((row?.maxPos as number | null) ?? -1) + 1
      }

      execute(
        'INSERT INTO notes (id, title, filename, project_id, card_id, position) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.title, filename, data.project_id ?? null, data.card_id ?? null, position]
      )
      saveDatabase()
      return queryOne('SELECT * FROM notes WHERE id = ?', [id])
    })

    handle('notes:reorder', async (_event, data: { ids: string[] }) => {
      data.ids.forEach((id, index) => {
        execute('UPDATE notes SET position = ? WHERE id = ? AND deleted_at IS NULL', [index, id])
      })
      saveDatabase()
    })

    // Bulk-moves standalone notes into a folder (or to the root list, when folder_id is null).
    // Appended to the end of the target folder's manual order, same as a freshly created note.
    handle('notes:move', async (_event, data: { ids: string[], folder_id: string | null }) => {
      if (data.ids.length === 0) return
      const row = queryOne(
        'SELECT MAX(position) AS maxPos FROM notes WHERE folder_id IS ? AND project_id IS NULL AND card_id IS NULL AND deleted_at IS NULL',
        [data.folder_id]
      )
      let position = ((row?.maxPos as number | null) ?? -1) + 1
      for (const id of data.ids) {
        execute(
          `UPDATE notes SET folder_id = ?, position = ?, updated_at = datetime('now')
           WHERE id = ? AND project_id IS NULL AND card_id IS NULL AND deleted_at IS NULL`,
          [data.folder_id, position, id]
        )
        position++
      }
      saveDatabase()
    })

    handle('notes:update', async (_event, data: { id: string, title?: string, project_id?: string | null }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.title !== undefined) {
        fields.push('title = ?')
        values.push(data.title)
      }
      if (data.project_id !== undefined) {
        fields.push('project_id = ?')
        values.push(data.project_id)
      }

      if (fields.length === 0) return queryOne('SELECT * FROM notes WHERE id = ?', [data.id])

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values)
      saveDatabase()
      return queryOne('SELECT * FROM notes WHERE id = ?', [data.id])
    })

    // Links an existing standalone note into a project's Notes section without moving it —
    // the note keeps project_id/card_id NULL so it still shows up on the Notes screen.
    handle('notes:link', async (_event, data: { id: string, project_id: string }) => {
      execute(
        `UPDATE notes SET linked_project_id = ?, updated_at = datetime('now')
         WHERE id = ? AND project_id IS NULL AND card_id IS NULL AND deleted_at IS NULL`,
        [data.project_id, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM notes WHERE id = ?', [data.id])
    })

    handle('notes:unlink', async (_event, id: string) => {
      execute("UPDATE notes SET linked_project_id = NULL, updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
      return queryOne('SELECT * FROM notes WHERE id = ?', [id])
    })

    handle('notes:previewsForProject', (_event, projectId: string) => {
      const notes = queryAll(
        `SELECT n.card_id AS card_id, n.filename AS filename FROM notes n
         JOIN cards c ON c.id = n.card_id
         WHERE c.project_id = ? AND c.deleted_at IS NULL AND n.deleted_at IS NULL`,
        [projectId]
      )
      const previews: Record<string, string> = {}
      for (const note of notes) {
        const fp = noteFilePath(note.filename as string)
        if (!fp || !fs.existsSync(fp)) continue
        const content = fs.readFileSync(fp, 'utf-8').trim()
        if (content) previews[note.card_id as string] = content
      }
      return previews
    })

    handle('notes:getContent', (_event, id: string) => {
      const note = queryOne('SELECT filename FROM notes WHERE id = ?', [id])
      if (!note) return null
      const fp = noteFilePath(note.filename as string)
      if (!fp || !fs.existsSync(fp)) return null
      return fs.readFileSync(fp, 'utf-8')
    })

    handle('notes:saveContent', (_event, id: string, content: string) => {
      const note = queryOne('SELECT filename, project_id, card_id FROM notes WHERE id = ?', [id])
      if (!note) throw new Error('Note not found')
      const fp = noteFilePath(note.filename as string)
      if (!fp) throw new Error('No vault configured')
      fs.writeFileSync(fp, content, 'utf-8')
      // Standalone notes derive their title from the content; project/card notes keep their explicit title
      if (note.project_id == null && note.card_id == null) {
        execute("UPDATE notes SET title = ?, updated_at = datetime('now') WHERE id = ?", [deriveTitleFromContent(content), id])
      } else {
        execute("UPDATE notes SET updated_at = datetime('now') WHERE id = ?", [id])
      }
      saveDatabase()
    })

    handle('notes:delete', (_event, id: string) => {
      execute("UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    // ── Canvas handlers ──

    handle('canvases:list', (_event, filter?: { project_id?: string, standalone?: boolean }) => {
      if (filter?.project_id) {
        return queryAll(
          `SELECT * FROM canvases
           WHERE (project_id = ? OR linked_project_id = ?) AND deleted_at IS NULL
           ORDER BY position ASC, created_at ASC`,
          [filter.project_id, filter.project_id]
        )
      }
      if (filter?.standalone) {
        return queryAll(
          'SELECT * FROM canvases WHERE project_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC'
        )
      }
      return queryAll('SELECT * FROM canvases WHERE deleted_at IS NULL ORDER BY updated_at DESC')
    })

    handle('canvases:create', async (_event, data: { title?: string, project_id?: string }) => {
      const vault = getVaultPath()
      if (!vault) throw new Error('No vault configured')

      let relDir = 'canvases'
      if (data.project_id) {
        const project = queryOne('SELECT name FROM projects WHERE id = ?', [data.project_id])
        const projectName = (project?.name as string | null) ?? 'Unknown'
        relDir = path.join('projects', projectName.replace(/[<>:"/\\|?*]/g, '-'))
      }

      fs.mkdirSync(path.join(vault, relDir), { recursive: true })

      const id = crypto.randomUUID()
      const filename = path.join(relDir, `${id}.canvas.json`)
      const absPath = path.join(vault, filename)
      fs.writeFileSync(absPath, JSON.stringify({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }))

      // New project canvases are appended to the end of the manual stack order
      let position = 0
      if (data.project_id) {
        const row = queryOne(
          'SELECT MAX(position) AS maxPos FROM canvases WHERE (project_id = ? OR linked_project_id = ?) AND deleted_at IS NULL',
          [data.project_id, data.project_id]
        )
        position = ((row?.maxPos as number | null) ?? -1) + 1
      }

      const title = data.title ?? 'Untitled canvas'
      execute(
        'INSERT INTO canvases (id, title, filename, project_id, position) VALUES (?, ?, ?, ?, ?)',
        [id, title, filename, data.project_id ?? null, position]
      )
      saveDatabase()
      return queryOne('SELECT * FROM canvases WHERE id = ?', [id])
    })

    handle('canvases:reorder', async (_event, data: { ids: string[] }) => {
      data.ids.forEach((id, index) => {
        execute('UPDATE canvases SET position = ? WHERE id = ? AND deleted_at IS NULL', [index, id])
      })
      saveDatabase()
    })

    // Bulk-moves standalone canvases into a folder (or to the root list, when folder_id is null).
    handle('canvases:move', async (_event, data: { ids: string[], folder_id: string | null }) => {
      if (data.ids.length === 0) return
      const row = queryOne(
        'SELECT MAX(position) AS maxPos FROM canvases WHERE folder_id IS ? AND project_id IS NULL AND deleted_at IS NULL',
        [data.folder_id]
      )
      let position = ((row?.maxPos as number | null) ?? -1) + 1
      for (const id of data.ids) {
        execute(
          `UPDATE canvases SET folder_id = ?, position = ?, updated_at = datetime('now')
           WHERE id = ? AND project_id IS NULL AND deleted_at IS NULL`,
          [data.folder_id, position, id]
        )
        position++
      }
      saveDatabase()
    })

    handle('canvases:update', async (_event, data: { id: string, title?: string, project_id?: string | null }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
      if (data.project_id !== undefined) { fields.push('project_id = ?'); values.push(data.project_id) }

      if (fields.length === 0) return queryOne('SELECT * FROM canvases WHERE id = ?', [data.id])

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE canvases SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values)
      saveDatabase()
      return queryOne('SELECT * FROM canvases WHERE id = ?', [data.id])
    })

    // Links an existing standalone canvas into a project's Canvases section without moving it —
    // mirrors notes:link exactly.
    handle('canvases:link', async (_event, data: { id: string, project_id: string }) => {
      execute(
        `UPDATE canvases SET linked_project_id = ?, updated_at = datetime('now')
         WHERE id = ? AND project_id IS NULL AND deleted_at IS NULL`,
        [data.project_id, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM canvases WHERE id = ?', [data.id])
    })

    handle('canvases:unlink', async (_event, id: string) => {
      execute("UPDATE canvases SET linked_project_id = NULL, updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
      return queryOne('SELECT * FROM canvases WHERE id = ?', [id])
    })

    handle('canvases:getContent', (_event, id: string) => {
      const canvas = queryOne('SELECT filename FROM canvases WHERE id = ?', [id])
      if (!canvas) return null
      const fp = canvasFilePath(canvas.filename as string)
      if (!fp || !fs.existsSync(fp)) return null
      return fs.readFileSync(fp, 'utf-8')
    })

    handle('canvases:saveContent', (_event, id: string, content: string) => {
      const canvas = queryOne('SELECT filename FROM canvases WHERE id = ?', [id])
      if (!canvas) throw new Error('Canvas not found')
      const fp = canvasFilePath(canvas.filename as string)
      if (!fp) throw new Error('No vault configured')
      fs.writeFileSync(fp, content, 'utf-8')
      execute("UPDATE canvases SET updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
    })

    handle('canvases:delete', (_event, id: string) => {
      execute("UPDATE canvases SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    // ── Canvas folder handlers (mirrors the note-folder handlers below, table canvas_folders) ──

    handle('canvasFolders:list', () => {
      return queryAll('SELECT * FROM canvas_folders WHERE deleted_at IS NULL ORDER BY position ASC, created_at ASC')
    })

    handle('canvasFolders:create', async (_event, data: { name: string, parent_folder_id?: string | null }) => {
      const parentId = data.parent_folder_id ?? null
      const row = queryOne(
        'SELECT MAX(position) AS maxPos FROM canvas_folders WHERE parent_folder_id IS ? AND deleted_at IS NULL',
        [parentId]
      )
      const position = ((row?.maxPos as number | null) ?? -1) + 1
      const id = crypto.randomUUID()
      execute(
        'INSERT INTO canvas_folders (id, name, parent_folder_id, position) VALUES (?, ?, ?, ?)',
        [id, data.name, parentId, position]
      )
      saveDatabase()
      return queryOne('SELECT * FROM canvas_folders WHERE id = ?', [id])
    })

    handle('canvasFolders:rename', async (_event, data: { id: string, name: string }) => {
      execute(
        "UPDATE canvas_folders SET name = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        [data.name, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM canvas_folders WHERE id = ?', [data.id])
    })

    handle('canvasFolders:move', async (_event, data: { id: string, parent_folder_id: string | null }) => {
      const targetId = data.parent_folder_id
      if (wouldCreateCanvasFolderCycle(db!, data.id, targetId)) {
        throw new Error('Cannot move a folder into itself or one of its own subfolders')
      }
      const row = queryOne(
        'SELECT MAX(position) AS maxPos FROM canvas_folders WHERE parent_folder_id IS ? AND deleted_at IS NULL',
        [targetId]
      )
      const position = ((row?.maxPos as number | null) ?? -1) + 1
      execute(
        "UPDATE canvas_folders SET parent_folder_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?",
        [targetId, position, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM canvas_folders WHERE id = ?', [data.id])
    })

    handle('canvasFolders:reorder', async (_event, data: { ids: string[] }) => {
      data.ids.forEach((id, index) => {
        execute('UPDATE canvas_folders SET position = ? WHERE id = ? AND deleted_at IS NULL', [index, id])
      })
      saveDatabase()
    })

    handle('canvasFolders:delete', async (_event, id: string) => {
      const folderIds = collectCanvasFolderSubtreeIds(db!, id)
      const placeholders = folderIds.map(() => '?').join(',')
      execute(
        `UPDATE canvases SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE folder_id IN (${placeholders}) AND deleted_at IS NULL`,
        folderIds
      )
      execute(
        `UPDATE canvas_folders SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${placeholders})`,
        folderIds
      )
      saveDatabase()
    })

    // ── Folder handlers (standalone notes only — nestable via parent_folder_id) ──

    handle('folders:list', () => {
      return queryAll('SELECT * FROM folders WHERE deleted_at IS NULL ORDER BY position ASC, created_at ASC')
    })

    handle('folders:create', async (_event, data: { name: string, parent_folder_id?: string | null }) => {
      const parentId = data.parent_folder_id ?? null
      const row = queryOne(
        'SELECT MAX(position) AS maxPos FROM folders WHERE parent_folder_id IS ? AND deleted_at IS NULL',
        [parentId]
      )
      const position = ((row?.maxPos as number | null) ?? -1) + 1
      const id = crypto.randomUUID()
      execute(
        'INSERT INTO folders (id, name, parent_folder_id, position) VALUES (?, ?, ?, ?)',
        [id, data.name, parentId, position]
      )
      saveDatabase()
      return queryOne('SELECT * FROM folders WHERE id = ?', [id])
    })

    handle('folders:rename', async (_event, data: { id: string, name: string }) => {
      execute(
        "UPDATE folders SET name = ?, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        [data.name, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM folders WHERE id = ?', [data.id])
    })

    // Moves a folder under a new parent (or to the root, when parent_folder_id is null).
    // Refuses moves that would create a cycle — dropping a folder into itself or a descendant.
    handle('folders:move', async (_event, data: { id: string, parent_folder_id: string | null }) => {
      const targetId = data.parent_folder_id
      if (wouldCreateFolderCycle(db!, data.id, targetId)) {
        throw new Error('Cannot move a folder into itself or one of its own subfolders')
      }
      const row = queryOne(
        'SELECT MAX(position) AS maxPos FROM folders WHERE parent_folder_id IS ? AND deleted_at IS NULL',
        [targetId]
      )
      const position = ((row?.maxPos as number | null) ?? -1) + 1
      execute(
        "UPDATE folders SET parent_folder_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?",
        [targetId, position, data.id]
      )
      saveDatabase()
      return queryOne('SELECT * FROM folders WHERE id = ?', [data.id])
    })

    handle('folders:reorder', async (_event, data: { ids: string[] }) => {
      data.ids.forEach((id, index) => {
        execute('UPDATE folders SET position = ? WHERE id = ? AND deleted_at IS NULL', [index, id])
      })
      saveDatabase()
    })

    // Deletes a folder and everything inside it — subfolders recursively, and every note they
    // contain — mirroring a single note delete's soft-delete semantics, so the notes land in
    // the recycle bin (individually restorable, landing back as unfiled) rather than vanishing.
    handle('folders:delete', async (_event, id: string) => {
      const folderIds = collectFolderSubtreeIds(db!, id)
      const placeholders = folderIds.map(() => '?').join(',')
      execute(
        `UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE folder_id IN (${placeholders}) AND deleted_at IS NULL`,
        folderIds
      )
      execute(
        `UPDATE folders SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${placeholders})`,
        folderIds
      )
      saveDatabase()
    })

    // ── Recycle bin handlers ──

    handle('recycle:list', () => {
      const projects = queryAll("SELECT 'project' AS type, id, name AS title, deleted_at FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      const cards = queryAll("SELECT 'card' AS type, id, title, deleted_at FROM cards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      const notes = queryAll("SELECT 'note' AS type, id, title, deleted_at FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      const canvases = queryAll("SELECT 'canvas' AS type, id, title, deleted_at FROM canvases WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
      return [...projects, ...cards, ...notes, ...canvases].sort((a, b) =>
        (b.deleted_at as string).localeCompare(a.deleted_at as string)
      )
    })

    handle('recycle:restore', (_event, type: string, id: string) => {
      if (type === 'project') execute('UPDATE projects SET deleted_at = NULL WHERE id = ?', [id])
      else if (type === 'card') {
        // The card's original column may have since been deleted; fall back to the
        // project's first column so the restored card doesn't become invisible.
        const card = queryOne('SELECT project_id, column_id FROM cards WHERE id = ?', [id])
        if (card) {
          const columnExists = queryOne('SELECT id FROM kanban_columns WHERE id = ?', [card.column_id])
          if (!columnExists) {
            const fallbackCol = queryOne(
              'SELECT id FROM kanban_columns WHERE project_id = ? ORDER BY position ASC LIMIT 1',
              [card.project_id]
            )
            if (fallbackCol) execute('UPDATE cards SET column_id = ? WHERE id = ?', [fallbackCol.id, id])
          }
        }
        execute('UPDATE cards SET deleted_at = NULL WHERE id = ?', [id])
      }
      else if (type === 'note') execute('UPDATE notes SET deleted_at = NULL WHERE id = ?', [id])
      else if (type === 'canvas') execute('UPDATE canvases SET deleted_at = NULL WHERE id = ?', [id])
      saveDatabase()
    })

    handle('recycle:purge', (_event, type: string, id: string) => {
      if (type === 'project') {
        const cardIds = queryAll('SELECT id FROM cards WHERE project_id = ?', [id]).map((r) => r.id as string)
        deleteNotesForCards(cardIds)
        const projectNotes = queryAll('SELECT filename FROM notes WHERE project_id = ?', [id])
        for (const note of projectNotes) deleteNoteFile(note.filename as string)
        execute('DELETE FROM notes WHERE project_id = ?', [id])
        const projectCanvases = queryAll('SELECT filename FROM canvases WHERE project_id = ?', [id])
        for (const canvas of projectCanvases) deleteCanvasFile(canvas.filename as string)
        execute('DELETE FROM canvases WHERE project_id = ?', [id])
        execute('DELETE FROM projects WHERE id = ?', [id])
      } else if (type === 'card') {
        deleteNotesForCards([id])
        execute('DELETE FROM cards WHERE id = ?', [id])
      } else if (type === 'note') {
        const note = queryOne('SELECT filename FROM notes WHERE id = ?', [id])
        if (note) deleteNoteFile(note.filename as string)
        execute('DELETE FROM notes WHERE id = ?', [id])
      } else if (type === 'canvas') {
        const canvas = queryOne('SELECT filename FROM canvases WHERE id = ?', [id])
        if (canvas) deleteCanvasFile(canvas.filename as string)
        execute('DELETE FROM canvases WHERE id = ?', [id])
      }
      saveDatabase()
    })

    // ── Archive handlers ──

    handle('archive:list', () => {
      return listArchivedProjects(db!)
    })

    handle('archive:restore', (_event, id: string) => {
      execute("UPDATE projects SET archived = 0, updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
    })

    handle('projects:list', async () => {
      return listActiveProjects(db!)
    })

    handle('projects:create', async (_event, data: { name: string, priority?: string, status?: string, due_date?: string | null }) => {
      const projectId = crypto.randomUUID()
      const priority = data.priority || 'none'
      const status = data.status || 'planning'
      const dueDate = data.due_date || null

      execute(
        'INSERT INTO projects (id, name, priority, status, due_date) VALUES (?, ?, ?, ?, ?)',
        [projectId, data.name, priority, status, dueDate]
      )

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

    handle('projects:update', async (_event, data: { id: string, name?: string, priority?: string, status?: string, due_date?: string | null }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
      if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
      if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date) }

      if (fields.length === 0) return null

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, values)
      saveDatabase()
      return queryOne('SELECT * FROM projects WHERE id = ?', [data.id])
    })

    handle('projects:archive', async (_event, id: string) => {
      execute("UPDATE projects SET archived = CASE WHEN archived = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    handle('projects:delete', async (_event, id: string) => {
      execute("UPDATE projects SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    // ── Column handlers ──

    handle('columns:list', async (_event, projectId: string) => {
      return queryAll(
        'SELECT * FROM kanban_columns WHERE project_id = ? ORDER BY position',
        [projectId]
      )
    })

    handle('columns:create', async (_event, data: { project_id: string, name: string, is_done?: number }) => {
      const maxPos = queryOne(
        'SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_columns WHERE project_id = ?',
        [data.project_id]
      )
      const id = crypto.randomUUID()
      execute(
        'INSERT INTO kanban_columns (id, project_id, name, position, is_done) VALUES (?, ?, ?, ?, ?)',
        [id, data.project_id, data.name, (maxPos?.max_pos as number) + 1, data.is_done ?? 0]
      )
      saveDatabase()
      return queryOne('SELECT * FROM kanban_columns WHERE id = ?', [id])
    })

    handle('columns:update', async (_event, data: { id: string, name?: string, is_done?: number }) => {
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

    handle('columns:reorder', async (_event, data: { project_id: string, column_ids: string[] }) => {
      for (let i = 0; i < data.column_ids.length; i++) {
        execute(
          "UPDATE kanban_columns SET position = ?, updated_at = datetime('now') WHERE id = ? AND project_id = ?",
          [i, data.column_ids[i], data.project_id]
        )
      }
      saveDatabase()
    })

    handle('columns:delete', async (_event, id: string) => {
      // Deleting the column cascades to hard-delete its cards, so clean up their notes first
      const cardIds = queryAll('SELECT id FROM cards WHERE column_id = ?', [id]).map((r) => r.id as string)
      deleteNotesForCards(cardIds)
      execute('DELETE FROM kanban_columns WHERE id = ?', [id])
      saveDatabase()
    })

    // ── Card handlers ──

    handle('cards:list', async (_event, projectId: string) => {
      return queryAll(
        'SELECT * FROM cards WHERE project_id = ? AND deleted_at IS NULL ORDER BY position',
        [projectId]
      )
    })

    handle('cards:create', async (_event, data: { project_id: string, column_id: string, title: string, points?: number, priority?: string, due_date?: string }) => {
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

    handle('cards:update', async (_event, data: { id: string, title?: string, points?: number | null, priority?: string, due_date?: string | null }) => {
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

    handle('cards:move', async (_event, data: { id: string, column_id: string, position: number }) => {
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

    handle('cards:reorder', async (_event, data: { column_id: string, card_ids: string[] }) => {
      for (let i = 0; i < data.card_ids.length; i++) {
        execute(
          "UPDATE cards SET position = ?, updated_at = datetime('now') WHERE id = ?",
          [i, data.card_ids[i]]
        )
      }
      saveDatabase()
    })

    handle('cards:delete', async (_event, id: string) => {
      execute("UPDATE cards SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL", [id])
      saveDatabase()
    })

    // ── Todo handlers ──

    handle('todos:list', async () => {
      return queryAll('SELECT * FROM todos ORDER BY done ASC, position ASC')
    })

    handle('todos:create', async (_event, data: { text: string }) => {
      const maxPos = queryOne('SELECT COALESCE(MAX(position), -1) AS max_pos FROM todos')
      const id = randomUUID()
      execute(
        'INSERT INTO todos (id, text, position) VALUES (?, ?, ?)',
        [id, data.text, (maxPos?.max_pos as number) + 1]
      )
      saveDatabase()
      return queryOne('SELECT * FROM todos WHERE id = ?', [id])
    })

    handle('todos:update', async (_event, data: { id: string, text?: string, priority?: string, due_date?: string | null }) => {
      const fields: string[] = []
      const values: unknown[] = []

      if (data.text !== undefined) { fields.push('text = ?'); values.push(data.text) }
      if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
      if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date) }

      if (fields.length === 0) return null

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      execute(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, values)
      saveDatabase()
      return queryOne('SELECT * FROM todos WHERE id = ?', [data.id])
    })

    handle('todos:toggle', async (_event, id: string) => {
      execute("UPDATE todos SET done = NOT done, updated_at = datetime('now') WHERE id = ?", [id])
      saveDatabase()
      return queryOne('SELECT * FROM todos WHERE id = ?', [id])
    })

    handle('todos:reorder', async (_event, data: { ids: string[] }) => {
      for (let i = 0; i < data.ids.length; i++) {
        execute("UPDATE todos SET position = ?, updated_at = datetime('now') WHERE id = ?", [i, data.ids[i]])
      }
      saveDatabase()
    })

    handle('todos:delete', async (_event, id: string) => {
      execute('DELETE FROM todos WHERE id = ?', [id])
      saveDatabase()
    })

    // ── Overview handler ──

    handle('overview:get', async () => {
      const dueCards = queryAll(
        `SELECT c.id, c.title, c.project_id, p.name AS project_name, c.due_date, c.priority
         FROM cards c
         JOIN projects p ON p.id = c.project_id
         JOIN kanban_columns kc ON kc.id = c.column_id
         WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.archived = 0
           AND kc.is_done = 0 AND c.due_date IS NOT NULL
           AND date(c.due_date) <= date('now', '+7 days')
         ORDER BY c.due_date ASC
         LIMIT 8`
      )

      // A project counts as stale once it's on hold, or once nothing on it has moved in 14 days.
      const staleProjects = queryAll(
        `SELECT * FROM (
           SELECT p.id, p.name, p.priority, p.status,
             MAX(p.updated_at, COALESCE(MAX(c.updated_at), '')) AS last_activity
           FROM projects p
           LEFT JOIN cards c ON c.project_id = p.id AND c.deleted_at IS NULL
           WHERE p.deleted_at IS NULL AND p.archived = 0 AND p.status != 'done'
           GROUP BY p.id
         ) t
         WHERE t.status = 'on_hold' OR t.last_activity <= datetime('now', '-14 days')
         ORDER BY t.last_activity ASC
         LIMIT 5`
      )

      const statusRows = queryAll(
        `SELECT status, COUNT(*) AS count FROM projects
         WHERE deleted_at IS NULL AND archived = 0
         GROUP BY status`
      )

      // No completed_at column exists, so a card's own updated_at (set on every move) stands in
      // for when it was finished — close enough for a week-over-week trend.
      const pointsTrend = queryOne(
        `SELECT
           COALESCE(SUM(CASE WHEN c.updated_at >= datetime('now', '-7 days') THEN c.points ELSE 0 END), 0) AS this_week,
           COALESCE(SUM(CASE WHEN c.updated_at >= datetime('now', '-14 days') AND c.updated_at < datetime('now', '-7 days') THEN c.points ELSE 0 END), 0) AS last_week
         FROM cards c
         JOIN kanban_columns kc ON kc.id = c.column_id
         JOIN projects p ON p.id = c.project_id
         WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.archived = 0 AND kc.is_done = 1`
      )

      const recentNotes = queryAll(
        `SELECT n.id, n.title, n.project_id, n.card_id,
           ${NOTE_PROJECT_COLUMNS},
           n.updated_at
         FROM notes n
         ${NOTE_PROJECT_JOIN}
         WHERE n.deleted_at IS NULL
         ORDER BY n.updated_at DESC
         LIMIT 5`
      )

      return { dueCards, staleProjects, statusRows, pointsTrend, recentNotes }
    })

    // ── Search handler ──

    handle('search:query', (_event, query: string) => {
      const q = query.trim()
      if (!q) return { projects: [], cards: [], notes: [], canvases: [] }
      const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`

      const projects = queryAll(
        `SELECT id, name, priority, status FROM projects
         WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY name COLLATE NOCASE LIMIT 8`,
        [like]
      )

      const cards = queryAll(
        `SELECT c.id, c.title, c.project_id, p.name AS project_name
         FROM cards c JOIN projects p ON p.id = c.project_id
         WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND c.title LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY c.title COLLATE NOCASE LIMIT 8`,
        [like]
      )

      const NOTE_RESULT_LIMIT = 8
      const titleMatches = queryAll(
        `SELECT n.id, n.title, n.project_id, n.card_id, n.filename,
           ${NOTE_PROJECT_COLUMNS}
         FROM notes n
         ${NOTE_PROJECT_JOIN}
         WHERE n.deleted_at IS NULL AND n.title LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY n.title COLLATE NOCASE LIMIT ?`,
        [like, NOTE_RESULT_LIMIT]
      )

      // Note bodies live on disk, not in the DB, so title misses fall back to scanning file
      // content for the remaining result slots.
      const remaining = NOTE_RESULT_LIMIT - titleMatches.length
      const contentMatches: typeof titleMatches = []
      if (remaining > 0) {
        const titleMatchIds = new Set(titleMatches.map((n) => n.id))
        const qLower = q.toLowerCase()
        const candidates = queryAll(
          `SELECT n.id, n.title, n.project_id, n.card_id, n.filename,
             ${NOTE_PROJECT_COLUMNS}
           FROM notes n
           ${NOTE_PROJECT_JOIN}
           WHERE n.deleted_at IS NULL
           ORDER BY n.updated_at DESC`
        )
        for (const note of candidates) {
          if (titleMatchIds.has(note.id)) continue
          const fp = noteFilePath(note.filename as string)
          if (!fp || !fs.existsSync(fp)) continue
          const content = fs.readFileSync(fp, 'utf-8')
          if (content.toLowerCase().includes(qLower)) {
            contentMatches.push(note)
            if (contentMatches.length >= remaining) break
          }
        }
      }

      const notes = [...titleMatches, ...contentMatches].map(
        ({ id, title, project_id, card_id, resolved_project_id, project_name }) =>
          ({ id, title, project_id, card_id, resolved_project_id, project_name })
      )

      // Canvas bodies are a JSON graph, not readable text, so search is title-only (no
      // content-scan fallback the way notes get).
      const canvases = queryAll(
        `SELECT c.id, c.title, c.project_id,
           ${CANVAS_PROJECT_COLUMNS}
         FROM canvases c
         ${CANVAS_PROJECT_JOIN}
         WHERE c.deleted_at IS NULL AND c.title LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY c.title COLLATE NOCASE LIMIT 8`,
        [like]
      )

      return { projects, cards, notes, canvases }
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
