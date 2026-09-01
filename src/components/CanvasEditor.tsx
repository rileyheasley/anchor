import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow, MarkerType, ConnectionMode,
  type Node, type Edge, type Connection, type Viewport, type OnSelectionChangeParams,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'motion/react'
import { Square, Diamond, Type, Spline, Minus } from 'lucide-react'
import RectangleNode from './canvasNodes/RectangleNode'
import DiamondNode from './canvasNodes/DiamondNode'
import TextNode from './canvasNodes/TextNode'
import { NODE_COLORS, NODE_COLOR_NAMES, type NodeColor } from './canvasNodes/colors'
import type { ShapeNodeData } from './canvasNodes/RectangleNode'
import { clickSound } from '../sounds'

const nodeTypes = { rectangle: RectangleNode, diamond: DiamondNode, text: TextNode }

type ShapeType = 'rectangle' | 'diamond' | 'text'

interface CanvasContent {
  nodes: Node[]
  edges: Edge[]
  viewport?: Viewport
}

function parseContent(raw: string): CanvasContent {
  if (!raw.trim()) return { nodes: [], edges: [] }
  try {
    const parsed = JSON.parse(raw)
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      viewport: parsed.viewport,
    }
  } catch {
    return { nodes: [], edges: [] }
  }
}

let nodeCounter = 0
function nextId(prefix: string) {
  nodeCounter += 1
  return `${prefix}-${Date.now()}-${nodeCounter}`
}

const DEFAULT_LABEL: Record<ShapeType, string> = {
  rectangle: 'Step',
  diamond: 'Decision',
  text: 'Text',
}

function CanvasEditorInner({
  content,
  onChange,
  onBlur,
}: {
  content: string
  onChange: (json: string) => void
  onBlur?: () => void
}) {
  const initial = useMemo(() => parseContent(content), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [edgeStyle, setEdgeStyle] = useState<'default' | 'straight'>('default')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const viewportRef = useRef<Viewport>(initial.viewport ?? { x: 0, y: 0, zoom: 1 })
  const didMount = useRef(false)
  const { screenToFlowPosition, setViewport } = useReactFlow()

  // Tracks the content string this editor itself most recently produced, so the sync effect
  // below can tell "the parent just echoed our own edit back" apart from "the parent loaded
  // this canvas's real content asynchronously after we'd already mounted on stale/empty
  // content" (the latter happens because the caller sets the canvas active — remounting this
  // component via its `key` — before its `getContent` IPC call resolves).
  const contentRef = useRef(content)
  // Set while the sync effect below is applying an externally-loaded content prop, so the
  // nodes/edges effect further down can skip treating that correction as a user edit (which
  // would otherwise mark the canvas dirty and re-save on every open).
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (content === contentRef.current) return
    contentRef.current = content
    const parsed = parseContent(content)
    isSyncingRef.current = true
    setNodes(parsed.nodes)
    setEdges(parsed.edges)
    if (parsed.viewport) {
      viewportRef.current = parsed.viewport
      setViewport(parsed.viewport)
    }
    // Only re-sync when the *prop* changes — setNodes/setEdges/setViewport are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const handleLabelChange = useCallback((id: string, value: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: value } } : n)))
  }, [setNodes])

  const nodesWithHandlers = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, onLabelChange: handleLabelChange } as ShapeNodeData })),
    [nodes, handleLabelChange]
  )

  const emitChange = useCallback(() => {
    const json = JSON.stringify({ nodes, edges, viewport: viewportRef.current })
    contentRef.current = json
    onChange(json)
  }, [nodes, edges, onChange])

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    if (isSyncingRef.current) { isSyncingRef.current = false; return }
    emitChange()
    // Only fire on graph content changes, not on every `onChange`/`emitChange` identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      type: edgeStyle,
      markerEnd: { type: MarkerType.ArrowClosed },
    }, eds))
  }, [setEdges, edgeStyle])

  const onMoveEnd = useCallback((_e: unknown, viewport: Viewport) => {
    viewportRef.current = viewport
    emitChange()
  }, [emitChange])

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeIds(params.nodes.map((n) => n.id))
  }, [])

  const addShape = (shape: ShapeType) => {
    clickSound()
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const newNode: Node = {
      id: nextId(shape),
      type: shape,
      position: { x: center.x + (Math.random() - 0.5) * 60, y: center.y + (Math.random() - 0.5) * 60 },
      data: { label: DEFAULT_LABEL[shape] } satisfies ShapeNodeData,
    }
    setNodes((nds) => nds.concat(newNode))
  }

  const applyColor = (color: NodeColor) => {
    if (selectedNodeIds.length === 0) return
    clickSound()
    setNodes((nds) => nds.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, data: { ...n.data, color } } : n)))
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface" onBlur={onBlur}>
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <ToolbarButton title="Add rectangle" onClick={() => addShape('rectangle')}><Square size={16} /></ToolbarButton>
          <ToolbarButton title="Add diamond" onClick={() => addShape('diamond')}><Diamond size={16} /></ToolbarButton>
          <ToolbarButton title="Add text" onClick={() => addShape('text')}><Type size={16} /></ToolbarButton>
        </div>
        <div className="w-px h-5 bg-border-subtle" />
        <div className="flex items-center gap-1">
          <ToolbarButton title="Curved connectors" active={edgeStyle === 'default'} onClick={() => { clickSound(); setEdgeStyle('default') }}><Spline size={16} /></ToolbarButton>
          <ToolbarButton title="Straight connectors" active={edgeStyle === 'straight'} onClick={() => { clickSound(); setEdgeStyle('straight') }}><Minus size={16} /></ToolbarButton>
        </div>
        <div className="w-px h-5 bg-border-subtle" />
        <div className="flex items-center gap-1.5">
          {NODE_COLOR_NAMES.map((color) => (
            <motion.button
              key={color}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => applyColor(color)}
              disabled={selectedNodeIds.length === 0}
              title={selectedNodeIds.length === 0 ? 'Select a shape to color it' : `Color: ${color}`}
              className="w-5 h-5 rounded-full border border-border-strong disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: NODE_COLORS[color] }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={onMoveEnd}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultViewport={viewportRef.current}
          fitView={initial.nodes.length === 0}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable className="!bg-surface" />
        </ReactFlow>
      </div>
    </div>
  )
}

function ToolbarButton({
  title, onClick, active, children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors cursor-pointer ${
        active ? 'bg-primary text-ink-inverse' : 'bg-surface-muted text-ink-muted hover:bg-border-strong hover:text-ink-secondary'
      }`}
    >
      {children}
    </motion.button>
  )
}

export default function CanvasEditor(props: { content: string; onChange: (json: string) => void; onBlur?: () => void }) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  )
}
