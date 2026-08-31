import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, X, FolderOpen, CheckCircle2, Circle, ArrowRightCircle, Flag } from 'lucide-react'
import type { Project, KanbanColumn, Card, Note, Priority, ProjectStatus } from '../types'
import { clickSound, createSound, deleteSound, completeSound, moveSound } from '../sounds'
import ProjectHeader from './ProjectHeader'
import SortDropdown from './SortDropdown'
import CardCreateModal from './CardCreateModal'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuEntry, type ContextMenuPosition } from './ContextMenu'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { PRIORITY_BADGES } from '../utils/priority'
import { stripMarkdownPreview } from '../utils/markdown'
import MarkdownEditor from './MarkdownEditor'

type CardSortMode = 'manual' | 'priority' | 'dueDate' | 'points' | 'name' | 'created'

const CARD_PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 }
const CARD_SORT_LABELS: Record<CardSortMode, string> = {
  manual: 'Manual',
  priority: 'Priority',
  dueDate: 'Due date',
  points: 'Points',
  name: 'Name',
  created: 'Date created',
}

export default function ProjectBoard({ project, onClose, onProjectUpdate, focusCardId, onFocusCardHandled }: { project: Project, onClose: () => void, onProjectUpdate?: (updatedProject: Project) => void, focusCardId?: string | null, onFocusCardHandled?: () => void }) {
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [creatingInColumn, setCreatingInColumn] = useState<string | null>(null)
  const [isCreatingCard, setIsCreatingCard] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColIsDone, setNewColIsDone] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [cardSort, setCardSort] = useState<CardSortMode>('manual')

  // Deletion confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'column' | 'card', id: string } | null>(null)

  // Drag state for cards
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null)

  // Drag state for columns
  const [draggingColId, setDraggingColId] = useState<string | null>(null)
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null)

  // Card detail panel
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [cardNote, setCardNote] = useState<Note | null>(null)
  const [notePreviews, setNotePreviews] = useState<Record<string, string>>({})
  const [noteContent, setNoteContent] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Project update state
  const [isUpdatingProject, setIsUpdatingProject] = useState(false)

  // Right-click context menus
  const [cardMenu, setCardMenu] = useState<{ card: Card; position: ContextMenuPosition } | null>(null)
  const [columnMenu, setColumnMenu] = useState<{ column: KanbanColumn; position: ContextMenuPosition } | null>(null)

  const selectedCardIdRef = useRef<string | null>(null)

  useEffect(() => { loadBoard() }, [project.id])
  useEffect(() => { if (selectedCard) loadCardNote(selectedCard) }, [selectedCard?.id])
  useEffect(() => { selectedCardIdRef.current = selectedCard?.id ?? null }, [selectedCard])

  // Deep-link support: open a specific card's detail panel once it's loaded (e.g. from search)
  useEffect(() => {
    if (!focusCardId || cards.length === 0) return
    const card = cards.find((c) => c.id === focusCardId)
    if (card) {
      setSelectedCard(card)
      onFocusCardHandled?.()
    }
  }, [focusCardId, cards])

  useEffect(() => {
    return () => {
      if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
    }
  }, [])

  // Esc closes the card editor panel first; when nothing else is open, it exits the board.
  useEscapeKey(() => {
    clickSound()
    if (noteDirty) saveNoteContent()
    setSelectedCard(null)
  }, !!selectedCard && !confirmDelete)
  useEscapeKey(onClose, !selectedCard && !confirmDelete && !creatingInColumn && !addingColumn)

  const loadBoard = async () => {
    try {
      const [cols, crds, previews] = await Promise.all([
        window.api.columns.list(project.id),
        window.api.cards.list(project.id),
        window.api.notes.previewsForProject(project.id),
      ])
      setColumns(cols)
      setCards(crds)
      setNotePreviews(previews)
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
    const cardId = selectedCard.id
    const note = await window.api.notes.create({ title: selectedCard.title, card_id: cardId })
    createSound()
    const text = await window.api.notes.getContent(note.id) ?? ''
    if (selectedCardIdRef.current !== cardId) return
    setCardNote(note as Note)
    setNoteContent(text)
  }

  const handleNoteContentChange = (val: string) => {
    setNoteContent(val)
    setNoteDirty(true)
    if (selectedCard) setNotePreviews((prev) => ({ ...prev, [selectedCard.id]: val }))
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
    noteSaveTimer.current = setTimeout(() => saveNoteContent(val), 1500)
  }

  const saveNoteContent = async (content?: string) => {
    if (!cardNote) return
    await window.api.notes.saveContent(cardNote.id, content ?? noteContent)
    setNoteDirty(false)
  }

  const cardsInColumn = (columnId: string) => {
    const list = cards.filter((c) => c.column_id === columnId)
    switch (cardSort) {
      case 'priority':
        return list.sort((a, b) => CARD_PRIORITY_ORDER[a.priority] - CARD_PRIORITY_ORDER[b.priority] || a.position - b.position)
      case 'dueDate':
        return list.sort((a, b) => {
          if (!a.due_date && !b.due_date) return a.position - b.position
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        })
      case 'points':
        return list.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.position - b.position)
      case 'name':
        return list.sort((a, b) => a.title.localeCompare(b.title))
      case 'created':
        return list.sort((a, b) => a.created_at.localeCompare(b.created_at))
      default:
        return list.sort((a, b) => a.position - b.position)
    }
  }

  const handleCreateCard = async (data: { title: string; points: number | null; priority: Priority; due_date: string | null }) => {
    if (!creatingInColumn) return
    setIsCreatingCard(true)
    try {
      await window.api.cards.create({
        project_id: project.id,
        column_id: creatingInColumn,
        title: data.title,
        points: data.points ?? undefined,
        priority: data.priority,
        due_date: data.due_date ?? undefined,
      })
      await loadBoard()
    } catch (error) {
      console.error('Failed to create card:', error)
      throw error
    } finally {
      setIsCreatingCard(false)
    }
  }

  const handleDeleteCard = async (id: string) => {
    setConfirmDelete({ type: 'card', id })
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

  const handleReorderCards = async (cardId: string, targetCardId: string) => {
    const sourceCard = cards.find((c) => c.id === cardId)
    if (!sourceCard) return
    const columnId = sourceCard.column_id
    const columnCards = cardsInColumn(columnId)
    const sourceIndex = columnCards.findIndex((c) => c.id === cardId)
    const targetIndex = columnCards.findIndex((c) => c.id === targetCardId)
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return

    const reordered = [...columnCards]
    const [removed] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, removed)

    setCards((prev) => {
      const others = prev.filter((c) => c.column_id !== columnId)
      return [...others, ...reordered.map((c, i) => ({ ...c, position: i }))]
    })
    try {
      await window.api.cards.reorder({ column_id: columnId, card_ids: reordered.map((c) => c.id) })
    } catch (error) {
      console.error('Failed to reorder cards:', error)
      await loadBoard()
    }
  }

  const handleCardDrop = async (targetCard: Card) => {
    setDragOverCardId(null)
    if (!draggingId || draggingId === targetCard.id) return
    const sourceCard = cards.find((c) => c.id === draggingId)
    if (!sourceCard) return
    if (sourceCard.column_id === targetCard.column_id) {
      if (cardSort === 'manual') await handleReorderCards(draggingId, targetCard.id)
      return
    }
    try {
      const targetCards = cardsInColumn(targetCard.column_id)
      const targetIndex = targetCards.findIndex((c) => c.id === targetCard.id)
      await window.api.cards.move({ id: draggingId, column_id: targetCard.column_id, position: targetIndex })
      const targetCol = columns.find((c) => c.id === targetCard.column_id)
      targetCol?.is_done ? completeSound() : moveSound()
      await loadBoard()
      if (selectedCard?.id === draggingId) setSelectedCard((prev) => prev ? { ...prev, column_id: targetCard.column_id } : prev)
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
      await window.api.cards.update({ id: cardId, priority: priority as Priority })
      await loadBoard()
      if (selectedCard?.id === cardId) setSelectedCard(prev => prev ? { ...prev, priority: priority as Card['priority'] } : prev)
    } catch (error) { console.error('Failed to update priority:', error) }
  }

  const handleAddColumn = async () => {
    if (!newColName.trim()) return
    try {
      await window.api.columns.create({ project_id: project.id, name: newColName, is_done: newColIsDone ? 1 : 0 })
      setNewColName('')
      setNewColIsDone(false)
      setAddingColumn(false)
      createSound()
      await loadBoard()
    } catch (error) { console.error('Failed to create column:', error) }
  }

  const handleToggleColumnDone = async (col: KanbanColumn) => {
    clickSound()
    try {
      await window.api.columns.update({ id: col.id, is_done: col.is_done ? 0 : 1 })
      await loadBoard()
    } catch (error) { console.error('Failed to update column:', error) }
  }

  const buildCardMenuItems = (card: Card): ContextMenuEntry[] => [
    { label: 'Open card', icon: FolderOpen, onClick: () => openDetail(card) },
    'separator',
    {
      label: 'Set priority',
      icon: Flag,
      items: (['high', 'medium', 'low', 'none'] as const).map((pri) => ({
        label: pri.charAt(0).toUpperCase() + pri.slice(1),
        icon: card.priority === pri ? CheckCircle2 : Circle,
        onClick: () => handleUpdatePriority(card.id, pri),
      })),
    },
    {
      label: 'Move to column',
      icon: ArrowRightCircle,
      disabled: columns.filter((col) => col.id !== card.column_id).length === 0,
      items: columns
        .filter((col) => col.id !== card.column_id)
        .map((col) => ({
          label: col.name,
          onClick: () => handleMoveCard(card.id, col.id),
        })),
    },
    'separator' as const,
    { label: 'Delete card', icon: Trash2, danger: true, onClick: () => setConfirmDelete({ type: 'card', id: card.id }) },
  ]

  const buildColumnMenuItems = (col: KanbanColumn): ContextMenuEntry[] => [
    { label: 'Add card', icon: Plus, onClick: () => setCreatingInColumn(col.id) },
    { label: col.is_done ? 'Unmark as done column' : 'Mark as done column', icon: CheckCircle2, onClick: () => handleToggleColumnDone(col) },
    'separator',
    { label: 'Delete column', icon: Trash2, danger: true, onClick: () => setConfirmDelete({ type: 'column', id: col.id }) },
  ]

  const handleReorderColumns = async (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    const newColumns = [...columns]
    const [removed] = newColumns.splice(sourceIndex, 1)
    newColumns.splice(targetIndex, 0, removed)
    setColumns(newColumns)
    try {
      await window.api.columns.reorder({ project_id: project.id, column_ids: newColumns.map(c => c.id) })
    } catch (error) {
      console.error('Failed to reorder columns:', error)
      await loadBoard()
    }
  }

  const handleDeleteColumn = async (id: string) => {
    setConfirmDelete({ type: 'column', id })
  }

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return
    deleteSound()
    try {
      if (confirmDelete.type === 'column') {
        await window.api.columns.delete(confirmDelete.id)
      } else {
        if (selectedCard?.id === confirmDelete.id) setSelectedCard(null)
        await window.api.cards.delete(confirmDelete.id)
      }
      await loadBoard()
      // Reload project to update total_points and done_points
      const updatedProject = await window.api.projects.list()
      const currentProject = updatedProject.find(p => p.id === project.id)
      if (currentProject && onProjectUpdate) {
        onProjectUpdate(currentProject)
      }
    } catch (error) { console.error(`Failed to delete ${confirmDelete.type}:`, error) }
    setConfirmDelete(null)
  }

  const openDetail = (card: Card) => {
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current)
    if (noteDirty) saveNoteContent()
    setSelectedCard(card)
    clickSound()
  }

  const handleUpdateProject = async (data: { name?: string; priority?: Priority; status?: ProjectStatus; due_date?: string | null }) => {
    setIsUpdatingProject(true)
    try {
      await window.api.projects.update({ id: project.id, ...data })
      // Note: The project prop is from parent component, so they handle re-rendering
    } catch (error) {
      console.error('Failed to update project:', error)
      throw error
    } finally {
      setIsUpdatingProject(false)
    }
  }

  return (
    <div className="h-full bg-surface-sunken flex flex-col">
      <ProjectHeader
        project={project}
        onUpdateProject={handleUpdateProject}
        totalPoints={cards.reduce((sum, c) => sum + (c.points ?? 0), 0)}
        donePoints={cards
          .filter((c) => columns.find((col) => col.id === c.column_id)?.is_done)
          .reduce((sum, c) => sum + (c.points ?? 0), 0)}
        isLoading={isUpdatingProject}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center px-6 pt-4 shrink-0">
            <SortDropdown
              options={(Object.keys(CARD_SORT_LABELS) as CardSortMode[]).map((mode) => ({ value: mode, label: CARD_SORT_LABELS[mode] }))}
              value={cardSort}
              onChange={setCardSort}
            />
          </div>
          {/* Overflow is suppressed mid-drag: Chromium's native drag auto-scroll otherwise
              flashes the OS-default scrollbar over our themed one. */}
          <div className={`flex-1 px-6 pb-6 pt-3 ${draggingId || draggingColId ? 'overflow-hidden' : 'overflow-x-auto'}`}>
          <div className="flex gap-4 h-full items-start">
            {columns.map((col, colIndex) => {
              const isColumnDragTarget = dragOverColIndex === colIndex && draggingColId && draggingColId !== col.id
              return (
              <div
                key={col.id}
                className={`rounded-lg p-3 w-72 shrink-0 transition-all duration-150 ${
                  dragOverColId === col.id && !draggingColId ? 'bg-accent-subtle ring-2 ring-accent/40' : 'bg-surface-muted'
                } ${
                  isColumnDragTarget ? 'ring-2 ring-warning/50 scale-105' : ''
                } ${
                  draggingColId === col.id ? 'opacity-50' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (draggingColId && draggingColId !== col.id) {
                    setDragOverColIndex(colIndex)
                  } else if (!draggingColId) {
                    setDragOverColId(col.id)
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (draggingColId) {
                      setDragOverColIndex(null)
                    } else {
                      setDragOverColId(null)
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggingColId && draggingColId !== col.id) {
                    const sourceIndex = columns.findIndex(c => c.id === draggingColId)
                    handleReorderColumns(sourceIndex, colIndex)
                    setDragOverColIndex(null)
                  } else if (draggingId) {
                    handleMoveCard(draggingId, col.id)
                    setDragOverColId(null)
                  }
                }}
              >
                <div
                  className="flex items-center justify-between mb-3 px-1 group cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDraggingColId(col.id)}
                  onDragEnd={() => setDraggingColId(null)}
                  onContextMenu={(e) => { e.preventDefault(); setColumnMenu({ column: col, position: { x: e.clientX, y: e.clientY } }) }}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-medium text-sm text-ink-secondary">{col.name}</h3>
                    <span className="text-xs text-ink-faint">{cardsInColumn(col.id).length}</span>
                    {col.is_done ? <span className="text-xs text-success">✓</span> : null}
                  </div>
                  <button onClick={() => handleDeleteColumn(col.id)} className="text-ink-faint/70 hover:text-danger p-1 cursor-pointer transition-colors" title="Delete column">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {cardsInColumn(col.id).map((card) => {
                      const due = card.due_date ? (() => {
                        const d = new Date(card.due_date); const t = new Date()
                        t.setHours(0,0,0,0); d.setHours(0,0,0,0)
                        const diff = Math.round((d.getTime()-t.getTime())/86400000)
                        if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-danger' }
                        if (diff === 0) return { label: 'Today', color: 'text-danger' }
                        if (diff <= 3) return { label: `${diff}d`, color: 'text-warning' }
                        return { label: `${diff}d`, color: 'text-ink-faint' }
                      })() : null
                      const isSelected = selectedCard?.id === card.id

                      return (
                        <motion.button
                          key={card.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: draggingId === card.id ? 0.4 : 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
                          draggable
                          onDragStart={() => setDraggingId(card.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverColId(null); setDragOverCardId(null) }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (draggingId && draggingId !== card.id) setDragOverCardId(card.id)
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCardId((id) => (id === card.id ? null : id))
                          }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleCardDrop(card) }}
                          onClick={() => openDetail(card)}
                          onContextMenu={(e) => { e.preventDefault(); setCardMenu({ card, position: { x: e.clientX, y: e.clientY } }) }}
                          className={`w-full bg-surface rounded-lg border transition-all text-left cursor-grab active:cursor-grabbing group ${
                            isSelected ? 'border-accent-hover ring-1 ring-accent/40' : 'border-border'
                          } ${
                            dragOverCardId === card.id ? 'ring-2 ring-accent/50' : ''
                          }`}
                        >
                          <div className="p-3 flex flex-col gap-2">
                            {/* Title */}
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-heading text-sm text-ink font-medium leading-snug group-hover:text-accent-hover transition-colors flex-1">
                                {card.title}
                              </h3>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCard(card.id)
                                }}
                                className="text-ink-faint/50 hover:text-danger text-lg leading-none cursor-pointer transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                              >
                                ×
                              </button>
                            </div>

                            {/* Note preview */}
                            {notePreviews[card.id] && (
                              <p className="text-xs text-ink-faint line-clamp-2 leading-snug">
                                {stripMarkdownPreview(notePreviews[card.id])}
                              </p>
                            )}

                            {/* Metadata Footer */}
                            <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
                              <div className="flex items-center gap-2">
                                {card.points !== null && card.points > 0 && (
                                  <span className="text-ink-secondary font-medium">{card.points} pts</span>
                                )}
                                {card.priority !== 'none' && (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGES[card.priority]}`}>
                                    {card.priority[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                              {due && (
                                <span className={`text-xs font-medium ${due.color}`}>
                                  {due.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>

                <button onClick={() => { clickSound(); setCreatingInColumn(col.id) }}
                  className="mt-2 w-full text-left text-sm text-ink-faint hover:text-ink-secondary hover:bg-border-strong px-2 py-1 rounded cursor-pointer transition-colors flex items-center gap-2">
                  <Plus size={16} />
                  Add card
                </button>
              </div>
            )
            })}

            {addingColumn ? (
              <div className="bg-surface-muted rounded-lg p-3 w-72 shrink-0">
                <input autoFocus type="text" value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn()
                    if (e.key === 'Escape') { setAddingColumn(false); setNewColName(''); setNewColIsDone(false) }
                  }}
                  placeholder="Column name..."
                  className="w-full px-2 py-1.5 text-sm border border-border-strong rounded bg-surface-sunken text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <label className="flex items-center gap-2 mt-3 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newColIsDone}
                    onChange={(e) => setNewColIsDone(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-ink-secondary">Mark as done column</span>
                </label>
                <div className="flex gap-1 mt-2">
                  <button onClick={handleAddColumn} className="text-xs px-2 py-1 bg-primary text-ink-inverse rounded hover:bg-primary-hover cursor-pointer transition-colors flex items-center gap-1">
                    <Plus size={14} />
                    Add
                  </button>
                  <button onClick={() => { clickSound(); setAddingColumn(false); setNewColName(''); setNewColIsDone(false) }} className="text-xs px-2 py-1 text-ink-muted hover:bg-border-strong rounded cursor-pointer transition-colors flex items-center gap-1">
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { clickSound(); setAddingColumn(true) }}
                className="bg-surface-muted hover:bg-border-strong rounded-lg p-3 w-72 shrink-0 text-sm text-ink-faint hover:text-ink-secondary cursor-pointer transition-colors text-left flex items-center gap-2">
                <Plus size={16} />
                Add column
              </button>
            )}
          </div>
          </div>
        </div>

      </div>

      {/* Card edit modal */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { clickSound(); if (noteDirty) saveNoteContent(); setSelectedCard(null) }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={selectedCard.title}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border-subtle rounded-lg shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0">
                <h2 className="font-heading text-lg font-medium text-ink truncate mr-2">{selectedCard.title}</h2>
                <button
                  onClick={() => { clickSound(); if (noteDirty) saveNoteContent(); setSelectedCard(null) }}
                  className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer shrink-0"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Points</label>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map((pt) => (
                      <button key={pt} onClick={() => handleUpdatePoints(selectedCard.id, pt)}
                        className={`w-9 h-9 text-sm rounded-lg cursor-pointer transition-colors font-medium ${
                          selectedCard.points === pt ? 'bg-accent text-ink-inverse' : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
                        }`}>{pt}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Priority</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['none','low','medium','high'] as const).map((pri) => (
                      <button key={pri} onClick={() => handleUpdatePriority(selectedCard.id, pri)}
                        className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          selectedCard.priority === pri ? PRIORITY_BADGES[pri] + ' font-semibold' : 'bg-surface-muted text-ink-faint hover:bg-border-strong'
                        }`}>{pri}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-2">Column</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {columns.map((col) => (
                      <button key={col.id} onClick={() => handleMoveCard(selectedCard.id, col.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          selectedCard.column_id === col.id ? 'bg-primary text-ink-inverse' : 'bg-surface-muted text-ink-muted hover:bg-border-strong'
                        }`}>{col.name}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-ink-faint uppercase tracking-wide">Note</label>
                    {noteDirty && <span className="text-xs text-ink-faint">Saving…</span>}
                  </div>
                  {cardNote ? (
                    <div className="h-64 border border-border rounded-lg overflow-y-auto">
                      <MarkdownEditor
                        content={noteContent}
                        onChange={handleNoteContentChange}
                        onBlur={() => saveNoteContent()}
                        placeholder="Write your note in markdown…"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={handleCreateCardNote}
                      className="w-full py-4 text-sm text-ink-faint hover:text-ink-secondary border border-dashed border-border rounded-lg cursor-pointer hover:border-border-strong transition-colors"
                    >
                      + Create note
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardCreateModal
        isOpen={!!creatingInColumn}
        onClose={() => setCreatingInColumn(null)}
        onCreate={handleCreateCard}
        isLoading={isCreatingCard}
      />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={confirmDelete?.type === 'column' ? 'Delete column?' : 'Delete card?'}
        message={confirmDelete?.type === 'column' 
          ? 'This will delete the entire column and all cards in it. This action cannot be undone.'
          : 'This card will be moved to the recycle bin. You can restore it later.'}
        confirmText="Delete"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      <ContextMenu
        position={cardMenu?.position ?? null}
        onClose={() => setCardMenu(null)}
        items={cardMenu ? buildCardMenuItems(cardMenu.card) : []}
      />

      <ContextMenu
        position={columnMenu?.position ?? null}
        onClose={() => setColumnMenu(null)}
        items={columnMenu ? buildColumnMenuItems(columnMenu.column) : []}
      />
    </div>
  )
}
