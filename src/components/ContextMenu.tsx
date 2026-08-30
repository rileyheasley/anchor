import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { clickSound } from '../sounds'

export interface ContextMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export type ContextMenuEntry = ContextMenuItem | 'separator'

export interface ContextMenuPosition {
  x: number
  y: number
}

// Tracks the right-click position for a context menu; spread `trigger` onto the target element.
export function useContextMenu() {
  const [position, setPosition] = useState<ContextMenuPosition | null>(null)
  const close = () => setPosition(null)
  const trigger = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPosition({ x: e.clientX, y: e.clientY })
    },
  }
  return { position, trigger, close }
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

  if (!position) return null

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: placement?.top ?? position.y, left: placement?.left ?? position.x, visibility: placement ? 'visible' : 'hidden' }}
      className="z-[100] bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[180px] text-sm"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 border-t border-border-subtle" />
        ) : (
          <button
            key={item.label}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              clickSound()
              item.onClick()
              onClose()
            }}
            className={`w-full flex items-center gap-2 text-left px-3 py-1.5 transition-colors ${
              item.disabled
                ? 'text-ink-faint/50 cursor-default'
                : item.danger
                ? 'text-danger hover:bg-danger-subtle cursor-pointer'
                : 'text-ink-secondary hover:bg-surface-sunken cursor-pointer'
            }`}
          >
            {item.icon && <item.icon size={14} className="shrink-0" />}
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
