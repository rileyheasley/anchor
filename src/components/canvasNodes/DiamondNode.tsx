import type { NodeProps } from '@xyflow/react'
import NodeHandles from './nodeHandles'
import ShapeLabel from './ShapeLabel'
import { NODE_COLORS, NODE_BORDER_COLORS } from './colors'
import type { ShapeNodeData } from './RectangleNode'

export default function DiamondNode({ id, data, selected }: NodeProps) {
  const { label, color, onLabelChange } = data as ShapeNodeData
  return (
    <div className="relative w-[140px] h-[100px] flex items-center justify-center">
      <NodeHandles />
      <div
        className="absolute inset-0"
        style={{
          background: NODE_COLORS[color ?? 'neutral'],
          border: `1.5px solid ${selected ? 'var(--color-accent)' : NODE_BORDER_COLORS[color ?? 'neutral']}`,
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        }}
      />
      <div className="relative z-10 text-sm font-heading text-ink px-6 text-center">
        <ShapeLabel label={label} onCommit={(v) => onLabelChange?.(id, v)} />
      </div>
    </div>
  )
}
