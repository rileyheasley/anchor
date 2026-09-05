import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow, MarkerType, ConnectionMode,
  type Node, type Edge, type Connection, type Viewport, type OnSelectionChangeParams,
  type NodeChange, type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { motion } from 'motion/react'
import { Square, Diamond, Type, Spline, Minus, Undo2, Redo2, Trash2, LayoutGrid, Copy } from 'lucide-react'
import RectangleNode from './canvasNodes/RectangleNode'
import DiamondNode from './canvasNodes/DiamondNode'
import TextNode from './canvasNodes/TextNode'
import { NODE_COLORS, NODE_COLOR_NAMES, DEFAULT_SHAPE_SIZE, type NodeColor } from './canvasNodes/colors'
import type { ShapeNodeData } from './canvasNodes/RectangleNode'
import CanvasEdge, { type CanvasEdgeData } from './canvasEdges/CanvasEdge'
import { NodeLabelChangeContext } from './canvasNodes/labelChangeContext'
import { EdgeLabelChangeContext } from './canvasEdges/labelChangeContext'
import { clickSound } from '../sounds'

const nodeTypes = { rectangle: RectangleNode, diamond: DiamondNode, text: TextNode }
const edgeTypes = { canvas: CanvasEdge }

type ShapeType = 'rectangle' | 'diamond' | 'text'

interface CanvasContent {
  nodes: Node[]
  edges: Edge[]
  viewport?: Viewport
}

interface Snapshot {
  nodes: Node[]
  edges: Edge[]
}

const HISTORY_LIMIT = 50

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

let idCounter = 0
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

const DEFAULT_LABEL: Record<ShapeType, string> = {
  rectangle: 'Step',
  diamond: 'Decision',
  text: 'Text',
}

// Left-to-right/top-to-bottom auto-layout via dagre. Node sizes come from React Flow's own
// post-render `measured` dimensions when available (accounts for user resizing), falling back
// to each shape's default size for nodes that haven't rendered yet.
function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90 })
  for (const n of nodes) {
    const fallback = DEFAULT_SHAPE_SIZE[n.type ?? 'rectangle'] ?? { width: 140, height: 64 }
    const width = n.measured?.width ?? fallback.width
    const height = n.measured?.height ?? fallback.height
    g.setNode(n.id, { width, height })
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target)
  }
  dagre.layout(g)
  return nodes.map((n) => {
    const pos = g.node(n.id)
    if (!pos) return n
    return { ...n, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } }
  })
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
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
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState<Node>(initial.nodes)
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState<Edge>(initial.edges)
  const [edgeStyle, setEdgeStyle] = useState<'default' | 'straight'>('default')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const viewportRef = useRef<Viewport>(initial.viewport ?? { x: 0, y: 0, zoom: 1 })
  const didMount = useRef(false)
  const { screenToFlowPosition, setViewport, fitView } = useReactFlow()

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

  // ── Undo / redo history ──
  // A "checkpoint" is pushed just *before* a discrete user action commits (add/remove a
  // node or edge, connect, one full drag gesture, a label edit, a color change) — not on
  // every intermediate event — so one Undo reverts one whole action, not one pixel of drag.
  const historyPast = useRef<Snapshot[]>([])
  const historyFuture = useRef<Snapshot[]>([])
  const isDraggingRef = useRef(false)
  const [historyTick, setHistoryTick] = useState(0) // forces a re-render so toolbar undo/redo buttons reflect stack state

  // Mirrored into refs so pushHistory can read the latest nodes/edges without taking a
  // dependency on them — keeping its identity (and handleLabelChange's, below) stable across
  // renders. That stability matters: it's shared with node/edge components via context rather
  // than injected into their `data`, specifically so a mid-drag nodes/edges state change (which
  // happens every frame) doesn't ripple into every node re-rendering.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  const pushHistory = useCallback(() => {
    historyPast.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift()
    historyFuture.current = []
    setHistoryTick((t) => t + 1)
  }, [])

  const undo = useCallback(() => {
    const prev = historyPast.current.pop()
    if (!prev) return
    historyFuture.current.push({ nodes, edges })
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setHistoryTick((t) => t + 1)
  }, [nodes, edges, setNodes, setEdges])

  const redo = useCallback(() => {
    const next = historyFuture.current.pop()
    if (!next) return
    historyPast.current.push({ nodes, edges })
    setNodes(next.nodes)
    setEdges(next.edges)
    setHistoryTick((t) => t + 1)
  }, [nodes, edges, setNodes, setEdges])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === 'position' && c.dragging) {
        if (!isDraggingRef.current) { isDraggingRef.current = true; pushHistory() }
      } else if (c.type === 'position' && c.dragging === false) {
        isDraggingRef.current = false
      } else if (c.type === 'dimensions' && c.resizing) {
        if (!isDraggingRef.current) { isDraggingRef.current = true; pushHistory() }
      } else if (c.type === 'dimensions' && c.resizing === false) {
        isDraggingRef.current = false
      } else if (c.type === 'remove') {
        pushHistory()
      }
    }
    onNodesChangeRaw(changes)
  }, [onNodesChangeRaw, pushHistory])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((c) => c.type === 'remove')) pushHistory()
    onEdgesChangeRaw(changes)
  }, [onEdgesChangeRaw, pushHistory])

  const handleLabelChange = useCallback((id: string, value: string) => {
    pushHistory()
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: value } } : n)))
  }, [pushHistory, setNodes])

  const handleEdgeLabelChange = useCallback((id: string, value: string) => {
    pushHistory()
    setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, data: { ...e.data, label: value } } : e)))
  }, [pushHistory, setEdges])

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
    pushHistory()
    setEdges((eds) => addEdge({
      ...connection,
      type: 'canvas',
      data: { curved: edgeStyle === 'default' } satisfies CanvasEdgeData,
      markerEnd: { type: MarkerType.ArrowClosed },
    }, eds))
  }, [setEdges, edgeStyle, pushHistory])

  const onMoveEnd = useCallback((_e: unknown, viewport: Viewport) => {
    viewportRef.current = viewport
    emitChange()
  }, [emitChange])

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeIds(params.nodes.map((n) => n.id))
    setSelectedEdgeIds(params.edges.map((e) => e.id))
  }, [])

  const addShape = useCallback((shape: ShapeType) => {
    clickSound()
    pushHistory()
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const size = DEFAULT_SHAPE_SIZE[shape]
    const newNode: Node = {
      id: nextId(shape),
      type: shape,
      position: { x: center.x + (Math.random() - 0.5) * 60, y: center.y + (Math.random() - 0.5) * 60 },
      style: { width: size.width, height: size.height },
      data: { label: DEFAULT_LABEL[shape] } satisfies ShapeNodeData,
    }
    setNodes((nds) => nds.concat(newNode))
  }, [pushHistory, screenToFlowPosition, setNodes])

  const applyColor = useCallback((color: NodeColor) => {
    if (selectedNodeIds.length === 0) return
    clickSound()
    pushHistory()
    setNodes((nds) => nds.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, data: { ...n.data, color } } : n)))
  }, [selectedNodeIds, pushHistory, setNodes])

  const deleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return
    clickSound()
    pushHistory()
    setNodes((nds) => nds.filter((n) => !selectedNodeIds.includes(n.id)))
    setEdges((eds) => eds.filter((e) =>
      !selectedEdgeIds.includes(e.id) && !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
    ))
  }, [selectedNodeIds, selectedEdgeIds, pushHistory, setNodes, setEdges])

  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return
    clickSound()
    pushHistory()
    setNodes((nds) => layoutWithDagre(nds, edges))
    requestAnimationFrame(() => fitView({ duration: 300 }))
  }, [nodes, edges, pushHistory, setNodes, fitView])

  // Copies the selected nodes plus any edges fully contained within that selection; paste
  // inserts a fresh-id copy offset from the original, so repeated pastes don't stack exactly.
  const clipboardRef = useRef<Snapshot | null>(null)

  const copySelection = useCallback(() => {
    if (selectedNodeIds.length === 0) return
    const selectedSet = new Set(selectedNodeIds)
    clipboardRef.current = {
      nodes: nodes.filter((n) => selectedSet.has(n.id)),
      edges: edges.filter((e) => selectedSet.has(e.source) && selectedSet.has(e.target)),
    }
  }, [nodes, edges, selectedNodeIds])

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current
    if (!clip || clip.nodes.length === 0) return
    pushHistory()
    const idMap = new Map<string, string>()
    const offset = 40
    const pastedNodes = clip.nodes.map((n) => {
      const newId = nextId(n.type ?? 'node')
      idMap.set(n.id, newId)
      return { ...n, id: newId, selected: true, position: { x: n.position.x + offset, y: n.position.y + offset } }
    })
    const pastedEdges = clip.edges.map((e) => ({
      ...e,
      id: nextId('edge'),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }))
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(pastedNodes))
    setEdges((eds) => eds.concat(pastedEdges))
  }, [pushHistory, setNodes, setEdges])

  const duplicateSelection = useCallback(() => {
    copySelection()
    pasteClipboard()
  }, [copySelection, pasteClipboard])

  // Keyboard shortcuts — ignored while a label/title text input has focus, so browser-native
  // undo/copy/paste inside that input still works normally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      else if (key === 'z') { e.preventDefault(); undo() }
      else if (key === 'y') { e.preventDefault(); redo() }
      else if (key === 'c') { e.preventDefault(); copySelection() }
      else if (key === 'v') { e.preventDefault(); pasteClipboard() }
      else if (key === 'd') { e.preventDefault(); duplicateSelection() }
      else if (key === 'a') {
        e.preventDefault()
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
        setEdges((eds) => eds.map((e2) => ({ ...e2, selected: true })))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, copySelection, pasteClipboard, duplicateSelection, setNodes, setEdges])

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
        <div className="w-px h-5 bg-border-subtle" />
        <div className="flex items-center gap-1">
          <ToolbarButton title="Undo (Ctrl+Z)" onClick={undo} disabled={historyPast.current.length === 0}><Undo2 size={16} /></ToolbarButton>
          <ToolbarButton title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={historyFuture.current.length === 0}><Redo2 size={16} /></ToolbarButton>
        </div>
        <div className="w-px h-5 bg-border-subtle" />
        <div className="flex items-center gap-1">
          <ToolbarButton title="Duplicate selection (Ctrl+D)" onClick={duplicateSelection} disabled={selectedNodeIds.length === 0}><Copy size={16} /></ToolbarButton>
          <ToolbarButton title="Auto-layout" onClick={autoLayout} disabled={nodes.length === 0}><LayoutGrid size={16} /></ToolbarButton>
          <ToolbarButton title="Delete selection (Del)" onClick={deleteSelected} disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0}><Trash2 size={16} /></ToolbarButton>
        </div>
        <span className="sr-only">{historyTick}</span>
      </div>

      <div className="flex-1">
        <NodeLabelChangeContext.Provider value={handleLabelChange}>
          <EdgeLabelChangeContext.Provider value={handleEdgeLabelChange}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onMoveEnd={onMoveEnd}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              defaultViewport={viewportRef.current}
              fitView={initial.nodes.length === 0}
              deleteKeyCode={['Backspace', 'Delete']}
              selectionOnDrag
              panOnDrag={[1, 2]}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable className="!bg-surface" />
            </ReactFlow>
          </EdgeLabelChangeContext.Provider>
        </NodeLabelChangeContext.Provider>
      </div>
    </div>
  )
}

function ToolbarButton({
  title, onClick, active, disabled, children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.08 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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
