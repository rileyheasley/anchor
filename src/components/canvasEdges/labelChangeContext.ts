import { createContext, useContext } from 'react'

// Shared via context (rather than injected into each edge's `data`) so that updating the
// handler's identity never forces every edge object to be recreated — which would defeat
// React.memo on CanvasEdge during drags. See CanvasEditor.tsx.
export const EdgeLabelChangeContext = createContext<(id: string, value: string) => void>(() => {})
export const useEdgeLabelChange = () => useContext(EdgeLabelChangeContext)
