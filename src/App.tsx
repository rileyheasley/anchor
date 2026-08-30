import { useState, useEffect } from 'react'
import type { Project, ResolvedTheme, ThemeMode } from './types'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import OverviewHome from './components/OverviewHome'
import HomePage from './components/HomePage'
import ProjectBoard from './components/ProjectBoard'
import NotesPage from './components/NotesPage'
import RecycleBin from './components/RecycleBin'
import ArchiveView from './components/ArchiveView'
import SettingsModal from './components/SettingsModal'

type View = 'home' | 'projects' | 'notes' | 'archive' | 'recycle'

function App() {
  const [view, setView] = useState<View>('home')
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [startCreatingNote, setStartCreatingNote] = useState(false)
  const [startCreatingProject, setStartCreatingProject] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const mode: ThemeMode = savedTheme === 'dark' || savedTheme === 'pink' || savedTheme === 'system' ? savedTheme : 'light'
    setThemeMode(mode)
  }, [])

  // Track the OS color scheme so 'system' mode stays in sync while the app is open
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemPrefersDark(media.matches)
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  // Apply theme to document whenever the resolved theme changes
  useEffect(() => {
    if (resolvedTheme === 'light') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', resolvedTheme)
    }
    window.api?.window.setTitleBarTheme(resolvedTheme)
  }, [resolvedTheme])

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    localStorage.setItem('theme', mode)
  }

  const handleNavigate = (v: View) => {
    setActiveProject(null)        // always exit any open project
    setStartCreatingNote(false)
    setStartCreatingProject(false)
    setView(v)
  }

  const handleNewNote = () => {
    setActiveProject(null)
    setStartCreatingNote(true)
    setView('notes')
  }

  const handleNewProject = () => {
    setActiveProject(null)
    setStartCreatingProject(true)
    setView('projects')
  }

  // Global keyboard shortcuts: Mod+, settings, Mod+1-5 navigation, Mod+N new item (context-aware)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      switch (e.key) {
        case ',':
          e.preventDefault()
          setIsSettingsOpen((prev) => !prev)
          break
        case '1':
          e.preventDefault()
          handleNavigate('home')
          break
        case '2':
          e.preventDefault()
          handleNavigate('projects')
          break
        case '3':
          e.preventDefault()
          handleNavigate('notes')
          break
        case '4':
          e.preventDefault()
          handleNavigate('archive')
          break
        case '5':
          e.preventDefault()
          handleNavigate('recycle')
          break
        case 'n':
        case 'N':
          e.preventDefault()
          if (view === 'notes') handleNewNote()
          else handleNewProject()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view])

  const content = () => {
    if (activeProject) {
      return <ProjectBoard project={activeProject} onClose={() => setActiveProject(null)} onProjectUpdate={setActiveProject} />
    }
    if (view === 'home') {
      return <OverviewHome onOpenProject={setActiveProject} />
    }
    if (view === 'projects') {
      return (
        <HomePage
          onOpenProject={setActiveProject}
          startCreating={startCreatingProject}
          onCreateHandled={() => setStartCreatingProject(false)}
          onNewProject={handleNewProject}
        />
      )
    }
    if (view === 'notes') {
      return (
        <NotesPage
          startCreating={startCreatingNote}
          onCreateHandled={() => setStartCreatingNote(false)}
          onNewNote={handleNewNote}
        />
      )
    }
    if (view === 'recycle') return <RecycleBin />
    if (view === 'archive') return <ArchiveView onOpenProject={setActiveProject} />
    return null
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          view={view}
          onNavigate={handleNavigate}
          themeMode={themeMode}
          onThemeChange={handleThemeChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <div className="flex-1 overflow-hidden">
          {content()}
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}

export default App
