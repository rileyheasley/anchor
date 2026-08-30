import { useRef } from 'react'
import { X, Keyboard } from 'lucide-react'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getShortcutGroups } from '../shortcuts'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const handleClose = () => { clickSound(); onClose() }

  useEscapeKey(onClose, isOpen)
  useFocusTrap(panelRef, isOpen)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border-subtle rounded-lg shadow-lg w-[30rem] h-[32rem] flex flex-col"
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="text-lg font-medium text-ink">Settings</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
            title="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 text-ink-secondary">
            <Keyboard size={16} />
            <h3 className="text-sm font-medium uppercase tracking-wide">Keyboard shortcuts</h3>
          </div>
          <div className="space-y-5">
            {getShortcutGroups().map((group) => (
              <div key={group.title}>
                <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">{group.title}</h4>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <div key={item.description} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-ink-secondary">{item.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, i) => (
                          <kbd
                            key={i}
                            className="px-1.5 py-0.5 text-xs font-medium bg-surface-muted text-ink border border-border-strong rounded"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
