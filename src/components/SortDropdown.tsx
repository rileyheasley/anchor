import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUpDown, ChevronDown, type LucideIcon } from 'lucide-react'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'

interface SortDropdownProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  icon?: LucideIcon
  label?: string
}

export default function SortDropdown<T extends string>({
  options,
  value,
  onChange,
  icon: Icon = ArrowUpDown,
  label = 'Sort',
}: SortDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => setIsOpen(false), isOpen)
  useClickOutside(menuRef, () => setIsOpen(false), isOpen)

  const currentLabel = options.find((o) => o.value === value)?.label ?? ''

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { clickSound(); setIsOpen((open) => !open) }}
        title={label}
        className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border border-border text-ink-faint hover:bg-surface-muted cursor-pointer transition-colors"
      >
        <Icon size={14} />
        {label}: <span className="text-ink-secondary font-medium">{currentLabel}</span>
        <ChevronDown size={12} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-full left-0 mt-2 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[160px] z-50"
          >
            {options.map((opt) => (
              <motion.button
                key={opt.value}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { clickSound(); onChange(opt.value); setIsOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-surface-sunken ${
                  value === opt.value ? 'font-semibold text-ink' : 'text-ink-secondary'
                }`}
              >
                {opt.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
