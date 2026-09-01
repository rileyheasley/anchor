import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { clickSound } from '../sounds'

export interface ContextMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export interface ContextMenuSubmenu {
  label: string
  icon?: LucideIcon
  items: ContextMenuEntry[]
  disabled?: boolean
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSubmenu | 'separator'

export interface ContextMenuPosition {
  x: number
  y: number
}

export default function ContextMenu({
  position,
  items,
  onClose,
}: {
  position: ContextMenuPosition | null
  items: ContextMenuEntry[]
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null)

  useEscapeKey(onClose, !!position)

  useEffect(() => {
    if (!position) return
    window.addEventListener('click', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('click', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [position, onClose])

  // Clamp the menu inside the viewport once its size is known
  useLayoutEffect(() => {
    if (!position || !menuRef.current) {
      setPlacement(null)
      return
    }
    const rect = menuRef.current.getBoundingClientRect()
    const padding = 8
    const left = Math.max(padding, Math.min(position.x, window.innerWidth - rect.width - padding))
    const top = Math.max(padding, Math.min(position.y, window.innerHeight - rect.height - padding))
    setPlacement({ top, left })
  }, [position])

  return (
    <AnimatePresence>
      {position && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: placement ? 1 : 0, scale: placement ? 1 : 0.95 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{ position: 'fixed', top: placement?.top ?? position.y, left: placement?.left ?? position.x }}
          className="z-[100] bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[180px] text-sm"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MenuEntries items={items} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MenuEntries({ items, onClose }: { items: ContextMenuEntry[]; onClose: () => void }) {
  return (
    <>
      {items.map((entry, i) =>
        entry === 'separator' ? (
          <div key={i} className="my-1 border-t border-border-subtle" />
        ) : 'items' in entry ? (
          <SubmenuRow key={entry.label} entry={entry} onClose={onClose} />
        ) : (
          <motion.button
            key={entry.label}
            disabled={entry.disabled}
            whileHover={entry.disabled ? undefined : { x: 2 }}
            whileTap={entry.disabled ? undefined : { scale: 0.98 }}
            onClick={() => {
              if (entry.disabled) return
              clickSound()
              entry.onClick()
              onClose()
            }}
            className={`w-full flex items-center gap-2 text-left px-3 py-1.5 transition-colors ${
              entry.disabled
                ? 'text-ink-faint/50 cursor-default'
                : entry.danger
                ? 'text-danger hover:bg-danger-subtle cursor-pointer'
                : 'text-ink-secondary hover:bg-surface-sunken cursor-pointer'
            }`}
          >
            {entry.icon && <entry.icon size={14} className="shrink-0" />}
            {entry.label}
          </motion.button>
        )
      )}
    </>
  )
}

function SubmenuRow({ entry, onClose }: { entry: ContextMenuSubmenu; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'right' | 'left'>('right')
  const rowRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const submenuWidthEstimate = 200
    setSide(rect.right + submenuWidthEstimate > window.innerWidth ? 'left' : 'right')
  }, [open])

  return (
    <div
      ref={rowRef}
      className="relative"
      onMouseEnter={() => !entry.disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors ${
          entry.disabled ? 'text-ink-faint/50 cursor-default' : 'text-ink-secondary hover:bg-surface-sunken cursor-default'
        }`}
      >
        {entry.icon && <entry.icon size={14} className="shrink-0" />}
        <span className="flex-1">{entry.label}</span>
        <ChevronRight size={13} className="shrink-0 text-ink-faint" />
      </div>

      <AnimatePresence>
        {open && !entry.disabled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`absolute top-0 z-[110] bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[180px] text-sm ${
              side === 'right' ? 'left-full' : 'right-full'
            }`}
          >
            <MenuEntries items={entry.items} onClose={onClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
