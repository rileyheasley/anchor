// Preset node fill colors, keyed by name so node.data.color can store a stable string
// rather than a raw hex value that would break if the theme's tokens change.
export const NODE_COLORS = {
  neutral: 'var(--color-surface-muted)',
  accent: 'var(--color-accent-subtle)',
  success: 'var(--color-success-subtle)',
  warning: 'var(--color-warning-subtle)',
  danger: 'var(--color-danger-subtle)',
  special: 'var(--color-special-subtle)',
} as const

export const NODE_BORDER_COLORS = {
  neutral: 'var(--color-border-strong)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  special: 'var(--color-special)',
} as const

export type NodeColor = keyof typeof NODE_COLORS
export const NODE_COLOR_NAMES = Object.keys(NODE_COLORS) as NodeColor[]

export const DEFAULT_SHAPE_SIZE: Record<string, { width: number; height: number }> = {
  rectangle: { width: 140, height: 64 },
  diamond: { width: 150, height: 110 },
  text: { width: 100, height: 32 },
}
