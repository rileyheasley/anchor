import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Home, FolderOpen, FileText, Archive, Trash2, ChevronLeft, ChevronRight, Sun, Settings, Search, Eye } from 'lucide-react'
import DraggableSidebar from './DraggableSidebar'
import IconNavItem from './IconNavItem'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useClickOutside } from '../hooks/useClickOutside'
import { THEME_OPTIONS, COLOURBLIND_THEME_OPTIONS, ALL_THEME_OPTIONS } from '../utils/theme'
import type { ThemeMode } from '../types'

type View = 'home' | 'projects' | 'notes' | 'archive' | 'recycle'

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  onOpenSettings: () => void
  onOpenSearch: () => void
}

export default function Sidebar({ 
  view, 
  onNavigate,
  themeMode,
  onThemeChange,
  onOpenSettings,
  onOpenSearch,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
  const [isColourblindMenuOpen, setIsColourblindMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => {
    if (isColourblindMenuOpen) setIsColourblindMenuOpen(false)
    else setIsThemeMenuOpen(false)
  }, isThemeMenuOpen)

  useClickOutside(themeMenuRef, () => {
    setIsThemeMenuOpen(false)
    setIsColourblindMenuOpen(false)
  }, isThemeMenuOpen)

  const ActiveThemeIcon = ALL_THEME_OPTIONS.find((t) => t.mode === themeMode)?.icon ?? Sun
  const isColourblindActive = COLOURBLIND_THEME_OPTIONS.some((t) => t.mode === themeMode)

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
        {/* Theme Menu */}
        <div className="relative" ref={themeMenuRef}>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => { clickSound(); setIsThemeMenuOpen((open) => !open) }}
            title="Theme"
            className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
          >
            <ActiveThemeIcon size={18} />
          </motion.button>

          <AnimatePresence>
            {isThemeMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute bottom-full left-0 mb-2 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[140px] z-50"
              >
                {THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
                  <motion.button
                    key={mode}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { clickSound(); onThemeChange(mode); setIsThemeMenuOpen(false); setIsColourblindMenuOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${
                      themeMode === mode
                        ? 'text-accent-hover font-medium bg-accent-subtle'
                        : 'text-ink-secondary hover:bg-surface-sunken'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </motion.button>
                ))}

                <div className="relative">
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsColourblindMenuOpen((open) => !open)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${
                      isColourblindActive
                        ? 'text-accent-hover font-medium bg-accent-subtle'
                        : 'text-ink-secondary hover:bg-surface-sunken'
                    }`}
                  >
                    <Eye size={16} />
                    Colourblind
                    <ChevronRight size={14} className="ml-auto" />
                  </motion.button>

                  <AnimatePresence>
                    {isColourblindMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute left-full top-0 ml-1 bg-surface border border-border-strong rounded-lg shadow-lg py-1 min-w-[150px] z-50"
                      >
                        {COLOURBLIND_THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
                          <motion.button
                            key={mode}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { clickSound(); onThemeChange(mode); setIsThemeMenuOpen(false); setIsColourblindMenuOpen(false) }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors ${
                              themeMode === mode
                                ? 'text-accent-hover font-medium bg-accent-subtle'
                                : 'text-ink-secondary hover:bg-surface-sunken'
                            }`}
                          >
                            <Icon size={16} />
                            {label}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => { clickSound(); onOpenSearch() }}
          title="Search"
          className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
        >
          <Search size={18} />
        </motion.button>

        {/* Settings */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => { clickSound(); onOpenSettings() }}
          title="Settings"
          className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
        >
          <Settings size={18} />
        </motion.button>

        {/* Collapse Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => { clickSound(); setIsCollapsed(!isCollapsed) }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
          className="flex items-center justify-center p-2 rounded-lg text-sm transition-colors text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </motion.button>
      </div>
    </DraggableSidebar>
  )
}

