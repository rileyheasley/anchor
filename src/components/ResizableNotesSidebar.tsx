import { useState, useRef, ReactNode } from 'react'

interface ResizableNotesSidebarProps {
  children: ReactNode
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  minWidth?: number
  maxWidth?: number
  defaultWidth?: number
  collapsedWidth?: number
  isDraggable?: boolean
}

export default function ResizableNotesSidebar({
  children,
  isCollapsed,
  onCollapsedChange,
  minWidth = 200,
  maxWidth = 400,
  defaultWidth = 280,
  collapsedWidth = 50,
  isDraggable = true,
}: ResizableNotesSidebarProps) {
  const [width, setWidth] = useState(defaultWidth)
  const isDragging = useRef(false)
  const COLLAPSE_THRESHOLD = 120 // Auto-collapse below this width

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable) return
    e.preventDefault()
    isDragging.current = true

    const startX = e.clientX
    const startWidth = isCollapsed ? collapsedWidth : width

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return

      const diff = moveEvent.clientX - startX
      const newWidth = Math.max(collapsedWidth, Math.min(maxWidth, startWidth + diff))

      setWidth(newWidth)
      
      // Auto-collapse when dragging below threshold
      if (newWidth < COLLAPSE_THRESHOLD) {
        onCollapsedChange(true)
      }
      // Auto-expand when dragging above threshold
      else if (newWidth > COLLAPSE_THRESHOLD && isCollapsed) {
        onCollapsedChange(false)
      }
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // When collapsed, show minimal width (header still visible)
  const currentWidth = isCollapsed ? collapsedWidth : width

  return (
    <div
      className="bg-surface border-r border-border flex flex-col shrink-0 h-full relative group transition-all"
      style={{ width: `${currentWidth}px` }}
    >
      {children}

      {/* Drag Handle */}
      {isDraggable && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary hover:bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ right: '-2px' }}
        />
      )}
    </div>
  )
}
