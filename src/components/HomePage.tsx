import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, Archive, FolderOpen, List, LayoutGrid, CheckCircle2, Circle, Flag, CircleDot, Filter, X } from 'lucide-react'
import type { Project, Priority, ProjectStatus } from '../types'
import { clickSound, deleteSound } from '../sounds'
import ProjectCreationModal from './ProjectCreationModal'
import SortDropdown from './SortDropdown'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuEntry, type ContextMenuPosition } from './ContextMenu'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'
import { PRIORITY_BADGES, PRIORITY_OPTIONS, PRIORITY_ORDER, PRIORITY_LABELS, dueDateInfo } from '../utils/priority'
import { STATUS_OPTIONS, STATUS_ORDER, STATUS_BADGES, STATUS_LABELS } from '../utils/status'

type SortMode = 'priority' | 'status' | 'dueDate' | 'name'
type ViewMode = 'list' | 'grid'

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
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('projectViewMode') === 'grid' ? 'grid' : 'list')
  )
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ project: Project; position: ContextMenuPosition } | null>(null)
  const [statusFilter, setStatusFilter] = useState<Set<ProjectStatus>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState<Set<Priority>>(new Set())
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadProjects() }, [])

  useEffect(() => {
    if (startCreatingProp) {
      setIsCreatingModalOpen(true)
      onCreateHandled?.()
    }
    // Only re-run when the deep-link flag flips — onCreateHandled is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCreatingProp])

  useEscapeKey(() => setIsFilterOpen(false), isFilterOpen)
  useClickOutside(filterMenuRef, () => setIsFilterOpen(false), isFilterOpen)

  const loadProjects = async () => {
    try {
      setProjects(await window.api.projects.list())
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const filtered = projects.filter((p) =>
    (statusFilter.size === 0 || statusFilter.has(p.status)) &&
    (priorityFilter.size === 0 || priorityFilter.has(p.priority))
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'priority') {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pd !== 0 ? pd : a.name.localeCompare(b.name)
    }
    if (sortBy === 'status') {
      const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      return sd !== 0 ? sd : a.name.localeCompare(b.name)
    }
    if (sortBy === 'dueDate') {
      if (!a.due_date && !b.due_date) return a.name.localeCompare(b.name)
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    }
    return a.name.localeCompare(b.name)
  })

  const activeFilterCount = statusFilter.size + priorityFilter.size

  const toggleStatusFilter = (s: ProjectStatus) => {
    clickSound()
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const togglePriorityFilter = (pri: Priority) => {
    clickSound()
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(pri)) next.delete(pri)
      else next.add(pri)
      return next
    })
  }

  const clearFilters = () => {
    clickSound()
    setStatusFilter(new Set())
    setPriorityFilter(new Set())
  }

  const handleViewModeChange = (mode: ViewMode) => {
    clickSound()
    setViewMode(mode)
    localStorage.setItem('projectViewMode', mode)
  }

  const handleCreate = async (data: { name: string; icon: string | null; priority: Priority; status: ProjectStatus; due_date: string | null }) => {
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

  const handleUpdatePriority = async (id: string, priority: Priority) => {
    try {
      await window.api.projects.update({ id, priority })
      await loadProjects()
    } catch (error) {
      console.error('Failed to update priority:', error)
    }
  }

  const handleUpdateStatus = async (id: string, status: ProjectStatus) => {
    try {
      await window.api.projects.update({ id, status })
      await loadProjects()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const buildProjectMenuItems = (p: Project): ContextMenuEntry[] => [
    { label: 'Open project', icon: FolderOpen, onClick: () => onOpenProject(p) },
    'separator',
    {
      label: 'Set status',
      icon: CircleDot,
      items: STATUS_OPTIONS.map((s) => ({
        label: STATUS_LABELS[s],
        icon: p.status === s ? CheckCircle2 : Circle,
        onClick: () => handleUpdateStatus(p.id, s),
      })),
    },
    {
      label: 'Set priority',
      icon: Flag,
      items: PRIORITY_OPTIONS.map((pri) => ({
        label: PRIORITY_LABELS[pri],
        icon: p.priority === pri ? CheckCircle2 : Circle,
        onClick: () => handleUpdatePriority(p.id, pri),
      })),
    },
    'separator' as const,
    { label: 'Archive project', icon: Archive, onClick: () => handleArchive(p.id) },
    { label: 'Delete project', icon: Trash2, danger: true, onClick: () => setConfirmDelete(p.id) },
  ]

  const progressPercent = (p: Project) =>
    p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0

  const SORT_LABELS: Record<SortMode, string> = { priority: 'Priority', status: 'Status', dueDate: 'Due date', name: 'Name' }

  return (
    <div className="h-full overflow-y-auto bg-surface-sunken">
      <main className="max-w-4xl mx-auto px-6 py-8">
        {projects.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <SortDropdown
                options={(['priority', 'status', 'dueDate', 'name'] as SortMode[]).map((mode) => ({ value: mode, label: SORT_LABELS[mode] }))}
                value={sortBy}
                onChange={setSortBy}
              />
              <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleViewModeChange('list')}
                  title="List view"
                  className={`p-1.5 rounded cursor-pointer transition-colors ${
                    viewMode === 'list' ? 'bg-primary text-ink-inverse' : 'text-ink-faint hover:bg-surface-muted'
                  }`}
                >
                  <List size={14} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleViewModeChange('grid')}
                  title="Grid view"
                  className={`p-1.5 rounded cursor-pointer transition-colors ${
                    viewMode === 'grid' ? 'bg-primary text-ink-inverse' : 'text-ink-faint hover:bg-surface-muted'
                  }`}
                >
                  <LayoutGrid size={14} />
                </motion.button>
              </div>

              <div className="relative" ref={filterMenuRef}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { clickSound(); setIsFilterOpen((open) => !open) }}
                  title="Filter"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                    activeFilterCount > 0
                      ? 'border-accent bg-accent-subtle text-accent-strong font-medium'
                      : 'border-border text-ink-faint hover:bg-surface-muted'
                  }`}
                >
                  <Filter size={14} />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-accent text-ink-inverse text-[10px] font-semibold">
                      {activeFilterCount}
                    </span>
                  )}
                </motion.button>

                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg p-3 min-w-[220px] z-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-ink-secondary">Filter projects</span>
                        {activeFilterCount > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={clearFilters}
                            className="flex items-center gap-1 text-xs text-ink-faint hover:text-danger cursor-pointer transition-colors"
                          >
                            <X size={12} />
                            Clear
                          </motion.button>
                        )}
                      </div>

                      <div className="mb-3">
                        <span className="text-xs text-ink-faint uppercase tracking-wide block mb-1.5">Status</span>
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map((s) => (
                            <motion.button
                              key={s}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleStatusFilter(s)}
                              className={`text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                                statusFilter.has(s)
                                  ? STATUS_BADGES[s] + ' font-semibold ring-1 ring-inset ring-current'
                                  : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
                              }`}
                            >
                              {STATUS_LABELS[s]}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-ink-faint uppercase tracking-wide block mb-1.5">Priority</span>
                        <div className="flex flex-wrap gap-1.5">
                          {PRIORITY_OPTIONS.map((pri) => (
                            <motion.button
                              key={pri}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => togglePriorityFilter(pri)}
                              className={`text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                                priorityFilter.has(pri)
                                  ? PRIORITY_BADGES[pri] + ' font-semibold ring-1 ring-inset ring-current'
                                  : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
                              }`}
                            >
                              {PRIORITY_LABELS[pri]}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { clickSound(); setIsCreatingModalOpen(true); onNewProject?.() }}
              className="px-3 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors cursor-pointer font-medium flex items-center gap-2"
            >
              <Plus size={16} />
              New Project
            </motion.button>
          </div>
        )}

        {projects.length === 0 && !isCreatingModalOpen && (
          <div className="mb-6 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { clickSound(); setIsCreatingModalOpen(true); onNewProject?.() }}
              className="px-3 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors cursor-pointer font-medium flex items-center gap-2"
            >
              <Plus size={16} />
              New Project
            </motion.button>
          </div>
        )}

        {projects.length === 0 && !isCreatingModalOpen && (
          <div className="text-center py-24 text-ink-faint">
            <p className="text-2xl mb-2">🪝</p>
            <p className="text-base font-medium text-ink-muted">No projects yet</p>
          </div>
        )}

        {projects.length > 0 && filtered.length === 0 && (
          <div className="text-center py-24 text-ink-faint">
            <p className="text-base font-medium text-ink-muted">No projects match your filters</p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={clearFilters}
              className="mt-3 text-sm text-accent-hover hover:underline cursor-pointer"
            >
              Clear filters
            </motion.button>
          </div>
        )}

        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-3'}>
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
                  className={`bg-surface rounded-lg border border-border p-4 cursor-pointer ${viewMode === 'grid' ? 'flex flex-col h-full' : ''}`}
                >
                  <div className={viewMode === 'grid' ? 'flex flex-col gap-2 mb-2' : 'flex items-center justify-between mb-2'}>
                    <h3 className="font-heading font-medium text-ink flex items-center gap-1.5">
                      {p.icon && <span className="text-base leading-none">{p.icon}</span>}
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {dueInfo && <span className={`text-xs ${dueInfo.color}`}>{dueInfo.label}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGES[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGES[p.priority]}`}>
                        {p.priority}
                      </span>
                    </div>
                  </div>

                  <div className={viewMode === 'grid' ? 'mt-auto space-y-2' : ''}>
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
                        {p.total_points > 0 ? `${p.done_points}/${p.total_points} pts` : 'No points'}
                      </span>
                    </div>
                    <div className="text-xs text-ink-faint">
                      {p.total_cards > 0 ? `${p.done_cards}/${p.total_cards} tasks` : 'No tasks'}
                    </div>
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
        items={menu ? buildProjectMenuItems(menu.project) : []}
      />
    </div>
  )
}
