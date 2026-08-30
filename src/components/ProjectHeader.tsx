import { useState, useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { Plus } from 'lucide-react'
import type { Project, Priority, Note } from '../types'
import { clickSound, createSound } from '../sounds'
import NoteCard from './NoteCard'
import NoteEditModal from './NoteEditModal'

interface ProjectHeaderProps {
  project: Project
  onUpdateProject: (data: { name?: string; priority?: Priority; due_date?: string | null }) => Promise<void>
  totalPoints: number
  donePoints: number
  isLoading?: boolean
}

const PRIORITY_BADGES: Record<string, string> = {
  none: 'bg-surface-muted text-ink-muted',
  low: 'bg-accent-subtle text-accent-strong',
  medium: 'bg-warning-subtle text-warning-strong',
  high: 'bg-danger-subtle text-danger-strong',
}

export default function ProjectHeader({
  project,
  onUpdateProject,
  totalPoints,
  donePoints,
  isLoading,
}: ProjectHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(project.name)
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [draggedNote, setDraggedNote] = useState<Note | null>(null)
  const [displayPriority, setDisplayPriority] = useState<Priority>(project.priority)
  const [displayDueDate, setDisplayDueDate] = useState<string | null>(project.due_date)

  useEffect(() => {
    setDisplayPriority(project.priority)
    setDisplayDueDate(project.due_date)
  }, [project.priority, project.due_date])

  useEffect(() => {
    loadProjectNotes()
  }, [project.id])

  const loadProjectNotes = async () => {
    try {
      const projectNotes = await window.api.notes.list({ project_id: project.id, standalone: true })
      setNotes(projectNotes)
    } catch (error) {
      console.error('Failed to load project notes:', error)
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

  const handleUpdatePriority = async (newPriority: Priority) => {
    clickSound()
    setDisplayPriority(newPriority)
    try {
      await onUpdateProject({ priority: newPriority })
    } catch (error) {
      console.error('Failed to update priority:', error)
      setDisplayPriority(project.priority)
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

  const handleCreateNote = async () => {
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
      await window.api.notes.delete(editingNote.id)
      await loadProjectNotes()
    } catch (error) {
      console.error('Failed to delete note:', error)
      throw error
    }
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
    window.api.notes.reorder({ ids: newNotes.map(n => n.id) }).catch((error) => {
      console.error('Failed to persist note order:', error)
    })
  }

  const progressPercent = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0

  const dueInfo = (() => {
    if (!displayDueDate) return null
    const due = new Date(displayDueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-danger' }
    if (diff === 0) return { label: 'Due today', color: 'text-danger' }
    if (diff <= 3) return { label: `Due in ${diff}d`, color: 'text-warning' }
    if (diff <= 7) return { label: `Due in ${diff}d`, color: 'text-warning-hover' }
    return { label: `Due in ${diff}d`, color: 'text-ink-faint' }
  })()

  return (
    <div className="border-b border-border-subtle bg-surface px-6 py-4 space-y-4 shrink-0">
      {/* Title and Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
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
              className="text-2xl font-bold bg-surface-sunken text-ink border border-border-strong rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            />
          ) : (
            <button
              onClick={() => {
                clickSound()
                setIsEditingName(true)
              }}
              className="text-2xl font-bold text-ink hover:text-accent-hover transition-colors cursor-pointer text-left w-full break-words"
            >
              {project.name}
            </button>
          )}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Priority */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint uppercase tracking-wide">Priority:</span>
          <div className="flex gap-1.5">
            {(['none', 'low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handleUpdatePriority(p)}
                disabled={isLoading}
                className={`text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors disabled:opacity-50 ${
                  displayPriority === p
                    ? PRIORITY_BADGES[p] + ' font-semibold'
                    : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint uppercase tracking-wide">Due:</span>
          <input
            type="date"
            value={displayDueDate ?? ''}
            onChange={(e) => handleUpdateDueDate(e.target.value || null)}
            disabled={isLoading}
            className="bg-surface-sunken text-ink border border-border-strong rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            style={{ colorScheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light' }}
          />
          {dueInfo && <span className={`text-xs font-medium ${dueInfo.color}`}>{dueInfo.label}</span>}
        </div>
      </div>

      {/* Progress Bar */}
      {totalPoints > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-surface-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-ink-faint whitespace-nowrap">
            {donePoints}/{totalPoints} pts ({progressPercent}%)
          </span>
        </div>
      )}

      {/* Notes Section */}
      <div>
        <h3 className="text-xs text-ink-faint uppercase tracking-wide font-medium mb-3">Project Notes</h3>

        {notes.length > 0 ? (
          <div className="flex flex-wrap gap-2 items-center">
            <AnimatePresence>
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={(n) => setEditingNote(n)}
                  onDragStart={(n) => handleDragStart(n)}
                  onDragEnd={() => setDraggedNote(null)}
                  onDragOver={handleDragOver}
                  onDrop={(_e, n) => {
                    handleDrop(n)
                  }}
                  isDragging={draggedNote?.id === note.id}
                />
              ))}
            </AnimatePresence>
            <button
              onClick={handleCreateNote}
              disabled={isLoading}
              className="p-2 rounded-lg bg-primary text-ink-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
              title="New note"
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-xs text-ink-faint">No notes yet. Click the button to create one.</p>
            <button
              onClick={handleCreateNote}
              disabled={isLoading}
              className="p-2 rounded-lg bg-primary text-ink-inverse hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
              title="New note"
            >
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      <NoteEditModal
        isOpen={editingNote !== null}
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />
    </div>
  )
}
