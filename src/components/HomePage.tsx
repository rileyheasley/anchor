import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, Archive, FolderOpen } from 'lucide-react'
import type { Project, Priority } from '../types'
import { clickSound, deleteSound } from '../sounds'
import ProjectCreationModal from './ProjectCreationModal'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuPosition } from './ContextMenu'

const PRIORITY_COLORS: Record<string, string> = {
  none: 'border-l-ink-faint',
  low: 'border-l-accent',
  medium: 'border-l-warning-hover',
  high: 'border-l-danger',
}

const PRIORITY_BADGES: Record<string, string> = {
  none: 'bg-surface-muted text-ink-muted',
  low: 'bg-accent-subtle text-accent-strong',
  medium: 'bg-warning-subtle text-warning-strong',
  high: 'bg-danger-subtle text-danger-strong',
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
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-danger font-medium' }
  if (diff === 0) return { label: 'Due today', color: 'text-danger font-medium' }
  if (diff <= 3) return { label: `Due in ${diff}d`, color: 'text-warning' }
  if (diff <= 7) return { label: `Due in ${diff}d`, color: 'text-warning-hover' }
  return { label: `Due in ${diff}d`, color: 'text-ink-faint' }
}

export default function HomePage({
  onOpenProject,
  startCreating: startCreatingProp = false,
  onCreateHandled,
  onNewProject,
}: {
  onOpenProject: (project: Project) => void
  startCreating?: boolean
  onCreateHandled?: () => void
  onNewProject?: () => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [sortBy, setSortBy] = useState<SortMode>('priority')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ project: Project; position: ContextMenuPosition } | null>(null)

  useEffect(() => { loadProjects() }, [])

  useEffect(() => {
    if (startCreatingProp) {
      setIsCreatingModalOpen(true)
      onCreateHandled?.()
    }
  }, [startCreatingProp])

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

  const handleCreate = async (data: { name: string; priority: Priority; due_date: string | null }) => {
    setIsCreating(true)
    try {
      await window.api.projects.create(data)
      await loadProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
      throw error
    } finally {
      setIsCreating(false)
    }
  }

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return
    deleteSound()
    try {
      await window.api.projects.delete(confirmDelete)
      await loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
    setConfirmDelete(null)
  }

  const handleArchive = async (id: string) => {
    clickSound()
    try {
      await window.api.projects.archive(id)
      await loadProjects()
    } catch (error) {
      console.error('Failed to archive project:', error)
    }
  }

  const progressPercent = (p: Project) =>
    p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0

  const SORT_LABELS: Record<SortMode, string> = { priority: 'Priority', dueDate: 'Due date', name: 'Name' }

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="max-w-4xl mx-auto px-6 py-8">
        {projects.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <span className="text-xs text-ink-faint mr-1">Sort:</span>
              {(['priority', 'dueDate', 'name'] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { clickSound(); setSortBy(mode) }}
                  className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                    sortBy === mode ? 'bg-primary text-ink-inverse' : 'text-ink-faint hover:bg-surface-muted'
                  }`}
                >
                  {SORT_LABELS[mode]}
                </button>
              ))}
            </div>
            <button
              onClick={() => { clickSound(); setIsCreatingModalOpen(true); onNewProject?.() }}
              className="px-3 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors cursor-pointer font-medium flex items-center gap-2"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        )}

        {projects.length === 0 && !isCreatingModalOpen && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => { clickSound(); setIsCreatingModalOpen(true); onNewProject?.() }}
              className="px-3 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors cursor-pointer font-medium flex items-center gap-2"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        )}

        {projects.length === 0 && !isCreatingModalOpen && (
          <div className="text-center py-24 text-ink-faint">
            <p className="text-2xl mb-2">🪝</p>
            <p className="text-base font-medium text-ink-muted">No projects yet</p>
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
                  whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-md)' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { clickSound(); onOpenProject(p) }}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ project: p, position: { x: e.clientX, y: e.clientY } }) }}
                  className={`bg-surface rounded-lg border border-border border-l-4 ${PRIORITY_COLORS[p.priority]} p-4 cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-ink">{p.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {dueInfo && <span className={`text-xs ${dueInfo.color}`}>{dueInfo.label}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[p.priority]}`}>
                        {p.priority}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-surface-muted rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="bg-accent h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent(p)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs text-ink-faint whitespace-nowrap">
                      {p.total_points > 0 ? `${p.done_points}/${p.total_points} pts` : 'No cards'}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </main>

      <ProjectCreationModal
        isOpen={isCreatingModalOpen}
        onClose={() => setIsCreatingModalOpen(false)}
        onCreate={handleCreate}
        isLoading={isCreating}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete project?"
        message="This project will be moved to the recycle bin. You can restore it later."
        confirmText="Delete"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      <ContextMenu
        position={menu?.position ?? null}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'Open project', icon: FolderOpen, onClick: () => onOpenProject(menu.project) },
                'separator',
                { label: 'Archive project', icon: Archive, onClick: () => handleArchive(menu.project.id) },
                { label: 'Delete project', icon: Trash2, danger: true, onClick: () => setConfirmDelete(menu.project.id) },
              ]
            : []
        }
      />
    </div>
  )
}
