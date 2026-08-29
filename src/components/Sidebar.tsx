import { motion } from 'motion/react'
import { clickSound } from '../sounds'

type View = 'home' | 'notes' | 'archive' | 'recycle'

interface SidebarProps {
  view: View
  isInProject: boolean
  onNavigate: (view: View) => void
  onNewNote: () => void
  onNewProject: () => void
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

function ActionItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      onClick={() => { clickSound(); onClick() }}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      {label}
    </motion.button>
  )
}

export default function Sidebar({ view, isInProject, onNavigate, onNewNote, onNewProject }: SidebarProps) {
  return (
    <div className="w-48 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">

      {/* Nav */}
      <div className="flex flex-1 flex-col px-2 py-3 overflow-hidden">

        {/* Projects group */}
        <div className="space-y-0.5 mb-3">
          <NavItem
            label="Projects"
            active={view === 'home' || isInProject}
            onClick={() => onNavigate('home')}
          />
          <ActionItem label="+ New Project" onClick={onNewProject} />
        </div>

        {/* Notes group */}
        <div className="space-y-0.5">
          <NavItem
            label="Notes"
            active={view === 'notes'}
            onClick={() => onNavigate('notes')}
          />
          <ActionItem label="+ New Note" onClick={onNewNote} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom */}
        <div className="space-y-0.5 pb-1">
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
    </div>
  )
}

