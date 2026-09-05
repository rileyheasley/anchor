import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Smile } from 'lucide-react'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'

const ICON_OPTIONS = [
  '📁', '🚀', '💡', '🎯', '🔥', '⭐', '📊', '🛠️',
  '💻', '🎨', '📝', '✅', '🐛', '🔧', '📦', '🌟',
  '🎉', '📌', '🔗', '🗂️', '💰', '🏆', '🧪', '🔬',
  '🎬', '🎵', '📚', '🌐', '⚙️', '🧩', '📅', '🔒',
  '🎮', '🌱', '🐙', '🍀', '🎁', '🚧', '🖥️', '📱',
]

interface IconPickerProps {
  value: string | null
  onChange: (icon: string | null) => void
  disabled?: boolean
}

export default function IconPicker({ value, onChange, disabled = false }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => setIsOpen(false), isOpen)
  useClickOutside(menuRef, () => setIsOpen(false), isOpen)

  const handleSelect = (icon: string | null) => {
    clickSound()
    onChange(icon)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          clickSound()
          setIsOpen((open) => !open)
        }}
        disabled={disabled}
        title="Set icon"
        className="w-10 h-10 flex items-center justify-center text-xl bg-surface-sunken text-ink-faint border border-border-strong rounded-lg cursor-pointer transition-colors hover:bg-surface-muted disabled:opacity-50"
      >
        {value ?? <Smile size={18} />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg p-2 w-56 z-50"
          >
            <div className="grid grid-cols-8 gap-0.5">
              {ICON_OPTIONS.map((icon) => (
                <motion.button
                  key={icon}
                  type="button"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSelect(icon)}
                  className={`w-6 h-6 flex items-center justify-center text-base rounded cursor-pointer transition-colors hover:bg-surface-sunken ${
                    value === icon ? 'bg-surface-muted ring-1 ring-primary' : ''
                  }`}
                >
                  {icon}
                </motion.button>
              ))}
            </div>
            {value && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="w-full text-left px-2 py-1.5 mt-1 text-xs text-ink-faint hover:text-ink hover:bg-surface-sunken rounded cursor-pointer transition-colors"
              >
                Remove icon
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
