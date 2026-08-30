import { useState } from 'react'
import { X } from 'lucide-react'
import type { Priority } from '../types'
import { clickSound, createSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface ProjectCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { name: string; priority: Priority; due_date: string | null }) => Promise<void>
  isLoading?: boolean
}

const PRIORITY_OPTIONS: Priority[] = ['none', 'low', 'medium', 'high']

export default function ProjectCreationModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: ProjectCreationModalProps) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
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
        due_date: dueDate || null,
      })
      createSound()
      setName('')
      setPriority('none')
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
    setDueDate('')
    setError(null)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleCreate()
    }
  }

  useEscapeKey(handleClose, isOpen)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border-subtle rounded-lg shadow-lg w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="text-lg font-medium text-ink">Create New Project</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Project Name</label>
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
            <label className="block text-sm font-medium text-ink mb-2">Priority</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  disabled={isLoading}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    priority === p
                      ? 'bg-primary text-ink-inverse'
                      : 'bg-surface-muted text-ink hover:bg-border-strong'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Due Date (Optional)</label>
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
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-ink-muted text-sm rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 bg-primary text-ink-inverse text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
