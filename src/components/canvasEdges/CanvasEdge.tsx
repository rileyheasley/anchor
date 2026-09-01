import { useState, useRef, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, type EdgeProps } from '@xyflow/react'

export interface CanvasEdgeData {
  label?: string
  curved?: boolean
  onLabelChange?: (id: string, value: string) => void
  [key: string]: unknown
}

// Custom edge so connectors can carry an editable label (double-click to add/change text) and
// switch between curved/straight per-edge via `data.curved`, set at creation time from the
// toolbar's connector-style toggle.
export default function CanvasEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected, data,
}: EdgeProps) {
  const { label, curved = true, onLabelChange } = (data ?? {}) as CanvasEdgeData
  const [path, labelX, labelY] = (curved ? getBezierPath : getStraightPath)({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setValue(label ?? ''), [label])
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (value !== (label ?? '')) onLabelChange?.(id, value)
  }

  return (
    <>
      <BaseEdge id={id} path={path} style={{ ...style, stroke: selected ? 'var(--color-accent)' : style?.stroke }} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute pointer-events-auto"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') { setValue(label ?? ''); setEditing(false) }
              }}
              className="bg-surface border border-accent rounded px-1 py-0.5 text-xs text-ink text-center outline-none"
              style={{ width: Math.max(40, value.length * 7) }}
            />
          ) : label ? (
            <span className="bg-surface border border-border-strong rounded px-1.5 py-0.5 text-xs text-ink-secondary shadow-sm select-none">
              {label}
            </span>
          ) : selected ? (
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              className="bg-surface border border-dashed border-border-strong rounded px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink-secondary cursor-pointer"
            >
              + label
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
