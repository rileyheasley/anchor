import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { RecycleItem } from '../types'
import { clickSound, deleteSound } from '../sounds'

const TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  card: 'Card',
  note: 'Note',
}

const TYPE_COLORS: Record<string, string> = {
  project: 'bg-purple-100 text-purple-700',
  card: 'bg-blue-100 text-blue-700',
  note: 'bg-green-100 text-green-700',
}

export default function RecycleBin() {
  const [items, setItems] = useState<RecycleItem[]>([])

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

  const handlePurge = async (type: string, id: string) => {
    deleteSound()
    await window.api.recycle.purge(type, id)
    await load()
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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-6 py-8">
        {items.length === 0 && (
          <div className="text-center py-16 text-gray-400">
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
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[item.type]}`}>
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-sm text-gray-800 truncate">{item.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(item.deleted_at)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-xs text-gray-400">Purges in {daysUntilPurge(item.deleted_at)}d</span>
                  <button
                    onClick={() => handleRestore(item.type, item.id)}
                    className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePurge(item.type, item.id)}
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded cursor-pointer transition-colors"
                  >
                    Delete now
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
