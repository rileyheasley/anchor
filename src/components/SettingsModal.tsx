import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Keyboard, SlidersHorizontal, Palette, Info, FolderOpen, Volume2 } from 'lucide-react'
import { clickSound } from '../sounds'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { getShortcutGroups } from '../shortcuts'
import { THEME_OPTIONS, COLOURBLIND_THEME_OPTIONS } from '../utils/theme'
import type { ThemeMode } from '../types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  soundsEnabled: boolean
  onSoundsEnabledChange: (enabled: boolean) => void
}

type Section = 'general' | 'appearance' | 'shortcuts' | 'about'

const SECTIONS: { id: Section; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
]

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <motion.button
      role="switch"
      aria-checked={checked}
      whileTap={{ scale: 0.92 }}
      onClick={() => { clickSound(); onChange(!checked) }}
      className={`relative w-10 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${
        checked ? 'bg-primary' : 'bg-surface-muted border border-border-strong'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </motion.button>
  )
}

export default function SettingsModal({
  isOpen,
  onClose,
  themeMode,
  onThemeChange,
  soundsEnabled,
  onSoundsEnabledChange,
}: SettingsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [section, setSection] = useState<Section>('general')
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)

  const handleClose = () => { clickSound(); onClose() }

  useEscapeKey(onClose, isOpen)
  useFocusTrap(panelRef, isOpen)

  useEffect(() => {
    if (!isOpen) return
    window.api.vault.getPath().then(setVaultPath).catch(() => setVaultPath(null))
    window.api.app.getVersion().then(setAppVersion).catch(() => setAppVersion(null))
  }, [isOpen])

  const handleChooseVault = async () => {
    clickSound()
    const chosen = await window.api.vault.choose()
    if (chosen) setVaultPath(chosen)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleClose}
        >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border-subtle rounded-lg shadow-lg w-[42rem] h-[32rem] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0">
          <h2 className="font-heading text-lg font-medium text-ink">Settings</h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClose}
            className="p-1 rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors cursor-pointer"
            title="Close settings"
          >
            <X size={20} />
          </motion.button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Section nav */}
          <nav className="w-44 shrink-0 border-r border-border-subtle p-2 space-y-0.5 overflow-y-auto">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <motion.button
                key={id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { clickSound(); setSection(id) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors ${
                  section === id
                    ? 'bg-accent-subtle text-accent-strong font-medium'
                    : 'text-ink-secondary hover:bg-surface-sunken'
                }`}
              >
                <Icon size={16} />
                {label}
              </motion.button>
            ))}
          </nav>

          {/* Section content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {section === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">Storage</h3>
                  <div className="flex items-center gap-2 mb-2 text-sm text-ink-secondary">
                    <FolderOpen size={16} className="text-ink-faint shrink-0" />
                    <span className="truncate" title={vaultPath ?? undefined}>
                      {vaultPath ?? 'No folder chosen'}
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleChooseVault}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-muted text-ink-secondary hover:bg-border-strong transition-colors cursor-pointer"
                  >
                    Change folder…
                  </motion.button>
                  <p className="text-xs text-ink-faint mt-2">Notes and project files are stored as markdown in this folder.</p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">Sound</h3>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-ink-secondary">
                      <Volume2 size={16} className="text-ink-faint shrink-0" />
                      Sound effects
                    </div>
                    <ToggleSwitch checked={soundsEnabled} onChange={onSoundsEnabledChange} />
                  </div>
                  <p className="text-xs text-ink-faint mt-2">Play a click when you create, move, complete, or delete things.</p>
                </div>
              </div>
            )}

            {section === 'appearance' && (
              <div>
                <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">Theme</h3>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
                    <motion.button
                      key={mode}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { clickSound(); onThemeChange(mode) }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                        themeMode === mode
                          ? 'bg-accent-subtle text-accent-strong font-medium ring-1 ring-inset ring-current'
                          : 'bg-surface-muted text-ink-secondary hover:bg-border-strong'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </motion.button>
                  ))}
                </div>

                <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3 mt-5">Colourblind</h3>
                <div className="grid grid-cols-2 gap-2">
                  {COLOURBLIND_THEME_OPTIONS.map(({ mode, label, icon: Icon }) => (
                    <motion.button
                      key={mode}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { clickSound(); onThemeChange(mode) }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                        themeMode === mode
                          ? 'bg-accent-subtle text-accent-strong font-medium ring-1 ring-inset ring-current'
                          : 'bg-surface-muted text-ink-secondary hover:bg-border-strong'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {section === 'shortcuts' && (
              <div className="space-y-5">
                {getShortcutGroups().map((group) => (
                  <div key={group.title}>
                    <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">{group.title}</h4>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <div key={item.description} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-ink-secondary">{item.description}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.keys.map((key, i) => (
                              <kbd
                                key={i}
                                className="px-1.5 py-0.5 text-xs font-medium bg-surface-muted text-ink border border-border-strong rounded"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {section === 'about' && (
              <div className="space-y-1">
                <h3 className="font-heading text-xl font-bold text-ink">Anchor</h3>
                <p className="text-sm text-ink-faint">{appVersion ? `Version ${appVersion}` : 'Loading version…'}</p>
                <p className="text-sm text-ink-secondary mt-4 max-w-sm">
                  A local-first project and notes tracker. Everything is stored as markdown files on your own disk — no
                  account, no sync, no cloud.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
