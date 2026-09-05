import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import NodeHandles from './nodeHandles'
import ShapeLabel from './ShapeLabel'
import type { ShapeNodeData } from './RectangleNode'
import { useNodeLabelChange } from './labelChangeContext'

function TextNode({ id, data, selected }: NodeProps) {
  const { label } = data as ShapeNodeData
  const onLabelChange = useNodeLabelChange()
  return (
    <div
      className="w-full h-full px-2 py-1 flex items-center justify-center text-sm font-heading text-ink rounded"
      style={{ outline: selected ? '1.5px solid var(--color-accent)' : 'none' }}
    >
      <NodeResizer isVisible={selected} minWidth={50} minHeight={24} lineClassName="!border-accent" handleClassName="!bg-accent !border-none !w-2 !h-2" />
      <NodeHandles />
      <ShapeLabel label={label} onCommit={(v) => onLabelChange(id, v)} />
    </div>
  )
}

export default memo(TextNode)
