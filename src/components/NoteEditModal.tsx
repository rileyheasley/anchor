import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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
  deleteTitle?: string
  confirmTitle?: string
  confirmMessage?: string
  confirmButtonText?: string
}

export default function NoteEditModal({
  isOpen,
  note,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
  deleteTitle = 'Delete note',
  confirmTitle = 'Delete note?',
  confirmMessage = 'This note will be moved to the recycle bin. You can restore it later.',
  confirmButtonText = 'Delete',
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
    // Only re-run when the note identity or open state changes — `note` itself is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <AnimatePresence>
      {isOpen && note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleClose}
        >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit note"
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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
                  if (note) setTitle(note.title)
                }
              }}
              onBlur={handleTitleSave}
              disabled={isLoading || isSaving}
              className="font-heading flex-1 text-lg font-medium bg-surface-sunken text-ink border border-border-strong rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 mr-2"
            />
          ) : (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setIsEditingTitle(true)}
              className="font-heading text-lg font-medium text-ink hover:text-accent-hover transition-colors cursor-pointer text-left flex-1 truncate mr-2"
            >
              {title}
            </motion.button>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDelete}
              disabled={isLoading || isSaving}
              className="p-1 rounded-lg text-ink-muted hover:text-danger hover:bg-surface-sunken transition-colors disabled:opacity-50 cursor-pointer"
              title={deleteTitle}
            >
              <Trash2 size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClose}
              disabled={isLoading || isSaving}
              className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </motion.button>
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
      </motion.div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmButtonText}
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(false)}
      />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
