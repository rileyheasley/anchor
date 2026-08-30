import { useState } from 'react'
import { Home, FolderOpen, FileText, Archive, Trash2, ChevronLeft, ChevronRight, Moon, Sun, Settings } from 'lucide-react'
import DraggableSidebar from './DraggableSidebar'
import IconNavItem from './IconNavItem'
import { clickSound } from '../sounds'

type View = 'home' | 'projects' | 'notes' | 'archive' | 'recycle'

interface SidebarProps {
  view: View
  isInProject: boolean
  onNavigate: (view: View) => void
  isDarkMode: boolean
  onThemeToggle: (dark: boolean) => void
  onOpenSettings: () => void
}

export default function Sidebar({ 
  view, 
  isInProject, 
  onNavigate,
  isDarkMode,
  onThemeToggle,
  onOpenSettings
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, view: 'home' as const },
    { id: 'projects', label: 'Projects', icon: FolderOpen, view: 'projects' as const },
    { id: 'notes', label: 'Notes', icon: FileText, view: 'notes' as const },
  ]

  const bottomItems = [
    { id: 'archive', label: 'Archive', icon: Archive, view: 'archive' as const, danger: false },
    { id: 'recycle', label: 'Recycle Bin', icon: Trash2, view: 'recycle' as const, danger: true },
  ]

  return (
    <DraggableSidebar
      isCollapsed={isCollapsed}
      onCollapsedChange={setIsCollapsed}
      minWidth={60}
      maxWidth={300}
      defaultWidth={200}
      collapsedWidth={60}
    >
      {/* Nav Items */}
      <div className="flex flex-1 flex-col px-2 py-3 overflow-y-auto space-y-0.5">
        {navItems.map((item) => (
          <IconNavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={view === item.view}
            collapsed={isCollapsed}
            onClick={() => onNavigate(item.view)}
          />
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Items */}
        {bottomItems.map((item) => (
          <IconNavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={view === item.view}
            danger={item.danger}
            collapsed={isCollapsed}
            onClick={() => onNavigate(item.view)}
          />
        ))}
      </div>

      {/* Footer Controls */}
      <div className={`border-t border-border-subtle px-2 py-2 flex gap-1 shrink-0 ${
        isCollapsed ? 'flex-col items-center' : 'flex-row items-center'
      }`}>
        {/* Theme Toggle */}
        <button
          onClick={() => { clickSound(); onThemeToggle(!isDarkMode) }}
          title={isDarkMode ? 'Light mode' : 'Dark mode'}
          className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
        >
          {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Settings */}
        <button
          onClick={() => { clickSound(); onOpenSettings() }}
          title="Settings"
          className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
        >
          <Settings size={18} />
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={() => { clickSound(); setIsCollapsed(!isCollapsed) }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
          className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </DraggableSidebar>
  )
}

