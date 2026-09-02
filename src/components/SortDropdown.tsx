import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUpDown, ChevronDown, type LucideIcon } from 'lucide-react'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface SortDropdownProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  icon?: LucideIcon
  label?: string
  showLabel?: boolean
}

// Menu is portaled to <body> and positioned in fixed viewport coordinates (measured
// from the trigger button, then clamped to the window) rather than absolutely inside
// the trigger's own DOM position — otherwise a dropdown opened near the edge of a
// scrollable/clipped container (e.g. the Settings modal) gets cut off by that
// container's overflow instead of overlaying on top of it.
export default function SortDropdown<T extends string>({
  options,
  value,
  onChange,
  icon: Icon = ArrowUpDown,
  label = 'Sort',
  showLabel = true,
}: SortDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => setIsOpen(false), isOpen)

  useLayoutEffect(() => {
    if (!isOpen) {
      setPlacement(null)
      return
    }
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const padding = 8

    let top = triggerRect.bottom + 4
    if (top + menuRect.height > window.innerHeight - padding) {
      // Not enough room below — open upward instead
      top = triggerRect.top - menuRect.height - 4
    }
    top = Math.max(padding, top)

    const left = Math.max(padding, Math.min(triggerRect.left, window.innerWidth - menuRect.width - padding))

    setPlacement({ top, left })
  }, [isOpen, options.length])

  useLayoutEffect(() => {
    if (!isOpen) return
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const handleScroll = () => setIsOpen(false)
    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen])

  const currentLabel = options.find((o) => o.value === value)?.label ?? ''

  return (
    <>
      <motion.button
        ref={triggerRef}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { clickSound(); setIsOpen((open) => !open) }}
        title={label}
        className="flex items-center gap-1.5 text-sm px-2.5 py-2 rounded-lg border border-border text-ink-faint hover:bg-surface-muted cursor-pointer transition-colors"
      >
        <Icon size={15} />
        {showLabel && `${label}: `}<span className="text-ink-secondary font-medium">{currentLabel}</span>
        <ChevronDown size={13} />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: placement ? 1 : 0, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{ position: 'fixed', top: placement?.top ?? -9999, left: placement?.left ?? -9999 }}
              className="bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[180px] z-[100]"
            >
              {options.map((opt) => (
                <motion.button
                  key={opt.value}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { clickSound(); onChange(opt.value); setIsOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-surface-sunken ${
                    value === opt.value ? 'font-semibold text-ink' : 'text-ink-secondary'
                  }`}
                >
                  {opt.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
