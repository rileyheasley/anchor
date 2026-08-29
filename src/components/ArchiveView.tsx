import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Project } from '../types'
import { clickSound } from '../sounds'

export default function ArchiveView({ onBack, onOpenProject }: { onBack: () => void, onOpenProject: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setProjects(await window.api.archive.list())
  }

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    clickSound()
    await window.api.archive.restore(id)
    await load()
  }

  const progressPercent = (p: Project) =>
    p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-sm">← Back</button>
          <h1 className="text-xl font-semibold text-gray-900">Archive</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {projects.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No archived projects</p>
            <p className="text-sm mt-1">Archive a project from the home page to store it here</p>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence>
            {projects.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => onOpenProject(p)}
                className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow opacity-75 hover:opacity-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-700">{p.name}</h3>
                  <button
                    onClick={(e) => handleRestore(e, p.id)}
                    className="text-xs px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-full border border-blue-200 cursor-pointer transition-colors"
                  >
                    Restore
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gray-400 h-full rounded-full"
                      style={{ width: `${progressPercent(p)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {p.total_points > 0 ? `${p.done_points}/${p.total_points} pts` : 'No cards'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
