import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import type { Priority, ProjectStatus } from '../types'
import { clickSound, createSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { STATUS_OPTIONS, STATUS_LABELS, STATUS_BADGES } from '../utils/status'
import { PRIORITY_OPTIONS, PRIORITY_BADGES, PRIORITY_LABELS } from '../utils/priority'

interface ProjectCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { name: string; priority: Priority; status: ProjectStatus; due_date: string | null }) => Promise<void>
  isLoading?: boolean
}

export default function ProjectCreationModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: ProjectCreationModalProps) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [dueDate, setDueDate] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    try {
      await onCreate({
        name: name.trim(),
        priority,
        status,
        due_date: dueDate || null,
      })
      createSound()
      setName('')
      setPriority('none')
      setStatus('planning')
      setDueDate('')
      setError(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  const handleClose = () => {
    clickSound()
    setName('')
    setPriority('none')
    setStatus('planning')
    setDueDate('')
    setError(null)
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
        aria-label="Create New Project"
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
          <h2 className="font-heading text-lg font-medium text-ink">Create New Project</h2>
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
          {/* Project Name */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Project Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter project name..."
              disabled={isLoading}
              className="w-full px-3 py-2 bg-surface-sunken text-ink border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 placeholder-ink-faint"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Priority</label>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => (
                <motion.button
                  key={p}
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

          {/* Status */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <motion.button
                  key={s}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStatus(s)}
                  disabled={isLoading}
                  className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 ${
                    status === s
                      ? STATUS_BADGES[s] + ' font-semibold'
                      : 'bg-surface-muted text-ink-faint hover:bg-border-strong'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Due Date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-surface-sunken text-ink border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            />
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
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </motion.button>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
