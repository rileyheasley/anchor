import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  FolderOpen, CheckCircle2, Circle, Zap, Trash2, Plus, FileText, Search,
  AlertTriangle, Clock, TrendingUp, TrendingDown, Minus, ListChecks, Flag, CalendarClock, CalendarX,
} from 'lucide-react'
import type { Project, RecycleItem, OverviewData, Todo, Priority } from '../types'
import { clickSound, createSound, deleteSound, completeSound } from '../sounds'
import { STATUS_OPTIONS, STATUS_LABELS, STATUS_BADGES } from '../utils/status'
import { PRIORITY_OPTIONS, PRIORITY_LABELS, dueDateInfo } from '../utils/priority'
import ContextMenu, { type ContextMenuEntry, type ContextMenuPosition } from './ContextMenu'

const PRIORITY_DOT_COLORS: Record<Priority, string> = {
  none: '',
  low: 'bg-accent',
  medium: 'bg-warning',
  high: 'bg-danger',
}

function isoDateOffset(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const STATUS_BAR_COLORS: Record<string, string> = {
  planning: 'bg-ink-faint',
  in_progress: 'bg-accent',
  on_hold: 'bg-warning',
  done: 'bg-success',
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatRelative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

interface OverviewHomeProps {
  onOpenProject: (project: Project) => void
  onOpenCard: (cardId: string, projectId: string) => void
  onOpenNote: (noteId: string, projectId: string | null, cardId: string | null) => void
  onNewProject: () => void
  onNewNote: () => void
  onOpenSearch: () => void
}

export default function OverviewHome({
  onOpenProject, onOpenCard, onOpenNote, onNewProject, onNewNote, onOpenSearch,
}: OverviewHomeProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [recycleItems, setRecycleItems] = useState<RecycleItem[]>([])
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodoText, setNewTodoText] = useState('')
  const [todoMenu, setTodoMenu] = useState<{ todo: Todo; position: ContextMenuPosition } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [proj, recycle, overviewData, todoList] = await Promise.all([
        window.api.projects.list(),
        window.api.recycle.list(),
        window.api.overview.get(),
        window.api.todos.list(),
      ])
      setProjects(proj.filter(p => !p.archived))
      setRecycleItems(recycle)
      setOverview(overviewData)
      setTodos(todoList)
    } catch (error) {
      console.error('Failed to load home data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTodo = async () => {
    const text = newTodoText.trim()
    if (!text) return
    try {
      const todo = await window.api.todos.create({ text })
      createSound()
      setTodos((prev) => [...prev, todo])
      setNewTodoText('')
    } catch (error) {
      console.error('Failed to create todo:', error)
    }
  }

  const handleToggleTodo = async (todo: Todo) => {
    todo.done ? clickSound() : completeSound()
    try {
      const updated = await window.api.todos.toggle(todo.id)
      setTodos((prev) => [...prev.filter((t) => t.id !== todo.id), updated].sort((a, b) => a.done - b.done || a.position - b.position))
    } catch (error) {
      console.error('Failed to toggle todo:', error)
    }
  }

  const handleUpdateTodoPriority = async (id: string, priority: Priority) => {
    clickSound()
    try {
      const updated = await window.api.todos.update({ id, priority })
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (error) {
      console.error('Failed to update todo priority:', error)
    }
  }

  const handleUpdateTodoDueDate = async (id: string, due_date: string | null) => {
    clickSound()
    try {
      const updated = await window.api.todos.update({ id, due_date })
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (error) {
      console.error('Failed to update todo due date:', error)
    }
  }

  const handleDeleteTodo = async (id: string) => {
    deleteSound()
    try {
      await window.api.todos.delete(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error('Failed to delete todo:', error)
    }
  }

  const buildTodoMenuItems = (todo: Todo): ContextMenuEntry[] => [
    {
      label: 'Set priority',
      icon: Flag,
      items: PRIORITY_OPTIONS.map((pri) => ({
        label: PRIORITY_LABELS[pri],
        icon: todo.priority === pri ? CheckCircle2 : Circle,
        onClick: () => handleUpdateTodoPriority(todo.id, pri),
      })),
    },
    {
      label: 'Set due date',
      icon: CalendarClock,
      items: [
        { label: 'Today', onClick: () => handleUpdateTodoDueDate(todo.id, isoDateOffset(0)) },
        { label: 'Tomorrow', onClick: () => handleUpdateTodoDueDate(todo.id, isoDateOffset(1)) },
        { label: 'In 3 days', onClick: () => handleUpdateTodoDueDate(todo.id, isoDateOffset(3)) },
        { label: 'Next week', onClick: () => handleUpdateTodoDueDate(todo.id, isoDateOffset(7)) },
        'separator',
        { label: 'No due date', icon: CalendarX, disabled: !todo.due_date, onClick: () => handleUpdateTodoDueDate(todo.id, null) },
      ],
    },
    'separator',
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDeleteTodo(todo.id) },
  ]

  if (loading) {
    return (
      <div className="h-full bg-surface-sunken flex items-center justify-center">
        <div className="text-ink-faint">Loading...</div>
      </div>
    )
  }

  const totalPoints = projects.reduce((sum, p) => sum + (p.total_points || 0), 0)
  const donePoints = projects.reduce((sum, p) => sum + (p.done_points || 0), 0)
  const activeProjects = projects.length
  const recentProjects = projects.slice(0, 5)

  const statusCounts: Record<string, number> = { planning: 0, in_progress: 0, on_hold: 0, done: 0 }
  for (const row of overview?.statusRows ?? []) statusCounts[row.status] = row.count
  const statusTotal = STATUS_OPTIONS.reduce((sum, s) => sum + statusCounts[s], 0)

  const thisWeek = overview?.pointsTrend.this_week ?? 0
  const lastWeek = overview?.pointsTrend.last_week ?? 0
  const weekDelta = thisWeek - lastWeek

  const openProjectById = (id: string) => {
    const project = projects.find(p => p.id === id)
    if (project) onOpenProject(project)
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-sunken">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-bold text-ink mb-2">{getGreeting()}</h1>
            <p className="text-ink-muted">Here's an overview of your projects and activity</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { clickSound(); onNewProject() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border hover:border-border-strong text-sm font-medium text-ink-secondary transition-colors cursor-pointer"
            >
              <Plus size={16} /> Project
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { clickSound(); onNewNote() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border hover:border-border-strong text-sm font-medium text-ink-secondary transition-colors cursor-pointer"
            >
              <FileText size={16} /> Note
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { clickSound(); onOpenSearch() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border hover:border-border-strong text-sm font-medium text-ink-secondary transition-colors cursor-pointer"
            >
              <Search size={16} /> Search
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-lg border border-border p-5 flex items-start gap-3"
          >
            <FolderOpen size={22} className="text-accent shrink-0 mt-1" />
            <div>
              <div className="text-sm text-ink-muted mb-1">Active Projects</div>
              <div className="text-2xl font-bold text-ink">{activeProjects}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface rounded-lg border border-border p-5 flex items-start gap-3"
          >
            <Zap size={22} className="text-warning shrink-0 mt-1" />
            <div>
              <div className="text-sm text-ink-muted mb-1">Total Points</div>
              <div className="text-2xl font-bold text-ink">{totalPoints}</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface rounded-lg border border-border p-5 flex items-start gap-3"
          >
            <CheckCircle2 size={22} className="text-accent-strong shrink-0 mt-1" />
            <div>
              <div className="text-sm text-ink-muted mb-1">Completed</div>
              <div className="text-2xl font-bold text-ink">
                {totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0}%
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-surface rounded-lg border border-border p-5 flex items-start gap-3"
          >
            {weekDelta > 0 ? (
              <TrendingUp size={22} className="text-success shrink-0 mt-1" />
            ) : weekDelta < 0 ? (
              <TrendingDown size={22} className="text-danger shrink-0 mt-1" />
            ) : (
              <Minus size={22} className="text-ink-faint shrink-0 mt-1" />
            )}
            <div>
              <div className="text-sm text-ink-muted mb-1">This Week</div>
              <div className="text-2xl font-bold text-ink">
                {thisWeek} <span className="text-sm font-normal text-ink-faint">pts</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* To-Do */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <ListChecks size={18} className="text-accent" /> To-Do
            {todos.some((t) => !t.done) && (
              <span className="text-sm font-normal text-ink-faint">({todos.filter((t) => !t.done).length})</span>
            )}
          </h2>
          <div className="bg-surface rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo() }}
                placeholder="Add a to-do…"
                className="flex-1 bg-transparent text-sm text-ink placeholder-ink-faint focus:outline-none"
              />
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleAddTodo}
                disabled={!newTodoText.trim()}
                className="p-1.5 rounded-lg bg-primary text-ink-inverse hover:bg-primary-hover transition-colors disabled:opacity-40 cursor-pointer"
                title="Add to-do"
              >
                <Plus size={16} />
              </motion.button>
            </div>

            {todos.length === 0 ? (
              <p className="text-sm text-ink-faint text-center py-6">Nothing on your list yet</p>
            ) : (
              <AnimatePresence>
                {todos.map((todo) => {
                  const due = dueDateInfo(todo.due_date)
                  return (
                    <motion.div
                      key={todo.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      onContextMenu={(e) => { e.preventDefault(); setTodoMenu({ todo, position: { x: e.clientX, y: e.clientY } }) }}
                      className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-subtle last:border-b-0 hover:bg-surface-sunken transition-colors"
                    >
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleToggleTodo(todo)}
                        className={`shrink-0 cursor-pointer transition-colors ${todo.done ? 'text-success' : 'text-ink-faint hover:text-ink-secondary'}`}
                      >
                        {todo.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </motion.button>
                      <span className={`flex-1 text-sm truncate ${todo.done ? 'text-ink-faint line-through' : 'text-ink'}`}>
                        {todo.text}
                      </span>
                      {!todo.done && todo.priority !== 'none' && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT_COLORS[todo.priority]}`} title={todo.priority} />
                      )}
                      {!todo.done && due && <span className={`text-xs shrink-0 ${due.color}`}>{due.label}</span>}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        <ContextMenu
          position={todoMenu?.position ?? null}
          onClose={() => setTodoMenu(null)}
          items={todoMenu ? buildTodoMenuItems(todoMenu.todo) : []}
        />

        {/* Needs Attention */}
        {overview && overview.dueCards.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" /> Needs Attention
            </h2>
            <div className="space-y-2">
              {overview.dueCards.map((card, i) => {
                const due = dueDateInfo(card.due_date)
                return (
                  <motion.button
                    key={card.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.995 }}
                    onClick={() => { clickSound(); onOpenCard(card.id, card.project_id) }}
                    className="w-full bg-surface rounded-lg border border-border px-4 py-3 text-left hover:border-border-strong transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{card.title}</div>
                      <div className="text-xs text-ink-faint truncate">{card.project_name}</div>
                    </div>
                    {due && <span className={`text-xs shrink-0 ${due.color}`}>{due.label}</span>}
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}

        {/* Stale Projects */}
        {overview && overview.staleProjects.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
              <Clock size={18} className="text-ink-faint" /> Could Use a Look
            </h2>
            <div className="space-y-2">
              {overview.staleProjects.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => { clickSound(); openProjectById(p.id) }}
                  className="w-full bg-surface rounded-lg border border-border px-4 py-3 text-left hover:border-border-strong transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGES[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    <span className="text-xs text-ink-faint">Active {formatRelative(p.last_activity)}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Status Breakdown */}
        {statusTotal > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-lg font-semibold text-ink mb-4">Project Status</h2>
            <div className="bg-surface rounded-lg border border-border p-5">
              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-surface-muted">
                {STATUS_OPTIONS.map((s) => (
                  statusCounts[s] > 0 && (
                    <motion.div
                      key={s}
                      className={STATUS_BAR_COLORS[s]}
                      initial={{ width: 0 }}
                      animate={{ width: `${(statusCounts[s] / statusTotal) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  )
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
                {STATUS_OPTIONS.map((s) => (
                  <div key={s} className="flex items-center gap-1.5 text-sm text-ink-muted">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_BAR_COLORS[s]}`} />
                    {STATUS_LABELS[s]} <span className="text-ink-faint">({statusCounts[s]})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {activeProjects > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-lg font-semibold text-ink mb-4">Recent Projects</h2>
            <div className="space-y-3">
              <AnimatePresence>
                {recentProjects.map((p, i) => {
                  const progress = p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-md)' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => { clickSound(); onOpenProject(p) }}
                      className="w-full bg-surface rounded-lg border border-border p-4 text-left hover:border-border-strong transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-medium text-ink">{p.name}</h3>
                        <span className="text-sm text-ink-faint">{p.done_points}/{p.total_points} pts</span>
                      </div>
                      <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          className="bg-accent h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Recent Notes */}
        {overview && overview.recentNotes.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-lg font-semibold text-ink mb-4">Recent Notes</h2>
            <div className="space-y-2">
              {overview.recentNotes.map((note, i) => (
                <motion.button
                  key={note.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => { clickSound(); onOpenNote(note.id, note.resolved_project_id, note.card_id) }}
                  className="w-full bg-surface rounded-lg border border-border px-4 py-3 text-left hover:border-border-strong transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={15} className="text-ink-faint shrink-0" />
                    <span className="text-sm font-medium text-ink truncate">{note.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {note.project_name && <span className="text-xs text-ink-faint">{note.project_name}</span>}
                    <span className="text-xs text-ink-faint">{formatRelative(note.updated_at)}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeProjects === 0 && (
          <div className="text-center py-16 text-ink-faint">
            <p className="text-2xl mb-2">🪝</p>
            <p className="text-base font-medium text-ink-muted">No projects yet</p>
            <p className="text-sm mt-2 text-ink-faint">Go to <span className="font-medium">Projects</span> to create your first one</p>
          </div>
        )}

        {/* Recycle Bin Info */}
        {recycleItems.length > 0 && (
          <div className="p-4 bg-surface rounded-lg border border-border flex items-start gap-3">
            <Trash2 size={18} className="text-ink-faint shrink-0 mt-0.5" />
            <p className="text-sm text-ink-muted flex-1">
              <span className="font-medium text-ink-secondary">{recycleItems.length}</span> items in Recycle Bin (will be permanently deleted in <span className="font-medium text-ink-secondary">30</span> days)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
