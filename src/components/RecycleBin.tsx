import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RotateCcw, Trash2, Clock } from 'lucide-react'
import type { RecycleItem } from '../types'
import { clickSound, deleteSound } from '../sounds'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { type ContextMenuPosition } from './ContextMenu'

const TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  card: 'Card',
  note: 'Note',
}

const TYPE_COLORS: Record<string, string> = {
  project: 'bg-special-subtle text-special-strong',
  card: 'bg-accent-subtle text-accent-strong',
  note: 'bg-success-subtle text-success-strong',
}

export default function RecycleBin() {
  const [items, setItems] = useState<RecycleItem[]>([])
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string } | null>(null)
  const [menu, setMenu] = useState<{ item: RecycleItem; position: ContextMenuPosition } | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setItems(await window.api.recycle.list())
  }

  const handleRestore = async (type: string, id: string) => {
    clickSound()
    await window.api.recycle.restore(type, id)
    await load()
  }

  const handlePurge = (type: string, id: string) => {
    setConfirmDelete({ type, id })
  }

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return
    deleteSound()
    await window.api.recycle.purge(confirmDelete.type, confirmDelete.id)
    await load()
    setConfirmDelete(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (daysAgo === 0) return 'Today'
    if (daysAgo === 1) return 'Yesterday'
    return `${daysAgo} days ago`
  }

  const daysUntilPurge = (iso: string) => {
    const d = new Date(iso)
    return Math.max(0, 30 - Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)))
  }

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="max-w-3xl mx-auto px-6 py-8">
        {items.length === 0 && (
          <div className="text-center py-16 text-ink-faint">
            <p className="text-lg">Recycle bin is empty</p>
            <p className="text-sm mt-1">Deleted items appear here for 30 days before being permanently removed</p>
          </div>
        )}

        <div className="space-y-2">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={`${item.type}-${item.id}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="bg-surface rounded-lg border border-border px-4 py-3 flex items-center justify-between"
                onContextMenu={(e) => { e.preventDefault(); setMenu({ item, position: { x: e.clientX, y: e.clientY } }) }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[item.type]}`}>
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-sm text-ink-secondary truncate">{item.title}</span>
                  <span className="text-xs text-ink-faint shrink-0">{formatDate(item.deleted_at)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-xs text-ink-faint flex items-center gap-1 shrink-0">
                    <Clock size={14} />
                    Purges in {daysUntilPurge(item.deleted_at)}d
                  </span>
                  <button
                    onClick={() => handleRestore(item.type, item.id)}
                    className="text-xs px-2 py-1 text-accent-hover hover:bg-accent-subtle rounded cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                  <button
                    onClick={() => handlePurge(item.type, item.id)}
                    className="text-xs px-2 py-1 text-danger hover:bg-danger-subtle rounded cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Delete now
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Permanently delete?"
        message="This item will be permanently deleted and cannot be recovered."
        confirmText="Delete permanently"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      <ContextMenu
        position={menu?.position ?? null}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'Restore', icon: RotateCcw, onClick: () => handleRestore(menu.item.type, menu.item.id) },
                'separator',
                { label: 'Delete permanently', icon: Trash2, danger: true, onClick: () => handlePurge(menu.item.type, menu.item.id) },
              ]
            : []
        }
      />
    </div>
  )
}
