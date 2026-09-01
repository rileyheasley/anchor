import { useState, useEffect } from 'react'
import type { Project, ResolvedTheme, ThemeMode } from './types'
import { setSoundsEnabled } from './sounds'
import { ALL_THEME_OPTIONS } from './utils/theme'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import OverviewHome from './components/OverviewHome'
import HomePage from './components/HomePage'
import ProjectBoard from './components/ProjectBoard'
import NotesPage from './components/NotesPage'
import CanvasesPage from './components/CanvasesPage'
import RecycleBin from './components/RecycleBin'
import ArchiveView from './components/ArchiveView'
import SettingsModal from './components/SettingsModal'
import SearchModal, { type SearchSelection } from './components/SearchModal'

type View = 'home' | 'projects' | 'notes' | 'canvases' | 'archive' | 'recycle'

interface NavState {
  view: View
  projectId: string | null
}

const pushHistory = (state: NavState) => {
  window.history.pushState(state, '')
}

function App() {
  const [view, setView] = useState<View>('home')
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [startCreatingNote, setStartCreatingNote] = useState(false)
  const [startCreatingCanvas, setStartCreatingCanvas] = useState(false)
  const [startCreatingProject, setStartCreatingProject] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  const [soundsEnabled, setSoundsEnabledState] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [focusCardId, setFocusCardId] = useState<string | null>(null)
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const [focusCanvasId, setFocusCanvasId] = useState<string | null>(null)

  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const isValid = ALL_THEME_OPTIONS.some((opt) => opt.mode === savedTheme)
    setThemeMode(isValid ? (savedTheme as ThemeMode) : 'light')
  }, [])

  // Load sound preference from localStorage on mount
  useEffect(() => {
    const enabled = localStorage.getItem('soundsEnabled') !== 'false'
    setSoundsEnabledState(enabled)
    setSoundsEnabled(enabled)
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

  const handleSoundsEnabledChange = (enabled: boolean) => {
    setSoundsEnabledState(enabled)
    setSoundsEnabled(enabled)
    localStorage.setItem('soundsEnabled', String(enabled))
  }

  const handleNavigate = (v: View) => {
    setActiveProject(null)        // always exit any open project
    setStartCreatingNote(false)
    setStartCreatingCanvas(false)
    setStartCreatingProject(false)
    setView(v)
    pushHistory({ view: v, projectId: null })
  }

  const handleNewNote = () => {
    setActiveProject(null)
    setStartCreatingNote(true)
    setView('notes')
    pushHistory({ view: 'notes', projectId: null })
  }

  const handleNewCanvas = () => {
    setActiveProject(null)
    setStartCreatingCanvas(true)
    setView('canvases')
    pushHistory({ view: 'canvases', projectId: null })
  }

  const handleNewProject = () => {
    setActiveProject(null)
    setStartCreatingProject(true)
    setView('projects')
    pushHistory({ view: 'projects', projectId: null })
  }

  // Opens a project as a new history entry, so the mouse/OS back button (and Alt+Left)
  // returns to whatever list the project was opened from.
  const navigateToProject = (project: Project) => {
    setActiveProject(project)
    pushHistory({ view, projectId: project.id })
  }

  const closeProject = () => {
    setActiveProject(null)
    pushHistory({ view, projectId: null })
  }

  const openProjectById = async (id: string): Promise<Project | null> => {
    try {
      const active = await window.api.projects.list()
      const found = active.find((p) => p.id === id)
      if (found) return found
      const archived = await window.api.archive.list()
      return archived.find((p) => p.id === id) ?? null
    } catch (error) {
      console.error('Failed to load project for navigation:', error)
      return null
    }
  }

  const openCard = async (cardId: string, projectId: string) => {
    const project = await openProjectById(projectId)
    if (project) {
      navigateToProject(project)
      setFocusCardId(cardId)
    }
  }

  // Card notes deep-link via the card detail panel (openCard already surfaces its note);
  // project-scoped notes deep-link into the project's note editor; standalone notes open
  // directly in the Notes view.
  const openNote = async (noteId: string, projectId: string | null, cardId: string | null = null) => {
    if (cardId && projectId) {
      await openCard(cardId, projectId)
    } else if (projectId) {
      const project = await openProjectById(projectId)
      if (project) {
        navigateToProject(project)
        setFocusNoteId(noteId)
      }
    } else {
      setActiveProject(null)
      setView('notes')
      setFocusNoteId(noteId)
      pushHistory({ view: 'notes', projectId: null })
    }
  }

  // Canvases deep-link into the project's canvas editor when project-scoped, or straight into
  // the Canvases view when standalone — mirrors openNote, minus the card_id branch (canvases
  // don't attach to cards).
  const openCanvas = async (canvasId: string, projectId: string | null) => {
    if (projectId) {
      const project = await openProjectById(projectId)
      if (project) {
        navigateToProject(project)
        setFocusCanvasId(canvasId)
      }
    } else {
      setActiveProject(null)
      setView('canvases')
      setFocusCanvasId(canvasId)
      pushHistory({ view: 'canvases', projectId: null })
    }
  }

  const handleSearchSelect = async (selection: SearchSelection) => {
    if (selection.type === 'project') {
      const project = await openProjectById(selection.id)
      if (project) navigateToProject(project)
      return
    }
    if (selection.type === 'card') {
      await openCard(selection.id, selection.projectId)
      return
    }
    if (selection.type === 'canvas') {
      await openCanvas(selection.id, selection.projectId)
      return
    }
    await openNote(selection.id, selection.projectId, selection.cardId)
  }

  // Session history drives the mouse/OS back-forward buttons: replay whatever view or
  // project the entry represents. This never re-pushes, so it can't create a loop.
  useEffect(() => {
    window.history.replaceState({ view: 'home', projectId: null } satisfies NavState, '')

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as NavState | null
      if (!state) return
      setView(state.view)
      if (state.projectId) {
        openProjectById(state.projectId).then((project) => setActiveProject(project))
      } else {
        setActiveProject(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Global keyboard shortcuts: Mod+, settings, Mod+K search, Mod+1-6 navigation, Mod+N new item (context-aware)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      switch (e.key) {
        case ',':
          e.preventDefault()
          setIsSettingsOpen((prev) => !prev)
          break
        case 'k':
        case 'K':
          e.preventDefault()
          setIsSearchOpen((prev) => !prev)
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
        case '6':
          e.preventDefault()
          handleNavigate('canvases')
          break
        case 'n':
        case 'N':
          e.preventDefault()
          if (view === 'notes') handleNewNote()
          else if (view === 'canvases') handleNewCanvas()
          else handleNewProject()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view])

  const content = () => {
    if (activeProject) {
      return (
        <ProjectBoard
          project={activeProject}
          onClose={closeProject}
          onProjectUpdate={setActiveProject}
          focusCardId={focusCardId}
          onFocusCardHandled={() => setFocusCardId(null)}
          focusNoteId={focusNoteId}
          onFocusNoteHandled={() => setFocusNoteId(null)}
          focusCanvasId={focusCanvasId}
          onFocusCanvasHandled={() => setFocusCanvasId(null)}
        />
      )
    }
    if (view === 'home') {
      return (
        <OverviewHome
          onOpenProject={navigateToProject}
          onOpenCard={openCard}
          onOpenNote={openNote}
          onNewProject={handleNewProject}
          onNewNote={handleNewNote}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      )
    }
    if (view === 'projects') {
      return (
        <HomePage
          onOpenProject={navigateToProject}
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
          focusNoteId={focusNoteId}
          onFocusNoteHandled={() => setFocusNoteId(null)}
        />
      )
    }
    if (view === 'canvases') {
      return (
        <CanvasesPage
          startCreating={startCreatingCanvas}
          onCreateHandled={() => setStartCreatingCanvas(false)}
          onNewCanvas={handleNewCanvas}
          focusCanvasId={focusCanvasId}
          onFocusCanvasHandled={() => setFocusCanvasId(null)}
        />
      )
    }
    if (view === 'recycle') return <RecycleBin />
    if (view === 'archive') return <ArchiveView onOpenProject={navigateToProject} />
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
          onOpenSearch={() => setIsSearchOpen(true)}
        />
        <div className="flex-1 overflow-hidden">
          {content()}
        </div>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
        soundsEnabled={soundsEnabled}
        onSoundsEnabledChange={handleSoundsEnabledChange}
      />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelect={handleSearchSelect} />
    </div>
  )
}

export default App
