import type { ProjectStatus } from '../types'

export const STATUS_OPTIONS: ProjectStatus[] = ['planning', 'in_progress', 'on_hold', 'done']

// Sort order: active work first, done last
export const STATUS_ORDER: Record<ProjectStatus, number> = { in_progress: 0, planning: 1, on_hold: 2, done: 3 }

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  done: 'Done',
}

export const STATUS_BADGES: Record<ProjectStatus, string> = {
  planning: 'bg-surface-muted text-ink-muted',
  in_progress: 'bg-accent-subtle text-accent-strong',
  on_hold: 'bg-warning-subtle text-warning-strong',
  done: 'bg-success-subtle text-success-strong',
}
