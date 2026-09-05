import { Sun, Moon, Heart, Monitor, Snowflake, Ghost, Terminal, BookOpen, Leaf, Waves, Contrast, Eye } from 'lucide-react'
import type { ThemeMode } from '../types'

export const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'pink', label: 'Folklore', icon: Heart },
  { mode: 'nord', label: 'Nord', icon: Snowflake },
  { mode: 'dracula', label: 'Dracula', icon: Ghost },
  { mode: 'solarized', label: 'Solarized', icon: Terminal },
  { mode: 'sepia', label: 'Sepia', icon: BookOpen },
  { mode: 'forest', label: 'Forest', icon: Leaf },
  { mode: 'ocean', label: 'Ocean', icon: Waves },
  { mode: 'contrast', label: 'High Contrast', icon: Contrast },
  { mode: 'system', label: 'System', icon: Monitor },
]

// Colourblind-friendly variants of Dark mode, shown in their own submenu/section.
export const COLOURBLIND_THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'deuteranopia', label: 'Deuteranopia', icon: Eye },
  { mode: 'protanopia', label: 'Protanopia', icon: Eye },
  { mode: 'tritanopia', label: 'Tritanopia', icon: Eye },
]

// Full set, for icon lookup and persisted-value validation.
export const ALL_THEME_OPTIONS = [...THEME_OPTIONS, ...COLOURBLIND_THEME_OPTIONS]
