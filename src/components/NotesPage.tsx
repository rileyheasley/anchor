import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Note } from '../types'
import { createSound, deleteSound, clickSound } from '../sounds'
import MarkdownEditor from './MarkdownEditor'
import ResizableNotesSidebar from './ResizableNotesSidebar'
import ConfirmDialog from './ConfirmDialog'

// Derives a plain-text title from the first non-empty markdown line
function deriveTitleFromContent(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0) ?? ''
  let text = firstLine.trim()
  text = text.replace(/^#{1,6}\s+/, '')
  text = text.replace(/^[-*+]\s+/, '')
  text = text.replace(/^\d+\.\s+/, '')
  text = text.replace(/^>\s+/, '')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/~~(.*?)~~/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return text.trim() || 'Untitled'
}

export default function NotesPage({
  startCreating: startCreatingProp = false,
  onCreateHandled,
  onNewNote,
}: {
  startCreating?: boolean
  onCreateHandled?: () => void
  onNewNote?: () => void
}) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [content, setContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadVaultAndNotes()
  }, [])

  useEffect(() => {
    if (startCreatingProp) {
      setCreating(true)
      onCreateHandled?.()
    }
  }, [startCreatingProp])

  const loadVaultAndNotes = async () => {
    const vp = await window.api.vault.getPath()
    setVaultPath(vp)
    if (vp) {
      setNotes(await window.api.notes.list({ standalone: true }))
    }
  }

  const handleChooseVault = async () => {
    clickSound()
    const chosen = await window.api.vault.choose()
    if (chosen) {
      setVaultPath(chosen)
      setNotes(await window.api.notes.list({ standalone: true }))
    }
  }

  const handleOpenNote = async (note: Note) => {
    if (dirty && activeNote) await saveActive()
    setActiveNote(note)
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
    await loadVaultAndNotes()
    handleOpenNote(note as Note)
  }

  const handleDelete = (id: string) => {
    setConfirmDelete(id)
  }

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return
    deleteSound()
    if (activeNote?.id === confirmDelete) { setActiveNote(null); setContent('') }
    await window.api.notes.delete(confirmDelete)
    await loadVaultAndNotes()
    setConfirmDelete(null)
  }

  if (!vaultPath) {
    return (
      <div className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center gap-4 text-center px-8">
        <p className="text-ink-muted text-lg">Choose a folder to store your notes</p>
        <p className="text-ink-faint text-sm max-w-sm">Notes are saved as markdown files on disk. Pick any folder — Anchor will create a <code className="bg-surface-muted px-1 rounded">notes/</code> and <code className="bg-surface-muted px-1 rounded">projects/</code> subfolder inside it.</p>
        <button
          onClick={handleChooseVault}
          className="mt-2 px-6 py-3 bg-primary text-ink-inverse rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        >
          Choose folder
        </button>
      </div>
    )
  }

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
          {/* Header with New Note button - always visible */}
          <div className={`border-b border-border-subtle flex items-center shrink-0 ${
            sidebarCollapsed 
              ? 'justify-center p-2' 
              : 'justify-between gap-2 p-3'
          }`}>
            {!sidebarCollapsed && (
              <span className="text-xs uppercase tracking-wide text-ink-faint font-medium">Notes</span>
            )}
            <button
              onClick={() => { clickSound(); setCreating(true); onNewNote?.() }}
              className="p-1.5 bg-primary text-ink-inverse rounded hover:bg-primary-hover transition-colors cursor-pointer font-medium"
              title="Create new note"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Notes Content - unified flex container */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Expanded view */}
            {!sidebarCollapsed && (
              <>
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

                <div className="overflow-y-auto flex-1">
                  <AnimatePresence>
                    {notes.map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        onClick={() => handleOpenNote(note)}
                        className={`px-4 py-3 cursor-pointer border-b border-border-subtle group flex items-center justify-between hover:bg-surface-sunken transition-colors ${
                          activeNote?.id === note.id ? 'bg-accent-subtle border-l-2 border-l-accent' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={16} className="shrink-0 text-ink-muted" />
                          <span className="text-sm text-ink-secondary truncate">{note.title}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(note.id) }}
                          className="text-ink-faint/70 hover:text-danger opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0 ml-2"
                          title="Delete note"
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {notes.length === 0 && !creating && (
                    <p className="text-sm text-ink-faint text-center py-8 px-4">No notes yet</p>
                  )}
                </div>
              </>
            )}

            {/* Collapsed icon-only view */}
            {sidebarCollapsed && (
              <div className="px-2 py-3 overflow-y-auto space-y-0.5">
                <AnimatePresence>
                  {notes.map((note) => (
                    <motion.button
                      key={note.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      onClick={() => handleOpenNote(note)}
                      title={note.title}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                        activeNote?.id === note.id
                          ? 'bg-accent text-ink-inverse'
                          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary'
                      }`}
                    >
                      <FileText size={18} />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Footer - Collapse Button */}
          <div className={`border-t border-border-subtle px-2 py-2 flex gap-1 shrink-0 ${
            sidebarCollapsed ? 'justify-center' : 'justify-start'
          }`}>
            <button
              onClick={() => { clickSound(); setSidebarCollapsed(!sidebarCollapsed) }}
              title={sidebarCollapsed ? 'Expand notes' : 'Collapse notes'}
              className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {!sidebarCollapsed && (
              <span className="flex items-center px-1 text-sm transition-colors text-ink-muted">
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            )}
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
        isOpen={!!confirmDelete}
        title="Delete note?"
        message="This note will be moved to the recycle bin. You can restore it later."
        confirmText="Delete"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
