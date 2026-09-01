import { Handle, Position } from '@xyflow/react'

// One handle per side. The editor's ReactFlow instance is configured with
// connectionMode="loose", so any handle can both start and receive a connection —
// letting users drag from/to whichever side of a shape they land on.
export default function NodeHandles() {
  return (
    <>
      <Handle id={`${Position.Top}`} type="source" position={Position.Top} className="!w-2 !h-2 !bg-accent !border-none" />
      <Handle id={`${Position.Right}`} type="source" position={Position.Right} className="!w-2 !h-2 !bg-accent !border-none" />
      <Handle id={`${Position.Bottom}`} type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-accent !border-none" />
      <Handle id={`${Position.Left}`} type="source" position={Position.Left} className="!w-2 !h-2 !bg-accent !border-none" />
    </>
  )
}
