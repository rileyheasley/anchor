import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Project, KanbanColumn, Card, Note } from '../types'
import { clickSound, createSound, deleteSound, completeSound, moveSound } from '../sounds'

const PRIORITY_BADGES: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600',
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export default function ProjectBoard({ project, onClose }: { project: Project, onClose: () => void }) {
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newColName, setNewColName] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  // Card detail panel
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [cardNote, setCardNote] = useState<Note | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { loadBoard() }, [project.id])
  useEffect(() => { if (selectedCard) loadCardNote(selectedCard) }, [selectedCard?.id])

  const loadBoard = async () => {
    try {
      const [cols, crds] = await Promise.all([
        window.api.columns.list(project.id),
        window.api.cards.list(project.id),
      ])
      setColumns(cols)
      setCards(crds)
    } catch (error) {
      console.error('Failed to load board:', error)
    }
  }

  const loadCardNote = async (card: Card) => {
    const notes = await window.api.notes.list({ card_id: card.id })
    if (notes.length > 0) {
      setCardNote(notes[0])
      setNoteContent(await window.api.notes.getContent(notes[0].id) ?? '')
    } else {
      setCardNote(null)
      setNoteContent('')
    }
    setNoteDirty(false)
  }

  const handleCreateCardNote = async () => {
    if (!selectedCard) return
    const note = await window.api.notes.create({ title: selectedCard.title, card_id: selectedCard.id })
    createSound()
    setCardNote(note as Note)
    setNoteContent(await window.api.notes.getContent(note!.id) ?? '')
  }

  const handleNoteContentChange = (val: string) => {
    setNoteContent(val)
    setNoteDirty(true)
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
    noteSaveTimer.current = setTimeout(() => saveNoteContent(val), 1500)
  }

  const saveNoteContent = async (content?: string) => {
    if (!cardNote) return
    await window.api.notes.saveContent(cardNote.id, content ?? noteContent)
    setNoteDirty(false)
  }

  const cardsInColumn = (columnId: string) =>
    cards.filter((c) => c.column_id === columnId).sort((a, b) => a.position - b.position)

  const handleAddCard = async (columnId: string) => {
    if (!newTitle.trim()) return
    try {
      await window.api.cards.create({ project_id: project.id, column_id: columnId, title: newTitle })
      setNewTitle('')
      setAddingTo(null)
      createSound()
      await loadBoard()
    } catch (error) { console.error('Failed to create card:', error) }
  }

  const handleDeleteCard = async (id: string) => {
    deleteSound()
    if (selectedCard?.id === id) setSelectedCard(null)
    try {
      await window.api.cards.delete(id)
      await loadBoard()
    } catch (error) { console.error('Failed to delete card:', error) }
  }

  const handleMoveCard = async (cardId: string, targetColumnId: string) => {
    const sourceCard = cards.find(c => c.id === cardId)
    if (sourceCard?.column_id === targetColumnId) return
    try {
      const targetCards = cardsInColumn(targetColumnId)
      const targetCol = columns.find((c) => c.id === targetColumnId)
      await window.api.cards.move({ id: cardId, column_id: targetColumnId, position: targetCards.length })
      targetCol?.is_done ? completeSound() : moveSound()
      await loadBoard()
      if (selectedCard?.id === cardId) setSelectedCard(prev => prev ? { ...prev, column_id: targetColumnId } : prev)
    } catch (error) { console.error('Failed to move card:', error) }
  }

  const handleUpdatePoints = async (cardId: string, points: number) => {
    clickSound()
    try {
      await window.api.cards.update({ id: cardId, points })
      await loadBoard()
      if (selectedCard?.id === cardId) setSelectedCard(prev => prev ? { ...prev, points } : prev)
    } catch (error) { console.error('Failed to update points:', error) }
  }

  const handleUpdatePriority = async (cardId: string, priority: string) => {
    clickSound()
    try {
      await window.api.cards.update({ id: cardId, priority })
      await loadBoard()
      if (selectedCard?.id === cardId) setSelectedCard(prev => prev ? { ...prev, priority: priority as Card['priority'] } : prev)
    } catch (error) { console.error('Failed to update priority:', error) }
  }

  const handleAddColumn = async () => {
    if (!newColName.trim()) return
    try {
      await window.api.columns.create({ project_id: project.id, name: newColName })
      setNewColName('')
      setAddingColumn(false)
      createSound()
      await loadBoard()
    } catch (error) { console.error('Failed to create column:', error) }
  }

  const handleDeleteColumn = async (id: string) => {
    deleteSound()
    try {
      await window.api.columns.delete(id)
      await loadBoard()
    } catch (error) { console.error('Failed to delete column:', error) }
  }

  const openDetail = (card: Card) => {
    if (noteDirty) saveNoteContent()
    setSelectedCard(card)
    clickSound()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full items-start">
            {columns.map((col) => (
              <div
                key={col.id}
                className={`rounded-lg p-3 w-72 shrink-0 transition-colors duration-150 ${
                  dragOverColId === col.id ? 'bg-blue-100 ring-2 ring-blue-300' : 'bg-gray-100'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverColId(col.id) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColId(null) }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggingId) handleMoveCard(draggingId, col.id)
                  setDragOverColId(null)
                }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-gray-700">{col.name}</h3>
                    <span className="text-xs text-gray-400">{cardsInColumn(col.id).length}</span>
                    {col.is_done ? <span className="text-xs text-green-500">✓</span> : null}
                  </div>
                  <button onClick={() => handleDeleteColumn(col.id)} className="text-gray-300 hover:text-red-500 text-sm cursor-pointer transition-colors">×</button>
                </div>

                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {cardsInColumn(col.id).map((card) => {
                      const due = card.due_date ? (() => {
                        const d = new Date(card.due_date); const t = new Date()
                        t.setHours(0,0,0,0); d.setHours(0,0,0,0)
                        const diff = Math.round((d.getTime()-t.getTime())/86400000)
                        if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-red-500' }
                        if (diff === 0) return { label: 'Today', color: 'text-red-500' }
                        if (diff <= 3) return { label: `${diff}d`, color: 'text-amber-500' }
                        return { label: `${diff}d`, color: 'text-gray-400' }
                      })() : null
                      const isSelected = selectedCard?.id === card.id

                      return (
                        <motion.div
                          key={card.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: draggingId === card.id ? 0.4 : 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          draggable
                          onDragStart={() => setDraggingId(card.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverColId(null) }}
                          className={`bg-white rounded-lg border p-3 shadow-sm cursor-grab active:cursor-grabbing ${
                            isSelected ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <button
                              onClick={() => openDetail(card)}
                              className="text-sm text-gray-900 font-medium text-left hover:text-blue-600 transition-colors cursor-pointer leading-snug"
                            >
                              {card.title}
                            </button>
                            <button onClick={() => handleDeleteCard(card.id)}
                              className="text-gray-300 hover:text-red-500 text-sm leading-none cursor-pointer transition-colors shrink-0 ml-2">×</button>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map((pt) => (
                                <button key={pt} onClick={() => handleUpdatePoints(card.id, pt)}
                                  className={`w-4 h-4 text-xs rounded cursor-pointer transition-colors ${card.points === pt ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                                  {pt}
                                </button>
                              ))}
                            </div>
                            <span
                              onClick={() => {
                                const order = ['none','low','medium','high']
                                handleUpdatePriority(card.id, order[(order.indexOf(card.priority)+1)%order.length])
                              }}
                              title="Click to cycle priority"
                              className={`text-xs px-1.5 py-0.5 rounded cursor-pointer select-none ${PRIORITY_BADGES[card.priority]}`}
                            >
                              {card.priority[0].toUpperCase()}
                            </span>
                            {due && <span className={`text-xs ${due.color}`}>{due.label}</span>}
                          </div>

                          <div className="flex gap-1 flex-wrap mt-2">
                            {columns.filter((c) => c.id !== col.id).map((c) => (
                              <button key={c.id} onClick={() => handleMoveCard(card.id, c.id)}
                                className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
                                → {c.name}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>

                {addingTo === col.id ? (
                  <div className="mt-2">
                    <input autoFocus type="text" value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCard(col.id)
                        if (e.key === 'Escape') { setAddingTo(null); setNewTitle('') }
                      }}
                      placeholder="Card title..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => handleAddCard(col.id)} className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer transition-colors">Add</button>
                      <button onClick={() => { setAddingTo(null); setNewTitle('') }} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-200 rounded cursor-pointer transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(col.id); setNewTitle('') }}
                    className="mt-2 w-full text-left text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-200 px-2 py-1 rounded cursor-pointer transition-colors">
                    + Add card
                  </button>
                )}
              </div>
            ))}

            {addingColumn ? (
              <div className="bg-gray-100 rounded-lg p-3 w-72 shrink-0">
                <input autoFocus type="text" value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn()
                    if (e.key === 'Escape') { setAddingColumn(false); setNewColName('') }
                  }}
                  placeholder="Column name..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <div className="flex gap-1 mt-2">
                  <button onClick={handleAddColumn} className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer transition-colors">Add</button>
                  <button onClick={() => { setAddingColumn(false); setNewColName('') }} className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-200 rounded cursor-pointer transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingColumn(true)}
                className="bg-gray-100 hover:bg-gray-200 rounded-lg p-3 w-72 shrink-0 text-sm text-gray-400 hover:text-gray-600 cursor-pointer transition-colors text-left">
                + Add column
              </button>
            )}
          </div>
        </div>

        {/* Card detail panel */}
        <AnimatePresence>
          {selectedCard && (
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <span className="text-sm font-medium text-gray-700 truncate mr-2">{selectedCard.title}</span>
                <button
                  onClick={() => { if (noteDirty) saveNoteContent(); setSelectedCard(null) }}
                  className="text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none shrink-0"
                >×</button>
              </div>

              <div className="p-4 space-y-5">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Points</label>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map((pt) => (
                      <button key={pt} onClick={() => handleUpdatePoints(selectedCard.id, pt)}
                        className={`w-9 h-9 text-sm rounded-lg cursor-pointer transition-colors font-medium ${
                          selectedCard.points === pt ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>{pt}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Priority</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['none','low','medium','high'] as const).map((pri) => (
                      <button key={pri} onClick={() => handleUpdatePriority(selectedCard.id, pri)}
                        className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          selectedCard.priority === pri ? PRIORITY_BADGES[pri] + ' font-semibold' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}>{pri}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Column</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {columns.map((col) => (
                      <button key={col.id} onClick={() => handleMoveCard(selectedCard.id, col.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          selectedCard.column_id === col.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>{col.name}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400 uppercase tracking-wide">Note</label>
                    {noteDirty && <span className="text-xs text-gray-400">Saving…</span>}
                  </div>
                  {cardNote ? (
                    <textarea
                      value={noteContent}
                      onChange={(e) => handleNoteContentChange(e.target.value)}
                      onBlur={() => saveNoteContent()}
                      className="w-full h-56 p-3 text-sm font-mono text-gray-800 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Write in markdown…"
                    />
                  ) : (
                    <button
                      onClick={handleCreateCardNote}
                      className="w-full py-4 text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
                    >
                      + Create note
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
