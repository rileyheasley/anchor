import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface DatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  placeholder?: string
  /** 'input' looks like a bordered form field; 'inline' is a borderless compact trigger for toolbars/chips. */
  variant?: 'input' | 'inline'
  className?: string
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function parseISO(value: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Custom calendar dropdown so the popover follows the app's own theme tokens
// instead of the OS-native <input type="date"> picker, which only distinguishes
// light/dark and ignores the app's non-standard themes (Nord, Dracula, Folklore, ...).
export default function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = 'Set date',
  variant = 'input',
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null)
  const selected = useMemo(() => parseISO(value), [value])
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => setIsOpen(false), isOpen)

  useLayoutEffect(() => {
    if (isOpen) setViewMonth(selected ?? new Date())
    // Only reset the visible month when the popover opens, not on every value change while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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
      top = triggerRect.top - menuRect.height - 4
    }
    top = Math.max(padding, top)

    const left = Math.max(padding, Math.min(triggerRect.left, window.innerWidth - menuRect.width - padding))

    setPlacement({ top, left })
  }, [isOpen, viewMonth])

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

  const weeks = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const startOffset = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)

    const result: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7))
    return result
  }, [viewMonth])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleSelect = (date: Date) => {
    clickSound()
    onChange(toISO(date))
    setIsOpen(false)
  }

  const handleClear = () => {
    clickSound()
    onChange(null)
    setIsOpen(false)
  }

  const triggerClassName =
    className ??
    (variant === 'inline'
      ? 'flex items-center gap-1.5 bg-transparent text-ink text-xs cursor-pointer disabled:opacity-50'
      : 'w-full flex items-center justify-between gap-2 px-3 py-2 bg-surface-sunken text-ink border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 cursor-pointer text-left')

  return (
    <>
      <motion.button
        type="button"
        ref={triggerRef}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        onClick={() => {
          if (disabled) return
          clickSound()
          setIsOpen((open) => !open)
        }}
        disabled={disabled}
        className={triggerClassName}
      >
        {variant === 'input' ? (
          <>
            <span className={selected ? 'text-ink' : 'text-ink-faint'}>{selected ? formatDisplay(selected) : placeholder}</span>
            <Calendar size={14} className="text-ink-faint shrink-0" />
          </>
        ) : (
          <>
            <Calendar size={12} className="text-ink-faint shrink-0" />
            <span className={selected ? '' : 'text-ink-faint'}>{selected ? formatDisplay(selected) : placeholder}</span>
          </>
        )}
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
              className="bg-surface border border-border-strong rounded-lg shadow-lg p-3 w-[260px] z-[100]"
            >
              <div className="flex items-center justify-between mb-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </motion.button>
                <span className="text-sm font-semibold text-ink">
                  {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </motion.button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className="text-center text-[10px] uppercase tracking-wide text-ink-faint font-medium">
                    {w}
                  </div>
                ))}
              </div>

              <div className="space-y-0.5">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-0.5">
                    {week.map((date, di) => {
                      if (!date) return <div key={di} />
                      const isSelected = selected ? isSameDay(date, selected) : false
                      const isToday = isSameDay(date, today)
                      return (
                        <motion.button
                          key={di}
                          type="button"
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleSelect(date)}
                          className={`aspect-square text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary text-ink-inverse font-semibold'
                              : isToday
                                ? 'text-primary font-semibold hover:bg-surface-sunken'
                                : 'text-ink-secondary hover:bg-surface-sunken'
                          }`}
                        >
                          {date.getDate()}
                        </motion.button>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => handleSelect(new Date())}
                  className="text-xs text-primary hover:underline cursor-pointer font-medium"
                >
                  Today
                </button>
                {selected && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors cursor-pointer"
                  >
                    <X size={12} />
                    Clear
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
