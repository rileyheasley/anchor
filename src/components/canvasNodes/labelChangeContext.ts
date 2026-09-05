import { createContext, useContext } from 'react'

// Shared via context (rather than injected into each node's `data`) so that updating the
// handler's identity never forces every node object to be recreated — which would defeat
// React.memo on the node components during drags. See CanvasEditor.tsx.
export const NodeLabelChangeContext = createContext<(id: string, value: string) => void>(() => {})
export const useNodeLabelChange = () => useContext(NodeLabelChangeContext)
