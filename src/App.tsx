import { useState, useEffect } from 'react'
import type { Project } from './types'
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
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = savedTheme ? savedTheme === 'dark' : false
    setIsDarkMode(prefersDark)
    applyTheme(prefersDark)
  }, [])

  // Apply theme to document
  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    window.api?.window.setTitleBarTheme(dark)
  }

  // Handle theme toggle
  const handleThemeToggle = (dark: boolean) => {
    setIsDarkMode(dark)
    applyTheme(dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
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
          isInProject={activeProject !== null}
          onNavigate={handleNavigate}
          isDarkMode={isDarkMode}
          onThemeToggle={handleThemeToggle}
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
