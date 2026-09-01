import type { NodeProps } from '@xyflow/react'
import NodeHandles from './nodeHandles'
import ShapeLabel from './ShapeLabel'
import type { ShapeNodeData } from './RectangleNode'

export default function TextNode({ id, data, selected }: NodeProps) {
  const { label, onLabelChange } = data as ShapeNodeData
  return (
    <div
      className="min-w-[80px] px-2 py-1 text-sm font-heading text-ink rounded"
      style={{ outline: selected ? '1.5px solid var(--color-accent)' : 'none' }}
    >
      <NodeHandles />
      <ShapeLabel label={label} onCommit={(v) => onLabelChange?.(id, v)} />
    </div>
  )
}
