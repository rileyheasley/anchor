import { motion } from 'motion/react'
import { Link2, Workflow } from 'lucide-react'
import type { Canvas } from '../types'
import { clickSound } from '../sounds'

interface CanvasCardProps {
  canvas: Canvas
  onClick: (canvas: Canvas) => void
  onDragStart?: (canvas: Canvas) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent<HTMLButtonElement>) => void
  onDrop?: (e: React.DragEvent<HTMLButtonElement>, canvas: Canvas) => void
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>, canvas: Canvas) => void
  isDragging?: boolean
  linked?: boolean
}

export default function CanvasCard({
  canvas,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onContextMenu,
  isDragging,
  linked,
}: CanvasCardProps) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
      draggable
      onDragStart={() => onDragStart?.(canvas)}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop?.(e, canvas)}
      onClick={() => {
        clickSound()
        onClick(canvas)
      }}
      onContextMenu={(e) => onContextMenu?.(e, canvas)}
      className="bg-surface border border-border-strong rounded-lg px-4 py-3 hover:border-accent hover:bg-surface-muted transition-colors cursor-grab active:cursor-grabbing group whitespace-nowrap"
    >
      <h3 className="flex items-center gap-1.5 font-heading font-medium text-ink text-sm group-hover:text-accent-hover transition-colors">
        <Workflow size={12} className="text-ink-faint shrink-0" />
        {linked && (
          <span title="Linked from Canvases" className="shrink-0 flex">
            <Link2 size={12} className="text-ink-faint" />
          </span>
        )}
        {canvas.title}
      </h3>
    </motion.button>
  )
}
