import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Project } from '../types'
import { clickSound, createSound, deleteSound } from '../sounds'

const PRIORITY_COLORS: Record<string, string> = {
  none: 'border-l-gray-400',
  low: 'border-l-blue-400',
  medium: 'border-l-amber-400',
  high: 'border-l-red-500',
}

const PRIORITY_BADGES: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600',
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export default function HomePage({ onOpenProject }: { onOpenProject: (project: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setProjects(await window.api.projects.list())
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await window.api.projects.create({ name: newName })
      createSound()
      setNewName('')
      setCreating(false)
      await loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteSound()
    try {
      await window.api.projects.delete(id)
      await loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const handlePriority = async (e: React.MouseEvent, id: string, priority: string) => {
    e.stopPropagation()
    clickSound()
    try {
      await window.api.projects.update({ id, priority })
      await loadProjects()
    } catch (error) {
      console.error('Failed to update priority:', error)
    }
  }

  const progressPercent = (p: Project) =>
    p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Anchor</h1>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            + New Project
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* New project input */}
        {creating && (
          <div className="mb-6 flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
              placeholder="Project name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setNewName('') }}
              className="px-4 py-2 text-gray-500 text-sm rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Project list */}
        {projects.length === 0 && !creating && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No projects yet</p>
            <p className="text-sm mt-1">Create one to get started</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {projects.map((p, i) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 500, damping: 30 }}
              whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onOpenProject(p)}
              className={`bg-white rounded-lg border border-gray-200 border-l-4 ${PRIORITY_COLORS[p.priority]} p-4 cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{p.name}</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[p.priority]}`}>
                    {p.priority}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none cursor-pointer"
                    title="Delete project"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Priority quick-set */}
              <div className="flex items-center gap-1 mb-3">
                {(['none', 'low', 'medium', 'high'] as const).map((pri) => (
                  <button
                    key={pri}
                    onClick={(e) => handlePriority(e, p.id, pri)}
                    className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      p.priority === pri
                        ? PRIORITY_BADGES[pri] + ' font-semibold'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {pri}
                  </button>
                ))}
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent(p)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {p.total_points > 0
                    ? `${p.done_points}/${p.total_points} pts`
                    : 'No cards'}
                </span>
              </div>

              {/* Due date */}
              {p.due_date && (
                <p className="text-xs text-gray-400 mt-2">Due: {p.due_date}</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </main>
    </div>
  )
}
