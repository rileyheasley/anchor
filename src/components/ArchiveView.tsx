import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RotateCcw, FolderOpen } from 'lucide-react'
import type { Project } from '../types'
import { clickSound } from '../sounds'
import ContextMenu, { type ContextMenuPosition } from './ContextMenu'

export default function ArchiveView({ onOpenProject }: { onOpenProject: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<{ project: Project; position: ContextMenuPosition } | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setProjects(await window.api.archive.list())
    setLoading(false)
  }

  const handleRestore = async (id: string) => {
    clickSound()
    await window.api.archive.restore(id)
    await load()
  }

  const progressPercent = (p: Project) =>
    p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="max-w-3xl mx-auto px-6 py-8">
        {!loading && projects.length === 0 && (
          <div className="text-center py-16 text-ink-faint">
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
                onClick={() => { clickSound(); onOpenProject(p) }}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ project: p, position: { x: e.clientX, y: e.clientY } }) }}
                className="bg-surface rounded-lg border border-border p-4 cursor-pointer hover:shadow-md transition-shadow opacity-75 hover:opacity-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-ink-secondary">{p.name}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore(p.id) }}
                    className="text-xs px-3 py-1 text-accent-hover hover:bg-accent-subtle rounded-full border border-accent/30 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-surface-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-ink-faint h-full rounded-full"
                      style={{ width: `${progressPercent(p)}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap">
                    {p.total_points > 0 ? `${p.done_points}/${p.total_points} pts` : 'No cards'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <ContextMenu
        position={menu?.position ?? null}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                { label: 'Open project', icon: FolderOpen, onClick: () => onOpenProject(menu.project) },
                'separator',
                { label: 'Restore project', icon: RotateCcw, onClick: () => handleRestore(menu.project.id) },
              ]
            : []
        }
      />
    </div>
  )
}
