import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Trash2 } from 'lucide-react'
import type { Canvas } from '../types'
import { clickSound, deleteSound } from '../sounds'
import CanvasEditor from './CanvasEditor'
import ConfirmDialog from './ConfirmDialog'
import ErrorBoundary from './ErrorBoundary'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface CanvasEditModalProps {
  isOpen: boolean
  canvas: Canvas | null
  onClose: () => void
  onSave: (content: string, title: string) => Promise<void>
  onDelete: () => Promise<void>
  isLoading?: boolean
  deleteTitle?: string
  confirmTitle?: string
  confirmMessage?: string
  confirmButtonText?: string
}

export default function CanvasEditModal({
  isOpen,
  canvas,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
  deleteTitle = 'Delete canvas',
  confirmTitle = 'Delete canvas?',
  confirmMessage = 'This canvas will be moved to the recycle bin. You can restore it later.',
  confirmButtonText = 'Delete',
}: CanvasEditModalProps) {
  const [title, setTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const activeCanvasIdRef = useRef<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (canvas && isOpen) {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setTitle(canvas.title)
      activeCanvasIdRef.current = canvas.id
      loadCanvasContent(canvas.id)
    }
    // Only re-run when the canvas identity or open state changes — `canvas` itself is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas?.id, isOpen])

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

  const loadCanvasContent = async (canvasId: string) => {
    try {
      const text = await window.api.canvases.getContent(canvasId)
      if (activeCanvasIdRef.current !== canvasId) return
      setContent(text ?? '')
    } catch (error) {
      console.error('Failed to load canvas content:', error)
    }
  }

  const handleSave = async (overrideContent?: string) => {
    if (!canvas) return
    setIsSaving(true)
    try {
      await onSave(overrideContent ?? content, title)
    } catch (error) {
      console.error('Failed to save canvas:', error)
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
      console.error('Failed to save canvas:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(true)
  }

  const confirmDeleteAction = async () => {
    if (!canvas) return
    deleteSound()
    try {
      await onDelete()
      onClose()
    } catch (error) {
      console.error('Failed to delete canvas:', error)
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
      {isOpen && canvas && (
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
        aria-label="Edit canvas"
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border-subtle rounded-lg shadow-lg w-full max-w-6xl h-[90vh] flex flex-col"
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
                  if (canvas) setTitle(canvas.title)
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
        <div className="flex-1 flex flex-col overflow-hidden">
          <ErrorBoundary key={canvas.id} recovery="reset" message="This canvas failed to load. Your other data is unaffected.">
            <CanvasEditor
              content={content}
              onChange={(json) => {
                setContent(json)
                if (saveTimer.current) clearTimeout(saveTimer.current)
                saveTimer.current = setTimeout(() => {
                  handleSave(json)
                }, 1500)
              }}
              onBlur={() => handleSave()}
            />
          </ErrorBoundary>
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
