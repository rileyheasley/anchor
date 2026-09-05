import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, FolderOpen, Trash2, Link2, ChevronDown, FileText, Workflow } from 'lucide-react'
import type { Project, Priority, ProjectStatus, Note, Canvas } from '../types'
import { clickSound, createSound, deleteSound, moveSound } from '../sounds'
import NoteCard from './NoteCard'
import NoteEditModal from './NoteEditModal'
import CanvasCard from './CanvasCard'
import CanvasEditModal from './CanvasEditModal'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuPosition } from './ContextMenu'
import IconPicker from './IconPicker'
import DatePicker from './DatePicker'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'
import { PRIORITY_BADGES, PRIORITY_LABELS, dueDateInfo } from '../utils/priority'
import { STATUS_OPTIONS, STATUS_BADGES, STATUS_LABELS } from '../utils/status'

interface ProjectHeaderProps {
  project: Project
  onUpdateProject: (data: { name?: string; icon?: string | null; priority?: Priority; status?: ProjectStatus; due_date?: string | null }) => Promise<void>
  totalPoints: number
  donePoints: number
  isLoading?: boolean
  focusNoteId?: string | null
  onFocusNoteHandled?: () => void
  focusCanvasId?: string | null
  onFocusCanvasHandled?: () => void
}

export default function ProjectHeader({
  project,
  onUpdateProject,
  totalPoints,
  donePoints,
  isLoading,
  focusNoteId,
  onFocusNoteHandled,
  focusCanvasId,
  onFocusCanvasHandled,
}: ProjectHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(project.name)
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [draggedNote, setDraggedNote] = useState<Note | null>(null)
  const [noteMenu, setNoteMenu] = useState<{ note: Note; position: ContextMenuPosition } | null>(null)
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<Note | null>(null)
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [editingCanvas, setEditingCanvas] = useState<Canvas | null>(null)
  const [draggedCanvas, setDraggedCanvas] = useState<Canvas | null>(null)
  const [canvasMenu, setCanvasMenu] = useState<{ canvas: Canvas; position: ContextMenuPosition } | null>(null)
  const [confirmDeleteCanvas, setConfirmDeleteCanvas] = useState<Canvas | null>(null)
  const [standaloneNotes, setStandaloneNotes] = useState<Note[]>([])
  const [standaloneCanvases, setStandaloneCanvases] = useState<Canvas[]>([])
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false)
  const linkMenuRef = useRef<HTMLDivElement>(null)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false)
  const priorityMenuRef = useRef<HTMLDivElement>(null)
  const [displayPriority, setDisplayPriority] = useState<Priority>(project.priority)
  const [displayStatus, setDisplayStatus] = useState<ProjectStatus>(project.status)
  const [displayDueDate, setDisplayDueDate] = useState<string | null>(project.due_date)
  const [displayIcon, setDisplayIcon] = useState<string | null>(project.icon)

  useEffect(() => {
    setDisplayPriority(project.priority)
    setDisplayStatus(project.status)
    setDisplayDueDate(project.due_date)
    setDisplayIcon(project.icon)
  }, [project.priority, project.status, project.due_date, project.icon])

  // Only re-run when the project identity changes — loadProjectNotes/loadProjectCanvases are fresh closures every render.
  useEffect(() => {
    loadProjectNotes()
    loadProjectCanvases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  // Deep-link support: open a specific note's editor once it's loaded (e.g. from search)
  useEffect(() => {
    if (!focusNoteId || notes.length === 0) return
    const note = notes.find((n) => n.id === focusNoteId)
    if (note) {
      setEditingNote(note)
      onFocusNoteHandled?.()
    }
    // Only re-run when the deep-link target or list changes — onFocusNoteHandled is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNoteId, notes])

  // Deep-link support: open a specific canvas's editor once it's loaded (e.g. from search)
  useEffect(() => {
    if (!focusCanvasId || canvases.length === 0) return
    const canvas = canvases.find((c) => c.id === focusCanvasId)
    if (canvas) {
      setEditingCanvas(canvas)
      onFocusCanvasHandled?.()
    }
    // Only re-run when the deep-link target or list changes — onFocusCanvasHandled is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCanvasId, canvases])

  const loadProjectNotes = async () => {
    try {
      const projectNotes = await window.api.notes.list({ project_id: project.id, standalone: true })
      setNotes(projectNotes)
    } catch (error) {
      console.error('Failed to load project notes:', error)
    }
  }

  const loadProjectCanvases = async () => {
    try {
      const projectCanvases = await window.api.canvases.list({ project_id: project.id })
      setCanvases(projectCanvases)
    } catch (error) {
      console.error('Failed to load project canvases:', error)
    }
  }

  const handleUpdateName = async () => {
    if (!editedName.trim() || editedName === project.name) {
      setEditedName(project.name)
      setIsEditingName(false)
      return
    }
    try {
      await onUpdateProject({ name: editedName.trim() })
      setIsEditingName(false)
    } catch (error) {
      console.error('Failed to update project name:', error)
      setEditedName(project.name)
    }
  }

  const handleUpdateIcon = async (newIcon: string | null) => {
    setDisplayIcon(newIcon)
    try {
      await onUpdateProject({ icon: newIcon })
    } catch (error) {
      console.error('Failed to update icon:', error)
      setDisplayIcon(project.icon)
    }
  }

  const handleUpdatePriority = async (newPriority: Priority) => {
    clickSound()
    setIsPriorityMenuOpen(false)
    setDisplayPriority(newPriority)
    try {
      await onUpdateProject({ priority: newPriority })
    } catch (error) {
      console.error('Failed to update priority:', error)
      setDisplayPriority(project.priority)
    }
  }

  const handleUpdateStatus = async (newStatus: ProjectStatus) => {
    clickSound()
    setIsStatusMenuOpen(false)
    setDisplayStatus(newStatus)
    try {
      await onUpdateProject({ status: newStatus })
    } catch (error) {
      console.error('Failed to update status:', error)
      setDisplayStatus(project.status)
    }
  }

  const handleUpdateDueDate = async (newDueDate: string | null) => {
    clickSound()
    setDisplayDueDate(newDueDate)
    try {
      await onUpdateProject({ due_date: newDueDate })
    } catch (error) {
      console.error('Failed to update due date:', error)
      setDisplayDueDate(project.due_date)
    }
  }

  useEscapeKey(() => setIsLinkMenuOpen(false), isLinkMenuOpen)
  useEscapeKey(() => setIsStatusMenuOpen(false), isStatusMenuOpen)
  useEscapeKey(() => setIsPriorityMenuOpen(false), isPriorityMenuOpen)
  useEscapeKey(() => setIsAddMenuOpen(false), isAddMenuOpen)

  useClickOutside(linkMenuRef, () => setIsLinkMenuOpen(false), isLinkMenuOpen)
  useClickOutside(statusMenuRef, () => setIsStatusMenuOpen(false), isStatusMenuOpen)
  useClickOutside(priorityMenuRef, () => setIsPriorityMenuOpen(false), isPriorityMenuOpen)
  useClickOutside(addMenuRef, () => setIsAddMenuOpen(false), isAddMenuOpen)

  const handleOpenLinkMenu = async () => {
    clickSound()
    if (!isLinkMenuOpen) {
      try {
        const [allNotes, allCanvases] = await Promise.all([
          window.api.notes.list({ standalone: true }),
          window.api.canvases.list({ standalone: true }),
        ])
        setStandaloneNotes(allNotes.filter((n) => n.linked_project_id !== project.id))
        setStandaloneCanvases(allCanvases.filter((c) => c.linked_project_id !== project.id))
      } catch (error) {
        console.error('Failed to load standalone notes/canvases:', error)
      }
    }
    setIsLinkMenuOpen((open) => !open)
  }

  const handleLinkNote = async (note: Note) => {
    clickSound()
    try {
      await window.api.notes.link({ id: note.id, project_id: project.id })
      await loadProjectNotes()
    } catch (error) {
      console.error('Failed to link note:', error)
    }
    setIsLinkMenuOpen(false)
  }

  const handleUnlinkNote = async (note: Note) => {
    clickSound()
    try {
      await window.api.notes.unlink(note.id)
      await loadProjectNotes()
    } catch (error) {
      console.error('Failed to unlink note:', error)
    }
  }

  const handleCreateNote = async () => {
    setIsAddMenuOpen(false)
    try {
      const newNote = await window.api.notes.create({
        title: 'New note',
        project_id: project.id,
      })
      if (newNote) {
        createSound()
        setEditingNote(newNote)
        await loadProjectNotes()
      }
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }

  const handleLinkCanvas = async (canvas: Canvas) => {
    clickSound()
    try {
      await window.api.canvases.link({ id: canvas.id, project_id: project.id })
      await loadProjectCanvases()
    } catch (error) {
      console.error('Failed to link canvas:', error)
    }
    setIsLinkMenuOpen(false)
  }

  const handleUnlinkCanvas = async (canvas: Canvas) => {
    clickSound()
    try {
      await window.api.canvases.unlink(canvas.id)
      await loadProjectCanvases()
    } catch (error) {
      console.error('Failed to unlink canvas:', error)
    }
  }

  const handleCreateCanvas = async () => {
    setIsAddMenuOpen(false)
    try {
      const newCanvas = await window.api.canvases.create({
        title: 'New canvas',
        project_id: project.id,
      })
      if (newCanvas) {
        createSound()
        setEditingCanvas(newCanvas)
        await loadProjectCanvases()
      }
    } catch (error) {
      console.error('Failed to create canvas:', error)
    }
  }

  const handleSaveNote = async (content: string, title: string) => {
    if (!editingNote) return
    try {
      // Update the title
      const updatedNote = await window.api.notes.update({ id: editingNote.id, title })
      if (updatedNote) {
        // Update the editing note so the modal shows the new title
        setEditingNote(updatedNote)
        // Also update it in the notes array for immediate display
        setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n))
      }
      // Save the content
      await window.api.notes.saveContent(editingNote.id, content)
      // Reload notes to reflect all changes
      await loadProjectNotes()
    } catch (error) {
      console.error('Failed to save note:', error)
      throw error
    }
  }

  const handleDeleteNote = async () => {
    if (!editingNote) return
    try {
      if (editingNote.linked_project_id === project.id) {
        await window.api.notes.unlink(editingNote.id)
      } else {
        await window.api.notes.delete(editingNote.id)
      }
      await loadProjectNotes()
    } catch (error) {
      console.error('Failed to delete note:', error)
      throw error
    }
  }

  const confirmDeleteNoteAction = async () => {
    if (!confirmDeleteNote) return
    deleteSound()
    try {
      await window.api.notes.delete(confirmDeleteNote.id)
      if (editingNote?.id === confirmDeleteNote.id) setEditingNote(null)
      await loadProjectNotes()
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
    setConfirmDeleteNote(null)
  }

  const handleDragStart = (note: Note) => {
    setDraggedNote(note)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetNote: Note) => {
    if (!draggedNote || draggedNote.id === targetNote.id) return

    const draggedIndex = notes.findIndex(n => n.id === draggedNote.id)
    const targetIndex = notes.findIndex(n => n.id === targetNote.id)

    const newNotes = [...notes]
    newNotes.splice(draggedIndex, 1)
    newNotes.splice(targetIndex, 0, draggedNote)

    setNotes(newNotes)
    setDraggedNote(null)
    moveSound()
    window.api.notes.reorder({ ids: newNotes.map(n => n.id) }).catch((error) => {
      console.error('Failed to persist note order:', error)
    })
  }

  const handleSaveCanvas = async (content: string, title: string) => {
    if (!editingCanvas) return
    try {
      const updatedCanvas = await window.api.canvases.update({ id: editingCanvas.id, title })
      if (updatedCanvas) {
        setEditingCanvas(updatedCanvas)
        setCanvases(canvases.map(c => c.id === updatedCanvas.id ? updatedCanvas : c))
      }
      await window.api.canvases.saveContent(editingCanvas.id, content)
      await loadProjectCanvases()
    } catch (error) {
      console.error('Failed to save canvas:', error)
      throw error
    }
  }

  const handleDeleteCanvas = async () => {
    if (!editingCanvas) return
    try {
      if (editingCanvas.linked_project_id === project.id) {
        await window.api.canvases.unlink(editingCanvas.id)
      } else {
        await window.api.canvases.delete(editingCanvas.id)
      }
      await loadProjectCanvases()
    } catch (error) {
      console.error('Failed to delete canvas:', error)
      throw error
    }
  }

  const confirmDeleteCanvasAction = async () => {
    if (!confirmDeleteCanvas) return
    deleteSound()
    try {
      await window.api.canvases.delete(confirmDeleteCanvas.id)
      if (editingCanvas?.id === confirmDeleteCanvas.id) setEditingCanvas(null)
      await loadProjectCanvases()
    } catch (error) {
      console.error('Failed to delete canvas:', error)
    }
    setConfirmDeleteCanvas(null)
  }

  const handleCanvasDragStart = (canvas: Canvas) => {
    setDraggedCanvas(canvas)
  }

  const handleCanvasDrop = (targetCanvas: Canvas) => {
    if (!draggedCanvas || draggedCanvas.id === targetCanvas.id) return

    const draggedIndex = canvases.findIndex(c => c.id === draggedCanvas.id)
    const targetIndex = canvases.findIndex(c => c.id === targetCanvas.id)

    const newCanvases = [...canvases]
    newCanvases.splice(draggedIndex, 1)
    newCanvases.splice(targetIndex, 0, draggedCanvas)

    setCanvases(newCanvases)
    setDraggedCanvas(null)
    moveSound()
    window.api.canvases.reorder({ ids: newCanvases.map(c => c.id) }).catch((error) => {
      console.error('Failed to persist canvas order:', error)
    })
  }

  const progressPercent = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0
  const dueInfo = dueDateInfo(displayDueDate)


  return (
    <div className="border-b border-border-subtle bg-surface px-6 py-4 space-y-3 shrink-0">
      {/* Title */}
      <div className="flex items-center gap-2">
        <IconPicker value={displayIcon} onChange={handleUpdateIcon} disabled={isLoading} />
        {isEditingName ? (
          <input
            autoFocus
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdateName()
              if (e.key === 'Escape') {
                setEditedName(project.name)
                setIsEditingName(false)
              }
            }}
            onBlur={handleUpdateName}
            disabled={isLoading}
            className="font-heading text-2xl font-bold bg-surface-sunken text-ink border border-border-strong rounded-lg px-3 py-2 w-full flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
          />
        ) : (
          <motion.button
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            onClick={() => {
              clickSound()
              setIsEditingName(true)
            }}
            className="font-heading text-2xl font-bold text-ink hover:text-accent-hover transition-colors cursor-pointer text-left flex-1 min-w-0 break-words"
          >
            {project.name}
          </motion.button>
        )}
      </div>

      {/* Controls + Progress Row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown */}
          <div className="relative" ref={statusMenuRef}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                clickSound()
                setIsStatusMenuOpen((open) => !open)
                setIsPriorityMenuOpen(false)
              }}
              disabled={isLoading}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 font-semibold ${STATUS_BADGES[displayStatus]}`}
            >
              {STATUS_LABELS[displayStatus]}
              <ChevronDown size={12} />
            </motion.button>

            <AnimatePresence>
              {isStatusMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[150px] z-50"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleUpdateStatus(s)}
                      className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-surface-sunken ${
                        displayStatus === s ? 'font-semibold text-ink' : 'text-ink-secondary'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Priority dropdown */}
          <div className="relative" ref={priorityMenuRef}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                clickSound()
                setIsPriorityMenuOpen((open) => !open)
                setIsStatusMenuOpen(false)
              }}
              disabled={isLoading}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 font-semibold ${PRIORITY_BADGES[displayPriority]}`}
            >
              {PRIORITY_LABELS[displayPriority]}
              <ChevronDown size={12} />
            </motion.button>

            <AnimatePresence>
              {isPriorityMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[130px] z-50"
                >
                  {(['none', 'low', 'medium', 'high'] as const).map((p) => (
                    <motion.button
                      key={p}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleUpdatePriority(p)}
                      className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-surface-sunken ${
                        displayPriority === p ? 'font-semibold text-ink' : 'text-ink-secondary'
                      }`}
                    >
                      {PRIORITY_LABELS[p]}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-1.5 bg-surface-muted rounded-lg px-2.5 py-1.5">
            <DatePicker value={displayDueDate} onChange={handleUpdateDueDate} disabled={isLoading} variant="inline" placeholder="Due date" />
            {dueInfo && <span className={`text-xs font-medium whitespace-nowrap ${dueInfo.color}`}>{dueInfo.label}</span>}
          </div>
        </div>

        {/* Progress */}
        {totalPoints > 0 && (
          <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
            <div className="flex-1 bg-surface-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-ink-faint whitespace-nowrap">
              {donePoints}/{totalPoints} ({progressPercent}%)
            </span>
          </div>
        )}
      </div>

      {/* Resources Section */}
      <div>
        <h3 className="text-xs text-ink-faint uppercase tracking-wide font-medium mb-3">Resources</h3>

        <div className="flex flex-wrap gap-2 items-center">
          {notes.length === 0 && canvases.length === 0 ? (
            <p className="text-xs text-ink-faint">No resources yet.</p>
          ) : (
            <AnimatePresence>
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  linked={note.linked_project_id === project.id}
                  onClick={(n) => setEditingNote(n)}
                  onDragStart={(n) => handleDragStart(n)}
                  onDragEnd={() => setDraggedNote(null)}
                  onDragOver={handleDragOver}
                  onDrop={(_e, n) => {
                    handleDrop(n)
                  }}
                  onContextMenu={(e, n) => setNoteMenu({ note: n, position: { x: e.clientX, y: e.clientY } })}
                  isDragging={draggedNote?.id === note.id}
                />
              ))}
              {canvases.map((canvas) => (
                <CanvasCard
                  key={canvas.id}
                  canvas={canvas}
                  linked={canvas.linked_project_id === project.id}
                  onClick={(c) => setEditingCanvas(c)}
                  onDragStart={(c) => handleCanvasDragStart(c)}
                  onDragEnd={() => setDraggedCanvas(null)}
                  onDragOver={handleDragOver}
                  onDrop={(_e, c) => {
                    handleCanvasDrop(c)
                  }}
                  onContextMenu={(e, c) => setCanvasMenu({ canvas: c, position: { x: e.clientX, y: e.clientY } })}
                  isDragging={draggedCanvas?.id === canvas.id}
                />
              ))}
            </AnimatePresence>
          )}

          <div className="relative" ref={addMenuRef}>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { clickSound(); setIsAddMenuOpen((open) => !open) }}
              disabled={isLoading}
              className="p-2 rounded-lg bg-primary text-ink-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
              title="Add a resource"
            >
              <Plus size={16} />
            </motion.button>

            <AnimatePresence>
              {isAddMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[160px] z-50"
                >
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateNote}
                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                  >
                    <FileText size={14} className="text-ink-faint shrink-0" />
                    Note
                  </motion.button>
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateCanvas}
                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                  >
                    <Workflow size={14} className="text-ink-faint shrink-0" />
                    Canvas
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={linkMenuRef}>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleOpenLinkMenu}
              disabled={isLoading}
              className="p-2 rounded-lg bg-surface-muted text-ink-muted hover:bg-border-strong hover:text-ink-secondary transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
              title="Link an existing note or canvas"
            >
              <Link2 size={16} />
            </motion.button>

            <AnimatePresence>
              {isLinkMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[240px] max-h-72 overflow-y-auto z-50"
                >
                  {standaloneNotes.length === 0 && standaloneCanvases.length === 0 ? (
                    <p className="text-xs text-ink-faint px-3 py-2">Nothing to link</p>
                  ) : (
                    <>
                      {standaloneNotes.length > 0 && (
                        <>
                          <div className="text-xs text-ink-faint uppercase tracking-wide px-3 py-1.5">Notes</div>
                          {standaloneNotes.map((note) => (
                            <motion.button
                              key={note.id}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleLinkNote(note)}
                              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                            >
                              <FileText size={13} className="text-ink-faint shrink-0" />
                              <span className="truncate">{note.title}</span>
                            </motion.button>
                          ))}
                        </>
                      )}
                      {standaloneCanvases.length > 0 && (
                        <>
                          <div className="text-xs text-ink-faint uppercase tracking-wide px-3 py-1.5">Canvases</div>
                          {standaloneCanvases.map((canvas) => (
                            <motion.button
                              key={canvas.id}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleLinkCanvas(canvas)}
                              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                            >
                              <Workflow size={13} className="text-ink-faint shrink-0" />
                              <span className="truncate">{canvas.title}</span>
                            </motion.button>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <NoteEditModal
        isOpen={editingNote !== null}
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
        {...(editingNote?.linked_project_id === project.id
          ? {
              deleteTitle: 'Unlink note',
              confirmTitle: 'Unlink note?',
              confirmMessage: 'This note will no longer appear on this project, but it will stay on the Notes screen.',
              confirmButtonText: 'Unlink',
            }
          : {})}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteNote}
        title="Delete note?"
        message="This note will be moved to the recycle bin. You can restore it later."
        confirmText="Delete"
        onConfirm={confirmDeleteNoteAction}
        onCancel={() => setConfirmDeleteNote(null)}
      />

      <ContextMenu
        position={noteMenu?.position ?? null}
        onClose={() => setNoteMenu(null)}
        items={
          noteMenu
            ? [
                { label: 'Open note', icon: FolderOpen, onClick: () => setEditingNote(noteMenu.note) },
                'separator',
                noteMenu.note.linked_project_id === project.id
                  ? { label: 'Unlink note', icon: Link2, onClick: () => handleUnlinkNote(noteMenu.note) }
                  : { label: 'Delete note', icon: Trash2, danger: true, onClick: () => setConfirmDeleteNote(noteMenu.note) },
              ]
            : []
        }
      />

      <CanvasEditModal
        isOpen={editingCanvas !== null}
        canvas={editingCanvas}
        onClose={() => setEditingCanvas(null)}
        onSave={handleSaveCanvas}
        onDelete={handleDeleteCanvas}
        {...(editingCanvas?.linked_project_id === project.id
          ? {
              deleteTitle: 'Unlink canvas',
              confirmTitle: 'Unlink canvas?',
              confirmMessage: 'This canvas will no longer appear on this project, but it will stay on the Canvases screen.',
              confirmButtonText: 'Unlink',
            }
          : {})}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteCanvas}
        title="Delete canvas?"
        message="This canvas will be moved to the recycle bin. You can restore it later."
        confirmText="Delete"
        onConfirm={confirmDeleteCanvasAction}
        onCancel={() => setConfirmDeleteCanvas(null)}
      />

      <ContextMenu
        position={canvasMenu?.position ?? null}
        onClose={() => setCanvasMenu(null)}
        items={
          canvasMenu
            ? [
                { label: 'Open canvas', icon: FolderOpen, onClick: () => setEditingCanvas(canvasMenu.canvas) },
                'separator',
                canvasMenu.canvas.linked_project_id === project.id
                  ? { label: 'Unlink canvas', icon: Link2, onClick: () => handleUnlinkCanvas(canvasMenu.canvas) }
                  : { label: 'Delete canvas', icon: Trash2, danger: true, onClick: () => setConfirmDeleteCanvas(canvasMenu.canvas) },
              ]
            : []
        }
      />
    </div>
  )
}
