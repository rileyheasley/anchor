import type { Priority } from '../types'

export const PRIORITY_OPTIONS: Priority[] = ['none', 'low', 'medium', 'high']

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 }

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const PRIORITY_BADGES: Record<string, string> = {
  none: 'bg-surface-muted text-ink-muted',
  low: 'bg-accent-subtle text-accent-strong',
  medium: 'bg-warning-subtle text-warning-strong',
  high: 'bg-danger-subtle text-danger-strong',
}

export interface DueInfo {
  label: string
  color: string
}

export function dueDateInfo(dateStr: string | null): DueInfo | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-danger font-medium' }
  if (diff === 0) return { label: 'Due today', color: 'text-danger font-medium' }
  if (diff <= 3) return { label: `Due in ${diff}d`, color: 'text-warning' }
  if (diff <= 7) return { label: `Due in ${diff}d`, color: 'text-warning-hover' }
  return { label: `Due in ${diff}d`, color: 'text-ink-faint' }
}
