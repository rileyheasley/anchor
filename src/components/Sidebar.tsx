import { motion } from 'motion/react'
import { clickSound } from '../sounds'

type View = 'home' | 'projects' | 'notes' | 'archive' | 'recycle'

interface SidebarProps {
  view: View
  isInProject: boolean
  onNavigate: (view: View) => void
}

function NavItem({
  label,
  active,
  danger,
  onClick,
}: {
  label: string
  active: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      onClick={() => { clickSound(); onClick() }}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
        active
          ? 'bg-surface-muted text-ink font-medium'
          : danger
          ? 'text-danger-hover hover:bg-danger-subtle hover:text-danger-strong'
          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary'
      }`}
    >
      {label}
    </motion.button>
  )
}

export default function Sidebar({ view, isInProject, onNavigate }: SidebarProps) {
  return (
    <div className="w-48 bg-surface border-r border-border flex flex-col shrink-0 h-full">

      {/* Nav */}
      <div className="flex flex-1 flex-col px-2 py-3 overflow-hidden space-y-0.5">

        {/* Home */}
        <NavItem
          label="Home"
          active={view === 'home'}
          onClick={() => onNavigate('home')}
        />

        {/* Projects */}
        <NavItem
          label="Projects"
          active={view === 'projects' || isInProject}
          onClick={() => onNavigate('projects')}
        />

        {/* Notes */}
        <NavItem
          label="Notes"
          active={view === 'notes'}
          onClick={() => onNavigate('notes')}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom */}
        <NavItem
          label="Archive"
          active={view === 'archive'}
          onClick={() => onNavigate('archive')}
        />
        <NavItem
          label="Recycle Bin"
          active={view === 'recycle'}
          danger
          onClick={() => onNavigate('recycle')}
        />

      </div>
    </div>
  )
}

