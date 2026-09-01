import { NodeResizer, type NodeProps } from '@xyflow/react'
import NodeHandles from './nodeHandles'
import ShapeLabel from './ShapeLabel'
import { NODE_COLORS, NODE_BORDER_COLORS, type NodeColor } from './colors'

export interface ShapeNodeData {
  label: string
  color?: NodeColor
  onLabelChange?: (id: string, value: string) => void
  [key: string]: unknown
}

export default function RectangleNode({ id, data, selected }: NodeProps) {
  const { label, color, onLabelChange } = data as ShapeNodeData
  return (
    <div
      className="w-full h-full px-4 py-3 rounded-lg flex items-center justify-center text-sm font-heading text-ink"
      style={{
        background: NODE_COLORS[color ?? 'neutral'],
        border: `1.5px solid ${selected ? 'var(--color-accent)' : NODE_BORDER_COLORS[color ?? 'neutral']}`,
      }}
    >
      <NodeResizer isVisible={selected} minWidth={80} minHeight={44} lineClassName="!border-accent" handleClassName="!bg-accent !border-none !w-2 !h-2" />
      <NodeHandles />
      <ShapeLabel label={label} onCommit={(v) => onLabelChange?.(id, v)} />
    </div>
  )
}
