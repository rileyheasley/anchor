import { motion } from 'motion/react'
import type { Note } from '../types'
import { clickSound } from '../sounds'

interface NoteCardProps {
  note: Note
  onClick: (note: Note) => void
  onDragStart?: (note: Note) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent<HTMLButtonElement>) => void
  onDrop?: (e: React.DragEvent<HTMLButtonElement>, note: Note) => void
  isDragging?: boolean
}

export default function NoteCard({
  note,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging,
}: NoteCardProps) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
      draggable
      onDragStart={() => onDragStart?.(note)}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop?.(e, note)}
      onClick={() => {
        clickSound()
        onClick(note)
      }}
      className="bg-surface border border-border-strong rounded-lg px-4 py-3 hover:border-accent hover:bg-surface-muted transition-colors cursor-grab active:cursor-grabbing group whitespace-nowrap"
    >
      <h3 className="font-medium text-ink text-sm group-hover:text-accent-hover transition-colors">
        {note.title}
      </h3>
    </motion.button>
  )
}
