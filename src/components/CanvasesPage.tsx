import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, FolderPlus, Trash2, Workflow, Folder, FolderOpen, FolderInput, Pencil, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import type { Canvas, CanvasFolder } from '../types'
import { createSound, deleteSound, clickSound, moveSound } from '../sounds'
import CanvasEditor from './CanvasEditor'
import ResizableNotesSidebar from './ResizableNotesSidebar'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuPosition, type ContextMenuEntry } from './ContextMenu'
import CanvasesTree, { CollapsedCanvasesTree, type CanvasesTreeHandlers } from './CanvasesTree'
import { useClickOutside } from '../hooks/useClickOutside'
import { useEscapeKey } from '../hooks/useEscapeKey'
import {
  sortByMode, flattenVisibleCanvases, isCanvasFolderOrDescendant,
  SORT_MODES, SORT_MODE_LABELS, type CanvasSortMode,
} from '../utils/canvasTree'

const SORT_STORAGE_KEY = 'anchor.canvasesSortMode'
const EXPANDED_STORAGE_KEY = 'anchor.canvasesExpandedFolders'

function loadSortMode(): CanvasSortMode {
  const saved = localStorage.getItem(SORT_STORAGE_KEY)
  return (SORT_MODES as string[]).includes(saved ?? '') ? (saved as CanvasSortMode) : 'manual'
}

function loadExpandedIds(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch {
    return new Set()
  }
}

export default function CanvasesPage({
  startCreating: startCreatingProp = false,
  onCreateHandled,
  onNewCanvas,
  focusCanvasId,
  onFocusCanvasHandled,
}: {
  startCreating?: boolean
  onCreateHandled?: () => void
  onNewCanvas?: () => void
  focusCanvasId?: string | null
  onFocusCanvasHandled?: () => void
}) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [folders, setFolders] = useState<CanvasFolder[]>([])
  const [activeCanvas, setActiveCanvas] = useState<Canvas | null>(null)
  const [content, setContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<CanvasFolder | null>(null)
  const [canvasMenu, setCanvasMenu] = useState<{ canvas: Canvas; position: ContextMenuPosition } | null>(null)
  const [folderMenu, setFolderMenu] = useState<{ folder: CanvasFolder; position: ContextMenuPosition } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sorting
  const [sortMode, setSortMode] = useState<CanvasSortMode>(loadSortMode)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(sortMenuRef, () => setIsSortMenuOpen(false), isSortMenuOpen)
  useEscapeKey(() => setIsSortMenuOpen(false), isSortMenuOpen)

  // Folder tree expansion
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(loadExpandedIds)

  // Multi-select
  const [selectedCanvasIds, setSelectedCanvasIds] = useState<Set<string>>(new Set())
  const [lastSelectedCanvasId, setLastSelectedCanvasId] = useState<string | null>(null)

  // Folder creation / rename
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<string | null | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Drag & drop
  const [draggedCanvasIds, setDraggedCanvasIds] = useState<Set<string> | null>(null)
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  useEffect(() => {
    loadVaultAndCanvases()
    // Only run once on mount — loadVaultAndCanvases is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (startCreatingProp) {
      setCreating(true)
      setCreatingFolderParentId(undefined)
      onCreateHandled?.()
    }
    // Only re-run when the deep-link flag flips — onCreateHandled is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCreatingProp])

  // Deep-link support: open a specific canvas once the list is loaded (e.g. from search)
  useEffect(() => {
    if (!focusCanvasId || canvases.length === 0) return
    const canvas = canvases.find((c) => c.id === focusCanvasId)
    if (canvas) {
      handleOpenCanvas(canvas)
      onFocusCanvasHandled?.()
    }
    // Only re-run when the deep-link target or list changes — handleOpenCanvas/onFocusCanvasHandled are fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCanvasId, canvases])

  const persistSortMode = (mode: CanvasSortMode) => {
    setSortMode(mode)
    localStorage.setItem(SORT_STORAGE_KEY, mode)
  }

  const persistExpanded = (next: Set<string>) => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...next]))
  }

  const toggleExpand = (id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persistExpanded(next)
      return next
    })
  }

  const expandAncestorsOf = (canvas: Canvas) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev)
      let cursor = canvas.folder_id
      while (cursor) {
        next.add(cursor)
        cursor = folders.find((f) => f.id === cursor)?.parent_folder_id ?? null
      }
      persistExpanded(next)
      return next
    })
  }

  const loadVaultAndCanvases = async () => {
    const vp = await window.api.vault.getPath()
    setVaultPath(vp)
    if (vp) {
      await reloadAll()
    }
  }

  const reloadCanvases = async () => {
    setCanvases(await window.api.canvases.list({ standalone: true }))
  }

  const reloadFolders = async () => {
    setFolders(await window.api.canvasFolders.list())
  }

  const reloadAll = async () => {
    const [c, f] = await Promise.all([
      window.api.canvases.list({ standalone: true }),
      window.api.canvasFolders.list(),
    ])
    setCanvases(c)
    setFolders(f)
    return c
  }

  const handleChooseVault = async () => {
    clickSound()
    const chosen = await window.api.vault.choose()
    if (chosen) {
      setVaultPath(chosen)
      await reloadAll()
    }
  }

  const handleOpenCanvas = async (canvas: Canvas) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (dirty && activeCanvas) await saveActive()
    setActiveCanvas(canvas)
    expandAncestorsOf(canvas)
    const c = await window.api.canvases.getContent(canvas.id)
    setContent(c ?? '')
    setDirty(false)
    clickSound()
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    setDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveActive(val), 1500)
  }

  const saveActive = async (overrideContent?: string) => {
    if (!activeCanvas) return
    await window.api.canvases.saveContent(activeCanvas.id, overrideContent ?? content)
    setDirty(false)
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    const canvas = await window.api.canvases.create({ title: newTitle })
    createSound()
    setNewTitle('')
    setCreating(false)
    await reloadCanvases()
    handleOpenCanvas(canvas as Canvas)
  }

  // ── Selection ──

  const handleCanvasClick = (canvas: Canvas, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedCanvasId) {
      const order = flattenVisibleCanvases(folders, canvases, expandedFolderIds, sortMode)
      const lastIdx = order.findIndex((c) => c.id === lastSelectedCanvasId)
      const curIdx = order.findIndex((c) => c.id === canvas.id)
      if (lastIdx !== -1 && curIdx !== -1) {
        const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx]
        setSelectedCanvasIds(new Set(order.slice(start, end + 1).map((c) => c.id)))
      }
      return
    }
    if (e.metaKey || e.ctrlKey) {
      setSelectedCanvasIds((prev) => {
        const next = new Set(prev)
        if (next.has(canvas.id)) next.delete(canvas.id)
        else next.add(canvas.id)
        return next
      })
      setLastSelectedCanvasId(canvas.id)
      return
    }
    setSelectedCanvasIds(new Set([canvas.id]))
    setLastSelectedCanvasId(canvas.id)
    handleOpenCanvas(canvas)
  }

  // ── Delete ──

  const handleDelete = (id: string) => setConfirmDeleteIds([id])

  const handleDeleteSelection = (ids: string[]) => setConfirmDeleteIds(ids)

  const confirmDeleteAction = async () => {
    if (!confirmDeleteIds) return
    deleteSound()
    if (activeCanvas && confirmDeleteIds.includes(activeCanvas.id)) { setActiveCanvas(null); setContent('') }
    await Promise.all(confirmDeleteIds.map((id) => window.api.canvases.delete(id)))
    setSelectedCanvasIds((prev) => {
      const next = new Set(prev)
      confirmDeleteIds.forEach((id) => next.delete(id))
      return next
    })
    await reloadCanvases()
    setConfirmDeleteIds(null)
  }

  // ── Move to folder ──

  const handleMoveCanvasesToFolder = async (ids: string[], folderId: string | null) => {
    await window.api.canvases.move({ ids, folder_id: folderId })
    moveSound()
    if (folderId) setExpandedFolderIds((prev) => { const next = new Set(prev); next.add(folderId); persistExpanded(next); return next })
    await reloadCanvases()
  }

  const buildFolderMoveEntries = (onPick: (folderId: string | null) => void, excludeSubtreeOf?: string): ContextMenuEntry[] => {
    const entries: ContextMenuEntry[] = [
      { label: 'Unfiled (root)', icon: Workflow, onClick: () => onPick(null) },
    ]
    const roots = folders.filter((f) => f.parent_folder_id === null)
    if (roots.length > 0) entries.push('separator')
    const walk = (parentId: string | null, depth: number) => {
      const children = [...folders.filter((f) => f.parent_folder_id === parentId)].sort((a, b) => a.name.localeCompare(b.name))
      for (const f of children) {
        const disabled = excludeSubtreeOf != null && (f.id === excludeSubtreeOf || isCanvasFolderOrDescendant(folders, excludeSubtreeOf, f.id))
        entries.push({
          label: `${'  '.repeat(depth)}${f.name}`,
          icon: Folder,
          disabled,
          onClick: () => onPick(f.id),
        })
        walk(f.id, depth + 1)
      }
    }
    walk(null, 0)
    return entries
  }

  // ── Folder create / rename / delete ──

  const handleOpenFolderCreate = (parentId: string | null) => {
    setCreating(false)
    setCreatingFolderParentId(parentId)
    setNewFolderName('')
    if (parentId) setExpandedFolderIds((prev) => { const next = new Set(prev); next.add(parentId); persistExpanded(next); return next })
  }

  const handleSubmitNewFolder = async () => {
    if (!newFolderName.trim() || creatingFolderParentId === undefined) {
      setCreatingFolderParentId(undefined)
      return
    }
    await window.api.canvasFolders.create({ name: newFolderName.trim(), parent_folder_id: creatingFolderParentId })
    createSound()
    setNewFolderName('')
    setCreatingFolderParentId(undefined)
    await reloadFolders()
  }

  const handleCancelNewFolder = () => {
    if (!newFolderName.trim()) setCreatingFolderParentId(undefined)
  }

  const handleStartRename = (folder: CanvasFolder) => {
    setRenamingFolderId(folder.id)
    setRenameValue(folder.name)
  }

  const handleSubmitRename = async () => {
    if (!renamingFolderId) return
    if (renameValue.trim()) {
      await window.api.canvasFolders.rename({ id: renamingFolderId, name: renameValue.trim() })
      await reloadFolders()
    }
    setRenamingFolderId(null)
  }

  const handleCancelRename = () => {
    if (!renameValue.trim()) setRenamingFolderId(null)
  }

  const handleMoveFolder = async (id: string, parentFolderId: string | null) => {
    try {
      await window.api.canvasFolders.move({ id, parent_folder_id: parentFolderId })
      moveSound()
      await reloadFolders()
    } catch (error) {
      console.error('Failed to move folder:', error)
    }
  }

  const confirmDeleteFolderAction = async () => {
    if (!confirmDeleteFolder) return
    deleteSound()
    await window.api.canvasFolders.delete(confirmDeleteFolder.id)
    setConfirmDeleteFolder(null)
    const freshCanvases = await reloadAll()
    // If the active canvas lived inside the deleted subtree, its row is gone — clear the editor.
    if (activeCanvas && !freshCanvases.some((c) => c.id === activeCanvas.id)) {
      setActiveCanvas(null)
      setContent('')
    }
  }

  // ── Drag & drop ──

  const handleCanvasDragStart = (canvas: Canvas) => {
    setDraggingFolderId(null)
    setDraggedCanvasIds(selectedCanvasIds.has(canvas.id) ? new Set(selectedCanvasIds) : new Set([canvas.id]))
  }

  const handleFolderDragStart = (folder: CanvasFolder) => {
    setDraggedCanvasIds(null)
    setDraggingFolderId(folder.id)
  }

  const handleDragEnd = () => {
    setDraggedCanvasIds(null)
    setDraggingFolderId(null)
    setDragOverFolderId(null)
  }

  const handleDragOverFolder = (folderId: string) => {
    if (draggingFolderId === folderId) return
    setDragOverFolderId(folderId)
  }

  const handleDropOnFolder = async (folderId: string) => {
    setDragOverFolderId(null)
    if (draggingFolderId) {
      if (draggingFolderId !== folderId && !isCanvasFolderOrDescendant(folders, draggingFolderId, folderId)) {
        await handleMoveFolder(draggingFolderId, folderId)
      }
    } else if (draggedCanvasIds && draggedCanvasIds.size > 0) {
      await handleMoveCanvasesToFolder([...draggedCanvasIds], folderId)
    }
    handleDragEnd()
  }

  const handleDropOnRoot = async () => {
    if (draggingFolderId) {
      if (folders.find((f) => f.id === draggingFolderId)?.parent_folder_id !== null) {
        await handleMoveFolder(draggingFolderId, null)
      }
    } else if (draggedCanvasIds && draggedCanvasIds.size > 0) {
      await handleMoveCanvasesToFolder([...draggedCanvasIds], null)
    }
    handleDragEnd()
  }

  // Dropping a canvas onto another canvas row moves it alongside that canvas's folder (if
  // different) and, in manual sort mode, inserts it at that position among its new siblings.
  const handleCanvasDropReorder = async (targetCanvas: Canvas) => {
    if (!draggedCanvasIds || draggedCanvasIds.size !== 1) { handleDragEnd(); return }
    const [draggedId] = [...draggedCanvasIds]
    if (draggedId === targetCanvas.id) { handleDragEnd(); return }

    const levelCanvases = sortByMode(
      canvases.filter((c) => c.folder_id === targetCanvas.folder_id && c.id !== draggedId),
      'manual',
      (c) => c.title
    )
    const targetIndex = levelCanvases.findIndex((c) => c.id === targetCanvas.id)
    levelCanvases.splice(targetIndex, 0, canvases.find((c) => c.id === draggedId)!)

    await window.api.canvases.move({ ids: [draggedId], folder_id: targetCanvas.folder_id })
    if (sortMode === 'manual') {
      await window.api.canvases.reorder({ ids: levelCanvases.map((c) => c.id) })
    }
    moveSound()
    await reloadCanvases()
    handleDragEnd()
  }

  if (!vaultPath) {
    return (
      <div className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center gap-4 text-center px-8">
        <p className="text-ink-muted text-lg">Choose a folder to store your canvases</p>
        <p className="text-ink-faint text-sm max-w-sm">Canvases are saved as files on disk. Pick any folder — Anchor will create a <code className="bg-surface-muted px-1 rounded">canvases/</code> and <code className="bg-surface-muted px-1 rounded">projects/</code> subfolder inside it.</p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleChooseVault}
          className="mt-2 px-6 py-3 bg-primary text-ink-inverse rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        >
          Choose folder
        </motion.button>
      </div>
    )
  }

  const treeHandlers: CanvasesTreeHandlers = {
    activeCanvasId: activeCanvas?.id ?? null,
    selectedCanvasIds,
    expandedIds: expandedFolderIds,
    onToggleExpand: toggleExpand,
    onCanvasClick: handleCanvasClick,
    onCanvasContextMenu: (e, canvas) => {
      if (!selectedCanvasIds.has(canvas.id)) {
        setSelectedCanvasIds(new Set([canvas.id]))
        setLastSelectedCanvasId(canvas.id)
      }
      setCanvasMenu({ canvas, position: { x: e.clientX, y: e.clientY } })
    },
    onCanvasDelete: handleDelete,
    onFolderContextMenu: (e, folder) => setFolderMenu({ folder, position: { x: e.clientX, y: e.clientY } }),
    renamingFolderId,
    renameValue,
    onRenameValueChange: setRenameValue,
    onSubmitRename: handleSubmitRename,
    onCancelRename: handleCancelRename,
    creatingFolderParentId,
    newFolderName,
    onNewFolderNameChange: setNewFolderName,
    onSubmitNewFolder: handleSubmitNewFolder,
    onCancelNewFolder: handleCancelNewFolder,
    draggedCanvasIds,
    draggingFolderId,
    dragOverFolderId,
    onCanvasDragStart: (canvas) => handleCanvasDragStart(canvas),
    onFolderDragStart: (folder) => handleFolderDragStart(folder),
    onDragOverFolder: (_e, folderId) => handleDragOverFolder(folderId),
    onDragLeaveFolder: () => setDragOverFolderId(null),
    onDropOnFolder: (_e, folderId) => handleDropOnFolder(folderId),
    onCanvasDropReorder: (_e, targetCanvas) => handleCanvasDropReorder(targetCanvas),
    onDragEnd: handleDragEnd,
  }

  const canvasMenuTargetIds = canvasMenu
    ? (selectedCanvasIds.has(canvasMenu.canvas.id) && selectedCanvasIds.size > 1 ? [...selectedCanvasIds] : [canvasMenu.canvas.id])
    : []
  const isMultiCanvasMenu = canvasMenuTargetIds.length > 1

  return (
    <div className="h-full bg-surface-sunken flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Resizable Canvases Sidebar */}
        <ResizableNotesSidebar
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          minWidth={60}
          maxWidth={500}
          defaultWidth={280}
          collapsedWidth={60}
        >
          {/* Header with New Canvas / New Folder buttons - always visible */}
          <div className={`border-b border-border-subtle flex items-center shrink-0 ${
            sidebarCollapsed
              ? 'justify-center p-2'
              : 'justify-between gap-2 p-3'
          }`}>
            {!sidebarCollapsed && (
              <span className="text-xs uppercase tracking-wide text-ink-faint font-medium">Canvases</span>
            )}
            <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? 'flex-col' : ''}`}>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => { clickSound(); handleOpenFolderCreate(null) }}
                className="p-1.5 bg-surface-muted text-ink-muted rounded hover:bg-border-strong hover:text-ink-secondary transition-colors cursor-pointer"
                title="New folder"
              >
                <FolderPlus size={16} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => { clickSound(); setCreating(true); setCreatingFolderParentId(undefined); onNewCanvas?.() }}
                className="p-1.5 bg-primary text-ink-inverse rounded hover:bg-primary-hover transition-colors cursor-pointer font-medium"
                title="Create new canvas"
              >
                <Plus size={16} />
              </motion.button>
            </div>
          </div>

          {/* Canvases Content - unified flex container */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Expanded view */}
            {!sidebarCollapsed && (
              <>
                {/* Sort control */}
                <div className="px-3 py-2 border-b border-border-subtle shrink-0 relative" ref={sortMenuRef}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { clickSound(); setIsSortMenuOpen((o) => !o) }}
                    className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink-secondary transition-colors cursor-pointer"
                  >
                    Sort: {SORT_MODE_LABELS[sortMode]}
                    <ChevronDown size={12} />
                  </motion.button>
                  <AnimatePresence>
                    {isSortMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute top-full left-3 mt-1 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[130px] z-50"
                      >
                        {SORT_MODES.map((mode) => (
                          <motion.button
                            key={mode}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { clickSound(); persistSortMode(mode); setIsSortMenuOpen(false) }}
                            className={`w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors hover:bg-surface-sunken ${
                              sortMode === mode ? 'font-semibold text-ink' : 'text-ink-secondary'
                            }`}
                          >
                            {SORT_MODE_LABELS[mode]}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {creating && (
                  <div className="p-3 border-b border-border-subtle shrink-0">
                    <input
                      autoFocus
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate()
                        if (e.key === 'Escape') { setCreating(false); setNewTitle('') }
                      }}
                      placeholder="Canvas title..."
                      className="w-full px-2 py-1.5 text-sm border border-border-strong rounded bg-surface-sunken text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                )}

                <div
                  className="overflow-y-auto flex-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleDropOnRoot() }}
                >
                  <CanvasesTree
                    parentId={null}
                    depth={0}
                    folders={folders}
                    canvases={canvases}
                    sortMode={sortMode}
                    h={treeHandlers}
                  />

                  {canvases.length === 0 && folders.length === 0 && !creating && creatingFolderParentId === undefined && (
                    <p className="text-sm text-ink-faint text-center py-8 px-4">No canvases yet</p>
                  )}
                </div>
              </>
            )}

            {/* Collapsed icon-only view */}
            {sidebarCollapsed && (
              <div className="px-2 py-3 overflow-y-auto space-y-0.5">
                <CollapsedCanvasesTree
                  parentId={null}
                  depth={0}
                  folders={folders}
                  canvases={canvases}
                  sortMode={sortMode}
                  expandedIds={expandedFolderIds}
                  activeCanvasId={activeCanvas?.id ?? null}
                  onToggleExpand={toggleExpand}
                  onOpenCanvas={handleOpenCanvas}
                />
              </div>
            )}
          </div>

          {/* Footer - Collapse Button */}
          <div className={`border-t border-border-subtle px-2 py-2 flex gap-1 shrink-0 ${
            sidebarCollapsed ? 'justify-center' : 'justify-start'
          }`}>
            <motion.button
              whileHover={sidebarCollapsed ? { scale: 1.08 } : { x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { clickSound(); setSidebarCollapsed(!sidebarCollapsed) }}
              title={sidebarCollapsed ? 'Expand canvases' : 'Collapse canvases'}
              className="flex items-center gap-1 p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary cursor-pointer"
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!sidebarCollapsed && <span className="px-1">Collapse</span>}
            </motion.button>
          </div>
        </ResizableNotesSidebar>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeCanvas ? (
            <CanvasEditor
              key={activeCanvas.id}
              content={content}
              onChange={handleContentChange}
              onBlur={() => saveActive()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-faint text-sm">
              Select a canvas to edit
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteIds}
        title={confirmDeleteIds && confirmDeleteIds.length > 1 ? `Delete ${confirmDeleteIds.length} canvases?` : 'Delete canvas?'}
        message={
          confirmDeleteIds && confirmDeleteIds.length > 1
            ? 'These canvases will be moved to the recycle bin. You can restore them later.'
            : 'This canvas will be moved to the recycle bin. You can restore it later.'
        }
        confirmText="Delete"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDeleteIds(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteFolder}
        title="Delete folder?"
        message={`"${confirmDeleteFolder?.name}" and every canvas inside it (including subfolders) will be moved to the recycle bin.`}
        confirmText="Delete"
        onConfirm={confirmDeleteFolderAction}
        onCancel={() => setConfirmDeleteFolder(null)}
      />

      <ContextMenu
        position={canvasMenu?.position ?? null}
        onClose={() => setCanvasMenu(null)}
        items={
          canvasMenu
            ? [
                ...(isMultiCanvasMenu ? [] : [{ label: 'Open canvas', icon: FolderOpen, onClick: () => handleOpenCanvas(canvasMenu.canvas) } as ContextMenuEntry, 'separator' as ContextMenuEntry]),
                {
                  label: 'Move to folder',
                  icon: FolderInput,
                  items: buildFolderMoveEntries((folderId) => handleMoveCanvasesToFolder(canvasMenuTargetIds, folderId)),
                },
                'separator',
                {
                  label: isMultiCanvasMenu ? `Delete ${canvasMenuTargetIds.length} canvases` : 'Delete canvas',
                  icon: Trash2,
                  danger: true,
                  onClick: () => handleDeleteSelection(canvasMenuTargetIds),
                },
              ]
            : []
        }
      />

      <ContextMenu
        position={folderMenu?.position ?? null}
        onClose={() => setFolderMenu(null)}
        items={
          folderMenu
            ? [
                { label: 'New subfolder', icon: FolderPlus, onClick: () => handleOpenFolderCreate(folderMenu.folder.id) },
                { label: 'Rename folder', icon: Pencil, onClick: () => handleStartRename(folderMenu.folder) },
                {
                  label: 'Move to folder',
                  icon: FolderInput,
                  items: buildFolderMoveEntries((folderId) => handleMoveFolder(folderMenu.folder.id, folderId), folderMenu.folder.id),
                },
                'separator',
                { label: 'Delete folder', icon: Trash2, danger: true, onClick: () => setConfirmDeleteFolder(folderMenu.folder) },
              ]
            : []
        }
      />
    </div>
  )
}
