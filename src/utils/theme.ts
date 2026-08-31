import { Sun, Moon, Heart, Monitor } from 'lucide-react'
import type { ThemeMode } from '../types'

export const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'pink', label: 'Pastel Pink', icon: Heart },
  { mode: 'system', label: 'System', icon: Monitor },
]
