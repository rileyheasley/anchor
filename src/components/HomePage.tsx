import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Project, Priority } from '../types'
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

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 }

type SortMode = 'priority' | 'dueDate' | 'name'

function dueDateInfo(dateStr: string | null): { label: string; color: string } | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-red-500 font-medium' }
  if (diff === 0) return { label: 'Due today', color: 'text-red-500 font-medium' }
  if (diff <= 3) return { label: `Due in ${diff}d`, color: 'text-amber-500' }
  if (diff <= 7) return { label: `Due in ${diff}d`, color: 'text-amber-400' }
  return { label: `Due in ${diff}d`, color: 'text-gray-400' }
}

export default function HomePage({
  onOpenProject,
  onGoNotes,
  onGoArchive,
  onGoRecycle,
}: {
  onOpenProject: (project: Project) => void
  onGoNotes: () => void
  onGoArchive: () => void
  onGoRecycle: () => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [sortBy, setSortBy] = useState<SortMode>('priority')

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    try {
      setProjects(await window.api.projects.list())
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const sorted = [...projects].sort((a, b) => {
    if (sortBy === 'priority') {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pd !== 0 ? pd : a.name.localeCompare(b.name)
    }
    if (sortBy === 'dueDate') {
      if (!a.due_date && !b.due_date) return a.name.localeCompare(b.name)
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    return a.name.localeCompare(b.name)
  })

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

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    clickSound()
    try {
      await window.api.projects.archive(id)
      await loadProjects()
    } catch (error) {
      console.error('Failed to archive project:', error)
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

  const SORT_LABELS: Record<SortMode, string> = { priority: 'Priority', dueDate: 'Due date', name: 'Name' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Anchor</h1>
          <div className="flex items-center gap-2">
            <button onClick={onGoNotes} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">Notes</button>
            <button onClick={onGoArchive} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">Archive</button>
            <button onClick={onGoRecycle} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">Bin</button>
            <button
              onClick={() => setCreating(true)}
              className="ml-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
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
            <button onClick={handleCreate} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">Create</button>
            <button onClick={() => { setCreating(false); setNewName('') }} className="px-4 py-2 text-gray-500 text-sm rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">Cancel</button>
          </div>
        )}

        {projects.length > 0 && (
          <div className="flex items-center gap-1 mb-4">
            <span className="text-xs text-gray-400 mr-1">Sort:</span>
            {(['priority', 'dueDate', 'name'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { clickSound(); setSortBy(mode) }}
                className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                  sortBy === mode ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-100'
                }`}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
          </div>
        )}

        {projects.length === 0 && !creating && (
          <div className="text-center py-24 text-gray-400">
            <p className="text-2xl mb-2">🪝</p>
            <p className="text-base font-medium text-gray-500">No projects yet</p>
            <p className="text-sm mt-1">Hit <span className="font-medium text-gray-600">+ New Project</span> to get started</p>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sorted.map((p, i) => {
              const dueInfo = dueDateInfo(p.due_date)
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 500, damping: 30 }}
                  whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onOpenProject(p)}
                  className={`bg-white rounded-lg border border-gray-200 border-l-4 ${PRIORITY_COLORS[p.priority]} p-4 cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{p.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {dueInfo && <span className={`text-xs ${dueInfo.color}`}>{dueInfo.label}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[p.priority]}`}>
                        {p.priority}
                      </span>
                      <button
                        onClick={(e) => handleArchive(e, p.id)}
                        className="text-gray-300 hover:text-amber-500 transition-colors cursor-pointer text-xs px-1"
                        title="Archive project"
                      >
                        ↓
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, p.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none cursor-pointer"
                        title="Delete project"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mb-3">
                    {(['none', 'low', 'medium', 'high'] as const).map((pri) => (
                      <button
                        key={pri}
                        onClick={(e) => handlePriority(e, p.id, pri)}
                        className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          p.priority === pri ? PRIORITY_BADGES[pri] + ' font-semibold' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {pri}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="bg-blue-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent(p)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {p.total_points > 0 ? `${p.done_points}/${p.total_points} pts` : 'No cards'}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
