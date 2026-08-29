import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Note } from '../types'
import { createSound, deleteSound, clickSound } from '../sounds'

export default function NotesPage({ startCreating: startCreatingProp = false, onCreateHandled }: { startCreating?: boolean, onCreateHandled?: () => void }) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [content, setContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [dirty, setDirty] = useState(false)
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

  const handleDelete = async (id: string) => {
    deleteSound()
    if (activeNote?.id === id) { setActiveNote(null); setContent('') }
    await window.api.notes.delete(id)
    await loadVaultAndNotes()
  }

  if (!vaultPath) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-8">
          <p className="text-gray-500 text-lg">Choose a folder to store your notes</p>
          <p className="text-gray-400 text-sm max-w-sm">Notes are saved as markdown files on disk. Pick any folder — Anchor will create a <code className="bg-gray-100 px-1 rounded">notes/</code> and <code className="bg-gray-100 px-1 rounded">projects/</code> subfolder inside it.</p>
          <button
            onClick={handleChooseVault}
            className="mt-2 px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Choose folder
          </button>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          {creating && (
            <div className="p-3 border-b border-gray-100">
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
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
          )}

          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => handleOpenNote(note)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-100 group flex items-center justify-between hover:bg-gray-50 transition-colors ${
                  activeNote?.id === note.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <span className="text-sm text-gray-800 truncate">{note.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(note.id) }}
                  className="text-gray-300 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                >
                  ×
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {notes.length === 0 && !creating && (
            <p className="text-sm text-gray-400 text-center py-8 px-4">No notes yet</p>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeNote ? (
            <>
              <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{activeNote.title}</h2>
                {dirty && <span className="text-xs text-gray-400">Saving…</span>}
              </div>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onBlur={() => saveActive()}
                className="flex-1 p-6 resize-none text-sm font-mono text-gray-800 focus:outline-none bg-white"
                placeholder="Start writing…"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a note to edit
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
