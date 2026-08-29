import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Project, KanbanColumn, Card } from '../types'
import { clickSound, createSound, deleteSound, completeSound, moveSound } from '../sounds'

const PRIORITY_BADGES: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600',
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export default function ProjectBoard({ project, onBack }: { project: Project, onBack: () => void }) {
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newColName, setNewColName] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)

  useEffect(() => {
    loadBoard()
  }, [project.id])

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

  const cardsInColumn = (columnId: string) =>
    cards.filter((c) => c.column_id === columnId).sort((a, b) => a.position - b.position)

  const handleAddCard = async (columnId: string) => {
    if (!newTitle.trim()) return
    try {
      await window.api.cards.create({
        project_id: project.id,
        column_id: columnId,
        title: newTitle,
      })
      setNewTitle('')
      setAddingTo(null)
      createSound()
      await loadBoard()
    } catch (error) {
      console.error('Failed to create card:', error)
    }
  }

  const handleDeleteCard = async (id: string) => {
    deleteSound()
    try {
      await window.api.cards.delete(id)
      await loadBoard()
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const handleMoveCard = async (cardId: string, targetColumnId: string) => {
    try {
      const targetCards = cardsInColumn(targetColumnId)
      const targetCol = columns.find((c) => c.id === targetColumnId)
      await window.api.cards.move({
        id: cardId,
        column_id: targetColumnId,
        position: targetCards.length,
      })
      if (targetCol?.is_done) {
        completeSound()
      } else {
        moveSound()
      }
      await loadBoard()
    } catch (error) {
      console.error('Failed to move card:', error)
    }
  }

  const handleUpdatePoints = async (cardId: string, points: number) => {
    clickSound()
    try {
      await window.api.cards.update({ id: cardId, points })
      await loadBoard()
    } catch (error) {
      console.error('Failed to update points:', error)
    }
  }

  const handleUpdatePriority = async (cardId: string, priority: string) => {
    clickSound()
    try {
      await window.api.cards.update({ id: cardId, priority })
      await loadBoard()
    } catch (error) {
      console.error('Failed to update priority:', error)
    }
  }

  const handleAddColumn = async () => {
    if (!newColName.trim()) return
    try {
      await window.api.columns.create({ project_id: project.id, name: newColName })
      setNewColName('')
      setAddingColumn(false)
      createSound()
      await loadBoard()
    } catch (error) {
      console.error('Failed to create column:', error)
    }
  }

  const handleDeleteColumn = async (id: string) => {
    deleteSound()
    try {
      await window.api.columns.delete(id)
      await loadBoard()
    } catch (error) {
      console.error('Failed to delete column:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-sm"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full items-start">
          {columns.map((col) => (
            <div key={col.id} className="bg-gray-100 rounded-lg p-3 w-72 shrink-0">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-gray-700">{col.name}</h3>
                  <span className="text-xs text-gray-400">{cardsInColumn(col.id).length}</span>
                </div>
                <button
                  onClick={() => handleDeleteColumn(col.id)}
                  className="text-gray-300 hover:text-red-500 text-sm cursor-pointer transition-colors"
                  title="Delete column"
                >
                  ×
                </button>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {cardsInColumn(col.id).map((card) => (
                    <motion.div
                      key={card.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
                    >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm text-gray-900 font-medium">{card.title}</span>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="text-gray-300 hover:text-red-500 text-sm leading-none cursor-pointer transition-colors shrink-0 ml-2"
                      >
                        ×
                      </button>
                    </div>

                    {/* Points */}
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs text-gray-400 mr-1">Pts:</span>
                      {[1, 2, 3, 4, 5].map((pt) => (
                        <button
                          key={pt}
                          onClick={() => handleUpdatePoints(card.id, pt)}
                          className={`w-5 h-5 text-xs rounded cursor-pointer transition-colors ${
                            card.points === pt
                              ? 'bg-blue-500 text-white font-semibold'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>

                    {/* Priority */}
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs text-gray-400 mr-1">Pri:</span>
                      {(['none', 'low', 'medium', 'high'] as const).map((pri) => (
                        <button
                          key={pri}
                          onClick={() => handleUpdatePriority(card.id, pri)}
                          className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                            card.priority === pri
                              ? PRIORITY_BADGES[pri] + ' font-semibold'
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {pri[0].toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {/* Move buttons */}
                    <div className="flex gap-1 flex-wrap">
                      {columns
                        .filter((c) => c.id !== col.id)
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleMoveCard(card.id, c.id)}
                            className="text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          >
                            → {c.name}
                          </button>
                        ))}
                    </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Add card */}
              {addingTo === col.id ? (
                <div className="mt-2">
                  <input
                    autoFocus
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCard(col.id)
                      if (e.key === 'Escape') { setAddingTo(null); setNewTitle('') }
                    }}
                    placeholder="Card title..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => handleAddCard(col.id)}
                      className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingTo(null); setNewTitle('') }}
                      className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-200 rounded cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(col.id); setNewTitle('') }}
                  className="mt-2 w-full text-left text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-200 px-2 py-1 rounded cursor-pointer transition-colors"
                >
                  + Add card
                </button>
              )}
            </div>
          ))}

          {/* Add column */}
          {addingColumn ? (
            <div className="bg-gray-100 rounded-lg p-3 w-72 shrink-0">
              <input
                autoFocus
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn()
                  if (e.key === 'Escape') { setAddingColumn(false); setNewColName('') }
                }}
                placeholder="Column name..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <div className="flex gap-1 mt-2">
                <button
                  onClick={handleAddColumn}
                  className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingColumn(false); setNewColName('') }}
                  className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-200 rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="bg-gray-100 hover:bg-gray-200 rounded-lg p-3 w-72 shrink-0 text-sm text-gray-400 hover:text-gray-600 cursor-pointer transition-colors text-left"
            >
              + Add column
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
