import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, FolderPlus, Trash2, FileText, Folder, FolderOpen, FolderInput, Pencil, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import type { Note, NoteFolder } from '../types'
import { createSound, deleteSound, clickSound, moveSound } from '../sounds'
import MarkdownEditor from './MarkdownEditor'
import ResizableNotesSidebar from './ResizableNotesSidebar'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuPosition, type ContextMenuEntry } from './ContextMenu'
import NotesTree, { CollapsedNotesTree, type NotesTreeHandlers } from './NotesTree'
import { useClickOutside } from '../hooks/useClickOutside'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { deriveTitleFromContent } from '../shared/noteTitle'
import {
  sortByMode, flattenVisibleNotes, isFolderOrDescendant,
  SORT_MODES, SORT_MODE_LABELS, type NoteSortMode,
} from '../utils/noteTree'

const SORT_STORAGE_KEY = 'anchor.notesSortMode'
const EXPANDED_STORAGE_KEY = 'anchor.notesExpandedFolders'

function loadSortMode(): NoteSortMode {
  const saved = localStorage.getItem(SORT_STORAGE_KEY)
  return (SORT_MODES as string[]).includes(saved ?? '') ? (saved as NoteSortMode) : 'manual'
}

function loadExpandedIds(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch {
    return new Set()
  }
}

export default function NotesPage({
  startCreating: startCreatingProp = false,
  onCreateHandled,
  onNewNote,
  focusNoteId,
  onFocusNoteHandled,
}: {
  startCreating?: boolean
  onCreateHandled?: () => void
  onNewNote?: () => void
  focusNoteId?: string | null
  onFocusNoteHandled?: () => void
}) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [content, setContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null)
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<NoteFolder | null>(null)
  const [noteMenu, setNoteMenu] = useState<{ note: Note; position: ContextMenuPosition } | null>(null)
  const [folderMenu, setFolderMenu] = useState<{ folder: NoteFolder; position: ContextMenuPosition } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sorting
  const [sortMode, setSortMode] = useState<NoteSortMode>(loadSortMode)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(sortMenuRef, () => setIsSortMenuOpen(false), isSortMenuOpen)
  useEscapeKey(() => setIsSortMenuOpen(false), isSortMenuOpen)

  // Folder tree expansion
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(loadExpandedIds)

  // Multi-select
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [lastSelectedNoteId, setLastSelectedNoteId] = useState<string | null>(null)

  // Folder creation / rename
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<string | null | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Drag & drop
  const [draggedNoteIds, setDraggedNoteIds] = useState<Set<string> | null>(null)
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  useEffect(() => {
    loadVaultAndNotes()
    // Only run once on mount — loadVaultAndNotes is a fresh closure every render.
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

  // Deep-link support: open a specific note once the list is loaded (e.g. from search)
  useEffect(() => {
    if (!focusNoteId || notes.length === 0) return
    const note = notes.find((n) => n.id === focusNoteId)
    if (note) {
      handleOpenNote(note)
      onFocusNoteHandled?.()
    }
    // Only re-run when the deep-link target or list changes — handleOpenNote/onFocusNoteHandled are fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNoteId, notes])

  const persistSortMode = (mode: NoteSortMode) => {
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

  const expandAncestorsOf = (note: Note) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev)
      let cursor = note.folder_id
      while (cursor) {
        next.add(cursor)
        cursor = folders.find((f) => f.id === cursor)?.parent_folder_id ?? null
      }
      persistExpanded(next)
      return next
    })
  }

  const loadVaultAndNotes = async () => {
    const vp = await window.api.vault.getPath()
    setVaultPath(vp)
    if (vp) {
      await reloadAll()
    }
  }

  const reloadNotes = async () => {
    setNotes(await window.api.notes.list({ standalone: true }))
  }

  const reloadFolders = async () => {
    setFolders(await window.api.folders.list())
  }

  const reloadAll = async () => {
    const [n, f] = await Promise.all([
      window.api.notes.list({ standalone: true }),
      window.api.folders.list(),
    ])
    setNotes(n)
    setFolders(f)
    return n
  }

  const handleChooseVault = async () => {
    clickSound()
    const chosen = await window.api.vault.choose()
    // Choosing a vault swaps the whole dataset, not just notes — reload rather
    // than patching local state.
    if (chosen) window.location.reload()
  }

  const handleOpenNote = async (note: Note) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (dirty && activeNote) await saveActive()
    setActiveNote(note)
    expandAncestorsOf(note)
    const c = await window.api.notes.getContent(note.id)
    setContent(c ?? '')
    setDirty(false)
    clickSound()
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    setDirty(true)
    if (activeNote) {
      const derivedTitle = deriveTitleFromContent(val)
      setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? { ...n, title: derivedTitle } : n)))
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveActive(val), 1500)
  }

  const saveActive = async (overrideContent?: string) => {
    if (!activeNote) return
    await window.api.notes.saveContent(activeNote.id, overrideContent ?? content)
    setDirty(false)
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    const note = await window.api.notes.create({ title: newTitle })
    createSound()
    setNewTitle('')
    setCreating(false)
    await reloadNotes()
    handleOpenNote(note as Note)
  }

  // ── Selection ──

  const handleNoteClick = (note: Note, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedNoteId) {
      const order = flattenVisibleNotes(folders, notes, expandedFolderIds, sortMode)
      const lastIdx = order.findIndex((n) => n.id === lastSelectedNoteId)
      const curIdx = order.findIndex((n) => n.id === note.id)
      if (lastIdx !== -1 && curIdx !== -1) {
        const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx]
        setSelectedNoteIds(new Set(order.slice(start, end + 1).map((n) => n.id)))
      }
      return
    }
    if (e.metaKey || e.ctrlKey) {
      setSelectedNoteIds((prev) => {
        const next = new Set(prev)
        if (next.has(note.id)) next.delete(note.id)
        else next.add(note.id)
        return next
      })
      setLastSelectedNoteId(note.id)
      return
    }
    setSelectedNoteIds(new Set([note.id]))
    setLastSelectedNoteId(note.id)
    handleOpenNote(note)
  }

  // ── Delete ──

  const handleDelete = (id: string) => setConfirmDeleteIds([id])

  const handleDeleteSelection = (ids: string[]) => setConfirmDeleteIds(ids)

  const confirmDeleteAction = async () => {
    if (!confirmDeleteIds) return
    deleteSound()
    if (activeNote && confirmDeleteIds.includes(activeNote.id)) { setActiveNote(null); setContent('') }
    await Promise.all(confirmDeleteIds.map((id) => window.api.notes.delete(id)))
    setSelectedNoteIds((prev) => {
      const next = new Set(prev)
      confirmDeleteIds.forEach((id) => next.delete(id))
      return next
    })
    await reloadNotes()
    setConfirmDeleteIds(null)
  }

  // ── Move to folder ──

  const handleMoveNotesToFolder = async (ids: string[], folderId: string | null) => {
    await window.api.notes.move({ ids, folder_id: folderId })
    moveSound()
    if (folderId) setExpandedFolderIds((prev) => { const next = new Set(prev); next.add(folderId); persistExpanded(next); return next })
    await reloadNotes()
  }

  const buildFolderMoveEntries = (onPick: (folderId: string | null) => void, excludeSubtreeOf?: string): ContextMenuEntry[] => {
    const entries: ContextMenuEntry[] = [
      { label: 'Unfiled (root)', icon: FileText, onClick: () => onPick(null) },
    ]
    const roots = folders.filter((f) => f.parent_folder_id === null)
    if (roots.length > 0) entries.push('separator')
    const walk = (parentId: string | null, depth: number) => {
      const children = [...folders.filter((f) => f.parent_folder_id === parentId)].sort((a, b) => a.name.localeCompare(b.name))
      for (const f of children) {
        const disabled = excludeSubtreeOf != null && (f.id === excludeSubtreeOf || isFolderOrDescendant(folders, excludeSubtreeOf, f.id))
        entries.push({
          label: `${'  '.repeat(depth)}${f.name}`,
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
    await window.api.folders.create({ name: newFolderName.trim(), parent_folder_id: creatingFolderParentId })
    createSound()
    setNewFolderName('')
    setCreatingFolderParentId(undefined)
    await reloadFolders()
  }

  const handleCancelNewFolder = () => {
    if (!newFolderName.trim()) setCreatingFolderParentId(undefined)
  }

  const handleStartRename = (folder: NoteFolder) => {
    setRenamingFolderId(folder.id)
    setRenameValue(folder.name)
  }

  const handleSubmitRename = async () => {
    if (!renamingFolderId) return
    if (renameValue.trim()) {
      await window.api.folders.rename({ id: renamingFolderId, name: renameValue.trim() })
      await reloadFolders()
    }
    setRenamingFolderId(null)
  }

  const handleCancelRename = () => {
    if (!renameValue.trim()) setRenamingFolderId(null)
  }

  const handleMoveFolder = async (id: string, parentFolderId: string | null) => {
    try {
      await window.api.folders.move({ id, parent_folder_id: parentFolderId })
      moveSound()
      await reloadFolders()
    } catch (error) {
      console.error('Failed to move folder:', error)
    }
  }

  const confirmDeleteFolderAction = async () => {
    if (!confirmDeleteFolder) return
    deleteSound()
    await window.api.folders.delete(confirmDeleteFolder.id)
    setConfirmDeleteFolder(null)
    const freshNotes = await reloadAll()
    // If the active note lived inside the deleted subtree, its row is gone — clear the editor.
    if (activeNote && !freshNotes.some((n) => n.id === activeNote.id)) {
      setActiveNote(null)
      setContent('')
    }
  }

  // ── Drag & drop ──

  const handleNoteDragStart = (note: Note) => {
    setDraggingFolderId(null)
    setDraggedNoteIds(selectedNoteIds.has(note.id) ? new Set(selectedNoteIds) : new Set([note.id]))
  }

  const handleFolderDragStart = (folder: NoteFolder) => {
    setDraggedNoteIds(null)
    setDraggingFolderId(folder.id)
  }

  const handleDragEnd = () => {
    setDraggedNoteIds(null)
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
      if (draggingFolderId !== folderId && !isFolderOrDescendant(folders, draggingFolderId, folderId)) {
        await handleMoveFolder(draggingFolderId, folderId)
      }
    } else if (draggedNoteIds && draggedNoteIds.size > 0) {
      await handleMoveNotesToFolder([...draggedNoteIds], folderId)
    }
    handleDragEnd()
  }

  const handleDropOnRoot = async () => {
    if (draggingFolderId) {
      if (folders.find((f) => f.id === draggingFolderId)?.parent_folder_id !== null) {
        await handleMoveFolder(draggingFolderId, null)
      }
    } else if (draggedNoteIds && draggedNoteIds.size > 0) {
      await handleMoveNotesToFolder([...draggedNoteIds], null)
    }
    handleDragEnd()
  }

  // Dropping a note onto another note row moves it alongside that note's folder (if different)
  // and, in manual sort mode, inserts it at that position among its new siblings.
  const handleNoteDropReorder = async (targetNote: Note) => {
    if (!draggedNoteIds || draggedNoteIds.size !== 1) { handleDragEnd(); return }
    const [draggedId] = [...draggedNoteIds]
    if (draggedId === targetNote.id) { handleDragEnd(); return }

    const levelNotes = sortByMode(
      notes.filter((n) => n.folder_id === targetNote.folder_id && n.id !== draggedId),
      'manual',
      (n) => n.title
    )
    const targetIndex = levelNotes.findIndex((n) => n.id === targetNote.id)
    levelNotes.splice(targetIndex, 0, notes.find((n) => n.id === draggedId)!)

    await window.api.notes.move({ ids: [draggedId], folder_id: targetNote.folder_id })
    if (sortMode === 'manual') {
      await window.api.notes.reorder({ ids: levelNotes.map((n) => n.id) })
    }
    moveSound()
    await reloadNotes()
    handleDragEnd()
  }

  if (!vaultPath) {
    return (
      <div className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center gap-4 text-center px-8">
        <p className="text-ink-muted text-lg">Choose a folder to store your notes</p>
        <p className="text-ink-faint text-sm max-w-sm">Notes are saved as markdown files on disk. Pick any folder — Anchor will create a <code className="bg-surface-muted px-1 rounded">notes/</code> and <code className="bg-surface-muted px-1 rounded">projects/</code> subfolder inside it.</p>
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

  const treeHandlers: NotesTreeHandlers = {
    activeNoteId: activeNote?.id ?? null,
    selectedNoteIds,
    expandedIds: expandedFolderIds,
    onToggleExpand: toggleExpand,
    onNoteClick: handleNoteClick,
    onNoteContextMenu: (e, note) => {
      if (!selectedNoteIds.has(note.id)) {
        setSelectedNoteIds(new Set([note.id]))
        setLastSelectedNoteId(note.id)
      }
      setNoteMenu({ note, position: { x: e.clientX, y: e.clientY } })
    },
    onNoteDelete: handleDelete,
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
    draggedNoteIds,
    draggingFolderId,
    dragOverFolderId,
    onNoteDragStart: (note) => handleNoteDragStart(note),
    onFolderDragStart: (folder) => handleFolderDragStart(folder),
    onDragOverFolder: (_e, folderId) => handleDragOverFolder(folderId),
    onDragLeaveFolder: () => setDragOverFolderId(null),
    onDropOnFolder: (_e, folderId) => handleDropOnFolder(folderId),
    onNoteDropReorder: (_e, targetNote) => handleNoteDropReorder(targetNote),
    onDragEnd: handleDragEnd,
  }

  const noteMenuTargetIds = noteMenu
    ? (selectedNoteIds.has(noteMenu.note.id) && selectedNoteIds.size > 1 ? [...selectedNoteIds] : [noteMenu.note.id])
    : []
  const isMultiNoteMenu = noteMenuTargetIds.length > 1

  return (
    <div className="h-full bg-surface-sunken flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Resizable Notes Sidebar */}
        <ResizableNotesSidebar
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          minWidth={60}
          maxWidth={500}
          defaultWidth={280}
          collapsedWidth={60}
        >
          {/* Header with New Note / New Folder buttons - always visible */}
          <div className={`border-b border-border-subtle flex items-center shrink-0 ${
            sidebarCollapsed
              ? 'justify-center p-2'
              : 'justify-between gap-2 p-3'
          }`}>
            {!sidebarCollapsed && (
              <span className="text-xs uppercase tracking-wide text-ink-faint font-medium">Notes</span>
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
                onClick={() => { clickSound(); setCreating(true); setCreatingFolderParentId(undefined); onNewNote?.() }}
                className="p-1.5 bg-primary text-ink-inverse rounded hover:bg-primary-hover transition-colors cursor-pointer font-medium"
                title="Create new note"
              >
                <Plus size={16} />
              </motion.button>
            </div>
          </div>

          {/* Notes Content - unified flex container */}
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
                      placeholder="Note title..."
                      className="w-full px-2 py-1.5 text-sm border border-border-strong rounded bg-surface-sunken text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                )}

                <div
                  className="overflow-y-auto flex-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleDropOnRoot() }}
                >
                  <NotesTree
                    parentId={null}
                    depth={0}
                    folders={folders}
                    notes={notes}
                    sortMode={sortMode}
                    h={treeHandlers}
                  />

                  {notes.length === 0 && folders.length === 0 && !creating && creatingFolderParentId === undefined && (
                    <p className="text-sm text-ink-faint text-center py-8 px-4">No notes yet</p>
                  )}
                </div>
              </>
            )}

            {/* Collapsed icon-only view */}
            {sidebarCollapsed && (
              <div className="px-2 py-3 overflow-y-auto space-y-0.5">
                <CollapsedNotesTree
                  parentId={null}
                  depth={0}
                  folders={folders}
                  notes={notes}
                  sortMode={sortMode}
                  expandedIds={expandedFolderIds}
                  activeNoteId={activeNote?.id ?? null}
                  onToggleExpand={toggleExpand}
                  onOpenNote={handleOpenNote}
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
              title={sidebarCollapsed ? 'Expand notes' : 'Collapse notes'}
              className="flex items-center gap-1 p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary cursor-pointer"
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!sidebarCollapsed && <span className="px-1">Collapse</span>}
            </motion.button>
          </div>
        </ResizableNotesSidebar>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeNote ? (
            <MarkdownEditor
              content={content}
              onChange={handleContentChange}
              onBlur={() => saveActive()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-faint text-sm">
              Select a note to edit
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteIds}
        title={confirmDeleteIds && confirmDeleteIds.length > 1 ? `Delete ${confirmDeleteIds.length} notes?` : 'Delete note?'}
        message={
          confirmDeleteIds && confirmDeleteIds.length > 1
            ? 'These notes will be moved to the recycle bin. You can restore them later.'
            : 'This note will be moved to the recycle bin. You can restore it later.'
        }
        confirmText="Delete"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDeleteIds(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteFolder}
        title="Delete folder?"
        message={`"${confirmDeleteFolder?.name}" and every note inside it (including subfolders) will be moved to the recycle bin.`}
        confirmText="Delete"
        onConfirm={confirmDeleteFolderAction}
        onCancel={() => setConfirmDeleteFolder(null)}
      />

      <ContextMenu
        position={noteMenu?.position ?? null}
        onClose={() => setNoteMenu(null)}
        items={
          noteMenu
            ? [
                ...(isMultiNoteMenu ? [] : [{ label: 'Open note', icon: FolderOpen, onClick: () => handleOpenNote(noteMenu.note) } as ContextMenuEntry, 'separator' as ContextMenuEntry]),
                {
                  label: 'Move to folder',
                  icon: FolderInput,
                  items: buildFolderMoveEntries((folderId) => handleMoveNotesToFolder(noteMenuTargetIds, folderId)),
                },
                'separator',
                {
                  label: isMultiNoteMenu ? `Delete ${noteMenuTargetIds.length} notes` : 'Delete note',
                  icon: Trash2,
                  danger: true,
                  onClick: () => handleDeleteSelection(noteMenuTargetIds),
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
