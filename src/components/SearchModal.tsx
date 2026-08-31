import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, FolderOpen, Layers, FileText } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { clickSound } from '../sounds'
import type { SearchResults } from '../types'

export type SearchSelection =
  | { type: 'project'; id: string }
  | { type: 'card'; id: string; projectId: string }
  | { type: 'note'; id: string; projectId: string | null }

const EMPTY_RESULTS: SearchResults = { projects: [], cards: [], notes: [] }

export default function SearchModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  onSelect: (selection: SearchSelection) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEscapeKey(onClose, isOpen)
  useFocusTrap(panelRef, isOpen)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults(EMPTY_RESULTS)
    }
  }, [isOpen])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults(EMPTY_RESULTS)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await window.api.search.query(query.trim()))
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const handleSelect = (selection: SearchSelection) => {
    clickSound()
    onSelect(selection)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const first: SearchSelection | null =
      results.projects[0] ? { type: 'project', id: results.projects[0].id } :
      results.cards[0] ? { type: 'card', id: results.cards[0].id, projectId: results.cards[0].project_id } :
      results.notes[0] ? { type: 'note', id: results.notes[0].id, projectId: results.notes[0].resolved_project_id } :
      null
    if (first) handleSelect(first)
  }

  const hasResults = results.projects.length + results.cards.length + results.notes.length > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50"
          onClick={onClose}
        >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        tabIndex={-1}
        initial={{ scale: 0.97, opacity: 0, y: -8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border-subtle rounded-lg shadow-lg w-full max-w-lg flex flex-col max-h-[60vh]"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle shrink-0">
          <Search size={16} className="text-ink-faint shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, cards, and notes…"
            className="flex-1 bg-transparent text-sm text-ink placeholder-ink-faint focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {!query.trim() && (
            <p className="text-xs text-ink-faint px-4 py-6 text-center">Start typing to search</p>
          )}
          {query.trim() && !loading && !hasResults && (
            <p className="text-xs text-ink-faint px-4 py-6 text-center">No results for &ldquo;{query.trim()}&rdquo;</p>
          )}

          {results.projects.length > 0 && (
            <div className="mb-1">
              <div className="text-xs text-ink-faint uppercase tracking-wide px-4 py-1.5">Projects</div>
              {results.projects.map((p) => (
                <motion.button
                  key={p.id}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect({ type: 'project', id: p.id })}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                >
                  <FolderOpen size={14} className="text-ink-faint shrink-0" />
                  <span className="truncate">{p.name}</span>
                </motion.button>
              ))}
            </div>
          )}

          {results.cards.length > 0 && (
            <div className="mb-1">
              <div className="text-xs text-ink-faint uppercase tracking-wide px-4 py-1.5">Cards</div>
              {results.cards.map((c) => (
                <motion.button
                  key={c.id}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect({ type: 'card', id: c.id, projectId: c.project_id })}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                >
                  <Layers size={14} className="text-ink-faint shrink-0" />
                  <span className="truncate flex-1">{c.title}</span>
                  <span className="text-xs text-ink-faint truncate shrink-0 max-w-[35%]">{c.project_name}</span>
                </motion.button>
              ))}
            </div>
          )}

          {results.notes.length > 0 && (
            <div>
              <div className="text-xs text-ink-faint uppercase tracking-wide px-4 py-1.5">Notes</div>
              {results.notes.map((n) => (
                <motion.button
                  key={n.id}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect({ type: 'note', id: n.id, projectId: n.resolved_project_id })}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-ink-secondary hover:bg-surface-sunken cursor-pointer transition-colors"
                >
                  <FileText size={14} className="text-ink-faint shrink-0" />
                  <span className="truncate flex-1">{n.title}</span>
                  {n.project_name && (
                    <span className="text-xs text-ink-faint truncate shrink-0 max-w-[35%]">{n.project_name}</span>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
