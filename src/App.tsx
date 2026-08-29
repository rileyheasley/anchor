import { useState } from 'react'
import type { Project } from './types'
import TitleBar from './components/TitleBar'
import HomePage from './components/HomePage'
import ProjectBoard from './components/ProjectBoard'
import NotesPage from './components/NotesPage'
import RecycleBin from './components/RecycleBin'
import ArchiveView from './components/ArchiveView'

type View = 'home' | 'notes' | 'archive' | 'recycle'

function App() {
  const [view, setView] = useState<View>('home')
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  const goHome = () => setView('home')

  const content = () => {
    if (activeProject) return <ProjectBoard project={activeProject} onBack={() => setActiveProject(null)} />
    if (view === 'notes') return <NotesPage onBack={goHome} />
    if (view === 'recycle') return <RecycleBin onBack={goHome} />
    if (view === 'archive') return <ArchiveView onBack={goHome} onOpenProject={setActiveProject} />
    return (
      <HomePage
        onOpenProject={setActiveProject}
        onGoNotes={() => setView('notes')}
        onGoArchive={() => setView('archive')}
        onGoRecycle={() => setView('recycle')}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        {content()}
      </div>
    </div>
  )
}

export default App
