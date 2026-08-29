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
          ? 'bg-gray-100 text-gray-900 font-medium'
          : danger
          ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      {label}
    </motion.button>
  )
}

export default function Sidebar({ view, isInProject, onNavigate }: SidebarProps) {
  return (
    <div className="w-48 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">

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

