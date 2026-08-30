import { X } from 'lucide-react'
import { clickSound } from '../sounds'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border-subtle rounded-lg shadow-lg w-96 h-96 flex flex-col">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="text-lg font-medium text-ink">Settings</h2>
          <button
            onClick={() => { clickSound(); onClose() }}
            className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
            title="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Settings content goes here */}
        </div>
      </div>
    </div>
  )
}
