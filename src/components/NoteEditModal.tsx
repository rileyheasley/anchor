import { useState, useEffect, useRef } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { Note } from '../types'
import { clickSound, deleteSound } from '../sounds'
import MarkdownEditor from './MarkdownEditor'
import ConfirmDialog from './ConfirmDialog'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface NoteEditModalProps {
  isOpen: boolean
  note: Note | null
  onClose: () => void
  onSave: (content: string, title: string) => Promise<void>
  onDelete: () => Promise<void>
  isLoading?: boolean
}

export default function NoteEditModal({
  isOpen,
  note,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
}: NoteEditModalProps) {
  const [title, setTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const activeNoteIdRef = useRef<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (note && isOpen) {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setTitle(note.title)
      activeNoteIdRef.current = note.id
      loadNoteContent(note.id)
    }
  }, [note?.id, isOpen])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [isEditingTitle])

  const loadNoteContent = async (noteId: string) => {
    try {
      const text = await window.api.notes.getContent(noteId)
      if (activeNoteIdRef.current !== noteId) return
      setContent(text ?? '')
    } catch (error) {
      console.error('Failed to load note content:', error)
    }
  }

  const handleSave = async (overrideContent?: string) => {
    if (!note) return
    setIsSaving(true)
    try {
      await onSave(overrideContent ?? content, title)
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTitleSave = async () => {
    setIsEditingTitle(false)
    if (isSaving) return
    setIsSaving(true)
    try {
      await onSave(content, title)
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(true)
  }

  const confirmDeleteAction = async () => {
    if (!note) return
    deleteSound()
    try {
      await onDelete()
      onClose()
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
    setConfirmDelete(false)
  }

  const handleClose = () => {
    clickSound()
    if (saveTimer.current) clearTimeout(saveTimer.current)
    onClose()
  }

  useEscapeKey(handleClose, isOpen && !confirmDelete)
  useFocusTrap(panelRef, isOpen && !confirmDelete)

  if (!isOpen || !note) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit note"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border-subtle rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave()
                if (e.key === 'Escape') {
                  setIsEditingTitle(false)
                  setTitle(note.title)
                }
              }}
              onBlur={handleTitleSave}
              disabled={isLoading || isSaving}
              className="font-heading flex-1 text-lg font-medium bg-surface-sunken text-ink border border-border-strong rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 mr-2"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="font-heading text-lg font-medium text-ink hover:text-accent-hover transition-colors cursor-pointer text-left flex-1 truncate mr-2"
            >
              {title}
            </button>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDelete}
              disabled={isLoading || isSaving}
              className="p-1 rounded-lg text-ink-muted hover:text-danger hover:bg-surface-sunken transition-colors disabled:opacity-50 cursor-pointer"
              title="Delete note"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleClose}
              disabled={isLoading || isSaving}
              className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <MarkdownEditor
            content={content}
            onChange={(markdown) => {
              setContent(markdown)
              if (saveTimer.current) clearTimeout(saveTimer.current)
              saveTimer.current = setTimeout(() => {
                handleSave(markdown)
              }, 1500)
            }}
            onBlur={handleSave}
            placeholder="Write your note in markdown... (first line will be the title)"
          />
        </div>

        {/* Footer */}
        {isSaving && (
          <div className="flex items-center p-4 border-t border-border-subtle shrink-0">
            <span className="text-xs text-ink-faint">Saving…</span>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete note?"
        message="This note will be moved to the recycle bin. You can restore it later."
        confirmText="Delete"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
