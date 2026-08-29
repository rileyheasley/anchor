import { useState } from 'react'
import './types'
import type { Project } from './types'
import HomePage from './components/HomePage'
import ProjectBoard from './components/ProjectBoard'

function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null)

  if (activeProject) {
    return <ProjectBoard project={activeProject} onBack={() => setActiveProject(null)} />
  }

  return <HomePage onOpenProject={setActiveProject} />
}

export default App
