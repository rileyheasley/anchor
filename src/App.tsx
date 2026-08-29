import { useState } from 'react'
import type { Project } from './types'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import OverviewHome from './components/OverviewHome'
import HomePage from './components/HomePage'
import ProjectBoard from './components/ProjectBoard'
import NotesPage from './components/NotesPage'
import RecycleBin from './components/RecycleBin'
import ArchiveView from './components/ArchiveView'

type View = 'home' | 'projects' | 'notes' | 'archive' | 'recycle'

function App() {
  const [view, setView] = useState<View>('home')
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [startCreatingNote, setStartCreatingNote] = useState(false)
  const [startCreatingProject, setStartCreatingProject] = useState(false)

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
      return <ProjectBoard project={activeProject} onClose={() => setActiveProject(null)} />
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
        />
        <div className="flex-1 overflow-hidden">
          {content()}
        </div>
      </div>
    </div>
  )
}

export default App
