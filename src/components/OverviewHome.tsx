import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Project, RecycleItem } from '../types'

export default function OverviewHome({ onOpenProject }: { onOpenProject: (project: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [recycleItems, setRecycleItems] = useState<RecycleItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [proj, recycle] = await Promise.all([
        window.api.projects.list(),
        window.api.recycle.list(),
      ])
      setProjects(proj.filter(p => !p.archived).slice(0, 5))
      setRecycleItems(recycle)
    } catch (error) {
      console.error('Failed to load home data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center">
        <div className="text-ink-faint">Loading...</div>
      </div>
    )
  }

  const totalPoints = projects.reduce((sum, p) => sum + (p.total_points || 0), 0)
  const donePoints = projects.reduce((sum, p) => sum + (p.done_points || 0), 0)
  const activeProjects = projects.length

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-ink mb-2">Welcome back</h1>
          <p className="text-ink-muted">Here's an overview of your projects and activity</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-lg border border-border p-6"
          >
            <div className="text-sm text-ink-muted mb-1">Active Projects</div>
            <div className="text-3xl font-bold text-ink">{activeProjects}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface rounded-lg border border-border p-6"
          >
            <div className="text-sm text-ink-muted mb-1">Total Points</div>
            <div className="text-3xl font-bold text-ink">{totalPoints}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface rounded-lg border border-border p-6"
          >
            <div className="text-sm text-ink-muted mb-1">Completed</div>
            <div className="text-3xl font-bold text-ink">
              {totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0}%
            </div>
          </motion.div>
        </div>

        {/* Recent Projects */}
        {activeProjects > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-ink mb-4">Recent Projects</h2>
            <div className="space-y-3">
              <AnimatePresence>
                {projects.map((p, i) => {
                  const progress = p.total_points > 0 ? Math.round((p.done_points / p.total_points) * 100) : 0
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.01, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onOpenProject(p)}
                      className="w-full bg-surface rounded-lg border border-border p-4 text-left hover:border-border-strong transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-ink">{p.name}</h3>
                        <span className="text-sm text-ink-faint">{p.done_points}/{p.total_points} pts</span>
                      </div>
                      <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          className="bg-accent h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeProjects === 0 && (
          <div className="text-center py-16 text-ink-faint">
            <p className="text-2xl mb-2">🪝</p>
            <p className="text-base font-medium text-ink-muted">No projects yet</p>
            <p className="text-sm mt-2 text-ink-faint">Go to <span className="font-medium">Projects</span> to create your first one</p>
          </div>
        )}

        {/* Recycle Bin Info */}
        {recycleItems.length > 0 && (
          <div className="mt-10 p-4 bg-danger-subtle rounded-lg border border-danger/20">
            <p className="text-sm text-danger-strong">
              <span className="font-medium">{recycleItems.length}</span> items in Recycle Bin (will be permanently deleted in {30} days)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
