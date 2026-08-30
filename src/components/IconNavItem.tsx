import { motion } from 'motion/react'
import { clickSound } from '../sounds'
import { LucideIcon } from 'lucide-react'

interface IconNavItemProps {
  icon: LucideIcon
  label: string
  active: boolean
  danger?: boolean
  collapsed?: boolean
  onClick: () => void
}

export default function IconNavItem({
  icon: Icon,
  label,
  active,
  danger = false,
  collapsed = false,
  onClick,
}: IconNavItemProps) {
  if (collapsed) {
    return (
      <motion.button
        onClick={() => {
          clickSound()
          onClick()
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title={label}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors mx-auto ${
          active
            ? danger
              ? 'bg-danger-subtle text-danger-strong'
              : 'bg-accent text-ink-inverse'
            : danger
            ? 'text-danger-hover hover:bg-danger-subtle hover:text-danger-strong'
            : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary'
        }`}
      >
        <Icon size={20} />
      </motion.button>
    )
  }

  return (
    <motion.button
      onClick={() => {
        clickSound()
        onClick()
      }}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-3 ${
        active
          ? 'bg-surface-muted text-ink font-medium'
          : danger
          ? 'text-danger-hover hover:bg-danger-subtle hover:text-danger-strong'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary'
      }`}
    >
      <Icon size={18} className="shrink-0" />
      <span>{label}</span>
    </motion.button>
  )
}
