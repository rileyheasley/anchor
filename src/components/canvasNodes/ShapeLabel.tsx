import { useState, useRef, useEffect } from 'react'

// Shared double-click-to-edit label used by every shape node. The node stays controlled by
// CanvasEditor's own node state, so committing a new value goes through the `onCommit`
// callback CanvasEditor injects into node.data rather than reaching into React Flow directly.
export default function ShapeLabel({ label, onCommit, className }: { label: string; onCommit: (value: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setValue(label), [label])
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (value !== label) onCommit(value)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setValue(label); setEditing(false) }
        }}
        className={`nodrag bg-transparent text-center outline-none border-b border-accent ${className ?? ''}`}
      />
    )
  }

  return (
    <span onDoubleClick={() => setEditing(true)} className={`select-none ${className ?? ''}`}>
      {label || 'Double-click to edit'}
    </span>
  )
}
