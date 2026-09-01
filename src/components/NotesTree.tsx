import { motion, AnimatePresence } from 'motion/react'
import { ChevronRight, ChevronDown, Folder, FileText, Trash2 } from 'lucide-react'
import type { Note, NoteFolder } from '../types'
import { sortByMode, type NoteSortMode } from '../utils/noteTree'

export interface NotesTreeHandlers {
  activeNoteId: string | null
  selectedNoteIds: Set<string>
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  onNoteClick: (note: Note, e: React.MouseEvent) => void
  onNoteContextMenu: (e: React.MouseEvent, note: Note) => void
  onNoteDelete: (id: string) => void
  onFolderContextMenu: (e: React.MouseEvent, folder: NoteFolder) => void
  // Inline rename (folders only)
  renamingFolderId: string | null
  renameValue: string
  onRenameValueChange: (v: string) => void
  onSubmitRename: () => void
  onCancelRename: () => void
  // Inline creation — the input renders as the first row directly under `parentId`
  creatingFolderParentId: string | null | undefined
  newFolderName: string
  onNewFolderNameChange: (v: string) => void
  onSubmitNewFolder: () => void
  onCancelNewFolder: () => void
  // Drag & drop
  draggedNoteIds: Set<string> | null
  draggingFolderId: string | null
  dragOverFolderId: string | null
  onNoteDragStart: (note: Note, e: React.DragEvent) => void
  onFolderDragStart: (folder: NoteFolder, e: React.DragEvent) => void
  onDragOverFolder: (e: React.DragEvent, folderId: string) => void
  onDragLeaveFolder: () => void
  onDropOnFolder: (e: React.DragEvent, folderId: string) => void
  onNoteDropReorder: (e: React.DragEvent, targetNote: Note) => void
  onDragEnd: () => void
}

export default function NotesTree({
  parentId,
  depth,
  folders,
  notes,
  sortMode,
  h,
}: {
  parentId: string | null
  depth: number
  folders: NoteFolder[]
  notes: Note[]
  sortMode: NoteSortMode
  h: NotesTreeHandlers
}) {
  const childFolders = sortByMode(
    folders.filter((f) => f.parent_folder_id === parentId),
    sortMode,
    (f) => f.name
  )
  const childNotes = sortByMode(
    notes.filter((n) => n.folder_id === parentId),
    sortMode,
    (n) => n.title
  )
  const indent = 12 + depth * 16

  return (
    <>
      {h.creatingFolderParentId === parentId && (
        <div className="py-1.5 pr-3" style={{ paddingLeft: indent }}>
          <input
            autoFocus
            type="text"
            value={h.newFolderName}
            onChange={(e) => h.onNewFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') h.onSubmitNewFolder()
              if (e.key === 'Escape') h.onCancelNewFolder()
            }}
            onBlur={h.onCancelNewFolder}
            placeholder="Folder name..."
            className="w-full px-2 py-1 text-sm border border-border-strong rounded bg-surface-sunken text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      )}

      <AnimatePresence>
        {childFolders.map((folder) => {
          const isExpanded = h.expandedIds.has(folder.id)
          const isDragOver = h.dragOverFolderId === folder.id
          const isBeingDragged = h.draggingFolderId === folder.id
          return (
            <motion.div
              key={folder.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: isBeingDragged ? 0.4 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                draggable
                onDragStart={(e) => h.onFolderDragStart(folder, e)}
                onDragEnd={h.onDragEnd}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); h.onDragOverFolder(e, folder.id) }}
                onDragLeave={h.onDragLeaveFolder}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); h.onDropOnFolder(e, folder.id) }}
                onContextMenu={(e) => { e.preventDefault(); h.onFolderContextMenu(e, folder) }}
                className={`group flex items-center gap-1 pr-3 py-2 cursor-pointer border-b border-border-subtle transition-colors ${
                  isDragOver ? 'bg-accent-subtle ring-1 ring-inset ring-accent' : 'hover:bg-surface-sunken'
                }`}
                style={{ paddingLeft: indent }}
                onClick={() => h.onToggleExpand(folder.id)}
              >
                <span className="shrink-0 text-ink-faint">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <Folder size={15} className="shrink-0 text-ink-muted" />
                {h.renamingFolderId === folder.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={h.renameValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => h.onRenameValueChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') h.onSubmitRename()
                      if (e.key === 'Escape') h.onCancelRename()
                    }}
                    onBlur={h.onCancelRename}
                    className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-border-strong rounded bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <span className="font-heading text-sm text-ink-secondary truncate flex-1 min-w-0">{folder.name}</span>
                )}
              </div>

              {isExpanded && (
                <NotesTree
                  parentId={folder.id}
                  depth={depth + 1}
                  folders={folders}
                  notes={notes}
                  sortMode={sortMode}
                  h={h}
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      <AnimatePresence>
        {childNotes.map((note) => {
          const isActive = h.activeNoteId === note.id
          const isSelected = h.selectedNoteIds.has(note.id)
          const isBeingDragged = h.draggedNoteIds?.has(note.id) ?? false
          return (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isBeingDragged ? 0.4 : 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                draggable
                onDragStart={(e) => h.onNoteDragStart(note, e)}
                onDragEnd={h.onDragEnd}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); h.onNoteDropReorder(e, note) }}
                onClick={(e) => h.onNoteClick(note, e)}
                onContextMenu={(e) => { e.preventDefault(); h.onNoteContextMenu(e, note) }}
                className={`pr-4 py-3 cursor-pointer border-b border-border-subtle group flex items-center justify-between transition-colors ${
                  isActive
                    ? 'bg-accent-subtle border-l-2 border-l-accent'
                    : isSelected
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : 'hover:bg-surface-sunken'
                }`}
                style={{ paddingLeft: isActive ? indent - 2 : indent }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="shrink-0 text-ink-muted" />
                  <span className="font-heading text-sm text-ink-secondary truncate">{note.title}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); h.onNoteDelete(note.id) }}
                  className="text-ink-faint/70 hover:text-danger opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0 ml-2"
                  title="Delete note"
                >
                  <Trash2 size={16} />
                </motion.button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </>
  )
}

// Icon-only rendering for the collapsed sidebar — same folder/note tree, no drag & drop or
// context menus, just click-to-open (notes) and click-to-expand (folders).
export function CollapsedNotesTree({
  parentId,
  depth,
  folders,
  notes,
  sortMode,
  expandedIds,
  activeNoteId,
  onToggleExpand,
  onOpenNote,
}: {
  parentId: string | null
  depth: number
  folders: NoteFolder[]
  notes: Note[]
  sortMode: NoteSortMode
  expandedIds: Set<string>
  activeNoteId: string | null
  onToggleExpand: (id: string) => void
  onOpenNote: (note: Note) => void
}) {
  const childFolders = sortByMode(
    folders.filter((f) => f.parent_folder_id === parentId),
    sortMode,
    (f) => f.name
  )
  const childNotes = sortByMode(
    notes.filter((n) => n.folder_id === parentId),
    sortMode,
    (n) => n.title
  )
  const indent = depth * 8

  return (
    <>
      <AnimatePresence>
        {childFolders.map((folder) => {
          const isExpanded = expandedIds.has(folder.id)
          return (
            <motion.div
              key={folder.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{ marginLeft: indent }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onToggleExpand(folder.id)}
                title={folder.name}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                  isExpanded ? 'bg-surface-sunken text-ink-secondary' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary'
                }`}
              >
                <Folder size={18} />
              </motion.button>
              {isExpanded && (
                <CollapsedNotesTree
                  parentId={folder.id}
                  depth={depth + 1}
                  folders={folders}
                  notes={notes}
                  sortMode={sortMode}
                  expandedIds={expandedIds}
                  activeNoteId={activeNoteId}
                  onToggleExpand={onToggleExpand}
                  onOpenNote={onOpenNote}
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      <AnimatePresence>
        {childNotes.map((note) => (
          <motion.div key={note.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} style={{ marginLeft: indent }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onOpenNote(note)}
              title={note.title}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                activeNoteId === note.id
                  ? 'bg-accent text-ink-inverse'
                  : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary'
              }`}
            >
              <FileText size={18} />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  )
}
