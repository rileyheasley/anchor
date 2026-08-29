import { app, BrowserWindow, ipcMain } from 'electron'
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
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
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
    
    ipcMain.handle('save-item', async (_event, text: string) => {
      try {
        if (!db) throw new Error('Database not initialized')
        
        const id = crypto.randomUUID()
        db.run('INSERT INTO projects (id, name) VALUES (?, ?)', [id, text])
        saveDatabase()
        
        return id
      } catch (error) {
        console.error('save-item error:', error)
        throw error
      }
    })
    
    ipcMain.handle('get-items', async () => {
      try {
        if (!db) throw new Error('Database not initialized')
        const result = db.exec('SELECT id, name AS text FROM projects WHERE deleted_at IS NULL AND archived = 0')
        if (result.length === 0) return []
        return result[0].values.map(([id, text]) => ({ id, text }))
      } catch (error) {
        console.error('get-items error:', error)
        throw error
      }
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
