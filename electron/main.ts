import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface TestItem {
  id: number
  text: string
}

let db: { items: TestItem[], nextId: number } = { items: [], nextId: 1 }
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

function initializeDatabase() {
  try {
    console.log('Starting database initialization...')
    const userDataPath = app.getPath('userData')
    console.log('User data path:', userDataPath)
    
    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      console.log('Creating user data directory...')
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    console.log('User data directory ready')
    
    dbPath = path.join(userDataPath, 'anchor.json')
    console.log('Database path:', dbPath)
    
    // Load existing data or initialize empty
    if (fs.existsSync(dbPath)) {
      console.log('Loading existing database file...')
      const data = fs.readFileSync(dbPath, 'utf-8')
      db = JSON.parse(data)
    } else {
      console.log('Creating new database...')
      db = { items: [], nextId: 1 }
      saveDatabase()
    }
    
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
  } catch (error) {
    console.error('Failed to save database:', error)
  }
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

app.whenReady().then(() => {
  try {
    initializeDatabase()
    
    ipcMain.handle('save-item', async (_event, text: string) => {
      try {
        if (!db) throw new Error('Database not initialized')
        
        const newItem: TestItem = {
          id: db.nextId++,
          text
        }
        db.items.push(newItem)
        saveDatabase()
        
        return newItem.id
      } catch (error) {
        console.error('save-item error:', error)
        throw error
      }
    })
    
    ipcMain.handle('get-items', async () => {
      try {
        if (!db) throw new Error('Database not initialized')
        return db.items
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
