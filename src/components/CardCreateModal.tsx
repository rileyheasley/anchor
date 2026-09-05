import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import type { Priority } from '../types'
import { clickSound, createSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { PRIORITY_OPTIONS, PRIORITY_BADGES, PRIORITY_LABELS } from '../utils/priority'
import DatePicker from './DatePicker'

interface CardCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { title: string; points: number | null; priority: Priority; due_date: string | null }) => Promise<void>
  isLoading?: boolean
}

export default function CardCreateModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CardCreateModalProps) {
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState<number | null>(null)
  const [priority, setPriority] = useState<Priority>('none')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setPoints(null)
    setPriority('none')
    setDueDate('')
    setError(null)
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Card title is required')
      return
    }

    try {
      await onCreate({ title: title.trim(), points, priority, due_date: dueDate || null })
      createSound()
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card')
    }
  }

  const handleClose = () => {
    clickSound()
    reset()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleCreate()
    }
  }

  const panelRef = useRef<HTMLDivElement>(null)

  useEscapeKey(handleClose, isOpen)
  useFocusTrap(panelRef, isOpen)

  return (
    <AnimatePresence>
      {isOpen && (
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
            aria-label="Add Card"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-border-subtle rounded-lg shadow-lg w-full max-w-md flex flex-col"
          >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="font-heading text-lg font-medium text-ink">Add Card</h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </motion.button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Card Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter card title..."
              disabled={isLoading}
              className="w-full px-3 py-2 bg-surface-sunken text-ink border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 placeholder-ink-faint"
            />
          </div>

          {/* Points */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Points</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((pt) => (
                <motion.button
                  key={pt}
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setPoints((current) => (current === pt ? null : pt))}
                  disabled={isLoading}
                  className={`w-9 h-9 text-sm rounded-lg cursor-pointer transition-colors font-medium disabled:opacity-50 ${
                    points === pt ? 'bg-accent text-ink-inverse' : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
                  }`}
                >
                  {pt}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Priority</label>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => (
                <motion.button
                  key={p}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPriority(p)}
                  disabled={isLoading}
                  className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 ${
                    priority === p
                      ? PRIORITY_BADGES[p] + ' font-semibold'
                      : 'bg-surface-muted text-ink-faint hover:bg-border-strong'
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Due Date (optional)</label>
            <DatePicker value={dueDate || null} onChange={(v) => setDueDate(v ?? '')} disabled={isLoading} />
          </div>

          {/* Error Message */}
          {error && <div className="p-3 bg-danger-subtle text-danger-strong text-sm rounded-lg">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border-subtle">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-ink-muted text-sm rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCreate}
            disabled={isLoading || !title.trim()}
            className="px-4 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
          >
            {isLoading ? 'Adding...' : 'Add Card'}
          </motion.button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
