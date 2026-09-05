import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import NodeHandles from './nodeHandles'
import ShapeLabel from './ShapeLabel'
import { NODE_COLORS, NODE_BORDER_COLORS } from './colors'
import type { ShapeNodeData } from './RectangleNode'
import { useNodeLabelChange } from './labelChangeContext'

function DiamondNode({ id, data, selected }: NodeProps) {
  const { label, color } = data as ShapeNodeData
  const onLabelChange = useNodeLabelChange()
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <NodeResizer isVisible={selected} minWidth={90} minHeight={70} lineClassName="!border-accent" handleClassName="!bg-accent !border-none !w-2 !h-2" />
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
        <ShapeLabel label={label} onCommit={(v) => onLabelChange(id, v)} />
      </div>
    </div>
  )
}

export default memo(DiamondNode)
